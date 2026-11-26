import { z } from "zod";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { recordActionOutcome } from "@/server/recommendations/service";
import { getCurrentProfileId } from "@/server/session";

const Body = z.object({ planId: z.string().uuid(), actionId: z.string().min(1).max(100), outcome: z.enum(["completed", "skipped"]) });

/** POST { planId, actionId, outcome } — mark a plan action completed or skipped. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: { code: "bad_request", message: "Send { planId, actionId, outcome: 'completed' | 'skipped' }." } }, 400);
  try {
    const plan = await recordActionOutcome(await getRepository(), getCurrentProfileId(), parsed.data.planId, parsed.data.actionId, parsed.data.outcome);
    if (!plan) return json({ error: { code: "not_found", message: "That plan or action wasn't found." } }, 404);
    return json({ plan });
  } catch (err) {
    return errorResponse(err, "plan.action");
  }
}
