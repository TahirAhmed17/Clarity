import type { NewWearableMetric } from "@/lib/domain";

/**
 * Registry for wearable CSV adapters.
 *
 * Policy: an adapter is only registered once its export format has been verified against
 * a real, documented export from that vendor (column names, units, timezone handling).
 * As of M1 NO CSV format has been verified, so the registry is intentionally empty and
 * the app does not claim CSV support. Apple Health export.xml is handled separately.
 */
export interface WearableCsvAdapter {
  id: string;
  vendor: string;
  /** Reference to the documentation/sample the format was verified against. */
  verifiedAgainst: string;
  detect(headerRow: string[]): boolean;
  parse(csv: string): NewWearableMetric[];
}

export const wearableCsvAdapters: WearableCsvAdapter[] = [];

export function findCsvAdapter(headerRow: string[]) {
  return wearableCsvAdapters.find((a) => a.detect(headerRow)) ?? null;
}
