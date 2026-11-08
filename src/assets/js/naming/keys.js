// ===== 코드 추론하기 — 건반 (F3~D6, 문제 표시 + 눌린 음 들어보기) =====
// 문제의 음을 눌린 모양으로 보여주는 건반이에요. 건반을 눌러 답을 고르지는 않아요(답은 키패드로).
//   - 문제로 눌린 건반을 누르면 그 음 하나를 들려주고, 안 눌린 건반을 누르면 알림 (pages/naming.js — 2026-11-09 사용자 요청.
//     그전에는 모든 건반이 "문제 표시 전용" 알림만 띄웠음)
//   - 흰 건반은 늘 흰색 (2026-11-08 사용자 결정, 회색으로 칠하던 방식 대신)
//   - 오답일 때 "빠진 음"(화면에 있는데 답한 코드에 없는 음)은 주황색
//   - 정답을 맞히면 눌린 건반을 모두 초록색 (사용자 요청 2026-11-08)
//   - "건반에 음이름 표시"를 켜면 눌린 건반에만 이름(악보와 같은 철자)
// 모양은 practice.css의 .key를 그대로 쓰고, 흰 건반 20개에 맞춘 폭·주황은 naming.css
import { $ } from "../common/dom.js";
import { Engine } from "../core/engine.js";
import { LOW, HIGH } from "../core/naming.js";

const keyEls = new Map();   // MIDI 번호 → 건반 요소
const shown = new Set();    // 지금 문제로 눌린 MIDI 번호들 (drawKeys가 채움)

/**
 * 건반 그리기 (한 번).
 * @param onTap(midi, pressed)  건반을 눌렀을 때 — pressed: 그 건반이 문제로 눌린 건반인지
 */
export function initKeys(onTap) {
  const kb = $("keyboard");
  const whites = [];
  for (let m = LOW; m <= HIGH; m++) if (Engine.WHITE.includes(m % 12)) whites.push(m);
  kb.style.setProperty("--whites", whites.length);   // 흰 건반 수 (검은 건반 폭·위치 계산에 씀)
  let whiteIndex = 0;
  for (let m = LOW; m <= HIGH; m++) {
    const white = Engine.WHITE.includes(m % 12);
    const el = document.createElement("div");
    el.className = "key " + (white ? "white" : "black");
    el.dataset.midi = m;
    el.innerHTML = `<span class="lbl"></span>`;
    if (white) whiteIndex++;
    else el.style.left = `calc(100% / var(--whites) * ${whiteIndex} - 100% / var(--whites) * 0.33)`;   // 두 흰 건반 사이
    kb.appendChild(el);
    keyEls.set(m, el);
  }

  // 누르기 — 랜덤 코드 연습 건반(practice/keyboard.js)과 같은 규칙:
  // 마우스는 누르는 순간, 터치·펜은 손을 뗄 때. 10px 넘게 움직였으면 스크롤로 보고 무시
  const tap = m => onTap(m, shown.has(m));
  let pending = null;
  kb.addEventListener("pointerdown", e => {
    const el = e.target.closest(".key"); if (!el) return;
    if (e.pointerType === "mouse") { e.preventDefault(); tap(+el.dataset.midi); return; }
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
    if (key && +key.dataset.midi === p.midi) { e.preventDefault(); tap(p.midi); }
  });
  kb.addEventListener("pointercancel", () => { pending = null; });
}

/**
 * 건반 상태 그리기.
 * @param notes   문제의 음 [{ midi, name }] (없으면 [] — 문제를 낼 수 없을 때)
 * @param bad     주황색으로 표시할 MIDI 번호들 (오답일 때)
 * @param labels  눌린 건반에 이름을 쓸지
 * @param good    정답을 맞혔는지 (눌린 건반을 초록색으로)
 */
export function drawKeys(notes, bad = new Set(), labels = false, good = false) {
  const on = new Map(notes.map(n => [n.midi, n.name]));
  shown.clear(); for (const m of on.keys()) shown.add(m);
  for (const [m, el] of keyEls) {
    const pressed = on.has(m);
    el.classList.toggle("sel", pressed && !bad.has(m));
    el.classList.toggle("bad", pressed && bad.has(m));
    el.classList.toggle("good", pressed && good);   // practice.css .key.sel.good (초록)
    el.querySelector(".lbl").textContent = pressed && labels ? on.get(m) : "";
  }
}
