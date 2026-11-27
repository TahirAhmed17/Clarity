import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

const Body = z.object({ note: z.string().trim().max(300).nullable().optional() });

/** POST — MOCK "request to book" for a SAMPLE event. No real booking is made. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/request">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: { code: "bad_request", message: "Note must be under 300 characters." } }, 400);
  try {
    const repo = await getRepository();
    const event = (await repo.listEvents()).find((e) => e.id === id);
    if (!event) return json({ error: { code: "not_found", message: "Event not found." } }, 404);
    const profileId = getCurrentProfileId();
    if ((await repo.listEventRequests(profileId)).some((r) => r.eventId === id && r.status !== "cancelled")) {
      return json({ error: { code: "already_requested", message: "You've already requested this one." } }, 409);
    }
    const req = await repo.createEventRequest(profileId, id, parsed.data.note ?? null);
    return json({ request: req, mock: true, message: "Mock request recorded — this is a SAMPLE listing and no real booking was made." }, 201);
  } catch (err) {
    return errorResponse(err, "events.request");
  }
}
