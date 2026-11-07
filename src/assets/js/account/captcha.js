// ===== 자동 가입·로그인 방지 (Cloudflare Turnstile) =====
// config.js의 turnstileSiteKey가 있을 때만 켜져요. 비어 있으면 아무것도 안 하고 토큰 없이 진행.
// 로그인·회원가입·인증 메일 다시 보내기·비밀번호 재설정 메일·비밀번호 확인(변경·탈퇴) 때 토큰을 하나씩 꺼내
// Supabase에 함께 보내요(account.js). Supabase(Attack Protection)에서 켜 두면 토큰 없는 요청은 거부돼요.
//
// 동작 (Turnstile 공식 기본 방식): 로그인 창을 열 때(prepareCaptcha) 확인 상자를 만들면 Turnstile이 바로 확인을 시작해
// 토큰을 준비해 둬요. 버튼을 누르면 준비된 토큰을 꺼내 쓰고(captchaToken), 토큰은 한 번만 쓸 수 있어서 곧바로 다음 것을 준비해요.
// 보통 사람은 아무것도 보이지 않고, 의심스러울 때만 로그인 창 안(#captchaBox)에 체크 상자가 나타나요.
// (2026-11-07: 처음엔 버튼을 누를 때 확인을 시작했는데, 만든 직후 reset을 불러 확인이 취소되며 계속 실패했음 → 이 방식으로 바꿈)
import { CONFIG } from "../config.js";
import { lang } from "../i18n/index.js";

const SITE_KEY = CONFIG.turnstileSiteKey || "";
// Cloudflare가 제공하는 스크립트 (내용이 수시로 바뀌어서 SRI 지문을 걸 수 없음 — Cloudflare 공식 안내)
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// Turnstile이 쓰는 언어 이름
const TS_LANG = { ko: "ko", en: "en", ja: "ja", zh: "zh-cn" };
// 스크립트를 못 불러오거나(차단·네트워크) 토큰이 오지 않으면 이 시간 뒤 실패로 처리 → "새로고침 후 다시" 안내.
// 시간 제한이 없으면 로그인 버튼이 영원히 기다릴 수 있음. 체크 상자가 뜬 경우 직접 누를 시간이 필요해서 넉넉히
const LOAD_MS = 15000, TOKEN_MS = 60000;
const timeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("captcha timeout")), ms))]);

export const captchaOn = !!SITE_KEY;
let loading = null, widget = null;
let token = null;        // 준비된 토큰 (한 번 쓰면 null)
let waiters = [];        // 토큰을 기다리는 요청들
let failed = false;      // 마지막 확인이 오류로 끝났는지 (그 뒤에 누르면 다시 시도부터)

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

function settle(t, err) {
  const list = waiters; waiters = [];
  list.forEach(w => (err ? w.reject(err) : w.resolve(t)));
}

/** 로그인 창을 열 때 부름: 확인 상자를 한 번 만들어 토큰을 미리 준비 (꺼져 있으면 아무것도 안 함) */
export async function prepareCaptcha() {
  if (!captchaOn || widget !== null) return;
  try { await timeout(load(), LOAD_MS); } catch (e) { console.warn("Turnstile 스크립트를 불러오지 못했어요", e); return; }
  if (widget !== null) return;
  widget = window.turnstile.render(box(), {
    sitekey: SITE_KEY,
    appearance: "interaction-only",      // 사람 확인이 필요할 때만 보임
    language: TS_LANG[lang()] || "auto",
    "refresh-expired": "auto",           // 토큰이 만료되면(약 5분) 알아서 새로 받음
    callback: t => { failed = false; token = t; if (waiters.length) { token = null; settle(t); reset(); } },
    "expired-callback": () => { token = null; },
    // 오류 코드는 Cloudflare 문서(Turnstile → Error codes)에서 확인. 예: 110200 = 허용 주소(Hostname)가 아님
    "error-callback": code => { console.warn("Turnstile 오류", code); failed = true; token = null; settle(null, new Error("captcha " + code)); return false; },
  });
}

// 쓴 토큰은 다시 못 쓰므로 다음 요청용으로 새로 받기
function reset() { if (widget !== null && window.turnstile) window.turnstile.reset(widget); }

/** 토큰 하나 꺼내기. 준비돼 있으면 바로, 아니면 올 때까지 기다림. 꺼져 있으면 undefined */
export async function captchaToken() {
  if (!captchaOn) return undefined;
  await prepareCaptcha();
  if (widget === null) throw new Error("captcha unavailable");
  if (token) { const t = token; token = null; reset(); return t; }
  // 창을 열 때 확인이 이미 실패했으면, 기다리지 말고 지금 다시 시도 (또 실패하면 바로 오류가 와서 안내가 뜸)
  if (failed) { failed = false; reset(); }
  return timeout(new Promise((resolve, reject) => waiters.push({ resolve, reject })), TOKEN_MS);
}
