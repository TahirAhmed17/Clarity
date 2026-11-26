import { GoogleGenAI } from "@google/genai";
import { AIEngineError, extractJson, toAIEngineError } from "../errors";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "../prompt";
import { EngineOutputSchema, engineOutputJsonSchema, type CompanionRequest, type EngineOutput } from "../schemas";
import type { AIEngine } from "../types";

/**
 * Primary engine: Google Gemini via the official @google/genai SDK,
 * using constrained JSON output (responseJsonSchema) + zod validation.
 * Status: implemented, NOT yet verified against the live API (no key in this environment).
 */
export class GeminiEngine implements AIEngine {
  readonly id = "gemini" as const;
  readonly label = "Google Gemini";
  readonly experimental = false;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string | undefined,
  ) {}

  availability() {
    if (!this.apiKey) return { ok: false, reason: "GEMINI_API_KEY is not set" };
    if (!this.model) return { ok: false, reason: "GEMINI_MODEL is not set" };
    return { ok: true, reason: `Configured model ${this.model}` };
  }

  async generate(req: CompanionRequest, opts: { signal: AbortSignal }): Promise<EngineOutput> {
    const a = this.availability();
    if (!a.ok) throw new AIEngineError("unavailable", this.id, a.reason);
    const client = new GoogleGenAI({ apiKey: this.apiKey });
    let text: string | undefined;
    try {
      const res = await client.models.generateContent({
        model: this.model!,
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(req) }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.3,
          responseMimeType: "application/json",
          responseJsonSchema: engineOutputJsonSchema,
          abortSignal: opts.signal,
        },
      });
      text = res.text;
    } catch (err) {
      throw toAIEngineError(this.id, err);
    }
    const parsed = EngineOutputSchema.safeParse(extractJson(this.id, text));
    if (!parsed.success) throw new AIEngineError("invalid_output", this.id, "Gemini output did not match the response schema.");
    return parsed.data;
  }
}
