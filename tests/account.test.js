// 회원 기능 도우미·설정 안전 검사, 통계 계산, 번역 키 사용 검사.  실행: npm test
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Account from "../public/assets/js/account/helpers.js";
import { CONFIG } from "../public/assets/js/config.js";
import * as Stats from "../public/assets/js/stats/data.js";
import { Engine as E } from "../public/assets/js/core/engine.js";
import ko from "../public/assets/js/i18n/ko.js";
import en from "../public/assets/js/i18n/en.js";
import ja from "../public/assets/js/i18n/ja.js";
import zh from "../public/assets/js/i18n/zh.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");   // 사이트 파일
const STRINGS = { ko, en, ja, zh };
// 사이트의 HTML·JS 파일 내용 전부 (번역 키를 실제로 쓰는 곳을 찾으려고)
function siteSource() {
  const out = [];
  const skip = new Set(["i18n"]);   // 문구 파일 자체는 빼고
  const walk = dir => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (!skip.has(f.name)) walk(p); }
      else if (/\.(html|js)$/.test(f.name)) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(ROOT);
  return out.join("\n");
}

const jwt = payload => ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

test("config.js never holds a secret key", () => {
  if (!CONFIG.supabaseKey) return;   // 회원 기능 꺼짐
  assert.ok(Account.isPublicKey(CONFIG.supabaseKey), "public/assets/js/config.js: publishable/anon 키를 넣을 것 (secret/service_role 키 금지)");
  assert.match(CONFIG.supabaseUrl, /^https:\/\//);
});

test("isPublicKey: only anon/publishable keys pass", () => {
  assert.ok(Account.isPublicKey("sb_publishable_abc123"));
  assert.ok(Account.isPublicKey(jwt({ role: "anon", iss: "supabase" })));
  assert.ok(!Account.isPublicKey("sb_secret_abc123"));
  assert.ok(!Account.isPublicKey(jwt({ role: "service_role", iss: "supabase" })));
  assert.ok(!Account.isPublicKey(""));
  assert.ok(!Account.isPublicKey("not-a-key"));
});

test("errorKey maps Supabase errors to messages", () => {
  assert.strictEqual(Account.errorKey({ code: "invalid_credentials", status: 400 }), "errInvalid");
  assert.strictEqual(Account.errorKey({ code: "email_not_confirmed" }), "errNotConfirmed");
  assert.strictEqual(Account.errorKey({ code: "over_email_send_rate_limit", status: 429 }), "errRate");
  assert.strictEqual(Account.errorKey({ status: 429 }), "errRate");
  assert.strictEqual(Account.errorKey({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }), "errNetwork");
  assert.strictEqual(Account.errorKey({ code: "unexpected_failure", status: 500, message: "Database error saving new user" }), "errGeneric");
});

test("missingFields: members without a required field are asked to fill it in", () => {
  assert.deepStrictEqual(Account.missingFields({ full_name: null, nickname: "a" }), ["full_name"]);
  assert.deepStrictEqual(Account.missingFields({ full_name: "  " }), ["full_name"]);
  assert.deepStrictEqual(Account.missingFields({ full_name: "김학생" }), []);
});

test("langForTimeZone: sign-up language from the device region", () => {
  assert.strictEqual(Account.langForTimeZone("Asia/Seoul"), "ko");
  assert.strictEqual(Account.langForTimeZone("Asia/Tokyo"), "ja");
  assert.strictEqual(Account.langForTimeZone("Asia/Shanghai"), "zh");
  assert.strictEqual(Account.langForTimeZone("Asia/Taipei"), "zh");
  assert.strictEqual(Account.langForTimeZone("America/New_York"), "en");
  assert.strictEqual(Account.langForTimeZone(""), "en");
});

test("syncable keeps per-device options out of the account", () => {
  assert.deepStrictEqual(Account.syncable({ optB: true, kbd: true, kbdTouched: true, sound: false }), { optB: true, sound: false });
});

test("every error/message/view key the code uses exists in i18n", () => {
  const used = new Set([...siteSource().matchAll(/"((?:err|msg|view)[A-Z]\w*)"/g)].map(m => m[1]));
  assert.deepStrictEqual([...used].filter(k => !(k in ko)), []);
});

test("every data-i18n key in the pages exists in i18n", () => {
  const used = new Set([...siteSource().matchAll(/data-i18n(?:-aria|-title)?="(\w+)"/g)].map(m => m[1]));
  assert.deepStrictEqual([...used].filter(k => !(k in ko)), []);
});

test("every t(\"key\") in the scripts exists in i18n", () => {
  const used = new Set([...siteSource().matchAll(/\bt\("(\w+)"\s*[,)]/g)].map(m => m[1]));
  ["7d", "30d", "1y", "custom"].forEach(r => used.add("range" + r));   // t("range" + r)
  assert.deepStrictEqual([...used].filter(k => !(k in ko)), []);
});

test("delete account: the phrase to type is shown in the label of every language", () => {
  for (const [l, s] of Object.entries(STRINGS)) assert.ok(s.deleteTypeHTML.includes(`<b>${s.deletePhrase}</b>`), l);
});

test("stats: local date and chart slots", () => {
  assert.strictEqual(Stats.localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  const week = Stats.buckets("7d", "2026-03-02", [{ d: "2026-03-01", n: 5, ok: 3 }, { d: "2026-02-20", n: 9, ok: 9 }]);
  assert.deepStrictEqual(week.map(b => b.key), ["2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  assert.deepStrictEqual(week[5], { key: "2026-03-01", n: 5, ok: 3 });
  assert.strictEqual(week.reduce((s, b) => s + b.n, 0), 5);   // 기간 밖은 안 보임
  assert.strictEqual(Stats.buckets("30d", "2026-03-02", []).length, 30);
  const year = Stats.buckets("1y", "2026-03-15", [{ d: "2025-04-01", n: 2, ok: 1 }, { d: "2026-03-01T00:00:00.000Z", n: 4, ok: 4 }]);
  assert.strictEqual(year.length, 12);
  assert.deepStrictEqual([year[0].key, year[11].key], ["2025-04-01", "2026-03-01"]);
  assert.deepStrictEqual([year[0].n, year[11].n], [2, 4]);
});

test("stats: chord types follow the settings order, 7alt after 7", () => {
  const rows = [{ q: "m7b5" }, { q: "7alt" }, { q: "maj" }, { q: "dom7" }].map(r => ({ ...r, n: 1, ok: 1 }));
  assert.deepStrictEqual(Stats.qualityRows(rows, E.TYPES).map(r => r.q), ["maj", "dom7", "7alt", "m7b5"]);
});

test("stats: roots grouped by key, weak spots", () => {
  assert.deepStrictEqual(["C", "C♯", "D♭", "B♯", "E𝄪", "C♭", "F♯"].map(Stats.rootPc), [0, 1, 1, 0, 6, 11, 6]);
  const rows = Stats.rootRows([{ r: "C♯", n: 4, ok: 2 }, { r: "D♭", n: 6, ok: 5 }, { r: "C", n: 3, ok: 3 }]);
  assert.deepStrictEqual(rows.map(r => [r.pc, r.n, r.ok]), [[0, 3, 3], [1, 10, 7]]);
  const w = Stats.weakest([{ q: "a", n: 10, ok: 9 }, { q: "b", n: 4, ok: 0 }, { q: "c", n: 20, ok: 10 }, { q: "d", n: 8, ok: 8 }, { q: "e", n: 10, ok: 5 }]);
  assert.deepStrictEqual(w.map(r => r.q), ["c", "e", "a"]);   // b: 너무 적게 풂, d: 다 맞힘
});

test("stats: custom period — daily up to 62 days, monthly after, never past today", () => {
  const p = Stats.period("custom", "2026-11-05", { from: "2026-10-01", to: "2026-12-31" });
  assert.deepStrictEqual(p, { from: "2026-10-01", to: "2026-11-05", monthly: false });
  assert.strictEqual(Stats.buckets("custom", "2026-11-05", [], { from: "2026-10-01", to: "2026-11-05" }).length, 36);
  const swapped = Stats.period("custom", "2026-11-05", { from: "2026-11-01", to: "2026-10-20" });
  assert.deepStrictEqual([swapped.from, swapped.to], ["2026-10-20", "2026-11-01"]);
  const long = Stats.buckets("custom", "2026-11-05", [{ d: "2026-02-01", n: 3, ok: 2 }], { from: "2026-01-15", to: "2026-11-05" });
  assert.strictEqual(long.length, 11);
  assert.deepStrictEqual([long[0].key, long[1], long[10].key], ["2026-01-01", { key: "2026-02-01", n: 3, ok: 2 }, "2026-11-01"]);
  assert.strictEqual(Stats.period("1y", "2026-11-05").from, "2025-12-01");
});

test("stats: tensions per chord type (tension chords under their seventh), average times", () => {
  const tr = Stats.tensionRows([
    { q: "dom7", x: "13", n: 2, ok: 1, ms: 10000, t: 2 }, { q: "dom13", x: "13", n: 2, ok: 2, ms: 20000, t: 2 },   // 7(13) + 13 → 한 줄
    { q: "7alt", x: "alt", n: 1, ok: 0, ms: null, t: 0 }, { q: "m7", x: "9", n: 3, ok: 3, ms: null, t: 0 },
    { q: "M9", x: "9", n: 4, ok: 2, ms: null, t: 0 }, { q: "M7", x: "9", n: 1, ok: 1, ms: null, t: 0 }, { q: "dom7", x: "♭9", n: 1, ok: 1, ms: null, t: 0 },
  ], E.TYPES);
  assert.deepStrictEqual(tr.map(r => `${r.q}·${r.x}:${r.n}`), ["M7·9:5", "m7·9:3", "dom7·♭9:1", "dom7·13:4", "dom7·alt:1"]);
  assert.strictEqual(tr.find(r => r.x === "13").ms, 15000);
  // C♯와 D♭은 한 줄. 평균 시간은 시간이 기록된 문제 수만큼 비중
  const r = Stats.rootRows([{ r: "C♯", n: 4, ok: 2, ms: 10000, t: 1 }, { r: "D♭", n: 6, ok: 5, ms: 20000, t: 3 }, { r: "C", n: 2, ok: 2, ms: null, t: 0 }]);
  assert.deepStrictEqual(r.map(x => [x.pc, x.ms, x.t]), [[0, null, 0], [1, 17500, 4]]);
  const unit = n => n + "s";
  assert.deepStrictEqual([Stats.timeText(null, unit), Stats.timeText(12340, unit), Stats.timeText(65000, unit), Stats.timeText(300000, unit)], ["", "12.3s", "1:05", "5:00"]);
});
