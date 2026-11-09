// ===== 연습 — 피아노 건반 (C3~C5, 2옥타브 / MIDI 입력 모드에서는 88건반 A0~C8) =====
// 건반을 그리고, 마우스·터치·컴퓨터 키보드 입력을 받아요. 어떤 건반이 눌렸는지는 selected(MIDI 번호 집합)에 있어요.
// MIDI 건반 입력은 pages/practice.js가 받아서 select()로 바꿔요(소리·채점 연결은 페이지가 함).
import { Engine } from "../core/engine.js";
import { t } from "../i18n/index.js";
import { $ } from "../common/dom.js";

export const LOW = 48, HIGH = 72;             // C3 ~ C5 (MIDI 번호) — 보통 건반
export const FULL_LOW = 21, FULL_HIGH = 108;  // A0 ~ C8 — MIDI 입력 모드의 88건반 (2026-11-09)
let lo = LOW, hi = HIGH;                       // 지금 그려진 범위
const WHITE_PCS = Engine.WHITE;
const NAMES = Engine.PC_NAMES;

// 컴퓨터 키보드 → 건반 (C3부터 위로): q 2 w 3 e r 5 t 6 y 7 u i 9 o 0 p [ = ] k , l . /
// (2026-11-07: 끝의 G♯4~C5를 a z s x c → k , l . /로 — 오른손 자리에 이어지게. L이 건반이 되어 정답 확인은 G로)
// 글자가 아니라 물리 키(e.code)로 맞춰서, 한글 입력 상태나 다른 자판 배열에서도 같은 자리가 같은 건반이에요.
const KEY_CHARS = "q2w3er5t6y7ui9o0p[=]k,l./".split("");
export const CODE_TO_MIDI = {};
KEY_CHARS.forEach((ch, i) => {
  const code = /[a-z]/.test(ch) ? "Key" + ch.toUpperCase() : /\d/.test(ch) ? "Digit" + ch : { "[": "BracketLeft", "]": "BracketRight", "=": "Equal", ",": "Comma", ".": "Period", "/": "Slash" }[ch];
  CODE_TO_MIDI[code] = LOW + i;
});

/** 지금 눌려 있는 건반 (MIDI 번호) */
export const selected = new Set();
const keyEls = new Map();   // MIDI 번호 → 건반 요소
let view = { q: null, answer: new Set(), good: new Set() };   // 그릴 때 필요한 문제 상태 (quiz.js가 넘겨줌)

// 검은 건반 이름: 지금 문제의 구성음이면 그 코드의 철자(겹변화표는 쉬운 이름으로),
// 아니면 코드에 ♯가 많으면 ♯, ♭가 많으면 ♭, 같거나 없으면 C♯ E♭ F♯ A♭ B♭
const COMMON = { 1: "C♯", 3: "E♭", 6: "F♯", 8: "A♭", 10: "B♭" };
export function pcLabel(pc) {
  const q = view.q;
  const white = WHITE_PCS.includes(pc);
  if (!q) return white ? NAMES[pc] : COMMON[pc];
  const tone = q.tones.find(x => x.pc === pc);
  if (tone) return /[𝄪𝄫]/.test(tone.name) ? Engine.simpleName(pc, tone.a) : tone.name;
  if (white) return NAMES[pc];
  const text = q.rootName + q.tones.map(x => x.name).join("");
  const dir = (text.match(/♯/g) || []).length - (text.match(/♭/g) || []).length;
  return dir === 0 ? COMMON[pc] : Engine.simpleName(pc, dir);
}

/**
 * 건반 만들기.
 * @param onToggle  건반이 눌리거나 떼어질 때 부를 함수 (midi, on)
 */
export function initKeyboard(onToggle) {
  const kb = $("keyboard");
  drawKeys();

  // 마우스: 누르는 순간 입력. 터치·펜: 손을 뗄 때 입력, 10px 넘게 움직였으면 스크롤로 보고 무시
  // (예전에는 화면을 스크롤하다 건반이 눌리는 문제가 있었음)
  let pending = null;
  kb.addEventListener("pointerdown", e => {
    const el = e.target.closest(".key"); if (!el) return;
    if (e.pointerType === "mouse") { e.preventDefault(); toggle(+el.dataset.midi); return; }
    pending = { id: e.pointerId, midi: +el.dataset.midi, x: e.clientX, y: e.clientY };
  });
  kb.addEventListener("pointermove", e => {
    if (pending && e.pointerId === pending.id && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 10) pending = null;
  });
  kb.addEventListener("pointerup", e => {
    if (!pending || e.pointerId !== pending.id) return;
    const p = pending; pending = null;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el && el.closest(".key");
    if (key && +key.dataset.midi === p.midi) { e.preventDefault(); toggle(p.midi); }
  });
  kb.addEventListener("pointercancel", () => { pending = null; });
  // 건반에 키보드 초점이 있을 때 Space/Enter로 누르기 (접근성)
  kb.addEventListener("keydown", e => {
    if ((e.key === " " || e.key === "Enter") && e.target.classList.contains("key")) { e.preventDefault(); e.stopPropagation(); toggle(+e.target.dataset.midi); }
  });

  function toggle(m) {
    const on = !selected.has(m);
    if (on) selected.add(m); else selected.delete(m);
    renderKeys();
    onToggle(m, on);
  }
  return { toggle };
}

/** 지금 범위(lo~hi)로 건반을 새로 그림. 흰 건반 수(--whites)에 맞춰 검은 건반 폭·위치를 계산 */
function drawKeys() {
  const kb = $("keyboard");
  kb.textContent = ""; keyEls.clear();
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (WHITE_PCS.includes(m % 12)) whites++;
  kb.style.setProperty("--whites", whites);
  let whiteIndex = 0;
  for (let m = lo; m <= hi; m++) {
    const pc = m % 12, oct = Math.floor(m / 12) - 1;
    const isWhite = WHITE_PCS.includes(pc);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "key " + (isWhite ? "white" : "black");
    el.dataset.midi = m;
    el.dataset.pc = pc;
    const label = isWhite ? NAMES[pc] + (pc === 0 ? oct : "") : NAMES[pc].split("/")[0];
    const ch = KEY_CHARS[m - LOW];   // 컴퓨터 키 (C3~C5에만 있음)
    el.innerHTML = `<span class="lbl">${label}</span>` + (ch ? `<span class="kbd-lbl">${ch.toUpperCase()}</span>` : "");
    el.setAttribute("aria-label", NAMES[pc] + oct);
    el.setAttribute("aria-pressed", "false");
    if (isWhite) whiteIndex++;
    else el.style.left = `calc(100% / ${whites} * ${whiteIndex} - 100% / ${whites} * 0.33)`;   // 검은 건반: 두 흰 건반 사이
    kb.appendChild(el);
    keyEls.set(m, el);
  }
}

/**
 * 88건반(true) / 보통 2옥타브(false)로 바꿈 — MIDI 입력 모드 (2026-11-09).
 * 보통 건반으로 돌아갈 때 C3~C5 밖에서 고른 건반은 선택에서 빠짐 (소리는 페이지가 멈춤)
 */
export function setFull(full) {
  const [a, b] = full ? [FULL_LOW, FULL_HIGH] : [LOW, HIGH];
  if (a === lo && b === hi) return;
  lo = a; hi = b;
  for (const m of [...selected]) if (m < lo || m > hi) selected.delete(m);
  const kb = $("keyboard");
  kb.classList.toggle("full", full);
  kb.setAttribute("aria-label", t(full ? "kbAriaFull" : "kbAria"));
  kb.dataset.i18nAria = full ? "kbAriaFull" : "kbAria";   // 언어를 바꿀 때도 맞는 이름으로
  drawKeys();
  setView(view);
}

/** 지금 화면 건반으로 고를 수 있는 음인지 (보통 건반이면 C3~C5, 88건반이면 전부) */
export const selectable = m => m >= lo && m <= hi;

/** MIDI 입력용: 건반 하나를 고르거나 풂 — 소리·채점 연결 없이 표시만 (페이지가 따로 처리) */
export function select(m, on) {
  if (on) selected.add(m); else selected.delete(m);
  renderKeys();
}

/** 그릴 때 쓸 문제 상태를 바꾸고(새 문제, 정답 확인 등) 검은 건반 이름을 다시 붙임 */
export function setView(v) {
  view = v;
  for (const [m, el] of keyEls) {
    const pc = m % 12;
    if (!WHITE_PCS.includes(pc)) el.querySelector(".lbl").textContent = pcLabel(pc);
  }
  renderKeys();
}

/** 건반 표시를 다시 그린 뒤 부를 함수 (quiz.js가 [다음 문제] 버튼 상태를 맞춤) */
export const keyHooks = { rendered: () => {} };

/** 눌림·정답 표시를 다시 그리고, "선택한 음" 줄을 갱신 */
export function renderKeys() {
  for (const [m, el] of keyEls) {
    el.classList.toggle("sel", selected.has(m));
    el.classList.toggle("ans", view.answer.has(m));
    el.classList.toggle("good", view.good.has(m) && selected.has(m));
    el.setAttribute("aria-pressed", String(selected.has(m)));
  }
  $("selNotes").textContent = selected.size ? [...selected].sort((a, b) => a - b).map(m => pcLabel(m % 12)).join(" · ") : t("none");
  keyHooks.rendered();
}

/** 건반 위 글자 표시 (음이름, 컴퓨터 키) */
export function setKeyLabels(showNames, showKeys) {
  $("keyboard").classList.toggle("nolabels", !showNames);
  $("keyboard").classList.toggle("kbd-on", showKeys);
}
