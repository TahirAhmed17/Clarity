export type AIErrorCode = "unavailable" | "timeout" | "network" | "provider_error" | "invalid_output" | "rate_limited";

/** Centralised AI error. `message` is safe to log (never contains health data or keys). */
export class AIEngineError extends Error {
  constructor(
    readonly code: AIErrorCode,
    readonly engine: string,
    message: string,
  ) {
    super(message);
    this.name = "AIEngineError";
  }
}

export function toAIEngineError(engine: string, err: unknown): AIEngineError {
  if (err instanceof AIEngineError) return err;
  if (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message))) {
    return new AIEngineError("timeout", engine, "The AI engine took too long to respond.");
  }
  const status = (err as { status?: number })?.status;
  if (status === 429) return new AIEngineError("rate_limited", engine, "The AI provider rate-limited the request.");
  if (status) return new AIEngineError("provider_error", engine, `The AI provider returned HTTP ${status}.`);
  return new AIEngineError("network", engine, "Could not reach the AI provider.");
}

/** Extracts a JSON object from model text (tolerates ```json fences). */
export function extractJson(engine: string, text: string | undefined | null): unknown {
  if (!text) throw new AIEngineError("invalid_output", engine, "The AI engine returned an empty response.");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new AIEngineError("invalid_output", engine, "The AI engine did not return JSON.");
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new AIEngineError("invalid_output", engine, "The AI engine returned malformed JSON.");
  }
}
