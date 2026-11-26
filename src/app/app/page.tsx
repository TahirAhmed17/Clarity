import type { Metadata } from "next";
import { Companion } from "@/components/features/companion";
import { ButtonLink, Card, Orb } from "@/components/ui/primitives";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = { title: "Home" };

const START_OPTIONS = [
  { title: "Start with a symptom", body: "Tell Clarity what you've been noticing.", href: "/app#ask" },
  { title: "Start with a goal", body: "Energy, sleep, cholesterol — pick what matters.", href: "/app/profile" },
  { title: "Upload a blood report", body: "Digital PDF from your lab.", href: "/app/upload" },
  { title: "Upload wearable data", body: "Apple Health export.xml.", href: "/app/upload#wearable" },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col items-center gap-6 pt-2 text-center sm:flex-row sm:text-left">
        <Orb size={128} />
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-teal-ink uppercase">{BRAND.tagline}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink sm:text-4xl">What would you like clarity on today?</h1>
          <p className="mt-2 text-ink-soft">Ask in your own words. You&apos;ll get one clear next move, with the detail one tap away.</p>
        </div>
      </section>

      <div id="ask">
        <Companion />
      </div>

      <section aria-label="Ways to start" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {START_OPTIONS.map((o) => (
          <Card key={o.title} className="flex flex-col gap-2 p-5">
            <h2 className="font-semibold text-ink">{o.title}</h2>
            <p className="flex-1 text-sm text-ink-soft">{o.body}</p>
            <ButtonLink href={o.href} variant="soft" className="h-9 self-start px-4">
              Go
            </ButtonLink>
          </Card>
        ))}
      </section>
    </div>
  );
}
