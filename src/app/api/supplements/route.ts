import { connection } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, HEALTH_DISCLAIMER, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";
import { suggestSupplements } from "@/server/supplements/service";

/** GET the user's supplement suggestions with catalogue details. */
export async function GET() {
  await connection();
  try {
    const repo = await getRepository();
    const [suggestions, catalogue] = await Promise.all([repo.listSupplementSuggestions(getCurrentProfileId()), repo.listSupplementCatalogue()]);
    return json({ suggestions: suggestions.map((s) => ({ ...s, item: catalogue.find((c) => c.id === s.catalogueId) ?? null })), disclaimer: HEALTH_DISCLAIMER });
  } catch (err) {
    return errorResponse(err, "supplements.list");
  }
}

/** POST → check eligibility and create pending (unreviewed, dose-free) suggestions. */
export async function POST() {
  try {
    const created = await suggestSupplements(await getRepository(), getCurrentProfileId());
    return json({ created: created.length }, 201);
  } catch (err) {
    return errorResponse(err, "supplements.suggest");
  }
}
