// ===== 화면(DOM) 작은 도구들 =====

/** id로 요소 찾기: $("btnCheck") */
export const $ = id => document.getElementById(id);

/** HTML에 끼워 넣을 글자를 안전하게 바꿈 (<, >, & 등).
 *  닉네임·성명·코드 이름처럼 사용자나 DB에서 온 글자는 innerHTML에 넣기 전에 반드시 esc()를 거칠 것 — 안 그러면
 *  학생이 닉네임에 스크립트를 넣어 선생님 화면에서 실행시킬 수 있어요(XSS). */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 코드 이름을 HTML로: 끝의 괄호(텐션·♭5 등)를 살짝 작게 위로 올린 윗첨자로 ("C7(♭9,13)" → C7<sup>(♭9,13)</sup>).
 *  esc()를 먼저 거치므로 DB에서 온 코드 이름에 그대로 써도 안전. 모양은 base.css의 .ch-ten (2026-11-07 사용자 요청) */
export const chordHTML = s => esc(s).replace(/\(([^()]*)\)$/, '<sup class="ch-ten">($1)</sup>');

let toastTimer, toastFade;
const SWIPE_CLOSE_PX = 30;   // 아래로 이만큼 밀고 놓으면 닫힘

/** 알림을 제자리에서 흐려지게 하며 닫기 (시간이 다 됐을 때·아래로 밀었을 때 같은 모양) */
function fadeToast(el) {
  clearTimeout(toastTimer); clearTimeout(toastFade);
  el.classList.add("out");
  toastFade = setTimeout(() => { el.hidden = true; el.classList.remove("out"); }, TOAST_FADE_MS);
}

// 알림을 손가락으로 아래로 30px 이상 밀고 놓으면 바로 제자리에서 흐려지며 닫힘 (2026-11-08 사용자 요청, 폰).
// 알림은 손가락을 따라 움직이지 않음(사용자 결정). 마우스로 끌어도 같음
function swipeToClose(el) {
  let y0 = null;
  el.addEventListener("pointerdown", e => { y0 = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointerup", e => {
    if (y0 !== null && e.clientY - y0 >= SWIPE_CLOSE_PX) fadeToast(el);
    y0 = null;
  });
  el.addEventListener("pointercancel", () => { y0 = null; });
}
const TOAST_FADE_MS = 400;   // 사라질 때 흐려지는 시간 (base.css .toast의 transition과 같게)
/**
 * 화면 아래에 잠깐 뜨는 알림. 페이지에 <div class="toast" id="toast">가 없으면 만들어 붙임
 * @param ms  보여 주는 시간 (그 뒤 0.4초 동안 흐려지며 사라짐 — 2026-11-08 사용자 요청)
 */
export function toast(text, ms = 3200) {
  let el = $("toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast"; el.id = "toast"; el.setAttribute("role", "status");
    document.body.appendChild(el);
    swipeToClose(el);
  }
  // 열린 창(로그인 창·내 계정 사이드바 등 <dialog>)이 있으면 그 안에 띄움 — 밖에 두면 창에 가려서 안 보임 (2026-11-10)
  const host = document.querySelector("dialog[open]") || document.body;
  if (el.parentElement !== host) host.appendChild(el);
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("out");   // 흐려지던 중에 다시 뜨면 바로 또렷하게
  clearTimeout(toastTimer); clearTimeout(toastFade);
  toastTimer = setTimeout(() => fadeToast(el), ms);
}
