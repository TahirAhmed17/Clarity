import type { NextRequest } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getSimulatedReviewer } from "@/server/session";
import { ReviewSchema } from "@/server/supplements/service";

/** POST a SIMULATED review: approved (dose required) | changed | rejected. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/doctor/suggestions/[id]">) {
  const { id } = await ctx.params;
  const parsed = ReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: { code: "bad_request", message: "Approving needs a dose; changing or rejecting needs a note." } }, 400);
  }
  try {
    const repo = await getRepository();
    const reviewer = await getSimulatedReviewer(repo);
    if (!reviewer) return json({ error: { code: "forbidden", message: "Reviewer role required." } }, 403);
    const updated = await repo.reviewSuggestion(id, reviewer.id, parsed.data);
    if (!updated) return json({ error: { code: "not_found", message: "Suggestion not found." } }, 404);
    return json({ suggestion: updated, simulated: true });
  } catch (err) {
    return errorResponse(err, "doctor.review");
  }
}
