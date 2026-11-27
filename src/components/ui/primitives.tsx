import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HEALTH_DISCLAIMER, PROVENANCE, type Provenance } from "@/lib/constants";
import type { RangeStatus } from "@/lib/domain";

/* ---------------- Button ---------------- */

const buttonVariants = {
  primary: "bg-ink text-white hover:bg-ink/90",
  secondary: "bg-white text-ink ring-1 ring-line hover:ring-teal-ink/40",
  soft: "bg-mint-soft text-teal-ink hover:bg-mint",
  danger: "bg-coral-soft text-coral-ink hover:bg-peach/70",
} as const;

type ButtonVariant = keyof typeof buttonVariants;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/* ---------------- Card ---------------- */

/**
 * Cards are for discrete objects (a biomarker, an event). Use `raised` only for the one thing that
 * should lift off the page; everything else stays flat on a hairline.
 */
export function Card({ className, raised = false, ...props }: ComponentProps<"section"> & { raised?: boolean }) {
  return (
    <section
      className={cn("rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-line sm:p-6", raised && "shadow-[var(--shadow-soft)] ring-line/60", className)}
      {...props}
    />
  );
}

/** Open, full-bleed panel on the organic "tide" gradient — reserved for the next move. */
export function TidePanel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("tide relative overflow-hidden rounded-[2rem] p-6 sm:p-10", className)} {...props} />;
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-4">
      {eyebrow && <p className="mb-1 text-sm font-medium text-teal-ink">{eyebrow}</p>}
      <h2 className="font-display text-xl text-ink sm:text-2xl">{title}</h2>
      {children && <p className="mt-1 text-sm text-ink-soft">{children}</p>}
    </header>
  );
}

/* ---------------- Badges ---------------- */

const badgeTones = {
  neutral: "bg-stone text-stone-ink",
  teal: "bg-mint-soft text-teal-ink",
  lime: "bg-lime/25 text-lime-ink",
  coral: "bg-coral-soft text-coral-ink",
  mist: "bg-mist-soft text-teal-ink",
} as const;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", badgeTones[tone], className)}
      {...props}
    />
  );
}

/**
 * Range status vs the LAB's supplied range. Missing/unknown is neutral stone — never green —
 * so absence of data is not presented as "normal".
 */
export function RangeBadge({ status }: { status: RangeStatus }) {
  const map: Record<RangeStatus, { tone: keyof typeof badgeTones; label: string }> = {
    above: { tone: "coral", label: "Above lab range" },
    below: { tone: "coral", label: "Below lab range" },
    within: { tone: "teal", label: "Within lab range" },
    no_range: { tone: "neutral", label: "No range given" },
    not_numeric: { tone: "neutral", label: "Not compared" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function ProvenanceTag({ kind }: { kind: Provenance }) {
  const tone = kind === "ai_interpretation" ? "mist" : kind === "synthetic" || kind === "simulated_review" ? "coral" : "neutral";
  return (
    <Badge tone={tone} title="Where this information came from">
      {PROVENANCE[kind]}
    </Badge>
  );
}

export function SyntheticBadge() {
  return <Badge tone="coral">Synthetic demo data</Badge>;
}

/* ---------------- Disclaimer & states ---------------- */

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-ink-faint", className)}>{HEALTH_DISCLAIMER}</p>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-sage/70 bg-mint-soft/40 p-6 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-ink-soft">{children}</p>}
      </div>
      {aside}
    </div>
  );
}
