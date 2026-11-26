/**
 * Generates SYNTHETIC demo files from the dataset (single source of truth):
 *   samples/synthetic-blood-report.pdf
 *   samples/synthetic-apple-health-export.xml
 *   samples/invalid/*  (negative-test fixtures)
 * Usage: npm run samples:generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { latestReport, SYNTHETIC_LABEL } from "../src/data/synthetic/dataset";

const OUT = "samples";

async function bloodReportPdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Synthetic blood report — demo only");
  pdf.setAuthor("Clarity synthetic data generator");
  pdf.setSubject(SYNTHETIC_LABEL);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.11, 0.12);
  const muted = rgb(0.4, 0.42, 0.44);
  const coral = rgb(0.78, 0.33, 0.25);

  let y = 800;
  const text = (t: string, x: number, size = 10, f = font, color = ink) => page.drawText(t, { x, y, size, font: f, color });

  text("SYNTHETIC DEMO REPORT — NOT A REAL PATIENT", 50, 12, bold, coral);
  y -= 22;
  text(latestReport.labName, 50, 14, bold);
  y -= 18;
  text("Patient: Alex Morgan (synthetic)    DOB: 1996 (synthetic)    Ref: DEMO-0001", 50, 9, font, muted);
  y -= 14;
  text(`Collected: ${latestReport.collectedOn}    Reported: 2026-10-15`, 50, 9, font, muted);
  y -= 30;

  const cols = { name: 50, value: 230, unit: 300, ref: 410, flag: 520 };
  text("Test", cols.name, 9, bold, muted);
  text("Result", cols.value, 9, bold, muted);
  text("Units", cols.unit, 9, bold, muted);
  text("Reference range", cols.ref, 9, bold, muted);
  text("Flag", cols.flag, 9, bold, muted);
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: muted });
  y -= 16;

  for (const line of latestReport.lines) {
    text(line.name, cols.name);
    text(line.value, cols.value, 10, line.flag ? bold : font);
    text(line.unit, cols.unit);
    text(line.ref, cols.ref);
    if (line.flag) text(line.flag, cols.flag, 10, bold, coral);
    y -= 20;
  }

  y -= 16;
  text("Reference ranges are those of the issuing (fictional) laboratory.", 50, 8, font, muted);
  y -= 12;
  text("This document is synthetic and was generated for software demonstration only.", 50, 8, font, muted);

  return pdf.save();
}

/** A PDF with no text layer (only a drawn shape) — exercises the OCR-needed path. */
async function imageOnlyPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 50, y: 600, width: 300, height: 150, color: rgb(0.8, 0.9, 0.9) });
  return pdf.save();
}

function appleHealthXml() {
  const days = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"];
  const tz = "+0100";
  const rec = (type: string, unit: string | null, start: string, end: string, value: string, source = "Synthetic Watch") =>
    `  <Record type="${type}" sourceName="${source}" sourceVersion="1.0"${unit ? ` unit="${unit}"` : ""} creationDate="${end}" startDate="${start}" endDate="${end}" value="${value}"/>`;
  const at = (day: string, hm: string) => `${day} ${hm}:00 ${tz}`;
  const prevDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  const lines: string[] = [];
  days.forEach((day, i) => {
    // Steps in 3 chunks from the watch + a duplicate-ish iPhone stream (tests source de-duplication).
    for (const [h1, h2, v] of [["08:00", "09:00", 1800 + i * 50], ["12:00", "13:00", 2200], ["18:00", "19:00", 1500 + i * 100]] as const) {
      lines.push(rec("HKQuantityTypeIdentifierStepCount", "count", at(day, h1), at(day, h2), String(v)));
      lines.push(rec("HKQuantityTypeIdentifierStepCount", "count", at(day, h1), at(day, h2), String(Math.round(Number(v) * 0.9)), "Synthetic iPhone"));
    }
    lines.push(rec("HKQuantityTypeIdentifierActiveEnergyBurned", "kcal", at(day, "08:00"), at(day, "20:00"), String(280 + i * 10)));
    lines.push(rec("HKQuantityTypeIdentifierRestingHeartRate", "count/min", at(day, "00:00"), at(day, "23:59"), String(63 + (i % 3))));
    lines.push(rec("HKQuantityTypeIdentifierHeartRate", "count/min", at(day, "10:00"), at(day, "10:00"), "72"));
    lines.push(rec("HKQuantityTypeIdentifierHeartRate", "count/min", at(day, "15:00"), at(day, "15:00"), "88"));
    lines.push(rec("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "ms", at(day, "03:00"), at(day, "03:01"), String(40 + i)));
    // Sleep the night before `day`: in bed 23:50, asleep segments, awake segment excluded.
    const pd = prevDay(day);
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", null, at(pd, "23:50"), at(day, "07:05"), "HKCategoryValueSleepAnalysisInBed"));
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", null, at(day, "00:20"), at(day, "03:00"), "HKCategoryValueSleepAnalysisAsleepCore"));
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", null, at(day, "03:00"), at(day, "04:10"), "HKCategoryValueSleepAnalysisAsleepDeep"));
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", null, at(day, "04:10"), at(day, "04:25"), "HKCategoryValueSleepAnalysisAwake"));
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", null, at(day, "04:25"), at(day, "06:50"), "HKCategoryValueSleepAnalysisAsleepREM"));
  });
  // Unsupported type — must be counted as skipped, not crash.
  lines.push(rec("HKQuantityTypeIdentifierBodyMass", "kg", at(days[0], "07:00"), at(days[0], "07:00"), "64"));

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${SYNTHETIC_LABEL}. Structure modelled on an Apple Health export.xml. -->
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record)*)>
<!ATTLIST HealthData locale CDATA #REQUIRED>
]>
<HealthData locale="en_GB">
  <ExportDate value="2026-10-21 08:00:00 ${tz}"/>
  <Me HKCharacteristicTypeIdentifierDateOfBirth="" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>
${lines.join("\n")}
</HealthData>
`;
}

async function main() {
  mkdirSync(`${OUT}/invalid`, { recursive: true });
  writeFileSync(`${OUT}/synthetic-blood-report.pdf`, await bloodReportPdf());
  writeFileSync(`${OUT}/synthetic-apple-health-export.xml`, appleHealthXml());
  writeFileSync(`${OUT}/invalid/scanned-no-text.pdf`, await imageOnlyPdf());
  writeFileSync(`${OUT}/invalid/not-a-pdf.pdf`, "This is plain text pretending to be a PDF.\n");
  writeFileSync(`${OUT}/invalid/truncated.pdf`, "%PDF-1.7\n1 0 obj\n<< /Type /Catalog");
  writeFileSync(`${OUT}/invalid/wrong-root.xml`, `<?xml version="1.0"?>\n<NotHealthData><Record type="x"/></NotHealthData>\n`);
  writeFileSync(`${OUT}/invalid/malformed.xml`, `<?xml version="1.0"?>\n<HealthData><Record type="HKQuantityTypeIdentifierStepCount" value="10"\n`);
  writeFileSync(
    `${OUT}/README.md`,
    `# Samples — ${SYNTHETIC_LABEL}\n\nGenerated by \`npm run samples:generate\` from \`src/data/synthetic/dataset.ts\`.\n\n- \`synthetic-blood-report.pdf\` — latest synthetic lab report (upload in the demo).\n- \`synthetic-apple-health-export.xml\` — small synthetic Apple Health export (7 days).\n- \`invalid/\` — negative-test fixtures (scanned PDF without text, fake PDF, truncated PDF, wrong XML root, malformed XML).\n\nNo real person's data is contained in any file here.\n`,
  );
  console.log("Samples written to ./samples");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
