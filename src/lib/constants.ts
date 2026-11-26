/** Shared, isomorphic constants. Safe to import from client and server. */

export const HEALTH_DISCLAIMER =
  "General wellness information, not medical advice. See a healthcare professional for anything flagged.";

export const BRAND = {
  name: "Clarity",
  tagline: "Know your numbers. Know your next move.",
} as const;

/**
 * Tafasa relationship is configurable and public (rendered in UI).
 * none        → Clarity stands alone
 * by-tafasa   → "Clarity by Tafasa"
 */
export type BrandEndorsement = "none" | "by-tafasa";

export function getBrandEndorsement(): BrandEndorsement {
  return process.env.NEXT_PUBLIC_BRAND_ENDORSEMENT === "by-tafasa" ? "by-tafasa" : "none";
}

/** Data provenance — every record shown to the user carries one of these. */
export const PROVENANCE = {
  user_provided: "You told us",
  extracted: "Extracted from your file",
  calculated: "Calculated",
  ai_interpretation: "AI interpretation",
  professional_review: "Professional review",
  simulated_review: "Simulated review",
  synthetic: "Synthetic demo data",
} as const;

export type Provenance = keyof typeof PROVENANCE;
