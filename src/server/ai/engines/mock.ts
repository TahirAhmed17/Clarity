import type { AIEngine } from "../types";
import type { CompanionRequest, EngineOutput, HealthContext } from "../schemas";

type Biomarker = HealthContext["biomarkers"][number];

/**
 * Deterministic, offline engine. No network, no key.
 * It only restates supplied data and uses fixed, conservative wording — it is a
 * development stand-in for the LLM engines, not a source of health insight.
 */
const PRIORITY: { code: string; status: "below" | "above"; move: EngineOutput["nextMove"] }[] = [
  {
    code: "FERRITIN",
    status: "below",
    move: {
      title: "Book a GP chat about your low ferritin",
      detail: "Ferritin reflects iron stores. Low stores can relate to tiredness, and the cause is worth a professional look before any supplement.",
      category: "professional",
    },
  },
  {
    code: "LDL",
    status: "above",
    move: {
      title: "Add one fibre-rich swap to lunch this week",
      detail: "Oats, beans or lentils at lunch are a small, sustainable step often discussed alongside raised LDL. Re-testing later shows whether things move.",
      category: "nutrition",
    },
  },
  {
    code: "VITD25OH",
    status: "below",
    move: {
      title: "Get 15 minutes of morning daylight on workdays",
      detail: "Daylight supports your sleep rhythm. Your vitamin D result is below the lab's range — ask a professional whether supplementing makes sense for you.",
      category: "movement",
    },
  },
];

function describe(b: Biomarker) {
  const where = b.rangeStatus === "above" ? "above" : "below";
  const prev = b.previous ? ` (previously ${b.previous.valueText}${b.previous.observedOn ? ` on ${b.previous.observedOn}` : ""})` : "";
  return `${b.name} was ${b.valueText}${b.unit ? ` ${b.unit}` : ""}, ${where} the lab's range of ${b.refText}${prev}.`;
}

export class MockEngine implements AIEngine {
  readonly id = "mock" as const;
  readonly label = "Mock engine (offline)";
  readonly experimental = false;

  availability() {
    return { ok: true, reason: "Always available offline" };
  }

  async generate(req: CompanionRequest): Promise<EngineOutput> {
    const { context } = req;
    const flagged = context.biomarkers.filter((b) => b.rangeStatus === "above" || b.rangeStatus === "below");
    const q = req.question?.toLowerCase() ?? "";

    if (context.biomarkers.length === 0) {
      return {
        noticed: context.symptoms.slice(0, 2).map((s) => ({ title: "Something you told us", detail: s.description, refs: [] })),
        whyItMatters: "Without lab results I can only reflect what you've shared. A recent blood report would let me point to something specific.",
        nextMove: {
          title: "Upload your latest blood report",
          detail: "A digital PDF from your lab works best. I'll keep the lab's own units and reference ranges.",
          category: "other",
        },
        supportingActions: [],
        evidence: [],
        limitations: ["No lab results are available yet, so nothing here is based on measurements."],
        followUps: ["What should I ask for at my next blood test?"],
        flagForProfessional: false,
      };
    }

    const top = PRIORITY.find((p) => flagged.some((b) => b.code === p.code && b.rangeStatus === p.status));
    const nextMove: EngineOutput["nextMove"] = top?.move ?? {
      title: flagged.length ? "Share your flagged results with a professional" : "Keep your current routine and re-test as planned",
      detail: flagged.length
        ? "Some results sit outside the lab's ranges. A professional can put them in context."
        : "Your results sit within the lab's ranges. Ranges are a guide, not a guarantee.",
      category: flagged.length ? "professional" : "other",
    };

    const sleep = context.wearables.find((w) => w.metric === "sleep_asleep");
    const supporting: EngineOutput["supportingActions"] = [];
    if (sleep?.avg7d && sleep.avg7d < 420 && (q.includes("sleep") || context.profile.goals.some((g) => /sleep/i.test(g)))) {
      supporting.push({
        title: "Move your wind-down 20 minutes earlier",
        detail: `Your wearable shows about ${Math.round(sleep.avg7d / 6) / 10} hours asleep on average over the last week.`,
        category: "sleep",
      });
    }
    if (top?.code !== "LDL" && flagged.some((b) => b.code === "LDL")) {
      supporting.push({ title: "Add one fibre-rich swap to lunch", detail: "A small step often discussed alongside raised LDL.", category: "nutrition" });
    }

    const limitations = [
      "This is the offline mock engine: it restates your data with fixed wording and does not interpret it.",
      "Comparisons use only the reference ranges printed by your lab.",
      ...context.missing.slice(0, 2),
    ];

    return {
      noticed: flagged.slice(0, 4).map((b) => ({
        title: `${b.name} is ${b.rangeStatus === "above" ? "above" : "below"} the lab's range`,
        detail: describe(b),
        refs: b.code ? [b.code] : [],
      })),
      whyItMatters: q
        ? `You asked: "${req.question}". Based on your data, the clearest thing to act on is: ${nextMove.title.toLowerCase()}.`
        : flagged.length
          ? `${flagged.length} result${flagged.length > 1 ? "s sit" : " sits"} outside the lab's ranges. None of this is a diagnosis, but it's worth acting on calmly.`
          : "Your available results sit within the lab's printed ranges.",
      nextMove,
      supportingActions: supporting.slice(0, 3),
      evidence: [],
      limitations: limitations.slice(0, 6),
      followUps: ["What does ferritin measure?", "How has my LDL changed?", "What should I track before my next test?"],
      flagForProfessional: flagged.length > 0,
    };
  }
}
