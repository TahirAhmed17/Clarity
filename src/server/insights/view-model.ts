import { EVIDENCE_NOTES, type SystemId } from "@/data/evidence/catalogue";
import type { Biomarker, RangeStatus, WearableMetric } from "@/lib/domain";
import { getDefinition } from "../biomarkers/definitions";
import { biomarkerHistories, validateBiomarkers } from "../biomarkers/intelligence";
import { evidenceRefs } from "../evidence/refs";

/** Serializable data for one biomarker card (crosses the server → client boundary). */
export interface BiomarkerCardData {
  key: string;
  code: string | null;
  name: string;
  valueText: string;
  unit: string | null;
  valueNumeric: number | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  status: RangeStatus;
  observedOn: string | null;
  source: Biomarker["source"];
  measures: string | null;
  group: string;
  history: { date: string; value: number; label: string }[];
  historyUnit: string | null;
  changeText: string | null;
  issues: string[];
  evidence: ReturnType<typeof evidenceRefs>;
}

const GROUP_OF: Partial<Record<SystemId, string>> = {
  blood: "Blood",
  liver: "Liver",
  kidneys: "Kidneys",
  cardiovascular: "Heart and lipids",
  thyroid: "Thyroid",
  metabolic: "Blood sugar",
};
export const GROUP_ORDER = ["Blood", "Liver", "Kidneys", "Heart and lipids", "Thyroid", "Blood sugar", "Vitamins and other"];

export function biomarkerCards(rows: Biomarker[]): BiomarkerCardData[] {
  const issues = validateBiomarkers(rows);
  return biomarkerHistories(rows).map((h) => {
    const latestRow = rows.find((r) => r.id === h.latest.biomarkerId)!;
    const def = getDefinition(h.code);
    const primary = def?.systems.find((s) => s.role === "primary")?.system;
    const group = (primary && GROUP_OF[primary]) ?? "Vitamins and other";
    const ids = new Set(h.points.map((p) => p.biomarkerId));
    const notes = h.code ? EVIDENCE_NOTES.filter((n) => n.biomarkers.includes(h.code!)).slice(0, 2).map((n) => n.id) : [];
    const plot = h.points.filter((p) => p.canonicalValue !== null && p.observedOn);
    const c = h.change;
    return {
      key: h.key,
      code: h.code,
      name: h.name,
      valueText: h.latest.valueText,
      unit: h.latest.unitAsReported,
      valueNumeric: latestRow.valueNumeric,
      refLow: latestRow.refLow,
      refHigh: latestRow.refHigh,
      refText: h.latest.refText,
      status: h.latest.rangeStatus,
      observedOn: h.latest.observedOn,
      source: latestRow.source,
      measures: def?.measures ?? null,
      group,
      history: plot.map((p) => ({ date: p.observedOn!, value: p.canonicalValue!, label: String(p.canonicalValue) })),
      historyUnit: plot[0]?.canonicalUnit ?? null,
      changeText: c
        ? `${c.direction === "up" ? "Up" : c.direction === "down" ? "Down" : "No change"} ${c.direction === "same" ? "" : `${Math.abs(c.absolute)} ${c.unit}`}${c.percent !== null && c.direction !== "same" ? ` (${Math.abs(c.percent)}%)` : ""} since ${c.from.observedOn}`.replace(/\s+/g, " ").trim()
        : h.changeUnavailableReason,
      issues: [...new Set(issues.filter((i) => ids.has(i.biomarkerId) && i.severity === "warning").map((i) => i.message))],
      evidence: evidenceRefs(notes),
    };
  });
}

const PRIMARY_AGG: Record<string, WearableMetric["aggregation"]> = {
  steps: "sum",
  active_energy: "sum",
  sleep_asleep: "sum",
  resting_heart_rate: "avg",
  hrv_sdnn: "avg",
};

/** Last `days` daily values per metric, one value per day (an import outranks the synthetic seed). */
export function wearableSeries(metrics: WearableMetric[], days = 14) {
  const perDay = new Map<string, WearableMetric>();
  for (const w of metrics) {
    if (PRIMARY_AGG[w.metricType] !== w.aggregation) continue;
    const key = `${w.metricType}|${w.day}`;
    const cur = perDay.get(key);
    const rank = (x: WearableMetric) => (x.sourceFormat === "synthetic_seed" ? 0 : 1);
    if (!cur || rank(w) > rank(cur)) perDay.set(key, w);
  }
  const out: Record<string, { day: string; value: number }[]> = {};
  for (const w of perDay.values()) (out[w.metricType] ??= []).push({ day: w.day, value: w.value });
  for (const k of Object.keys(out)) out[k] = out[k].sort((a, b) => a.day.localeCompare(b.day)).slice(-days);
  return out;
}
