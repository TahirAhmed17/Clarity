import type { SystemId } from "@/data/evidence/catalogue";

/**
 * Approximate marker positions on a stylised figure (not anatomically exact).
 * 3D: x right(+)/left(-) from the figure's perspective viewer-facing, y up, z forward.
 * 2D: percentage coordinates on the front silhouette (viewBox 0 0 200 440).
 */
export const BODY_POINTS: Record<SystemId, { label: string; p3: [number, number, number]; p2: [number, number] }> = {
  thyroid: { label: "Thyroid", p3: [0, 1.52, 0.12], p2: [100, 92] },
  cardiovascular: { label: "Heart and circulation", p3: [0.13, 1.18, 0.16], p2: [112, 140] },
  liver: { label: "Liver", p3: [-0.17, 0.98, 0.13], p2: [84, 170] },
  metabolic: { label: "Metabolic (blood sugar)", p3: [0.08, 0.9, 0.12], p2: [108, 188] },
  kidneys: { label: "Kidneys", p3: [0.12, 0.84, -0.1], p2: [118, 202] },
  blood: { label: "Blood", p3: [-0.42, 1.0, 0.04], p2: [48, 196] },
};

export interface BodySystemState {
  id: SystemId;
  name: string;
  outsideRangeCount: number;
  dataState: "none" | "partial" | "complete";
}

export function markerTone(s: BodySystemState): "alert" | "measured" | "none" {
  if (s.dataState === "none") return "none";
  return s.outsideRangeCount > 0 ? "alert" : "measured";
}

export const TONE_COLOR = { alert: "#C24E3A", measured: "#0A8F84", none: "#A9B3B5" } as const;
