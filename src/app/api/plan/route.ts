import { connection } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { generatePlan } from "@/server/recommendations/service";
import { getCurrentProfileId } from "@/server/session";

/** GET the active plan (or null). */
export async function GET() {
  await connection();
  try {
    const repo = await getRepository();
    return json({ plan: await repo.getActivePlan(getCurrentProfileId()) });
  } catch (err) {
    return errorResponse(err, "plan.get");
  }
}

/** POST → generate a fresh plan from the recommendation engine (supersedes the active one). */
export async function POST() {
  try {
    const plan = await generatePlan(await getRepository(), getCurrentProfileId());
    return json({ plan }, 201);
  } catch (err) {
    return errorResponse(err, "plan.generate");
  }
}
