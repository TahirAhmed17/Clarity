/**
 * One-command demo launcher.
 *   npm run demo                 build if needed, start in SEED mode (synthetic data only), warm up
 *   npm run demo -- --port 3300  choose a port (default 3200)
 *   npm run demo -- --rebuild    force a fresh production build
 *   npm run demo -- --database   use DATABASE_URL instead of seed data (not recommended for demos)
 * Ctrl+C stops the server.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]) || (args.includes("--port") ? NaN : 3200);
const useDatabase = args.includes("--database");
const rebuild = args.includes("--rebuild");
const base = `http://localhost:${port}`;
const isWin = process.platform === "win32";

function step(msg: string) {
  console.log(`\n▸ ${msg}`);
}

async function waitForHealth(timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return (await r.json()) as { data: { mode: string; reason: string; pendingMigrations?: string[] }; ai: { selected: string; engines: { id: string; available: boolean; reason: string }[] } };
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 800));
  }
  throw new Error(`Server didn't become healthy on ${base} within ${timeoutMs / 1000}s`);
}

async function warm(label: string) {
  const r = await fetch(`${base}/api/warmup`);
  const j = (await r.json()) as { ok: boolean; totalMs: number; steps: { name: string; ms: number; ok: boolean; note?: string }[] };
  console.log(`  ${label}: ${j.totalMs} ms ${j.ok ? "" : "(some steps failed)"}`);
  for (const s of j.steps) console.log(`    ${s.ok ? "✓" : "✗"} ${s.name.padEnd(40)} ${String(s.ms).padStart(6)} ms  ${s.note ?? ""}`);
  return j.ok;
}

async function main() {
  if (!Number.isFinite(port)) throw new Error("--port needs a number");

  if (rebuild || !existsSync(".next/BUILD_ID")) {
    step("Building for production (one-off, about a minute)…");
    const b = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: isWin });
    if (b.status !== 0) process.exit(b.status ?? 1);
  }

  step(`Starting Clarity on ${base} (${useDatabase ? "DATABASE mode" : "SEED mode: synthetic data only"})`);
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "inherit"],
    shell: isWin,
    env: { ...process.env, ...(useDatabase ? {} : { DATA_MODE: "seed" }) },
  });
  server.stdout?.on("data", () => {}); // keep the pipe drained; health checks report readiness
  const stop = () => {
    // With shell:true on Windows, server.kill() only ends the shell wrapper; kill the whole tree.
    if (isWin && server.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else server.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", (code) => {
    console.log(`\nServer exited (${code}).`);
    process.exit(code ?? 0);
  });

  const health = await waitForHealth();
  console.log(`  Data: ${health.data.mode} (${health.data.reason})`);
  if (health.data.pendingMigrations?.length) console.log("  ⚠ Database needs updating: run npm run db:migrate");
  const engine = health.ai.engines.find((e) => e.id === health.ai.selected);
  console.log(`  AI engine: ${health.ai.selected}${engine && !engine.available ? ` (not available: ${engine.reason}; the mock answers instead)` : ""}`);

  step("Warming up (first run is cold, second shows the warm speed)");
  await warm("cold");
  await warm("warm");

  step("Pre-rendering demo pages");
  for (const p of ["/", "/app", "/app/insights", "/app/body", "/app/plan", "/app/discover", "/app/timeline", "/doctor/sign-in"]) {
    const t = performance.now();
    const r = await fetch(`${base}${p}`).catch(() => null);
    console.log(`  ${r?.ok ? "✓" : "✗"} ${p.padEnd(18)} ${Math.round(performance.now() - t)} ms`);
  }

  step("Ready");
  console.log(`  Open ${base}  (landing)  ·  ${base}/app  (the app)`);
  console.log(`  Reviewer: ${process.env.REVIEWER_ACCESS_CODE ? "access code is set in .env.local (REVIEWER_ACCESS_CODE)" : "REVIEWER_ACCESS_CODE is not set; /doctor will stay closed"}`);
  console.log("  Before presenting: click through each page once in the browser so 3D and fonts are cached.");
  console.log("  Between run-throughs: Profile → Reset demo.");
  console.log("  Press Ctrl+C to stop.");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
