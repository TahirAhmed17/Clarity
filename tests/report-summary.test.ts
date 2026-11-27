import { describe, expect, it } from "vitest";
import { summarizeReport, type ExtractedResult } from "@/lib/report-summary";

const r = (name: string, status: ExtractedResult["rangeStatus"]): ExtractedResult => ({
  id: name,
  nameAsReported: name,
  valueText: "1",
  valueNumeric: 1,
  unitAsReported: "u",
  refLow: 0,
  refHigh: 2,
  refText: "0 - 2",
  rangeStatus: status,
});

describe("report summary (results reveal)", () => {
  it("counts results by status and lists flagged ones, below-range first", () => {
    const s = summarizeReport([r("A", "within"), r("B", "above"), r("C", "below"), r("D", "no_range"), r("E", "not_numeric"), r("F", "within")]);
    expect(s).toMatchObject({ total: 6, within: 2, outside: 2, notCompared: 2 });
    expect(s.flagged.map((x) => x.nameAsReported)).toEqual(["C", "B"]);
  });

  it("handles an empty report", () => {
    expect(summarizeReport([])).toEqual({ total: 0, outside: 0, within: 0, notCompared: 0, flagged: [] });
  });
});
