import { z } from "zod";
import { HEALTH_DISCLAIMER } from "@/lib/constants";

/** ---------- Input: what every engine receives (identical across engines) ---------- */

export const BiomarkerContextSchema = z.object({
  code: z.string().nullable(),
  name: z.string(),
  valueText: z.string(),
  unit: z.string().nullable(),
  refText: z.string().nullable(),
  rangeStatus: z.enum(["below", "within", "above", "no_range", "not_numeric"]),
  observedOn: z.string().nullable(),
  previous: z.object({ valueText: z.string(), observedOn: z.string().nullable() }).nullable(),
});

export const WearableSummarySchema = z.object({
  metric: z.string(),
  unit: z.string(),
  avg7d: z.number().nullable(),
  days: z.number(),
});

export const EvidenceSnippetSchema = z.object({
  id: z.string(),
  source: z.string(),
  url: z.string(),
  text: z.string(),
});

const ActionCategoryEnum = z.enum(["movement", "nutrition", "sleep", "supplement", "professional", "other"]);

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  category: ActionCategoryEnum,
  reasons: z.array(z.string()),
  evidenceChunkIds: z.array(z.string()),
});

export const SystemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  dataState: z.enum(["none", "partial", "complete"]),
  summary: z.string(),
  missingPrimary: z.array(z.string()),
});

export const HealthContextSchema = z.object({
  profile: z.object({ goals: z.array(z.string()), routine: z.record(z.string(), z.string()) }),
  symptoms: z.array(z.object({ description: z.string(), severity: z.number().nullable() })),
  biomarkers: z.array(BiomarkerContextSchema),
  wearables: z.array(WearableSummarySchema),
  /** Curated evidence retrieved for this request. Empty until M2 retrieval exists. */
  evidence: z.array(EvidenceSnippetSchema),
  missing: z.array(z.string()),
  /** Deterministic organ/system summaries (M2.5). */
  systems: z.array(SystemSummarySchema).default([]),
  /** Deterministic recommendation (M2.7): the engine explains it, it does not replace it. */
  recommendation: z.object({ primary: RecommendationSchema, supporting: z.array(RecommendationSchema) }).nullable().default(null),
});

export const CompanionRequestSchema = z.object({
  question: z.string().max(2000).nullable(),
  context: HealthContextSchema,
});

/** ---------- Output: what every engine must return ---------- */

const ActionCategory = ActionCategoryEnum;

export const EngineOutputSchema = z.object({
  /** 1. What I noticed */
  noticed: z
    .array(z.object({ title: z.string().min(1).max(140), detail: z.string().min(1).max(600), refs: z.array(z.string()).max(6) }))
    .max(5),
  /** 2. Why it matters */
  whyItMatters: z.string().min(1).max(900),
  /** 3. Your next move (exactly one) */
  nextMove: z.object({
    title: z.string().min(1).max(120),
    detail: z.string().min(1).max(600),
    category: ActionCategory,
  }),
  supportingActions: z
    .array(z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(400), category: ActionCategory }))
    .max(3),
  /** 4. Supporting evidence — ids MUST come from context.evidence */
  evidence: z.array(z.object({ evidenceId: z.string(), claim: z.string().max(400) })).max(6),
  /** 5. Limitations */
  limitations: z.array(z.string().max(300)).min(1).max(6),
  /** 6. Follow-up suggestions */
  followUps: z.array(z.string().max(160)).max(4),
  flagForProfessional: z.boolean(),
});

export type EngineOutput = z.infer<typeof EngineOutputSchema>;

export const CompanionResponseSchema = EngineOutputSchema.extend({
  safety: z.object({
    flagForProfessional: z.boolean(),
    reasons: z.array(z.string()),
    /** Rules the safety validator had to enforce on the raw engine output. */
    interventions: z.array(z.string()),
  }),
  engine: z.string(),
  engineNotice: z.string().nullable(),
  /** Why the recommendation engine chose the next move. */
  nextMoveReasons: z.array(z.string()).default([]),
  /** The curated sources that were supplied as evidence (for display). */
  sources: z
    .array(z.object({ chunkId: z.string(), heading: z.string(), publisher: z.string(), title: z.string(), url: z.string(), date: z.string().nullable() }))
    .default([]),
  disclaimer: z.literal(HEALTH_DISCLAIMER),
});

export type HealthContext = z.infer<typeof HealthContextSchema>;
export type CompanionRequest = z.infer<typeof CompanionRequestSchema>;
export type CompanionResponse = z.infer<typeof CompanionResponseSchema>;

/** JSON Schema for engines that support constrained JSON output (Gemini). */
export const engineOutputJsonSchema = z.toJSONSchema(EngineOutputSchema, { target: "draft-7" });
