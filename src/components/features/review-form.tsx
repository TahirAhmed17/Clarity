"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** SIMULATED reviewer decision form: approve with dose, change, or reject. */
export function ReviewForm({ suggestionId, catalogue }: { suggestionId: string; catalogue: { id: string; name: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approved" | "changed" | "rejected">("approved");
  const [dose, setDose] = useState("");
  const [note, setNote] = useState("");
  const [catalogueId, setCatalogueId] = useState(catalogue[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body =
      mode === "approved" ? { status: mode, reviewerDose: dose, reviewerNote: note || null } : mode === "changed" ? { status: mode, catalogueId, reviewerDose: dose || null, reviewerNote: note } : { status: mode, reviewerNote: note };
    const r = await fetch(`/api/doctor/suggestions/${suggestionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(j?.error?.message ?? "Couldn't save the review.");
    else router.refresh();
  }

  const field = "w-full rounded-xl bg-canvas px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-teal-ink";
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">Decision</legend>
        {(["approved", "changed", "rejected"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5 capitalize">
            <input type="radio" name={`mode-${suggestionId}`} checked={mode === m} onChange={() => setMode(m)} />
            {m === "approved" ? "Approve with dose" : m === "changed" ? "Change" : "Reject"}
          </label>
        ))}
      </fieldset>
      {mode === "changed" && (
        <select className={field} value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)} aria-label="Replacement supplement category">
          {catalogue.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {mode !== "rejected" && (
        <input className={field} value={dose} onChange={(e) => setDose(e.target.value)} placeholder={mode === "approved" ? "Dose and duration (required)" : "Dose (optional)"} aria-label="Dose" />
      )}
      <textarea className={field} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "approved" ? "Note (optional)" : "Reason (required)"} aria-label="Reviewer note" />
      {error && <p className="text-sm text-coral-ink">{error}</p>}
      <Button type="submit" disabled={busy} className="h-9">
        {busy ? "Saving…" : "Save simulated review"}
      </Button>
    </form>
  );
}
