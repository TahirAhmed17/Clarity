/**
 * OCR fallback boundary for scanned PDFs (no text layer).
 *
 * M1 status: interface + detection only. No OCR provider is enabled, so scanned PDFs
 * return a clear `pdf_no_text_layer` error instead of silently producing nothing.
 * Candidate providers (decision pending, see IMPLEMENTATION_PLAN.md):
 *   - Gemini document understanding (needs API key; sends the file to Google)
 *   - tesseract.js + page rasterisation (offline, heavier, needs @napi-rs/canvas)
 */
export interface OcrProvider {
  readonly id: string;
  isAvailable(): boolean;
  /** Returns plain-text lines per page. */
  recognise(pdfBytes: Uint8Array): Promise<{ pageNumber: number; lines: string[] }[]>;
}

export const unavailableOcr: OcrProvider = {
  id: "none",
  isAvailable: () => false,
  recognise: async () => {
    throw new Error("No OCR provider configured");
  },
};

/** Below this many characters across the document we treat the PDF as image-only. */
export const MIN_TEXT_LAYER_CHARS = 40;
