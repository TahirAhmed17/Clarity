"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCan3D } from "@/lib/preferences";

export type OrbState = "idle" | "listening" | "thinking" | "answering" | "alert";

function CssOrb({ size, state, className }: { size: number; state: OrbState; className?: string }) {
  return <div aria-hidden data-state={state} className={cn("orb shrink-0", className)} style={{ width: size, height: size }} />;
}

// Three.js is only downloaded when the 3D orb is actually shown.
const OrbCanvas = dynamic(() => import("./orb-canvas"), { ssr: false, loading: () => null });

/**
 * Clarity's signature orb. WebGL shader orb when available and allowed; otherwise the CSS gradient
 * orb (no WebGL, 3D turned off, or reduced motion). Both reflect the same five states.
 */
export function Orb({ size = 160, state = "idle", className }: { size?: number; state?: OrbState; className?: string }) {
  const can3d = useCan3D();
  const [ready, setReady] = useState(false);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} data-orb-mode={can3d ? "webgl" : "css"}>
      {/* The CSS orb sits underneath, so there's never an empty gap while three.js loads. */}
      <CssOrb size={size} state={state} className={cn("absolute inset-0 transition-opacity duration-700", can3d && ready && "opacity-0")} />
      {can3d && (
        <div className="absolute -inset-[12%]">
          <OrbCanvas state={state} onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  );
}
