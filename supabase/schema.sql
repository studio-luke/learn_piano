-- ChordOven account schema. Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: every object is dropped and recreated (profiles data is kept).
-- Roles: everyone signs up as 'student'. The site owner is made 'admin' by hand (see the last block).
-- Adding a sign-up field later: see "회원가입 항목 추가" in docs/supabase-setup.md — new columns go in the
-- "added fields" block below; once members exist, add them nullable so existing members are not broken.

-- ---------- profiles: one row per account ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  full_name text not null check (char_length(full_name) between 1 and 50),   -- seen only by the member and the admin
  preferred_lang text not null check (preferred_lang in ('ko', 'en', 'ja', 'zh')),
  role text not null default 'student' check (role in ('student', 'admin')),
  settings jsonb,                                  -- practice settings, synced from the trainer
  age14_confirmed boolean not null default false,  -- "I am 14 or older" checked at sign-up
  terms_version text,                              -- version of terms/privacy policy agreed to at sign-up
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- added fields ----------
-- For a profiles table created by an earlier version of this file. Fields added while there are no members
-- can be required right away (set not null); once members exist, add new columns nullable — see the guide.
-- 2026-10-27, no members yet: full name and preferred language, both required
alter table public.profiles add column if not exists full_name text check (char_length(full_name) between 1 and 50);
alter table public.profiles add column if not exists preferred_lang text check (preferred_lang in ('ko', 'en', 'ja', 'zh'));
alter table public.profiles alter column full_name set not null;
alter table public.profiles alter column preferred_lang set not null;
-- 2026-10-27: account deletion grace period — null means active, a time means "asked to leave at"
alter table public.profiles add column if not exists deleted_at timestamptz;

alter table public.profiles enable row level security;

-- admin check that does not trip over the profiles policies themselves
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles: read own, admin reads all" on public.profiles;
create policy "profiles: read own, admin reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- the browser may read profiles and change only these columns — never role or consent fields
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, settings, full_name, preferred_lang) on public.profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- sign-up: create the profile, enforce age and consent ----------
-- Sign-up sends nickname / full_name / preferred_lang / age14 / terms_version as user metadata (src/account.js).
-- A sign-up without the 14+ confirmation or without agreeing to the terms is rejected here,
-- so skipping the checkboxes in the browser does not get around it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce((meta ->> 'age14')::boolean, false) is not true then
    raise exception 'age14_required';
  end if;
  if coalesce(meta ->> 'terms_version', '') = '' then
    raise exception 'terms_required';
  end if;
  if coalesce(trim(meta ->> 'full_name'), '') = '' then
    raise exception 'full_name_required';
  end if;
  if coalesce(meta ->> 'preferred_lang', '') not in ('ko', 'en', 'ja', 'zh') then
    raise exception 'preferred_lang_required';
  end if;
  insert into public.profiles (id, nickname, full_name, preferred_lang, age14_confirmed, terms_version)
  values (
    new.id,
    left(coalesce(nullif(trim(meta ->> 'nickname'), ''), split_part(new.email, '@', 1)), 20),
    left(trim(meta ->> 'full_name'), 50),
    meta ->> 'preferred_lang',
    true,
    meta ->> 'terms_version'
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- account deletion (회원 탈퇴) with a 7-day grace period ----------
-- Leaving only marks the profile (deleted_at). Logging in within 7 days offers to restore the account;
-- after that the hourly cron job below deletes the auth user, which also deletes the profile (on delete cascade).
-- deleted_at is not in the browser's update grant, so it changes only through these functions.
drop function if exists public.delete_own_account();   -- old immediate deletion

create or replace function public.request_account_deletion()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  marked timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles set deleted_at = coalesce(deleted_at, now()) where id = auth.uid()
    returning deleted_at into marked;
  return marked + interval '7 days';   -- when the account will be gone
end;
$$;
revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.restore_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles set deleted_at = null where id = auth.uid();
end;
$$;
revoke execute on function public.restore_account() from public, anon;
grant execute on function public.restore_account() to authenticated;

create or replace function public.purge_deleted_accounts()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from auth.users
    where id in (select id from public.profiles where deleted_at <= now() - interval '7 days');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

-- hourly purge (pg_cron; on Supabase it can also be turned on under Integrations → Cron)
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-deleted-accounts';
select cron.schedule('purge-deleted-accounts', '17 * * * *', 'select public.purge_deleted_accounts()');

-- ---------- practice records (연습 기록, 2026-11-05) ----------
-- practice_log: one row per question (date only, no time). practice_stats: running totals per account.
-- review_queue: questions missed on the first try, for 틀린 문제 다시 풀기 — a question leaves the queue after
-- it is answered right on the first try twice in review mode.
-- The browser only reads these (own rows; the admin reads all). Every write goes through record_attempt(),
-- which adds 1 to the totals in the database, so two devices practising at once never overwrite each other.
-- All three tables hang off profiles with on delete cascade, so the account purge removes them too.
create table if not exists public.practice_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,                     -- the student's local date
  quality text not null,                 -- chord type id from src/engine.js (M7, dom7, m7b5 …) or 7alt
  symbol text not null,                  -- the chord as asked, e.g. C7(♭9)
  first_try boolean not null,            -- right on the first 채점 (정답); false = 오답 or 정답 확인
  review boolean not null default false  -- asked in 틀린 문제 다시 풀기
);
create index if not exists practice_log_user_day on public.practice_log (user_id, day);

create table if not exists public.practice_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total integer not null default 0,
  first_correct integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.review_queue (
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  quality text not null,
  spec jsonb not null,                   -- what the trainer needs to ask the same question again
  hits smallint not null default 0,      -- first-try right answers in review mode
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.practice_log enable row level security;
alter table public.practice_stats enable row level security;
alter table public.review_queue enable row level security;

drop policy if exists "practice_log: read own, admin reads all" on public.practice_log;
create policy "practice_log: read own, admin reads all" on public.practice_log
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "practice_stats: read own, admin reads all" on public.practice_stats;
create policy "practice_stats: read own, admin reads all" on public.practice_stats
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "review_queue: read own, admin reads all" on public.review_queue;
create policy "review_queue: read own, admin reads all" on public.review_queue
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Supabase grants new tables to anon/authenticated by default: take that back, then allow reading only
revoke all on public.practice_log, public.practice_stats, public.review_queue from anon, authenticated;
grant select on public.practice_log, public.practice_stats, public.review_queue to authenticated;

-- one finished question. p_day is the student's local date (accepted within a day of the server's).
-- More than 1,000 questions a day are ignored, so a script cannot pile up records.
create or replace function public.record_attempt(p_quality text, p_symbol text, p_first boolean, p_day date,
  p_review boolean default false, p_spec jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.profiles where id = uid and deleted_at is null) then
    return;   -- leaving (7-day grace period): nothing is recorded
  end if;
  if p_day is null or p_day not between current_date - 1 and current_date + 1 then
    raise exception 'bad day';
  end if;
  if p_first is null or coalesce(p_quality, '') !~ '^[A-Za-z0-9]{1,8}$' or char_length(coalesce(p_symbol, '')) not between 1 and 40
     or (p_spec is not null and pg_column_size(p_spec) > 600) then
    raise exception 'bad record';
  end if;
  if (select count(*) from public.practice_log where user_id = uid and day = p_day) >= 1000 then
    return;
  end if;

  insert into public.practice_log (user_id, day, quality, symbol, first_try, review)
    values (uid, p_day, p_quality, p_symbol, p_first, coalesce(p_review, false));

  insert into public.practice_stats as s (user_id, total, first_correct, streak, best_streak)
    values (uid, 1, p_first::int, p_first::int, p_first::int)
  on conflict (user_id) do update set
    total = s.total + 1,
    first_correct = s.first_correct + p_first::int,
    streak = case when p_first then s.streak + 1 else 0 end,
    best_streak = greatest(s.best_streak, case when p_first then s.streak + 1 else 0 end),
    updated_at = now();

  if coalesce(p_review, false) then
    if p_first then
      update public.review_queue set hits = hits + 1 where user_id = uid and symbol = p_symbol;
      delete from public.review_queue where user_id = uid and symbol = p_symbol and hits >= 2;
    end if;
  elsif not p_first and p_spec is not null then
    insert into public.review_queue (user_id, symbol, quality, spec) values (uid, p_symbol, p_quality, p_spec)
    on conflict (user_id, symbol) do update set spec = excluded.spec, hits = 0, added_at = now();
  end if;
end;
$$;
revoke execute on function public.record_attempt(text, text, boolean, date, boolean, jsonb) from public, anon;
grant execute on function public.record_attempt(text, text, boolean, date, boolean, jsonb) to authenticated;

-- the root (베이스) of a chord as asked: its leading note name, e.g. 'F♯' of 'F♯m7(♭5)'
create or replace function public.chord_root(symbol text)
returns text language sql immutable set search_path = '' as $$
  select substring(symbol from '^[A-G](?:𝄫|𝄪|♭|♯)?');
$$;

-- statistics for the 마이페이지 / 학생 통계 page: totals (all time), and per chord type, per root and per day over
-- the chosen range: '7d', '30d', '1y' (per month) or 'custom' (p_from..p_to, per month when longer than 62 days —
-- the same rule as src/stats.js). firstDay = the first practice day, the earliest date the calendar allows;
-- practiceDays = every date with practice (all time), marked with a dot on that calendar.
-- A student may ask only for their own; the admin for anyone.
drop function if exists public.practice_summary(uuid, text, date);   -- before the custom range was added
create or replace function public.practice_summary(p_user uuid, p_range text, p_today date,
  p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := p_today;
  since date;
  until date;
  monthly boolean;
begin
  if auth.uid() is null or (p_user <> auth.uid() and not public.is_admin()) then
    raise exception 'not allowed';
  end if;
  if today is null or today not between current_date - 1 and current_date + 1 then
    today := current_date;
  end if;
  until := today;
  if p_range = 'custom' and p_from is not null and p_to is not null then
    since := least(p_from, p_to);
    until := least(greatest(p_from, p_to), today);
  else
    since := case p_range when '7d' then today - 6 when '30d' then today - 29
      else (date_trunc('month', today) - interval '11 months')::date end;
  end if;
  monthly := p_range = '1y' or (p_range = 'custom' and until - since > 62);
  return jsonb_build_object(
    'since', since,
    'until', until,
    'firstDay', (select min(day) from public.practice_log where user_id = p_user),
    'practiceDays', coalesce((select jsonb_agg(d order by d) from (
      select distinct day as d from public.practice_log where user_id = p_user) pd), '[]'::jsonb),
    'totals', (select jsonb_build_object('total', total, 'first', first_correct, 'streak', streak, 'best', best_streak)
      from public.practice_stats where user_id = p_user),
    'byQuality', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'n', n, 'ok', ok)) from (
      select quality, count(*) as n, count(*) filter (where first_try) as ok from public.practice_log
      where user_id = p_user and day between since and until group by quality) x), '[]'::jsonb),
    'byRoot', coalesce((select jsonb_agg(jsonb_build_object('r', r, 'n', n, 'ok', ok)) from (
      select public.chord_root(symbol) as r, count(*) as n, count(*) filter (where first_try) as ok from public.practice_log
      where user_id = p_user and day between since and until group by 1) x), '[]'::jsonb),
    'byDay', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'n', n, 'ok', ok) order by d) from (
      select case when monthly then date_trunc('month', day)::date else day end as d,
        count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log where user_id = p_user and day between since and until group by 1) y), '[]'::jsonb),
    'review', coalesce((select jsonb_agg(jsonb_build_object('symbol', symbol, 'q', quality, 'hits', hits) order by added_at)
      from public.review_queue where user_id = p_user), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.practice_summary(uuid, text, date, date, date) from public, anon;
grant execute on function public.practice_summary(uuid, text, date, date, date) to authenticated;

-- extra numbers for the teacher's view of one student (admin only): all-time results per chord type and
-- per root (for 약점), practice habits, and the 50 latest questions
create or replace function public.student_overview(p_user uuid, p_today date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := p_today;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if today is null or today not between current_date - 1 and current_date + 1 then
    today := current_date;
  end if;
  return jsonb_build_object(
    'joined', (select created_at from public.profiles where id = p_user),
    'byQuality', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'n', n, 'ok', ok)) from (
      select quality, count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log where user_id = p_user group by quality) x), '[]'::jsonb),
    'byRoot', coalesce((select jsonb_agg(jsonb_build_object('r', r, 'n', n, 'ok', ok)) from (
      select public.chord_root(symbol) as r, count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log where user_id = p_user group by 1) x), '[]'::jsonb),
    'days', (select count(distinct day) from public.practice_log where user_id = p_user),
    'lastDay', (select max(day) from public.practice_log where user_id = p_user),
    'week', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'n', n) order by day) from (
      select day, count(*) as n from public.practice_log
      where user_id = p_user and day between today - 6 and today group by day) w), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'symbol', symbol, 'q', quality, 'first', first_try, 'review', review) order by id desc) from (
      select id, day, symbol, quality, first_try, review from public.practice_log
      where user_id = p_user order by id desc limit 50) r), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.student_overview(uuid, date) from public, anon;
grant execute on function public.student_overview(uuid, date) to authenticated;

-- the admin's student list (empty for everyone else)
create or replace function public.student_list()
returns table (id uuid, nickname text, full_name text, total integer, first_correct integer, last_day date)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nickname, p.full_name, coalesce(s.total, 0), coalesce(s.first_correct, 0),
    (select max(l.day) from public.practice_log l where l.user_id = p.id)
  from public.profiles p left join public.practice_stats s on s.user_id = p.id
  where public.is_admin() and p.role = 'student' and p.deleted_at is null
  order by p.nickname;
$$;
revoke execute on function public.student_list() from public, anon;
grant execute on function public.student_list() to authenticated;

-- ---------- make the site owner admin (run separately, after signing up with your own e-mail) ----------
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
