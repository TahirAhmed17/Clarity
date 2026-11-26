import type { Biomarker, Profile, SymptomEntry, WearableMetric } from "@/lib/domain";
import { rangeStatus } from "../biomarkers/range";
import type { HealthContext } from "./schemas";

/**
 * Builds the structured context every engine receives.
 * Sends only what's needed for reasoning — no names, ids, filenames or free-form identifiers.
 */
export function buildHealthContext(input: {
  profile: Profile;
  biomarkers: Biomarker[];
  wearables: WearableMetric[];
  symptoms: SymptomEntry[];
}): HealthContext {
  // Latest + previous value per biomarker (keyed by code, or reported name when unrecognised).
  const groups = new Map<string, Biomarker[]>();
  for (const b of input.biomarkers) {
    const key = b.code ?? `name:${b.nameAsReported.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const biomarkers: HealthContext["biomarkers"] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (a.observedOn ?? "").localeCompare(b.observedOn ?? ""));
    const latest = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    biomarkers.push({
      code: latest.code,
      name: latest.nameAsReported,
      valueText: latest.valueText,
      unit: latest.unitAsReported,
      refText: latest.refText,
      rangeStatus: rangeStatus(latest.valueNumeric, latest.refLow, latest.refHigh),
      observedOn: latest.observedOn,
      // Only compare like with like: a previous value in a different unit is not a trend.
      previous: prev && prev.unitAsReported === latest.unitAsReported ? { valueText: prev.valueText, observedOn: prev.observedOn } : null,
    });
  }

  // 7-day averages of the primary daily aggregate per metric.
  const primaryAgg: Record<string, WearableMetric["aggregation"]> = {
    steps: "sum",
    active_energy: "sum",
    sleep_asleep: "sum",
    resting_heart_rate: "avg",
    heart_rate: "avg",
    hrv_sdnn: "avg",
  };
  // One value per metric per day: when several sources cover the same day, a user import
  // beats the synthetic seed, and otherwise the larger sample count wins. Never average across sources.
  const sourceRank = (w: WearableMetric) => (w.sourceFormat === "synthetic_seed" ? 0 : 1);
  const perDay = new Map<string, WearableMetric>();
  for (const w of input.wearables) {
    if (primaryAgg[w.metricType] !== w.aggregation) continue;
    const key = `${w.metricType}|${w.day}`;
    const cur = perDay.get(key);
    if (!cur || sourceRank(w) > sourceRank(cur) || (sourceRank(w) === sourceRank(cur) && w.sampleCount > cur.sampleCount)) perDay.set(key, w);
  }
  const byMetric = new Map<string, WearableMetric[]>();
  for (const w of perDay.values()) byMetric.set(w.metricType, [...(byMetric.get(w.metricType) ?? []), w]);
  const wearables: HealthContext["wearables"] = [];
  for (const [metric, list] of byMetric) {
    list.sort((a, b) => a.day.localeCompare(b.day));
    const last7 = list.slice(-7);
    wearables.push({
      metric,
      unit: list[0].unit,
      avg7d: last7.length ? Math.round((last7.reduce((n, w) => n + w.value, 0) / last7.length) * 10) / 10 : null,
      days: last7.length,
    });
  }

  const missing: string[] = [];
  if (biomarkers.length === 0) missing.push("No lab results have been added yet.");
  if (wearables.length === 0) missing.push("No wearable data has been added yet.");
  if (input.profile.goals.length === 0) missing.push("No goals have been shared yet.");
  const noRange = biomarkers.filter((b) => b.rangeStatus === "no_range").map((b) => b.name);
  if (noRange.length) missing.push(`No reference range was available for: ${noRange.join(", ")}.`);

  return {
    profile: { goals: input.profile.goals, routine: input.profile.routine },
    symptoms: input.symptoms.filter((s) => !s.resolvedOn).map((s) => ({ description: s.description, severity: s.severity })),
    biomarkers,
    wearables,
    evidence: [],
    missing,
  };
}
