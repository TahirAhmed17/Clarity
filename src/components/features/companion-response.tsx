import type { CompanionResponse } from "@/server/ai/schemas";
import { Badge, Card, Disclaimer, ProvenanceTag } from "@/components/ui/primitives";

const CATEGORY_LABEL: Record<CompanionResponse["nextMove"]["category"], string> = {
  movement: "Movement",
  nutrition: "Nutrition",
  sleep: "Sleep",
  supplement: "Supplement info",
  professional: "Talk to a professional",
  other: "Next step",
};

/** Concise overview first (next move), expandable detail below — per the first-analysis requirement. */
export function CompanionResponseView({ res }: { res: CompanionResponse }) {
  return (
    <div className="space-y-4">
      {res.engineNotice && <p className="rounded-2xl bg-stone px-4 py-2.5 text-sm text-stone-ink">{res.engineNotice}</p>}

      {res.safety.flagForProfessional && (
        <div role="status" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">
          <p className="font-semibold">Worth discussing with a healthcare professional</p>
          <ul className="mt-1 list-disc pl-5">
            {res.safety.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="bg-gradient-to-br from-mint-soft via-white to-mist-soft">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="teal">Your next move</Badge>
          <Badge tone="neutral">{CATEGORY_LABEL[res.nextMove.category]}</Badge>
          <ProvenanceTag kind="ai_interpretation" />
        </div>
        <h3 className="font-display text-2xl text-ink">{res.nextMove.title}</h3>
        <p className="mt-2 text-ink-soft">{res.nextMove.detail}</p>
        <p className="mt-4 text-sm text-ink">{res.whyItMatters}</p>
      </Card>

      <details className="group rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line/70">
        <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
          <span className="group-open:hidden">Show what I noticed, evidence and limitations</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-teal-ink">What I noticed</h4>
            {res.noticed.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing specific stood out.</p>
            ) : (
              <ul className="space-y-3">
                {res.noticed.map((n) => (
                  <li key={n.title}>
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="text-sm text-ink-soft">{n.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-2 text-sm font-semibold text-teal-ink">Supporting actions</h4>
            {res.supportingActions.length === 0 ? (
              <p className="text-sm text-ink-soft">Focus on the one next move for now.</p>
            ) : (
              <ul className="space-y-3">
                {res.supportingActions.map((a) => (
                  <li key={a.title}>
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-sm text-ink-soft">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-2 text-sm font-semibold text-teal-ink">Supporting evidence</h4>
            {res.evidence.length === 0 ? (
              <p className="text-sm text-ink-soft">No curated sources were retrieved yet (evidence retrieval arrives in M2).</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {res.evidence.map((e) => (
                  <li key={e.evidenceId}>{e.claim}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-2 text-sm font-semibold text-teal-ink">Limitations</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {res.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </div>
        {res.safety.interventions.length > 0 && (
          <p className="mt-4 text-xs text-ink-faint">Safety checks applied: {res.safety.interventions.join(" ")}</p>
        )}
        <p className="mt-2 text-xs text-ink-faint">Engine: {res.engine}</p>
      </details>

      <Disclaimer />
    </div>
  );
}
