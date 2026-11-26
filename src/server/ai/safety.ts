import { HEALTH_DISCLAIMER } from "@/lib/constants";
import type { CompanionResponse, EngineOutput, HealthContext } from "./schemas";

/**
 * Engine-independent safety validation. Runs on EVERY engine's output (mock included).
 * It can only make output more conservative — it never removes a professional flag.
 * M1 scope: deterministic rule checks. Expanded with evidence-grounding checks in M2.
 */

/**
 * Dose-like amounts ("4000 IU", "65 mg daily", "2 g a day"). Concentrations from lab results
 * ("13 ug/L", "124 g/L", "38 U/L", "5.2 mmol/L") are NOT doses: a unit followed by "/<volume|mass>"
 * is excluded, while "/day" style frequencies still count as doses.
 */
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|iu|i\.u\.|g|ml|units?)\b(?!\s?\/\s?(?:l|dl|ml|mmol|mol|kg|g)\b)(?:\s?(?:per|\/|a|each)\s?(?:day|daily|week|d))?/gi;
const DIAGNOSIS = [
  /\byou (?:have|are suffering from|have got|likely have|probably have)\s+(?:an?\s+)?(?:[a-z-]+\s){0,3}(?:disease|disorder|syndrome|deficiency|anaemia|anemia|diabetes|hypothyroidism|hyperthyroidism|failure|cancer|infection)\b/i,
  /\b(?:this|these results?) (?:confirms?|means?|indicates?|shows?) (?:that )?you have\b/i,
  /\bi (?:can )?diagnose\b/i,
];
const DIAGNOSIS_REPLACEMENT = "[Removed: Clarity doesn't diagnose — a healthcare professional can interpret this result.]";
const DOSE_REPLACEMENT = "[dose removed — only a professional sets doses]";

function sanitizeText(text: string, interventions: Set<string>): string {
  let out = text;
  if (DOSE.test(out)) {
    interventions.add("Removed a supplement/medication dose from the AI output.");
    out = out.replace(DOSE, DOSE_REPLACEMENT);
  }
  DOSE.lastIndex = 0;
  const sentences = out.split(/(?<=[.!?])\s+/);
  const kept = sentences.map((s) => {
    if (DIAGNOSIS.some((r) => r.test(s))) {
      interventions.add("Replaced diagnostic language in the AI output.");
      return DIAGNOSIS_REPLACEMENT;
    }
    return s;
  });
  return kept.join(" ");
}

export function applySafety(
  raw: EngineOutput,
  context: HealthContext,
  meta: { engine: string; engineNotice: string | null },
): CompanionResponse {
  const interventions = new Set<string>();
  const t = (s: string) => sanitizeText(s, interventions);

  // Evidence may only cite ids that were actually supplied.
  const allowed = new Set(context.evidence.map((e) => e.id));
  const evidence = raw.evidence.filter((e) => allowed.has(e.evidenceId));
  if (evidence.length !== raw.evidence.length) interventions.add("Removed evidence citations that were not in the supplied sources.");

  // Deterministic professional flag — engines can raise it, never lower it.
  const flagged = context.biomarkers.filter((b) => b.rangeStatus === "above" || b.rangeStatus === "below");
  const severeSymptom = context.symptoms.some((s) => (s.severity ?? 0) >= 4);
  const reasons = [
    ...flagged.map((b) => `${b.name} is ${b.rangeStatus} the lab's supplied range`),
    ...(severeSymptom ? ["A symptom was rated as severe"] : []),
  ];
  const flagForProfessional = raw.flagForProfessional || reasons.length > 0;
  if (!raw.flagForProfessional && reasons.length > 0) interventions.add("Raised the professional-attention flag based on out-of-range results.");

  const limitations = raw.limitations.map(t);
  if (context.biomarkers.length === 0 && !limitations.some((l) => /no lab|lab results/i.test(l))) {
    limitations.push("No lab results are available, so this isn't based on measurements.");
  }
  if (context.evidence.length === 0 && !limitations.some((l) => /evidence|sources/i.test(l))) {
    limitations.push("No curated evidence sources were retrieved for this answer.");
  }

  return {
    noticed: raw.noticed.map((n) => ({ ...n, title: t(n.title), detail: t(n.detail) })),
    whyItMatters: t(raw.whyItMatters),
    nextMove: { ...raw.nextMove, title: t(raw.nextMove.title), detail: t(raw.nextMove.detail) },
    supportingActions: raw.supportingActions.slice(0, 3).map((a) => ({ ...a, title: t(a.title), detail: t(a.detail) })),
    evidence,
    limitations: limitations.slice(0, 6),
    followUps: raw.followUps.map(t).slice(0, 4),
    flagForProfessional,
    safety: { flagForProfessional, reasons, interventions: [...interventions] },
    engine: meta.engine,
    engineNotice: meta.engineNotice,
    nextMoveReasons: [],
    sources: [],
    disclaimer: HEALTH_DISCLAIMER,
  };
}
