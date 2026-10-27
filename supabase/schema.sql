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

-- ---------- make the site owner admin (run separately, after signing up with your own e-mail) ----------
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
