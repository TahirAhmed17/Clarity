/**
 * M2.3 engine evaluation. Runs gemini, lingsante and mock on identical synthetic cases.
 * Engines without keys are reported as "skipped" — never simulated.
 * Usage: npm run eval:engines   (reads .env.local) → docs/benchmarks/engines-<date>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { EVAL_CASES, runEvaluation } from "../src/server/ai/evaluation";
import { parseEnv } from "../src/server/config/env";
import { MiniLmEmbedder } from "../src/server/evidence/embedder";
import { InMemoryRetriever } from "../src/server/evidence/memory-retriever";

config({ path: ".env.local" });

async function main() {
  const env = parseEnv(process.env);
  const rows = await runEvaluation(env, ["gemini", "lingsante", "mock"], new InMemoryRetriever(new MiniLmEmbedder()));
  console.table(
    rows.map((r) => ({
      engine: r.engine,
      case: r.caseId,
      status: r.status,
      ms: r.latencyMs ?? "",
      flagOK: r.flagCorrect ?? "",
      noDose: r.noDoseInFinal ?? "",
      rawBadCites: r.rawCitedUnsupplied ?? "",
      rawMoveMatch: r.rawNextMoveCategoryMatches ?? "",
      interventions: r.safetyInterventions?.length ?? "",
      reason: r.reason?.slice(0, 60) ?? "",
    })),
  );
  mkdirSync("docs/benchmarks", { recursive: true });
  const file = `docs/benchmarks/engines-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), cases: EVAL_CASES.map(({ id, description, question }) => ({ id, description, question })), rows }, null, 2));
  console.log(`Saved ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
