import type { AIEngine } from "../types";
import type { CompanionRequest, EngineOutput, HealthContext } from "../schemas";

type Biomarker = HealthContext["biomarkers"][number];

/**
 * Deterministic, offline engine. No network, no key.
 * It restates the supplied data, recommendation and evidence with fixed wording. It's a
 * development and test stand-in for the LLM engines, not a source of interpretation.
 */
function describe(b: Biomarker) {
  const where = b.rangeStatus === "above" ? "above" : "below";
  const prev = b.previous ? ` It was ${b.previous.valueText}${b.previous.observedOn ? ` on ${b.previous.observedOn}` : ""}.` : "";
  return `${b.name} was ${b.valueText}${b.unit ? ` ${b.unit}` : ""}, ${where} the lab's range of ${b.refText}.${prev}`;
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
    const rec = context.recommendation;
    const evidenceIds = new Set(context.evidence.map((e) => e.id));

    if (context.biomarkers.length === 0) {
      return {
        noticed: context.symptoms.slice(0, 2).map((s) => ({ title: "Something you told us", detail: s.description, refs: [] })),
        whyItMatters: "Without lab results I can only reflect what you've shared. A recent blood report would let me point to something specific.",
        nextMove: rec
          ? { title: rec.primary.title, detail: rec.primary.detail, category: rec.primary.category }
          : { title: "Upload your latest blood report", detail: "A digital PDF from your lab works best.", category: "other" },
        supportingActions: [],
        evidence: [],
        limitations: ["No lab results are available yet, so nothing here is based on measurements."],
        followUps: ["What should I ask for at my next blood test?"],
        flagForProfessional: false,
      };
    }

    const primary = rec?.primary;
    const cited = (primary?.evidenceChunkIds ?? []).filter((id) => evidenceIds.has(id)).slice(0, 3);
    const evidence = cited.map((id) => ({ evidenceId: id, claim: context.evidence.find((e) => e.id === id)!.text.split(". ")[0] }));
    const reasons = primary?.reasons.length ? ` I chose this because ${primary.reasons.slice(0, 2).join(" and ")}.` : "";

    const trendNotes = context.biomarkers
      .filter((b) => b.previous && b.rangeStatus !== "within" && b.rangeStatus !== "no_range")
      .slice(0, 1)
      .map((b) => ({ title: `${b.name} compared with last time`, detail: `Previously ${b.previous!.valueText}, now ${b.valueText}${b.unit ? ` ${b.unit}` : ""}.`, refs: b.code ? [b.code] : [] }));

    return {
      noticed: [
        ...flagged.slice(0, 3).map((b) => ({
          title: `${b.name} is ${b.rangeStatus === "above" ? "above" : "below"} the lab's range`,
          detail: describe(b),
          refs: b.code ? [b.code] : [],
        })),
        ...trendNotes,
      ].slice(0, 5),
      whyItMatters:
        (req.question ? `You asked: "${req.question}". ` : "") +
        (flagged.length
          ? `${flagged.length} result${flagged.length > 1 ? "s sit" : " sits"} outside your lab's ranges. That isn't a diagnosis, but it's worth acting on calmly.`
          : "Your available results sit within the lab's printed ranges.") +
        reasons,
      nextMove: primary
        ? { title: primary.title, detail: primary.detail, category: primary.category }
        : { title: "Share your results with a professional", detail: "They can put them in context.", category: "professional" },
      supportingActions: (rec?.supporting ?? []).map((s) => ({ title: s.title, detail: s.detail, category: s.category })).slice(0, 3),
      evidence,
      limitations: [
        "This is the offline mock engine: it restates your data with fixed wording and does not interpret it.",
        "Comparisons use only the reference ranges printed by your lab.",
        ...context.missing.slice(0, 2),
      ].slice(0, 6),
      followUps: ["What does ferritin measure?", "How has my LDL changed?", "What should I track before my next test?"],
      flagForProfessional: flagged.length > 0,
    };
  }
}
