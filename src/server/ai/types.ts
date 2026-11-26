import type { CompanionRequest, EngineOutput } from "./schemas";

export type EngineId = "mock" | "gemini" | "lingsante";

export interface EngineAvailability {
  ok: boolean;
  reason: string;
}

/**
 * The single interface every AI engine implements.
 * Engines receive identical structured input and must return EngineOutput.
 * Safety validation happens OUTSIDE engines (see safety.ts) so it is engine-independent.
 */
export interface AIEngine {
  readonly id: EngineId;
  readonly label: string;
  readonly experimental: boolean;
  availability(): EngineAvailability;
  generate(request: CompanionRequest, opts: { signal: AbortSignal }): Promise<EngineOutput>;
}
