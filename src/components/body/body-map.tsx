"use client";

import dynamic from "next/dynamic";
import type { SystemId } from "@/data/evidence/catalogue";
import { cn } from "@/lib/cn";
import { useCan3D, useReducedMotion } from "@/lib/preferences";
import { BODY_POINTS, markerTone, TONE_COLOR, type BodySystemState } from "./body-points";

const BodyCanvas = dynamic(() => import("./body-canvas"), { ssr: false, loading: () => null });

/** 2D fallback: same markers on a simple front silhouette. Markers are real buttons. */
function FlatBody({ systems, selected, onSelect }: { systems: BodySystemState[]; selected: SystemId; onSelect: (id: SystemId) => void }) {
  return (
    <svg viewBox="0 0 200 440" className="h-full w-full" role="group" aria-label="Body map">
      <g fill="#dcebea" stroke="#c4dcda" strokeWidth={1.5}>
        <circle cx={100} cy={48} r={26} />
        <rect x={91} y={72} width={18} height={20} rx={8} />
        <path d="M58 100 Q100 88 142 100 L150 205 Q100 222 50 205 Z" />
        <path d="M54 210 Q100 228 146 210 L140 250 Q100 262 60 250 Z" />
        <path d="M56 104 L40 205 L34 268 L46 270 L56 210 L66 120 Z" />
        <path d="M144 104 L160 205 L166 268 L154 270 L144 210 L134 120 Z" />
        <path d="M64 250 L74 420 L92 420 L98 258 Z" />
        <path d="M136 250 L126 420 L108 420 L102 258 Z" />
      </g>
      {systems.map((s) => {
        const [x, y] = BODY_POINTS[s.id].p2;
        const color = TONE_COLOR[markerTone(s)];
        const pts = s.id === "kidneys" ? [x, 200 - x] : [x];
        return (
          <g key={s.id}>
            {pts.map((px) => (
              <circle key={px} cx={px} cy={y} r={selected === s.id ? 9 : 6.5} fill={color} stroke="white" strokeWidth={2.5} className="cursor-pointer" onClick={() => onSelect(s.id)}>
                <title>{BODY_POINTS[s.id].label}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function BodyMap({ systems, selected, onSelect }: { systems: BodySystemState[]; selected: SystemId; onSelect: (id: SystemId) => void }) {
  const can3d = useCan3D();
  const reduced = useReducedMotion();
  return (
    <div className="relative">
      <div className="tide relative aspect-[3/4] w-full overflow-hidden rounded-[2rem]">
        {can3d ? <BodyCanvas systems={systems} selected={selected} onSelect={onSelect} animate={!reduced} /> : <FlatBody systems={systems} selected={selected} onSelect={onSelect} />}
      </div>
      <p className="mt-2 text-xs text-ink-faint">{can3d ? "Drag to turn the figure. " : ""}A stylised map: positions are approximate, not anatomical.</p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Choose a body system">
        {systems.map((s) => {
          const tone = markerTone(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={selected === s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors",
                  selected === s.id ? "bg-ink text-white ring-ink" : "bg-white text-ink-soft ring-line hover:text-ink",
                )}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: TONE_COLOR[tone] }} />
                {s.name}
                <span className="sr-only">
                  {tone === "alert" ? `, ${s.outsideRangeCount} outside range` : tone === "none" ? ", no data" : ", measured"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
