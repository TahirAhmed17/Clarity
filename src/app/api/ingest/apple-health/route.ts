import { getEnv } from "@/server/config/env";
import { getRepository } from "@/server/data";
import { errorResponse, json, readUploadedFile } from "@/server/http";
import { ingestAppleHealthExport } from "@/server/ingestion/service";
import { getCurrentProfileId } from "@/server/session";

/** POST multipart/form-data { file: <Apple Health export.xml> } */
export async function POST(request: Request) {
  try {
    const env = getEnv();
    const maxBytes = env.MAX_WEARABLE_UPLOAD_MB * 1024 * 1024;
    const file = await readUploadedFile(request, maxBytes);
    const result = await ingestAppleHealthExport(getCurrentProfileId(), file, { repo: await getRepository(), maxBytes });
    return json(result, 201);
  } catch (err) {
    return errorResponse(err, "ingest.apple_health");
  }
}
