import sax from "sax";
import type { NewWearableMetric, WearableMetricType } from "@/lib/domain";
import { IngestionError } from "../errors";

/**
 * Streaming parser for Apple Health `export.xml`.
 * - Streams with sax (constant memory per record; no DOM, no external entity resolution).
 * - Keeps only daily aggregates of a small, explicit set of record types.
 * - De-duplicates overlapping sources (e.g. iPhone + Watch both counting steps) heuristically:
 *   for summed metrics, the source with the highest daily total is used, not the sum of all sources.
 */

type Agg = "sum" | "avg" | "min" | "max";

interface TypeSpec {
  metric: WearableMetricType;
  unit: NewWearableMetric["unit"];
  /** Converts the record's value from its reported unit; returns null for unsupported units. */
  convert: (value: number, unit: string) => number | null;
  aggregations: Agg[];
}

const identity = (allowed: string[]) => (v: number, u: string) => (allowed.includes(u) ? v : null);

const QUANTITY_TYPES: Record<string, TypeSpec> = {
  HKQuantityTypeIdentifierStepCount: { metric: "steps", unit: "count", convert: identity(["count"]), aggregations: ["sum"] },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric: "active_energy",
    unit: "kcal",
    convert: (v, u) => (u === "kcal" || u === "Cal" ? v : u === "kJ" ? v / 4.184 : null),
    aggregations: ["sum"],
  },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: "resting_heart_rate", unit: "bpm", convert: identity(["count/min"]), aggregations: ["avg"] },
  HKQuantityTypeIdentifierHeartRate: { metric: "heart_rate", unit: "bpm", convert: identity(["count/min"]), aggregations: ["avg", "min", "max"] },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { metric: "hrv_sdnn", unit: "ms", convert: identity(["ms"]), aggregations: ["avg"] },
};

const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const ASLEEP_VALUES = new Set([
  "HKCategoryValueSleepAnalysisAsleep",
  "HKCategoryValueSleepAnalysisAsleepUnspecified",
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
]);

const DATE_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/;

function parseAppleDate(s: string | undefined): { day: string; ms: number } | null {
  const m = s?.match(DATE_RE);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
  if (Number.isNaN(ms)) return null;
  // Day is the local calendar day as recorded by the device.
  return { day: m[1], ms };
}

interface Bucket {
  sum: number;
  count: number;
  min: number;
  max: number;
}

export interface AppleHealthParseResult {
  metrics: NewWearableMetric[];
  summary: {
    recordsSeen: number;
    recordsUsed: number;
    skippedUnsupportedType: Record<string, number>;
    skippedInvalid: number;
    skippedUnsupportedUnit: number;
    firstDay: string | null;
    lastDay: string | null;
    sources: string[];
  };
  warnings: string[];
}

export async function parseAppleHealthXml(input: Uint8Array | AsyncIterable<Uint8Array>): Promise<AppleHealthParseResult> {
  const parser = sax.parser(true, { trim: false, normalize: false });
  // key: metric|day|source → bucket
  const buckets = new Map<string, Bucket>();
  const sources = new Set<string>();
  const skippedUnsupportedType: Record<string, number> = {};
  let recordsSeen = 0;
  let recordsUsed = 0;
  let skippedInvalid = 0;
  let skippedUnsupportedUnit = 0;
  let rootChecked = false;
  let parseError: Error | null = null;

  const add = (metric: WearableMetricType, day: string, source: string, value: number) => {
    const key = `${metric}|${day}|${source}`;
    const b = buckets.get(key) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
    b.sum += value;
    b.count += 1;
    b.min = Math.min(b.min, value);
    b.max = Math.max(b.max, value);
    buckets.set(key, b);
  };

  parser.onerror = (err) => {
    parseError = err;
  };

  parser.onopentag = (node) => {
    if (!rootChecked) {
      rootChecked = true;
      if (node.name !== "HealthData") {
        parseError = new IngestionError("xml_not_apple_health", "This XML file isn't an Apple Health export (expected a HealthData root element).");
      }
      return;
    }
    if (node.name !== "Record") return;
    recordsSeen++;
    const a = node.attributes as Record<string, string>;
    const type = a.type ?? "";
    const source = a.sourceName || "Unknown source";

    if (type === SLEEP_TYPE) {
      if (!ASLEEP_VALUES.has(a.value)) return; // InBed / Awake are intentionally excluded
      const start = parseAppleDate(a.startDate);
      const end = parseAppleDate(a.endDate);
      if (!start || !end || end.ms < start.ms) {
        skippedInvalid++;
        return;
      }
      const minutes = (end.ms - start.ms) / 60000;
      if (minutes > 24 * 60) {
        skippedInvalid++;
        return;
      }
      sources.add(source);
      add("sleep_asleep", end.day, source, minutes);
      recordsUsed++;
      return;
    }

    const spec = QUANTITY_TYPES[type];
    if (!spec) {
      skippedUnsupportedType[type || "(missing type)"] = (skippedUnsupportedType[type || "(missing type)"] ?? 0) + 1;
      return;
    }
    const start = parseAppleDate(a.startDate);
    const raw = Number(a.value);
    if (!start || !Number.isFinite(raw) || raw < 0) {
      skippedInvalid++;
      return;
    }
    const value = spec.convert(raw, a.unit ?? "");
    if (value === null) {
      skippedUnsupportedUnit++;
      return;
    }
    sources.add(source);
    add(spec.metric, start.day, source, value);
    recordsUsed++;
  };

  const decoder = new TextDecoder("utf-8");
  const feed = (chunk: Uint8Array) => {
    if (parseError) return;
    parser.write(decoder.decode(chunk, { stream: true }));
  };

  try {
    if (input instanceof Uint8Array) feed(input);
    else for await (const chunk of input) {
      feed(chunk);
      if (parseError) break;
    }
    if (!parseError) parser.write(decoder.decode()).close();
  } catch (e) {
    parseError ??= e as Error;
  }

  if (parseError) {
    if (parseError instanceof IngestionError) throw parseError;
    throw new IngestionError("xml_malformed", "This XML file is malformed or incomplete, so it couldn't be read.");
  }
  if (!rootChecked) throw new IngestionError("xml_malformed", "This XML file has no content.");

  // Resolve per-source buckets into one daily value per metric/aggregation.
  const byMetricDay = new Map<string, { source: string; b: Bucket }[]>();
  for (const [key, b] of buckets) {
    const [metric, day, source] = key.split("|");
    const k = `${metric}|${day}`;
    const list = byMetricDay.get(k) ?? [];
    list.push({ source, b });
    byMetricDay.set(k, list);
  }

  const specByMetric = new Map<WearableMetricType, { unit: NewWearableMetric["unit"]; aggregations: Agg[] }>([
    ...Object.values(QUANTITY_TYPES).map((s) => [s.metric, s] as const),
    ["sleep_asleep", { unit: "min", aggregations: ["sum"] }],
  ]);

  const metrics: NewWearableMetric[] = [];
  const days: string[] = [];
  for (const [k, list] of byMetricDay) {
    const [metricStr, day] = k.split("|");
    const metric = metricStr as WearableMetricType;
    const spec = specByMetric.get(metric)!;
    days.push(day);
    for (const agg of spec.aggregations) {
      let value: number;
      let sampleCount: number;
      let sourceName: string;
      if (agg === "sum") {
        const best = list.reduce((x, y) => (y.b.sum > x.b.sum ? y : x));
        value = best.b.sum;
        sampleCount = best.b.count;
        sourceName = best.source;
      } else {
        const total = list.reduce((n, x) => n + x.b.count, 0);
        sampleCount = total;
        sourceName = list.map((x) => x.source).sort().join(", ");
        value =
          agg === "avg"
            ? list.reduce((n, x) => n + x.b.sum, 0) / total
            : agg === "min"
              ? Math.min(...list.map((x) => x.b.min))
              : Math.max(...list.map((x) => x.b.max));
      }
      metrics.push({
        documentId: null,
        metricType: metric,
        value: Math.round(value * 10) / 10,
        unit: spec.unit,
        aggregation: agg,
        day,
        sampleCount,
        sourceFormat: "apple_health_xml",
        sourceName,
      });
    }
  }

  metrics.sort((a, b) => a.day.localeCompare(b.day) || a.metricType.localeCompare(b.metricType));
  days.sort();

  const warnings: string[] = [];
  if (skippedInvalid > 0) warnings.push(`${skippedInvalid} records had invalid dates or values and were skipped.`);
  if (skippedUnsupportedUnit > 0) warnings.push(`${skippedUnsupportedUnit} records used units we don't convert yet and were skipped.`);
  const multiSource = [...byMetricDay.values()].some((l) => l.length > 1);
  if (multiSource) {
    warnings.push("Several devices reported the same metric on some days. For totals (steps, energy, sleep) we used the device with the highest daily total to avoid double counting.");
  }

  if (metrics.length === 0) {
    throw new IngestionError("no_supported_records", "We didn't find any supported records (steps, heart rate, HRV, active energy or sleep) in this export.");
  }

  return {
    metrics,
    summary: {
      recordsSeen,
      recordsUsed,
      skippedUnsupportedType,
      skippedInvalid,
      skippedUnsupportedUnit,
      firstDay: days[0] ?? null,
      lastDay: days[days.length - 1] ?? null,
      sources: [...sources].sort(),
    },
    warnings,
  };
}
