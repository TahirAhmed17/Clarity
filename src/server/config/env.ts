import { z } from "zod";

/**
 * Centralised, validated server configuration.
 * Every secret comes from environment variables; nothing is hard-coded.
 * Missing optional values degrade gracefully (seed data, mock AI) rather than crash.
 */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** auto: try DATABASE_URL, fall back to bundled seed data. database: require DB. seed: never touch DB. */
  DATA_MODE: z.preprocess(emptyToUndefined, z.enum(["auto", "database", "seed"]).default("auto")),
  DATABASE_URL: optionalString,
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),

  /** Which AI engine to use. mock works offline with no key. */
  AI_ENGINE: z.preprocess(emptyToUndefined, z.enum(["mock", "gemini", "lingsante"]).default("mock")),
  /** When the configured engine is unavailable, fall back to mock instead of failing. */
  AI_FALLBACK_TO_MOCK: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("true")),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  GEMINI_API_KEY: optionalString,
  /** Must be a model id currently offered by Google. Verify before use. */
  GEMINI_MODEL: optionalString,

  OPENROUTER_API_KEY: optionalString,
  /** OpenRouter slug for InclusionAI LingSante. Not verified by this project; set explicitly. */
  LINGSANTE_MODEL_ID: optionalString,
  OPENROUTER_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().default("https://openrouter.ai/api/v1")),

  /**
   * Allows "Reset demo" when connected to a DATABASE. Off by default: in database mode a reset
   * deletes every health record on the demo profile (including anything uploaded to it).
   * Seed mode can always reset (it only touches in-memory synthetic data).
   */
  DEMO_RESET_ALLOWED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),

  MAX_REPORT_UPLOAD_MB: z.coerce.number().positive().max(50).default(10),
  MAX_WEARABLE_UPLOAD_MB: z.coerce.number().positive().max(200).default(50),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | undefined;

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    // Report variable names only, never values (they may be secrets).
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${names}`);
  }
  return result.data;
}

export function getEnv(): ServerEnv {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test helper. */
export function resetEnvCache() {
  cached = undefined;
}
