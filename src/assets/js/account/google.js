// ===== Google 로그인 — 구글 공식 버튼을 우리 사이트에서 직접 띄우기 (Google Identity Services) =====
// 왜: 예전 방식(signInWithOAuth)은 구글 → Supabase 서버 → 우리 사이트로 돌아와서, 구글 동의 화면에
//     "joxtek….supabase.co 서비스로 로그인"이 보였어요. 이 방식은 구글 팝업이 우리 사이트(chordoven.com) 위에서 열리고,
//     받은 증표(ID 토큰)를 Supabase에 넘겨 로그인해요(signInWithIdToken) → 동의 화면에 chordoven.com이 보임. (2026-11-07 사용자 결정)
//
// config.js의 googleClientId(공개용 클라이언트 ID)가 있을 때만 켜져요. 없거나, 구글 스크립트를 못 불러오면(네트워크 차단 등)
// 화면에 있는 예전 방식 버튼이 그대로 남아서 로그인은 계속 돼요.
// 버튼 모양은 구글이 정해요(구글 정책상 이 방식은 구글이 그린 버튼만 쓸 수 있음).
import { CONFIG } from "../config.js";

const CLIENT_ID = CONFIG.googleClientId || "";
const SCRIPT = "https://accounts.google.com/gsi/client";
// 이 시간 안에 구글 버튼을 못 그리면 로딩 아이콘을 멈추고 예전 방식 버튼을 보여줌.
// (2026-11-07: 폰에서 로딩 아이콘이 끝없이 도는 일이 있었음 — 10초는 사람에게는 "멈춘 화면"이라 4초로 줄이고,
//  스크립트를 받은 뒤 단계에서 오류·멈춤이 나도 반드시 예전 방식 버튼으로 넘어가게 함)
const LOAD_MS = 4000;
// 구글 버튼의 언어 이름
const GSI_LOCALE = { ko: "ko", en: "en", ja: "ja", zh: "zh_CN" };

export const googleOn = !!CLIENT_ID;
let loading = null;
let rawNonce = "";   // 이번 로그인용 일회용 값. 구글에는 해시를 주고, Supabase에는 원래 값을 줘서 같은 요청인지 확인

function load() {
  if (!loading) loading = Promise.race([
    new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      const s = document.createElement("script");
      s.src = SCRIPT; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("gsi"));
      document.head.appendChild(s);
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("gsi timeout")), LOAD_MS)),
  ]).catch(e => { loading = null; throw e; });
  return loading;
}

/**
 * 구글 스크립트를 미리 불러 둠 (로그인하지 않은 방문자, 페이지가 한가할 때 — auth-dialog.js).
 * 로그인 창을 열 때 스크립트를 받기 시작하면 버튼이 늦게 나와서, 미리 받아 두면 창을 열자마자 구글 버튼이 보임
 */
export function preloadGoogle() {
  if (googleOn) load().catch(() => {});
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 구글 버튼을 slots(각 .gsi-slot 요소)에 그림. 성공하면 각 슬롯의 예전 방식 버튼을 숨김.
 * onCredential(idToken, nonce)는 사용자가 구글 계정을 고르면 불림 → Account.signInWithGoogleToken으로 로그인
 * 로그인 창을 열 때마다·언어를 바꿀 때마다 다시 불러도 됨 (일회용 값도 새로 만듦)
 */
export async function renderGoogle(slots, locale, onCredential) {
  if (!googleOn || !slots.length) return;
  const fail = (why, e) => {
    console.warn(`구글 로그인 버튼을 그리지 못했어요(${why}) — 예전 방식 버튼을 씀`, e || "");
    slots.forEach(slot => { if (!slot.classList.contains("gsi-ready")) slot.classList.add("gsi-failed"); });   // CSS가 로딩 아이콘 대신 예전 방식 버튼을 보여줌
  };
  // 지난번에 실패했어도 그사이 구글 스크립트가 도착했으면 이번엔 구글 버튼으로 다시 시도 (아니면 예전 방식 버튼을 그대로 둠)
  if (window.google && window.google.accounts && window.google.accounts.id) slots.forEach(slot => slot.classList.remove("gsi-failed"));
  // 마지막 안전장치: 어느 단계에서 멈추든(스크립트·암호 계산·구글 함수) 이 시간이 지나면 예전 방식 버튼으로
  const guard = setTimeout(() => fail("시간 초과"), LOAD_MS + 1000);
  try {
    await load();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    rawNonce = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
    const nonce = rawNonce;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      nonce: await sha256Hex(nonce),
      callback: r => onCredential(r.credential, nonce),
      auto_select: false,
      itp_support: true,
    });
    slots.forEach(slot => {
      if (slot.classList.contains("gsi-failed")) return;   // 이미 시간 초과로 예전 방식 버튼이 보이면 바꾸지 않음 (보던 버튼이 갑자기 바뀌지 않게)
      const target = slot.querySelector(".gsi-target");
      const width = Math.min(400, Math.max(200, Math.round(slot.clientWidth || 320)));
      target.textContent = "";
      window.google.accounts.id.renderButton(target, {
        type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular",
        logo_alignment: "center", width, locale: GSI_LOCALE[locale] || "en",
      });
      slot.classList.add("gsi-ready");   // 구글은 처음부터 요청한 폭으로 그려서 바로 보여줌 (CSS가 로딩 아이콘을 숨김)
    });
  } catch (e) {
    fail("오류", e);
  } finally {
    clearTimeout(guard);
  }
}
