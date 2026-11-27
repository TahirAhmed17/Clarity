import type { RangeStatus } from "./domain";

/** Minimal fields the upload API returns for each extracted result. */
export interface ExtractedResult {
  id: string;
  nameAsReported: string;
  valueText: string;
  valueNumeric: number | null;
  unitAsReported: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  rangeStatus: RangeStatus;
}

export interface ReportSummary {
  total: number;
  outside: number;
  within: number;
  notCompared: number;
  /** Results outside the lab's printed range, below-range first, then above. */
  flagged: ExtractedResult[];
}

/** Summarises a just-read report for the "report read" reveal. Pure, so it's unit-tested. */
export function summarizeReport(results: ExtractedResult[]): ReportSummary {
  const flagged = results.filter((r) => r.rangeStatus === "above" || r.rangeStatus === "below");
  const within = results.filter((r) => r.rangeStatus === "within").length;
  return {
    total: results.length,
    outside: flagged.length,
    within,
    notCompared: results.length - flagged.length - within,
    flagged: [...flagged].sort((a, b) => (a.rangeStatus === b.rangeStatus ? 0 : a.rangeStatus === "below" ? -1 : 1)),
  };
}
