import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { latestReport } from "@/data/synthetic/dataset";
import { parseAppleHealthXml } from "@/server/ingestion/apple-health/parse";
import { IngestionError } from "@/server/ingestion/errors";
import { extractPdfLines } from "@/server/ingestion/pdf/extract-lines";
import { parseLabReport, parseUnambiguousDate } from "@/server/ingestion/pdf/parse-biomarkers";
import { ingestAppleHealthExport, ingestBloodReport } from "@/server/ingestion/service";
import { sanitizeFilename, validateUpload } from "@/server/ingestion/validation";
import { SeedRepository } from "@/server/data/seed-repository";
import { DEMO_PROFILE_ID } from "@/data/synthetic/dataset";

const sample = (p: string) => new Uint8Array(readFileSync(`samples/${p}`));
const MB = 1024 * 1024;

describe("upload validation", () => {
  it("accepts a real PDF", () => {
    const v = validateUpload({ name: "r.pdf", type: "application/pdf", bytes: sample("synthetic-blood-report.pdf") }, "blood_report_pdf", 10 * MB);
    expect(v.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects text renamed to .pdf (magic bytes)", () => {
    expect(() =>
      validateUpload({ name: "x.pdf", type: "application/pdf", bytes: sample("invalid/not-a-pdf.pdf") }, "blood_report_pdf", 10 * MB),
    ).toThrow(expect.objectContaining({ code: "content_mismatch" }));
  });
  it("rejects wrong extension, empty and oversized files", () => {
    const pdf = sample("synthetic-blood-report.pdf");
    expect(() => validateUpload({ name: "x.exe", type: "application/pdf", bytes: pdf }, "blood_report_pdf", 10 * MB)).toThrow(
      expect.objectContaining({ code: "unsupported_type" }),
    );
    expect(() => validateUpload({ name: "x.pdf", type: "application/pdf", bytes: new Uint8Array() }, "blood_report_pdf", 10 * MB)).toThrow(
      expect.objectContaining({ code: "empty_file" }),
    );
    expect(() => validateUpload({ name: "x.pdf", type: "application/pdf", bytes: pdf }, "blood_report_pdf", 100)).toThrow(
      expect.objectContaining({ code: "file_too_large", status: 413 }),
    );
  });
  it("strips paths and control characters from filenames", () => {
    expect(sanitizeFilename("..\\..\\etc/pass\u0000wd.pdf")).toBe("passwd.pdf");
  });
});

describe("PDF biomarker extraction", () => {
  it("extracts every line of the synthetic report with original values, units and ranges", async () => {
    const ex = await extractPdfLines(sample("synthetic-blood-report.pdf"));
    const parsed = parseLabReport(ex.pages);
    expect(parsed.collectedOn).toBe(latestReport.collectedOn);
    expect(parsed.biomarkers).toHaveLength(latestReport.lines.length);
    for (const line of latestReport.lines) {
      const b = parsed.biomarkers.find((x) => x.nameAsReported === line.name);
      expect(b, line.name).toBeDefined();
      expect(b!.code).toBe(line.code);
      expect(b!.valueText).toBe(line.value);
      expect(b!.unitAsReported).toBe(line.unit);
      expect(b!.refText).toBe(line.ref);
      expect(b!.flagAsReported).toBe(line.flag ?? null);
    }
    const egfr = parsed.biomarkers.find((b) => b.code === "EGFR")!;
    expect(egfr.valueNumeric).toBeNull(); // ">90" is qualified, not an exact number
    const ldl = parsed.biomarkers.find((b) => b.code === "LDL")!;
    expect(ldl).toMatchObject({ valueNumeric: 3.5, refLow: null, refHigh: 3 });
  });

  it("flags report/range inconsistencies and ambiguous dates without guessing", () => {
    const parsed = parseLabReport([
      { pageNumber: 1, lines: ["Collected: 03/04/2026", "ALT\t30\tU/L\t7 - 35\tH", "Mystery Marker\t5\tqq\tnormal"] },
    ]);
    expect(parsed.collectedOn).toBeNull();
    expect(parsed.warnings.join(" ")).toMatch(/ambiguous/);
    expect(parsed.warnings.join(" ")).toMatch(/flagged high .* within/);
    const mystery = parsed.biomarkers.find((b) => b.nameAsReported === "Mystery Marker");
    expect(mystery?.code).toBeNull();
    expect(mystery?.refLow).toBeNull();
  });

  it("handles common real-world layouts (synthetic values): thousands, unit+range runs, labelled ranges, microscopy, month-name dates", () => {
    const parsed = parseLabReport([
      {
        pageNumber: 1,
        lines: [
          "Sample Collected On : 03/Sep/2026 09:15AM",
          "Total Leucocyte Count(TLC)\t7,450\tCells/cmm 4000 - 11000",
          "C- Reactive Protein\t2.10\tmg/L\t0 - 5",
          "Non-HDL Cholesterol\t118\tmg/dL\t< 130 Optimal",
          "ALT (SGPT)\t28\tU/L\t0 - 45",
          "Vitamin B - 12 Level\t402\tpg/mL\t187 - 883",
          "Platelet Count\t2.4\tLakhs/cmm\t1.5 - 4.5",
          "Uric Acid\t5.1\tmg/dL\t3.7 - 7.7",
          "Uric Acid\t2-3\t/HPF",
          "Hemoglobin\t14,2\tg/dL\t13,5 - 18,0",
        ],
      },
    ]);
    const by = (n: string) => parsed.biomarkers.find((b) => b.nameAsReported === n)!;
    expect(parsed.collectedOn).toBe("2026-09-03");
    expect(by("Total Leucocyte Count(TLC)")).toMatchObject({ code: "WBC", valueText: "7,450", valueNumeric: 7450, unitAsReported: "Cells/cmm", refLow: 4000, refHigh: 11000 });
    expect(parsed.warnings.join(" ")).toMatch(/thousands separator/);
    expect(by("C- Reactive Protein").code).toBe("CRP");
    expect(by("Non-HDL Cholesterol")).toMatchObject({ code: "NON_HDL", unitAsReported: "mg/dL", refText: "< 130 Optimal", refLow: null, refHigh: null });
    expect(by("ALT (SGPT)").code).toBe("ALT");
    expect(by("Vitamin B - 12 Level").code).toBe("B12");
    expect(by("Hemoglobin")).toMatchObject({ valueNumeric: 14.2, refLow: 13.5, refHigh: 18 }); // decimal comma
    const uric = parsed.biomarkers.filter((b) => b.nameAsReported === "Uric Acid");
    expect(uric.find((b) => b.unitAsReported === "mg/dL")?.code).toBe("URIC_ACID");
    expect(uric.find((b) => b.unitAsReported === "/HPF")?.code ?? null).toBeNull();
  });

  it("parses only unambiguous dates", () => {
    expect(parseUnambiguousDate("25 November 2026").iso).toBe("2026-11-25");
    expect(parseUnambiguousDate("Nov 5, 2026").iso).toBe("2026-11-05");
    expect(parseUnambiguousDate("2026-11-05 10:00").iso).toBe("2026-11-05");
    expect(parseUnambiguousDate("05/11/2026")).toEqual({ iso: null, ambiguous: "05/11/2026" });
  });

  it("parses space-separated rows", () => {
    const parsed = parseLabReport([{ pageNumber: 1, lines: ["Ferritin 13 ug/L 15 - 150 L"] }]);
    expect(parsed.biomarkers[0]).toMatchObject({ code: "FERRITIN", valueNumeric: 13, refLow: 15, refHigh: 150, flagAsReported: "L" });
  });

  it("rejects a scanned PDF with no text layer with a clear error", async () => {
    const repo = new SeedRepository();
    await expect(
      ingestBloodReport(DEMO_PROFILE_ID, { name: "scan.pdf", type: "application/pdf", bytes: sample("invalid/scanned-no-text.pdf") }, { repo, maxBytes: 10 * MB }),
    ).rejects.toMatchObject({ code: "pdf_no_text_layer" });
  });

  it("rejects a truncated PDF as unreadable", async () => {
    const repo = new SeedRepository();
    await expect(
      ingestBloodReport(DEMO_PROFILE_ID, { name: "t.pdf", type: "application/pdf", bytes: sample("invalid/truncated.pdf") }, { repo, maxBytes: 10 * MB }),
    ).rejects.toBeInstanceOf(IngestionError);
  });

  it("stores a report once and rejects an exact duplicate", async () => {
    const repo = new SeedRepository();
    const before = (await repo.listBiomarkers(DEMO_PROFILE_ID)).length;
    const file = { name: "report.pdf", type: "application/pdf", bytes: sample("synthetic-blood-report.pdf") };
    const res = await ingestBloodReport(DEMO_PROFILE_ID, file, { repo, maxBytes: 10 * MB });
    expect(res.document.isSynthetic).toBe(true);
    expect(res.biomarkers.find((b) => b.code === "FERRITIN")?.rangeStatus).toBe("below");
    expect(res.biomarkers.find((b) => b.code === "ALT")?.rangeStatus).toBe("above");
    expect((await repo.listBiomarkers(DEMO_PROFILE_ID)).length).toBe(before + latestReport.lines.length);
    await expect(ingestBloodReport(DEMO_PROFILE_ID, file, { repo, maxBytes: 10 * MB })).rejects.toMatchObject({ code: "duplicate_document" });
  });
});

describe("Apple Health export.xml", () => {
  it("aggregates supported records into daily metrics and de-duplicates sources", async () => {
    const res = await parseAppleHealthXml(sample("synthetic-apple-health-export.xml"));
    expect(res.summary.firstDay).toBe("2026-10-14");
    expect(res.summary.lastDay).toBe("2026-10-20");
    expect(res.summary.skippedUnsupportedType).toEqual({ HKQuantityTypeIdentifierBodyMass: 1 });
    const steps = res.metrics.find((m) => m.metricType === "steps" && m.day === "2026-10-14")!;
    // Watch: 1800 + 2200 + 1500 = 5500; iPhone ≈ 90% of that — the higher source wins, not the sum.
    expect(steps).toMatchObject({ value: 5500, unit: "count", aggregation: "sum", sourceName: "Synthetic Watch" });
    const sleep = res.metrics.find((m) => m.metricType === "sleep_asleep" && m.day === "2026-10-14")!;
    // 00:20–03:00 (160) + 03:00–04:10 (70) + 04:25–06:50 (145) = 375; Awake and InBed excluded.
    expect(sleep.value).toBe(375);
    const hr = res.metrics.filter((m) => m.metricType === "heart_rate" && m.day === "2026-10-14");
    expect(hr.map((m) => [m.aggregation, m.value]).sort()).toEqual([["avg", 80], ["max", 88], ["min", 72]]);
    expect(res.warnings.join(" ")).toMatch(/double counting/);
  });

  it("converts kJ to kcal and skips unsupported units", async () => {
    const xml = `<HealthData>
      <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="S" unit="kJ" startDate="2026-01-01 10:00:00 +0000" endDate="2026-01-01 11:00:00 +0000" value="418.4"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="S" unit="count/s" startDate="2026-01-01 10:00:00 +0000" endDate="2026-01-01 10:00:00 +0000" value="1.2"/>
    </HealthData>`;
    const res = await parseAppleHealthXml(new TextEncoder().encode(xml));
    expect(res.metrics).toEqual([expect.objectContaining({ metricType: "active_energy", value: 100, unit: "kcal" })]);
    expect(res.summary.skippedUnsupportedUnit).toBe(1);
  });

  it("rejects malformed XML and non-Apple-Health XML", async () => {
    await expect(parseAppleHealthXml(sample("invalid/malformed.xml"))).rejects.toMatchObject({ code: "xml_malformed" });
    await expect(parseAppleHealthXml(sample("invalid/wrong-root.xml"))).rejects.toMatchObject({ code: "xml_not_apple_health" });
  });

  it("re-uploading the same export upserts instead of duplicating", async () => {
    const repo = new SeedRepository();
    const file = { name: "export.xml", type: "text/xml", bytes: sample("synthetic-apple-health-export.xml") };
    const r1 = await ingestAppleHealthExport(DEMO_PROFILE_ID, file, { repo, maxBytes: 50 * MB });
    const count1 = (await repo.listWearableMetrics(DEMO_PROFILE_ID)).length;
    const r2 = await ingestAppleHealthExport(DEMO_PROFILE_ID, file, { repo, maxBytes: 50 * MB });
    expect(r2.document.id).toBe(r1.document.id);
    expect((await repo.listWearableMetrics(DEMO_PROFILE_ID)).length).toBe(count1);
  });
});
