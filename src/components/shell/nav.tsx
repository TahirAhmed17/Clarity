"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: string; mobile?: boolean };

/** Icon paths are simple 24px strokes (no icon library dependency). */
export const NAV_ITEMS: Item[] = [
  { href: "/app", label: "Home", icon: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10", mobile: true },
  { href: "/app/insights", label: "Insights", icon: "M4 19V9m5.3 10V5m5.4 14v-7M20 19v-4", mobile: true },
  { href: "/app/body", label: "Body", icon: "M12 4.5a2 2 0 1 0 0 .01M8 9h8l-1 5h-2l-.5 6h-1L11 14H9z", mobile: true },
  { href: "/app/plan", label: "Plan", icon: "M5 5h14v15H5zM9 3v4m6-4v4M8.5 12l2 2 4-4", mobile: true },
  { href: "/app/discover", label: "Discover", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5-2 5-5 2 2-5z", mobile: true },
  { href: "/app/timeline", label: "Timeline", icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" },
  { href: "/app/profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/app" ? path === "/app" : path === href || path.startsWith(`${href}/`));
}

export function SideNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-mint-soft hover:text-ink",
            isActive(item.href) && "bg-ink text-white hover:bg-ink hover:text-white",
          )}
        >
          <Icon d={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {NAV_ITEMS.filter((i) => i.mobile).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-faint", isActive(item.href) && "text-teal-ink")}
        >
          <Icon d={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
