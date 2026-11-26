"use client";

import { useState } from "react";
import type { RangeStatus } from "@/lib/domain";
import { Badge, Button, Card, Disclaimer, ProvenanceTag, RangeBadge, SectionHeading } from "@/components/ui/primitives";

type ReportResult = {
  document: { originalFilename: string; collectedOn: string | null; isSynthetic: boolean };
  biomarkers: { id: string; nameAsReported: string; valueText: string; unitAsReported: string | null; refText: string | null; flagAsReported: string | null; rangeStatus: RangeStatus; confidence: number | null }[];
  warnings: string[];
  unparsedLines: string[];
};

type WearableResult = {
  metricsStored: number;
  summary: { recordsSeen: number; recordsUsed: number; firstDay: string | null; lastDay: string | null; sources: string[]; skippedUnsupportedType: Record<string, number> };
  warnings: string[];
};

async function upload<T>(endpoint: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(endpoint, { method: "POST", body: fd });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error?.message ?? "Upload failed.");
  return body as T;
}

function FilePicker({ id, accept, busy, onFile, label }: { id: string; accept: string; busy: boolean; onFile: (f: File) => void; label: string }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onFile(file);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-mint-soft file:px-4 file:py-2 file:font-semibold file:text-teal-ink"
      />
      <Button type="submit" disabled={!file || busy}>
        {busy ? "Reading…" : "Upload"}
      </Button>
    </form>
  );
}

export function ReportUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  return (
    <Card>
      <SectionHeading eyebrow="Blood report" title="Upload a lab report (PDF)">
        Digital PDFs work best. We keep your lab&apos;s own values, units and reference ranges exactly as printed.
      </SectionHeading>
      <FilePicker
        id="report"
        label="Blood report PDF"
        accept="application/pdf,.pdf"
        busy={busy}
        onFile={async (f) => {
          setBusy(true);
          setError(null);
          setResult(null);
          try {
            setResult(await upload<ReportResult>("/api/ingest/report", f));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="mt-4 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">{error}</p>}
      {result && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="teal">{result.biomarkers.length} results extracted</Badge>
            <span className="text-ink-soft">Collected {result.document.collectedOn ?? "— date not found"}</span>
            <ProvenanceTag kind="extracted" />
            {result.document.isSynthetic && <ProvenanceTag kind="synthetic" />}
          </div>
          {result.warnings.length > 0 && (
            <ul className="list-disc space-y-1 rounded-2xl bg-stone px-8 py-3 text-sm text-stone-ink">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-ink-faint uppercase">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Test (as reported)</th>
                  <th className="py-2 pr-3 font-semibold">Result</th>
                  <th className="py-2 pr-3 font-semibold">Lab range</th>
                  <th className="py-2 font-semibold">Compared with lab range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.biomarkers.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 text-ink">{b.nameAsReported}</td>
                    <td className="py-2 pr-3 font-semibold text-ink">
                      {b.valueText} <span className="font-normal text-ink-soft">{b.unitAsReported}</span>
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{b.refText ?? "—"}</td>
                    <td className="py-2">
                      <RangeBadge status={b.rangeStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.unparsedLines.length > 0 && (
            <p className="text-sm text-ink-soft">
              {result.unparsedLines.length} line(s) mentioned a test we couldn&apos;t read reliably and were not saved.
            </p>
          )}
          <Disclaimer />
        </div>
      )}
    </Card>
  );
}

export function WearableUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WearableResult | null>(null);

  return (
    <Card id="wearable">
      <SectionHeading eyebrow="Wearables" title="Upload an Apple Health export">
        In the Health app: profile → Export All Health Data, then unzip and upload <code>export.xml</code>. Other wearable formats aren&apos;t
        supported yet.
      </SectionHeading>
      <FilePicker
        id="wearable-file"
        label="Apple Health export.xml"
        accept=".xml,application/xml,text/xml"
        busy={busy}
        onFile={async (f) => {
          setBusy(true);
          setError(null);
          setResult(null);
          try {
            setResult(await upload<WearableResult>("/api/ingest/apple-health", f));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="mt-4 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">{error}</p>}
      {result && (
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">{result.metricsStored} daily values stored</Badge>
            <Badge tone="neutral">
              {result.summary.firstDay} → {result.summary.lastDay}
            </Badge>
            <ProvenanceTag kind="extracted" />
          </div>
          <p className="text-ink-soft">
            Read {result.summary.recordsUsed} of {result.summary.recordsSeen} records from {result.summary.sources.join(", ")}.
          </p>
          {Object.keys(result.summary.skippedUnsupportedType).length > 0 && (
            <p className="text-ink-soft">Skipped types not used yet: {Object.keys(result.summary.skippedUnsupportedType).join(", ")}.</p>
          )}
          {result.warnings.map((w) => (
            <p key={w} className="rounded-2xl bg-stone px-4 py-2.5 text-stone-ink">
              {w}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
