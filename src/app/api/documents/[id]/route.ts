import type { NextRequest } from "next/server";
import { getRepository } from "@/server/data";
import { errorResponse, json } from "@/server/http";
import { getCurrentProfileId } from "@/server/session";

/** DELETE — removes one uploaded file and every result derived from it. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  try {
    const ok = await (await getRepository()).deleteDocument(getCurrentProfileId(), id);
    if (!ok) return json({ error: { code: "not_found", message: "That file wasn't found." } }, 404);
    return json({ deleted: true });
  } catch (err) {
    return errorResponse(err, "documents.delete");
  }
}
