"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Inline form to correct a misread value. The original extracted value is kept for provenance. */
export function CorrectValue({ id, valueText, unit, refText }: { id: string; valueText: string; unit: string | null; refText: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(valueText);
  const [u, setU] = useState(unit ?? "");
  const [r, setR] = useState(refText ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink">
        Was this read wrongly? Correct it
      </button>
    );
  }
  const field = "w-full rounded-xl bg-canvas px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-teal-ink";
  return (
    <form
      className="space-y-2 rounded-2xl bg-canvas/60 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const res = await fetch(`/api/biomarkers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valueText: v, unitAsReported: u || null, refText: r || null }),
        });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) setErr(j?.error?.message ?? "Couldn't save the correction.");
        else {
          setOpen(false);
          router.refresh();
        }
      }}
    >
      <p className="text-xs text-ink-faint">Type it exactly as printed on your report. The original reading is kept.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-ink-soft">
          Value
          <input className={field} value={v} onChange={(e) => setV(e.target.value)} required maxLength={40} />
        </label>
        <label className="text-xs text-ink-soft">
          Unit
          <input className={field} value={u} onChange={(e) => setU(e.target.value)} maxLength={40} />
        </label>
        <label className="text-xs text-ink-soft">
          Lab range
          <input className={field} value={r} onChange={(e) => setR(e.target.value)} maxLength={60} placeholder="e.g. 4.0 - 11.0" />
        </label>
      </div>
      {err && <p className="text-sm text-coral-ink">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-9">
          {busy ? "Saving…" : "Save correction"}
        </Button>
        <Button type="button" variant="secondary" className="h-9" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
