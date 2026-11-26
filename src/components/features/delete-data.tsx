"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function DeleteDataButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function del() {
    const r = await fetch("/api/profile/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
    const body = await r.json();
    setMsg(r.ok ? (body.mode === "seed" ? "Deleted from the in-memory demo store. Restarting the server restores the synthetic data." : "Deleted.") : body.error?.message);
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-coral-ink">This removes all your reports, results, wearable data, symptoms and messages.</span>
          <Button variant="danger" onClick={del}>
            Yes, delete everything
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete my health data
        </Button>
      )}
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}
