import { getEnv } from "@/server/config/env";
import { getRepository } from "@/server/data";
import { errorResponse, HEALTH_DISCLAIMER, json, readUploadedFile } from "@/server/http";
import { ingestBloodReport } from "@/server/ingestion/service";
import { getCurrentProfileId } from "@/server/session";

/** POST multipart/form-data { file: <blood report PDF> } */
export async function POST(request: Request) {
  try {
    const env = getEnv();
    const maxBytes = env.MAX_REPORT_UPLOAD_MB * 1024 * 1024;
    const file = await readUploadedFile(request, maxBytes);
    const result = await ingestBloodReport(getCurrentProfileId(), file, { repo: await getRepository(), maxBytes });
    return json({ ...result, disclaimer: HEALTH_DISCLAIMER }, 201);
  } catch (err) {
    return errorResponse(err, "ingest.report");
  }
}
