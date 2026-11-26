import type { WellnessEvent } from "@/lib/domain";
import type { HealthContext } from "../ai/schemas";

/**
 * Event relevance (M2.9): each SAMPLE event gets a personal "why this is relevant to you" built only
 * from the user's own goals, symptoms and flagged results. Unrelated events are kept, ranked lower.
 */
const TAG_SIGNALS: Record<string, { goals?: RegExp; symptoms?: RegExp; flags?: string[]; label: string }> = {
  energy: { goals: /energ/i, symptoms: /tired|fatigue|energy|afternoon/i, label: "your energy goal" },
  sleep: { goals: /sleep/i, symptoms: /sleep|insomnia/i, label: "your sleep goal" },
  cholesterol: { goals: /cholesterol|heart/i, flags: ["LDL", "CHOL_TOTAL"], label: "your cholesterol results" },
  vitamin_d: { flags: ["VITD25OH"], label: "your vitamin D result" },
  iron: { flags: ["FERRITIN"], label: "your ferritin result" },
  movement: { goals: /fit|active|energ|weight/i, label: "staying active" },
  metabolic: { flags: ["HBA1C", "GLUCOSE_FASTING"], label: "your blood sugar results" },
  nutrition: { goals: /eat|diet|nutrition|cholesterol/i, label: "your nutrition goals" },
};

export interface RankedEvent extends WellnessEvent {
  relevanceScore: number;
  whyRelevant: string;
}

export function rankEvents(events: WellnessEvent[], ctx: HealthContext): RankedEvent[] {
  const goals = ctx.profile.goals.join(" | ");
  const symptoms = ctx.symptoms.map((s) => s.description).join(" | ");
  const flagged = new Set(ctx.biomarkers.filter((b) => b.rangeStatus === "above" || b.rangeStatus === "below").map((b) => b.code));
  return events
    .map((e) => {
      const reasons = new Set<string>();
      let score = 0;
      for (const tag of e.tags) {
        const sig = TAG_SIGNALS[tag];
        if (!sig) continue;
        if (sig.goals?.test(goals)) {
          score += 2;
          reasons.add(sig.label);
        }
        if (sig.symptoms?.test(symptoms)) {
          score += 1.5;
          reasons.add(sig.label);
        }
        if (sig.flags?.some((f) => flagged.has(f))) {
          score += 2;
          reasons.add(sig.label);
        }
      }
      const list = [...reasons];
      const whyRelevant = list.length
        ? `Suggested because of ${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]}.`
        : "General wellbeing — not linked to anything specific in your data.";
      return { ...e, relevanceScore: score, whyRelevant };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
