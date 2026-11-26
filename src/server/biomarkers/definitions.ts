import type { SystemId } from "@/data/evidence/catalogue";

/**
 * Biomarker reference definitions (M2.4) — versioned reference data kept in code so every change
 * is reviewed. Unit conversions are standard SI ↔ conventional factors and are used ONLY to compare
 * a person's own results over time; they never create thresholds. Plausibility bounds are deliberately
 * wide sanity limits for catching unit or data-entry errors — they are NOT clinical reference values.
 */

type Convert = (v: number) => number;

export interface BiomarkerDefinition {
  code: string;
  name: string;
  canonicalUnit: string;
  /** Normalised unit → conversion into the canonical unit. */
  units: Record<string, Convert>;
  /** Units that are known but cannot be converted safely without more context. */
  ambiguousUnits?: Record<string, string>;
  plausible: { min: number; max: number };
  systems: { system: SystemId; role: "primary" | "supporting" }[];
  /** Short, plain-English description of what is measured (no interpretation thresholds). */
  measures: string;
}

const id: Convert = (v) => v;
const times = (f: number): Convert => (v) => v * f;

export function normaliseUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  return unit
    .trim()
    .toLowerCase()
    .replace(/µ|μ/g, "u")
    .replace(/mcg/g, "ug")
    .replace(/\s+/g, "")
    .replace(/^x10/, "10")
    .replace(/10\*(\d)/, "10^$1")
    .replace(/1\.73m\^?2$/, "1.73m2");
}

const MMOL_L = { "mmol/l": id };

export const BIOMARKER_DEFINITIONS: BiomarkerDefinition[] = [
  { code: "HGB", name: "Haemoglobin", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 30, max: 250 }, systems: [{ system: "blood", role: "primary" }], measures: "The oxygen-carrying protein in red blood cells." },
  { code: "WBC", name: "White cell count", canonicalUnit: "10^9/L", units: { "10^9/l": id, "k/ul": id, "10^3/ul": id }, plausible: { min: 0.1, max: 500 }, systems: [{ system: "blood", role: "primary" }], measures: "The number of infection-fighting white blood cells." },
  { code: "PLT", name: "Platelets", canonicalUnit: "10^9/L", units: { "10^9/l": id, "k/ul": id, "10^3/ul": id }, plausible: { min: 1, max: 3000 }, systems: [{ system: "blood", role: "primary" }], measures: "Cell fragments that help blood clot." },
  { code: "FERRITIN", name: "Ferritin", canonicalUnit: "ug/L", units: { "ug/l": id, "ng/ml": id }, plausible: { min: 0.5, max: 100000 }, systems: [{ system: "blood", role: "supporting" }, { system: "liver", role: "supporting" }], measures: "A protein that stores iron; reflects iron reserves." },
  { code: "B12", name: "Vitamin B12", canonicalUnit: "ng/L", units: { "ng/l": id, "pg/ml": id, "pmol/l": times(1.355) }, plausible: { min: 20, max: 10000 }, systems: [{ system: "blood", role: "supporting" }], measures: "A vitamin needed for red blood cells and nerves." },
  { code: "ALT", name: "ALT", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 20000 }, systems: [{ system: "liver", role: "primary" }, { system: "metabolic", role: "supporting" }], measures: "A liver enzyme released when liver cells are under strain." },
  { code: "AST", name: "AST", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 20000 }, systems: [{ system: "liver", role: "primary" }], measures: "An enzyme found in the liver and muscles." },
  { code: "GGT", name: "GGT", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 5000 }, systems: [{ system: "liver", role: "primary" }], measures: "A liver and bile-duct enzyme." },
  { code: "ALP", name: "Alkaline phosphatase", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 5000 }, systems: [{ system: "liver", role: "primary" }], measures: "An enzyme from the liver, bile ducts and bone." },
  { code: "BILIRUBIN", name: "Bilirubin", canonicalUnit: "umol/L", units: { "umol/l": id, "mg/dl": times(17.1) }, plausible: { min: 0.5, max: 1000 }, systems: [{ system: "liver", role: "primary" }], measures: "A breakdown product of red cells processed by the liver." },
  { code: "ALBUMIN", name: "Albumin", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 5, max: 80 }, systems: [{ system: "liver", role: "supporting" }, { system: "kidneys", role: "supporting" }], measures: "The main blood protein, made by the liver." },
  { code: "CREATININE", name: "Creatinine", canonicalUnit: "umol/L", units: { "umol/l": id, "mg/dl": times(88.4) }, plausible: { min: 5, max: 3000 }, systems: [{ system: "kidneys", role: "primary" }], measures: "A muscle waste product filtered by the kidneys." },
  { code: "EGFR", name: "eGFR", canonicalUnit: "mL/min/1.73m2", units: { "ml/min/1.73m2": id, "ml/min": id }, plausible: { min: 1, max: 200 }, systems: [{ system: "kidneys", role: "primary" }], measures: "An estimate of how well the kidneys filter blood." },
  {
    code: "UREA",
    name: "Urea",
    canonicalUnit: "mmol/L",
    units: MMOL_L,
    ambiguousUnits: { "mg/dl": "mg/dL could mean urea or blood urea nitrogen (BUN), which convert differently — not converted." },
    plausible: { min: 0.5, max: 100 },
    systems: [{ system: "kidneys", role: "supporting" }],
    measures: "A waste product from protein breakdown, cleared by the kidneys.",
  },
  { code: "TSH", name: "TSH", canonicalUnit: "mIU/L", units: { "miu/l": id, "uiu/ml": id, "mu/l": id }, plausible: { min: 0.001, max: 1000 }, systems: [{ system: "thyroid", role: "primary" }], measures: "The pituitary hormone that regulates the thyroid." },
  { code: "FT4", name: "Free T4", canonicalUnit: "pmol/L", units: { "pmol/l": id, "ng/dl": times(12.87) }, plausible: { min: 0.5, max: 200 }, systems: [{ system: "thyroid", role: "primary" }], measures: "The main hormone made by the thyroid (unbound form)." },
  { code: "GLUCOSE_FASTING", name: "Fasting glucose", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 18.016 }, plausible: { min: 0.5, max: 100 }, systems: [{ system: "metabolic", role: "primary" }], measures: "Blood sugar after not eating." },
  { code: "HBA1C", name: "HbA1c", canonicalUnit: "mmol/mol", units: { "mmol/mol": id, "%": (v) => (v - 2.15) * 10.929 }, plausible: { min: 10, max: 200 }, systems: [{ system: "metabolic", role: "primary" }, { system: "cardiovascular", role: "supporting" }], measures: "Average blood sugar over roughly the last 2–3 months." },
  { code: "CHOL_TOTAL", name: "Total cholesterol", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 38.67 }, plausible: { min: 0.5, max: 40 }, systems: [{ system: "cardiovascular", role: "primary" }], measures: "All cholesterol carried in the blood." },
  { code: "LDL", name: "LDL cholesterol", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 38.67 }, plausible: { min: 0.1, max: 30 }, systems: [{ system: "cardiovascular", role: "primary" }], measures: "Cholesterol carried by low-density lipoprotein." },
  { code: "HDL", name: "HDL cholesterol", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 38.67 }, plausible: { min: 0.05, max: 10 }, systems: [{ system: "cardiovascular", role: "primary" }], measures: "Cholesterol carried by high-density lipoprotein." },
  { code: "TRIG", name: "Triglycerides", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 88.57 }, plausible: { min: 0.1, max: 100 }, systems: [{ system: "cardiovascular", role: "primary" }, { system: "metabolic", role: "supporting" }], measures: "A type of fat in the blood." },
  { code: "VITD25OH", name: "Vitamin D (25-OH)", canonicalUnit: "nmol/L", units: { "nmol/l": id, "ng/ml": times(2.496) }, plausible: { min: 1, max: 1000 }, systems: [], measures: "The main circulating form of vitamin D." },
  { code: "HSCRP", name: "hs-CRP", canonicalUnit: "mg/L", units: { "mg/l": id, "mg/dl": times(10) }, plausible: { min: 0, max: 500 }, systems: [{ system: "cardiovascular", role: "supporting" }], measures: "A sensitive marker of inflammation." },
  { code: "CRP", name: "CRP", canonicalUnit: "mg/L", units: { "mg/l": id, "mg/dl": times(10) }, plausible: { min: 0, max: 500 }, systems: [], measures: "A marker of inflammation." },
  { code: "UACR", name: "Urine albumin:creatinine ratio", canonicalUnit: "mg/mmol", units: { "mg/mmol": id, "mg/g": (v) => v / 8.84 }, plausible: { min: 0, max: 3000 }, systems: [{ system: "kidneys", role: "primary" }], measures: "Protein (albumin) leaking into urine." },
];

const BY_CODE = new Map(BIOMARKER_DEFINITIONS.map((d) => [d.code, d]));

export function getDefinition(code: string | null | undefined) {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

export type ConversionResult =
  | { ok: true; value: number; unit: string; converted: boolean }
  | { ok: false; reason: "no_definition" | "missing_unit" | "unknown_unit" | "ambiguous_unit"; detail?: string };

/** Converts a value into the canonical unit for its biomarker, refusing anything uncertain. */
export function toCanonical(code: string | null, value: number, unit: string | null): ConversionResult {
  const def = getDefinition(code);
  if (!def) return { ok: false, reason: "no_definition" };
  const u = normaliseUnit(unit);
  if (!u) return { ok: false, reason: "missing_unit" };
  if (def.ambiguousUnits?.[u]) return { ok: false, reason: "ambiguous_unit", detail: def.ambiguousUnits[u] };
  const fn = def.units[u];
  if (!fn) return { ok: false, reason: "unknown_unit" };
  const v = fn(value);
  return { ok: true, value: Math.round(v * 1000) / 1000, unit: def.canonicalUnit, converted: normaliseUnit(def.canonicalUnit) !== u };
}
