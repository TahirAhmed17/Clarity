import type { NewBiomarker } from "@/lib/domain";
import { canonicalCode, normaliseName } from "../../biomarkers/aliases";
import { NUMBER_PATTERN, parseReference, parseValue, rangeStatus } from "../../biomarkers/range";
import type { PdfPageLines } from "./extract-lines";

export interface ParsedLabReport {
  collectedOn: string | null;
  biomarkers: NewBiomarker[];
  warnings: string[];
  /** Lines that mention a recognised biomarker but could not be parsed (for user review). */
  unparsedLines: string[];
}

const NUM = NUMBER_PATTERN;
const VALUE = String.raw`[<>≤≥]?=?\s?${NUM}`;
const REF = String.raw`(?:(?:[<>≤≥]=?|up to)\s*${NUM}|${NUM}\s*(?:-|–|to)\s*${NUM})`;
/** "Cells/cmm 4000 - 11000": unit and range printed in one text run. */
const UNIT_THEN_REF = new RegExp(String.raw`^(?<unit>[^\d<>≤≥\s][^\s]*(?:\s[^\d<>≤≥\s][^\s]*){0,2})\s+(?<ref>${REF})$`, "i");
/** Urine microscopy units: never map these rows to blood-test codes (e.g. "Uric Acid /HPF" crystals). */
const MICROSCOPY_UNIT = /^\/?\s*(hpf|lpf)\.?$/i;
const FLAG = /^(H|L|HH|LL|HIGH|LOW|\*|A|ABN)$/i;
const SPACE_ROW = new RegExp(
  String.raw`^(?<name>[A-Za-z][A-Za-z0-9 ()\/,.'+-]*?)\s+(?<value>${VALUE})\s+(?<unit>\S+)\s+(?<ref>${REF})(?:\s+(?<flag>H|L|HH|LL|HIGH|LOW|\*))?$`,
  "i",
);
const HEADER_WORDS = new Set(["test", "analyte", "investigation", "result", "units", "unit", "reference range", "flag"]);

interface RowParts {
  name: string;
  value: string;
  unit: string | null;
  ref: string | null;
  flag: string | null;
}

function splitRow(line: string): RowParts | null {
  const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
  if (cols.length >= 3) {
    const [name, value, ...rest] = cols;
    if (!/[A-Za-z]/.test(name) || !new RegExp(`^${VALUE}$`).test(value)) return null;
    let unit: string | null = null;
    let ref: string | null = null;
    let flag: string | null = null;
    for (const c of rest) {
      const combined = c.match(UNIT_THEN_REF);
      if (!ref && parseReference(c).understood) ref = c;
      else if (!flag && FLAG.test(c)) flag = c;
      else if (!unit && !ref && combined?.groups) {
        unit = combined.groups.unit;
        ref = combined.groups.ref;
      } else if (!ref && (/^[<>≤≥]=?\s*\d/.test(c) || /^\d[\d.,]*\s*(?:-|–|to)\s*\d/.test(c))) {
        ref = c; // range text with a label, e.g. "< 130 Optimal": kept, not interpreted (units like "10^9/L" don't match)
      }
      else if (!unit) unit = c;
    }
    return { name, value, unit, ref, flag };
  }
  const m = line.replace(/\t/g, " ").match(SPACE_ROW);
  if (m?.groups) {
    const g = m.groups;
    return { name: g.name.trim(), value: g.value, unit: g.unit, ref: g.ref, flag: g.flag ?? null };
  }
  return null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Parses only unambiguous dates: ISO, or forms with a month NAME ("25/Nov/2026", "25 November 2026", "Nov 25, 2026"). */
export function parseUnambiguousDate(text: string): { iso: string | null; ambiguous: string | null } {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100;
  if (iso && valid(+iso[1], +iso[2], +iso[3])) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, ambiguous: null };
  const dmy = text.match(/\b(\d{1,2})[\s/.-]+([A-Za-z]{3,9})[\s/.,-]+(\d{4})\b/);
  if (dmy) {
    const m = MONTHS[dmy[2].toLowerCase().slice(0, dmy[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (m && valid(+dmy[3], m, +dmy[1])) return { iso: `${dmy[3]}-${pad(m)}-${pad(+dmy[1])}`, ambiguous: null };
  }
  const mdy = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (mdy) {
    const m = MONTHS[mdy[1].toLowerCase().slice(0, 3)];
    if (m && valid(+mdy[3], m, +mdy[2])) return { iso: `${mdy[3]}-${pad(m)}-${pad(+mdy[2])}`, ambiguous: null };
  }
  const numeric = text.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
  return { iso: null, ambiguous: numeric ? numeric[1] : null };
}

const COLLECTED_LABEL = /(collected on|collection date|collection on|sample collected(?: on| date)?|sample date|date collected|specimen date|date of collection|collected)\s*[:\-]?\s*(.{0,40})/i;

function findCollectedOn(lines: string[], warnings: string[]): string | null {
  for (const line of lines) {
    const m = line.replace(/\t/g, " ").match(COLLECTED_LABEL);
    if (!m) continue;
    const { iso, ambiguous } = parseUnambiguousDate(m[2]);
    if (iso) return iso;
    if (ambiguous) {
      // d/m/y vs m/d/y is ambiguous — never guess.
      warnings.push(`Collection date "${ambiguous}" is in an ambiguous format — please confirm it.`);
      return null;
    }
  }
  warnings.push("No collection date found on the report — please add it so trends are dated correctly.");
  return null;
}

/** Deterministic, line-based lab report parser. Preserves original names, values, units and ranges. */
export function parseLabReport(pages: PdfPageLines[]): ParsedLabReport {
  const warnings: string[] = [];
  const unparsedLines: string[] = [];
  const biomarkers: NewBiomarker[] = [];
  const allLines = pages.flatMap((p) => p.lines);
  const collectedOn = findCollectedOn(allLines, warnings);
  const seen = new Map<string, number>();

  for (const page of pages) {
    for (const line of page.lines) {
      if (HEADER_WORDS.has(normaliseName(line.split("\t")[0] ?? ""))) continue;
      const row = splitRow(line);
      if (!row) {
        const firstCol = line.split("\t")[0] ?? "";
        if (canonicalCode(firstCol) && /\d/.test(line)) unparsedLines.push(line.replace(/\t/g, "  "));
        continue;
      }
      const code = row.unit && MICROSCOPY_UNIT.test(row.unit.trim()) ? null : canonicalCode(row.name);
      if (/^\d{1,3}(,\d{3})+/.test(row.value.trim())) warnings.push(`${row.name}: "${row.value}" was read as a whole number with a thousands separator — please check it against the report.`);
      const ref = parseReference(row.ref);
      const value = parseValue(row.value);
      const status = rangeStatus(value.numeric, ref.low, ref.high);

      const key = code ?? normaliseName(row.name);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (seen.get(key) === 2) warnings.push(`"${row.name}" appears more than once in this report — please check which value applies.`);

      if (row.ref && !ref.understood) warnings.push(`Reference range for "${row.name}" ("${row.ref}") was kept as text but not interpreted.`);
      if (!row.ref) warnings.push(`No reference range found for "${row.name}" — it won't be compared against a range.`);
      if (!row.unit) warnings.push(`No unit found for "${row.name}".`);
      const flag = row.flag?.toUpperCase() ?? null;
      if (flag && /^(H|HH|HIGH)$/.test(flag) && status === "within") {
        warnings.push(`"${row.name}" is flagged high on the report but sits within the printed range — please check.`);
      }
      if (flag && /^(L|LL|LOW)$/.test(flag) && status === "within") {
        warnings.push(`"${row.name}" is flagged low on the report but sits within the printed range — please check.`);
      }

      const confidence = (code ? 0.5 : 0.25) + (ref.understood ? 0.3 : 0) + (row.unit ? 0.15 : 0);
      biomarkers.push({
        documentId: null,
        code,
        nameAsReported: row.name,
        valueNumeric: value.numeric,
        valueText: row.value.replace(/\s+/g, ""),
        unitAsReported: row.unit,
        refLow: ref.low,
        refHigh: ref.high,
        refText: row.ref,
        flagAsReported: row.flag,
        observedOn: collectedOn,
        source: "extracted",
        confidence: Math.round(confidence * 100) / 100,
        pageNumber: page.pageNumber,
      });
    }
  }

  return { collectedOn, biomarkers, warnings, unparsedLines };
}
