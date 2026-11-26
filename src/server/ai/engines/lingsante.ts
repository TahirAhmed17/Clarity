import { AIEngineError, extractJson, toAIEngineError } from "../errors";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "../prompt";
import { EngineOutputSchema, engineOutputJsonSchema, type CompanionRequest, type EngineOutput } from "../schemas";
import type { AIEngine } from "../types";

/**
 * EXPERIMENTAL engine: InclusionAI LingSante via OpenRouter's OpenAI-compatible
 * chat-completions endpoint. Same prompt, same schema, same safety layer as Gemini.
 * Status: adapter implemented, NOT verified — the model slug and its JSON-mode support
 * on OpenRouter must be confirmed before use (set LINGSANTE_MODEL_ID explicitly).
 */
export class LingSanteEngine implements AIEngine {
  readonly id = "lingsante" as const;
  readonly label = "LingSante (experimental, via OpenRouter)";
  readonly experimental = true;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly modelId: string | undefined,
    private readonly baseUrl: string,
  ) {}

  availability() {
    if (!this.apiKey) return { ok: false, reason: "OPENROUTER_API_KEY is not set" };
    if (!this.modelId) return { ok: false, reason: "LINGSANTE_MODEL_ID is not set (slug not verified by this project)" };
    return { ok: true, reason: `Configured model ${this.modelId}` };
  }

  async generate(req: CompanionRequest, opts: { signal: AbortSignal }): Promise<EngineOutput> {
    const a = this.availability();
    if (!a.ok) throw new AIEngineError("unavailable", this.id, a.reason);
    let body: { choices?: { message?: { content?: string } }[] };
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: opts.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Title": "Clarity" },
        body: JSON.stringify({
          model: this.modelId,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${SYSTEM_INSTRUCTION}\n\nJSON schema for your reply:\n${JSON.stringify(engineOutputJsonSchema)}`,
            },
            { role: "user", content: buildUserPrompt(req) },
          ],
        }),
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      body = await res.json();
    } catch (err) {
      throw toAIEngineError(this.id, err);
    }
    const parsed = EngineOutputSchema.safeParse(extractJson(this.id, body.choices?.[0]?.message?.content));
    if (!parsed.success) throw new AIEngineError("invalid_output", this.id, "LingSante output did not match the response schema.");
    return parsed.data;
  }
}
