"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";

/** POSTs JSON to an API route, shows errors inline, then refreshes server data. */
export function PostButton({
  url,
  body,
  label,
  pendingLabel = "Working…",
  variant = "primary",
  className,
}: {
  url: string;
  body?: unknown;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "soft" | "danger";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(j?.error?.message ?? "Something went wrong.");
      else if (j?.message) setMsg(j.message);
      startTransition(() => router.refresh());
    } catch {
      setMsg("Couldn't reach Clarity. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant={variant} disabled={busy} onClick={go} className={className}>
        {busy ? pendingLabel : label}
      </Button>
      {msg && (
        <span role="status" className="text-xs text-ink-soft">
          {msg}
        </span>
      )}
    </span>
  );
}
