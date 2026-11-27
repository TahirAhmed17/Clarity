import type { ServerEnv } from "../config/env";
import type { HealthRepository } from "../data/repository";
import { loadCorpus, toRetrieved } from "../evidence/corpus";
import type { RetrievedEvidence, Retriever } from "../evidence/retriever";
import { loadSnapshot, recInputFrom } from "../insights/snapshot";
import { log } from "../log";
import { recommend, type Recommendation } from "../recommendations/engine";
import { buildSystemInsights } from "../systems/organ-systems";
import { AIEngineError, toAIEngineError } from "./errors";
import { createEngine } from "./factory";
import { MockEngine } from "./engines/mock";
import { applySafety } from "./safety";
import { CompanionRequestSchema, type CompanionResponse, type HealthContext } from "./schemas";
import type { AIEngine } from "./types";

async function runEngine(engine: AIEngine, request: Parameters<AIEngine["generate"]>[0], timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await engine.generate(request, { signal: controller.signal });
  } catch (err) {
    throw toAIEngineError(engine.id, err);
  } finally {
    clearTimeout(timer);
  }
}

const MAX_EVIDENCE = 8;
const CORPUS = new Map(loadCorpus().map((c) => [c.id, c]));

/** Evidence for one turn: retrieved for the question/flags + the evidence behind the recommendation. */
async function gatherEvidence(retriever: Retriever | null, question: string | null, flaggedNames: string[], rec: { primary: Recommendation; supporting: Recommendation[] }) {
  // Slot budget so question-specific retrieval is never crowded out:
  // ≤3 for the next move's evidence, ≤3 retrieved for the question, the rest for supporting actions.
  const out = new Map<string, RetrievedEvidence>();
  const addIds = (ids: string[], limit: number) => {
    let n = 0;
    for (const id of ids) {
      if (n >= limit || out.size >= MAX_EVIDENCE) break;
      const c = CORPUS.get(id);
      if (c && !out.has(id)) {
        out.set(id, toRetrieved(c, 1));
        n++;
      }
    }
  };
  addIds(rec.primary.evidenceChunkIds, 3);
  if (retriever) {
    const q = question ?? `What do these results mean: ${flaggedNames.join(", ") || "overall results"}`;
    try {
      const { results } = await retriever.search(q, { k: 6, mode: "vector" });
      let n = 0;
      for (const r of results) {
        if (n >= 3) break;
        if (!out.has(r.chunkId)) {
          out.set(r.chunkId, r);
          n++;
        }
      }
    } catch (e) {
      log.warn("evidence.retrieval_failed", { reason: e instanceof Error ? e.name : "unknown" });
    }
  }
  addIds(rec.supporting.flatMap((r) => r.evidenceChunkIds.slice(0, 1)), MAX_EVIDENCE);
  return [...out.values()].slice(0, MAX_EVIDENCE);
}

const recToContext = (r: Recommendation) => ({ id: r.id, title: r.title, detail: r.detail, category: r.category, reasons: r.reasons, evidenceChunkIds: r.evidenceChunkIds });

/**
 * One companion turn: snapshot → recommendation + systems + evidence → engine → safety → persistence.
 * The deterministic recommendation is authoritative for nextMove/supportingActions; the engine explains it.
 */
export async function respond(
  profileId: string,
  question: string | null,
  deps: { repo: HealthRepository; env: ServerEnv; retriever?: Retriever | null; engineOverride?: AIEngine; /** false = don't save the turn (warm-up). */ persist?: boolean },
): Promise<CompanionResponse> {
  const { repo, env } = deps;
  const q = question?.trim() || null;
  const snap = await loadSnapshot(repo, profileId);
  const rec = recommend(recInputFrom(snap, q));
  const systems = await buildSystemInsights(snap.biomarkers, null);
  const flaggedNames = snap.context.biomarkers.filter((b) => b.rangeStatus === "above" || b.rangeStatus === "below").map((b) => b.name);
  const evidence = await gatherEvidence(deps.retriever ?? null, q, flaggedNames, rec);

  const context: HealthContext = {
    ...snap.context,
    evidence: evidence.map((e) => ({ id: e.chunkId, source: `${e.source.publisher} — ${e.source.title}`, url: e.source.url, text: `${e.heading}. ${e.content}` })),
    systems: systems.map((s) => ({
      id: s.system.id,
      name: s.system.name,
      dataState: s.dataState,
      summary: s.summary,
      missingPrimary: s.missing.filter((m) => m.role === "primary").map((m) => m.name),
    })),
    recommendation: { primary: recToContext(rec.primary), supporting: rec.supporting.map(recToContext) },
  };
  const request = CompanionRequestSchema.parse({ question: q, context });

  const engine = deps.engineOverride ?? createEngine(env.AI_ENGINE, env);
  let used: AIEngine = engine;
  let notice: string | null = null;
  let raw;
  const started = Date.now();
  try {
    const a = engine.availability();
    if (!a.ok) throw new AIEngineError("unavailable", engine.id, a.reason);
    raw = await runEngine(engine, request, env.AI_TIMEOUT_MS);
  } catch (err) {
    const e = toAIEngineError(engine.id, err);
    log.warn("ai.engine_failed", { engine: engine.id, code: e.code });
    if (env.AI_FALLBACK_TO_MOCK !== "true" || engine.id === "mock") throw e;
    used = new MockEngine();
    notice = `${engine.label} unavailable (${e.message}). Showing the offline mock engine instead.`;
    raw = await runEngine(used, request, env.AI_TIMEOUT_MS);
  }

  const safe = applySafety(raw, request.context, { engine: used.id, engineNotice: notice });
  // Authoritative, deterministic next move (engine wording is kept only in whyItMatters).
  const response: CompanionResponse = {
    ...safe,
    nextMove: { title: rec.primary.title, detail: rec.primary.detail, category: rec.primary.category },
    supportingActions: rec.supporting.map((r) => ({ title: r.title, detail: r.detail, category: r.category })),
    nextMoveReasons: rec.primary.reasons,
    sources: evidence.map((e) => ({
      chunkId: e.chunkId,
      heading: e.heading,
      publisher: e.source.publisher,
      title: e.source.title,
      url: e.source.url,
      date: e.source.lastReviewedOn ?? e.source.lastUpdatedOn ?? e.source.publishedOn,
    })),
  };
  log.info("ai.respond", { engine: used.id, durationMs: Date.now() - started, count: evidence.length });

  if (deps.persist !== false) {
    if (q) await repo.addMessage(profileId, { role: "user", content: q, structured: null, engine: null });
    await repo.addMessage(profileId, { role: "assistant", content: response.nextMove.title, structured: response, engine: used.id });
  }
  return response;
}
