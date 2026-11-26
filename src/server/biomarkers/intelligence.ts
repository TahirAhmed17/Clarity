import type { Biomarker, RangeStatus } from "@/lib/domain";
import { getDefinition, normaliseUnit, toCanonical } from "./definitions";
import { rangeStatus } from "./range";

/**
 * Deterministic biomarker validation + history (M2.4). Everything here is rule-based:
 * the AI later explains these findings but never computes them.
 */

export type IssueCode =
  | "unrecognised_name"
  | "missing_unit"
  | "unknown_unit"
  | "ambiguous_unit"
  | "implausible_value"
  | "missing_range"
  | "range_not_interpreted"
  | "missing_date"
  | "qualified_value"
  | "flag_range_mismatch"
  | "conflicting_same_day";

export interface ValidationIssue {
  biomarkerId: string;
  code: IssueCode;
  severity: "info" | "warning";
  message: string;
}

export function validateBiomarkers(rows: Biomarker[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (b: Biomarker, code: IssueCode, severity: ValidationIssue["severity"], message: string) =>
    issues.push({ biomarkerId: b.id, code, severity, message });

  for (const b of rows) {
    const def = getDefinition(b.code);
    if (!def) push(b, "unrecognised_name", "info", `"${b.nameAsReported}" isn't in Clarity's biomarker library yet, so it's kept as reported but not interpreted.`);
    if (!b.unitAsReported) push(b, "missing_unit", "warning", `No unit was recorded for ${b.nameAsReported}, so it can't be compared over time.`);
    else if (def && b.valueNumeric !== null) {
      const c = toCanonical(b.code, b.valueNumeric, b.unitAsReported);
      if (!c.ok && c.reason === "unknown_unit") push(b, "unknown_unit", "warning", `The unit "${b.unitAsReported}" for ${b.nameAsReported} isn't one Clarity can convert safely.`);
      if (!c.ok && c.reason === "ambiguous_unit") push(b, "ambiguous_unit", "warning", `${b.nameAsReported}: ${c.detail}`);
      if (c.ok && (c.value < def.plausible.min || c.value > def.plausible.max)) {
        push(b, "implausible_value", "warning", `${b.nameAsReported} ${b.valueText} ${b.unitAsReported} looks implausible — possibly a unit or entry error. Please check it against the report.`);
      }
    }
    if (b.valueNumeric === null && /^[<>≤≥]/.test(b.valueText)) {
      push(b, "qualified_value", "info", `${b.nameAsReported} was reported as "${b.valueText}" (a bound, not an exact number), so it isn't plotted as a trend point.`);
    }
    if (!b.refText) push(b, "missing_range", "info", `No reference range was printed for ${b.nameAsReported}; it isn't compared against a range (that doesn't mean it's normal).`);
    else if (b.refLow === null && b.refHigh === null) push(b, "range_not_interpreted", "info", `The range "${b.refText}" for ${b.nameAsReported} was kept as text but couldn't be interpreted.`);
    if (!b.observedOn) push(b, "missing_date", "warning", `${b.nameAsReported} has no collection date, so it can't be placed on your timeline accurately.`);
    const st = rangeStatus(b.valueNumeric, b.refLow, b.refHigh);
    const flag = b.flagAsReported?.toUpperCase();
    if (flag && /^(H|HH|HIGH)$/.test(flag) && st === "within") push(b, "flag_range_mismatch", "warning", `${b.nameAsReported} is flagged high on the report but is within the printed range.`);
    if (flag && /^(L|LL|LOW)$/.test(flag) && st === "within") push(b, "flag_range_mismatch", "warning", `${b.nameAsReported} is flagged low on the report but is within the printed range.`);
  }

  // Same marker, same day, different values (e.g. two uploads disagree).
  const byKey = new Map<string, Biomarker[]>();
  for (const b of rows) {
    if (!b.observedOn) continue;
    const key = `${b.code ?? b.nameAsReported.toLowerCase()}|${b.observedOn}`;
    byKey.set(key, [...(byKey.get(key) ?? []), b]);
  }
  for (const list of byKey.values()) {
    const distinct = new Set(list.map((b) => `${b.valueText}|${normaliseUnit(b.unitAsReported)}`));
    if (distinct.size > 1) {
      for (const b of list) push(b, "conflicting_same_day", "warning", `There are ${distinct.size} different values for ${b.nameAsReported} on ${b.observedOn}. Please check which is correct.`);
    }
  }
  return issues;
}

export interface HistoryPoint {
  biomarkerId: string;
  observedOn: string | null;
  valueText: string;
  unitAsReported: string | null;
  /** Value in the canonical unit, null when it can't be converted safely. */
  canonicalValue: number | null;
  canonicalUnit: string | null;
  convertedFromOtherUnit: boolean;
  refText: string | null;
  rangeStatus: RangeStatus;
  documentId: string | null;
  source: Biomarker["source"];
}

export interface BiomarkerHistory {
  key: string;
  code: string | null;
  name: string;
  points: HistoryPoint[];
  latest: HistoryPoint;
  change: {
    from: HistoryPoint;
    to: HistoryPoint;
    absolute: number;
    percent: number | null;
    direction: "up" | "down" | "same";
    unit: string;
  } | null;
  /** Why no change was computed, when there are ≥2 points. */
  changeUnavailableReason: string | null;
}

export function biomarkerHistories(rows: Biomarker[]): BiomarkerHistory[] {
  const groups = new Map<string, Biomarker[]>();
  for (const b of rows) {
    const key = b.code ?? `name:${b.nameAsReported.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const out: BiomarkerHistory[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.observedOn ?? "").localeCompare(b.observedOn ?? ""));
    const points: HistoryPoint[] = list.map((b) => {
      const c = b.valueNumeric !== null ? toCanonical(b.code, b.valueNumeric, b.unitAsReported) : null;
      return {
        biomarkerId: b.id,
        observedOn: b.observedOn,
        valueText: b.valueText,
        unitAsReported: b.unitAsReported,
        canonicalValue: c?.ok ? c.value : null,
        canonicalUnit: c?.ok ? c.unit : null,
        convertedFromOtherUnit: c?.ok ? c.converted : false,
        refText: b.refText,
        rangeStatus: rangeStatus(b.valueNumeric, b.refLow, b.refHigh),
        documentId: b.documentId,
        source: b.source,
      };
    });
    const latest = points[points.length - 1];
    let change: BiomarkerHistory["change"] = null;
    let reason: string | null = null;
    if (points.length >= 2) {
      const prev = points[points.length - 2];
      if (prev.canonicalValue !== null && latest.canonicalValue !== null && prev.canonicalUnit === latest.canonicalUnit) {
        const absolute = Math.round((latest.canonicalValue - prev.canonicalValue) * 1000) / 1000;
        change = {
          from: prev,
          to: latest,
          absolute,
          percent: prev.canonicalValue !== 0 ? Math.round((absolute / prev.canonicalValue) * 1000) / 10 : null,
          direction: absolute > 0 ? "up" : absolute < 0 ? "down" : "same",
          unit: latest.canonicalUnit!,
        };
      } else {
        reason = "These results can't be compared safely (different or unconvertible units, or a value reported as a bound).";
      }
    }
    out.push({ key, code: list[0].code, name: latest ? list[list.length - 1].nameAsReported : key, points, latest, change, changeUnavailableReason: reason });
  }
  return out;
}
