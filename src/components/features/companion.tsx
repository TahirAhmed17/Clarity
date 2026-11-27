"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Orb, type OrbState } from "@/components/orb/orb";
import { Button } from "@/components/ui/primitives";
import type { ChatMessage } from "@/lib/domain";
import { useReducedMotion } from "@/lib/preferences";
import type { CompanionResponse } from "@/server/ai/schemas";
import { summarizeReport, type ExtractedResult, type ReportSummary } from "@/lib/report-summary";
import { CompanionResponseView } from "./companion-response";
import { ReportReveal } from "./report-reveal";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; res: CompanionResponse }
  | { id: string; role: "notice"; text: string; tone: "info" | "error" }
  | { id: string; role: "report"; filename: string; collectedOn: string | null; summary: ReportSummary };

const STARTERS = ["Give me an overview of my results", "Why am I tired in the afternoons?", "How has my cholesterol changed?", "Help me sleep more consistently"];

const STATE_TEXT: Record<OrbState, string> = {
  idle: "",
  listening: "Listening",
  thinking: "Thinking through your data",
  answering: "Here's what I found",
  alert: "Some results are worth a professional's eye",
};

function fromHistory(messages: ChatMessage[]): Turn[] {
  return messages.flatMap((m): Turn[] => {
    if (m.role === "user") return [{ id: m.id, role: "user", text: m.content }];
    const res = m.structured as CompanionResponse | null;
    // Older stored answers may predate newer response fields; only show complete ones.
    return res && res.nextMove && Array.isArray(res.sources) ? [{ id: m.id, role: "assistant", res }] : [];
  });
}

async function upload(endpoint: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(endpoint, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? "Upload failed.");
  return j;
}

export function Companion({ initialMessages, greeting, initialQuestion }: { initialMessages: ChatMessage[]; greeting: string; initialQuestion?: string | null }) {
  const [turns, setTurns] = useState<Turn[]>(() => fromHistory(initialMessages));
  const [question, setQuestion] = useState("");
  const [orb, setOrb] = useState<OrbState>("idle");
  const [busy, setBusy] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const reduced = useReducedMotion();

  const settle = useCallback((state: OrbState, ms = 4000) => {
    setOrb(state);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setOrb("idle"), ms);
  }, []);

  const ask = useCallback(
    async (q: string | null) => {
      setBusy(true);
      clearTimeout(settleTimer.current);
      setOrb("thinking");
      if (q) setTurns((t) => [...t, { id: crypto.randomUUID(), role: "user", text: q }]);
      try {
        const r = await fetch("/api/ai/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
        const res = body as CompanionResponse;
        setTurns((t) => [...t, { id: crypto.randomUUID(), role: "assistant", res }]);
        settle(res.safety.flagForProfessional ? "alert" : "answering");
      } catch (e) {
        setTurns((t) => [...t, { id: crypto.randomUUID(), role: "notice", tone: "error", text: e instanceof Error ? e.message : "Something went wrong." }]);
        setOrb("idle");
      } finally {
        setBusy(false);
      }
    },
    [settle],
  );

  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  // Scroll only when a new turn arrives in this visit — never on first load, which should open on the orb.
  const seenTurns = useRef(turns.length);
  useEffect(() => {
    if (turns.length > seenTurns.current) endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
    seenTurns.current = turns.length;
  }, [turns.length, reduced]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  async function onUpload(kind: "report" | "wearable", file: File) {
    setBusy(true);
    setOrb("thinking");
    try {
      if (kind === "report") {
        const j = await upload("/api/ingest/report", file);
        setTurns((t) => [
          ...t,
          { id: crypto.randomUUID(), role: "report", filename: file.name, collectedOn: j.document.collectedOn, summary: summarizeReport(j.biomarkers as ExtractedResult[]) },
        ]);
        setBusy(false);
        await ask("Give me an overview of my latest results");
        return;
      }
      const j = await upload("/api/ingest/apple-health", file);
      setTurns((t) => [...t, { id: crypto.randomUUID(), role: "notice", tone: "info", text: `Imported ${j.metricsStored} daily wearable values (${j.summary.firstDay} to ${j.summary.lastDay}).` }]);
      settle("answering", 2500);
    } catch (e) {
      setTurns((t) => [...t, { id: crypto.randomUUID(), role: "notice", tone: "error", text: e instanceof Error ? e.message : "Upload failed." }]);
      setOrb("idle");
    } finally {
      setBusy(false);
    }
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant")?.id;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-10 sm:text-left">
        <Orb size={176} state={orb} className="sm:size-[208px]" />
        <div className="max-w-xl">
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">{greeting}</h1>
          <p className="mt-3 text-lg text-ink-soft">Start with a symptom, a goal, or a report. You&apos;ll get one clear next move, with the detail a tap away.</p>
          <p aria-live="polite" className="mt-2 h-5 text-sm font-medium text-teal-ink">
            {STATE_TEXT[orb]}
          </p>
        </div>
      </section>

      {turns.length > 0 && (
        <ol className="flex flex-col gap-6" aria-label="Conversation">
          <AnimatePresence initial={false}>
            {turns.map((t) => (
              <motion.li
                key={t.id}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={t.role === "user" ? "self-end" : "self-stretch"}
              >
                {t.role === "user" && <p className="max-w-md rounded-3xl rounded-br-md bg-ink px-5 py-3 text-white">{t.text}</p>}
                {t.role === "notice" && (
                  <p className={t.tone === "error" ? "rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink" : "text-sm text-ink-soft"}>{t.text}</p>
                )}
                {t.role === "assistant" && <CompanionResponseView res={t.res} compact={t.id !== lastAssistant} />}
                {t.role === "report" && <ReportReveal filename={t.filename} collectedOn={t.collectedOn} summary={t.summary} />}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      <div ref={endRef} />

      <div className="sticky bottom-20 z-10 lg:bottom-6">
        <form
          className="rounded-[1.75rem] bg-white/95 p-3 shadow-[var(--shadow-soft)] ring-1 ring-line backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            const q = question.trim();
            if (!q || busy) return;
            setQuestion("");
            void ask(q);
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
            onFocus={() => !busy && setOrb("listening")}
            onBlur={() => !busy && orb === "listening" && setOrb("idle")}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (!busy) setOrb("listening");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask about a result, a symptom, or what to do next…"
            className="w-full resize-none bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap gap-1">
              <label className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-teal-ink hover:bg-mint-soft focus-within:outline-2 focus-within:outline-teal-ink">
                Add blood report
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onUpload("report", e.target.files[0])} />
              </label>
              <label className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-teal-ink hover:bg-mint-soft focus-within:outline-2 focus-within:outline-teal-ink">
                Add Apple Health export
                <input type="file" accept=".xml,application/xml,text/xml" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onUpload("wearable", e.target.files[0])} />
              </label>
            </div>
            <Button type="submit" disabled={busy || !question.trim()}>
              {busy ? "Thinking…" : "Ask"}
            </Button>
          </div>
        </form>
        {turns.length === 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void ask(s)}
                className="rounded-full bg-white px-3.5 py-1.5 text-sm text-ink-soft ring-1 ring-line hover:text-ink hover:ring-teal-ink/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
