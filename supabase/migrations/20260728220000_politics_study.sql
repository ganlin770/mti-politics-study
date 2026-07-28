begin;

-- One current, replaceable snapshot per authenticated learner. The flexible
-- JSON document keeps the front end decoupled from a rapidly evolving study
-- plan while the relational columns support safe conflict resolution.
create table if not exists public.politics_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1,
  revision bigint not null default 0,
  client_updated_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint politics_user_state_state_object_chk
    check (jsonb_typeof(state) = 'object'),
  constraint politics_user_state_state_size_chk
    check (octet_length(state::text) <= 1048576),
  constraint politics_user_state_schema_version_chk
    check (schema_version between 1 and 32767),
  constraint politics_user_state_revision_chk
    check (revision >= 0)
);

-- Optional learner settings that should not be mixed into the frequently
-- updated study-state snapshot.
create table if not exists public.politics_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  target_school text,
  exam_year smallint,
  daily_target_minutes smallint not null default 90,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint politics_profile_display_name_chk
    check (
      display_name is null
      or char_length(btrim(display_name)) between 1 and 80
    ),
  constraint politics_profile_target_school_chk
    check (
      target_school is null
      or char_length(btrim(target_school)) between 1 and 120
    ),
  constraint politics_profile_exam_year_chk
    check (exam_year is null or exam_year between 2024 and 2100),
  constraint politics_profile_daily_target_chk
    check (daily_target_minutes between 10 and 1440),
  constraint politics_profile_preferences_object_chk
    check (jsonb_typeof(preferences) = 'object'),
  constraint politics_profile_preferences_size_chk
    check (octet_length(preferences::text) <= 65536)
);

-- Immutable-from-the-client event stream. event_id is supplied by the client
-- (or generated here) so an offline retry can be safely de-duplicated.
create table if not exists public.politics_study_events (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid,
  event_type text not null,
  item_key text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint politics_study_events_user_event_uniq unique (user_id, event_id),
  constraint politics_study_events_type_chk
    check (
      char_length(event_type) between 1 and 64
      and event_type ~ '^[a-z][a-z0-9_.-]*$'
    ),
  constraint politics_study_events_item_key_chk
    check (
      item_key is null
      or char_length(btrim(item_key)) between 1 and 240
    ),
  constraint politics_study_events_payload_object_chk
    check (jsonb_typeof(payload) = 'object'),
  constraint politics_study_events_payload_size_chk
    check (octet_length(payload::text) <= 262144)
);

-- The primary keys already index user_id on the one-row-per-user tables.
-- These indexes cover the event-list, timeline, session and item drill-downs.
create index if not exists politics_study_events_user_occurred_idx
  on public.politics_study_events (user_id, occurred_at desc);

create index if not exists politics_study_events_user_type_occurred_idx
  on public.politics_study_events (user_id, event_type, occurred_at desc);

create index if not exists politics_study_events_user_session_idx
  on public.politics_study_events (user_id, session_id)
  where session_id is not null;

create index if not exists politics_study_events_user_item_idx
  on public.politics_study_events (user_id, item_key)
  where item_key is not null;

-- Server-owned timestamps. On update, created_at is deliberately restored so
-- a client cannot rewrite record history through a broad table update grant.
create or replace function public.politics_set_row_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_time timestamptz := statement_timestamp();
begin
  if tg_op = 'INSERT' then
    new.created_at := current_time;
  else
    new.created_at := old.created_at;
  end if;

  new.updated_at := current_time;
  return new;
end;
$$;

drop trigger if exists politics_user_state_set_timestamps
  on public.politics_user_state;
create trigger politics_user_state_set_timestamps
before insert or update on public.politics_user_state
for each row execute function public.politics_set_row_timestamps();

drop trigger if exists politics_profile_set_timestamps
  on public.politics_profile;
create trigger politics_profile_set_timestamps
before insert or update on public.politics_profile
for each row execute function public.politics_set_row_timestamps();

create or replace function public.politics_set_event_created_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.created_at := statement_timestamp();
  return new;
end;
$$;

drop trigger if exists politics_study_events_set_created_at
  on public.politics_study_events;
create trigger politics_study_events_set_created_at
before insert on public.politics_study_events
for each row execute function public.politics_set_event_created_at();

-- Optimistic state synchronization prevents a stale browser from silently
-- overwriting a newer snapshot. The server owns the relational revision;
-- callers receive the current row when their expected revision is stale.
create or replace function public.politics_sync_user_state(
  p_state jsonb,
  p_schema_version smallint,
  p_expected_revision bigint,
  p_client_updated_at timestamptz
)
returns table (
  out_state jsonb,
  out_revision bigint,
  out_updated_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.politics_user_state (
    user_id,
    state,
    schema_version,
    revision,
    client_updated_at
  ) values (
    current_user_id,
    p_state,
    p_schema_version,
    1,
    p_client_updated_at
  )
  on conflict (user_id) do nothing
  returning state, revision, updated_at, true
    into out_state, out_revision, out_updated_at, applied;

  if found then
    return next;
    return;
  end if;

  update public.politics_user_state as target
  set state = p_state,
      schema_version = p_schema_version,
      revision = target.revision + 1,
      client_updated_at = p_client_updated_at
  where target.user_id = current_user_id
    and target.revision = greatest(0, p_expected_revision)
  returning target.state, target.revision, target.updated_at, true
    into out_state, out_revision, out_updated_at, applied;

  if found then
    return next;
    return;
  end if;

  return query
  select target.state, target.revision, target.updated_at, false
  from public.politics_user_state as target
  where target.user_id = current_user_id;
end;
$$;

-- The functions exist only for triggers and must not become public RPCs.
revoke all on function public.politics_set_row_timestamps() from public;
revoke all on function public.politics_set_row_timestamps() from anon, authenticated;
revoke all on function public.politics_set_event_created_at() from public;
revoke all on function public.politics_set_event_created_at() from anon, authenticated;
revoke all on function public.politics_sync_user_state(jsonb, smallint, bigint, timestamptz) from public;
revoke all on function public.politics_sync_user_state(jsonb, smallint, bigint, timestamptz) from anon;
grant execute on function public.politics_sync_user_state(jsonb, smallint, bigint, timestamptz) to authenticated;

alter table public.politics_user_state enable row level security;
alter table public.politics_user_state force row level security;
alter table public.politics_profile enable row level security;
alter table public.politics_profile force row level security;
alter table public.politics_study_events enable row level security;
alter table public.politics_study_events force row level security;

-- Recreating named policies makes this file safe to re-run after an interrupted
-- manual SQL Editor deployment.
drop policy if exists politics_user_state_select_own
  on public.politics_user_state;
create policy politics_user_state_select_own
  on public.politics_user_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists politics_user_state_insert_own
  on public.politics_user_state;
create policy politics_user_state_insert_own
  on public.politics_user_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists politics_user_state_update_own
  on public.politics_user_state;
create policy politics_user_state_update_own
  on public.politics_user_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists politics_profile_select_own
  on public.politics_profile;
create policy politics_profile_select_own
  on public.politics_profile
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists politics_profile_insert_own
  on public.politics_profile;
create policy politics_profile_insert_own
  on public.politics_profile
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists politics_profile_update_own
  on public.politics_profile;
create policy politics_profile_update_own
  on public.politics_profile
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists politics_study_events_select_own
  on public.politics_study_events;
create policy politics_study_events_select_own
  on public.politics_study_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists politics_study_events_insert_own
  on public.politics_study_events;
create policy politics_study_events_insert_own
  on public.politics_study_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Least privilege: anonymous users receive no rights; signed-in users can
-- upsert their state/profile and can only select or append study events.
revoke all on table public.politics_user_state from anon, authenticated;
revoke all on table public.politics_profile from anon, authenticated;
revoke all on table public.politics_study_events from anon, authenticated;

grant select on table public.politics_user_state to authenticated;
grant select, insert, update
  on table public.politics_profile to authenticated;
grant select, insert
  on table public.politics_study_events to authenticated;

revoke all on sequence public.politics_study_events_id_seq from anon;
revoke all on sequence public.politics_study_events_id_seq from authenticated;
grant usage on sequence public.politics_study_events_id_seq to authenticated;

comment on table public.politics_user_state is
  'Latest JSON study-state snapshot; exactly one row per Supabase Auth user.';
comment on table public.politics_profile is
  'Optional per-user MTI politics study preferences.';
comment on table public.politics_study_events is
  'Authenticated per-user append-only study activity stream.';
comment on column public.politics_study_events.created_at is
  'Authoritative server insertion time; occurred_at is the client event time.';

commit;
