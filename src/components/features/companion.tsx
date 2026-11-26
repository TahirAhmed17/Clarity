"use client";

import { useState } from "react";
import type { CompanionResponse } from "@/server/ai/schemas";
import { Button } from "@/components/ui/primitives";
import { CompanionResponseView } from "./companion-response";

const STARTERS = ["Give me an overview of my results", "Why am I tired in the afternoons?", "How has my cholesterol changed?", "Help me sleep more consistently"];

export function Companion() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<{ status: "idle" | "thinking" | "done" | "error"; res?: CompanionResponse; error?: string }>({ status: "idle" });

  async function ask(q: string | null) {
    setState({ status: "thinking" });
    try {
      const r = await fetch("/api/ai/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      setState({ status: "done", res: body });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  return (
    <div className="space-y-5">
      <form
        className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line shadow-[var(--shadow-soft)]"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question.trim() || null);
        }}
      >
        <label htmlFor="ask" className="sr-only">
          Ask Clarity
        </label>
        <textarea
          id="ask"
          rows={2}
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Start with a symptom, a goal, or a question about your results…"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-base text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="px-2 text-xs text-ink-faint" aria-live="polite">
            {state.status === "thinking" ? "Thinking…" : ""}
          </p>
          <Button type="submit" disabled={state.status === "thinking"}>
            Ask Clarity
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              ask(s);
            }}
            className="rounded-full bg-white px-3.5 py-1.5 text-sm text-ink-soft ring-1 ring-line hover:text-ink hover:ring-teal-ink/40"
          >
            {s}
          </button>
        ))}
      </div>

      {state.status === "error" && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">{state.error}</p>}
      {state.status === "done" && state.res && <CompanionResponseView res={state.res} />}
    </div>
  );
}
