// ===== 모든 페이지가 같이 쓰는 머리글·바닥글·왼쪽 메뉴와 페이지 시작 =====
// 각 HTML에는 <header class="top" id="siteHeader"></header>와 <footer class="contact" id="siteFooter"></footer> 자리만 있고,
// 내용은 여기서 채워요. 머리글·바닥글·메뉴를 고칠 때 이 파일 한 곳만 고치면 모든 페이지에 반영돼요.
// 메뉴에 들어가는 페이지 목록은 sitemap.js에 있어요.
//
// 페이지 JS는 보통 이렇게 시작해요:
//   import { startPage } from "../common/layout.js";
//   startPage({ title: "menuMy" });
import { t, lang, setLang, applyI18n, onLangChange } from "../i18n/index.js";
import { Account } from "../account/account.js";
import { initAuthDialog, ROOT } from "../account/auth-dialog.js";
import { SITEMAP, ROUTES } from "./sitemap.js";
import { $ } from "./dom.js";

const LANG_SELECT = `
  <label class="lang">
    <span class="visually-hidden">Language</span>
    <select id="langSel" aria-label="Language">
      <option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh">简体中文</option>
    </select>
  </label>`;

// 줄 3개 메뉴 아이콘
const MENU_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/** 주소에서 .html 떼기: "/about.html" → "/about", "/teacher/index.html" → "/teacher/" */
export const cleanPath = p => p.replace(/\/index\.html$/, "/").replace(/\.html$/, "");

/**
 * 주소창을 깔끔하게: .html로 들어왔으면 페이지를 다시 불러오지 않고 주소창만 .html 없는 주소로 바꿈(history.replaceState).
 * 같은 폴더 안의 주소라서 페이지 안의 상대 링크·파일 경로는 그대로 맞아요. 새로고침해도 서버가 /about → about.html로 연결해요.
 */
function cleanAddressBar() {
  const clean = cleanPath(location.pathname);
  if (clean !== location.pathname) history.replaceState(history.state, "", clean + location.search + location.hash);
}

// 머리글. stats=true면 연습 페이지의 "정답/시도 · 연속" 표시, back=true면 "← 연습으로" 링크
function headerHTML({ stats, back }) {
  return `
    <div class="brand">
      <button class="menu-btn" id="menuBtn" type="button" aria-label="메뉴" data-i18n-aria="menuOpen" aria-controls="navDrawer" aria-expanded="false">${MENU_ICON}</button>
      <h1><a href="${ROOT}" class="brand-link"><img class="logo" src="${ROOT}favicon.svg" alt="">Chord<em>Oven</em></a></h1>
      <span data-i18n="tagline"></span>
    </div>
    <div class="top-right">
      ${back ? `<a class="linkbtn top-back" href="${ROOT}${ROUTES.trainer}" data-i18n="backPractice"></a>` : ""}
      ${stats ? `<div class="stats" aria-label="연습 기록" data-i18n-aria="statsAria">
        <span class="stat"><span data-i18n="firstTry"></span> <b id="stFirst">0</b> / <b id="stTotal">0</b></span>
        <span class="stat"><span data-i18n="streak"></span> <b id="stStreak">0</b></span>
      </div>` : ""}
      ${LANG_SELECT}
      <button class="account-btn" id="accountBtn" type="button" hidden><span id="accountLogin" data-i18n="login"></span><span id="accountName" hidden></span></button>
    </div>`;
}

// 왼쪽 메뉴(사이트 지도, 회원 여부와 상관없이 같음). 지금 보고 있는 페이지는 강조, 준비 중인 기능은 흐리게
function drawerHTML() {
  const here = cleanPath(location.pathname);
  const item = it => {
    const label = `<span data-i18n="${it.key}"></span>`;
    if (it.soon) return `<span class="nav-item soon">${label}<small data-i18n="navSoon"></small></span>`;
    const href = ROOT + it.path;
    const current = cleanPath(new URL(href).pathname) === here;
    return `<a class="nav-item" href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
  };
  const homeCurrent = cleanPath(new URL(ROOT).pathname) === here;
  return `
<dialog class="nav-drawer" id="navDrawer" aria-label="메뉴" data-i18n-aria="menuOpen">
  <div class="nav-head">
    <a class="brand-link nav-brand" href="${ROOT}"><img class="logo" src="${ROOT}favicon.svg" alt="">Chord<em>Oven</em></a>
    <form method="dialog"><button class="icon-btn" aria-label="닫기" data-i18n-aria="close">✕</button></form>
  </div>
  <nav class="nav-list">
    <a class="nav-item" href="${ROOT}"${homeCurrent ? ' aria-current="page"' : ""}><span data-i18n="navHome"></span></a>
    ${SITEMAP.map(g => (g.group ? `<p class="nav-group" data-i18n="${g.group}"></p>` : `<hr class="nav-sep">`) + g.items.map(item).join("")).join("")}
  </nav>
</dialog>`;
}

// 바닥글: 문의(이메일 복사 버튼, 인스타그램)와 약관 링크(회원 기능이 켜졌을 때만)
const FOOTER = `
  <h2 id="contactH" data-i18n="contactH"></h2>
  <dl>
    <div class="contact-row">
      <dt>E-mail</dt>
      <dd><span class="contact-val" id="mailText">kim_8417@naver.com</span><button class="mini-btn" id="copyMail" type="button" data-i18n="copy"></button></dd>
    </div>
    <div class="contact-row">
      <dt>Instagram</dt>
      <dd><a class="contact-val" href="https://www.instagram.com/thrill_kim/" target="_blank" rel="noopener">@thrill_kim</a></dd>
    </div>
  </dl>
  <nav class="legal-links" hidden><a href="${ROOT}terms" data-i18n="termsLink"></a><a href="${ROOT}privacy" data-i18n="privacyLink"></a></nav>`;

/**
 * 도움말(?) 버튼: <span class="help"><button class="help-btn">?</button><span class="help-pop">설명</span></span>
 * 마우스를 올리면 CSS로 보이고, 누르면 열림/닫힘(터치 화면용), 바깥을 누르면 닫힘. 화면이 다시 그려져도 동작하도록 문서 전체에서 처리.
 */
function wireHelp() {
  document.addEventListener("click", e => {
    const btn = e.target.closest(".help-btn");
    document.querySelectorAll(".help.open").forEach(h => {
      if (!btn || h !== btn.parentElement) { h.classList.remove("open"); h.querySelector(".help-btn").setAttribute("aria-expanded", "false"); }
    });
    if (btn) {
      const wrap = btn.parentElement, open = !wrap.classList.contains("open");
      wrap.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
  });
}

/**
 * 페이지 시작: 머리글·바닥글·메뉴를 그리고, 문구를 현재 언어로 바꾸고, 로그인 창을 붙이고, 로그인 상태 확인을 시작해요.
 * @param title  탭 제목 문구 키 (예: "menuMy") — 탭에는 "마이페이지 · ChordOven"처럼 보임
 * @param stats  머리글에 정답/시도·연속 표시를 넣을지 (연습 페이지)
 * @param back   머리글에 "← 연습으로" 링크를 넣을지
 */
export function startPage({ title = "docTitle", stats = false, back = false } = {}) {
  cleanAddressBar();
  const header = $("siteHeader"), footer = $("siteFooter");
  if (header) header.innerHTML = headerHTML({ stats, back });
  if (footer) { footer.innerHTML = FOOTER; footer.setAttribute("aria-labelledby", "contactH"); }
  document.body.insertAdjacentHTML("beforeend", drawerHTML());

  const setTitle = () => { document.title = t(title) + " · ChordOven"; };
  applyI18n(); setTitle();
  onLangChange(setTitle);

  // ☰ 메뉴: 왼쪽에서 나오는 사이드바. 바깥(어두운 배경)을 누르면 닫힘
  const drawer = $("navDrawer"), menuBtn = $("menuBtn");
  if (menuBtn) menuBtn.onclick = () => { drawer.showModal(); menuBtn.setAttribute("aria-expanded", "true"); };
  drawer.addEventListener("close", () => menuBtn && menuBtn.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("click", e => {
    if (e.target !== drawer) return;
    const r = drawer.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) drawer.close();
  });
  wireHelp();

  // 언어 고르기: 화면 언어를 바꾸고, 로그인 중이면 계정의 사용 언어도 바꿈
  const sel = $("langSel");
  sel.value = lang();
  sel.onchange = e => { setLang(e.target.value); Account.langChanged(e.target.value); };
  onLangChange(l => { sel.value = l; });

  // 이메일 복사: 클립보드를 못 쓰면 주소를 선택해 두어 직접 복사하게
  const copy = $("copyMail");
  if (copy) copy.onclick = () => {
    const done = () => { copy.textContent = t("copied"); setTimeout(() => { copy.textContent = t("copy"); }, 1500); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($("mailText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText($("mailText").textContent).then(done, fallback); } catch (err) { fallback(); }
  };

  if (Account.configured) document.querySelectorAll(".legal-links").forEach(el => { el.hidden = false; });
  initAuthDialog();
  // 계정의 사용 언어가 어느 기기에서든 화면 언어가 됨
  Account.on("profile", p => { if (p.preferred_lang && p.preferred_lang !== lang()) setLang(p.preferred_lang); });
  Account.start();
}

