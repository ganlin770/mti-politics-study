begin;

-- Server-side accounting for the paid AI proxy. Only request metadata is kept;
-- card contents, learner questions, prompts and model responses are never stored.
create table if not exists public.politics_ai_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  effort text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint politics_ai_requests_mode_chk
    check (mode in ('explain', 'followup')),
  constraint politics_ai_requests_effort_chk
    check (effort in ('low', 'high', 'max'))
);

create index if not exists politics_ai_requests_user_created_idx
  on public.politics_ai_requests (user_id, created_at desc);

create index if not exists politics_ai_requests_created_idx
  on public.politics_ai_requests (created_at desc);

alter table public.politics_ai_requests enable row level security;

-- Claiming quota and inserting the usage row happen in one transaction under a
-- per-user advisory lock, so concurrent tabs cannot race past either limit.
create or replace function public.politics_claim_ai_quota(
  p_request_id uuid,
  p_mode text,
  p_effort text
)
returns table (
  allowed boolean,
  minute_count integer,
  daily_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  -- Avoid PostgreSQL's CURRENT_TIME keyword, which resolves to timetz even
  -- when a PL/pgSQL variable with the same spelling is declared.
  v_statement_time timestamptz := statement_timestamp();
  china_day_start timestamptz;
  china_next_day timestamptz;
  recent_minute_count integer := 0;
  current_daily_count integer := 0;
  global_recent_minute_count integer := 0;
  global_daily_count integer := 0;
  minute_retry integer := 0;
  global_minute_retry integer := 0;
  daily_retry integer := 0;
  constant_minute_limit constant integer := 10;
  constant_daily_limit constant integer := 100;
  constant_global_minute_limit constant integer := 12;
  constant_global_daily_limit constant integer := 120;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_request_id is null
    or p_mode is null
    or p_mode not in ('explain', 'followup')
    or p_effort is null
    or p_effort not in ('low', 'high', 'max') then
    raise exception 'invalid quota claim' using errcode = '22023';
  end if;

  -- The global lock bounds paid usage even if someone creates many accounts;
  -- the user lock keeps each account's own counters deterministic as well.
  perform pg_advisory_xact_lock(hashtextextended('politics-ai-global', 0));
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  china_day_start := (
    date_trunc('day', v_statement_time at time zone 'Asia/Shanghai')
    at time zone 'Asia/Shanghai'
  );
  china_next_day := china_day_start + interval '1 day';

  select count(*)::integer
  into recent_minute_count
  from public.politics_ai_requests as request_log
  where request_log.user_id = current_user_id
    and request_log.created_at > v_statement_time - interval '1 minute';

  select count(*)::integer
  into current_daily_count
  from public.politics_ai_requests as request_log
  where request_log.user_id = current_user_id
    and request_log.created_at >= china_day_start
    and request_log.created_at < china_next_day;

  select count(*)::integer
  into global_recent_minute_count
  from public.politics_ai_requests as request_log
  where request_log.created_at > v_statement_time - interval '1 minute';

  select count(*)::integer
  into global_daily_count
  from public.politics_ai_requests as request_log
  where request_log.created_at >= china_day_start
    and request_log.created_at < china_next_day;

  if recent_minute_count >= constant_minute_limit then
    select greatest(
      1,
      ceil(
        extract(epoch from (
          min(request_log.created_at) + interval '1 minute' - v_statement_time
        ))
      )::integer
    )
    into minute_retry
    from public.politics_ai_requests as request_log
    where request_log.user_id = current_user_id
      and request_log.created_at > v_statement_time - interval '1 minute';
  end if;

  if global_recent_minute_count >= constant_global_minute_limit then
    select greatest(
      1,
      ceil(
        extract(epoch from (
          min(request_log.created_at) + interval '1 minute' - v_statement_time
        ))
      )::integer
    )
    into global_minute_retry
    from public.politics_ai_requests as request_log
    where request_log.created_at > v_statement_time - interval '1 minute';
    minute_retry := greatest(minute_retry, global_minute_retry);
  end if;

  if current_daily_count >= constant_daily_limit then
    daily_retry := greatest(
      1,
      ceil(
        extract(epoch from (china_next_day - v_statement_time))
      )::integer
    );
  end if;

  if global_daily_count >= constant_global_daily_limit then
    daily_retry := greatest(
      daily_retry,
      1,
      ceil(
        extract(epoch from (china_next_day - v_statement_time))
      )::integer
    );
  end if;

  if minute_retry > 0 or daily_retry > 0 then
    allowed := false;
    minute_count := recent_minute_count;
    daily_count := current_daily_count;
    retry_after_seconds := greatest(minute_retry, daily_retry);
    return next;
    return;
  end if;

  insert into public.politics_ai_requests (
    request_id,
    user_id,
    mode,
    effort,
    created_at
  ) values (
    p_request_id,
    current_user_id,
    p_mode,
    p_effort,
    v_statement_time
  );

  allowed := true;
  minute_count := recent_minute_count + 1;
  daily_count := current_daily_count + 1;
  retry_after_seconds := 0;
  return next;
end;
$$;

revoke all on table public.politics_ai_requests from public, anon, authenticated;
revoke all on function public.politics_claim_ai_quota(uuid, text, text) from public;
revoke all on function public.politics_claim_ai_quota(uuid, text, text) from anon;
grant execute on function public.politics_claim_ai_quota(uuid, text, text) to authenticated;

comment on table public.politics_ai_requests is
  'Metadata-only claims used to enforce per-user AI request quotas.';
comment on function public.politics_claim_ai_quota(uuid, text, text) is
  'Atomically enforces per-user 10/minute and 100/day plus global 12/minute and 120/day limits.';

commit;
