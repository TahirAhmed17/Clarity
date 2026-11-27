import type { SystemId } from "@/data/evidence/catalogue";
import type { Biomarker } from "@/lib/domain";
import { BIOMARKER_DEFINITIONS, getDefinition } from "../biomarkers/definitions";
import { biomarkerHistories, type BiomarkerHistory } from "../biomarkers/intelligence";
import type { RetrievedEvidence, Retriever } from "../evidence/retriever";

/**
 * Organ & system insights (M2.5). Deterministic summaries of what was measured for each body system.
 * Deliberately no "organ health score" and no disease statements.
 */

export interface SystemDefinition {
  id: SystemId;
  name: string;
  description: string;
  /** System-specific caveats always shown with the card. */
  limitations: string[];
}

export const SYSTEMS: SystemDefinition[] = [
  { id: "liver", name: "Liver", description: "Enzymes and substances that reflect how the liver is working.", limitations: ["Liver results are read as a pattern; one value rarely explains much on its own.", "Results can be temporarily raised after illness, alcohol, intense exercise or some medicines."] },
  { id: "kidneys", name: "Kidneys", description: "Markers of how well the kidneys filter waste.", limitations: ["Creatinine and eGFR depend on muscle mass, diet and age.", "Kidney assessment usually also needs a urine test, which blood results can't replace."] },
  { id: "cardiovascular", name: "Cardiovascular risk indicators", description: "Blood fats and related markers used in heart and circulation risk assessment.", limitations: ["These are risk indicators, not a measure of heart health.", "Blood pressure, smoking and family history also matter and aren't captured here."] },
  { id: "thyroid", name: "Thyroid", description: "Hormones that regulate the thyroid and metabolism.", limitations: ["TSH can move with other illness, pregnancy and some medicines.", "Thyroid results are usually interpreted together (TSH with free T4)."] },
  { id: "metabolic", name: "Metabolic", description: "Blood sugar markers and related measures.", limitations: ["HbA1c can be less accurate with anaemia and some other conditions.", "A single result is usually confirmed with a repeat or different test."] },
  { id: "blood", name: "Blood", description: "Blood cells, haemoglobin and the nutrients needed to make them.", limitations: ["Hydration, recent illness and menstrual periods can affect blood counts.", "Ferritin can rise with inflammation, so it isn't a pure iron measure."] },
];

export type SystemDataState = "none" | "partial" | "complete";

export interface SystemInsight {
  system: SystemDefinition;
  dataState: SystemDataState;
  /** Neutral summary — never a score. */
  summary: string;
  measurements: { code: string; name: string; role: "primary" | "supporting"; history: BiomarkerHistory }[];
  observations: string[];
  missing: { code: string; name: string; role: "primary" | "supporting" }[];
  limitations: string[];
  nextSteps: string[];
  evidence: RetrievedEvidence[];
  outsideRangeCount: number;
}

export function markersForSystem(system: SystemId) {
  return BIOMARKER_DEFINITIONS.flatMap((d) => d.systems.filter((s) => s.system === system).map((s) => ({ code: d.code, name: d.name, role: s.role })));
}

function fmtChange(h: BiomarkerHistory) {
  const c = h.change!;
  const pct = c.percent !== null ? ` (${c.percent > 0 ? "+" : ""}${c.percent}%)` : "";
  return `${h.name} went from ${c.from.valueText} to ${c.to.valueText} ${c.to.unitAsReported ?? ""}${pct} between ${c.from.observedOn} and ${c.to.observedOn}.`.replace(/\s+/g, " ");
}

export async function buildSystemInsights(biomarkers: Biomarker[], retriever: Retriever | null): Promise<SystemInsight[]> {
  const histories = new Map(biomarkerHistories(biomarkers).filter((h) => h.code).map((h) => [h.code!, h]));
  const out: SystemInsight[] = [];

  for (const system of SYSTEMS) {
    const expected = markersForSystem(system.id);
    const measurements = expected.filter((m) => histories.has(m.code)).map((m) => ({ ...m, history: histories.get(m.code)! }));
    const missing = expected.filter((m) => !histories.has(m.code));
    const primaryExpected = expected.filter((m) => m.role === "primary");
    const primaryMeasured = measurements.filter((m) => m.role === "primary");
    const dataState: SystemDataState = primaryMeasured.length === 0 ? "none" : primaryMeasured.length < primaryExpected.length ? "partial" : "complete";

    const outside = measurements.filter((m) => m.history.latest.rangeStatus === "above" || m.history.latest.rangeStatus === "below");
    const observations: string[] = [];
    for (const m of outside) {
      observations.push(`${m.history.name} (${m.history.latest.valueText} ${m.history.latest.unitAsReported ?? ""}) is ${m.history.latest.rangeStatus} your lab's printed range of ${m.history.latest.refText}.`.replace(/\s+/g, " "));
    }
    for (const m of measurements) if (m.history.change && m.history.change.direction !== "same") observations.push(fmtChange(m.history));

    const nextSteps: string[] = [];
    if (outside.some((m) => m.role === "primary")) {
      nextSteps.push(`Discuss ${outside.filter((m) => m.role === "primary").map((m) => m.history.name).join(", ")} with a healthcare professional, who can interpret them with your history.`);
    } else if (outside.length) {
      nextSteps.push(`Mention ${outside.map((m) => m.history.name).join(", ")} at your next appointment.`);
    }
    const missingPrimary = missing.filter((m) => m.role === "primary");
    if (missingPrimary.length && dataState !== "none") nextSteps.push(`Ask whether ${missingPrimary.map((m) => m.name).join(", ")} should be included next time you're tested.`);
    if (dataState === "none") nextSteps.push("There isn't enough data for this system yet. Results will appear here once a report includes them.");
    if (nextSteps.length === 0) nextSteps.push("Nothing here needs action based on these results. Keep re-testing as your clinician advises.");

    const summary =
      dataState === "none"
        ? "Not enough data"
        : outside.length
          ? `${outside.length} result${outside.length > 1 ? "s" : ""} outside your lab's range`
          : "No results outside your lab's ranges";

    let evidence: RetrievedEvidence[] = [];
    if (retriever && dataState !== "none") {
      const q = `${system.name} ${outside.map((m) => m.history.name).join(" ")} what these results mean`;
      try {
        evidence = (await retriever.search(q, { k: 3, filter: { systems: [system.id] }, mode: "vector" })).results;
      } catch {
        evidence = [];
      }
    }

    out.push({
      system,
      dataState,
      summary,
      measurements,
      observations,
      missing,
      limitations: [
        ...system.limitations,
        ...(dataState === "partial" ? [`Based on ${primaryMeasured.length} of ${primaryExpected.length} core markers for this system.`] : []),
        "Comparisons use only the reference ranges printed by your lab.",
      ],
      nextSteps,
      evidence,
      outsideRangeCount: outside.length,
    });
  }
  return out;
}

export function systemNamesForCode(code: string | null) {
  return getDefinition(code)?.systems.map((s) => s.system) ?? [];
}
