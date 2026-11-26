/**
 * SYNTHETIC DEMO DATASET — NOT A REAL PERSON.
 * Single source of truth for: DB seed script, seed-data fallback repository,
 * and the generated synthetic blood report PDF (the "latest" report).
 * Values are invented for demonstration and are not clinical guidance.
 */
import type {
  Biomarker,
  Profile,
  SupplementCatalogueItem,
  SymptomEntry,
  WearableMetric,
  WellnessEvent,
} from "@/lib/domain";

export const SYNTHETIC_LABEL = "SYNTHETIC DEMO DATA — NOT A REAL PERSON";

export const DEMO_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_REVIEWER_ID = "00000000-0000-4000-8000-000000000002";
export const HISTORICAL_DOCUMENT_ID = "00000000-0000-4000-8000-000000000101";

export const demoProfile: Profile = {
  id: DEMO_PROFILE_ID,
  role: "member",
  displayName: "Alex Morgan (synthetic)",
  birthYear: 1996,
  sexAtBirth: "female",
  goals: ["Feel more energetic in the afternoons", "Sleep more consistently", "Understand my cholesterol"],
  routine: {
    work: "Desk-based, hybrid, long screen days",
    movement: "Gym twice a week, otherwise light walking",
    sleep: "Usually 00:30 to 07:00, later at weekends",
    nutrition: "Skips breakfast often, eats out 3-4 times a week",
  },
  isSynthetic: true,
};

export const demoReviewer: Profile = {
  id: DEMO_REVIEWER_ID,
  role: "reviewer",
  displayName: "Dr. Demo Reviewer (simulated)",
  birthYear: null,
  sexAtBirth: null,
  goals: [],
  routine: {},
  isSynthetic: true,
};

/** A lab line as printed on a synthetic report. */
export interface SyntheticLabLine {
  name: string;
  code: string;
  value: string;
  unit: string;
  ref: string;
  flag?: "H" | "L";
}

export interface SyntheticReport {
  documentId: string | null;
  collectedOn: string;
  labName: string;
  lines: SyntheticLabLine[];
}

/** Earlier report, preloaded into the seed as structured history. */
export const historicalReport: SyntheticReport = {
  documentId: HISTORICAL_DOCUMENT_ID,
  collectedOn: "2026-04-08",
  labName: "Northbridge Example Diagnostics (fictional)",
  lines: [
    { name: "Haemoglobin", code: "HGB", value: "128", unit: "g/L", ref: "120 - 160" },
    { name: "Ferritin", code: "FERRITIN", value: "24", unit: "ug/L", ref: "15 - 150" },
    { name: "ALT", code: "ALT", value: "31", unit: "U/L", ref: "7 - 35" },
    { name: "Creatinine", code: "CREATININE", value: "71", unit: "umol/L", ref: "45 - 90" },
    { name: "TSH", code: "TSH", value: "2.1", unit: "mIU/L", ref: "0.4 - 4.0" },
    { name: "HbA1c", code: "HBA1C", value: "34", unit: "mmol/mol", ref: "20 - 41" },
    { name: "LDL Cholesterol", code: "LDL", value: "3.2", unit: "mmol/L", ref: "< 3.0", flag: "H" },
    { name: "HDL Cholesterol", code: "HDL", value: "1.5", unit: "mmol/L", ref: "> 1.2" },
    { name: "Vitamin D (25-OH)", code: "VITD25OH", value: "48", unit: "nmol/L", ref: "50 - 175", flag: "L" },
  ],
};

/** Latest report — rendered into samples/synthetic-blood-report.pdf and uploaded during the demo. */
export const latestReport: SyntheticReport = {
  documentId: null,
  collectedOn: "2026-10-14",
  labName: "Northbridge Example Diagnostics (fictional)",
  lines: [
    { name: "Haemoglobin", code: "HGB", value: "124", unit: "g/L", ref: "120 - 160" },
    { name: "White Cell Count", code: "WBC", value: "6.1", unit: "10^9/L", ref: "4.0 - 11.0" },
    { name: "Platelets", code: "PLT", value: "265", unit: "10^9/L", ref: "150 - 400" },
    { name: "Ferritin", code: "FERRITIN", value: "13", unit: "ug/L", ref: "15 - 150", flag: "L" },
    { name: "Vitamin B12", code: "B12", value: "310", unit: "ng/L", ref: "197 - 771" },
    { name: "ALT", code: "ALT", value: "38", unit: "U/L", ref: "7 - 35", flag: "H" },
    { name: "AST", code: "AST", value: "27", unit: "U/L", ref: "8 - 33" },
    { name: "GGT", code: "GGT", value: "22", unit: "U/L", ref: "5 - 40" },
    { name: "Creatinine", code: "CREATININE", value: "74", unit: "umol/L", ref: "45 - 90" },
    { name: "eGFR", code: "EGFR", value: ">90", unit: "mL/min/1.73m2", ref: "> 60" },
    { name: "Urea", code: "UREA", value: "4.8", unit: "mmol/L", ref: "2.5 - 7.8" },
    { name: "TSH", code: "TSH", value: "2.4", unit: "mIU/L", ref: "0.4 - 4.0" },
    { name: "Free T4", code: "FT4", value: "14.2", unit: "pmol/L", ref: "12.0 - 22.0" },
    { name: "Fasting Glucose", code: "GLUCOSE_FASTING", value: "5.4", unit: "mmol/L", ref: "3.9 - 5.5" },
    { name: "HbA1c", code: "HBA1C", value: "37", unit: "mmol/mol", ref: "20 - 41" },
    { name: "Total Cholesterol", code: "CHOL_TOTAL", value: "5.6", unit: "mmol/L", ref: "< 5.0", flag: "H" },
    { name: "LDL Cholesterol", code: "LDL", value: "3.5", unit: "mmol/L", ref: "< 3.0", flag: "H" },
    { name: "HDL Cholesterol", code: "HDL", value: "1.4", unit: "mmol/L", ref: "> 1.2" },
    { name: "Triglycerides", code: "TRIG", value: "1.6", unit: "mmol/L", ref: "< 1.7" },
    { name: "Vitamin D (25-OH)", code: "VITD25OH", value: "41", unit: "nmol/L", ref: "50 - 175", flag: "L" },
    { name: "hs-CRP", code: "HSCRP", value: "1.2", unit: "mg/L", ref: "< 3.0" },
  ],
};

function parseRef(ref: string): { low: number | null; high: number | null } {
  const range = ref.match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
  if (range) return { low: Number(range[1]), high: Number(range[2]) };
  const lt = ref.match(/^\s*<\s*(\d+(?:\.\d+)?)\s*$/);
  if (lt) return { low: null, high: Number(lt[1]) };
  const gt = ref.match(/^\s*>\s*(\d+(?:\.\d+)?)\s*$/);
  if (gt) return { low: Number(gt[1]), high: null };
  return { low: null, high: null };
}

export function reportToBiomarkers(report: SyntheticReport, profileId: string): Biomarker[] {
  return report.lines.map((line, i) => {
    const { low, high } = parseRef(line.ref);
    const numeric = /^\d+(\.\d+)?$/.test(line.value) ? Number(line.value) : null;
    return {
      id: `00000000-0000-4000-8001-${String(i + 1).padStart(12, "0")}`,
      profileId,
      documentId: report.documentId,
      code: line.code,
      nameAsReported: line.name,
      valueNumeric: numeric,
      valueText: line.value,
      unitAsReported: line.unit,
      refLow: low,
      refHigh: high,
      refText: line.ref,
      flagAsReported: line.flag ?? null,
      observedOn: report.collectedOn,
      source: "synthetic_seed",
      confidence: 1,
      pageNumber: null,
    };
  });
}

/** Deterministic pseudo-random generator so the dataset is identical on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 14 days of daily wearable aggregates ending on the given day. */
export function generateWearableSeries(profileId: string, endDay = "2026-10-20", days = 14): WearableMetric[] {
  const rand = mulberry32(42);
  const end = new Date(`${endDay}T00:00:00Z`);
  const out: WearableMetric[] = [];
  let n = 0;
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(end.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
    const push = (metricType: WearableMetric["metricType"], value: number, unit: WearableMetric["unit"], aggregation: WearableMetric["aggregation"]) => {
      n++;
      out.push({
        id: `00000000-0000-4000-8002-${String(n).padStart(12, "0")}`,
        profileId,
        documentId: null,
        metricType,
        value,
        unit,
        aggregation,
        day,
        sampleCount: 1,
        sourceFormat: "synthetic_seed",
        sourceName: "Synthetic wearable",
      });
    };
    push("steps", Math.round((weekend ? 9000 : 5200) + rand() * 3000), "count", "sum");
    push("active_energy", Math.round((weekend ? 420 : 260) + rand() * 120), "kcal", "sum");
    push("resting_heart_rate", Math.round(62 + rand() * 6), "bpm", "avg");
    push("hrv_sdnn", Math.round(38 + rand() * 18), "ms", "avg");
    push("sleep_asleep", Math.round((weekend ? 470 : 375) + rand() * 50), "min", "sum");
  }
  return out;
}

export const demoSymptoms: SymptomEntry[] = [
  {
    id: "00000000-0000-4000-8003-000000000001",
    profileId: DEMO_PROFILE_ID,
    description: "Energy dips most afternoons around 3pm",
    severity: 3,
    startedOn: "2026-08-01",
    resolvedOn: null,
    tags: ["fatigue", "energy"],
    source: "user_provided",
    createdAt: "2026-10-15T09:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8003-000000000002",
    profileId: DEMO_PROFILE_ID,
    description: "Takes a long time to fall asleep on work nights",
    severity: 2,
    startedOn: "2026-09-10",
    resolvedOn: null,
    tags: ["sleep"],
    source: "user_provided",
    createdAt: "2026-10-15T09:01:00.000Z",
  },
];

/** SAMPLE catalogue. No doses: dosing is only ever set by a (simulated) reviewer. */
export const supplementCatalogue: SupplementCatalogueItem[] = [
  {
    id: "00000000-0000-4000-8004-000000000001",
    slug: "vitamin-d",
    name: "Vitamin D",
    category: "Vitamins",
    description: "Supports bone and muscle health; levels often fall with limited sunlight.",
    relevanceNotes: "May be worth discussing when a measured 25-OH vitamin D result is below the lab's range.",
    cautionNotes: "Excess intake can be harmful. Interactions with some medicines. A professional should set any dose.",
    sourceUrl: null,
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8004-000000000002",
    slug: "iron",
    name: "Iron",
    category: "Minerals",
    description: "Needed to make haemoglobin; low stores can contribute to tiredness.",
    relevanceNotes: "May be worth discussing when ferritin is below the lab's range, after a professional confirms the cause.",
    cautionNotes: "Iron should not be taken without testing; too much is harmful and the cause of low stores needs assessing.",
    sourceUrl: null,
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8004-000000000003",
    slug: "vitamin-b12",
    name: "Vitamin B12",
    category: "Vitamins",
    description: "Involved in red blood cell formation and nerve function.",
    relevanceNotes: "May be worth discussing with low or borderline B12 results or a restricted diet.",
    cautionNotes: "Low B12 can have medical causes that need investigation.",
    sourceUrl: null,
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8004-000000000004",
    slug: "omega-3",
    name: "Omega-3 fatty acids",
    category: "Fatty acids",
    description: "Found in oily fish; studied in relation to blood fats.",
    relevanceNotes: "Sometimes discussed alongside lipid results and diet patterns low in oily fish.",
    cautionNotes: "May interact with blood-thinning medicines.",
    sourceUrl: null,
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8004-000000000005",
    slug: "soluble-fibre",
    name: "Soluble fibre (e.g. psyllium)",
    category: "Fibre",
    description: "Soluble fibre is studied for its effect on LDL cholesterol.",
    relevanceNotes: "Sometimes discussed alongside raised LDL, usually after dietary sources.",
    cautionNotes: "Take with enough fluid; can affect absorption of some medicines.",
    sourceUrl: null,
    isSample: true,
  },
];

export const sampleEvents: WellnessEvent[] = [
  {
    id: "00000000-0000-4000-8005-000000000001",
    slug: "sunrise-walking-club",
    title: "SAMPLE — Sunrise Walking Club",
    category: "Movement",
    description: "A relaxed 45-minute group walk in the park before work.",
    howItMayHelp: "Morning daylight and gentle movement can support energy and a steadier sleep rhythm.",
    expectedOutcome: "A realistic habit anchor: more weekday steps and some morning light exposure.",
    tags: ["energy", "sleep", "movement", "vitamin_d"],
    location: "Riverside Park (fictional)",
    startsAt: "2026-12-05T07:00:00.000Z",
    priceText: "Free",
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8005-000000000002",
    slug: "sleep-reset-workshop",
    title: "SAMPLE — Sleep Reset Workshop",
    category: "Sleep",
    description: "A practical evening session on wind-down routines and consistent sleep timing.",
    howItMayHelp: "Builds a concrete wind-down routine you can try the same night.",
    expectedOutcome: "A personal wind-down plan; changes in sleep consistency usually take a few weeks.",
    tags: ["sleep", "energy"],
    location: "Online",
    startsAt: "2026-12-09T19:00:00.000Z",
    priceText: "£15 (sample price)",
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8005-000000000003",
    slug: "heart-smart-kitchen",
    title: "SAMPLE — Heart-Smart Kitchen Class",
    category: "Nutrition",
    description: "Cook three quick meals built around fibre, oily fish and plant fats.",
    howItMayHelp: "Hands-on ideas for eating patterns often discussed alongside cholesterol results.",
    expectedOutcome: "Three repeatable weekday recipes. Any lipid change would need a repeat test to see.",
    tags: ["cholesterol", "nutrition", "iron"],
    location: "Community Kitchen (fictional)",
    startsAt: "2026-12-12T18:30:00.000Z",
    priceText: "£25 (sample price)",
    isSample: true,
  },
  {
    id: "00000000-0000-4000-8005-000000000004",
    slug: "strength-foundations",
    title: "SAMPLE — Strength Foundations",
    category: "Movement",
    description: "Beginner-friendly coached strength session in small groups.",
    howItMayHelp: "Adds structured resistance training to your existing gym days.",
    expectedOutcome: "Confidence with basic lifts and a simple twice-weekly plan.",
    tags: ["movement", "metabolic", "energy"],
    location: "Studio 4 (fictional)",
    startsAt: "2026-12-07T10:00:00.000Z",
    priceText: "£12 (sample price)",
    isSample: true,
  },
];

export function buildSeedDataset() {
  return {
    profiles: [demoProfile, demoReviewer],
    historicalReport,
    biomarkers: reportToBiomarkers(historicalReport, DEMO_PROFILE_ID),
    wearableMetrics: generateWearableSeries(DEMO_PROFILE_ID),
    symptoms: demoSymptoms,
    supplementCatalogue,
    events: sampleEvents,
  };
}
