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
/** White cell and differential counts: cells per microlitre ("cells/cmm") ÷ 1000 = 10^9/L. */
const CELL_COUNT_UNITS: Record<string, Convert> = { "10^9/l": id, "k/ul": id, "10^3/ul": id, "cells/cmm": times(0.001), "cell/cmm": times(0.001), "cells/cumm": times(0.001), "/cmm": times(0.001), "cells/ul": times(0.001), "/ul": times(0.001) };

export const BIOMARKER_DEFINITIONS: BiomarkerDefinition[] = [
  { code: "HGB", name: "Haemoglobin", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 30, max: 250 }, systems: [{ system: "blood", role: "primary" }], measures: "The oxygen-carrying protein in red blood cells." },
  { code: "WBC", name: "White cell count", canonicalUnit: "10^9/L", units: CELL_COUNT_UNITS, plausible: { min: 0.1, max: 500 }, systems: [{ system: "blood", role: "primary" }], measures: "The number of infection-fighting white blood cells." },
  { code: "PLT", name: "Platelets", canonicalUnit: "10^9/L", units: { ...CELL_COUNT_UNITS, "lakhs/cmm": times(100), "lakh/cmm": times(100) }, plausible: { min: 1, max: 3000 }, systems: [{ system: "blood", role: "primary" }], measures: "Cell fragments that help blood clot." },
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
  // ---- Full blood count detail ----
  { code: "RBC", name: "Red cell count", canonicalUnit: "10^12/L", units: { "10^12/l": id, "millions/cmm": id, "million/cmm": id, "millions/ul": id, "10^6/ul": id, "m/ul": id }, plausible: { min: 0.5, max: 10 }, systems: [{ system: "blood", role: "primary" }], measures: "The number of oxygen-carrying red blood cells." },
  { code: "HCT", name: "Haematocrit (PCV)", canonicalUnit: "%", units: { "%": id, "l/l": times(100) }, plausible: { min: 10, max: 75 }, systems: [{ system: "blood", role: "supporting" }], measures: "The share of blood volume made up of red cells." },
  { code: "MCV", name: "Mean cell volume", canonicalUnit: "fL", units: { fl: id }, plausible: { min: 50, max: 150 }, systems: [{ system: "blood", role: "supporting" }], measures: "The average size of red blood cells." },
  { code: "MCH", name: "Mean cell haemoglobin", canonicalUnit: "pg", units: { pg: id }, plausible: { min: 10, max: 50 }, systems: [{ system: "blood", role: "supporting" }], measures: "The average amount of haemoglobin in each red cell." },
  { code: "MCHC", name: "Mean cell haemoglobin concentration", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 200, max: 420 }, systems: [{ system: "blood", role: "supporting" }], measures: "How concentrated the haemoglobin is inside red cells." },
  { code: "RDW", name: "Red cell distribution width", canonicalUnit: "%", units: { "%": id }, plausible: { min: 8, max: 35 }, systems: [{ system: "blood", role: "supporting" }], measures: "How much red cell sizes vary." },
  ...(["NEUT_PCT:Neutrophils", "LYMPH_PCT:Lymphocytes", "MONO_PCT:Monocytes", "EOS_PCT:Eosinophils", "BASO_PCT:Basophils"].map((x) => {
    const [code, name] = x.split(":");
    return { code, name: `${name} (%)`, canonicalUnit: "%", units: { "%": id }, plausible: { min: 0, max: 100 }, systems: [{ system: "blood" as const, role: "supporting" as const }], measures: `The share of white blood cells that are ${name.toLowerCase()}.` };
  })),
  ...(["ANC:Neutrophils", "ALC:Lymphocytes", "AMC:Monocytes", "AEC:Eosinophils", "ABC:Basophils"].map((x) => {
    const [code, name] = x.split(":");
    return { code, name: `${name} (absolute)`, canonicalUnit: "10^9/L", units: CELL_COUNT_UNITS, plausible: { min: 0, max: 200 }, systems: [{ system: "blood" as const, role: "supporting" as const }], measures: `The number of ${name.toLowerCase()} in the blood.` };
  })),
  { code: "MPV", name: "Mean platelet volume", canonicalUnit: "fL", units: { fl: id }, plausible: { min: 3, max: 20 }, systems: [{ system: "blood", role: "supporting" }], measures: "The average size of platelets." },
  { code: "ESR", name: "ESR", canonicalUnit: "mm/hr", units: { "mm/hr": id, "mmafter1hr": id, "mm/1hr": id, "mm/h": id, "mm/1sthour": id }, plausible: { min: 0, max: 150 }, systems: [{ system: "blood", role: "supporting" }], measures: "How quickly red cells settle — a non-specific sign of inflammation." },
  // ---- Chemistry ----
  { code: "CALCIUM", name: "Calcium", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": times(0.2495) }, plausible: { min: 0.5, max: 5 }, systems: [], measures: "Calcium in the blood, important for bones, nerves and muscles." },
  { code: "FT3", name: "Free T3", canonicalUnit: "pmol/L", units: { "pmol/l": id, "pg/ml": times(1.536) }, plausible: { min: 0.5, max: 50 }, systems: [{ system: "thyroid", role: "supporting" }], measures: "The active thyroid hormone (unbound form)." },
  { code: "URIC_ACID", name: "Uric acid", canonicalUnit: "umol/L", units: { "umol/l": id, "mg/dl": times(59.48) }, plausible: { min: 20, max: 2000 }, systems: [{ system: "kidneys", role: "supporting" }, { system: "metabolic", role: "supporting" }], measures: "A waste product from the breakdown of purines, cleared by the kidneys." },
  { code: "BILI_DIRECT", name: "Bilirubin (direct)", canonicalUnit: "umol/L", units: { "umol/l": id, "mg/dl": times(17.1) }, plausible: { min: 0, max: 800 }, systems: [{ system: "liver", role: "supporting" }], measures: "Bilirubin already processed by the liver." },
  { code: "BILI_INDIRECT", name: "Bilirubin (indirect)", canonicalUnit: "umol/L", units: { "umol/l": id, "mg/dl": times(17.1) }, plausible: { min: 0, max: 800 }, systems: [{ system: "liver", role: "supporting" }], measures: "Bilirubin not yet processed by the liver." },
  { code: "PROTEIN_TOTAL", name: "Total protein", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 20, max: 150 }, systems: [{ system: "liver", role: "supporting" }], measures: "All protein in the blood, mostly albumin and globulins." },
  { code: "GLOBULIN", name: "Globulin", canonicalUnit: "g/L", units: { "g/l": id, "g/dl": times(10) }, plausible: { min: 5, max: 100 }, systems: [{ system: "liver", role: "supporting" }], measures: "A group of blood proteins including antibodies." },
  { code: "AG_RATIO", name: "Albumin/globulin ratio", canonicalUnit: "ratio", units: { ratio: id }, plausible: { min: 0.1, max: 5 }, systems: [{ system: "liver", role: "supporting" }], measures: "Albumin compared with globulin." },
  { code: "GLUCOSE_PP", name: "Post-meal glucose", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 18.016 }, plausible: { min: 0.5, max: 100 }, systems: [{ system: "metabolic", role: "supporting" }], measures: "Blood sugar measured after a meal." },
  { code: "EAG", name: "Estimated average glucose", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 18.016 }, plausible: { min: 0.5, max: 100 }, systems: [{ system: "metabolic", role: "supporting" }], measures: "Average blood sugar calculated from HbA1c (a calculation, not a separate test)." },
  { code: "AMYLASE", name: "Amylase", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 10000 }, systems: [], measures: "A digestive enzyme mainly from the pancreas and salivary glands." },
  { code: "LIPASE", name: "Lipase", canonicalUnit: "U/L", units: { "u/l": id, "iu/l": id }, plausible: { min: 1, max: 10000 }, systems: [], measures: "A digestive enzyme made by the pancreas." },
  { code: "VLDL", name: "VLDL cholesterol", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 38.67 }, plausible: { min: 0.01, max: 20 }, systems: [{ system: "cardiovascular", role: "supporting" }], measures: "Cholesterol carried by very-low-density lipoprotein (often calculated)." },
  { code: "NON_HDL", name: "Non-HDL cholesterol", canonicalUnit: "mmol/L", units: { ...MMOL_L, "mg/dl": (v) => v / 38.67 }, plausible: { min: 0.1, max: 30 }, systems: [{ system: "cardiovascular", role: "supporting" }], measures: "Total cholesterol minus HDL (a calculation)." },
  { code: "CHOL_HDL_RATIO", name: "Cholesterol/HDL ratio", canonicalUnit: "ratio", units: { ratio: id }, plausible: { min: 0.5, max: 30 }, systems: [{ system: "cardiovascular", role: "supporting" }], measures: "Total cholesterol divided by HDL (a calculation)." },
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
