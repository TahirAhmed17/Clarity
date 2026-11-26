import { ButtonLink, Orb } from "@/components/ui/primitives";
import { BRAND, getBrandEndorsement, HEALTH_DISCLAIMER } from "@/lib/constants";

/** Interim landing page. The full editorial marketing page is M3.9. */
export default function LandingPage() {
  const endorsed = getBrandEndorsement() === "by-tafasa";
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(120%_80%_at_80%_0%,var(--color-mist)_0%,transparent_55%),radial-gradient(90%_70%_at_0%_100%,var(--color-mint)_0%,transparent_60%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8">
        <header className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl tracking-tight">{BRAND.name}</span>
          {endorsed && <span className="text-xs text-ink-faint">by Tafasa</span>}
        </header>
        <section className="flex flex-1 flex-col-reverse items-center justify-center gap-10 py-12 text-center lg:flex-row lg:text-left">
          <div className="max-w-xl">
            <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-ink sm:text-6xl">{BRAND.tagline}</h1>
            <p className="mt-5 text-lg text-ink-soft">
              Clarity turns your blood reports, wearable data, symptoms and goals into one clear next move — with the evidence a tap away.
            </p>
            <div className="mt-8 flex justify-center gap-3 lg:justify-start">
              <ButtonLink href="/app">Try Clarity Now</ButtonLink>
            </div>
            <p className="mt-8 text-xs text-ink-faint">{HEALTH_DISCLAIMER}</p>
          </div>
          <Orb size={280} className="sm:size-[340px]" />
        </section>
      </div>
    </main>
  );
}
