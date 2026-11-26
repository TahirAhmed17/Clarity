import type { Biomarker, HealthDocument } from "@/lib/domain";
import { rangeStatus } from "../biomarkers/range";
import type { HealthRepository } from "../data/repository";
import { log } from "../log";
import { parseAppleHealthXml, type AppleHealthParseResult } from "./apple-health/parse";
import { IngestionError } from "./errors";
import { MIN_TEXT_LAYER_CHARS, unavailableOcr, type OcrProvider } from "./ocr";
import { extractPdfLines } from "./pdf/extract-lines";
import { parseLabReport } from "./pdf/parse-biomarkers";
import { sanitizeFilename, validateUpload, type UploadInput } from "./validation";

export interface ReportIngestionResult {
  document: HealthDocument;
  biomarkers: (Biomarker & { rangeStatus: ReturnType<typeof rangeStatus> })[];
  warnings: string[];
  unparsedLines: string[];
}

export interface WearableIngestionResult {
  document: HealthDocument;
  metricsStored: number;
  summary: AppleHealthParseResult["summary"];
  warnings: string[];
}

interface Deps {
  repo: HealthRepository;
  maxBytes: number;
  ocr?: OcrProvider;
}

export async function ingestBloodReport(profileId: string, file: UploadInput, deps: Deps): Promise<ReportIngestionResult> {
  const upload = validateUpload({ ...file, name: sanitizeFilename(file.name) }, "blood_report_pdf", deps.maxBytes);

  const existing = await deps.repo.findDocumentByHash(profileId, upload.sha256);
  if (existing) {
    throw new IngestionError("duplicate_document", "You've already uploaded this exact report.", { documentId: existing.id });
  }

  const started = Date.now();
  const extraction = await extractPdfLines(upload.bytes);
  let method = "text_layer";
  let pages = extraction.pages;

  if (extraction.totalChars < MIN_TEXT_LAYER_CHARS) {
    const ocr = deps.ocr ?? unavailableOcr;
    if (!ocr.isAvailable()) {
      throw new IngestionError(
        "pdf_no_text_layer",
        "This PDF looks like a scan or photo (it has no readable text). Scanned reports need OCR, which isn't enabled yet — please upload the digital PDF from your lab if you have it.",
      );
    }
    pages = await ocr.recognise(upload.bytes);
    method = `ocr:${ocr.id}`;
  }

  const parsed = parseLabReport(pages);
  if (parsed.biomarkers.length === 0) {
    throw new IngestionError(
      "no_biomarkers_found",
      "We could read this PDF but didn't recognise any lab results in it. The layout may not be supported yet.",
    );
  }

  const document = await deps.repo.createDocument(profileId, {
    kind: "blood_report_pdf",
    originalFilename: upload.name,
    mimeType: "application/pdf",
    sizeBytes: upload.sizeBytes,
    sha256: upload.sha256,
    status: "processed",
    extractionMethod: method,
    collectedOn: parsed.collectedOn,
    errorMessage: null,
    isSynthetic: /synthetic/i.test(pages.flatMap((p) => p.lines).slice(0, 5).join(" ")),
  });

  const stored = await deps.repo.addBiomarkers(
    profileId,
    parsed.biomarkers.map((b) => ({ ...b, documentId: document.id })),
  );

  log.info("ingest.report", { count: stored.length, durationMs: Date.now() - started, status: "processed" });

  return {
    document,
    biomarkers: stored.map((b) => ({ ...b, rangeStatus: rangeStatus(b.valueNumeric, b.refLow, b.refHigh) })),
    warnings: parsed.warnings,
    unparsedLines: parsed.unparsedLines,
  };
}

export async function ingestAppleHealthExport(profileId: string, file: UploadInput, deps: Deps): Promise<WearableIngestionResult> {
  const upload = validateUpload({ ...file, name: sanitizeFilename(file.name) }, "apple_health_xml", deps.maxBytes);
  const started = Date.now();
  const parsed = await parseAppleHealthXml(upload.bytes);

  const existing = await deps.repo.findDocumentByHash(profileId, upload.sha256);
  const document =
    existing ??
    (await deps.repo.createDocument(profileId, {
      kind: "apple_health_xml",
      originalFilename: upload.name,
      mimeType: "application/xml",
      sizeBytes: upload.sizeBytes,
      sha256: upload.sha256,
      status: "processed",
      extractionMethod: "xml_stream",
      collectedOn: parsed.summary.lastDay,
      errorMessage: null,
      isSynthetic: Buffer.from(upload.bytes.subarray(0, 400)).toString("utf8").includes("SYNTHETIC"),
    }));

  // Daily aggregates are upserted, so re-uploading the same or an overlapping export is safe.
  const metricsStored = await deps.repo.upsertWearableMetrics(
    profileId,
    parsed.metrics.map((m) => ({ ...m, documentId: document.id })),
  );

  log.info("ingest.apple_health", { count: metricsStored, durationMs: Date.now() - started });
  return { document, metricsStored, summary: parsed.summary, warnings: parsed.warnings };
}
