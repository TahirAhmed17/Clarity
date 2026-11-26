import { createHash } from "node:crypto";
import { IngestionError } from "./errors";

export type UploadKind = "blood_report_pdf" | "apple_health_xml";

export interface UploadInput {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface ValidatedUpload extends UploadInput {
  kind: UploadKind;
  sizeBytes: number;
  sha256: string;
}

const RULES: Record<UploadKind, { extensions: string[]; mimeTypes: string[]; label: string }> = {
  blood_report_pdf: { extensions: [".pdf"], mimeTypes: ["application/pdf", "application/x-pdf", ""], label: "PDF" },
  apple_health_xml: {
    extensions: [".xml"],
    mimeTypes: ["application/xml", "text/xml", ""],
    label: "Apple Health export.xml",
  },
};

function startsWithPdfMagic(bytes: Uint8Array) {
  // "%PDF-" may be preceded by a few bytes of junk in some generators; allow within the first 1KB.
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

function looksLikeXml(bytes: Uint8Array) {
  let head = Buffer.from(bytes.subarray(0, 512)).toString("utf8");
  if (head.charCodeAt(0) === 0xfeff) head = head.slice(1);
  return head.trimStart().startsWith("<");
}

/**
 * Validates name, declared type, size and actual content (magic bytes).
 * Declared MIME types are hints only; content checks are authoritative.
 */
export function validateUpload(input: UploadInput, kind: UploadKind, maxBytes: number): ValidatedUpload {
  const rule = RULES[kind];
  const sizeBytes = input.bytes.byteLength;
  if (sizeBytes === 0) throw new IngestionError("empty_file", "The file is empty.");
  if (sizeBytes > maxBytes) {
    throw new IngestionError("file_too_large", `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, {
      sizeBytes,
      maxBytes,
    });
  }
  const lower = input.name.toLowerCase();
  if (!rule.extensions.some((e) => lower.endsWith(e))) {
    throw new IngestionError("unsupported_type", `Please upload a ${rule.label} file.`);
  }
  if (!rule.mimeTypes.includes(input.type) && !input.type.startsWith("application/octet-stream")) {
    throw new IngestionError("unsupported_type", `Please upload a ${rule.label} file.`);
  }
  const contentOk = kind === "blood_report_pdf" ? startsWithPdfMagic(input.bytes) : looksLikeXml(input.bytes);
  if (!contentOk) {
    throw new IngestionError("content_mismatch", `This file doesn't look like a valid ${rule.label}.`);
  }
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  return { ...input, kind, sizeBytes, sha256 };
}

/** Strips any path components and control characters from a client-supplied filename. */
export function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "upload";
}
