import { HEALTH_DISCLAIMER } from "@/lib/constants";
import { AIEngineError } from "./ai/errors";
import { IngestionError } from "./ingestion/errors";
import { log } from "./log";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps known errors to safe JSON responses. Unknown errors never leak internals. */
export function errorResponse(err: unknown, route: string) {
  if (err instanceof IngestionError) {
    return json({ error: { code: err.code, message: err.userMessage } }, err.status);
  }
  if (err instanceof AIEngineError) {
    log.warn("api.ai_error", { route, code: err.code, engine: err.engine });
    return json({ error: { code: `ai_${err.code}`, message: "The AI engine couldn't answer right now. Please try again." } }, 503);
  }
  log.error("api.unhandled", { route, reason: err instanceof Error ? err.name : "unknown" });
  return json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
}

/** Reads one file from multipart form data under field "file". */
export async function readUploadedFile(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  // Reject obviously oversized bodies before buffering them (multipart overhead allowance: 1MB).
  if (declared > maxBytes + 1024 * 1024) {
    throw new IngestionError("file_too_large", `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new IngestionError("missing_file", "Please attach a file.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new IngestionError("missing_file", "Please attach a file.");
  return { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export { HEALTH_DISCLAIMER };
