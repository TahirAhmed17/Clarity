"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";

/** Add/remove goals. Changes are saved via PATCH /api/profile and logged on the timeline. */
export function GoalsEditor({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [goals, setGoals] = useState(initial);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: string[]) {
    setGoals(next);
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals: next }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(j?.error?.message ?? "Couldn't save.");
      setGoals(initial);
    } else {
      setMsg("Saved.");
      router.refresh();
    }
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {goals.map((g) => (
          <li key={g}>
            <Badge tone="lime" className="gap-2 py-1">
              {g}
              <button type="button" aria-label={`Remove goal ${g}`} className="text-lime-ink/70 hover:text-lime-ink" onClick={() => save(goals.filter((x) => x !== g))}>
                ×
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (v.length >= 2 && !goals.includes(v) && goals.length < 8) {
            save([...goals, v]);
            setDraft("");
          }
        }}
      >
        <label htmlFor="new-goal" className="sr-only">
          New goal
        </label>
        <input
          id="new-goal"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a goal, e.g. Walk more at lunch"
          className="min-w-0 flex-1 rounded-full bg-canvas px-4 py-2 text-sm ring-1 ring-line outline-none focus:ring-teal-ink"
        />
        <Button type="submit" variant="soft" className="h-10">
          Add
        </Button>
      </form>
      {msg && <p className="mt-2 text-xs text-ink-faint">{msg}</p>}
    </div>
  );
}
