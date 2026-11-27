import { connection } from "next/server";
import { getEnv } from "@/server/config/env";
import { warmUp } from "@/server/demo/warmup";
import { errorResponse, json } from "@/server/http";

/** GET — pre-loads data, the embedding model and one AI turn (unsaved). Returns timings. */
export async function GET() {
  await connection();
  try {
    return json(await warmUp(getEnv()));
  } catch (err) {
    return errorResponse(err, "warmup");
  }
}
