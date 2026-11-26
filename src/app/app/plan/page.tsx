import type { Metadata } from "next";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Daily plan" };

export default function PlanPage() {
  return (
    <div>
      <PageHeader title="Your daily plan">Movement, nutrition and sleep actions built from your next move.</PageHeader>
      <EmptyState title="Plans arrive in M2.7" action={<ButtonLink href="/app">Ask Clarity for your next move</ButtonLink>}>
        The recommendation engine will turn your next move into a short daily plan you can complete or skip.
      </EmptyState>
    </div>
  );
}
