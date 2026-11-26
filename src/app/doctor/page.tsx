import type { Metadata } from "next";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Reviewer workspace (simulated)" };

export default function DoctorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Badge tone="coral" className="mb-4">
        SIMULATED — not a real clinician
      </Badge>
      <PageHeader title="Reviewer workspace">
        A role-restricted, simulated review queue for supplement suggestions (pending, approved with dose, changed, rejected). Built in M2.8 / M3.8.
      </PageHeader>
      <EmptyState title="No suggestions to review yet" action={<ButtonLink href="/app" variant="secondary">Back to Clarity</ButtonLink>} />
    </main>
  );
}
