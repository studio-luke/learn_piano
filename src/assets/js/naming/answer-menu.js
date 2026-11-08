// ===== 코드 추론하기 — 답 입력칸의 우클릭 메뉴 (컴퓨터) =====
// 입력칸을 우클릭하면 뜨는 작은 메뉴예요 (사용자 결정 2026-11-08).
//   잘라내기 · 복사 · 삭제 · 모두 선택 ─ 실행 취소 · 다시 실행  (붙여넣기는 넣지 않음: 메뉴에서 붙여넣으려면 브라우저 권한 창이 떠서)
// 고른 부분 위: 모두 쓸 수 있음. 고른 부분 밖: 커서를 그리로 옮긴 뒤 열고, 잘라내기·복사·삭제는 비활성 (naming/keypad.js)
// 할 수 없는 항목(되돌릴 게 없음, 빈 칸에서 모두 선택)도 비활성.
// 폰: 고른 부분이나 커서 자리를 한 번 더 터치하면 같은 메뉴가 입력칸 위쪽에 (단축키 표시 없이, 누르기 쉽게 크게)
// 입력칸이 <input>이 아니라서 브라우저 기본 메뉴를 쓸 수 없어 직접 그려요.
import { t } from "../i18n/index.js";
import { esc } from "../common/dom.js";

const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
// 메뉴 항목: [동작, 문구 키, 맥 단축키, 윈도우 단축키] — null은 구분선
const ITEMS = [
  ["cut", "ctxCut", "⌘X", "Ctrl+X"],
  ["copy", "ctxCopy", "⌘C", "Ctrl+C"],
  ["delete", "ctxDelete", "⌫", "Del"],
  ["selectAll", "ctxSelectAll", "⌘A", "Ctrl+A"],
  null,
  ["undo", "ctxUndo", "⌘Z", "Ctrl+Z"],
  ["redo", "ctxRedo", "⇧⌘Z", "Ctrl+Y"],
];

let menu = null;
const close = () => { if (menu) { menu.remove(); menu = null; } };

/**
 * 메뉴 열기.
 * @param x, y     화면 좌표 (우클릭한 곳 — 폰은 x만 씀)
 * @param actions  { cut, copy, delete, selectAll, undo, redo: 할 일 } + { can: { 동작: 지금 할 수 있는지 } }
 * @param opt      폰: { touch: true, anchor: 입력칸의 화면 위치 } → 입력칸 위쪽에, 단축키 없이
 */
export function openAnswerMenu(x, y, actions, opt = {}) {
  close();
  menu = document.createElement("div");
  menu.className = "ctx-menu" + (opt.touch ? " touch" : "");
  menu.setAttribute("role", "menu");
  menu.innerHTML = ITEMS.map(it => {
    if (!it) return `<hr class="ctx-sep">`;
    const [act, key, mac, win] = it;
    const off = !actions.can[act];
    const kbd = opt.touch ? "" : `<kbd>${MAC ? mac : win}</kbd>`;
    return `<button type="button" role="menuitem" data-act="${act}"${off ? " disabled" : ""}><span>${esc(t(key))}</span>${kbd}</button>`;
  }).join("");
  document.body.appendChild(menu);
  // 화면 밖으로 나가지 않게 자리 맞춤
  const r = menu.getBoundingClientRect();
  if (opt.anchor) {   // 폰: 입력칸 바로 위 가운데(누른 곳 근처), 위에 자리가 없으면 아래
    x -= r.width / 2;
    y = opt.anchor.top - r.height - 8;
    if (y < 8) y = opt.anchor.bottom + 8;
  }
  menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
  menu.tabIndex = -1;
  menu.addEventListener("pointerdown", e => e.preventDefault());   // 누를 때 입력칸 선택이 풀리지 않게
  // 마우스를 올린 항목으로 초점을 옮겨, 강조가 하나만 보이게 (2026-11-08: 첫 항목 강조가 남아 두 개가 강조됐음).
  // 비활성 항목 위에서는 메뉴 자체로 초점을 옮겨 강조를 지움
  menu.addEventListener("pointerover", e => {
    const b = e.target.closest("button");
    if (b && !b.disabled) b.focus({ preventScroll: true }); else menu.focus({ preventScroll: true });
  });
  menu.addEventListener("click", e => {
    const b = e.target.closest("button[data-act]");
    if (!b || b.disabled) return;
    close();
    actions[b.dataset.act]();
  });
  if (opt.touch) menu.focus({ preventScroll: true });   // 폰은 강조 없이 시작 (누를 항목을 손가락으로 고름)
  else (menu.querySelector("button:not([disabled])") || menu).focus({ preventScroll: true });
}

// 메뉴 밖을 누르거나, Esc, 스크롤·창 크기 바뀜 → 닫기. 단 입력칸을 누른 건 입력칸이 판단(폰에서 한 번 더 터치 = 닫기)
document.addEventListener("pointerdown", e => { if (menu && !menu.contains(e.target) && !e.target.closest("#answer")) close(); }, true);
document.addEventListener("keydown", e => { if (menu && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
addEventListener("scroll", close, true);
addEventListener("resize", close);
/** 메뉴가 열려 있는지 (열려 있는 동안 입력칸 단축키를 막으려고) */
export const menuOpen = () => !!menu;
/** 메뉴 닫기 */
export const closeAnswerMenu = close;
