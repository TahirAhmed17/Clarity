import { z } from "zod";
import { getEnv } from "@/server/config/env";
import { resetDemo } from "@/server/demo/reset";
import { errorResponse, json } from "@/server/http";

const Body = z.object({ confirm: z.literal("RESET") });

/** POST { confirm: "RESET" } — restore the demo to its starting synthetic state. */
export async function POST(request: Request) {
  if (!Body.safeParse(await request.json().catch(() => null)).success) {
    return json({ error: { code: "confirmation_required", message: 'Send { "confirm": "RESET" } to reset the demo.' } }, 400);
  }
  try {
    const result = await resetDemo(getEnv());
    if (!result.ok) return json({ error: { code: result.code, message: result.message } }, 403);
    return json({ reset: true, mode: result.mode, message: "Demo reset to its starting synthetic state." });
  } catch (err) {
    return errorResponse(err, "demo.reset");
  }
}
