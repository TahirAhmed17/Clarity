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
  ALP: ["alp", "alkaline phosphatase", "alk phos"],
  BILIRUBIN: ["bilirubin", "total bilirubin", "bilirubin (total)"],
  ALBUMIN: ["albumin", "serum albumin"],
  UACR: ["urine albumin:creatinine ratio", "albumin creatinine ratio", "acr", "uacr", "urine acr"],
  // Common report layouts (incl. Indian / UK labs).
  RBC: ["rbc count", "red blood cell count", "rbc", "total rbc count", "red cell count"],
  HCT: ["pcv (haematocrit)", "pcv (hematocrit)", "pcv", "haematocrit", "hematocrit", "hct", "packed cell volume"],
  MCV: ["mean corpuscular volume", "mcv", "mean cell volume"],
  MCH: ["mean corpuscular hemoglobin", "mean corpuscular haemoglobin", "mch", "mean cell haemoglobin"],
  MCHC: ["mean corpuscular hb concentration", "mean corpuscular hemoglobin concentration", "mean corpuscular haemoglobin concentration", "mchc"],
  RDW: ["red cell distribution width (rdw)", "red cell distribution width", "rdw", "rdw-cv"],
  NEUT_PCT: ["neutrophils", "neutrophil %", "neutrophils %"],
  LYMPH_PCT: ["lymphocytes", "lymphocyte %", "lymphocytes %"],
  MONO_PCT: ["monocytes", "monocyte %", "monocytes %"],
  EOS_PCT: ["eosinophils", "eosinophil %", "eosinophils %"],
  BASO_PCT: ["basophils", "basophil %", "basophils %"],
  ANC: ["absolute neutrophil count", "neutrophils absolute"],
  ALC: ["absolute lymphocyte count", "lymphocytes absolute"],
  AMC: ["absolute monocyte count", "monocytes absolute"],
  AEC: ["absolute eosinophil count", "eosinophils absolute"],
  ABC: ["absolute basophil count", "basophils absolute"],
  MPV: ["mean platelet volume (mpv)", "mean platelet volume", "mpv"],
  ESR: ["esr", "erythrocyte sedimentation rate"],
  CALCIUM: ["calcium", "serum calcium", "total calcium", "calcium (total)"],
  FT3: ["free t3", "ft3", "free triiodothyronine"],
  URIC_ACID: ["uric acid", "serum uric acid"],
  BILI_DIRECT: ["bilirubin direct", "direct bilirubin", "bilirubin (direct)", "conjugated bilirubin"],
  BILI_INDIRECT: ["bilirubin indirect", "indirect bilirubin", "bilirubin (indirect)"],
  PROTEIN_TOTAL: ["proteins (total)", "total protein", "protein total", "total proteins", "serum protein"],
  GLOBULIN: ["globulin", "serum globulin"],
  AG_RATIO: ["a/g ratio", "albumin/globulin ratio", "a:g ratio"],
  GLUCOSE_PP: ["plasma glucose-pp", "post prandial glucose", "postprandial glucose", "ppbs", "glucose-pp", "glucose (pp)", "plasma glucose (pp)"],
  EAG: ["estimated avg glucose (3 mths)", "estimated average glucose", "eag"],
  AMYLASE: ["amylase", "serum amylase"],
  LIPASE: ["lipase", "serum lipase"],
  VLDL: ["vldl", "vldl cholesterol"],
  NON_HDL: ["non-hdl cholesterol", "non hdl cholesterol", "non-hdl"],
  CHOL_HDL_RATIO: ["chol/hdl", "total cholesterol/hdl ratio", "cholesterol/hdl ratio", "tc/hdl ratio"],
};

const EXTRA: Record<string, string[]> = {
  WBC: ["total leucocyte count (tlc)", "total leukocyte count (tlc)", "total leucocyte count", "total leukocyte count", "tlc", "total wbc count", "wbc count"],
  GLUCOSE_FASTING: ["plasma glucose-f", "plasma glucose-fasting", "fasting blood sugar", "fbs", "plasma glucose (fasting)", "glucose fasting (plasma)"],
  B12: ["vitamin b-12 level", "vitamin b-12", "vitamin b12 level", "vit b12"],
  VITD25OH: ["25 oh cholecalciferol (d2+d3)", "25 oh vitamin d", "25-oh vitamin d (total)", "vitamin d total", "25-hydroxy vitamin d", "vitamin d (25-hydroxy)"],
  ALT: ["alt (sgpt)", "sgpt (alt)", "sgpt"],
  AST: ["ast (sgot)", "sgot (ast)", "sgot"],
  GGT: ["gamma glutamyl transferase", "ggtp", "gamma gt (ggt)"],
  CHOL_TOTAL: ["total cholesterol (tc)"],
  BILIRUBIN: ["bilirubin total", "bilirubin, total"],
  TRIG: ["triglycerides (tg)"],
};

const LOOKUP = new Map<string, string>();
for (const table of [ALIASES, EXTRA]) for (const [code, names] of Object.entries(table)) for (const n of names) LOOKUP.set(normaliseName(n), code);

/** Lower-case, collapse spaces, tighten spaced hyphens ("C- Reactive" → "c-reactive") and bracket spacing. */
export function normaliseName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)/g, ")")
    .trim();
}

export function canonicalCode(reportedName: string): string | null {
  return LOOKUP.get(normaliseName(reportedName)) ?? null;
}
