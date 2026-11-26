"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Sends JSON to an API route, shows the result inline, then refreshes server data.
 * With `confirm`, the first click asks for confirmation in place (no browser dialog).
 */
export function PostButton({
  url,
  body,
  label,
  pendingLabel = "Working…",
  variant = "primary",
  method = "POST",
  confirm,
  className,
}: {
  url: string;
  body?: unknown;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "soft" | "danger";
  method?: "POST" | "PATCH" | "DELETE";
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" && body === undefined ? undefined : JSON.stringify(body ?? {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(j?.error?.message ?? "Something went wrong.");
      else if (j?.message) setMsg(j.message);
      startTransition(() => router.refresh());
    } catch {
      setMsg("Couldn't reach Clarity. Please try again.");
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      {asking ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-coral-ink">{confirm}</span>
          <Button type="button" variant="danger" disabled={busy} onClick={go} className="h-9">
            {busy ? pendingLabel : `Yes, ${label.toLowerCase()}`}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAsking(false)} className="h-9">
            Cancel
          </Button>
        </span>
      ) : (
        <Button type="button" variant={variant} disabled={busy} onClick={() => (confirm ? setAsking(true) : go())} className={className}>
          {busy ? pendingLabel : label}
        </Button>
      )}
      {msg && (
        <span role="status" className="text-xs text-ink-soft">
          {msg}
        </span>
      )}
    </span>
  );
}
