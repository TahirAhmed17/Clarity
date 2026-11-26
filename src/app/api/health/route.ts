import { connection } from "next/server";
import { listEngines } from "@/server/ai/factory";
import { getEnv } from "@/server/config/env";
import { getDataStatus } from "@/server/data";
import { json } from "@/server/http";

/** System status. Reports configuration state only — never secrets or health data. */
export async function GET() {
  await connection();
  const env = getEnv();
  const data = await getDataStatus();
  return json({
    ok: true,
    data,
    ai: {
      selected: env.AI_ENGINE,
      fallbackToMock: env.AI_FALLBACK_TO_MOCK === "true",
      engines: listEngines(env).map(({ id, label, experimental, ok, reason, selected }) => ({ id, label, experimental, available: ok, reason, selected })),
    },
    limits: { reportMb: env.MAX_REPORT_UPLOAD_MB, wearableMb: env.MAX_WEARABLE_UPLOAD_MB },
  });
}
