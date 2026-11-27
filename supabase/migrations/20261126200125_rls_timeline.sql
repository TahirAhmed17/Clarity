alter table public.health_timeline_events enable row level security;
--> statement-breakpoint
create policy health_timeline_events_owner_all on public.health_timeline_events for all
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
