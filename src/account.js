// ===== Accounts (Supabase Auth) =====
// Sign-up / log-in / password reset and change / account deletion with a 7-day grace period,
// and syncing practice settings to the account.
// Everyone signs up as a student; the admin role is set by hand in the database (supabase/schema.sql).
// Does nothing unless CONFIG has a Supabase URL and public key — then the trainer runs without accounts.
// The pure helpers (errorKey, syncable, isPublicKey, missingFields, langForTimeZone) are exported for tests/account.test.js.
const Account = (() => {
  // supabase-js is loaded from the CDN only when accounts are configured; integrity pins the exact file
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
  const SDK_SRI = "sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R";
  // date of the terms/privacy policy the user agrees to at sign-up; bump it when either page changes
  const TERMS_VERSION = "2026-10-27";
  // settings that belong to the device, not the account (a phone has no computer keyboard)
  const LOCAL_ONLY = ["kbd", "kbdTouched"];
  const PW_MIN = 8, NICK_MAX = 20, NAME_MAX = 50;
  // profile fields every member must have. Members who joined before a field was added get the
  // "complete your profile" view on their next log-in (see docs/supabase-setup.md, 회원가입 항목 추가).
  const REQUIRED = ["full_name"];
  const PROFILE_COLS = "nickname, full_name, preferred_lang, role, settings, deleted_at";
  const GRACE_DAYS = 7;   // must match the interval in supabase/schema.sql

  // Supabase error → i18n key
  function errorKey(err) {
    if (!err) return "errGeneric";
    const code = err.code || "", msg = String(err.message || "");
    const byCode = {
      invalid_credentials: "errInvalid", email_not_confirmed: "errNotConfirmed",
      user_already_exists: "errExists", email_exists: "errExists",
      weak_password: "errWeak", same_password: "errSamePw", email_address_invalid: "errEmail",
      over_email_send_rate_limit: "errRate", over_request_rate_limit: "errRate",
    };
    if (byCode[code]) return byCode[code];
    if (err.status === 429) return "errRate";
    if (err.name === "AuthRetryableFetchError" || err.status === 0 || /fetch|network/i.test(msg)) return "errNetwork";
    return "errGeneric";
  }
  // sign-up language guess from the device's time zone (set by the OS from the user's region; no permission prompt)
  const TZ_LANG = [[/^Asia\/(Seoul|Pyongyang)$/, "ko"], [/^Asia\/Tokyo$/, "ja"],
    [/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar|Hong_Kong|Macau|Taipei)$|^PRC$|^ROC$/, "zh"]];
  function langForTimeZone(tz) {
    for (const [re, lang] of TZ_LANG) if (re.test(tz || "")) return lang;
    return "en";
  }
  const missingFields = p => REQUIRED.filter(k => !p || p[k] == null || String(p[k]).trim() === "");
  function syncable(settings) {
    const out = { ...settings };
    LOCAL_ONLY.forEach(k => delete out[k]);
    return out;
  }
  // true for the public anon/publishable key; false for a secret key, which must never ship with the site
  function isPublicKey(key) {
    if (!key) return false;
    if (/^sb_secret_/.test(key)) return false;
    if (/^sb_publishable_/.test(key)) return true;
    const part = key.split(".")[1];
    if (!part) return false;
    try {
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json).role === "anon";
    } catch (e) { return false; }
  }

  const cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
  const configured = () => !!(cfg.supabaseUrl && cfg.supabaseKey);

  let ctx, sb = null, user = null, profile = null, view = "login", pushTimer;
  const $ = id => document.getElementById(id);

  function loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src = SDK_URL; s.integrity = SDK_SRI; s.crossOrigin = "anonymous";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ctx: { t, getSettings, applySettings } from the trainer
  function init(c) {
    ctx = c;
    if (!configured()) return;
    if (!isPublicKey(cfg.supabaseKey)) { console.error("CONFIG.supabaseKey is not a public key — accounts disabled"); return; }
    $("accountBtn").hidden = false;
    document.querySelectorAll(".legal-links").forEach(el => { el.hidden = false; });
    wireUI();
    render();
    loadSDK().then(start, () => console.warn("Could not load supabase-js"));
  }

  function start() {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    sb.auth.onAuthStateChange((event, session) => {
      const prev = user && user.id;
      user = session ? session.user : null;
      if (!user) profile = null;
      // Supabase calls inside this callback can deadlock, so they run on the next tick
      if (user && user.id !== prev) setTimeout(loadProfile, 0);
      if (event === "PASSWORD_RECOVERY") setTimeout(() => open("newpw"), 0);
      render();
    });
  }

  async function loadProfile() {
    const { data, error } = await sb.from("profiles").select(PROFILE_COLS).eq("id", user.id).single();
    if (error) { console.warn("profile", error); return; }
    profile = data;
    render();
    // asked to leave within the last 7 days: offer to restore before anything else is synced
    if (profile.deleted_at) return open("restore");
    useProfile();
  }
  function useProfile() {
    if (profile.settings) ctx.applySettings(profile.settings);
    else pushSettings();   // first log-in: this device's settings become the account's
    // the account's language wins on every device
    if (profile.preferred_lang && profile.preferred_lang !== ctx.lang()) ctx.setLang(profile.preferred_lang);
    render();
    if (missingFields(profile).length) open("complete");
  }
  async function updateProfile(fields) {
    if (!sb || !user) return { error: null };
    const res = await sb.from("profiles").update(fields).eq("id", user.id);
    if (res.error) console.warn("profile update", res.error);
    else if (profile) Object.assign(profile, fields);
    return res;
  }
  async function pushSettings() {
    if (!sb || !user) return;
    const { error } = await sb.from("profiles").update({ settings: syncable(ctx.getSettings()) }).eq("id", user.id);
    if (error) console.warn("settings sync", error);
  }
  const active = () => user && profile && !profile.deleted_at;
  // called by the trainer when the user picks another language
  function langChanged(lang) { if (active() && profile.preferred_lang !== lang) updateProfile({ preferred_lang: lang }); }
  // called by the trainer after every settings save
  function settingsChanged() {
    if (!active()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSettings, 1200);
  }

  // ---------- dialog ----------
  const TITLES = { login: "viewLogin", signup: "viewSignup", reset: "viewReset", newpw: "viewNewpw", changepw: "viewChangepw",
    account: "viewAccount", complete: "viewComplete", restore: "viewRestore" };
  function fmtDate(d) {
    const tag = { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" }[ctx.lang()] || "en-US";
    return new Date(d).toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric" });
  }
  const purgeDate = since => new Date(new Date(since).getTime() + GRACE_DAYS * 864e5);
  function open(v, msg) {
    const dlg = $("authDlg");
    show(v, msg);
    if (!dlg.open) dlg.showModal();
    const first = dlg.querySelector(`[data-view="${v}"] input`);
    if (first) first.focus();
  }
  function show(v, msg) {
    view = v;
    if (v === "signup") {
      let tz = "";
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      $("signupLang").value = langForTimeZone(tz);
    }
    if (v === "complete" && profile) $("completeName").value = profile.full_name || "";
    // a password left visible on one view must not stay visible on the next
    document.querySelectorAll("#authDlg .pw-wrap input").forEach(i => { i.type = "password"; });
    document.querySelectorAll("#authDlg .pw-eye").forEach(b => b.classList.remove("on"));
    document.querySelectorAll("#authDlg [data-view]").forEach(el => { el.hidden = el.dataset.view !== v; });
    $("authTitle").textContent = ctx.t(TITLES[v]);
    setMsg(msg ? msg.kind : "", msg ? msg.key : "", msg && msg.vars);
  }
  let msgVars = {};
  function setMsg(kind, key, vars) {
    const el = $("authMsg");
    el.className = "auth-msg" + (kind ? " " + kind : "");
    el.dataset.key = key || "";
    msgVars = vars || {};
    el.textContent = key ? ctx.t(key, msgVars) : "";
  }
  function render() {
    const name = profile ? profile.nickname : user ? (user.email || "").split("@")[0] : "";
    $("accountBtn").classList.toggle("signed-in", !!user);
    $("accountLogin").hidden = !!user;
    $("accountName").hidden = !user;
    $("accountName").textContent = name;
    $("acctName").textContent = name;
    $("acctFullName").textContent = profile && profile.full_name ? profile.full_name : "";
    $("acctEmail").textContent = user ? user.email : "";
    $("restoreText").textContent = profile && profile.deleted_at ? ctx.t("restoreNote", { date: fmtDate(purgeDate(profile.deleted_at)) }) : "";
    // the account view makes no sense once logged out (and vice versa)
    if ($("authDlg").open && view === "account" && !user) show("login");
  }
  // language changed: redraw the text the dialog set itself
  function refresh() {
    if (!ctx || !configured()) return;
    $("authTitle").textContent = ctx.t(TITLES[view]);
    const key = $("authMsg").dataset.key;
    if (key) $("authMsg").textContent = ctx.t(key, msgVars);
    render();
  }

  // eye button: shows the password while the mouse is over it, or while a finger / key holds it down
  function wireEyes() {
    document.querySelectorAll("#authDlg .pw-eye").forEach(btn => {
      const input = btn.parentElement.querySelector("input");
      const set = on => { input.type = on ? "text" : "password"; btn.classList.toggle("on", on); };
      btn.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") set(true); });
      btn.addEventListener("pointerleave", () => set(false));
      btn.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { e.preventDefault(); set(true); } });
      btn.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") set(false); });
      btn.addEventListener("pointercancel", () => set(false));
      btn.addEventListener("contextmenu", e => e.preventDefault());   // no long-press menu while holding
      btn.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(true); } });
      btn.addEventListener("keyup", () => set(false));
      btn.addEventListener("blur", () => set(false));
    });
  }

  async function busy(form, fn) {
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { setMsg("no", errorKey(e)); } finally { if (btn) btn.disabled = false; }
  }
  const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const back = () => location.origin + location.pathname;

  function wireUI() {
    wireEyes();
    $("accountBtn").onclick = () => open(!user ? "login" : profile && profile.deleted_at ? "restore" : "account");
    // the user closing the restore prompt (✕, Esc, backdrop) keeps the deletion and logs out.
    // Handled on those actions, not on the dialog's "close" event, which Chrome may drop when the dialog
    // is closed and reopened in quick succession (log-in closes it, the restore prompt reopens it).
    const declineRestore = () => { if (view === "restore" && profile && profile.deleted_at && sb) sb.auth.signOut(); };
    $("authDlg").addEventListener("cancel", declineRestore);
    document.querySelector("#authDlg .auth-close button").addEventListener("click", declineRestore);
    $("authDlg").addEventListener("click", e => {
      const go = e.target.closest("[data-go]");
      if (go) { e.preventDefault(); open(go.dataset.go); }
      else if (e.target === $("authDlg")) {
        // the dialog element itself is hit both by its padding and by the backdrop — close only outside the box
        const r = $("authDlg").getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { declineRestore(); $("authDlg").close(); }
      }
    });

    const forms = {
      login: async f => {
        const email = f.email.value.trim(), password = f.password.value;
        if (!validEmail(email)) return setMsg("no", "errEmail");
        if (!sb) return setMsg("no", "errNetwork");
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setMsg("no", errorKey(error));
        f.reset(); $("authDlg").close();
      },
      signup: async f => {
        const fullName = f.fullName.value.trim(), nickname = f.nickname.value.trim(), email = f.email.value.trim(), password = f.password.value;
        const lang = f.lang.value;
        if (!fullName || fullName.length > NAME_MAX) return setMsg("no", "errFullName");
        if (!nickname || nickname.length > NICK_MAX) return setMsg("no", "errNickname");
        if (!validEmail(email)) return setMsg("no", "errEmail");
        if (password.length < PW_MIN) return setMsg("no", "errPwShort");
        if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
        if (!f.age14.checked || !f.terms.checked || !f.privacy.checked) return setMsg("no", "errAgree");
        if (!sb) return setMsg("no", "errNetwork");
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: back(), data: { nickname, full_name: fullName, preferred_lang: lang, age14: true, terms_version: TERMS_VERSION } },
        });
        if (error) return setMsg("no", errorKey(error));
        f.reset();
        // with e-mail confirmation on there is no session yet; an existing address also lands here (no hint of which)
        if (data.session) $("authDlg").close(); else show("login", { kind: "ok", key: "msgSignupSent" });
        // the language picked here is also the screen language from now on
        if (lang !== ctx.lang()) ctx.setLang(lang);
      },
      complete: async f => {
        const fullName = f.fullName.value.trim();
        if (!fullName || fullName.length > NAME_MAX) return setMsg("no", "errFullName");
        const { error } = await updateProfile({ full_name: fullName });
        if (error) return setMsg("no", errorKey(error));
        render(); show("account", { kind: "ok", key: "msgSaved" });
      },
      reset: async f => {
        const email = f.email.value.trim();
        if (!validEmail(email)) return setMsg("no", "errEmail");
        if (!sb) return setMsg("no", "errNetwork");
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: back() });
        if (error) return setMsg("no", errorKey(error));
        f.reset(); show("login", { kind: "ok", key: "msgResetSent" });
      },
      // after a reset e-mail: there is no current password to ask for
      newpw: async f => {
        const password = f.password.value;
        if (password.length < PW_MIN) return setMsg("no", "errPwShort");
        if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
        const { error } = await sb.auth.updateUser({ password });
        if (error) return setMsg("no", errorKey(error));
        f.reset(); show("account", { kind: "ok", key: "msgPwChanged" });
      },
      // from "my account": the current password is checked by logging in with it again
      changepw: async f => {
        const current = f.current.value, password = f.password.value;
        if (!current) return setMsg("no", "errCurrentPw");
        if (password.length < PW_MIN) return setMsg("no", "errPwShort");
        if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
        const check = await sb.auth.signInWithPassword({ email: user.email, password: current });
        if (check.error) return setMsg("no", check.error.code === "invalid_credentials" ? "errCurrentPw" : errorKey(check.error));
        const { error } = await sb.auth.updateUser({ password });
        if (error) return setMsg("no", errorKey(error));
        f.reset(); show("account", { kind: "ok", key: "msgPwChanged" });
      },
    };
    document.querySelectorAll("#authDlg form[data-view]").forEach(f => {
      f.addEventListener("submit", e => { e.preventDefault(); busy(f, () => forms[f.dataset.view](f)); });
    });

    $("logoutBtn").onclick = async () => { await sb.auth.signOut(); $("authDlg").close(); };
    $("deleteAcctBtn").onclick = async () => {
      if (!confirm(ctx.t("deleteConfirm"))) return;
      const { data, error } = await sb.rpc("request_account_deletion");
      if (error) return setMsg("no", errorKey(error));
      profile = null;   // so the close/sign-out below is not taken for a declined restore
      await sb.auth.signOut();
      show("login", { kind: "ok", key: "msgDeleted", vars: { date: fmtDate(data) } });
    };
    $("restoreBtn").onclick = async () => {
      const { error } = await sb.rpc("restore_account");
      if (error) return setMsg("no", errorKey(error));
      profile.deleted_at = null;
      useProfile();
      if (!missingFields(profile).length) show("account", { kind: "ok", key: "msgRestored" });
    };
    $("restoreLogoutBtn").onclick = async () => { await sb.auth.signOut(); $("authDlg").close(); };
  }

  return { init, settingsChanged, langChanged, refresh, errorKey, syncable, isPublicKey, missingFields, langForTimeZone, TERMS_VERSION };
})();
if (typeof module !== "undefined") module.exports = Account;
