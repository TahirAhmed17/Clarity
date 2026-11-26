import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BottomNav, SideNav } from "@/components/shell/nav";
import { StatusChip } from "@/components/shell/status-chip";
import { Disclaimer, SyntheticBadge } from "@/components/ui/primitives";
import { BRAND, getBrandEndorsement } from "@/lib/constants";

function Wordmark() {
  const endorsed = getBrandEndorsement() === "by-tafasa";
  return (
    <Link href="/app" className="flex items-baseline gap-1.5">
      <span className="font-display text-2xl tracking-tight text-ink">{BRAND.name}</span>
      {endorsed && <span className="text-xs text-ink-faint">by Tafasa</span>}
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-white/60 px-4 py-6 lg:flex">
        <div className="px-3">
          <Wordmark />
        </div>
        <SideNav />
        <div className="mt-auto px-3">
          <Disclaimer />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur sm:px-8">
          <div className="lg:hidden">
            <Wordmark />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SyntheticBadge />
            <Suspense fallback={null}>
              <StatusChip />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pb-12">{children}</main>

        <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
