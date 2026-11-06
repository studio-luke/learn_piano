// ===== 회원 기능 — 로그인 창과 계정 사이드바 (화면) =====
// 한 개의 <dialog>가 두 모양으로 쓰여요.
//   - 가운데 창: 로그인, 회원가입, 비밀번호 재설정, 새 비밀번호, 계정 복구, 정보 추가 입력, 회원 탈퇴
//   - 오른쪽 사이드바(.side): 로그인한 뒤의 "내 계정" 메뉴와 비밀번호 변경
// 창의 HTML은 아래 MARKUP에 있고, 페이지가 열릴 때 <body> 끝에 붙여요(모든 페이지가 같은 창을 쓰도록).
// 실제 로그인·DB 작업은 account.js의 Account가 하고, 여기서는 입력 확인과 화면 전환만 해요.
import { Account } from "./account.js";
import { errorKey, missingFields, langForTimeZone, TERMS_VERSION, PW_MIN, NICK_MAX, NAME_MAX, GRACE_DAYS } from "./helpers.js";
import { t, lang, locale, setLang, applyI18n, onLangChange } from "../i18n/index.js";
import { $ } from "../common/dom.js";
import { ROUTES, pageUrl } from "../common/sitemap.js";

// 사이드바 모양으로 여는 화면들
const SIDE = new Set(["account", "changepw"]);
// 화면마다 제목 문구 키
const TITLES = { login: "viewLogin", signup: "viewSignup", reset: "viewReset", newpw: "viewNewpw", changepw: "viewChangepw",
  account: "viewAccount", complete: "viewComplete", restore: "viewRestore", delete: "deleteAcct" };

// 비밀번호 칸 오른쪽의 눈 모양 버튼 (누르고 있는 동안 비밀번호가 보임)
const EYE = `<button type="button" class="pw-eye" aria-label="비밀번호 보기" data-i18n-aria="showPw"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg></button>`;
const pw = (name, autocomplete, labelKey, hint = "") =>
  `<label class="field"><span data-i18n="${labelKey}"></span><span class="pw-wrap"><input type="password" name="${name}" autocomplete="${autocomplete}" required>${EYE}</span>${hint}</label>`;
const LANG_OPTIONS = `<option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh">简体中文</option>`;
const PW_HINT = `<small data-i18n="pwHint"></small>`;

// 창 HTML. data-view = 화면 이름, data-i18n = 문구 키 (applyI18n이 채움), data-go = 누르면 그 화면으로
const MARKUP = `
<dialog class="auth" id="authDlg" aria-labelledby="authTitle">
  <form method="dialog" class="auth-close"><button class="icon-btn" aria-label="닫기" data-i18n-aria="close">✕</button></form>
  <h2 id="authTitle"></h2>
  <p class="auth-msg" id="authMsg" role="status"></p>

  <form class="auth-form" data-view="login" novalidate>
    <p class="auth-note" data-i18n="loginNote"></p>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    ${pw("password", "current-password", "password")}
    <button class="btn primary" type="submit" data-i18n="login"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="signup" data-i18n="goSignup"></button><button type="button" class="linkbtn" data-go="reset" data-i18n="goReset"></button></div>
  </form>

  <form class="auth-form" data-view="signup" novalidate hidden>
    <label class="field"><span data-i18n="fullName"></span><input type="text" name="fullName" autocomplete="name" maxlength="${NAME_MAX}" required><small data-i18n="fullNameHint"></small></label>
    <label class="field"><span data-i18n="nickname"></span><input type="text" name="nickname" autocomplete="nickname" maxlength="${NICK_MAX}" required><small data-i18n="nicknameHint"></small></label>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    ${pw("password", "new-password", "password", PW_HINT)}
    ${pw("password2", "new-password", "passwordConfirm")}
    <label class="field"><span data-i18n="prefLang"></span><select name="lang" id="signupLang">${LANG_OPTIONS}</select><small data-i18n="prefLangHint"></small></label>
    <label class="check"><input type="checkbox" name="age14" required><span data-i18n="agreeAge"></span></label>
    <label class="check"><input type="checkbox" name="terms" required><span data-i18n="agreeTermsHTML"></span></label>
    <label class="check"><input type="checkbox" name="privacy" required><span data-i18n="agreePrivacyHTML"></span></label>
    <button class="btn primary" type="submit" data-i18n="doSignup"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="login" data-i18n="goLogin"></button></div>
  </form>

  <form class="auth-form" data-view="reset" novalidate hidden>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    <button class="btn primary" type="submit" data-i18n="doReset"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="login" data-i18n="backLogin"></button></div>
  </form>

  <form class="auth-form" data-view="newpw" novalidate hidden>
    ${pw("password", "new-password", "newPassword", PW_HINT)}
    ${pw("password2", "new-password", "newPasswordConfirm")}
    <button class="btn primary" type="submit" data-i18n="doNewpw"></button>
  </form>

  <form class="auth-form" data-view="changepw" novalidate hidden>
    ${pw("current", "current-password", "currentPassword")}
    ${pw("password", "new-password", "newPassword", PW_HINT)}
    ${pw("password2", "new-password", "newPasswordConfirm")}
    <button class="btn primary" type="submit" data-i18n="doNewpw"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="account" data-i18n="backAccount"></button></div>
  </form>

  <form class="auth-form" data-view="delete" novalidate hidden>
    <p class="auth-warn" data-i18n="deleteConfirm"></p>
    ${pw("current", "current-password", "currentPassword")}
    <label class="field"><span data-i18n="deleteTypeHTML"></span><input type="text" name="phrase" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
    <button class="btn danger" type="submit" id="deleteSubmit" disabled data-i18n="deleteAcct"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="account" data-i18n="backAccount"></button></div>
  </form>

  <div class="auth-form" data-view="restore" hidden>
    <p class="auth-note" id="restoreText"></p>
    <button class="btn primary" type="button" id="restoreBtn" data-i18n="doRestore"></button>
    <button class="btn" type="button" id="restoreLogoutBtn" data-i18n="logout"></button>
  </div>

  <form class="auth-form" data-view="complete" novalidate hidden>
    <p class="auth-note" data-i18n="completeNote"></p>
    <label class="field"><span data-i18n="fullName"></span><input type="text" name="fullName" autocomplete="name" maxlength="${NAME_MAX}" required><small data-i18n="fullNameHint"></small></label>
    <button class="btn primary" type="submit" data-i18n="doSave"></button>
  </form>

  <div class="auth-form" data-view="account" hidden>
    <p class="acct-who"><b id="acctName"></b><span id="acctFullName"></span><span id="acctEmail"></span></p>
    <nav class="side-menu">
      <a class="menu-item" id="menuMy" href="${pageUrl(ROUTES.mypage)}"><span data-i18n="menuMy"></span><span class="chev" aria-hidden="true">›</span></a>
      <a class="menu-item" id="menuStudents" href="${pageUrl(ROUTES.teacher)}" hidden><span data-i18n="menuStudents"></span><span class="chev" aria-hidden="true">›</span></a>
      <button class="menu-item" type="button" id="menuReview"><span data-i18n="menuReview"></span><span class="badge" id="reviewCount"></span></button>
      <button class="menu-item" type="button" data-go="changepw"><span data-i18n="changePw"></span><span class="chev" aria-hidden="true">›</span></button>
      <button class="menu-item" type="button" id="logoutBtn"><span data-i18n="logout"></span></button>
    </nav>
    <p class="auth-note" data-i18n="syncNote"></p>
    <hr class="divider">
    <button class="linkbtn danger" type="button" id="deleteAcctBtn" data-i18n="deleteAcct"></button>
  </div>
</dialog>`;

let view = "login";
let msg = { kind: "", key: "", vars: {} };   // 창 위쪽 안내 문구 (언어를 바꾸면 다시 그리려고 기억)
const dlg = () => $("authDlg");
const form = name => dlg().querySelector(`form[data-view="${name}"]`);
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
// 메일 링크(가입 인증, 비밀번호 재설정)를 누르면 돌아올 주소: 지금 보고 있는 페이지
const here = () => location.origin + location.pathname;
const fmtDate = d => new Date(d).toLocaleDateString(locale(), { year: "numeric", month: "long", day: "numeric" });

/** 틀린 문제 다시 풀기를 누르면 할 일. 연습 페이지가 바꿔 끼우고, 다른 페이지에서는 연습 페이지로 이동 */
export const hooks = { startReview: () => { location.href = `${pageUrl(ROUTES.trainer)}?review=1`; } };

/** 창을 열고 화면 v를 보여줌 */
export function open(v, message) {
  const d = dlg();
  // 사이드바와 가운데 창은 같은 요소라, 모양이 바뀌면 닫았다가 다시 엶
  if (d.open && d.classList.contains("side") !== SIDE.has(v)) d.close();
  show(v, message);
  if (!d.open) d.showModal();
  if (v === "account") countReview();
  const first = d.querySelector(`[data-view="${v}"] input`);
  if (first) first.focus();
}
export const close = () => dlg() && dlg().close();
export const isOpen = () => !!(dlg() && dlg().open);

function show(v, message) {
  view = v;
  if (v === "signup") {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* 시간대를 모르면 영어 */ }
    $("signupLang").value = langForTimeZone(tz);
  }
  if (v === "complete" && Account.profile) form("complete").fullName.value = Account.profile.full_name || "";
  if (v === "delete") { form("delete").reset(); deleteReady(); }
  // 앞 화면에서 보이게 해 둔 비밀번호가 다음 화면에서도 보이면 안 됨
  dlg().querySelectorAll(".pw-wrap input").forEach(i => { i.type = "password"; });
  dlg().querySelectorAll(".pw-eye").forEach(b => b.classList.remove("on"));
  dlg().querySelectorAll("[data-view]").forEach(el => { el.hidden = el.dataset.view !== v; });
  dlg().classList.toggle("side", SIDE.has(v));
  $("authTitle").textContent = t(TITLES[v]);
  setMsg(message ? message.kind : "", message ? message.key : "", message && message.vars);
}

function setMsg(kind, key, vars) {
  msg = { kind: kind || "", key: key || "", vars: vars || {} };
  const el = $("authMsg");
  el.className = "auth-msg" + (msg.kind ? " " + msg.kind : "");
  el.textContent = msg.key ? t(msg.key, msg.vars) : "";
}

/** 로그인 상태가 바뀔 때마다: 머리글 버튼, 사이드바 이름, 메뉴를 다시 그림 */
function render() {
  const user = Account.user, profile = Account.profile;
  const name = profile ? profile.nickname : user ? (user.email || "").split("@")[0] : "";
  const btn = $("accountBtn");
  if (btn) {
    btn.hidden = !Account.configured;
    btn.classList.toggle("signed-in", !!user);
    $("accountLogin").hidden = !!user;
    $("accountName").hidden = !user;
    $("accountName").textContent = name;
  }
  $("acctName").textContent = name;
  $("acctFullName").textContent = profile && profile.full_name ? profile.full_name : "";
  $("acctEmail").textContent = user ? user.email : "";
  $("menuStudents").hidden = !Account.isAdmin();
  $("restoreText").textContent = profile && profile.deleted_at
    ? t("restoreNote", { date: fmtDate(new Date(new Date(profile.deleted_at).getTime() + GRACE_DAYS * 864e5)) }) : "";
  // 로그아웃했는데 "내 계정"이 열려 있으면 로그인 화면으로
  if (isOpen() && view === "account" && !user) show("login");
}

// 사이드바의 "틀린 문제 다시 풀기" 옆 숫자
async function countReview() {
  $("reviewCount").textContent = "";
  const n = await Account.reviewCount();
  $("reviewCount").textContent = n || "";
  $("menuReview").disabled = !n;
}

// 회원 탈퇴 버튼: 비밀번호를 넣고 확인 문구를 정확히 똑같이 썼을 때만 켜짐
function deleteReady() {
  const f = form("delete");
  $("deleteSubmit").disabled = !(f.current.value && f.phrase.value === t("deletePhrase"));
}

// 눈 버튼: 마우스를 올리고 있는 동안, 또는 손가락·키로 누르고 있는 동안만 비밀번호를 보여줌
function wireEyes() {
  dlg().querySelectorAll(".pw-eye").forEach(btn => {
    const input = btn.parentElement.querySelector("input");
    const set = on => { input.type = on ? "text" : "password"; btn.classList.toggle("on", on); };
    btn.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") set(true); });
    btn.addEventListener("pointerleave", () => set(false));
    btn.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { e.preventDefault(); set(true); } });
    btn.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") set(false); });
    btn.addEventListener("pointercancel", () => set(false));
    btn.addEventListener("contextmenu", e => e.preventDefault());   // 길게 누를 때 메뉴가 뜨지 않게
    btn.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(true); } });
    btn.addEventListener("keyup", () => set(false));
    btn.addEventListener("blur", () => set(false));
  });
}

// 제출 중에는 버튼을 끄고, 예상 못 한 오류는 문구로 보여줌
async function busy(f, fn) {
  const btn = f.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { setMsg("no", errorKey(e)); }
  finally { if (btn) btn.disabled = false; if (f.dataset.view === "delete") deleteReady(); }
}
// 아직 Supabase를 못 불러왔으면 네트워크 오류로 안내
const needClient = () => (Account.client ? false : (setMsg("no", "errNetwork"), true));

// 화면별 제출 처리
const SUBMIT = {
  async login(f) {
    const email = f.email.value.trim(), password = f.password.value;
    if (!validEmail(email)) return setMsg("no", "errEmail");
    if (needClient()) return;
    const { error } = await Account.signIn(email, password);
    if (error) return setMsg("no", errorKey(error));
    f.reset(); close();
  },
  async signup(f) {
    const fullName = f.fullName.value.trim(), nickname = f.nickname.value.trim(), email = f.email.value.trim(), password = f.password.value;
    const chosenLang = f.lang.value;
    if (!fullName || fullName.length > NAME_MAX) return setMsg("no", "errFullName");
    if (!nickname || nickname.length > NICK_MAX) return setMsg("no", "errNickname");
    if (!validEmail(email)) return setMsg("no", "errEmail");
    if (password.length < PW_MIN) return setMsg("no", "errPwShort");
    if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
    // 동의 확인은 DB(handle_new_user 트리거)도 다시 검사함 — 여기는 편의용
    if (!f.age14.checked || !f.terms.checked || !f.privacy.checked) return setMsg("no", "errAgree");
    if (needClient()) return;
    const { data, error } = await Account.signUp(email, password,
      { nickname, full_name: fullName, preferred_lang: chosenLang, age14: true, terms_version: TERMS_VERSION }, here());
    if (error) return setMsg("no", errorKey(error));
    f.reset();
    // 이메일 인증을 켜 두어서 보통 세션이 없음 (이미 가입된 주소도 같은 안내 — 가입 여부를 알려주지 않으려고)
    if (data.session) close(); else show("login", { kind: "ok", key: "msgSignupSent" });
    if (chosenLang !== lang()) setLang(chosenLang);   // 고른 언어를 바로 화면 언어로
  },
  async complete(f) {
    const fullName = f.fullName.value.trim();
    if (!fullName || fullName.length > NAME_MAX) return setMsg("no", "errFullName");
    const { error } = await Account.updateProfile({ full_name: fullName });
    if (error) return setMsg("no", errorKey(error));
    show("account", { kind: "ok", key: "msgSaved" });
  },
  async reset(f) {
    const email = f.email.value.trim();
    if (!validEmail(email)) return setMsg("no", "errEmail");
    if (needClient()) return;
    const { error } = await Account.resetPassword(email, here());
    if (error) return setMsg("no", errorKey(error));
    f.reset(); show("login", { kind: "ok", key: "msgResetSent" });
  },
  // 재설정 메일로 들어온 경우: 현재 비밀번호를 물을 수 없음
  async newpw(f) {
    const password = f.password.value;
    if (password.length < PW_MIN) return setMsg("no", "errPwShort");
    if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
    const { error } = await Account.updatePassword(password);
    if (error) return setMsg("no", errorKey(error));
    f.reset(); show("account", { kind: "ok", key: "msgPwChanged" });
  },
  // 내 계정 → 비밀번호 변경: 현재 비밀번호를 먼저 확인
  async changepw(f) {
    const current = f.current.value, password = f.password.value;
    if (!current) return setMsg("no", "errCurrentPw");
    if (password.length < PW_MIN) return setMsg("no", "errPwShort");
    if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
    const check = await Account.verifyPassword(current);
    if (check.error) return setMsg("no", check.error.code === "invalid_credentials" ? "errCurrentPw" : errorKey(check.error));
    const { error } = await Account.updatePassword(password);
    if (error) return setMsg("no", errorKey(error));
    f.reset(); show("account", { kind: "ok", key: "msgPwChanged" });
  },
  // 회원 탈퇴: 비밀번호 확인 → 7일 유예 시작 → 로그아웃
  async delete(f) {
    if (f.phrase.value !== t("deletePhrase")) return;
    const check = await Account.verifyPassword(f.current.value);
    if (check.error) return setMsg("no", check.error.code === "invalid_credentials" ? "errCurrentPw" : errorKey(check.error));
    const { data, error } = await Account.requestDeletion();
    if (error) return setMsg("no", errorKey(error));
    f.reset();
    Account.forgetProfile();   // 아래 로그아웃을 "복구 거절"로 오해하지 않게
    await Account.signOut();
    show("login", { kind: "ok", key: "msgDeleted", vars: { date: fmtDate(data) } });
  },
};

/** 페이지가 열릴 때 한 번: 창을 붙이고 버튼·이벤트를 연결 */
export function initAuthDialog() {
  if (!Account.configured) return;
  document.body.insertAdjacentHTML("beforeend", MARKUP);
  applyI18n(dlg());
  wireEyes();

  const btn = $("accountBtn");
  if (btn) btn.onclick = () => open(!Account.user ? "login" : Account.profile && Account.profile.deleted_at ? "restore" : "account");

  // 계정 복구 창을 닫으면(✕, Esc, 바깥 클릭) 탈퇴를 그대로 두고 로그아웃.
  // dialog의 "close" 이벤트 대신 각 동작에서 처리: 창을 빠르게 닫았다 열면 Chrome이 close 이벤트를 빠뜨리는 경우가 있었음
  const declineRestore = () => { if (view === "restore" && Account.profile && Account.profile.deleted_at) Account.signOut(); };
  dlg().addEventListener("cancel", declineRestore);
  dlg().querySelector(".auth-close button").addEventListener("click", declineRestore);
  dlg().addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); open(go.dataset.go); return; }
    if (e.target === dlg()) {
      // dialog 자체가 눌린 경우는 안쪽 여백일 수도, 바깥(배경)일 수도 있음 → 상자 밖일 때만 닫음
      const r = dlg().getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { declineRestore(); close(); }
    }
  });

  dlg().querySelectorAll("form[data-view]").forEach(f => {
    f.addEventListener("submit", e => { e.preventDefault(); busy(f, () => SUBMIT[f.dataset.view](f)); });
  });
  form("delete").addEventListener("input", deleteReady);

  $("logoutBtn").onclick = async () => { await Account.signOut(); close(); };
  $("menuReview").onclick = () => { close(); hooks.startReview(); };
  $("deleteAcctBtn").onclick = () => open("delete");
  $("restoreBtn").onclick = async () => {
    const { error } = await Account.restore();
    if (error) return setMsg("no", errorKey(error));
    if (!missingFields(Account.profile).length) show("account", { kind: "ok", key: "msgRestored" });
  };
  $("restoreLogoutBtn").onclick = async () => { await Account.signOut(); close(); };

  Account.on("change", render);
  Account.on("restore", () => open("restore"));
  Account.on("complete", () => open("complete"));
  Account.on("recovery", () => open("newpw"));
  // 언어를 바꾸면 JS로 넣은 문구(제목, 안내, 탈퇴 확인 문구)를 다시 그림
  onLangChange(() => {
    $("authTitle").textContent = t(TITLES[view]);
    setMsg(msg.kind, msg.key, msg.vars);
    deleteReady();
    render();
  });
  render();
}
