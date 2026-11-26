/**
 * Minimal structured logger that never logs health payloads.
 * Only event names and an allow-listed set of non-sensitive metadata keys are emitted.
 */
const SAFE_KEYS = new Set([
  "reason",
  "engine",
  "status",
  "code",
  "durationMs",
  "count",
  "kind",
  "sizeBytes",
  "route",
  "mode",
]);

type Meta = Record<string, string | number | boolean | undefined>;

function scrub(meta?: Meta) {
  if (!meta) return undefined;
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) if (SAFE_KEYS.has(k)) out[k] = v;
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, meta?: Meta) {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ level, event, ...scrub(meta), at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, meta?: Meta) => emit("info", event, meta),
  warn: (event: string, meta?: Meta) => emit("warn", event, meta),
  error: (event: string, meta?: Meta) => emit("error", event, meta),
};

export { scrub as _scrubForTest };
