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
