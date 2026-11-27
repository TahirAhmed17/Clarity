import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewerSignIn } from "@/components/features/reviewer-sign-in";
import { Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Reviewer sign-in (simulated)" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  // Only allow same-site paths under /doctor as the post-sign-in destination.
  const dest = typeof next === "string" && next.startsWith("/doctor") && !next.startsWith("//") ? next : "/doctor";
  return <ReviewerSignIn next={dest} />;
}

export default function ReviewerSignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Badge tone="coral" className="mb-4 self-start">
        SIMULATED: not a real clinician
      </Badge>
      <h1 className="font-display text-4xl tracking-tight text-ink">Reviewer sign-in</h1>
      <p className="mt-2 text-ink-soft">
        The reviewer workspace is restricted. Enter the access code set for this server. Members of Clarity can&apos;t open it.
      </p>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
