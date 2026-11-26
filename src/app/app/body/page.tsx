import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Organ & System Insights" };

const SYSTEMS = ["Liver", "Kidneys", "Cardiovascular risk indicators", "Thyroid", "Metabolic", "Blood"];

export default function BodyPage() {
  return (
    <div>
      <PageHeader title="Organ & system insights">
        How your results relate to body systems — without scores or diagnoses. Biomarker-to-system mappings arrive in M2.5; the interactive 3D overview in M3.5.
      </PageHeader>
      <ul className="mb-6 flex flex-wrap gap-2">
        {SYSTEMS.map((s) => (
          <li key={s} className="rounded-full bg-white px-4 py-1.5 text-sm text-ink-soft ring-1 ring-line">
            {s}
          </li>
        ))}
      </ul>
      <EmptyState title="Coming in M2">System cards will show available measurements, observations, trends, evidence, missing information and limitations.</EmptyState>
    </div>
  );
}
