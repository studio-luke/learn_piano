// ===== 청음 연습 — 답 고르는 건반 (단음 ①: G3~G5) =====
// 건반을 누르면 그 음이 답 — 페이지(pages/ear.js)가 바로 채점해요. 누를 때마다 소리도 페이지가 냄(고른 악기로).
//   - 마우스: 누르는 순간 입력
//   - 터치: 손을 뗄 때 입력, 10px 넘게 움직이면 스크롤로 보고 입력 안 함 (랜덤 코드 연습 practice/keyboard.js와 같은 규칙)
// 모양은 practice.css의 .keyboard / .key를 그대로 쓰고, 오답 표시(.bad)만 ear.css에.
// C에만 옥타브 이름(C4, C5)을 적어 위치를 알기 쉽게 — 다른 음이름은 답이 되므로 적지 않음
import { $ } from "../common/dom.js";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const keyEls = new Map();   // MIDI 번호 → 건반 요소

/**
 * 건반 그리기와 입력 연결 (한 번).
 * @param low, high  MIDI 번호 범위 (양 끝은 흰 건반이어야 함)
 * @param onPick(m)  건반을 골랐을 때
 */
export function initKeys(low, high, onPick) {
  const kb = $("keyboard");
  kb.innerHTML = "";
  keyEls.clear();
  let whites = 0;
  for (let m = low; m <= high; m++) if (WHITE.includes(m % 12)) whites++;
  kb.style.setProperty("--whites", whites);   // 흰 건반 수 (검은 건반 폭·위치 계산 — practice.css)
  let wi = 0;
  for (let m = low; m <= high; m++) {
    const pc = m % 12, white = WHITE.includes(pc);
    const el = document.createElement("div");
    el.className = "key " + (white ? "white" : "black");
    el.dataset.midi = m;
    el.innerHTML = `<span class="lbl">${pc === 0 ? "C" + (Math.floor(m / 12) - 1) : ""}</span>`;
    if (white) wi++;
    else el.style.left = `calc(100% / var(--whites) * ${wi} - 100% / var(--whites) * 0.33)`;   // 두 흰 건반 사이
    kb.appendChild(el);
    keyEls.set(m, el);
  }

  let touch = null;   // 터치 시작 { m, x, y }
  kb.addEventListener("pointerdown", e => {
    const el = e.target.closest(".key");
    if (!el) return;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      e.preventDefault();   // 글자 선택 방지
      onPick(+el.dataset.midi);
    } else touch = { m: +el.dataset.midi, x: e.clientX, y: e.clientY };
  });
  kb.addEventListener("pointermove", e => {
    if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) touch = null;   // 스크롤
  });
  kb.addEventListener("pointerup", e => {
    if (!touch || e.pointerType === "mouse") return;
    const m = touch.m; touch = null;
    onPick(m);
  });
  kb.addEventListener("pointercancel", () => { touch = null; });
}

/**
 * 건반 표시 바꾸기.
 * @param marks  Map(MIDI 번호 → "good" | "bad" | "ans") — 없는 건반은 표시 없음
 */
export function markKeys(marks = new Map()) {
  for (const [m, el] of keyEls) {
    const k = marks.get(m);
    el.classList.toggle("sel", k === "good" || k === "bad");
    el.classList.toggle("good", k === "good");
    el.classList.toggle("bad", k === "bad");
    el.classList.toggle("ans", k === "ans");
  }
}
