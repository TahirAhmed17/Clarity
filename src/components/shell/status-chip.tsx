import { getEnv } from "@/server/config/env";
import { getDataStatus } from "@/server/data";
import { connection } from "next/server";
import { Badge } from "@/components/ui/primitives";

/** Shows which data source and AI engine are active, so demo/fallback states are never hidden. */
export async function StatusChip() {
  await connection();
  const status = await getDataStatus();
  const env = getEnv();
  return (
    <div className="flex flex-wrap items-center gap-1.5" title={status.reason}>
      <Badge tone={status.mode === "database" ? "teal" : "neutral"}>{status.mode === "database" ? "Database" : "Seed data (offline)"}</Badge>
      <Badge tone="mist">AI: {env.AI_ENGINE}</Badge>
    </div>
  );
}
