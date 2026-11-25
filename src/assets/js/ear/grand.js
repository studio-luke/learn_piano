// ===== 청음 연습 — 코드 ①의 큰보표 (SVG로 직접 그림) =====
// 위 화음은 높은음자리표, 베이스는 낮은음자리표에 온음표로 (2026-11-25 사용자 결정). 박자·조표·기둥은 없음.
// 음표 머리·임시표·덧줄 자리는 코드 추론하기의 계산(naming/staff.js layout)을 그대로 씀:
//   2도로 붙은 음은 위쪽 머리를 오른쪽으로, 임시표가 여럿이면 겹치지 않게 열을 나눔
//   낮은음자리표는 "한 줄 = 높은음자리표의 같은 자리" — 낮은음자리표 맨 윗줄 A3 = 높은음자리표 맨 윗줄 F5 (12칸 차이)라
//   베이스 음을 12칸 올린 가짜 음으로 계산하고 그림만 아래 보표에 그림
// 위 화음 E3~D5 → 높은음자리표 아래 덧줄 최대 3개(C4 A3 F3 — E3은 F3 덧줄 아래), 베이스 E2~D♯3 → 낮은음자리표 아래 덧줄 최대 1개(E2)
import { layout, ACC_PATH, headPath } from "../naming/staff.js";

const SP = 10, HALF = SP / 2;
const TOP = 37;                  // 높은음자리표 맨 윗줄 (naming/staff.js와 같음)
const W = 130;                   // 그림 폭 (naming/staff.js와 같음 — 음표 머리 x도 같음)
const GAP = 94;                  // 두 보표의 맨 윗줄 사이 — 위 보표 맨 아랫줄 아래 54(E3 머리까지 약 45)
const H = TOP + GAP + 4 * SP + 30;   // 아래 보표 밑에 덧줄 하나(E2) 자리
const X0 = 8;                    // 오선 시작 (왼쪽에 보표를 묶는 세로줄)

// 베이스 음 → 12칸 위의 가짜 음 (낮은음자리표 자리를 높은음자리표 계산으로)
function lift(n) {
  const L = n.l + 12;
  return { ...n, l: L % 7, oct: n.oct + Math.floor(L / 7), orig: n };
}

/**
 * 큰보표 그리기.
 * @param el     그릴 상자
 * @param upper  위 화음 음 [{ midi, l, a, oct, name }] — 비우면 오선·음자리표만
 * @param bass   베이스 음 (없으면 null)
 * @param cls    음표 색: "" | "good"(정답 — 초록)
 */
export function drawGrand(el, upper = [], bass = null, cls = "") {
  const staff = (y0, clef) => {
    let s = "";
    for (let i = 0; i < 5; i++) s += `<line class="st-line" x1="${X0}" x2="${W}" y1="${y0 + i * SP}" y2="${y0 + i * SP}"/>`;
    // 음자리표 글자의 기준선: 𝄞는 G4 줄(아래에서 둘째 줄). 𝄢는 글자 아래 끝이 기준선이라 넷째 줄 조금 아래에 맞춰야
    // 두 점이 F3 줄(위에서 둘째 줄)을 사이에 둠 (Noto Music으로 확인)
    s += clef === "g" ? `<text class="st-clef" x="${X0 + 3}" y="${y0 + 3 * SP}">𝄞</text>`
      : `<text class="st-clef bass" x="${X0 + 3}" y="${y0 + 3 * SP + 2}">𝄢</text>`;
    return s;
  };
  const notesSvg = (notes, dy) => {
    if (!notes.length) return "";
    const { heads, accs, ledgers } = layout(notes);
    let s = "";
    for (const g of ledgers) s += `<line class="st-ledger" x1="${g.x1}" x2="${g.x2}" y1="${g.y + dy}" y2="${g.y + dy}"/>`;
    for (const a of accs) s += `<path class="st-acc ${cls}" transform="translate(${a.x.toFixed(2)},${a.y + dy})" d="${ACC_PATH[String(a.a)]}"/>`;
    for (const h of heads) s += `<path class="st-head ${cls}" fill-rule="evenodd" d="${headPath(h.x, h.y + dy)}"/>`;
    return s;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  svg += `<line class="st-line" x1="${X0}" x2="${X0}" y1="${TOP}" y2="${TOP + GAP + 4 * SP}"/>`;   // 두 보표를 잇는 세로줄
  svg += staff(TOP, "g") + staff(TOP + GAP, "f");
  svg += notesSvg(upper, 0);
  if (bass) svg += notesSvg([lift(bass)], GAP);
  svg += `</svg>`;
  el.innerHTML = svg;
}
