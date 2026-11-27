import type { Biomarker, BiomarkerCorrectionInput } from "@/lib/domain";
import { parseReference, parseValue } from "./range";

/**
 * Builds the corrected fields for a biomarker. The first correction preserves the original
 * extracted values; later corrections keep that same original (so provenance is never lost).
 */
export function applyCorrection(current: Biomarker, input: BiomarkerCorrectionInput) {
  const value = parseValue(input.valueText);
  const ref = parseReference(input.refText);
  return {
    valueText: input.valueText.trim(),
    valueNumeric: value.numeric,
    unitAsReported: input.unitAsReported?.trim() || null,
    refText: input.refText?.trim() || null,
    refLow: ref.low,
    refHigh: ref.high,
    source: "user_provided" as const,
    correction: current.correction ?? {
      original: { valueText: current.valueText, unitAsReported: current.unitAsReported, refText: current.refText, source: current.source },
      correctedAt: new Date().toISOString(),
    },
  };
}
