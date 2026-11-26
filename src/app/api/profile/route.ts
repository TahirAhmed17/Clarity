import { z } from "zod";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

const Body = z.object({
  goals: z.array(z.string().trim().min(2).max(120)).max(8).optional(),
  routine: z.record(z.string().trim().min(1).max(40), z.string().trim().max(200)).optional(),
});

/** PATCH { goals?, routine? } — user-editable context. Changes are logged to the timeline. */
export async function PATCH(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: { code: "bad_request", message: "Goals: up to 8 short entries. Routine: short text values." } }, 400);
  try {
    const repo = await getRepository();
    const id = getCurrentProfileId();
    const before = await repo.getProfile(id);
    if (!before) return json({ error: { code: "not_found", message: "Profile not found." } }, 404);
    const notes: { kind: string; title: string; detail: Record<string, unknown> }[] = [];
    if (parsed.data.goals) {
      for (const g of parsed.data.goals.filter((g) => !before.goals.includes(g))) notes.push({ kind: "goal_added", title: "Goal added", detail: { summary: g } });
      for (const g of before.goals.filter((g) => !parsed.data.goals!.includes(g))) notes.push({ kind: "goal_removed", title: "Goal removed", detail: { summary: g } });
    }
    if (parsed.data.routine) {
      const changed = Object.keys(parsed.data.routine).filter((k) => before.routine[k] !== parsed.data.routine![k]);
      if (changed.length) notes.push({ kind: "routine_changed", title: "Routine updated", detail: { summary: changed.join(", ") } });
    }
    const after = await repo.updateProfile(id, parsed.data, notes);
    return json({ profile: after });
  } catch (err) {
    return errorResponse(err, "profile.update");
  }
}
