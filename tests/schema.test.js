// supabase/schema.sql 검사 (DB 없이 글자만 읽어서).  실행: npm test
// 이 저장소에서는 DB를 직접 돌려볼 수 없어서, 바꿀 때 흔히 나는 실수 두 가지를 잡아요 (2026-11-08, 연습 구분 mode를 넣으며 추가):
//   1) 함수의 매개변수를 바꿨는데 grant/revoke 줄의 형식 목록을 안 고침 → 실행 시 오류, 또는 사이트가 그 함수를 못 부름
//   2) 사이트(sb.rpc)가 넘기는 이름이 함수 매개변수에 없음 → 호출 실패
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const js = ["account/account.js", "account/auth-dialog.js"].map(f => fs.readFileSync(new URL("../src/assets/js/" + f, import.meta.url), "utf8")).join("\n");

// 괄호 짝을 맞춰 "( … )" 안쪽을 꺼냄
function inside(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error("괄호가 닫히지 않음");
}
// 최상위 쉼표로 나누기
function split(list) {
  const out = []; let depth = 0, cur = "";
  for (const c of list) {
    if (c === "(") depth++; else if (c === ")") depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// 만든 함수: 이름 → [{ names, types }] (마지막 정의가 실제 정의)
const defs = {};
for (const m of sql.matchAll(/create or replace function public\.(\w+)\s*\(/g)) {
  const params = split(inside(sql, m.index + m[0].length - 1)).map(p => p.replace(/\s+default\s+[\s\S]*$/i, "").trim().split(/\s+/));
  defs[m[1]] = { names: params.map(p => p[0]), types: params.map(p => p.slice(1).join(" ")) };
}

test("schema: every grant/revoke names a function signature that is actually created", () => {
  for (const m of sql.matchAll(/(?:grant|revoke) execute on function public\.(\w+)\s*\(([^)]*)\)/g)) {
    const d = defs[m[1]];
    assert.ok(d, `없는 함수: ${m[1]}`);
    const types = m[2].split(",").map(s => s.trim()).filter(Boolean);
    assert.deepStrictEqual(types, d.types, `${m[1]}의 grant/revoke 형식 목록이 정의와 다름`);
  }
});

test("schema: every sb.rpc call from the site uses an existing function and its parameter names", () => {
  for (const m of js.matchAll(/sb\.rpc\("(\w+)"(?:,\s*\{([^}]*)\})?/g)) {
    const d = defs[m[1]];
    assert.ok(d, `사이트가 부르는 함수가 schema.sql에 없음: ${m[1]}`);
    const keys = (m[2] || "").split(",").map(s => s.split(":")[0].trim()).filter(Boolean);
    for (const k of keys) assert.ok(d.names.includes(k), `${m[1]}에 매개변수 ${k}가 없음`);
  }
});

test("schema: tables shared by both practices carry the mode column (2026-11-08)", () => {
  for (const t of ["practice_log", "timer_sessions", "practice_stats", "review_queue"]) {
    assert.ok(new RegExp(`alter table public\\.${t} add column if not exists mode text not null default 'play'`).test(sql), t);
  }
  assert.ok(/primary key \(user_id, mode\)/.test(sql) && /primary key \(user_id, mode, symbol\)/.test(sql));
});
