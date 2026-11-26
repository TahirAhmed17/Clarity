import { connection } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

/** GET the most recent conversation turns (oldest first) for restoring the companion thread. */
export async function GET() {
  await connection();
  try {
    const repo = await getRepository();
    const all = await repo.listMessages(getCurrentProfileId());
    return json({ messages: all.slice(-20) });
  } catch (err) {
    return errorResponse(err, "messages.list");
  }
}
