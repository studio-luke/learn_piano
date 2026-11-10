// ===== 코드 초견 — 88건반 (A0~C8, 컴퓨터에서만 보임) =====
// 누르고 있는 동안만 선택(하이라이트)되고, 떼면 해제돼요 — MIDI 건반의 hold 규칙과 같음 (2026-11-10 사용자 결정).
// 아직 연주를 채점하지 않으니 표시와 소리만. 누른 건반 목록은 held에 있어서, 나중에 연주 검사를 붙일 때 그대로 쓸 수 있어요.
// 마우스로 누르면 그 건반이 선택되고 소리가 나며, 버튼을 떼는 순간(건반 밖에서 떼도) 해제·소리 줄어듦.
// 입력이 마우스인지 MIDI인지는 구분해서 기억함: 같은 건반을 MIDI로 누른 채 마우스로 눌렀다 떼도 MIDI 쪽은 그대로 유지.
// 모양은 practice.css의 .keyboard / .key (랜덤 코드 연습 88건반과 같은 모양)
import { $ } from "../common/dom.js";
import { Engine } from "../core/engine.js";

export const LOW = 21, HIGH = 108;   // A0 ~ C8

const keyEls = new Map();      // MIDI 번호 → 건반 요소
const sources = new Map();     // MIDI 번호 → 그 건반을 누르고 있는 입력들 Set("mouse" | "midi")
/** 지금 눌려 있는 건반 (MIDI 번호) — 마우스·MIDI 어느 쪽이든 하나라도 누르고 있으면 들어 있음 */
export const held = new Set();

/**
 * 건반 그리기와 마우스 입력 연결 (한 번).
 * @param onMouse(m, down)  마우스로 건반을 누름(down=true) / 뗌(false) — 소리는 페이지가 냄
 */
export function initKeys(onMouse) {
  const kb = $("keyboard");
  let whites = 0;
  for (let m = LOW; m <= HIGH; m++) if (Engine.WHITE.includes(m % 12)) whites++;
  kb.style.setProperty("--whites", whites);   // 흰 건반 수 (검은 건반 폭·위치 계산에 씀 — practice.css)
  let whiteIndex = 0;
  for (let m = LOW; m <= HIGH; m++) {
    const pc = m % 12, white = Engine.WHITE.includes(pc), oct = Math.floor(m / 12) - 1;
    const el = document.createElement("div");
    el.className = "key " + (white ? "white" : "black");
    el.dataset.midi = m;
    el.innerHTML = `<span class="lbl">${pc === 0 ? "C" + oct : ""}</span>`;   // 위치를 알기 쉽게 C에만 옥타브 표시
    if (white) whiteIndex++;
    else el.style.left = `calc(100% / var(--whites) * ${whiteIndex} - 100% / var(--whites) * 0.33)`;   // 두 흰 건반 사이
    kb.appendChild(el);
    keyEls.set(m, el);
  }

  // 마우스: 누르는 순간 선택 + 소리, 떼는 순간 해제. 누른 채 건반 밖으로 나가 떼도 해제되게 창 전체에서 뗌을 받음
  let mouseKey = null;
  const release = () => {
    if (mouseKey === null) return;
    const m = mouseKey; mouseKey = null;
    press(m, "mouse", false);
    onMouse(m, false);
  };
  kb.addEventListener("pointerdown", e => {
    const el = e.target.closest(".key");
    if (!el || e.button !== 0) return;
    e.preventDefault();   // 글자 선택·끌기 방지
    release();            // 혹시 남아 있던 것 정리
    mouseKey = +el.dataset.midi;
    press(mouseKey, "mouse", true);
    onMouse(mouseKey, true);
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);   // 누른 채 다른 창으로 가면 뗌 신호가 안 와서
}

/**
 * 건반 누름/뗌 표시. 입력(src)마다 따로 기억해서, 마우스와 MIDI가 같은 건반을 누르고 있으면 둘 다 떼야 해제.
 * @param src  "mouse" | "midi"
 */
export function press(m, src, down) {
  const set = sources.get(m) || new Set();
  if (down) set.add(src); else set.delete(src);
  if (set.size) { sources.set(m, set); held.add(m); } else { sources.delete(m); held.delete(m); }
  const el = keyEls.get(m);
  if (el) el.classList.toggle("sel", held.has(m));
}
