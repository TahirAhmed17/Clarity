/**
 * Maps common reported biomarker names to canonical codes.
 * Unrecognised names are kept exactly as reported with code = null — never guessed.
 * Extended with biomarker_definitions in M2.4.
 */
const ALIASES: Record<string, string[]> = {
  HGB: ["haemoglobin", "hemoglobin", "hb", "hgb"],
  WBC: ["white cell count", "white blood cells", "white blood cell count", "wbc", "leucocytes", "leukocytes"],
  PLT: ["platelets", "platelet count", "plt"],
  FERRITIN: ["ferritin", "serum ferritin"],
  B12: ["vitamin b12", "b12", "cobalamin", "serum b12"],
  ALT: ["alt", "alanine aminotransferase", "alanine transaminase", "sgpt"],
  AST: ["ast", "aspartate aminotransferase", "aspartate transaminase", "sgot"],
  GGT: ["ggt", "gamma gt", "gamma-glutamyl transferase", "gamma glutamyltransferase"],
  CREATININE: ["creatinine", "serum creatinine"],
  EGFR: ["egfr", "estimated gfr", "estimated glomerular filtration rate"],
  UREA: ["urea", "blood urea", "bun", "blood urea nitrogen"],
  TSH: ["tsh", "thyroid stimulating hormone", "thyrotropin"],
  FT4: ["free t4", "ft4", "free thyroxine"],
  GLUCOSE_FASTING: ["fasting glucose", "glucose (fasting)", "fasting plasma glucose", "glucose fasting"],
  HBA1C: ["hba1c", "haemoglobin a1c", "hemoglobin a1c", "glycated haemoglobin", "glycated hemoglobin"],
  CHOL_TOTAL: ["total cholesterol", "cholesterol", "cholesterol total", "serum cholesterol"],
  LDL: ["ldl cholesterol", "ldl", "ldl-c", "ldl cholesterol (calculated)"],
  HDL: ["hdl cholesterol", "hdl", "hdl-c"],
  TRIG: ["triglycerides", "triglyceride", "trig"],
  VITD25OH: ["vitamin d (25-oh)", "vitamin d", "25-oh vitamin d", "25-hydroxyvitamin d", "25(oh)d", "vitamin d 25-oh"],
  HSCRP: ["hs-crp", "hscrp", "high sensitivity crp", "high-sensitivity c-reactive protein"],
  CRP: ["crp", "c-reactive protein"],
};

const LOOKUP = new Map<string, string>();
for (const [code, names] of Object.entries(ALIASES)) for (const n of names) LOOKUP.set(n, code);

export function normaliseName(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function canonicalCode(reportedName: string): string | null {
  return LOOKUP.get(normaliseName(reportedName)) ?? null;
}
