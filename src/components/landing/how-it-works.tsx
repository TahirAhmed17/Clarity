"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/preferences";

const STEPS = [
  {
    title: "Add what you have",
    body: "A blood report PDF, an Apple Health export, or just a sentence about how you've been feeling. Start anywhere.",
  },
  {
    title: "Clarity does the reading",
    body: "Every result is checked against the range your own lab printed, tracked over time, and matched with curated sources from MedlinePlus, WHO and the NHS.",
  },
  {
    title: "You get one next move",
    body: "Not a list of twenty tips. One clear step, why it was chosen, the evidence behind it, and what's still missing. Anything outside range goes to a professional first.",
  },
];

/**
 * The landing page's single orchestrated motion moment: on large screens the section pins and
 * the three steps come forward in turn as you scroll. Static on small screens and with reduced motion.
 */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    let cleanup = () => {};
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]", root.current);
        const handoff = root.current!.querySelector<HTMLElement>("[data-handoff-orb]");
        const orbStates = ["listening", "thinking", "answering"];
        gsap.set(steps, { opacity: 0.25 });
        gsap.set(steps[0], { opacity: 1 });
        // The hand-off orb grows in as the hero orb recedes above.
        if (handoff) {
          gsap.fromTo(
            handoff,
            { scale: 0.4, opacity: 0 },
            { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 85%", end: "top top", scrub: 0.5 } },
          );
        }
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=1400",
            scrub: 0.6,
            pin: true,
            // The orb mirrors the active step (scrolling back up works too).
            onUpdate: (self) => {
              if (!handoff) return;
              const i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
              handoff.dataset.state = orbStates[i] ?? "idle";
            },
          },
        });
        steps.forEach((el, i) => {
          if (i === 0) return;
          tl.to(steps[i - 1], { opacity: 0.25, duration: 0.5 }, i).to(el, { opacity: 1, duration: 0.5 }, i);
        });
        tl.to("[data-progress]", { scaleY: 1, ease: "none", duration: steps.length }, 0);
      });
      cleanup = () => mm.revert();
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reduced]);

  return (
    <section ref={root} id="how-it-works" aria-labelledby="how-title" className="relative flex min-h-dvh items-center py-20">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 id="how-title" className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            How it works
          </h2>
          <p className="mt-4 max-w-sm text-lg text-ink-soft">Three steps. The complicated part happens in the middle, out of your way.</p>
          {/* Lightweight CSS orb (no second WebGL context); its state follows the active step. */}
          <div aria-hidden data-handoff-orb data-state="listening" className="orb mt-10 hidden size-28 lg:block" />
        </div>
        <ol className="relative space-y-10 pl-10">
          <span aria-hidden className="absolute top-2 bottom-2 left-3 w-px bg-line" />
          <span aria-hidden data-progress className={cn("absolute top-2 bottom-2 left-3 w-px origin-top bg-[var(--color-chart-mark)]", reduced ? "scale-y-100" : "scale-y-0 lg:scale-y-0 max-lg:scale-y-100")} />
          {STEPS.map((s, i) => (
            <li key={s.title} data-step className="relative">
              <span aria-hidden className="absolute top-0.5 -left-10 flex size-7 items-center justify-center rounded-full bg-white font-display text-sm text-teal-ink ring-1 ring-line">
                {i + 1}
              </span>
              <h3 className="font-display text-2xl text-ink sm:text-3xl">{s.title}</h3>
              <p className="mt-2 max-w-lg text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
