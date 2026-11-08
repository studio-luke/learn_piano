// ===== 코드 추론하기 — 답 입력칸과 키패드 =====
// 코드 이름에 쓰는 글자만 모은 키패드예요 (사용자 결정 2026-11-08). △ - + ø 같은 기호와 alt는 넣지 않음.
//   [C D E F G A B ♯ ♭] [M m dim aug sus add] [2 4 5 6 7 9 11 13] [( ) ,]   지우기(⌫)는 입력칸 오른쪽
//
// 입력칸은 진짜 <input>이 아니라 "조각(token)"을 늘어놓은 칸이에요 (2026-11-08 사용자 결정).
//   왜: iPhone은 <input>을 한 번 누르면 커서를 단어 끝으로 보내서 중간에 커서를 둘 수 없었고, 드래그로 옮긴 커서는 알아챌 수 없었음.
//   조각 = 키패드 키 하나 (C, ♭, dim, 11 …). 컴퓨터 키보드로 친 글자도 같은 규칙으로 묶어서(d-i-m → dim)
//   버튼으로 넣었든 키보드로 쳤든 커서·⌫가 똑같이 동작해요. 커서는 조각 사이에만 놓이고, 누른 자리에서 가장 가까운 사이로 감.
//   키보드로 친 b·#은 맨 앞이 아니면 ♭·♯로 바꿔 보여줌 (맨 앞의 소문자 b는 그대로 → "근음은 대문자로" 안내가 나오게)
//
// 선택 (2026-11-08 사용자 요청): 조각 단위로 고름
//   마우스: 누른 채 끌면 그 사이를 고름
//   터치: 0.45초 꾹 누르면 손가락 아래 조각을 고르고, 떼지 않고 끌면 넓어짐 (짧게 누르면 지금처럼 커서만 옮김)
//   고른 부분이 있으면 키패드·키보드 글자·붙여넣기는 그 부분을 바꾸고, ⌫·Delete는 그 부분을 지움
//   입력칸 위에서는 손가락으로 끌어도 페이지가 스크롤되지 않음 (끄는 동작을 선택으로 써서 — naming.css touch-action)
//   컴퓨터: ⌘A/Ctrl+A로 입력칸 전체 선택(입력칸이 비어 있으면 브라우저 기본 동작), ⌘C/Ctrl+C로 고른 부분 복사,
//           ⌘X/Ctrl+X로 고른 부분 잘라내기 (2026-11-08)
//           되돌리기 ⌘Z/Ctrl+Z, 다시 실행 ⌘⇧Z/Ctrl+Shift+Z/Ctrl+Y — 키 한 번(조각 넣기·지우기, 잘라내기, 붙여넣기)이 한 단계,
//           최근 50단계, 새 문제가 나오면 비움. 맥의 ⌘Y는 브라우저 "방문 기록" 단축키라 건드리지 않음 (사용자 결정 2026-11-08)
//   폰은 시스템 복사·붙여넣기 메뉴가 뜨지 않음 — 키패드로만 입력 (사용자 결정)
//   우클릭: 메뉴(잘라내기·복사·삭제·모두 선택 ─ 실행 취소·다시 실행 — naming/answer-menu.js). 고른 부분 위면 선택을 그대로 두고,
//           그 밖이면 커서를 그리로 옮긴 뒤 열어 잘라내기·복사·삭제는 비활성
//   폰(터치)의 같은 메뉴 (2026-11-08 사용자 결정): 고른 부분을 한 번 더 터치하거나, 커서가 있는 자리를 한 번 더 터치하면
//           입력칸 위쪽에 열림(단축키 표시 없음). 메뉴가 열린 채 입력칸을 터치하면 닫힘. 꾹 눌러 고른 뒤에는 메뉴를 띄우지 않음
import { $, esc } from "../common/dom.js";
import { openAnswerMenu, closeAnswerMenu, menuOpen } from "./answer-menu.js";

const ROWS = [
  ["C", "D", "E", "F", "G", "A", "B", "♯", "♭"],
  ["M", "m", "dim", "aug", "sus", "add"],
  ["2", "4", "5", "6", "7", "9", "11", "13"],
  ["(", ")", ","],
];
// 글자를 조각으로 나누는 규칙: 여러 글자 조각을 먼저(대소문자 무관), 나머지는 한 글자씩
const TOKEN = /dim|aug|sus|add|maj|min|alt|11|13|[\s\S]/giu;
const split = s => s.match(TOKEN) || [];
const LONG_PRESS_MS = 450;   // 터치로 꾹 누르는 시간
const MOVE_PX = 8;           // 꾹 누르기 전에 이만큼 움직이면 누르기 취소
const PASTE_MAX = 20;        // 붙여넣기는 앞의 20자까지
const HISTORY_MAX = 50;      // 되돌리기 기록 개수

let tokens = [];   // 지금 입력한 조각들
let caret = 0;     // 커서: 몇 번째 조각 앞인지 (0 = 맨 앞, tokens.length = 맨 끝)
let anchor = null; // 선택을 시작한 자리 (null = 고른 것 없음). 고른 범위는 anchor와 caret 사이
let enabled = true;
let onInput = () => {};
let undoStack = [], redoStack = [];   // 되돌리기·다시 실행 기록: 바꾸기 전의 { tokens, caret, anchor }

const snap = () => ({ tokens: tokens.slice(), caret, anchor });
// 글자가 바뀌었으면 바꾸기 전 상태를 되돌리기 기록에 남기고, 다시 실행 기록은 비움
function commit(before) {
  if (before.tokens.join("\u0000") === tokens.join("\u0000")) return;
  undoStack.push(before);
  if (undoStack.length > HISTORY_MAX) undoStack.shift();
  redoStack = [];
}
function restore(st) { tokens = st.tokens.slice(); caret = st.caret; anchor = st.anchor; }

const hasSel = () => anchor !== null && anchor !== caret;
const selRange = () => [Math.min(anchor, caret), Math.max(anchor, caret)];

/** 지금 입력한 글자 전체 */
export const answerText = () => tokens.join("");
/** 커서가 맨 끝에 있고 고른 것이 없는지 (→ 키: 그렇다면 다음 문제, 아니면 커서 이동) */
export const caretAtEnd = () => caret === tokens.length && !hasSel();

/**
 * 입력칸·키패드 만들기.
 * @param changed  입력한 글자가 바뀔 때마다 부를 함수
 */
export function initKeypad(changed) {
  onInput = changed;
  const pad = $("keypad");
  pad.innerHTML = ROWS.map((row, i) =>
    `<div class="pad-row r${i}">${row.map(k => `<button class="pad-key" type="button" data-k="${k}">${k}</button>`).join("")}</div>`).join("");
  // 키를 눌러도 초점을 가져가지 않게 (컴퓨터에서 Enter가 마지막에 누른 키를 다시 누르지 않게)
  pad.addEventListener("pointerdown", e => { if (e.target.closest(".pad-key")) e.preventDefault(); });
  pad.addEventListener("click", e => { const b = e.target.closest(".pad-key"); if (b && !b.disabled) type(b.dataset.k); });
  $("padBack").addEventListener("pointerdown", e => e.preventDefault());
  $("padBack").onclick = backspace;
  wirePointer($("answer"));
  // 붙여넣기 (컴퓨터 ⌘V / Ctrl+V): 다른 진짜 입력칸(로그인 창 등)에 붙여넣을 때는 건드리지 않음
  document.addEventListener("paste", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || !enabled || document.querySelector("dialog[open]")) return;
    const text = e.clipboardData && e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    paste(text);
  });
  // 입력칸 밖을 누르면 선택이 풀림 (글자는 그대로). 키패드의 각 키·⌫·메뉴는 고른 부분을 바꾸고 지우는 데 쓰니 그대로 둠.
  // 키 사이 빈 곳(키패드 영역이지만 키가 아닌 곳)을 누르면 풀림 (2026-11-08 사용자 요청: 안 풀리면 버그처럼 보임)
  document.addEventListener("pointerdown", e => {
    if (!hasSel() || e.target.closest("#answer, .pad-key, #padBack, .ctx-menu")) return;
    anchor = null;
    render();
  });
  // 복사 (컴퓨터 ⌘C / Ctrl+C): 입력칸에 고른 부분이 있을 때만 그 글자를 복사. 없으면 브라우저 기본 동작(페이지에서 고른 글)
  document.addEventListener("copy", e => {
    if (!hasSel() || !e.clipboardData) return;
    const [s, en] = selRange();
    e.clipboardData.setData("text/plain", tokens.slice(s, en).join(""));
    e.preventDefault();
  });
  // 잘라내기 (⌘X / Ctrl+X): 복사한 뒤 고른 부분을 지움. 고른 게 없으면 브라우저 기본 동작
  document.addEventListener("cut", e => {
    if (!enabled || !hasSel() || !e.clipboardData) return;
    const [s, en] = selRange();
    e.clipboardData.setData("text/plain", tokens.slice(s, en).join(""));
    e.preventDefault();
    const before = snap();
    dropSelection();
    commit(before);
    render(); onInput();
  });
  render();
}

/** 입력칸 전체 선택 (⌘A). 입력칸이 비어 있으면 false → 브라우저 기본 동작에 맡김 */
export function selectAll() {
  if (!enabled || !tokens.length) return false;
  anchor = 0; caret = tokens.length;
  render();
  return true;
}

// 그 x 위치가 고른 조각의 글자 위인지 (메뉴를 띄울지). 글자 밖 빈 곳은 아님 → 그곳을 누르면 선택이 풀리고 커서가 가까운 끝으로
// (2026-11-08: 모두 선택 뒤 입력칸 어디를 눌러도 메뉴만 떠서 선택을 풀 수 없었음)
function onSelection(x) {
  if (!hasSel()) return false;
  const [s, e] = selRange();
  const spans = [...$("answer").querySelectorAll(".tok")];
  return spans.slice(s, e).some(sp => { const r = sp.getBoundingClientRect(); return x >= r.left && x <= r.right; });
}
// 고른 글자를 클립보드로: 표준 방식(navigator.clipboard — https·localhost에서만 됨), 안 되면 copy 명령(위 copy 이벤트가 넣음)
function copySelection() {
  if (!hasSel()) return;
  const [s, e] = selRange(), text = tokens.slice(s, e).join("");
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(() => document.execCommand("copy"));
  else document.execCommand("copy");
}
// 잘라내기: 복사한 뒤 고른 부분을 지움 (되돌리기 한 단계)
function cutSelection() {
  if (!hasSel()) return;
  copySelection();
  const before = snap();
  dropSelection();
  commit(before);
  render(); onInput();
}
// 메뉴에 넘길 동작과, 지금 할 수 있는지
function menuActions() {
  const sel = hasSel();
  return {
    cut: cutSelection, copy: copySelection, delete: deleteForward, selectAll, undo, redo,
    can: { cut: sel, copy: sel, delete: sel, selectAll: tokens.length > 0, undo: undoStack.length > 0, redo: redoStack.length > 0 },
  };
}
// 폰 메뉴: 입력칸 위쪽에 (손가락에 가리지 않게)
const openTouchMenu = x => openAnswerMenu(x, 0, menuActions(), { touch: true, anchor: $("answer").getBoundingClientRect() });

// 누른 x 위치 → 커서 자리(가장 가까운 조각 사이) / 조각 번호(그 조각 위, 없으면 -1)
function posAt(x) {
  const spans = [...$("answer").querySelectorAll(".tok")];
  for (let i = 0; i < spans.length; i++) {
    const r = spans[i].getBoundingClientRect();
    if (x < r.left + r.width / 2) return i;
  }
  return tokens.length;
}
function tokAt(x) {
  const spans = [...$("answer").querySelectorAll(".tok")];
  if (!spans.length) return -1;
  for (let i = 0; i < spans.length; i++) if (x < spans[i].getBoundingClientRect().right) return i;
  return spans.length - 1;
}

// 마우스: 누르면 커서, 끌면 선택. 터치: 짧게 누르면 커서, 꾹 누르면 조각 선택 → 끌면 넓힘
function wirePointer(el) {
  let drag = null;   // { id, touch, x0, y0, timer, selecting, tok }
  el.addEventListener("pointerdown", e => {
    if (!enabled) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* 지원하지 않는 브라우저 */ }
    const touch = e.pointerType !== "mouse";
    const wasOpen = menuOpen();
    if (wasOpen && !touch) closeAnswerMenu();   // 마우스로 입력칸을 누르면 메뉴는 닫힘 (터치는 손을 뗄 때 판단)
    // 마우스 오른쪽 버튼: 고른 부분 위면 그대로 두고, 아니면 커서를 그리로 옮김 (끌기 없음). 메뉴는 contextmenu에서
    if (!touch && e.button === 2) {
      if (!onSelection(e.clientX)) { caret = posAt(e.clientX); anchor = null; render(); }
      return;
    }
    drag = { id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, selecting: !touch, tok: -1, timer: null, wasOpen };
    if (!touch) { anchor = caret = posAt(e.clientX); render(); return; }
    drag.timer = setTimeout(() => {   // 꾹 누름: 손가락 아래 조각을 고름
      const i = tokAt(drag.x0);
      if (i < 0) return;
      drag.selecting = true; drag.tok = i;
      anchor = i; caret = i + 1;
      closeAnswerMenu();
      render();
    }, LONG_PRESS_MS);
  });
  el.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.touch && !drag.selecting) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > MOVE_PX) { clearTimeout(drag.timer); drag.timer = null; }
      return;
    }
    const p = posAt(e.clientX);
    if (drag.tok >= 0) {   // 터치 선택은 처음 고른 조각을 늘 포함
      if (p <= drag.tok) { anchor = drag.tok + 1; caret = p; } else { anchor = drag.tok; caret = Math.max(p, drag.tok + 1); }
    } else caret = p;
    render();
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(drag.timer);
    // 터치를 짧게 누르고 뗌:
    //   메뉴가 열려 있었으면 닫기만 / 고른 부분 위면 메뉴 / 커서가 있는 자리면 메뉴(고른 것 없이) / 그 밖이면 커서를 옮김(고른 것은 풀림)
    if (drag.touch && !drag.selecting && e.type === "pointerup") {
      const p = posAt(e.clientX);
      if (drag.wasOpen) closeAnswerMenu();
      else if (onSelection(e.clientX)) { drag = null; return openTouchMenu(e.clientX); }
      else if (!hasSel() && p === caret) { drag = null; return openTouchMenu(e.clientX); }
      else { caret = p; anchor = null; }
    }
    if (!hasSel()) anchor = null;
    drag = null;
    render();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  // 브라우저 메뉴는 늘 막음 (터치로 꾹 누를 때도). 마우스로 고른 부분 위를 우클릭하면 우리 메뉴
  el.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (!enabled || (drag && drag.touch) || e.pointerType === "touch") return;
    openAnswerMenu(e.clientX, e.clientY, menuActions());
  });
}

// 입력칸 다시 그리기: 조각마다 <span>, 고른 조각은 강조, 커서 자리에 깜빡이는 막대(고른 것이 있으면 막대 없음)
function render() {
  const el = $("answer");
  const [s, e] = hasSel() ? selRange() : [-1, -1];
  let html = "";
  tokens.forEach((t, i) => {
    if (i === caret && !hasSel()) html += `<span class="caret" aria-hidden="true"></span>`;
    html += `<span class="tok${/[♯♭]/.test(t) ? " acc" : ""}${i >= s && i < e ? " picked" : ""}">${esc(t)}</span>`;
  });
  if (caret === tokens.length && !hasSel()) html += `<span class="caret" aria-hidden="true"></span>`;
  el.innerHTML = html;
  el.setAttribute("aria-valuetext", answerText());
  el.classList.toggle("empty", !tokens.length);
  // (커서 막대를 매번 새로 만들어서, 누른 직후에는 깜빡임이 처음부터 시작해 바로 보임)
}

// 고른 부분을 지우고 커서를 그 자리에. 지웠으면 true (고른 것이 없으면 선택 표시만 풀고 false)
function dropSelection() {
  if (!hasSel()) { anchor = null; return false; }
  const [s, e] = selRange();
  tokens.splice(s, e - s);
  caret = s; anchor = null;
  return true;
}

// 커서 자리에 글자 하나 넣기 (화면은 그리지 않음)
function insert(k) {
  const left = tokens.slice(0, caret).join("");
  if (left !== "") k = k === "b" ? "♭" : k === "#" ? "♯" : k;
  const newLeft = split(left + k);   // 앞 조각과 합쳐질 수 있음 (d-i-m → dim, 1-1 → 11)
  tokens = newLeft.concat(tokens.slice(caret));
  caret = newLeft.length;
}

/** 커서 자리에 글자 넣기 (키패드 키 하나 또는 키보드로 친 글자 하나). 고른 부분이 있으면 그 부분을 바꿈 */
export function type(k) {
  if (!enabled) return;
  const before = snap();
  dropSelection();
  insert(k);
  commit(before);
  render(); onInput();
}

/** 붙여넣기: 공백·줄바꿈은 빼고 앞의 20자까지, 키보드로 칠 때와 같은 규칙으로. 고른 부분이 있으면 바꿈 */
export function paste(text) {
  if (!enabled) return;
  const chars = [...String(text).replace(/\s+/g, "")].slice(0, PASTE_MAX);
  if (!chars.length) return;
  const before = snap();
  dropSelection();
  for (const ch of chars) insert(ch);
  commit(before);
  render(); onInput();
}

/** ⌫: 고른 부분, 없으면 커서 바로 앞의 조각 하나 지우기 */
export function backspace() {
  if (!enabled) return;
  const before = snap();
  if (!dropSelection()) {
    if (caret === 0) return render();
    tokens.splice(caret - 1, 1);
    caret--;
  }
  commit(before);
  render(); onInput();
}

/** Delete: 고른 부분, 없으면 커서 바로 뒤의 조각 하나 지우기 */
export function deleteForward() {
  if (!enabled) return;
  const before = snap();
  if (!dropSelection()) {
    if (caret >= tokens.length) return render();
    tokens.splice(caret, 1);
  }
  commit(before);
  render(); onInput();
}

/** 커서를 조각 하나만큼 옮기기 (컴퓨터의 ← →). 고른 부분이 있으면 그 끝으로 모음 */
export function moveCaret(d) {
  if (hasSel()) { const [s, e] = selRange(); caret = d < 0 ? s : e; }
  else caret = Math.max(0, Math.min(tokens.length, caret + d));
  anchor = null;
  render();
}

/** Shift+← → : 커서를 조각 하나만큼 옮기며 선택을 넓히거나 줄임 (2026-11-08) */
export function extendCaret(d) {
  if (anchor === null) anchor = caret;
  caret = Math.max(0, Math.min(tokens.length, caret + d));
  if (anchor === caret) anchor = null;
  render();
}

/** 커서를 맨 앞(Home) / 맨 끝(End)으로 */
export function caretTo(end) {
  caret = end ? tokens.length : 0; anchor = null;
  render();
}

/** 되돌리기 (⌘Z). 되돌릴 게 없으면 false → 브라우저 기본 동작에 맡김 */
export function undo() {
  if (!enabled || !undoStack.length) return false;
  redoStack.push(snap());
  restore(undoStack.pop());
  render(); onInput();
  return true;
}
/** 다시 실행 (⌘⇧Z, Ctrl+Y). 다시 할 게 없으면 false */
export function redo() {
  if (!enabled || !redoStack.length) return false;
  undoStack.push(snap());
  restore(redoStack.pop());
  render(); onInput();
  return true;
}

/** 입력칸 비우기 (새 문제) — 되돌리기 기록도 비움 */
export function clearAnswer() {
  tokens = []; caret = 0; anchor = null;
  undoStack = []; redoStack = [];
  render();
}

/** 입력칸·키패드 켜기/끄기 (문제를 낼 수 없을 때 끔) */
export function setPadEnabled(on) {
  enabled = on;
  $("answer").classList.toggle("disabled", !on);
  $("answer").setAttribute("aria-disabled", String(!on));
  $("padBack").disabled = !on;
  $("keypad").querySelectorAll(".pad-key").forEach(b => { b.disabled = !on; });
}
