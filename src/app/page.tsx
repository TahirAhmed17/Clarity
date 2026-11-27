import type { Metadata } from "next";
import Link from "next/link";
import { RangeRail } from "@/components/charts/range-rail";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Orb } from "@/components/orb/orb";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { BRAND, getBrandEndorsement, HEALTH_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name}: ${BRAND.tagline}` },
  description: "Clarity reads your blood report and wearable data against your own lab's ranges and gives you one clear next move, with the evidence a tap away.",
};

const FEATURES = [
  { title: "Your lab's ranges, not generic ones", body: "Results are compared only with the range printed on your report. Nothing is invented, and missing data is never treated as normal." },
  { title: "Evidence you can open", body: "Every explanation links to the curated source behind it: MedlinePlus, WHO, NHS and other public health bodies." },
  { title: "System by system", body: "See what your results say about your liver, kidneys, thyroid, blood and more. No scores, no diagnoses." },
  { title: "A plan that adapts", body: "Mark steps done or skip them. Clarity learns what fits your week and stops pushing what doesn't." },
  { title: "Safety first", body: "Anything outside your lab's range is flagged for a professional before any lifestyle tip. Clarity never sets supplement doses." },
  { title: "Your data, your call", body: "Correct a misread value, delete a single file, export everything, or delete it all." },
];

const FAQ = [
  { q: "Is this medical advice?", a: "No. Clarity explains your own data in plain language and suggests a sensible next step. It doesn't diagnose, and it points you to a healthcare professional for anything flagged." },
  { q: "What can I upload?", a: "A digital blood report PDF from your lab, and an Apple Health export (export.xml). Scanned or photographed reports aren't supported yet." },
  { q: "Why does it only use my lab's range?", a: "Labs measure differently, so a range from one lab doesn't apply to another. Using your lab's printed range avoids false alarms and false reassurance." },
  { q: "Will Clarity tell me which supplements to take?", a: "It may point out a category worth discussing, like vitamin D when your result is below range. It never sets a dose: that's for a professional." },
  { q: "Where does the evidence come from?", a: "A curated library of public health sources that were checked page by page, with dates and limitations recorded. The AI can only cite sources it was given." },
  { q: "Is the doctor view real?", a: "No. The reviewer workspace in this demo is simulated and clearly labelled as such." },
];

function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-display text-2xl tracking-tight text-ink">{BRAND.name}</span>
      {getBrandEndorsement() === "by-tafasa" && <span className="text-xs text-ink-faint">by Tafasa</span>}
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="overflow-x-clip bg-canvas">
      {/* Hero: the orb and the promise. */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(110%_80%_at_85%_10%,var(--color-mist)_0%,transparent_60%),radial-gradient(80%_70%_at_0%_100%,var(--color-mint)_0%,transparent_62%)]">
        <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8">
          <header className="flex items-center justify-between">
            <Wordmark />
            <Link href="/app" className="text-sm font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4">
              Open the app
            </Link>
          </header>
          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="order-2 lg:order-1">
              <h1 className="font-display text-5xl leading-[0.98] tracking-tight text-balance text-ink sm:text-6xl">
                Know your numbers.
                <br />
                Know your next move.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
                Clarity reads your blood report and wearable data, compares every result with your own lab&apos;s ranges, and tells you the one thing worth doing
                next.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <ButtonLink href="/app" className="h-12 px-7 text-base">
                  Try Clarity Now
                </ButtonLink>
                <a href="#how-it-works" className="text-sm font-semibold text-ink-soft underline decoration-line underline-offset-4 hover:text-ink">
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-sm text-ink-faint">This demo runs on synthetic data. It isn&apos;t medical advice.</p>
            </div>
            <div className="order-1 flex justify-center lg:order-2">
              <Orb size={260} className="sm:size-[360px] lg:size-[420px]" />
            </div>
          </div>
        </div>
      </section>

      {/* Introduction. */}
      <section className="mx-auto max-w-4xl px-4 py-24 sm:px-8">
        <p className="font-display text-3xl leading-snug text-ink sm:text-4xl">
          Most people get their results as a PDF and a phrase like &ldquo;mostly normal&rdquo;. Clarity turns that into something you can act on, without
          guessing and without diagnosing.
        </p>
      </section>

      <HowItWorks />

      {/* Health intelligence, shown with the real components. */}
      <section aria-labelledby="intel-title" className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 id="intel-title" className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              Health intelligence you can check
            </h2>
            <p className="mt-4 max-w-lg text-lg text-ink-soft">
              Each result shows where it sits in your lab&apos;s own range and how it has moved. Each body system shows what was measured, what changed, and what
              hasn&apos;t been tested yet.
            </p>
          </div>
          <figure className="rounded-[2rem] bg-white p-6 ring-1 ring-line sm:p-8">
            <Badge tone="coral">Sample, synthetic data</Badge>
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <span className="font-semibold text-ink">Ferritin</span>
              <span className="text-xs text-ink-faint">14 Oct 2026</span>
            </div>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-5xl leading-none text-ink">13</span>
              <span className="text-ink-soft">ug/L</span>
            </p>
            <p className="mt-2 text-sm font-medium text-coral-ink">▼ Below your lab&apos;s range (15 – 150)</p>
            <div className="mt-4">
              <RangeRail value={13} low={15} high={150} status="below" label="13 ug/L, below the lab range of 15 to 150" />
            </div>
            <ul className="hairline mt-4 text-sm">
              {[
                ["Blood", "1 result outside range", "#C24E3A"],
                ["Liver", "1 result outside range", "#C24E3A"],
                ["Kidneys", "Nothing outside range", "#0A8F84"],
                ["Thyroid", "Nothing outside range", "#0A8F84"],
              ].map(([name, text, color]) => (
                <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-ink">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
                    {name}
                  </span>
                  <span className="text-ink-soft">{text}</span>
                </li>
              ))}
            </ul>
          </figure>
        </div>
      </section>

      {/* Features. */}
      <section aria-labelledby="features-title" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <h2 id="features-title" className="max-w-2xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            Built to be trusted with your numbers
          </h2>
          <dl className="mt-12 grid gap-x-12 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-t border-line py-6">
                <dt className="font-display text-xl text-ink">{f.title}</dt>
                <dd className="mt-2 text-ink-soft">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Profile preview. */}
      <section aria-labelledby="profile-title" className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="tide rounded-[2rem] p-6 sm:p-8">
            <Badge tone="coral">Sample profile, synthetic</Badge>
            <p className="mt-4 font-display text-3xl text-ink">Alex, 30</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {["More energy in the afternoons", "Sleep more consistently", "Understand my cholesterol"].map((g) => (
                <li key={g}>
                  <Badge tone="lime">{g}</Badge>
                </li>
              ))}
            </ul>
            <ol className="mt-6 space-y-3 border-l border-white/80 pl-5 text-sm">
              <li>
                <span className="block text-ink-faint">14 Oct</span>
                <span className="text-ink">Blood report added: 5 results outside range</span>
              </li>
              <li>
                <span className="block text-ink-faint">15 Oct</span>
                <span className="text-ink">Next move: book a GP appointment to go through flagged results</span>
              </li>
              <li>
                <span className="block text-ink-faint">20 Oct</span>
                <span className="text-ink">Done: fibre-rich lunch swap</span>
              </li>
            </ol>
          </div>
          <div>
            <h2 id="profile-title" className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              One profile that keeps the thread
            </h2>
            <p className="mt-4 max-w-lg text-lg text-ink-soft">
              Your goals, routine, reports and steps live on one timeline, so each new result is read in context, and you can always see where every number
              came from.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ. */}
      <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
        <h2 id="faq-title" className="font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Questions
        </h2>
        <div className="mt-8 border-b border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t border-line py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink marker:hidden">
                {f.q}
                <span aria-hidden className="text-2xl text-teal-ink transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing call to action. */}
      <section className="px-4 pb-16 sm:px-8">
        <div className="tide mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[2rem] p-8 sm:p-14">
          <h2 className="max-w-2xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">See what your numbers are telling you.</h2>
          <ButtonLink href="/app" className="h-12 px-7 text-base">
            Try Clarity Now
          </ButtonLink>
        </div>
        <footer className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <p className="max-w-xl">{HEALTH_DISCLAIMER}</p>
        </footer>
      </section>
    </main>
  );
}
