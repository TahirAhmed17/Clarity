"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "work", label: "Work", hint: "e.g. desk-based, shifts, on your feet" },
  { key: "movement", label: "Movement", hint: "e.g. gym twice a week, walks the dog" },
  { key: "sleep", label: "Sleep", hint: "e.g. usually 23:30 to 07:00" },
  { key: "nutrition", label: "Food", hint: "e.g. vegetarian, skips breakfast" },
];

/** Edit routine context; changes are logged on the timeline (atomically, server-side). */
export function RoutineEditor({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        const routine = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
        const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routine }) });
        setState(r.ok ? "saved" : "error");
        if (r.ok) router.refresh();
      }}
    >
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="font-medium text-ink">{f.label}</span>
          <input
            value={values[f.key] ?? ""}
            maxLength={200}
            placeholder={f.hint}
            onChange={(e) => {
              setValues({ ...values, [f.key]: e.target.value });
              setState("idle");
            }}
            className="mt-1 w-full rounded-xl bg-canvas px-3 py-2 ring-1 ring-line outline-none focus:ring-teal-ink"
          />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="soft" disabled={state === "saving"} className="h-10">
          {state === "saving" ? "Saving…" : "Save routine"}
        </Button>
        <span role="status" className="text-sm text-ink-soft">
          {state === "saved" ? "Saved. Clarity will use this from your next question." : state === "error" ? "Couldn't save. Keep each answer short." : ""}
        </span>
      </div>
    </form>
  );
}
