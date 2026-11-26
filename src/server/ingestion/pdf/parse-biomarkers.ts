import type { NewBiomarker } from "@/lib/domain";
import { canonicalCode, normaliseName } from "../../biomarkers/aliases";
import { parseReference, parseValue, rangeStatus } from "../../biomarkers/range";
import type { PdfPageLines } from "./extract-lines";

export interface ParsedLabReport {
  collectedOn: string | null;
  biomarkers: NewBiomarker[];
  warnings: string[];
  /** Lines that mention a recognised biomarker but could not be parsed (for user review). */
  unparsedLines: string[];
}

const VALUE = String.raw`[<>≤≥]?=?\s?\d+(?:[.,]\d+)?`;
const REF = String.raw`(?:(?:[<>≤≥]=?|up to)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)`;
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
      if (!ref && parseReference(c).understood) ref = c;
      else if (!flag && FLAG.test(c)) flag = c;
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

function findCollectedOn(lines: string[], warnings: string[]): string | null {
  for (const line of lines) {
    const m = line.match(/(collected|collection date|sample date|date collected|specimen date)\s*[:\-]?\s*([0-9][0-9./-]{6,9})/i);
    if (!m) continue;
    const raw = m[2];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // d/m/y vs m/d/y is ambiguous — never guess.
    warnings.push(`Collection date "${raw}" is in an ambiguous format — please confirm it.`);
    return null;
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
      const code = canonicalCode(row.name);
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
