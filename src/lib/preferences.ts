"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Per-viewer display preferences (a convenience, so browser storage is appropriate).
 * Every read/write is guarded: storage can be unavailable (private mode, blocked site data).
 */
export interface DisplayPreferences {
  /** Calmer visuals: no animation, static orb. Combined with the OS prefers-reduced-motion. */
  reduceMotion: boolean;
  /** Allow WebGL 3D (orb, body map). Off = lightweight 2D versions. */
  visuals3d: boolean;
}

const KEY = "clarity:display-preferences";
const DEFAULTS: DisplayPreferences = { reduceMotion: false, visuals3d: true };
const listeners = new Set<() => void>();
let cache: DisplayPreferences | null = null;

function read(): DisplayPreferences {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplayPreferences>) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function setPreferences(patch: Partial<DisplayPreferences>) {
  cache = { ...read(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* preference still applies for this page view */
  }
  applyToDocument(cache);
  listeners.forEach((l) => l());
}

export function applyToDocument(p: DisplayPreferences) {
  document.documentElement.dataset.reduceMotion = String(p.reduceMotion);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePreferences(): DisplayPreferences {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True if the OS asks for reduced motion OR the viewer turned it on in Clarity. */
export function useReducedMotion(): boolean {
  const os = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const prefs = usePreferences();
  return os || prefs.reduceMotion;
}

let webgl: boolean | null = null;
/** Detects a usable WebGL context once per page. */
export function canUseWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    const ctx = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    webgl = !!ctx;
    // Release the probe context immediately — browsers cap live WebGL contexts.
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Whether 3D should render: WebGL available, 3D allowed, motion not reduced. */
export function useCan3D(): boolean {
  const prefs = usePreferences();
  const reduced = useReducedMotion();
  // Server render and hydration always start with the lightweight CSS orb; WebGL is probed once
  // mounted. (A server/client snapshot split via useSyncExternalStore did not reliably re-check.)
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe after mount
    setSupported(canUseWebGL());
  }, []);
  return supported && prefs.visuals3d && !reduced;
}
