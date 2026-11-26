export type IngestionErrorCode =
  | "missing_file"
  | "file_too_large"
  | "empty_file"
  | "unsupported_type"
  | "content_mismatch"
  | "pdf_unreadable"
  | "pdf_no_text_layer"
  | "no_biomarkers_found"
  | "xml_malformed"
  | "xml_not_apple_health"
  | "no_supported_records"
  | "duplicate_document";

const STATUS: Record<IngestionErrorCode, number> = {
  missing_file: 400,
  file_too_large: 413,
  empty_file: 400,
  unsupported_type: 415,
  content_mismatch: 415,
  pdf_unreadable: 422,
  pdf_no_text_layer: 422,
  no_biomarkers_found: 422,
  xml_malformed: 422,
  xml_not_apple_health: 422,
  no_supported_records: 422,
  duplicate_document: 409,
};

/** Error with a safe, user-facing message. Never include file contents in the message. */
export class IngestionError extends Error {
  readonly status: number;
  constructor(
    readonly code: IngestionErrorCode,
    readonly userMessage: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "IngestionError";
    this.status = STATUS[code];
  }
}
