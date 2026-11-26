import { z } from "zod";
import { respond } from "@/server/ai/service";
import { getEnv } from "@/server/config/env";
import { getRepository } from "@/server/data";
import { getRetriever } from "@/server/evidence";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

const Body = z.object({ question: z.string().trim().max(2000).nullable().optional() });

/** POST { question?: string } → CompanionResponse (structured, safety-validated, with disclaimer). */
export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json({ error: { code: "bad_request", message: "Send JSON like { \"question\": \"...\" } (max 2000 characters)." } }, 400);
  }
  try {
    const res = await respond(getCurrentProfileId(), body.question ?? null, { repo: await getRepository(), env: getEnv(), retriever: await getRetriever() });
    return json(res);
  } catch (err) {
    return errorResponse(err, "ai.respond");
  }
}
