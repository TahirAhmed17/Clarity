"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function ReviewerSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await fetch("/api/doctor/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) {
          setError(j?.error?.message ?? "Couldn't sign in.");
          return;
        }
        router.replace(next);
        router.refresh();
      }}
    >
      <label htmlFor="code" className="block text-sm font-medium text-ink">
        Access code
      </label>
      <input
        id="code"
        type="password"
        autoComplete="off"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-xl bg-white px-4 py-3 ring-1 ring-line outline-none focus:ring-teal-ink"
      />
      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !code} className="w-full">
        {busy ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
