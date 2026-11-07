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

-- ---------- keep the auth email language in step with the profile ----------
-- Supabase's email templates (docs/supabase-email-templates.md) pick the language from the user metadata
-- (.Data.preferred_lang), which is only written at sign-up. When the site changes profiles.preferred_lang
-- (language menu while logged in), copy it into the metadata so the next password-reset email uses it.
create or replace function public.sync_lang_to_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('preferred_lang', new.preferred_lang)
    where id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_lang_to_auth() from public, anon, authenticated;

drop trigger if exists profiles_sync_lang on public.profiles;
create trigger profiles_sync_lang after update of preferred_lang on public.profiles
  for each row when (old.preferred_lang is distinct from new.preferred_lang)
  execute function public.sync_lang_to_auth();

-- one-time catch-up for members who changed the language before this trigger existed (safe to run again)
update auth.users u
  set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('preferred_lang', p.preferred_lang)
  from public.profiles p
  where p.id = u.id and u.raw_user_meta_data ->> 'preferred_lang' is distinct from p.preferred_lang;

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
-- 2026-11-06, timer: ms from the question appearing to the right answer (capped at 5 minutes).
-- Members exist, so nullable — and null is normal anyway: timer off, 정답 확인, or skipped after a miss.
alter table public.practice_log add column if not exists duration_ms integer check (duration_ms between 0 and 300000);

-- 2026-11-06, timer sessions: one row each time the timer is turned on, with the practice settings at that moment
-- (the timer needs 5+ chord types and, with option B, all seven white keys — so nobody times a narrow set of easy chords).
-- Settings are locked while the timer runs, so one session = one set of settings. Timed records point to their session.
create table if not exists public.timer_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,                  -- null: still on, or the page was closed with the timer on
  settings jsonb not null                -- { types: [...], optB, bases: [pitch classes], optC, cMax, optD, optE, review }
);
-- 2026-11-06: questions that vanished without a result while being timed (timer turned off mid-question,
-- connection lost, page closed) — shown on the teacher's page, to spot dodging hard questions
alter table public.timer_sessions add column if not exists abandoned integer not null default 0;
create index if not exists timer_sessions_user on public.timer_sessions (user_id, started_at);
alter table public.practice_log add column if not exists timer_session bigint references public.timer_sessions (id) on delete set null;

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
alter table public.timer_sessions enable row level security;
alter table public.practice_stats enable row level security;
alter table public.review_queue enable row level security;

drop policy if exists "practice_log: read own, admin reads all" on public.practice_log;
create policy "practice_log: read own, admin reads all" on public.practice_log
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "timer_sessions: read own, admin reads all" on public.timer_sessions;
create policy "timer_sessions: read own, admin reads all" on public.timer_sessions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "practice_stats: read own, admin reads all" on public.practice_stats;
create policy "practice_stats: read own, admin reads all" on public.practice_stats
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "review_queue: read own, admin reads all" on public.review_queue;
create policy "review_queue: read own, admin reads all" on public.review_queue
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Supabase grants new tables to anon/authenticated by default: take that back, then allow reading only
revoke all on public.practice_log, public.practice_stats, public.review_queue, public.timer_sessions from anon, authenticated;
grant select on public.practice_log, public.practice_stats, public.review_queue, public.timer_sessions to authenticated;

-- one finished question. p_day is the student's local date (accepted within a day of the server's).
-- More than 1,000 questions a day are ignored, so a script cannot pile up records.
drop function if exists public.record_attempt(text, text, boolean, date, boolean, jsonb);            -- before p_ms
drop function if exists public.record_attempt(text, text, boolean, date, boolean, jsonb, integer);   -- before p_session
-- p_ms / p_session: time and timer session when the timer was on. A time is kept only with the user's own session
-- that is still on (or ended in the last 2 minutes — the last record may arrive after the timer was turned off).
create or replace function public.record_attempt(p_quality text, p_symbol text, p_first boolean, p_day date,
  p_review boolean default false, p_spec jsonb default null, p_ms integer default null, p_session bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sess bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.profiles where id = uid and deleted_at is null) then
    return;   -- leaving (7-day grace period): nothing is recorded
  end if;
  -- the time counts only with the user's own timer session, and (outside 틀린 문제 다시 풀기) only for a question
  -- the session's settings could have asked — so a doctored page cannot time easy chords outside the saved settings
  select id into sess from public.timer_sessions
    where id = p_session and user_id = uid and (ended_at is null or ended_at > now() - interval '2 minutes')
      and (coalesce(p_review, false) or public.fits_settings(settings, p_quality, p_symbol));
  if p_day is null or p_day not between current_date - 1 and current_date + 1 then
    raise exception 'bad day';
  end if;
  if p_first is null or coalesce(p_quality, '') !~ '^[A-Za-z0-9]{1,8}$' or char_length(coalesce(p_symbol, '')) not between 1 and 40
     or (p_spec is not null and pg_column_size(p_spec) > 600) or (p_ms is not null and p_ms not between 0 and 300000) then
    raise exception 'bad record';
  end if;
  if (select count(*) from public.practice_log where user_id = uid and day = p_day) >= 1000 then
    return;
  end if;

  insert into public.practice_log (user_id, day, quality, symbol, first_try, review, duration_ms, timer_session)
    values (uid, p_day, p_quality, p_symbol, p_first, coalesce(p_review, false), case when sess is null then null else p_ms end, sess);

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
revoke execute on function public.record_attempt(text, text, boolean, date, boolean, jsonb, integer, bigint) from public, anon;
grant execute on function public.record_attempt(text, text, boolean, date, boolean, jsonb, integer, bigint) to authenticated;

-- timer on: checks the rule (5+ chord types; with option B, 7+ roots — user decision 2026-11-06) and opens a session.
-- A session left open (page closed with the timer on) is closed first.
create or replace function public.start_timer_session(p_settings jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_settings is null or jsonb_typeof(p_settings -> 'types') <> 'array' or pg_column_size(p_settings) > 2000 then
    raise exception 'bad settings';
  end if;
  if jsonb_array_length(p_settings -> 'types') < 5 then
    raise exception 'timer needs 5 chord types';
  end if;
  if coalesce((p_settings ->> 'optB')::boolean, false)
     and (jsonb_typeof(p_settings -> 'bases') <> 'array' or jsonb_array_length(p_settings -> 'bases') < 7) then
    raise exception 'timer needs 7 roots';
  end if;
  update public.timer_sessions set ended_at = now() where user_id = uid and ended_at is null;
  insert into public.timer_sessions (user_id, settings) values (uid, p_settings) returning id into sid;
  return sid;
end;
$$;
revoke execute on function public.start_timer_session(jsonb) from public, anon;
grant execute on function public.start_timer_session(jsonb) to authenticated;

-- timer off (or page closed): end time and how many timed questions were abandoned
drop function if exists public.end_timer_session(bigint);   -- before p_abandoned
create or replace function public.end_timer_session(p_session bigint, p_abandoned integer default 0)
returns void language sql security definer set search_path = '' as $$
  update public.timer_sessions set ended_at = now(), abandoned = abandoned + least(greatest(coalesce(p_abandoned, 0), 0), 1000)
  where id = p_session and user_id = auth.uid() and ended_at is null;
$$;
revoke execute on function public.end_timer_session(bigint, integer) from public, anon;
grant execute on function public.end_timer_session(bigint, integer) to authenticated;

-- the root (베이스) of a chord as asked: its leading note name, e.g. 'F♯' of 'F♯m7(♭5)'
create or replace function public.chord_root(symbol text)
returns text language sql immutable set search_path = '' as $$
  select substring(symbol from '^[A-G](?:𝄫|𝄪|♭|♯)?');
$$;

-- the tensions of a chord as asked (텐션 통계): what is written in the parentheses — C7(♭9,13) → {♭9, 13} — plus the
-- number in the name of a tension chord (M9 m9 9 → 9, M13 13 → 13, m11 → 11) and 'alt' for 7alt.
-- Not tensions: the ♭5 of m7(♭5), the ♯5 of M7(♯5) (= augM7) and the 9 of 6(9).
create or replace function public.chord_tensions(quality text, symbol text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(x), '{}') from (
    select unnest(case quality when '7alt' then array['alt'] when 'M9' then array['9'] when 'm9' then array['9']
      when 'dom9' then array['9'] when 'M13' then array['13'] when 'dom13' then array['13'] when 'm11' then array['11']
      else '{}'::text[] end) as x
    union all
    select trim(t) from unnest(string_to_array(substring(symbol from '\(([^)]*)\)$'), ',')) as t
    where not (quality = 'm7b5' and trim(t) = '♭5') and not (quality = 'augM7' and trim(t) = '♯5') and quality <> '69'
  ) s where x <> '';
$$;

-- the pitch class (0 = C … 11 = B) of a chord's root, e.g. 6 for 'F♯m7' and 'G♭7'
create or replace function public.chord_root_pc(symbol text)
returns integer language sql immutable set search_path = '' as $$
  select ((case substr(symbol, 1, 1) when 'C' then 0 when 'D' then 2 when 'E' then 4 when 'F' then 5 when 'G' then 7
      when 'A' then 9 when 'B' then 11 end)
    + case substr(public.chord_root(symbol), 2) when '♯' then 1 when '♭' then -1 when '𝄪' then 2 when '𝄫' then -2 else 0 end + 12) % 12;
$$;

-- could the practice settings of a timer session have asked this question?
-- chord type chosen; root among the chosen ones (option B); tensions only with option C and at most cMax of them
-- (tension chords and 7alt count their own number); C♭ E♯ A♯ D♯ G♯ B♯ F♭ roots only with option E.
create or replace function public.fits_settings(st jsonb, quality text, symbol text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    (st -> 'types') ? (case when quality = '7alt' then 'dom7' else quality end)
    and (not coalesce((st ->> 'optB')::boolean, false) or (st -> 'bases') @> jsonb_build_array(public.chord_root_pc(symbol)))
    and (case when quality = '7alt' then coalesce((st ->> 'optC')::boolean, false)
         else cardinality(public.chord_tensions(quality, symbol)) - (case when quality in ('M9', 'm9', 'dom9', 'M13', 'dom13', 'm11') then 1 else 0 end)
           <= (case when coalesce((st ->> 'optC')::boolean, false) then coalesce((st ->> 'cMax')::int, 1) else 0 end) end)
    and (coalesce((st ->> 'optE')::boolean, false) or public.chord_root(symbol) in ('C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B')),
    false);
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
    -- average time per question (all time), over the questions that have a time
    -- review (틀린 문제 다시 풀기) times are kept but left out of every average: those few questions repeat
    'time', (select jsonb_build_object('ms', round(avg(duration_ms) filter (where not review)), 't', count(duration_ms) filter (where not review))
      from public.practice_log where user_id = p_user),
    -- per row: n questions, ok right first try, ms average time, t questions with a time
    'byQuality', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'n', n, 'ok', ok, 'ms', ms, 't', tc)) from (
      select quality, count(*) as n, count(*) filter (where first_try) as ok, round(avg(duration_ms) filter (where not review)) as ms, count(duration_ms) filter (where not review) as tc
      from public.practice_log where user_id = p_user and day between since and until group by quality) x), '[]'::jsonb),
    'byRoot', coalesce((select jsonb_agg(jsonb_build_object('r', r, 'n', n, 'ok', ok, 'ms', ms, 't', tc)) from (
      select public.chord_root(symbol) as r, count(*) as n, count(*) filter (where first_try) as ok, round(avg(duration_ms) filter (where not review)) as ms, count(duration_ms) filter (where not review) as tc
      from public.practice_log where user_id = p_user and day between since and until group by 1) x), '[]'::jsonb),
    -- per chord type and tension (M7's 9 apart from m7's 9); src/stats.js folds M9 / 13 … into their seventh chord
    'byTension', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'x', x, 'n', n, 'ok', ok, 'ms', ms, 't', tc)) from (
      select quality, x, count(*) as n, count(*) filter (where first_try) as ok, round(avg(duration_ms) filter (where not review)) as ms, count(duration_ms) filter (where not review) as tc
      from public.practice_log, unnest(public.chord_tensions(quality, symbol)) as x
      where user_id = p_user and day between since and until group by quality, x) x), '[]'::jsonb),
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

-- extra numbers for the teacher's view of one student (admin only): all-time results per chord type,
-- per root and per tension (for 약점), practice habits, and the 50 latest questions
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
    'nickname', (select nickname from public.profiles where id = p_user),
    'full_name', (select full_name from public.profiles where id = p_user),
    'joined', (select created_at from public.profiles where id = p_user),
    'sessions', (select count(*) from public.timer_sessions where user_id = p_user),
    'abandoned', (select coalesce(sum(abandoned), 0) from public.timer_sessions where user_id = p_user),
    'byQuality', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'n', n, 'ok', ok)) from (
      select quality, count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log where user_id = p_user group by quality) x), '[]'::jsonb),
    'byRoot', coalesce((select jsonb_agg(jsonb_build_object('r', r, 'n', n, 'ok', ok)) from (
      select public.chord_root(symbol) as r, count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log where user_id = p_user group by 1) x), '[]'::jsonb),
    'byTension', coalesce((select jsonb_agg(jsonb_build_object('q', quality, 'x', x, 'n', n, 'ok', ok)) from (
      select quality, x, count(*) as n, count(*) filter (where first_try) as ok
      from public.practice_log, unnest(public.chord_tensions(quality, symbol)) as x
      where user_id = p_user group by quality, x) x), '[]'::jsonb),
    'days', (select count(distinct day) from public.practice_log where user_id = p_user),
    'lastDay', (select max(day) from public.practice_log where user_id = p_user),
    'week', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'n', n) order by day) from (
      select day, count(*) as n from public.practice_log
      where user_id = p_user and day between today - 6 and today group by day) w), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'symbol', symbol, 'q', quality, 'first', first_try, 'review', review, 'ms', duration_ms) order by id desc) from (
      select id, day, symbol, quality, first_try, review, duration_ms from public.practice_log
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
