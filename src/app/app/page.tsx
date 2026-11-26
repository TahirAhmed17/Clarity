import type { Metadata } from "next";
import { Suspense } from "react";
import { Companion } from "@/components/features/companion";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Home" };

function greetingFor(name: string) {
  const first = name.split(/[\s(]/)[0];
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${first}.`;
}

async function HomeContent({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { repo, profileId } = await loadPageData();
  const [profile, messages, params] = await Promise.all([repo.getProfile(profileId), repo.listMessages(profileId), searchParams]);
  const q = typeof params.q === "string" ? params.q.slice(0, 500) : null;
  return <Companion initialMessages={messages.slice(-12)} greeting={greetingFor(profile?.displayName ?? "there")} initialQuestion={q} />;
}

export default function HomePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  return (
    <Suspense fallback={<div className="h-64" aria-busy="true" />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
