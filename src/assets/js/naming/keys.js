// ===== 코드 추론하기 — 건반 (F3~D6, 보기만 함) =====
// 문제의 음을 눌린 모양으로 보여주는 건반이에요. 사용자는 누를 수 없어요.
//   - 흰 건반은 늘 흰색. 건반을 누르면 "문제 표시 전용" 알림 (pages/naming.js — 2026-11-08 사용자 결정, 회색으로 칠하던 방식 대신)
//   - 오답일 때 "빠진 음"(화면에 있는데 답한 코드에 없는 음)은 주황색
//   - 정답을 맞히면 눌린 건반을 모두 초록색 (사용자 요청 2026-11-08)
//   - "건반에 음이름 표시"를 켜면 눌린 건반에만 이름(악보와 같은 철자)
// 모양은 practice.css의 .key를 그대로 쓰고, 흰 건반 20개에 맞춘 폭·주황은 naming.css
import { $ } from "../common/dom.js";
import { Engine } from "../core/engine.js";
import { LOW, HIGH } from "../core/naming.js";

const keyEls = new Map();   // MIDI 번호 → 건반 요소

/** 건반 그리기 (한 번) */
export function initKeys() {
  const kb = $("keyboard");
  const whites = [];
  for (let m = LOW; m <= HIGH; m++) if (Engine.WHITE.includes(m % 12)) whites.push(m);
  kb.style.setProperty("--whites", whites.length);   // 흰 건반 수 (검은 건반 폭·위치 계산에 씀)
  let whiteIndex = 0;
  for (let m = LOW; m <= HIGH; m++) {
    const white = Engine.WHITE.includes(m % 12);
    const el = document.createElement("div");
    el.className = "key " + (white ? "white" : "black");
    el.innerHTML = `<span class="lbl"></span>`;
    if (white) whiteIndex++;
    else el.style.left = `calc(100% / var(--whites) * ${whiteIndex} - 100% / var(--whites) * 0.33)`;   // 두 흰 건반 사이
    kb.appendChild(el);
    keyEls.set(m, el);
  }
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
  for (const [m, el] of keyEls) {
    const pressed = on.has(m);
    el.classList.toggle("sel", pressed && !bad.has(m));
    el.classList.toggle("bad", pressed && bad.has(m));
    el.classList.toggle("good", pressed && good);   // practice.css .key.sel.good (초록)
    el.querySelector(".lbl").textContent = pressed && labels ? on.get(m) : "";
  }
}
