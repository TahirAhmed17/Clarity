import { extractTextItems, getDocumentProxy } from "unpdf";
import { IngestionError } from "../errors";

export interface PdfPageLines {
  pageNumber: number;
  /** Reconstructed visual lines. Large horizontal gaps between text runs become "\t" (column breaks). */
  lines: string[];
}

export interface PdfExtraction {
  totalPages: number;
  pages: PdfPageLines[];
  totalChars: number;
}

const Y_TOLERANCE = 3; // points: items within this vertical distance share a line
const COLUMN_GAP = 10; // points: horizontal gap treated as a column break

/**
 * Extracts text from the PDF text layer and rebuilds lines using item coordinates,
 * which keeps table columns (name | value | unit | range | flag) separable.
 */
export async function extractPdfLines(bytes: Uint8Array): Promise<PdfExtraction> {
  let result: Awaited<ReturnType<typeof extractTextItems>>;
  try {
    // Copy: pdf.js may transfer/detach the buffer it is given.
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    result = await extractTextItems(doc);
  } catch {
    throw new IngestionError("pdf_unreadable", "We couldn't read this PDF. It may be damaged or password-protected.");
  }

  let totalChars = 0;
  const pages: PdfPageLines[] = result.items.map((items, i) => {
    const runs = items.filter((it) => it.str.trim().length > 0);
    totalChars += runs.reduce((n, r) => n + r.str.trim().length, 0);
    // Sort top-to-bottom (PDF y grows upwards), then left-to-right.
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: (typeof runs)[] = [];
    for (const run of runs) {
      const row = rows.find((r) => Math.abs(r[0].y - run.y) <= Y_TOLERANCE);
      if (row) row.push(run);
      else rows.push([run]);
    }
    const lines = rows.map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let prevEnd: number | null = null;
      for (const run of row) {
        if (prevEnd !== null) {
          const gap = run.x - prevEnd;
          line += gap > COLUMN_GAP ? "\t" : gap > 1 ? " " : "";
        }
        line += run.str;
        prevEnd = run.x + run.width;
      }
      return line.trim();
    });
    return { pageNumber: i + 1, lines };
  });

  return { totalPages: result.totalPages, pages, totalChars };
}
