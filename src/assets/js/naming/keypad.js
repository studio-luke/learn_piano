// ===== 코드 추론하기 — 답 입력칸과 키패드 =====
// 코드 이름에 쓰는 글자만 모은 키패드예요 (사용자 결정 2026-11-08). △ - + ø 같은 기호와 alt는 넣지 않음.
//   [C D E F G A B ♯ ♭] [M m dim aug sus add] [2 4 5 6 7 9 11 13] [( ) ,]   지우기(⌫)는 입력칸 오른쪽
//
// 입력칸은 진짜 <input>이 아니라 "조각(token)"을 늘어놓은 칸이에요 (2026-11-08 사용자 결정).
//   왜: iPhone은 <input>을 한 번 누르면 커서를 단어 끝으로 보내서 중간에 커서를 둘 수 없었고, 드래그로 옮긴 커서는 알아챌 수 없었음.
//   조각 = 키패드 키 하나 (C, ♭, dim, 11 …). 컴퓨터 키보드로 친 글자도 같은 규칙으로 묶어서(d-i-m → dim)
//   버튼으로 넣었든 키보드로 쳤든 커서·⌫가 똑같이 동작해요. 커서는 조각 사이에만 놓이고, 누른 자리에서 가장 가까운 사이로 감.
//   키보드로 친 b·#은 맨 앞이 아니면 ♭·♯로 바꿔 보여줌 (맨 앞의 소문자 b는 그대로 → "근음은 대문자로" 안내가 나오게)
import { $, esc } from "../common/dom.js";

const ROWS = [
  ["C", "D", "E", "F", "G", "A", "B", "♯", "♭"],
  ["M", "m", "dim", "aug", "sus", "add"],
  ["2", "4", "5", "6", "7", "9", "11", "13"],
  ["(", ")", ","],
];
// 글자를 조각으로 나누는 규칙: 여러 글자 조각을 먼저, 나머지는 한 글자씩
const TOKEN = /dim|aug|sus|add|maj|min|11|13|[\s\S]/gu;
const split = s => s.match(TOKEN) || [];

let tokens = [];   // 지금 입력한 조각들
let caret = 0;     // 커서: 몇 번째 조각 앞인지 (0 = 맨 앞, tokens.length = 맨 끝)
let enabled = true;
let onInput = () => {};

/** 지금 입력한 글자 전체 */
export const answerText = () => tokens.join("");
/** 커서가 맨 끝에 있는지 (→ 키: 끝이면 다음 문제, 아니면 커서 이동) */
export const caretAtEnd = () => caret === tokens.length;

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
  // 입력칸을 누르면: 누른 자리에서 가장 가까운 조각 사이로 커서를 옮김
  $("answer").addEventListener("pointerdown", e => {
    if (!enabled) return;
    e.preventDefault();
    const spans = [...$("answer").querySelectorAll(".tok")];
    let pos = tokens.length;
    for (let i = 0; i < spans.length; i++) {
      const r = spans[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) { pos = i; break; }
    }
    caret = pos;
    render();
  });
  render();
}

// 입력칸 다시 그리기: 조각마다 <span>, 커서 자리에 깜빡이는 막대
function render() {
  const el = $("answer");
  let html = "";
  tokens.forEach((t, i) => {
    if (i === caret) html += `<span class="caret" aria-hidden="true"></span>`;
    html += `<span class="tok${/[♯♭]/.test(t) ? " acc" : ""}">${esc(t)}</span>`;
  });
  if (caret === tokens.length) html += `<span class="caret" aria-hidden="true"></span>`;
  el.innerHTML = html;
  el.setAttribute("aria-valuetext", answerText());
  el.classList.toggle("empty", !tokens.length);
  // (커서 막대를 매번 새로 만들어서, 누른 직후에는 깜빡임이 처음부터 시작해 바로 보임)
}

/** 커서 자리에 글자 넣기 (키패드 키 하나 또는 키보드로 친 글자 하나) */
export function type(k) {
  if (!enabled) return;
  const left = tokens.slice(0, caret).join("");
  if (left !== "") k = k === "b" ? "♭" : k === "#" ? "♯" : k;
  const newLeft = split(left + k);   // 앞 조각과 합쳐질 수 있음 (d-i-m → dim, 1-1 → 11)
  tokens = newLeft.concat(tokens.slice(caret));
  caret = newLeft.length;
  render(); onInput();
}

/** 커서 바로 앞의 조각 하나 지우기 */
export function backspace() {
  if (!enabled || caret === 0) return;
  tokens.splice(caret - 1, 1);
  caret--;
  render(); onInput();
}

/** 커서를 조각 하나만큼 옮기기 (컴퓨터의 ← →) */
export function moveCaret(d) {
  caret = Math.max(0, Math.min(tokens.length, caret + d));
  render();
}

/** 입력칸 비우기 (새 문제) */
export function clearAnswer() {
  tokens = []; caret = 0;
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
