"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/preferences";

/**
 * Scroll-linked hero orb: as the hero scrolls away, the orb recedes (scales down, drifts, fades)
 * and a smaller orb picks up the thread in "How it works". Desktop only; nothing is hidden before
 * JavaScript runs, and reduced motion leaves it completely still.
 */
export function HeroOrb({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    let cleanup = () => {};
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        gsap.to(el, {
          scale: 0.55,
          yPercent: 28,
          xPercent: -8,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: { trigger: el.closest("section") ?? el, start: "top top", end: "bottom top", scrub: 0.5 },
        });
      });
      cleanup = () => mm.revert();
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reduced]);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}
