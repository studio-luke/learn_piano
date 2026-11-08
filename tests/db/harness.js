// ===== DB 테스트 도구: supabase/schema.sql을 컴퓨터 안의 가짜 Postgres(PGlite)에서 실제로 실행 =====
// PGlite(@electric-sql/pglite)는 Postgres를 WASM으로 만든 것이라 설치·서버 없이 node 안에서 SQL이 돌아가요.
// Supabase에만 있는 것들을 최소한으로 흉내 내요 (2026-11-09, 이전 채팅의 임시 스크립트를 저장소로 옮김):
//   - anon / authenticated 역할 (Supabase가 로그인 안 한 사람 / 로그인한 사람에게 주는 DB 역할)
//   - auth.users 표와 auth.uid() — 진짜 Supabase는 로그인 토큰에서 사용자 id를 꺼내지만, 여기선 설정값 app.uid로 대신
//   - extensions(pgcrypto 함수), storage 스키마 — schema.sql이 참조하는 이름만 맞춰 둔 가짜
//   - pg_cron 줄은 PGlite에 없어서 빼고 실행 (탈퇴 자동 삭제 예약)
// 사용법은 tests/db.test.js 참고.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

/** schema.sql 글자 (pg_cron 줄 제외) */
export const schemaSQL = () => fs.readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8")
  .split("\n").filter(l => !/pg_cron|cron\./.test(l)).join("\n");

/** 빈 DB를 만들고 Supabase 흉내 + schema.sql을 두 번 실행 (두 번째는 "다시 실행해도 안전한지" 검사) */
export async function bootDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    -- Supabase는 새 표에 anon/authenticated 권한을 기본으로 줌 → 같은 조건에서 schema.sql의 revoke가 제대로 막는지 보려고 똑같이
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema extensions;
    create function extensions.gen_random_bytes(int) returns bytea language sql as $f$ select decode(md5(random()::text), 'hex') $f$;
    create function extensions.hmac(bytea, bytea, text) returns bytea language sql as $f$ select decode(md5(encode($1, 'hex') || encode($2, 'hex')), 'hex') $f$;
    create function extensions.gen_salt(text) returns text language sql as $f$ select 'salt' $f$;
    create function extensions.crypt(text, text) returns text language sql as $f$ select md5($1) $f$;
    grant usage on schema extensions to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);`);
  const sql = schemaSQL();
  await db.exec(sql);
  await db.exec(sql);
  return db;
}

// 테스트용 사용자 id
export const A = "00000000-0000-0000-0000-00000000000a";    // 관리자(선생님)
export const S1 = "00000000-0000-0000-0000-000000000001";   // 학생 1
export const S2 = "00000000-0000-0000-0000-000000000002";   // 학생 2

/** 가입시키기: auth.users에 넣으면 handle_new_user 트리거가 profiles를 만듦. A는 관리자로 */
export async function addUsers(db, list = [[A, "admin"], [S1, "s1"], [S2, "s2"]]) {
  const meta = n => JSON.stringify({ nickname: n, full_name: n + " 이름", preferred_lang: "ko", age14: true, terms_version: "x" });
  for (const [id, n] of list) await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, n + "@x", meta(n)]);
  await db.query("update public.profiles set role='admin' where id=$1", [A]);
}

/** 그 사용자로 로그인한 것처럼(authenticated 역할 + auth.uid()) SQL 실행 — RLS·권한이 실제처럼 적용됨 */
export async function asUser(db, uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role;"); }
}

/** 실패해야 하는 SQL: 오류가 나면 true */
export async function fails(fn) {
  try { await fn(); return false; } catch { return true; }
}
