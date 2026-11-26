import { EVIDENCE_NOTES } from "@/data/evidence/catalogue";
import type { PlanAction } from "../db/schema";

/**
 * Deterministic recommendation engine (M2.7).
 * Ranks a curated set of candidate actions by relevance, evidence, safety and feasibility, adapts to
 * completed/skipped history, and returns ONE primary next move plus at most three supporting actions.
 * The AI explains the result; it does not choose it.
 */

export type Category = PlanAction["category"];

export interface RecInput {
  flagged: { code: string | null; name: string; status: "above" | "below" }[];
  symptoms: { description: string; tags: string[] }[];
  goals: string[];
  question: string | null;
  wearables: { metric: string; avg7d: number | null }[];
  /** Recent plan outcomes (most recent first), last ~14 days. */
  history: { actionId: string; category: string; outcome: "completed" | "skipped"; at: string }[];
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  category: Category;
  score: number;
  reasons: string[];
  evidenceChunkIds: string[];
}

interface Candidate {
  id: string;
  title: string;
  detail: string;
  category: Category;
  /** 1 = tiny step, 3 = significant effort. */
  effort: 1 | 2 | 3;
  evidence: string[];
  triggers: {
    flags?: { code: string; status: "above" | "below" }[];
    goalWords?: RegExp;
    symptomWords?: RegExp;
    questionWords?: RegExp;
    wearable?: (w: Map<string, number | null>) => string | null;
  };
}

const CANDIDATES: Candidate[] = [
  {
    id: "nutrition-fibre-swap",
    title: "Swap one lunch this week for a fibre-rich option",
    detail: "Oats, beans, lentils or wholegrains at lunch are a small change often recommended alongside raised cholesterol.",
    category: "nutrition",
    effort: 1,
    evidence: ["nhs-lower-cholesterol-1", "who-healthy-diet-1"],
    triggers: { flags: [{ code: "LDL", status: "above" }, { code: "CHOL_TOTAL", status: "above" }], goalWords: /cholesterol|heart/i, questionWords: /cholesterol|ldl|diet|eat|food/i },
  },
  {
    id: "nutrition-oily-fish",
    title: "Have oily fish once this week",
    detail: "Salmon, mackerel or sardines replace saturated fats with unsaturated ones. A plant-based option is walnuts or chia.",
    category: "nutrition",
    effort: 1,
    evidence: ["nhs-lower-cholesterol-1", "nccih-omega3-1"],
    triggers: { flags: [{ code: "LDL", status: "above" }, { code: "TRIG", status: "above" }], goalWords: /cholesterol|heart/i, questionWords: /fish|omega|cholesterol/i },
  },
  {
    id: "nutrition-iron-foods",
    title: "Add an iron-rich food to one meal a day",
    detail: "Beans, lentils, lean meat, fortified cereal or leafy greens. Food is a safe first step while you discuss your ferritin with a professional.",
    category: "nutrition",
    effort: 1,
    evidence: ["mp-iron-1"],
    triggers: { flags: [{ code: "FERRITIN", status: "below" }, { code: "HGB", status: "below" }], symptomWords: /tired|fatigue|energy|exhaust/i, questionWords: /iron|tired|energy|ferritin/i },
  },
  {
    id: "movement-brisk-walk",
    title: "Take a 20-minute brisk walk on three weekdays",
    detail: "Builds towards the weekly activity guidance and is one of the lifestyle steps recommended for cholesterol. A lunchtime walk can also help an afternoon dip.",
    category: "movement",
    effort: 2,
    evidence: ["who-physical-activity-1", "nhs-lower-cholesterol-2"],
    triggers: {
      flags: [{ code: "LDL", status: "above" }, { code: "HBA1C", status: "above" }],
      goalWords: /energ|cholesterol|fit|active|weight/i,
      symptomWords: /tired|fatigue|energy/i,
      questionWords: /exercise|walk|activ|energy|tired/i,
      wearable: (w) => ((w.get("steps") ?? Infinity) < 7000 ? `your steps average about ${Math.round(w.get("steps")!)} a day` : null),
    },
  },
  {
    id: "movement-morning-daylight",
    title: "Spend 10 minutes outdoors before 10am on workdays",
    detail: "Daylight is how the body makes most of its vitamin D in spring and summer, and a morning routine anchors your day.",
    category: "movement",
    effort: 1,
    evidence: ["nhs-vitamin-d-1", "mp-vitamin-d-1"],
    triggers: { flags: [{ code: "VITD25OH", status: "below" }], goalWords: /energ|sleep/i, questionWords: /vitamin d|sun|daylight/i },
  },
  {
    id: "sleep-consistent-wake",
    title: "Keep the same wake-up time all week, weekends included",
    detail: "A regular schedule is one of the most consistently recommended sleep habits, and it stops sleep debt building up during the week.",
    category: "sleep",
    effort: 2,
    evidence: ["mp-healthy-sleep-2", "nhlbi-sleep-1"],
    triggers: {
      goalWords: /sleep/i,
      symptomWords: /sleep|insomnia|tired/i,
      questionWords: /sleep|tired|rest/i,
      wearable: (w) => ((w.get("sleep_asleep") ?? Infinity) < 420 ? `you average about ${Math.round((w.get("sleep_asleep")! / 60) * 10) / 10} hours asleep` : null),
    },
  },
  {
    id: "sleep-caffeine-cutoff",
    title: "No caffeine after 2pm for the next week",
    detail: "Avoiding caffeine later in the day is a simple habit linked with falling asleep more easily.",
    category: "sleep",
    effort: 1,
    evidence: ["mp-healthy-sleep-2"],
    triggers: { goalWords: /sleep/i, symptomWords: /fall asleep|sleep|insomnia/i, questionWords: /sleep|caffeine|coffee/i },
  },
  {
    id: "energy-walk-not-nap",
    title: "Swap an afternoon slump nap for a 10-minute walk",
    detail: "Late-afternoon naps can make it harder to sleep at night. A short walk is an alternative for the 3pm dip.",
    category: "movement",
    effort: 1,
    evidence: ["mp-healthy-sleep-2", "nhlbi-sleep-1"],
    triggers: { symptomWords: /afternoon|3pm|dip|slump/i, goalWords: /energ/i, questionWords: /afternoon|tired|energy|slump/i },
  },
  {
    id: "general-maintain",
    title: "Keep your routine and note when your next check-up is",
    detail: "Nothing in your current data points to a specific change. Re-testing at the same lab makes future comparisons more reliable.",
    category: "other",
    effort: 1,
    evidence: ["mp-lab-results-3"],
    triggers: {},
  },
];

const KNOWN_CHUNKS = new Set(EVIDENCE_NOTES.map((n) => n.id));

/** First evidence chunk tagged with each flagged biomarker, for the professional-review action. */
function evidenceForCodes(codes: string[]) {
  const ids: string[] = [];
  for (const code of codes) {
    const note = EVIDENCE_NOTES.find((n) => n.biomarkers.includes(code));
    if (note && !ids.includes(note.id)) ids.push(note.id);
  }
  return ids.length ? ids : ["mp-lab-results-2"];
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function recommend(input: RecInput): { primary: Recommendation; supporting: Recommendation[]; all: Recommendation[] } {
  const wear = new Map(input.wearables.map((w) => [w.metric, w.avg7d]));
  const goals = input.goals.join(" | ");
  const symptoms = input.symptoms.map((s) => `${s.description} ${s.tags.join(" ")}`).join(" | ");
  const recentSkips = (pred: (h: RecInput["history"][number]) => boolean) => input.history.filter((h) => h.outcome === "skipped" && pred(h)).length;

  const scored: Recommendation[] = [];

  // Safety: any result outside the lab's range → one consolidated professional-review action.
  if (input.flagged.length) {
    const names = input.flagged.map((f) => f.name);
    // Safety-first: stays the primary move until the person marks it done; then it steps aside.
    const done = input.history.some((h) => h.actionId === "professional-review" && h.outcome === "completed");
    const score = done ? 1 : 100 + Math.min(input.flagged.length, 4) * 0.5;
    scored.push({
      id: "professional-review",
      title: `Book a GP appointment to go through ${input.flagged.length === 1 ? names[0] : "your flagged results"}`,
      detail: `${listNames(names)} ${input.flagged.length === 1 ? "is" : "are"} outside your lab's printed range. That isn't a diagnosis, but a professional can interpret ${input.flagged.length === 1 ? "it" : "them"} with your history and decide whether anything needs follow-up.`,
      category: "professional",
      score,
      reasons: [`Safety first: ${input.flagged.length} result${input.flagged.length > 1 ? "s" : ""} outside the lab's range`],
      evidenceChunkIds: evidenceForCodes(input.flagged.map((f) => f.code).filter((c): c is string => !!c)),
    });
  }

  for (const c of CANDIDATES) {
    const reasons: string[] = [];
    let relevance = 0;
    for (const t of c.triggers.flags ?? []) {
      const hit = input.flagged.find((f) => f.code === t.code && f.status === t.status);
      if (hit) {
        relevance += 3;
        reasons.push(`${hit.name} is ${hit.status} the lab's range`);
      }
    }
    if (c.triggers.goalWords?.test(goals)) {
      relevance += 2;
      reasons.push("matches one of your goals");
    }
    if (c.triggers.symptomWords?.test(symptoms)) {
      relevance += 2;
      reasons.push("relates to a symptom you mentioned");
    }
    if (input.question && c.triggers.questionWords?.test(input.question)) {
      relevance += 2.5;
      reasons.push("relates to your question");
    }
    const w = c.triggers.wearable?.(wear);
    if (w) {
      relevance += 1.5;
      reasons.push(`your wearable data: ${w}`);
    }
    if (relevance === 0 && c.id !== "general-maintain") continue;

    const evidence = c.evidence.filter((id) => KNOWN_CHUNKS.has(id));
    let score = relevance + Math.min(2, evidence.length) * 0.5 + (c.effort === 1 ? 1 : c.effort === 2 ? 0.5 : 0);
    if (c.id === "general-maintain") score = 0.1;

    // Adaptation: back off actions (and categories) the person keeps skipping.
    const skippedThis = recentSkips((h) => h.actionId === c.id);
    const skippedCategory = recentSkips((h) => h.category === c.category);
    if (skippedThis >= 2) {
      score -= 2;
      reasons.push("lowered because you skipped it recently");
    } else if (skippedCategory >= 3) {
      score -= 1;
      reasons.push(`lowered because ${c.category} actions were skipped recently`);
    }
    if (input.history.some((h) => h.actionId === c.id && h.outcome === "completed")) reasons.push("you've done this before — keep it going");

    scored.push({ id: c.id, title: c.title, detail: c.detail, category: c.category, score: Math.round(score * 100) / 100, reasons, evidenceChunkIds: evidence });
  }

  scored.sort((a, b) => b.score - a.score);
  const primary = scored[0];
  const supporting: Recommendation[] = [];
  const used = new Set([primary.category]);
  for (const r of scored.slice(1)) {
    if (supporting.length >= 3) break;
    if (r.id === "general-maintain" || used.has(r.category)) continue;
    supporting.push(r);
    used.add(r.category);
  }
  return { primary, supporting, all: scored };
}
