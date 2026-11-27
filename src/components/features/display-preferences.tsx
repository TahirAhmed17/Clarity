"use client";

import { setPreferences, usePreferences } from "@/lib/preferences";

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-sm text-ink-soft">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-[var(--color-chart-mark)]" />
    </label>
  );
}

/** Per-device display settings (stored in this browser only). */
export function DisplayPreferences() {
  const p = usePreferences();
  return (
    <div className="hairline">
      <Toggle label="Reduce motion" hint="Stops animation, including the orb. Your device setting is respected too." checked={p.reduceMotion} onChange={(v) => setPreferences({ reduceMotion: v })} />
      <Toggle label="3D visuals" hint="The 3D orb and body map. Turn off for a lighter 2D version on slower devices." checked={p.visuals3d} onChange={(v) => setPreferences({ visuals3d: v })} />
    </div>
  );
}
