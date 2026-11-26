import type { ServerEnv } from "../config/env";
import { GeminiEngine } from "./engines/gemini";
import { LingSanteEngine } from "./engines/lingsante";
import { MockEngine } from "./engines/mock";
import type { AIEngine, EngineId } from "./types";

export function createEngine(id: EngineId, env: ServerEnv): AIEngine {
  switch (id) {
    case "gemini":
      return new GeminiEngine(env.GEMINI_API_KEY, env.GEMINI_MODEL);
    case "lingsante":
      return new LingSanteEngine(env.OPENROUTER_API_KEY, env.LINGSANTE_MODEL_ID, env.OPENROUTER_BASE_URL);
    case "mock":
      return new MockEngine();
  }
}

export function listEngines(env: ServerEnv) {
  return (["gemini", "lingsante", "mock"] as const).map((id) => {
    const e = createEngine(id, env);
    return { id, label: e.label, experimental: e.experimental, ...e.availability(), selected: env.AI_ENGINE === id };
  });
}
