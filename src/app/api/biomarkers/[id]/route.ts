import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

const Body = z.object({
  valueText: z.string().trim().min(1).max(40),
  unitAsReported: z.string().trim().max(40).nullable(),
  refText: z.string().trim().max(60).nullable(),
});

/** PATCH — the user corrects a value they believe was read wrongly. The original is kept. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/biomarkers/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: { code: "bad_request", message: "Send the value as printed, plus unit and range (either can be empty)." } }, 400);
  try {
    const updated = await (await getRepository()).correctBiomarker(getCurrentProfileId(), id, parsed.data);
    if (!updated) return json({ error: { code: "not_found", message: "That result wasn't found." } }, 404);
    return json({ biomarker: updated });
  } catch (err) {
    return errorResponse(err, "biomarkers.correct");
  }
}
