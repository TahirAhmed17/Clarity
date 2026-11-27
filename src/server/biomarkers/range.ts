import type { RangeStatus } from "@/lib/domain";

/**
 * Compares a value ONLY against the reference range supplied by the lab.
 * This is "outside the supplied range", not a diagnosis or a universal threshold.
 * No range → "no_range" (never treated as normal).
 */
export function rangeStatus(value: number | null, low: number | null, high: number | null): RangeStatus {
  if (value === null || Number.isNaN(value)) return "not_numeric";
  if (low === null && high === null) return "no_range";
  if (low !== null && value < low) return "below";
  if (high !== null && value > high) return "above";
  return "within";
}

export interface ParsedReference {
  low: number | null;
  high: number | null;
  /** True when the text could be interpreted. */
  understood: boolean;
}

/** A number as printed on a lab report: "5.2", "5,2" (decimal comma) or "11,860" (thousands). */
export const NUMBER_PATTERN = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)`;
const N = `(${NUMBER_PATTERN})`;

/**
 * Converts a printed number, distinguishing thousands separators from decimal commas:
 *   "11,860" / "1,234,567.5" → thousands (11860)      "5,2" / "12,25" → decimal comma (5.2)
 *   "1234,567" → ambiguous → NaN (caller keeps the text and warns rather than guessing)
 */
export function parsePrintedNumber(s: string): number {
  const t = s.trim();
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ""));
  if (/^\d+,\d{1,2}$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return Number.NaN;
}
const toNum = parsePrintedNumber;

/** Parses lab reference range text: "4.0 - 11.0", "< 3.0", "> 60", "<=5", "up to 40". */
export function parseReference(text: string | null | undefined): ParsedReference {
  if (!text) return { low: null, high: null, understood: false };
  const t = text.trim();
  let m = t.match(new RegExp(`^${N}\\s*(?:-|–|to)\\s*${N}$`, "i"));
  if (m) return { low: toNum(m[1]), high: toNum(m[2]), understood: true };
  m = t.match(new RegExp(`^(?:<|<=|≤|up to)\\s*${N}$`, "i"));
  if (m) return { low: null, high: toNum(m[1]), understood: true };
  m = t.match(new RegExp(`^(?:>|>=|≥)\\s*${N}$`, "i"));
  if (m) return { low: toNum(m[1]), high: null, understood: true };
  return { low: null, high: null, understood: false };
}

/** Parses a reported value. Qualified values like ">90" or "<5" keep valueNumeric null (not exact). */
export function parseValue(text: string): { numeric: number | null; qualified: boolean } {
  const t = text.trim();
  const exact = t.match(new RegExp(`^${N}$`));
  if (exact) {
    const n = toNum(exact[1]);
    return { numeric: Number.isNaN(n) ? null : n, qualified: false };
  }
  if (/^[<>≤≥]=?\s*\d/.test(t)) return { numeric: null, qualified: true };
  return { numeric: null, qualified: false };
}
