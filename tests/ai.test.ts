import { describe, expect, it, vi } from "vitest";
import { HEALTH_DISCLAIMER } from "@/lib/constants";
import { DEMO_PROFILE_ID } from "@/data/synthetic/dataset";
import { parseEnv } from "@/server/config/env";
import { SeedRepository } from "@/server/data/seed-repository";
import { buildHealthContext } from "@/server/ai/context";
import { GeminiEngine } from "@/server/ai/engines/gemini";
import { LingSanteEngine } from "@/server/ai/engines/lingsante";
import { MockEngine } from "@/server/ai/engines/mock";
import { extractJson } from "@/server/ai/errors";
import { listEngines } from "@/server/ai/factory";
import { applySafety } from "@/server/ai/safety";
import { CompanionResponseSchema, EngineOutputSchema, type EngineOutput } from "@/server/ai/schemas";
import { respond } from "@/server/ai/service";
import type { AIEngine } from "@/server/ai/types";

const offlineEnv = parseEnv({ NODE_ENV: "test", DATA_MODE: "seed", AI_ENGINE: "mock" });

async function demoContext() {
  const repo = new SeedRepository();
  const profile = (await repo.getProfile(DEMO_PROFILE_ID))!;
  return buildHealthContext({
    profile,
    biomarkers: await repo.listBiomarkers(DEMO_PROFILE_ID),
    wearables: await repo.listWearableMetrics(DEMO_PROFILE_ID),
    symptoms: await repo.listSymptoms(DEMO_PROFILE_ID),
  });
}

const baseOutput = (): EngineOutput => ({
  noticed: [],
  whyItMatters: "x",
  nextMove: { title: "Walk", detail: "Walk more", category: "movement" },
  supportingActions: [],
  evidence: [],
  limitations: ["l"],
  followUps: [],
  flagForProfessional: false,
});

describe("environment", () => {
  it("defaults to offline-safe settings with no variables", () => {
    const env = parseEnv({});
    expect(env).toMatchObject({ DATA_MODE: "auto", AI_ENGINE: "mock", AI_FALLBACK_TO_MOCK: "true" });
  });
  it("treats empty strings as unset and reports invalid names without values", () => {
    expect(parseEnv({ GEMINI_API_KEY: "  " }).GEMINI_API_KEY).toBeUndefined();
    expect(() => parseEnv({ AI_ENGINE: "gpt", GEMINI_API_KEY: "secret-value" })).toThrow(/AI_ENGINE/);
    try {
      parseEnv({ AI_ENGINE: "gpt", GEMINI_API_KEY: "secret-value" });
    } catch (e) {
      expect(String(e)).not.toContain("secret-value");
    }
  });
});

describe("health context", () => {
  it("summarises the seed profile without identifiers", async () => {
    const ctx = await demoContext();
    expect(ctx.biomarkers.find((b) => b.code === "VITD25OH")?.rangeStatus).toBe("below");
    expect(ctx.wearables.find((w) => w.metric === "steps")?.days).toBe(7);
    expect(JSON.stringify(ctx)).not.toContain("Alex");
    expect(JSON.stringify(ctx)).not.toContain(DEMO_PROFILE_ID);
  });

  it("uses one value per day when an import overlaps seed data (no cross-source averaging)", async () => {
    const repo = new SeedRepository();
    const days = ["2026-10-18", "2026-10-19", "2026-10-20"];
    await repo.upsertWearableMetrics(
      DEMO_PROFILE_ID,
      days.map((day) => ({ documentId: null, metricType: "steps" as const, value: 1000, unit: "count" as const, aggregation: "sum" as const, day, sampleCount: 3, sourceFormat: "apple_health_xml", sourceName: "Watch" })),
    );
    const ctx = buildHealthContext({
      profile: (await repo.getProfile(DEMO_PROFILE_ID))!,
      biomarkers: [],
      wearables: await repo.listWearableMetrics(DEMO_PROFILE_ID),
      symptoms: [],
    });
    const seedSteps = (await repo.listWearableMetrics(DEMO_PROFILE_ID))
      .filter((w) => w.metricType === "steps" && w.sourceFormat === "synthetic_seed" && ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"].includes(w.day))
      .map((w) => w.value);
    const expected = Math.round(((seedSteps.reduce((a, b) => a + b, 0) + 3000) / 7) * 10) / 10;
    expect(ctx.wearables.find((w) => w.metric === "steps")).toMatchObject({ days: 7, avg7d: expected });
  });
});

describe("mock engine", () => {
  it("works offline and returns schema-valid output", async () => {
    const out = await new MockEngine().generate({ question: null, context: await demoContext() });
    expect(EngineOutputSchema.safeParse(out).success).toBe(true);
    expect(out.flagForProfessional).toBe(true);
  });
  it("asks for a report when there are no lab results", async () => {
    const ctx = { ...(await demoContext()), biomarkers: [] };
    const out = await new MockEngine().generate({ question: null, context: ctx });
    expect(out.nextMove.title).toMatch(/upload/i);
  });
});

describe("safety validator (engine-independent)", () => {
  it("removes doses, diagnostic language and unsupplied citations; never lowers the flag", async () => {
    const ctx = await demoContext();
    const raw: EngineOutput = {
      ...baseOutput(),
      whyItMatters: "Your results look fine overall. You have iron deficiency anaemia.",
      nextMove: { title: "Take vitamin D", detail: "Take 4000 IU daily with food.", category: "supplement" },
      evidence: [{ evidenceId: "made-up-source", claim: "Invented" }],
    };
    const res = applySafety(raw, ctx, { engine: "test", engineNotice: null });
    expect(res.nextMove.detail).not.toMatch(/4000/);
    expect(res.whyItMatters).not.toMatch(/You have iron deficiency/);
    expect(res.evidence).toEqual([]);
    expect(res.flagForProfessional).toBe(true);
    expect(res.safety.interventions.length).toBeGreaterThanOrEqual(3);
    expect(res.disclaimer).toBe(HEALTH_DISCLAIMER);
    expect(CompanionResponseSchema.safeParse(res).success).toBe(true);
  });
});

describe("AI service", () => {
  it("answers in mock mode with no key or network, and persists the turn", async () => {
    const repo = new SeedRepository();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await respond(DEMO_PROFILE_ID, "Why am I tired in the afternoons?", { repo, env: offlineEnv });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(res.engine).toBe("mock");
    expect(res.disclaimer).toBe(HEALTH_DISCLAIMER);
    expect((await repo.listMessages(DEMO_PROFILE_ID)).map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("falls back to mock with a visible notice when Gemini has no key", async () => {
    const env = parseEnv({ NODE_ENV: "test", AI_ENGINE: "gemini" });
    const res = await respond(DEMO_PROFILE_ID, null, { repo: new SeedRepository(), env });
    expect(res.engine).toBe("mock");
    expect(res.engineNotice).toMatch(/GEMINI_API_KEY/);
  });

  it("falls back when an engine returns invalid output, and errors when fallback is disabled", async () => {
    const broken: AIEngine = {
      id: "gemini",
      label: "Broken",
      experimental: false,
      availability: () => ({ ok: true, reason: "" }),
      generate: async () => EngineOutputSchema.parse({}),
    };
    const res = await respond(DEMO_PROFILE_ID, null, { repo: new SeedRepository(), env: offlineEnv, engineOverride: broken });
    expect(res.engine).toBe("mock");
    const strict = parseEnv({ NODE_ENV: "test", AI_FALLBACK_TO_MOCK: "false" });
    await expect(respond(DEMO_PROFILE_ID, null, { repo: new SeedRepository(), env: strict, engineOverride: broken })).rejects.toThrow();
  });
});

describe("LLM adapters (offline checks only)", () => {
  it("report unavailability honestly without keys", () => {
    expect(new GeminiEngine(undefined, undefined).availability().ok).toBe(false);
    expect(new LingSanteEngine("k", undefined, "https://openrouter.ai/api/v1").availability().reason).toMatch(/LINGSANTE_MODEL_ID/);
    expect(listEngines(offlineEnv).find((e) => e.id === "mock")).toMatchObject({ ok: true, selected: true });
  });

  it("LingSante adapter sends the shared prompt + schema and validates the reply (stubbed HTTP)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "```json\n" + JSON.stringify(baseOutput()) + "\n```" } }] }), { status: 200 }),
    );
    const out = await new LingSanteEngine("k", "vendor/model", "https://example.test/v1").generate(
      { question: null, context: await demoContext() },
      { signal: new AbortController().signal },
    );
    expect(out.nextMove.title).toBe("Walk");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(String(init.body)).toContain("Never diagnose");
    fetchMock.mockRestore();
  });

  it("extractJson tolerates fences and rejects non-JSON", () => {
    expect(extractJson("x", '```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("x", "no json here")).toThrow(/did not return JSON/);
  });
});
