-- Security advisor 0028/0029: SECURITY DEFINER helpers in the exposed `public` schema were callable
-- via /rest/v1/rpc by anon and authenticated. Move them to a private (non-exposed) schema, allow only
-- `authenticated` to execute them (needed for RLS evaluation), repoint every policy, and scope the
-- user-data policies to `authenticated` so anon matches no policy (empty result, no function call).
create schema if not exists private;
--> statement-breakpoint
revoke all on schema private from public;
--> statement-breakpoint
grant usage on schema private to authenticated;
--> statement-breakpoint
create or replace function private.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;
--> statement-breakpoint
create or replace function private.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'reviewer')
$$;
--> statement-breakpoint
revoke all on function private.current_profile_id() from public;
--> statement-breakpoint
revoke all on function private.is_reviewer() from public;
--> statement-breakpoint
grant execute on function private.current_profile_id() to authenticated;
--> statement-breakpoint
grant execute on function private.is_reviewer() to authenticated;
--> statement-breakpoint
do $$
declare t text;
begin
  foreach t in array array['documents','biomarkers','wearable_metrics','symptom_entries','event_requests','action_plans','messages','action_history','health_timeline_events']
  loop
    execute format(
      'alter policy %I on public.%I to authenticated using (profile_id = private.current_profile_id()) with check (profile_id = private.current_profile_id())',
      t || '_owner_all', t);
  end loop;
end $$;
--> statement-breakpoint
alter policy supplement_suggestions_owner_or_reviewer_select on public.supplement_suggestions
  to authenticated using (profile_id = private.current_profile_id() or private.is_reviewer());
--> statement-breakpoint
alter policy supplement_suggestions_owner_insert on public.supplement_suggestions
  to authenticated with check (profile_id = private.current_profile_id());
--> statement-breakpoint
alter policy supplement_suggestions_reviewer_update on public.supplement_suggestions
  to authenticated using (private.is_reviewer()) with check (private.is_reviewer());
--> statement-breakpoint
drop function public.current_profile_id();
--> statement-breakpoint
drop function public.is_reviewer();
