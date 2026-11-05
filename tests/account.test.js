// Account helpers + config safety:  npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const Account = require("../src/account.js");
const CONFIG = require("../src/config.js");

const jwt = payload => ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

test("config.js never holds a secret key", () => {
  if (!CONFIG.supabaseKey) return;   // accounts off
  assert.ok(Account.isPublicKey(CONFIG.supabaseKey), "src/config.js: use the publishable/anon key, not the secret/service_role key");
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
  const s = Account.syncable({ optA: true, kbd: true, kbdTouched: true, sound: false });
  assert.deepStrictEqual(s, { optA: true, sound: false });
});

test("every error/message key the account code uses exists in i18n", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/account.js"), "utf8");
  const I18N = new Function(fs.readFileSync(path.join(__dirname, "../src/i18n.js"), "utf8") + "; return I18N;")();
  const used = new Set([...src.matchAll(/"((?:err|msg|view)[A-Z]\w*)"/g)].map(m => m[1]));
  used.add("deleteConfirm");
  const missing = [...used].filter(k => !(k in I18N.ko));
  assert.deepStrictEqual(missing, []);
});

test("every data-i18n key in ui.html exists in i18n", () => {
  const ui = fs.readFileSync(path.join(__dirname, "../src/ui.html"), "utf8");
  const I18N = new Function(fs.readFileSync(path.join(__dirname, "../src/i18n.js"), "utf8") + "; return I18N;")();
  const used = new Set([...ui.matchAll(/data-i18n(?:-aria|-title)?="(\w+)"/g)].map(m => m[1]));
  const missing = [...used].filter(k => !(k in I18N.ko));
  assert.deepStrictEqual(missing, []);
});

test("every t(\"key\") in the page scripts exists in i18n", () => {
  const I18N = new Function(fs.readFileSync(path.join(__dirname, "../src/i18n.js"), "utf8") + "; return I18N;")();
  const src = ["../src/ui.html", "../src/stats.js", "../src/account.js"].map(f => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");
  const used = new Set([...src.matchAll(/\bt\("(\w+)"\s*[,)]/g)].map(m => m[1]));
  ["7d", "30d", "1y"].forEach(r => used.add("range" + r));   // t("range" + r)
  const missing = [...used].filter(k => !(k in I18N.ko));
  assert.deepStrictEqual(missing, []);
});

const Stats = require("../src/stats.js");

test("stats: local date and chart slots", () => {
  assert.strictEqual(Stats.localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  const week = Stats.buckets("7d", "2026-03-02", [{ d: "2026-03-01", n: 5, ok: 3 }, { d: "2026-02-20", n: 9, ok: 9 }]);
  assert.deepStrictEqual(week.map(b => b.key), ["2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  assert.deepStrictEqual(week[5], { key: "2026-03-01", n: 5, ok: 3 });
  assert.strictEqual(week.reduce((s, b) => s + b.n, 0), 5);   // outside the range: not shown
  assert.strictEqual(Stats.buckets("30d", "2026-03-02", []).length, 30);
  const year = Stats.buckets("1y", "2026-03-15", [{ d: "2025-04-01", n: 2, ok: 1 }, { d: "2026-03-01T00:00:00.000Z", n: 4, ok: 4 }]);
  assert.strictEqual(year.length, 12);
  assert.deepStrictEqual([year[0].key, year[11].key], ["2025-04-01", "2026-03-01"]);
  assert.deepStrictEqual([year[0].n, year[11].n], [2, 4]);
});

test("stats: chord types follow the settings order, 7alt after 7", () => {
  const E = require("../src/engine.js");
  const rows = [{ q: "m7b5" }, { q: "7alt" }, { q: "maj" }, { q: "dom7" }].map(r => ({ ...r, n: 1, ok: 1 }));
  assert.deepStrictEqual(Stats.qualityRows(rows, E.TYPES).map(r => r.q), ["maj", "dom7", "7alt", "m7b5"]);
});
