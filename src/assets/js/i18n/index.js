// ===== 다국어(i18n) =====
// 화면 문구를 고르는 곳. 문구 자체는 같은 폴더의 ko.js / en.js / ja.js / zh.js에 있어요.
//
// 사용법
//   - JS에서:   t("check")               → "채점" (현재 언어)
//               t("missing", { n: 2 })   → "빠진 음 2개"  ({n} 자리를 채움)
//   - HTML에서: <span data-i18n="check"></span>          → 내용(innerHTML)을 문구로 바꿈
//               data-i18n-aria="키" / data-i18n-title="키" → aria-label / title 속성을 바꿈
//     applyI18n()을 부르면 페이지 안의 이런 요소가 모두 현재 언어로 바뀌어요.
//
// 언어 결정 순서: 언어별 페이지(/ko/… 주소)면 그 페이지의 언어 → 저장된 선택(localStorage) → 브라우저 언어 → 영어.
// 언어별 페이지(홈·About Us·코드 연습)는 tools/build.js가 언어마다 따로 만들어요. 이런 페이지에서 언어를 바꾸면
// 글자만 바꾸지 않고 그 언어 주소(/en/…)로 이동해요. 마이페이지·선생님 페이지는 주소가 하나라서 지금처럼 글자를 바꿔요.
// 음이름(C D E…)과 코드 기호는 모든 언어에서 같아서 번역하지 않아요(사용자 결정).
import ko from "./ko.js";
import en from "./en.js";
import ja from "./ja.js";
import zh from "./zh.js";
import { store } from "../common/storage.js";

export const STRINGS = { ko, en, ja, zh };
export const LANGS = Object.keys(STRINGS);
// 날짜를 언어에 맞게 쓸 때 쓰는 지역 코드
const LOCALES = { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" };

/** 언어별 페이지면 그 언어 (빌드가 <html data-page-lang="ko">로 표시), 아니면 null */
export const PAGE_LANG = (typeof document !== "undefined" && document.documentElement.dataset.pageLang) || null;

// 언어 고르는 규칙. tools/build.js의 입구 페이지(entryPage)도 같은 순서로 고르니 바꾸면 둘 다.
function detect() {
  if (LANGS.includes(PAGE_LANG)) return PAGE_LANG;
  const saved = store.get("lang");
  if (LANGS.includes(saved)) return saved;
  const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  for (const l of prefs) {
    const code = String(l).toLowerCase().slice(0, 2);   // "zh-TW" → "zh" (번체 환경도 간체로 표시)
    if (LANGS.includes(code)) return code;
  }
  return "en";
}

let current = detect();
const listeners = [];
// 언어별 페이지를 보고 있으면 그 언어를 기억 (다음에 마이페이지 등 주소가 하나인 페이지도 같은 언어로)
if (PAGE_LANG && store.get("lang") !== current) store.set("lang", current);

/** 현재 언어 코드 ("ko" | "en" | "ja" | "zh") */
export const lang = () => current;
/** 현재 언어의 날짜 지역 코드 ("ko-KR" 등) */
export const locale = () => LOCALES[current] || "en-US";

/** 문구 하나. 현재 언어에 없으면 영어 → 한국어 → 키 이름 순으로 대신 씀 */
export function t(key, vars = {}) {
  const s = STRINGS[current][key] ?? en[key] ?? ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, n) => (vars[n] ?? ""));
}

/** root 안의 data-i18n* 요소를 모두 현재 언어로 바꿈 */
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  root.querySelectorAll("[data-i18n-title]").forEach(el => el.setAttribute("title", t(el.dataset.i18nTitle)));
  document.documentElement.lang = current === "zh" ? "zh-Hans" : current;
}

/** 언어별 페이지 주소를 다른 언어로: "/ko/about" → "/en/about" (뒤의 ?…#…도 그대로) */
export const langPath = l => location.pathname.replace(/^\/(ko|en|ja|zh)(?=\/)/, "/" + l) + location.search + location.hash;

/**
 * 언어 바꾸기: 저장하고, 페이지 문구를 바꾸고, onLangChange로 등록한 함수들을 부름.
 * 언어별 페이지에서는 같은 페이지의 그 언어 주소로 이동 (화면에 있던 문제 등은 새로 시작).
 */
export function setLang(l) {
  if (!LANGS.includes(l) || l === current) return;
  store.set("lang", l);
  if (PAGE_LANG) { location.href = langPath(l); return; }
  current = l;
  applyI18n();
  listeners.forEach(fn => fn(l));
}

/** 언어가 바뀔 때마다 부를 함수 등록 (JS로 그린 문구를 다시 그릴 때) */
export function onLangChange(fn) { listeners.push(fn); }
