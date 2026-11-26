import { connection } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

/** GET — export of everything Clarity holds for the current profile (data portability / review). */
export async function GET() {
  await connection();
  try {
    const repo = await getRepository();
    const id = getCurrentProfileId();
    const [profile, documents, biomarkers, wearables, symptoms, messages] = await Promise.all([
      repo.getProfile(id),
      repo.listDocuments(id),
      repo.listBiomarkers(id),
      repo.listWearableMetrics(id),
      repo.listSymptoms(id),
      repo.listMessages(id),
    ]);
    return json({ profile, documents, biomarkers, wearables, symptoms, messages });
  } catch (err) {
    return errorResponse(err, "profile.export");
  }
}

/** DELETE — removes all health records for the current profile. Requires { "confirm": "DELETE" }. */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "DELETE") {
      return json({ error: { code: "confirmation_required", message: 'Send { "confirm": "DELETE" } to delete your health data.' } }, 400);
    }
    const repo = await getRepository();
    await repo.deleteProfileHealthData(getCurrentProfileId());
    return json({ deleted: true, mode: repo.mode });
  } catch (err) {
    return errorResponse(err, "profile.delete");
  }
}
