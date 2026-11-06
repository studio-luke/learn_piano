// ===== 화면(DOM) 작은 도구들 =====

/** id로 요소 찾기: $("btnCheck") */
export const $ = id => document.getElementById(id);

/** HTML에 끼워 넣을 글자를 안전하게 바꿈 (<, >, & 등).
 *  닉네임·성명·코드 이름처럼 사용자나 DB에서 온 글자는 innerHTML에 넣기 전에 반드시 esc()를 거칠 것 — 안 그러면
 *  학생이 닉네임에 스크립트를 넣어 선생님 화면에서 실행시킬 수 있어요(XSS). */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let toastTimer;
/** 화면 아래에 잠깐 뜨는 알림. 페이지에 <div class="toast" id="toast">가 없으면 만들어 붙임 */
export function toast(text) {
  let el = $("toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast"; el.id = "toast"; el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}
