-- Clarity: Row Level Security.
-- Uses Supabase's auth.uid(). Tests run this on PGlite with a stub auth.uid() (src/server/db/pglite.ts).
-- The Next.js server connects with a privileged role (bypasses RLS) and ALSO scopes every
-- query by profile_id in the repository layer. These policies protect access through the
-- anon/authenticated API keys (PostgREST / supabase-js).

create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;
--> statement-breakpoint
create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'reviewer')
$$;
--> statement-breakpoint
alter table public.profiles enable row level security;
--> statement-breakpoint
alter table public.documents enable row level security;
--> statement-breakpoint
alter table public.biomarkers enable row level security;
--> statement-breakpoint
alter table public.wearable_metrics enable row level security;
--> statement-breakpoint
alter table public.symptom_entries enable row level security;
--> statement-breakpoint
alter table public.supplement_catalogue enable row level security;
--> statement-breakpoint
alter table public.supplement_suggestions enable row level security;
--> statement-breakpoint
alter table public.events enable row level security;
--> statement-breakpoint
alter table public.event_requests enable row level security;
--> statement-breakpoint
alter table public.action_plans enable row level security;
--> statement-breakpoint
alter table public.messages enable row level security;
--> statement-breakpoint
create policy profiles_self_select on public.profiles for select using (auth_user_id = auth.uid());
--> statement-breakpoint
create policy profiles_self_update on public.profiles for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
--> statement-breakpoint
create policy profiles_self_delete on public.profiles for delete using (auth_user_id = auth.uid());
--> statement-breakpoint
do $$
declare t text;
begin
  foreach t in array array['documents','biomarkers','wearable_metrics','symptom_entries','event_requests','action_plans','messages']
  loop
    execute format(
      'create policy %I on public.%I for all using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id())',
      t || '_owner_all', t);
  end loop;
end $$;
--> statement-breakpoint
create policy supplement_suggestions_owner_or_reviewer_select on public.supplement_suggestions
  for select using (profile_id = public.current_profile_id() or public.is_reviewer());
--> statement-breakpoint
create policy supplement_suggestions_owner_insert on public.supplement_suggestions
  for insert with check (profile_id = public.current_profile_id());
--> statement-breakpoint
create policy supplement_suggestions_reviewer_update on public.supplement_suggestions
  for update using (public.is_reviewer()) with check (public.is_reviewer());
--> statement-breakpoint
create policy supplement_catalogue_read on public.supplement_catalogue for select using (true);
--> statement-breakpoint
create policy events_read on public.events for select using (true);
