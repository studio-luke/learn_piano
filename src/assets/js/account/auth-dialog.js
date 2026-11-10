// ===== 회원 기능 — 로그인 창과 계정 사이드바 (화면) =====
// 한 개의 <dialog>가 두 모양으로 쓰여요.
//   - 가운데 창: 로그인, 회원가입, 비밀번호 재설정, 새 비밀번호, 계정 복구, 정보 추가 입력, 회원 탈퇴
//   - 오른쪽 사이드바(.side): 로그인한 뒤의 "내 계정" 메뉴, 회원 정보 변경, 비밀번호 변경
// 창의 HTML은 아래 MARKUP에 있고, 페이지가 열릴 때 <body> 끝에 붙여요(모든 페이지가 같은 창을 쓰도록).
// 실제 로그인·DB 작업은 account.js의 Account가 하고, 여기서는 입력 확인과 화면 전환만 해요.
import { Account } from "./account.js";
import { errorKey, missingFields, langForTimeZone, TERMS_VERSION, PW_MIN, NICK_MAX, NAME_MAX, GRACE_DAYS } from "./helpers.js";
import { t, lang, locale, setLang, applyI18n, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { ROUTES, pageUrl } from "../common/sitemap.js";
import { CONFIG } from "../config.js";
import { drawAvatar, squareJpeg } from "./avatar.js";
import { googleOn, preloadGoogle, renderGoogle } from "./google.js";
import { checkName } from "./names.js";

// 사이드바 모양으로 여는 화면들
const SIDE = new Set(["account", "profile", "changepw"]);
// 화면마다 제목 문구 키
const TITLES = { login: "viewLogin", join: "viewSignup", signup: "viewSignup", reset: "viewReset", newpw: "viewNewpw", changepw: "viewChangepw", profile: "viewProfile",
  account: "viewAccount", complete: "viewComplete", restore: "viewRestore", delete: "deleteAcct" };

// 비밀번호 칸 오른쪽의 눈 모양 버튼 (누르고 있는 동안 비밀번호가 보임)
const EYE = `<button type="button" class="pw-eye" aria-label="비밀번호 보기" data-i18n-aria="showPw"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg></button>`;
// name이 password2(비밀번호 확인 칸)이면 제목 옆에 "일치합니다 / 일치하지 않습니다" 자리를 둠 (pwMatch()가 채움)
const pw = (name, autocomplete, labelKey, hint = "") =>
  `<label class="field"><span class="field-head"><span data-i18n="${labelKey}"></span>${name === "password2" ? `<span class="pw-match" aria-live="polite"></span>` : ""}</span><span class="pw-wrap"><input type="password" name="${name}" autocomplete="${autocomplete}" required>${EYE}</span>${hint}</label>`;
const LANG_OPTIONS = `<option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh">简体中文</option>`;
const PW_HINT = `<small data-i18n="pwHint"></small>`;

// 소셜 로그인 버튼 (config.js의 oauthProviders에 있는 것만, 그 순서로). 색·로고는 각 회사의 로그인 버튼 안내를 따름
const SOCIAL_ICONS = {
  google: `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`,
  kakao: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.48c-.08.3.26.54.52.37l4.15-2.75c.53.07 1.07.11 1.62.11 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z"/></svg>`,
};
const SOCIAL_KEYS = { google: "withGoogle", kakao: "withKakao", apple: "withApple" };
const PROVIDER_NAMES = { google: "nameGoogle", kakao: "nameKakao", apple: "nameApple" };
const PROVIDERS = (CONFIG.oauthProviders || []).filter(p => SOCIAL_ICONS[p]);
const SOCIAL_BTN = p => `<button type="button" class="btn social-btn ${p}" data-provider="${p}">${SOCIAL_ICONS[p]}<span data-i18n="${SOCIAL_KEYS[p]}"></span></button>`;
// 구글은 googleClientId가 있으면 구글 공식 버튼(google.js)을 .gsi-target에 그리고, 그게 되면 예전 방식 버튼은 숨김
const SOCIAL_BTNS = PROVIDERS.map(p => p === "google" && googleOn
  ? `<div class="gsi-slot">${SOCIAL_BTN(p)}<div class="gsi-spin" aria-hidden="true"><span></span></div><div class="gsi-target"></div></div>` : SOCIAL_BTN(p)).join("");
// 로그인 화면 아래: "또는" + 소셜 버튼
const SOCIAL = PROVIDERS.length ? `<div class="auth-or" data-i18n="orDivider"></div><div class="social">${SOCIAL_BTNS}</div>` : "";
const EMAIL_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 6.5 12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
// 본인 확인 질문 (2026-11-07 사용자 결정, 직접 입력한 질문은 50자까지): 고른 질문 키는 DB와 i18n의 rq_… 키가 같음. 맨 끝은 항상 "직접 입력하기..."
// 비밀번호 찾기에서 재설정 메일을 보내기 전에 물어봐요. 답은 DB에 해시로만 저장 (띄어쓰기·대소문자 무시)
const RQ_PRESETS = ["teacher6", "friend", "pet", "town", "concert", "academy"];
const RQ_OPTIONS = `<option value="" disabled selected data-i18n="rqPick"></option>${RQ_PRESETS.map(k =>
  `<option value="${k}" data-i18n="rq_${k}"></option>`).join("")}<option value="custom" data-i18n="rqCustom"></option>`;
const RECOVERY = hint => `
    <label class="field"><span data-i18n="rqLabel"></span><select name="rq">${RQ_OPTIONS}</select></label>
    <label class="field rq-custom" hidden><span data-i18n="rqCustomLabel"></span><input type="text" name="rqText" maxlength="50" autocomplete="off"></label>
    <label class="field"><span class="field-head"><span data-i18n="raLabel"></span><span class="field-note" data-i18n="raNote"></span></span><input type="text" name="ra" maxlength="100" autocomplete="off" autocapitalize="off" spellcheck="false"><small data-i18n="${hint}"></small></label>`;
/** 질문 키 → 화면 문구 (직접 입력한 질문은 그대로, 기존 회원의 기본 질문은 등록 안내) */
const rqText = (q, custom) => q === "custom" ? custom || "" : q === "default" ? t("rqDefault") : t("rq_" + q);
// "직접 입력하기..."를 고르면 질문 입력 칸을 보여줌
function toggleCustom(f) { f.querySelector(".rq-custom").hidden = f.rq.value !== "custom"; }

// 회원 ID 옆 복사 버튼 (2026-11-10)
const COPY_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

// 성명 칸 + 바로 아래 형식 오류 줄 (2026-11-10 사용자 결정, 규칙은 names.js).
// 실제 이름일 수도 있는 오류(흔하지 않은 한글 글자, 성씨가 아님, 읽을 수 없는 영문 단어)에는 ? 표시 —
// 마우스를 올리거나 누르면 안내와 [확인] 버튼. 문구는 모두 페이지 언어로 (2026-11-10)
const NAME_FIELD = `
    <label class="field"><span data-i18n="fullName"></span><input type="text" name="fullName" autocomplete="name" maxlength="${NAME_MAX}" required><small data-i18n="fullNameHint"></small></label>
    <p class="name-err" hidden><span class="name-err-text"></span><span class="help name-help" hidden><button type="button" class="help-btn" aria-expanded="false" aria-label="안내">?</button><span class="help-pop left" role="tooltip"><span class="name-soft-text"></span><button type="button" class="mini-btn name-ok" data-i18n="nameOk"></button></span></span></p>`;

// 처음 가입할 때 받는 동의 (이메일 가입 화면, 소셜 로그인 첫 방문의 정보 입력 화면)
const CONSENT = `
    <label class="check"><input type="checkbox" name="age14" required><span data-i18n="agreeAge"></span></label>
    <label class="check"><input type="checkbox" name="terms" required><span data-i18n="agreeTermsHTML"></span></label>
    <label class="check"><input type="checkbox" name="privacy" required><span data-i18n="agreePrivacyHTML"></span></label>`;

// 창 HTML. data-view = 화면 이름, data-i18n = 문구 키 (applyI18n이 채움), data-go = 누르면 그 화면으로
const MARKUP = `
<dialog class="auth" id="authDlg" aria-labelledby="authTitle">
  <form method="dialog" class="auth-close"><button class="icon-btn" aria-label="닫기" data-i18n-aria="close">✕</button></form>
  <h2 id="authTitle"></h2>
  <p class="auth-msg" id="authMsg" role="status"></p>
  <!-- 인증 메일 다시 보내기: 가입 직후, 또는 인증 안 된 주소로 로그인하려 할 때만 보임 (showResend) -->
  <button type="button" class="linkbtn resend-btn" id="resendBtn" hidden></button>

  <form class="auth-form" data-view="login" novalidate>
    <p class="auth-note" data-i18n="loginNote"></p>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    ${pw("password", "current-password", "password")}
    <button class="btn primary" type="submit" data-i18n="login"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="join" data-i18n="goSignup"></button><button type="button" class="linkbtn" data-go="reset" data-i18n="goReset"></button></div>
    ${SOCIAL}
  </form>

  <!-- 회원가입 첫 화면: 가입 방법 고르기. [이메일로 가입하기] → 아래 signup 폼, 소셜 버튼 → 그 회사 로그인 (2026-11-07 사용자 결정)
       소셜 로그인이 하나도 켜져 있지 않으면 이 화면을 건너뛰고 바로 signup 폼 (open 참고) -->
  <div class="auth-form" data-view="join" hidden>
    <div class="social">
      <button type="button" class="btn social-btn email" data-go="signup">${EMAIL_ICON}<span data-i18n="joinEmail"></span></button>
      ${SOCIAL_BTNS}
    </div>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="login" data-i18n="goLogin"></button></div>
  </div>

  <form class="auth-form" data-view="signup" novalidate hidden>
    ${NAME_FIELD}
    <label class="field"><span data-i18n="nickname"></span><input type="text" name="nickname" autocomplete="nickname" maxlength="${NICK_MAX}" required><small data-i18n="nicknameHint"></small></label>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    ${pw("password", "new-password", "password", PW_HINT)}
    ${pw("password2", "new-password", "passwordConfirm")}
    <label class="field"><span data-i18n="prefLang"></span><select name="lang" id="signupLang">${LANG_OPTIONS}</select><small data-i18n="prefLangHint"></small></label>
    ${RECOVERY("raHint")}
    ${CONSENT}
    <button class="btn primary" type="submit" data-i18n="doSignup"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="join" data-i18n="otherJoin"></button><button type="button" class="linkbtn" data-go="login" data-i18n="goLogin"></button></div>
  </form>

  <!-- 비밀번호 찾기: 1) 이메일 → [다음] → 2) 그 이메일의 본인 확인 질문이 보이고 답을 맞히면 재설정 메일 발송
       (가입 안 된 이메일에도 가짜 질문이 떠서 가입 여부를 알 수 없음 — DB reset_question) -->
  <form class="auth-form" data-view="reset" novalidate hidden>
    <p class="auth-note" data-i18n="resetNote"></p>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" autocomplete="email" required></label>
    <div class="auth-form" id="resetStep2" hidden>
      <div class="field"><span data-i18n="rqLabel"></span><p class="reset-question" id="resetQuestion"></p></div>
      <label class="field"><span data-i18n="raLabel"></span><input type="text" name="ra" maxlength="100" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    </div>
    <button class="btn primary" type="submit" id="resetSubmit"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="login" data-i18n="backLogin"></button><button type="button" class="linkbtn" id="resetOther" data-i18n="otherEmail" hidden></button></div>
  </form>

  <form class="auth-form" data-view="newpw" novalidate hidden>
    ${pw("password", "new-password", "newPassword", PW_HINT)}
    ${pw("password2", "new-password", "newPasswordConfirm")}
    <button class="btn primary" type="submit" data-i18n="doNewpw"></button>
  </form>

  <!-- 회원 정보 변경: 지금 정보를 채워 두고, 하나라도 바뀌었을 때만 저장 버튼이 켜짐 (profileReady). 이메일은 보기만 -->
  <form class="auth-form" data-view="profile" novalidate hidden>
    <!-- 프로필 사진: 고르면 미리보기만 바뀌고, 저장을 눌러야 올라감 (pendingAvatar) -->
    <div class="avatar-edit">
      <span class="avatar avatar-lg" id="profileAvatar" aria-hidden="true"></span>
      <div class="avatar-actions">
        <span class="avatar-label" data-i18n="avatar"></span>
        <div class="avatar-btns">
          <button type="button" class="mini-btn" id="avatarPick" data-i18n="avatarPick"></button>
          <button type="button" class="linkbtn" id="avatarRemove" data-i18n="avatarRemove"></button>
        </div>
        <input type="file" id="avatarFile" accept="image/*" hidden>
        <small data-i18n="avatarHint"></small>
      </div>
    </div>
    <label class="field"><span data-i18n="email"></span><input type="email" name="email" readonly tabindex="-1"><small data-i18n="emailFixedHint"></small></label>
    <label class="field"><span data-i18n="fullName"></span><input type="text" name="fullName" readonly tabindex="-1"><small data-i18n="fullNameLocked"></small></label>
    <label class="field"><span data-i18n="nickname"></span><input type="text" name="nickname" autocomplete="nickname" maxlength="${NICK_MAX}" required><small data-i18n="nicknameHint"></small></label>
    <label class="field"><span data-i18n="prefLang"></span><select name="lang">${LANG_OPTIONS}</select><small data-i18n="prefLangHint"></small></label>
    <!-- 본인 확인 질문: 비밀번호가 있는 회원만 (소셜 로그인 회원은 비밀번호 찾기를 안 씀) -->
    <div class="auth-form" id="profileRecovery" hidden>${RECOVERY("raProfileHint")}</div>
    <button class="btn primary" type="submit" id="profileSave" disabled data-i18n="doSave"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="account" data-i18n="backAccount"></button></div>
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
    <!-- 비밀번호 확인: 소셜 로그인으로만 가입한 회원은 비밀번호가 없어서 숨기고 확인 문구만 받음 -->
    <div class="auth-form" id="deletePwField">${pw("current", "current-password", "currentPassword")}</div>
    <label class="field"><span class="delete-type" data-i18n="deleteTypeHTML"></span><input type="text" name="phrase" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
    <button class="btn danger" type="submit" id="deleteSubmit" disabled data-i18n="deleteAcct"></button>
    <div class="auth-links"><button type="button" class="linkbtn" data-go="account" data-i18n="backAccount"></button></div>
  </form>

  <div class="auth-form" data-view="restore" hidden>
    <p class="auth-note" id="restoreText"></p>
    <button class="btn primary" type="button" id="restoreBtn" data-i18n="doRestore"></button>
    <button class="btn" type="button" id="restoreLogoutBtn" data-i18n="logout"></button>
  </div>

  <!-- 정보 추가 입력: 필수 항목이 새로 생긴 경우(성명만), 또는 소셜 로그인 첫 방문(.consent 부분까지 — 닉네임·언어·동의) -->
  <form class="auth-form" data-view="complete" novalidate hidden>
    <p class="auth-note" id="completeNote"></p>
    ${NAME_FIELD}
    <div class="consent auth-form" hidden>
      <label class="field"><span data-i18n="nickname"></span><input type="text" name="nickname" autocomplete="nickname" maxlength="${NICK_MAX}" required><small data-i18n="nicknameHint"></small></label>
      <label class="field"><span data-i18n="prefLang"></span><select name="lang">${LANG_OPTIONS}</select><small data-i18n="prefLangHint"></small></label>
      ${CONSENT}
    </div>
    <button class="btn primary" type="submit" data-i18n="doSave"></button>
  </form>

  <div class="auth-form" data-view="account" hidden>
    <div class="acct-head">
      <span class="avatar avatar-md" id="acctAvatar" aria-hidden="true"></span>
      <p class="acct-who"><b id="acctName"></b><span id="acctFullName"></span><span id="acctEmail"></span><span class="acct-id-row" id="acctIdRow" hidden><span class="acct-id" id="acctId"></span><button type="button" class="copy-btn" id="acctIdCopy" aria-label="ID 복사" title="ID 복사" data-i18n-aria="copyId" data-i18n-title="copyId">${COPY_ICON}</button></span></p>
    </div>
    <nav class="side-menu">
      <a class="menu-item" id="menuMy" href="${pageUrl(ROUTES.mypage)}"><span data-i18n="menuMy"></span><span class="chev" aria-hidden="true">›</span></a>
      <a class="menu-item" id="menuStudents" href="${pageUrl(ROUTES.teacher)}" hidden><span data-i18n="menuStudents"></span><span class="chev" aria-hidden="true">›</span></a>
      <!-- 틀린 문제 다시 풀기: 누르면 아래에 오답이 있는 연습 목록이 펼쳐짐(다시 누르면 닫힘), 오답이 하나도 없으면 회색 (2026-11-08 사용자 결정) -->
      <button class="menu-item" type="button" id="menuReview" aria-expanded="false" aria-controls="reviewSub"><span data-i18n="menuReview"></span><span class="badge" id="reviewCount"></span></button>
      <div class="side-sub" id="reviewSub" hidden>
        <button class="menu-item menu-sub" type="button" data-review="play"><span data-i18n="navTrainer"></span><span class="badge"></span></button>
        <button class="menu-item menu-sub" type="button" data-review="name"><span data-i18n="navNameTrainer"></span><span class="badge"></span></button>
      </div>
    </nav>
    <!-- 계정 설정 묶음 (2026-11-07 사용자 결정: 메뉴가 모두 나란히 있어 읽기 어려움 → 제목으로 나눔) -->
    <nav class="side-menu" aria-labelledby="acctSettingsHead">
      <h3 class="side-head" id="acctSettingsHead" data-i18n="acctSettings"></h3>
      <button class="menu-item" type="button" data-go="profile"><span data-i18n="menuProfile"></span><span class="chev" aria-hidden="true">›</span></button>
      <button class="menu-item" type="button" id="menuChangepw" data-go="changepw"><span data-i18n="changePw"></span><span class="chev" aria-hidden="true">›</span></button>
      <!-- 소셜 로그인으로만 가입한 회원: 비밀번호가 없으므로 변경 메뉴 대신 어느 계정으로 로그인하는지 안내 -->
      <p class="menu-note" id="acctSocialNote" hidden></p>
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

/**
 * 틀린 문제 다시 풀기를 누르면 할 일. mode = "play"(랜덤 코드 연습) | "name"(코드 추론하기).
 * 기본: 그 연습 페이지로 이동(?review=1). 연습 페이지는 자기 연습이면 바로 시작하도록 바꿔 끼움
 */
export const hooks = { startReview: (mode = "play") => { location.href = `${pageUrl(mode === "name" ? ROUTES.nameTrainer : ROUTES.trainer)}?review=1`; } };

// 구글 공식 버튼 그리기 (지금 보이는 화면의 슬롯만 — 숨겨진 칸은 폭을 잴 수 없어서)
function drawGoogle() {
  if (!googleOn) return;
  renderGoogle([...dlg().querySelectorAll(`[data-view="${view}"] .gsi-slot`)], lang(), async (token, nonce) => {
    const { error } = await Account.signInWithGoogleToken(token, nonce);
    if (error) { setMsg("no", errorKey(error)); drawGoogle(); return; }   // 일회용 값을 새로 만들어 다시 시도할 수 있게
    close();   // 처음 가입이면 프로필을 불러온 뒤 "정보 추가 입력(동의)" 창이 다시 열림
  });
}

/** 창을 열고 화면 v를 보여줌 */
export function open(v, message) {
  const d = dlg();
  if (v === "join" && !PROVIDERS.length) v = "signup";   // 고를 방법이 이메일뿐이면 바로 가입 폼
  // 사이드바와 가운데 창은 같은 요소라, 모양이 바뀌면 닫았다가 다시 엶
  if (d.open && d.classList.contains("side") !== SIDE.has(v)) d.close();
  show(v, message);
  if (!d.open) d.showModal();
  if (v === "login" || v === "join") drawGoogle();
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
    toggleCustom(form("signup"));
  }
  if (v === "complete") fillComplete();
  hideResend();
  if (v === "delete") { form("delete").reset(); $("deletePwField").hidden = !Account.hasPassword(); deleteReady(); }
  if (v === "profile") fillProfile();
  if (v === "reset") resetStep(1);
  // 앞 화면에서 보이게 해 둔 비밀번호가 다음 화면에서도 보이면 안 됨
  dlg().querySelectorAll(".pw-wrap input").forEach(i => { i.type = "password"; });
  dlg().querySelectorAll(".pw-eye").forEach(b => b.classList.remove("on"));
  dlg().querySelectorAll("[data-view]").forEach(el => { el.hidden = el.dataset.view !== v; });
  pwMatch();
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
    $("accountAvatar").hidden = !user;
    if (user) drawAvatar($("accountAvatar"), Account.avatarUrl(), name);
  }
  $("acctName").textContent = name;
  // 비밀번호 변경 메뉴 ↔ 소셜 로그인 안내 ("카카오 계정으로 로그인한 회원이에요")
  const social = user && !Account.hasPassword() ? Account.socialProvider() : null;
  $("menuChangepw").hidden = !!social;
  $("acctSocialNote").hidden = !social;
  $("acctSocialNote").textContent = social ? t("socialAccountNote", { provider: PROVIDER_NAMES[social] ? t(PROVIDER_NAMES[social]) : social }) : "";
  drawAvatar($("acctAvatar"), Account.avatarUrl(), name);
  $("acctFullName").textContent = profile && profile.full_name ? profile.full_name : "";
  $("acctEmail").textContent = user ? user.email : "";
  // 회원 ID: 선생님이 학생을 찾을 때 쓰는 무작위 8자리 코드 (2026-11-10, DB profiles.member_code)
  $("acctId").textContent = profile && profile.member_code ? `ID #${profile.member_code}` : "";
  $("acctIdRow").hidden = !(profile && profile.member_code);
  $("menuStudents").hidden = !Account.isAdmin();
  $("restoreText").textContent = profile && profile.deleted_at
    ? t("restoreNote", { date: fmtDate(new Date(new Date(profile.deleted_at).getTime() + GRACE_DAYS * 864e5)) }) : "";
  // 로그아웃했는데 "내 계정"이 열려 있으면 로그인 화면으로
  if (isOpen() && view === "account" && !user) show("login");
}

// 사이드바의 "틀린 문제 다시 풀기" 옆 숫자(두 연습 합) + 펼친 목록의 연습별 숫자. 오답이 없는 연습은 목록에서 숨김
async function countReview() {
  setReviewOpen(false);   // 사이드바를 열 때마다 목록은 접힌 채로
  $("reviewCount").textContent = "";
  const [play, name] = await Promise.all([Account.reviewCount("play"), Account.reviewCount("name")]);
  const n = play + name;
  $("reviewCount").textContent = n || "";
  $("menuReview").disabled = !n;
  for (const [mode, c] of [["play", play], ["name", name]]) {
    const b = $("reviewSub").querySelector(`[data-review="${mode}"]`);
    b.hidden = !c; b.querySelector(".badge").textContent = c || "";
  }
  if (!n) setReviewOpen(false);
}
function setReviewOpen(open) {
  $("reviewSub").hidden = !open;
  $("menuReview").setAttribute("aria-expanded", String(open));
}

// 정보 추가 입력 화면: 소셜 로그인 첫 방문이면 닉네임·언어·동의 칸도 보여주고, 아는 값(소셜 계정 이름 등)을 미리 채움
function fillComplete() {
  const f = form("complete"), p = Account.profile || {}, consent = Account.needsConsent();
  f.querySelector(".consent").hidden = !consent;
  f.querySelectorAll(".consent input, .consent select").forEach(el => { el.disabled = !consent; });
  $("completeNote").dataset.i18n = consent ? "completeSocialNote" : "completeNote";
  $("completeNote").textContent = t($("completeNote").dataset.i18n);
  // 소셜 로그인 첫 방문: 그 계정의 이름(구글 계정 이름 등)을 미리 채움. 없으면 빈칸 (DB의 임시 이름은 닉네임이라 쓰지 않음)
  const meta = (Account.user && Account.user.user_metadata) || {};
  f.fullName.value = consent ? String(meta.full_name || meta.name || "").trim() : p.full_name || "";
  resetNameField(f);
  if (consent) {
    f.nickname.value = p.nickname || "";
    f.lang.value = lang();   // 지금 보고 있는 화면 언어 (프로필의 en은 임시값)
  }
}

// ---------- 인증 메일 다시 보내기 ----------
let resendEmail = "", resendLeft = 0, resendTimer = null;
const RESEND_WAIT = 60;   // 초. Supabase가 같은 주소에 60초에 한 번만 보내서 그동안 버튼을 끔
function drawResend() {
  const b = $("resendBtn");
  b.disabled = resendLeft > 0;
  b.textContent = t("resendConfirm") + (resendLeft > 0 ? ` (${resendLeft})` : "");
}
function showResend(email) { resendEmail = email; $("resendBtn").hidden = false; drawResend(); }
function hideResend() { $("resendBtn").hidden = true; }
async function resend() {
  if (!resendEmail || resendLeft > 0 || needClient()) return;
  resendLeft = RESEND_WAIT; drawResend();
  clearInterval(resendTimer);
  resendTimer = setInterval(() => { resendLeft--; drawResend(); if (resendLeft <= 0) clearInterval(resendTimer); }, 1000);
  const { error } = await Account.resendSignup(resendEmail, here());
  setMsg(error ? "no" : "ok", error ? errorKey(error) : "msgResent");
}

// 회원 정보 변경 화면의 사진: undefined = 그대로, { blob, url } = 새로 고른 사진, null = 지우기(닉네임 첫 글자로)
let pendingAvatar;
// 사진 미리보기 + "기본 이미지로" 버튼 (지금 보이는 게 사진일 때만)
function drawProfileAvatar() {
  const url = pendingAvatar === undefined ? Account.avatarUrl() : pendingAvatar && pendingAvatar.url;
  drawAvatar($("profileAvatar"), url, form("profile").nickname.value || (Account.profile && Account.profile.nickname));
  $("avatarRemove").hidden = !url;
}
async function pickAvatar(file) {
  if (!file) return;
  try {
    const blob = await squareJpeg(file);
    if (pendingAvatar && pendingAvatar.url) URL.revokeObjectURL(pendingAvatar.url);
    pendingAvatar = { blob, url: URL.createObjectURL(blob) };
    setMsg("", "");
  } catch (e) {
    setMsg("no", "errAvatar");   // 이미지가 아니거나 브라우저가 못 여는 형식(일부 HEIC 등)
  }
  drawProfileAvatar();
  profileReady();
}
function removeAvatar() {
  // 저장된 사진이 있으면 지우기로, 방금 고른 사진뿐이면 고르기 전으로
  pendingAvatar = Account.profile && Account.profile.avatar_version ? null : undefined;
  drawProfileAvatar();
  profileReady();
}

// 회원 정보 변경 화면: 지금 계정 정보로 칸을 채움 (열 때마다 — 저장하지 않고 나갔다 오면 원래 값으로)
function fillProfile() {
  const f = form("profile"), p = Account.profile || {};
  pendingAvatar = undefined;
  $("avatarFile").value = "";
  f.email.value = Account.user ? Account.user.email : "";
  f.fullName.value = p.full_name || "";
  f.nickname.value = p.nickname || "";
  f.lang.value = p.preferred_lang || lang();
  drawProfileAvatar();
  profileReady();
  loadMyRecovery();
}

// ---------- 비밀번호 찾기 단계 ----------
let resetQ = null;   // 2단계에서 보여주는 질문 { question, custom_text }, 1단계면 null
function resetStep(n, quiet) {
  const f = form("reset");
  if (n === 1) { resetQ = null; f.ra.value = ""; }
  f.email.readOnly = n === 2;
  $("resetStep2").hidden = n !== 2;
  $("resetOther").hidden = n !== 2;
  $("resetSubmit").textContent = t(n === 2 ? "doReset" : "doNext");
  $("resetQuestion").textContent = resetQ ? rqText(resetQ.question, resetQ.custom_text) : "";
  if (n === 2 && !quiet) { setMsg("", ""); f.ra.focus(); }
}
// 바뀐 칸만 { 열 이름: 새 값 }으로 (앞뒤 빈칸은 무시하고 비교)
function profileChanges() {
  const f = form("profile"), p = Account.profile || {}, out = {};
  if (f.nickname.value.trim() !== (p.nickname || "")) out.nickname = f.nickname.value.trim();
  if (f.lang.value !== p.preferred_lang) out.preferred_lang = f.lang.value;
  return out;
}
// 본인 확인 질문 (회원 정보 변경): 지금 질문을 불러와 칸에 맞춰 둠. 답은 비워 두고, 바꿀 때만 입력
let myRecovery = null;   // { question, custom_text } — 불러오기 전이면 null
async function loadMyRecovery() {
  const box = $("profileRecovery"), f = form("profile");
  myRecovery = null;
  box.hidden = !Account.hasPassword();
  if (box.hidden) return;
  f.rq.value = ""; f.rqText.value = ""; f.ra.value = ""; toggleCustom(f);
  const { data } = await Account.myRecovery();
  myRecovery = data || { question: "default", custom_text: null };
  f.rq.value = myRecovery.question === "default" ? "" : myRecovery.question;
  f.rqText.value = myRecovery.custom_text || "";
  toggleCustom(f);
  profileReady();
}
// 질문이나 답을 바꿨으면 { question, custom, answer }, 아니면 null
function recoveryChange() {
  const f = form("profile");
  if (!myRecovery || $("profileRecovery").hidden) return null;
  const q = f.rq.value, custom = q === "custom" ? f.rqText.value.trim() : "";
  const sameQ = q === (myRecovery.question === "default" ? "" : myRecovery.question) && custom === (myRecovery.question === "custom" ? myRecovery.custom_text || "" : "");
  return sameQ && !f.ra.value.trim() ? null : { question: q, custom, answer: f.ra.value };
}

// 저장 버튼: 하나라도 바뀌었을 때만 켜짐
function profileReady() {
  $("profileSave").disabled = !Object.keys(profileChanges()).length && pendingAvatar === undefined && !recoveryChange();
}

// 비밀번호 확인 칸 제목 옆 표시: 확인 칸에 뭔가 썼을 때만, 두 칸이 같으면 초록 "일치합니다", 다르면 주황 "일치하지 않습니다"
// (회원가입·새 비밀번호·비밀번호 변경 화면 모두. 실제 제출 때는 SUBMIT에서 한 번 더 확인)
function pwMatch() {
  dlg().querySelectorAll(".pw-match").forEach(el => {
    const f = el.closest("form"), typed = f.password2.value;
    const same = typed === f.password.value;
    el.className = "pw-match" + (typed ? (same ? " ok" : " no") : "");
    el.textContent = typed ? t(same ? "pwMatch" : "pwNoMatch") : "";
  });
}

// 회원 탈퇴 버튼: 비밀번호를 넣고 확인 문구를 정확히 똑같이 썼을 때만 켜짐
function deleteReady() {
  const f = form("delete");
  $("deleteSubmit").disabled = !((f.current.value || !Account.hasPassword()) && f.phrase.value === t("deletePhrase"));
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
  finally { if (btn) btn.disabled = false; if (f.dataset.view === "delete") deleteReady(); if (f.dataset.view === "profile") profileReady(); }
}
// ---------- 성명 형식 (2026-11-10) ----------
// 칸에서 나가면 검사하고, 그 뒤로는 고칠 때마다 다시 검사. soft 오류에 [확인]을 누르면 그 이름은 통과(한 글자라도 고치면 다시 검사)
const nameState = new WeakMap();   // 폼 → { touched, confirmed: [확인]을 누른 이름 }
const nameOf = f => nameState.get(f) || nameState.set(f, { touched: false, confirmed: null }).get(f);
/** 성명 칸 검사 + 오류 줄 표시. @returns { ok, name(저장할 값), confirmed(흔하지 않은 이름을 본인이 확인) } */
function checkNameField(f, show = true) {
  const st = nameOf(f), r = checkName(f.fullName.value);
  const confirmed = r.level === "soft" && st.confirmed === r.name;
  const ok = r.level === "ok" || confirmed;
  if (show) {
    const box = f.querySelector(".name-err"), text = box.querySelector(".name-err-text");
    box.hidden = ok;
    box.querySelector(".name-help").hidden = r.level !== "soft";
    // 오류 문구와 ? 안내 모두 페이지 언어로 (안내는 한글 이름 / 영문 이름에 따라)
    text.dataset.i18n = "errNameInvalid"; text.textContent = t("errNameInvalid");
    if (r.level === "soft") {
      const tip = box.querySelector(".name-soft-text");
      tip.dataset.i18n = r.script === "en" ? "nameSoftEn" : "nameSoftKo";
      tip.textContent = t(tip.dataset.i18n);
    }
  }
  return { ok, name: r.name, confirmed };
}
function wireNameField(f) {
  const st = nameOf(f);
  f.fullName.addEventListener("blur", () => { if (f.fullName.value.trim()) { st.touched = true; checkNameField(f); } });
  f.fullName.addEventListener("input", () => { if (st.touched) checkNameField(f); });
  f.querySelector(".name-ok").addEventListener("click", () => {
    st.confirmed = checkName(f.fullName.value).name;
    f.querySelector(".name-help").classList.remove("open");
    checkNameField(f);
  });
}
function resetNameField(f) {
  const st = nameOf(f);
  st.touched = false; st.confirmed = null;
  f.querySelector(".name-err").hidden = true;
}
/** 제출할 때: 통과 못 하면 오류를 보여주고 칸으로 */
function nameForSubmit(f) {
  nameOf(f).touched = true;
  const v = checkNameField(f);
  if (!v.ok) { setMsg("", ""); f.fullName.focus(); }
  return v;
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
    if (error) {
      setMsg("no", errorKey(error));
      if (error.code === "email_not_confirmed") showResend(email); else hideResend();
      return;
    }
    f.reset(); close();
  },
  async signup(f) {
    const nickname = f.nickname.value.trim(), email = f.email.value.trim(), password = f.password.value;
    const chosenLang = f.lang.value;
    const nm = nameForSubmit(f);
    if (!nm.ok) return;
    const fullName = nm.name;
    if (!nickname || nickname.length > NICK_MAX) return setMsg("no", "errNickname");
    if (!validEmail(email)) return setMsg("no", "errEmail");
    if (password.length < PW_MIN) return setMsg("no", "errPwShort");
    if (f.password2.value !== password) return setMsg("no", "errPwMismatch");
    // 동의 확인은 DB(handle_new_user 트리거)도 다시 검사함 — 여기는 편의용
    if (!f.rq.value || (f.rq.value === "custom" && !f.rqText.value.trim())) return setMsg("no", "errRecoveryQ");
    if (!f.ra.value.trim()) return setMsg("no", "errRecoveryA");
    if (!f.age14.checked || !f.terms.checked || !f.privacy.checked) return setMsg("no", "errAgree");
    if (needClient()) return;
    // 확인 답은 가입 정보와 함께 보내고, DB(handle_new_user)가 해시로 바꿔 저장한 뒤 원문은 바로 지움
    const { data, error } = await Account.signUp(email, password,
      { nickname, full_name: fullName, name_confirmed: nm.confirmed, preferred_lang: chosenLang, age14: true, terms_version: TERMS_VERSION,
        recovery_q: f.rq.value, recovery_q_text: f.rq.value === "custom" ? f.rqText.value.trim() : null, recovery_a: f.ra.value }, here());
    if (error) return setMsg("no", errorKey(error));
    f.reset(); resetNameField(f);
    // 이메일 인증을 켜 두어서 보통 세션이 없음 (이미 가입된 주소도 같은 안내 — 가입 여부를 알려주지 않으려고)
    if (data.session) close(); else { show("login", { kind: "ok", key: "msgSignupSent" }); showResend(email); }
    if (chosenLang !== lang()) setLang(chosenLang);   // 고른 언어를 바로 화면 언어로
  },
  async complete(f) {
    const nm = nameForSubmit(f);
    if (!nm.ok) return;
    const fullName = nm.name;
    if (Account.needsConsent()) {
      // 소셜 로그인 첫 방문: 동의는 DB(complete_signup)도 다시 검사함 — 여기는 편의용
      const nickname = f.nickname.value.trim();
      if (!nickname || nickname.length > NICK_MAX) return setMsg("no", "errNickname");
      if (!f.age14.checked || !f.terms.checked || !f.privacy.checked) return setMsg("no", "errAgree");
      const { error } = await Account.completeSignup({ p_full_name: fullName, p_nickname: nickname, p_lang: f.lang.value,
        p_age14: true, p_terms_version: TERMS_VERSION, p_name_confirmed: nm.confirmed });
      if (error) return setMsg("no", errorKey(error));
      f.reset(); close();   // 프로필을 다시 불러오며 고른 언어가 화면에 적용됨 ("profile" 이벤트)
      return;
    }
    // 성명이 비어 있던 예전 회원: 한 번만 채움 (그 뒤로는 관리자만 바꿈 — DB set_my_full_name)
    const { error } = await Account.setMyFullName(fullName, nm.confirmed);
    if (error) return setMsg("no", errorKey(error));
    show("account", { kind: "ok", key: "msgSaved" });
  },
  // 내 계정 → 회원 정보 변경: 바뀐 칸만 저장. 사용 언어를 바꿨으면 화면 언어도 바로 바꿈 (언어별 페이지는 그 언어 주소로 이동)
  async profile(f) {
    const changes = profileChanges(), rc = recoveryChange();
    if (!Object.keys(changes).length && pendingAvatar === undefined && !rc) return;
    if ("nickname" in changes && (!changes.nickname || changes.nickname.length > NICK_MAX)) return setMsg("no", "errNickname");
    // 본인 확인 질문이 아직 없는 기존 회원('default'): 다른 칸만 고쳐도 질문·답을 먼저 등록해야 저장됨 (2026-11-07 사용자 결정)
    const mustSet = !$("profileRecovery").hidden && myRecovery && myRecovery.question === "default";
    const f2 = form("profile");
    if (mustSet && (!f2.rq.value || (f2.rq.value === "custom" && !f2.rqText.value.trim()))) return setMsg("no", "errRecoveryQ");
    if (mustSet && !f2.ra.value.trim()) return setMsg("no", "errRecoveryA");
    if (rc && (!rc.question || (rc.question === "custom" && !rc.custom))) return setMsg("no", "errRecoveryQ");
    if (rc && !rc.answer.trim()) return setMsg("no", "errRecoveryA");   // 질문을 바꾸면 답도 새로
    // 사진 먼저 (실패하면 다른 칸도 저장하지 않고 그대로 둠)
    if (pendingAvatar !== undefined) {
      const res = pendingAvatar ? await Account.uploadAvatar(pendingAvatar.blob) : await Account.removeAvatar();
      if (res.error) return setMsg("no", errorKey(res.error));
      pendingAvatar = undefined;
    }
    if (rc) {
      const { error } = await Account.setRecovery(rc.question, rc.custom, rc.answer);
      if (error) return setMsg("no", errorKey(error));
    }
    if (Object.keys(changes).length) {
      const { error } = await Account.updateProfile(changes);
      if (error) return setMsg("no", errorKey(error));
    }
    show("account", { kind: "ok", key: "msgSaved" });
    if (changes.preferred_lang && changes.preferred_lang !== lang()) setLang(changes.preferred_lang);
  },
  async reset(f) {
    const email = f.email.value.trim();
    if (!validEmail(email)) return setMsg("no", "errEmail");
    if (needClient()) return;
    if (resetQ === null) {
      // 1단계: 질문 불러오기
      const { data, error } = await Account.resetQuestion(email);
      if (error) return setMsg("no", errorKey(error));
      resetQ = data;
      return resetStep(2);
    }
    // 2단계: 답 확인 → 맞으면 재설정 메일
    if (!f.ra.value.trim()) return setMsg("no", "errRecoveryA");
    const check = await Account.checkResetAnswer(email, f.ra.value);
    if (check.error) return setMsg("no", /too_many/.test(check.error.message || "") ? "errTooMany" : errorKey(check.error));
    if (!check.data.ok) return setMsg("no", "errAnswer", { n: check.data.wrong });   // "(n/5회)"
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
    // 비밀번호가 있는 회원만 비밀번호 확인 (소셜 로그인 회원은 로그인 상태 + 확인 문구로 진행)
    if (Account.hasPassword()) {
      const check = await Account.verifyPassword(f.current.value);
      if (check.error) return setMsg("no", check.error.code === "invalid_credentials" ? "errCurrentPw" : errorKey(check.error));
    }
    // 프로필 사진은 탈퇴 신청 때 바로 지움 (사진은 누구나 주소로 볼 수 있는 저장소라 7일을 기다리지 않음)
    if (Account.profile && Account.profile.avatar_version) await Account.removeAvatar();
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

  // 계정 복구 창을 닫으면(✕, Esc) 탈퇴를 그대로 두고 로그아웃.
  // dialog의 "close" 이벤트 대신 각 동작에서 처리: 창을 빠르게 닫았다 열면 Chrome이 close 이벤트를 빠뜨리는 경우가 있었음
  // 소셜 로그인 첫 방문에서 동의하지 않고 창을 닫아도 같은 방식으로 로그아웃 (동의 전에는 계정을 쓰지 않음)
  const declineRestore = () => {
    if (view === "restore" && Account.profile && Account.profile.deleted_at) Account.signOut();
    if (view === "complete" && Account.needsConsent()) Account.signOut();
  };
  dlg().addEventListener("cancel", declineRestore);
  dlg().querySelector(".auth-close button").addEventListener("click", declineRestore);
  // 가운데 창(로그인·회원가입 등)은 ✕나 Esc로만 닫힘. 바깥(어두운 배경)을 눌러도 닫지 않음 (2026-11-07 사용자 결정):
  // 입력칸의 글자를 드래그해 고르다가 창 밖에서 마우스를 떼면 그것도 "바깥 클릭"이 되어 창이 꺼지고 입력이 날아갔기 때문.
  // "내 계정" 사이드바 메뉴(account 화면)만 바깥을 누르면 닫힘. 입력칸이 있는 비밀번호 변경 화면은 사이드바여도 안 닫힘.
  // 누르기 시작한 곳도 바깥이어야 닫음 (창 안에서 누르고 밖에서 뗀 경우는 무시)
  let downOutside = false;
  const outside = e => {
    const r = dlg().getBoundingClientRect();
    return e.target === dlg() && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  dlg().addEventListener("pointerdown", e => { downOutside = outside(e); });
  dlg().addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); open(go.dataset.go); return; }
    if (view === "account" && downOutside && outside(e)) close();
  });

  dlg().querySelectorAll("form[data-view]").forEach(f => {
    f.addEventListener("submit", e => { e.preventDefault(); busy(f, () => SUBMIT[f.dataset.view](f)); });
  });
  form("delete").addEventListener("input", deleteReady);
  wireNameField(form("signup"));
  wireNameField(form("complete"));
  form("profile").addEventListener("input", profileReady);
  form("profile").addEventListener("change", profileReady);   // 언어 고르기(select)
  form("profile").nickname.addEventListener("input", drawProfileAvatar);   // 사진이 없으면 첫 글자가 따라 바뀜
  $("avatarPick").onclick = () => $("avatarFile").click();
  $("avatarFile").onchange = e => pickAvatar(e.target.files[0]);
  $("avatarRemove").onclick = removeAvatar;
  dlg().addEventListener("change", e => { if (e.target.name === "rq") toggleCustom(e.target.form); });
  $("resetOther").onclick = () => { form("reset").email.value = ""; resetStep(1); form("reset").email.focus(); };
  dlg().addEventListener("input", e => { if (e.target.name === "password" || e.target.name === "password2") pwMatch(); });
  onLangChange(pwMatch);

  // 회원 ID 복사: 코드만(#K7M3Q9TX의 K7M3Q9TX) 클립보드로. 못 쓰면 ID 글자를 선택해 두어 직접 복사하게
  $("acctIdCopy").onclick = () => {
    const code = (Account.profile && Account.profile.member_code) || "";
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($("acctId")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText(code).then(() => toast(t("msgCopied"), 2000), fallback); } catch (e) { fallback(); }
  };
  $("resendBtn").onclick = resend;
  dlg().querySelectorAll("[data-provider]").forEach(b => {
    b.onclick = async () => {
      if (needClient()) return;
      const { error } = await Account.signInWithProvider(b.dataset.provider, here());
      if (error) setMsg("no", errorKey(error));   // 성공하면 그 회사 로그인 화면으로 이동해서 여기로 안 옴
    };
  });
  // 소셜 로그인에서 돌아왔는데 실패한 경우 (주소 뒤에 error_description이 붙어 옴) → 로그인 창에 안내
  const back = new URLSearchParams(location.hash.slice(1) || location.search);
  if (back.get("error_description")) {
    open("login", { kind: "no", key: "errOauth" });
    history.replaceState(null, "", location.pathname);
  }

  $("logoutBtn").onclick = async () => { await Account.signOut(); close(); };
  $("menuReview").onclick = () => setReviewOpen($("reviewSub").hidden);
  $("reviewSub").onclick = e => { const b = e.target.closest("[data-review]"); if (b) { close(); hooks.startReview(b.dataset.review); } };
  $("deleteAcctBtn").onclick = () => open("delete");
  $("restoreBtn").onclick = async () => {
    const { error } = await Account.restore();
    if (error) return setMsg("no", errorKey(error));
    if (!missingFields(Account.profile).length) show("account", { kind: "ok", key: "msgRestored" });
  };
  $("restoreLogoutBtn").onclick = async () => { await Account.signOut(); close(); };

  Account.on("change", render);
  // 로그인하지 않은 방문자: 페이지가 한가해지면 구글 로그인 스크립트를 미리 받아 둠 (로그인 창을 열자마자 구글 버튼이 보이게)
  if (googleOn) {
    let preloaded = false;
    const maybePreload = () => {
      if (preloaded || !Account.ready || Account.user) return;
      preloaded = true;
      (window.requestIdleCallback || (fn => setTimeout(fn, 1500)))(preloadGoogle);
    };
    Account.on("change", maybePreload);
    maybePreload();
  }
  Account.on("restore", () => open("restore"));
  Account.on("complete", () => open("complete"));
  Account.on("recovery", () => open("newpw"));
  // 언어를 바꾸면 JS로 넣은 문구(제목, 안내, 탈퇴 확인 문구)를 다시 그림
  onLangChange(() => {
    if (isOpen() && (view === "login" || view === "join")) drawGoogle();   // 구글 버튼 글자 언어
    $("authTitle").textContent = t(TITLES[view]);
    setMsg(msg.kind, msg.key, msg.vars);
    deleteReady();
    drawResend();
    if (view === "reset") resetStep(resetQ ? 2 : 1, true);   // 언어만 바뀜: 입력·안내는 그대로
    if (view === "complete") $("completeNote").textContent = t($("completeNote").dataset.i18n);
    render();
  });
  render();
}
