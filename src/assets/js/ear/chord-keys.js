// ===== 청음 연습 — 코드 ①의 건반 (F3~A5, 정답 표시 + 눌러서 소리 듣기) =====
// 답을 고르는 건반이 아니에요(답은 키패드). 정답을 확인하면 위 화음의 구성음(베이스 제외)을 칠하고, 아무 건반이나 누르면 그 음을 들려줌
// — 직접 쳐 보며 비교 (2026-11-25 사용자 결정). 모양은 practice.css .key + naming.css .keyboard.wide(코드 추론하기와 같은 넓은 건반).
// 연주는 코드 초견과 같이 (2026-11-25 사용자 요청 — 한 음씩 고르는 건반이 아니라서 앞 음을 끄지 않음):
//   마우스는 누르는 동안 울리고 떼면 줄어듦. 터치는 손을 뗄 때 한 번 울림(10px 넘게 움직이면 스크롤로 봄 — 코드 추론하기와 같음)
import { Engine } from "../core/engine.js";

export const KB_LOW = 53, KB_HIGH = 81;   // F3 ~ A5 (위 화음 음역 F3~D5, 자리바꿈 꺼짐 + 텐션의 A5까지 딱 맞게 — 흰 건반 17개, 2026-11-25 사용자 요청)

/**
 * 건반 만들기.
 * @param kb  건반 상자 (.keyboard.wide)
 * @param on  { down(midi) 마우스로 누름, up(midi) 마우스를 뗌, tap(midi) 터치로 누름(한 번 울림) }
 * @returns { draw(notes, cls), flash(midi), hold(midi, on) }
 */
export function makeChordKeys(kb, on) {
  const keyEls = new Map();
  const whites = [];
  for (let m = KB_LOW; m <= KB_HIGH; m++) if (Engine.WHITE.includes(m % 12)) whites.push(m);
  kb.style.setProperty("--whites", whites.length);
  let whiteIndex = 0;
  for (let m = KB_LOW; m <= KB_HIGH; m++) {
    const white = Engine.WHITE.includes(m % 12);
    const el = document.createElement("div");
    el.className = "key " + (white ? "white" : "black");
    el.dataset.midi = m;
    el.innerHTML = `<span class="lbl">${m % 12 === 0 ? "C" + (m / 12 - 1) : ""}</span>`;
    if (white) whiteIndex++;
    else el.style.left = `calc(100% / var(--whites) * ${whiteIndex} - 100% / var(--whites) * 0.33)`;
    kb.appendChild(el);
    keyEls.set(m, el);
  }
  let pending = null;      // 터치: 누른 건반 (손을 뗄 때 울림)
  let mouseKey = null;     // 마우스: 누르고 있는 건반
  const mouseUp = () => { if (mouseKey != null) { on.up(mouseKey); mouseKey = null; } };
  kb.addEventListener("pointerdown", e => {
    const el = e.target.closest(".key"); if (!el) return;
    if (e.pointerType === "mouse") { e.preventDefault(); mouseUp(); mouseKey = +el.dataset.midi; on.down(mouseKey); return; }
    pending = { id: e.pointerId, midi: +el.dataset.midi, x: e.clientX, y: e.clientY };
  });
  kb.addEventListener("pointermove", e => {
    if (pending && e.pointerId === pending.id && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 10) pending = null;
  });
  kb.addEventListener("pointerup", e => {
    if (e.pointerType === "mouse") { mouseUp(); return; }
    if (!pending || e.pointerId !== pending.id) return;
    const p = pending; pending = null;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el && el.closest(".key");
    if (key && +key.dataset.midi === p.midi) { e.preventDefault(); on.tap(p.midi); }
  });
  kb.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") mouseUp(); });
  kb.addEventListener("pointercancel", () => { pending = null; mouseUp(); });

  return {
    /** 칠하기: notes의 건반을 sel(포인트 색) 또는 good(초록)으로, 나머지는 원래대로. 이름표는 C 옥타브 표시만 */
    draw(notes = [], cls = "sel") {
      const on = new Set(notes.map(n => n.midi));
      for (const [m, el] of keyEls) {
        el.classList.toggle("sel", on.has(m));
        el.classList.toggle("good", on.has(m) && cls === "good");
      }
    },
    /** 누르는 동안 칠하기 (마우스·MIDI 건반) */
    hold(midi, down) { keyEls.get(midi)?.classList.toggle("ref", down); },
    /** 잠깐 칠하기 (소리에 맞춰 — 누른 건반) */
    flash(midi, ms = 250) {
      const el = keyEls.get(midi); if (!el) return;
      el.classList.add("ref");
      setTimeout(() => el.classList.remove("ref"), ms);
    },
  };
}
