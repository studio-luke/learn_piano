// ===== 자동 가입·로그인 방지 (Cloudflare Turnstile) =====
// config.js의 turnstileSiteKey가 있을 때만 켜져요. 비어 있으면 아무것도 안 하고 토큰 없이 진행.
// 로그인·회원가입·인증 메일 다시 보내기·비밀번호 재설정 메일·비밀번호 확인(변경·탈퇴) 직전에 토큰을 하나씩 받아
// Supabase에 함께 보내요(account.js). Supabase(Attack Protection)에서 켜 두면 토큰 없는 요청은 거부돼요.
// 보통 사람은 아무것도 누르지 않아도 통과하고, 의심스러울 때만 로그인 창 안(#captchaBox)에 확인 상자가 나타나요.
import { CONFIG } from "../config.js";
import { lang } from "../i18n/index.js";

const SITE_KEY = CONFIG.turnstileSiteKey || "";
// Cloudflare가 제공하는 스크립트 (내용이 수시로 바뀌어서 SRI 지문을 걸 수 없음 — Cloudflare 공식 안내)
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// Turnstile이 쓰는 언어 이름
const TS_LANG = { ko: "ko", en: "en", ja: "ja", zh: "zh-cn" };

// 스크립트를 못 불러오거나(차단·네트워크) 확인이 끝나지 않으면 이 시간 뒤 실패로 처리 → "새로고침 후 다시" 안내.
// 시간 제한이 없으면 로그인 버튼이 영원히 기다릴 수 있음. 사람 확인 상자가 뜬 경우에는 직접 누를 시간이 필요해서 넉넉히
const LOAD_MS = 15000, SOLVE_MS = 120000;
const timeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("captcha timeout")), ms))]);

export const captchaOn = !!SITE_KEY;
let loading = null, widget = null, waiting = null;

function load() {
  if (!loading) loading = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onload = resolve; s.onerror = () => { loading = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

function box() {
  let el = document.getElementById("captchaBox");
  if (!el) { el = document.createElement("div"); el.id = "captchaBox"; document.body.appendChild(el); }
  return el;
}

/** 토큰 하나 받기 (한 번 쓰면 끝이라 요청마다 새로). 꺼져 있으면 undefined */
export async function captchaToken() {
  if (!captchaOn) return undefined;
  await timeout(load(), LOAD_MS);
  if (widget === null) {
    widget = window.turnstile.render(box(), {
      sitekey: SITE_KEY,
      execution: "execute",              // execute()를 부를 때만 확인
      appearance: "interaction-only",    // 사람 확인이 필요할 때만 보임
      language: TS_LANG[lang()] || "auto",
      callback: t => { if (waiting) { waiting.resolve(t); waiting = null; } },
      "error-callback": () => { if (waiting) { waiting.reject(new Error("captcha")); waiting = null; } },
    });
  }
  return timeout(new Promise((resolve, reject) => {
    waiting = { resolve, reject };
    window.turnstile.reset(widget);
    window.turnstile.execute(widget);
  }), SOLVE_MS).finally(() => { waiting = null; });
}
