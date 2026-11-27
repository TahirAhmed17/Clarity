import type { ServerEnv } from "../config/env";
import { respond } from "../ai/service";
import { getRepository } from "../data";
import { getRetriever } from "../evidence";
import { getCurrentProfileId } from "../session";

export interface WarmupStep {
  name: string;
  ms: number;
  ok: boolean;
  note?: string;
}

async function timed(name: string, fn: () => Promise<string | void>): Promise<WarmupStep> {
  const t = performance.now();
  try {
    const note = await fn();
    return { name, ms: Math.round(performance.now() - t), ok: true, ...(note ? { note } : {}) };
  } catch (e) {
    return { name, ms: Math.round(performance.now() - t), ok: false, note: e instanceof Error ? e.message.slice(0, 160) : "failed" };
  }
}

/**
 * Pre-loads everything the first question would otherwise wait for: the data source, the embedding
 * model and evidence retrieval, and one full AI turn. Nothing is saved to the conversation.
 */
export async function warmUp(env: ServerEnv): Promise<{ ok: boolean; totalMs: number; steps: WarmupStep[] }> {
  const start = performance.now();
  const steps: WarmupStep[] = [];
  steps.push(
    await timed("data", async () => {
      const repo = await getRepository();
      await repo.getProfile(getCurrentProfileId());
      return repo.mode;
    }),
  );
  steps.push(
    await timed("evidence search (loads embedding model)", async () => {
      const r = await getRetriever();
      const { modeUsed, results } = await r.search("how much sleep do adults need", { k: 1, mode: "vector" });
      return `${r.id}, ${modeUsed}, ${results.length} result`;
    }),
  );
  steps.push(
    await timed("AI turn (not saved)", async () => {
      const res = await respond(getCurrentProfileId(), "Give me an overview of my results", {
        repo: await getRepository(),
        env,
        retriever: await getRetriever(),
        persist: false,
      });
      return `engine ${res.engine}${res.engineNotice ? " (fallback)" : ""}`;
    }),
  );
  return { ok: steps.every((s) => s.ok), totalMs: Math.round(performance.now() - start), steps };
}
