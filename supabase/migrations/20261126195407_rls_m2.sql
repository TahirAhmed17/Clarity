-- RLS for M2 tables. Evidence is shared read-only reference data; action history is owner-only.
alter table public.evidence_sources enable row level security;
--> statement-breakpoint
alter table public.evidence_chunks enable row level security;
--> statement-breakpoint
alter table public.action_history enable row level security;
--> statement-breakpoint
create policy evidence_sources_read on public.evidence_sources for select using (true);
--> statement-breakpoint
create policy evidence_chunks_read on public.evidence_chunks for select using (true);
--> statement-breakpoint
create policy action_history_owner_all on public.action_history for all
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
