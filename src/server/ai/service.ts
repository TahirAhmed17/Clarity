import type { ServerEnv } from "../config/env";
import type { HealthRepository } from "../data/repository";
import { log } from "../log";
import { buildHealthContext } from "./context";
import { AIEngineError, toAIEngineError } from "./errors";
import { createEngine } from "./factory";
import { MockEngine } from "./engines/mock";
import { applySafety } from "./safety";
import { CompanionRequestSchema, type CompanionResponse } from "./schemas";
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

/**
 * Orchestrates one companion turn: context → engine → safety → persistence.
 * If the configured engine is unavailable or fails and AI_FALLBACK_TO_MOCK=true,
 * the mock engine answers and the response carries a visible engineNotice.
 */
export async function respond(
  profileId: string,
  question: string | null,
  deps: { repo: HealthRepository; env: ServerEnv; engineOverride?: AIEngine },
): Promise<CompanionResponse> {
  const { repo, env } = deps;
  const profile = await repo.getProfile(profileId);
  if (!profile) throw new Error("Profile not found");

  const [biomarkers, wearables, symptoms] = await Promise.all([
    repo.listBiomarkers(profileId),
    repo.listWearableMetrics(profileId),
    repo.listSymptoms(profileId),
  ]);
  const context = buildHealthContext({ profile, biomarkers, wearables, symptoms });
  const request = CompanionRequestSchema.parse({ question: question?.trim() || null, context });

  const engine = deps.engineOverride ?? createEngine(env.AI_ENGINE, env);
  const allowFallback = env.AI_FALLBACK_TO_MOCK === "true";
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
    if (!allowFallback || engine.id === "mock") throw e;
    used = new MockEngine();
    notice = `${engine.label} unavailable (${e.message}). Showing the offline mock engine instead.`;
    raw = await runEngine(used, request, env.AI_TIMEOUT_MS);
  }

  const response = applySafety(raw, request.context, { engine: used.id, engineNotice: notice });
  log.info("ai.respond", { engine: used.id, durationMs: Date.now() - started });

  if (request.question) await repo.addMessage(profileId, { role: "user", content: request.question, structured: null, engine: null });
  await repo.addMessage(profileId, { role: "assistant", content: response.nextMove.title, structured: response, engine: used.id });
  return response;
}
