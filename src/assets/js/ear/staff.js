// ===== 청음 연습 — 눌러서 음을 고르는 오선지 (SVG로 직접 그림) =====
// 높은음자리표 + 조표 한 줄. 줄이나 칸을 누르면 그 자리의 음을 골라요 (단음 ①, 2026-11-24 사용자 결정):
//   - 변화표는 [♯ | ♮ | ♭ | 해제] 중 고른 것 — 기본은 해제(조표대로), 다른 것을 골랐으면 한 번 쓰고 조표대로로 돌아감 (페이지가 정함)
//   - 고를 수 있는 높이: F3 ~ F5 (건반과 같은 범위)
//   - 마우스를 올리면 그 자리에 흐린 음표(어디를 고르게 되는지)
// 음표 자리(slot)는 단계마다: 단음 ①은 한 자리에 온음표, 단음 ②는 4~5자리에 4분음표(앞 3자리는 보여 주는 음, 그 뒤가 문제 —
// 지금 고르는 자리(answerSlot)에 고른 음·흐린 음표, 아직 안 고른 문제 자리는 "?").
// 조표와 다른 변화표만 음표 앞에 그림(조표대로인 음은 변화표 없음, 조표를 지우는 음은 ♮) — 음마다 따로(마디줄이 없어서 이어지지 않음).
// 임시표·음표 머리 도형은 코드 추론하기 악보(naming/staff.js)와 같은 것. 모양(색)은 ear.css의 .ear-staff
import { $ } from "../common/dom.js";
import { ACC_PATH, headPath } from "../naming/staff.js";
import { sigAcc } from "./theory.js";

const SP = 10, HALF = SP / 2;     // 오선 간격 (그림 단위)
const TOP = 40;                   // 맨 윗줄(F5)의 y
const H = 124;                    // 그림 높이 (viewBox) — 폭은 음표 자리 수에 따라 (width())
const FIRST_X = 130;              // 첫 음표 가운데 x (조표 7개 + 임시표가 들어가도 겹치지 않는 자리)
const GAP = 34;                   // 음표 사이 간격
const STEM = 35;                  // 4분음표 기둥 길이
const SIG_X = 40, SIG_W = 9;      // 조표 시작 x, 변화표 하나의 폭
export const STEP_LOW = 24, STEP_HIGH = 38;   // F3 ~ F5 (줄·칸 번호: C4 = 28, 옥타브 × 7 + 글자)

// 조표 자리 (줄·칸 번호) — 높은음자리표의 표준 위치
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];   // F C G D A E B
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];    // B E A D G C F

const yOf = step => TOP + (38 - step) * HALF;
const stepOfY = y => 38 - Math.round((y - TOP) / HALF);

// 제자리표 ♮ (가운데가 음 높이, 오선 간격 10 기준) — naming/staff.js에는 없어서 여기서 그림
const poly = pts => "M" + pts.map(p => p.join(",")).join("L") + "Z";
const NATURAL_PATH = poly([[-3, -11], [-1.9, -11], [-1.9, 6], [-3, 6]]) + poly([[1.9, -6], [3, -6], [3, 11], [1.9, 11]])
  + poly([[-3, -2.2], [3, -4.2], [3, -1.6], [-3, 0.4]]) + poly([[-3, 4.2], [3, 2.2], [3, 4.8], [-3, 6.8]]);

let sig = { a: 0, count: 0, letters: new Set() };
let shown = [];        // 그려 둔 것 [{ note: {l,a,oct}, cls: "good" | "bad" | "", slot }] 또는 { placeholder: true, slot } ("?")
let slots = 1, quarter = false;   // 음표 자리 수, 4분음표로 그릴지 (아니면 온음표)
const xOf = i => FIRST_X + i * GAP;
const width = () => xOf(slots - 1) + 40;
let answerSlot = 0;                // 답을 고르는 자리 (흐린 음표·고른 음이 여기) — 보통 마지막, 맞힐 음이 2개면 차례대로
let ghost = null;      // 마우스를 올린 자리의 줄·칸 번호 (없으면 null)
let onPick = () => {};

/**
 * 악보 만들기와 입력 연결 (한 번).
 * @param pick({ l, oct })  줄·칸을 눌렀을 때 — 변화표는 페이지가 붙임
 */
export function initStaff(pick) {
  onPick = pick;
  const box = $("earStaff");
  const toStep = e => {
    const svg = box.querySelector("svg");
    const ctm = svg && svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    if (p.x < SIG_X - 6) return null;   // 음자리표 위는 고르지 않음
    const s = stepOfY(p.y);
    return s >= STEP_LOW - 1 && s <= STEP_HIGH + 1 ? Math.min(STEP_HIGH, Math.max(STEP_LOW, s)) : null;
  };
  box.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const s = toStep(e);
    if (s !== ghost) { ghost = s; draw(); }
  });
  box.addEventListener("pointerleave", () => { if (ghost !== null) { ghost = null; draw(); } });
  // 누르기: 마우스는 누르는 순간, 터치는 손을 뗄 때(10px 넘게 움직이면 스크롤) — 건반과 같은 규칙
  let touch = null;
  box.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      const s = toStep(e);
      if (s !== null) { e.preventDefault(); onPick({ l: s % 7, oct: Math.floor(s / 7) }); }
    } else touch = { x: e.clientX, y: e.clientY, e };
  });
  box.addEventListener("pointermove", e => { if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) touch = null; });
  box.addEventListener("pointerup", e => {
    if (!touch || e.pointerType === "mouse") return;
    touch = null;
    const s = toStep(e);
    if (s !== null) onPick({ l: s % 7, oct: Math.floor(s / 7) });
  });
  box.addEventListener("pointercancel", () => { touch = null; });
  draw();
}

/** 조표 바꾸기 (theory.js signature()의 값) */
export function setSignature(s) { sig = s; draw(); }

/** 음표 자리 수와 모양 (단음 ①: 1, 온음표 / 단음 ②: 4, 4분음표) */
export function setSlots(n, q) { slots = n; quarter = q; answerSlot = n - 1; shown = []; draw(); }

/** 마우스를 올렸을 때 흐린 음표를 보일지 — 문제가 끝나면(맞힘·정답 확인) 끔 (2026-11-24 사용자 요청) */
let ghostOn = true;
export function setGhostEnabled(on) { if (ghostOn !== on) { ghostOn = on; draw(); } }

/** 답을 고르는 자리 바꾸기 (단음 ②에서 맞힐 음이 2개일 때 — 첫 번째를 맞히면 다음 자리로) */
export function setAnswerSlot(i) { answerSlot = i; }

/**
 * 그릴 것 바꾸기: [{ note: {l,a,oct}, cls, slot }] 또는 { placeholder: true, slot }("?") — slot을 안 주면 답 자리.
 * 같은 자리에 겹치면 나중 것이 위
 */
export function showNotes(list) { shown = list; draw(); }

function draw() {
  const W = width();
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // 누르는 자리를 넓게 받으려고 투명한 바탕 (선 사이를 눌러도 svg가 이벤트를 받게)
  svg += `<rect class="st-hit" x="0" y="0" width="${W}" height="${H}"/>`;
  for (let i = 0; i < 5; i++) svg += `<line class="st-line" x1="0" x2="${W}" y1="${TOP + i * SP}" y2="${TOP + i * SP}"/>`;
  svg += `<text class="st-clef" x="3" y="${yOf(32)}">𝄞</text>`;
  // 조표
  const steps = sig.a > 0 ? SHARP_STEPS : FLAT_STEPS;
  for (let i = 0; i < sig.count; i++) {
    svg += `<path class="st-acc" transform="translate(${SIG_X + i * SIG_W + SIG_W / 2},${yOf(steps[i])})" d="${ACC_PATH[String(sig.a)]}"/>`;
  }
  // 답 자리의 것: "?"는 마우스를 올리면 흐린 음표로 바뀜
  const atAnswer = x => (x.slot ?? answerSlot) === answerSlot;
  const lastNote = shown.find(x => atAnswer(x) && x.note);
  // 흐린 음표 (마우스를 올린 답 자리) — 이미 같은 높이의 음이 그려져 있으면 안 그림
  // 잠겨 있을 때(필수 재생 중)는 흐린 음표를 그리지 않음 — 마우스가 악보 위에 있던 채로 잠기면 답 자리의 "?"를 가려서
  // 첫 번째 "?"가 울릴 때 파랗게 보이지 않았음 (2026-11-24)
  const showGhost = ghostOn && ghost !== null && !$("earStaff").classList.contains("locked")
    && !(lastNote && lastNote.note.oct * 7 + lastNote.note.l === ghost);
  for (const x of shown) {
    const slot = x.slot ?? answerSlot;
    if (x.placeholder) { if (!(showGhost && slot === answerSlot && x.cls !== "ref")) svg += `<text class="st-q ${x.cls || ""}" x="${xOf(slot)}" y="${yOf(34) + 8}" text-anchor="middle">?</text>`; }
    else svg += noteSVG(x.note, x.cls, slot);
  }
  if (showGhost) svg += noteSVG({ l: ghost % 7, oct: Math.floor(ghost / 7), a: null }, "ghost", answerSlot);
  svg += `</svg>`;
  $("earStaff").innerHTML = svg;
}

/** 음표 하나 (덧줄·변화표 포함, 4분음표면 기둥도). a가 null이면 변화표 없이(흐린 음표) */
function noteSVG(n, cls, slot) {
  const X = xOf(slot), step = n.oct * 7 + n.l, y = yOf(step);
  let s = "";
  for (let k = 28; k >= step; k -= 2) s += `<line class="st-ledger ${cls}" x1="${X - 10}" x2="${X + 10}" y1="${yOf(k)}" y2="${yOf(k)}"/>`;
  for (let k = 40; k <= step; k += 2) s += `<line class="st-ledger ${cls}" x1="${X - 10}" x2="${X + 10}" y1="${yOf(k)}" y2="${yOf(k)}"/>`;
  if (n.a !== null && n.a !== sigAcc(sig, n.l)) {
    const d = n.a === 0 ? NATURAL_PATH : ACC_PATH[String(n.a)];
    s += `<path class="st-acc ${cls}" transform="translate(${X - 15},${y})" d="${d}"/>`;
  }
  if (!quarter) return s + `<path class="st-head ${cls}" fill-rule="evenodd" d="${headPath(X, y)}"/>`;
  // 4분음표: 칠한 머리 + 기둥 (가운데 줄 B4(34)부터 위는 아래로, 그 아래는 위로 — 악보의 보통 규칙)
  const down = step >= 34;
  const sx = down ? X - 5.3 : X + 5.3;
  s += `<line class="st-stem ${cls}" x1="${sx}" x2="${sx}" y1="${y + (down ? 1 : -1)}" y2="${y + (down ? STEM : -STEM)}"/>`;
  return s + `<path class="st-head ${cls}" d="${solidHead(X, y)}"/>`;
}

/** 4분음표 머리: 칠한 비스듬한 타원 */
function solidHead(cx, cy, rx = 5.8, ry = 4.2, deg = -20, steps = 24) {
  const r = deg * Math.PI / 180, pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push(`${(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(2)},${(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(2)}`);
  }
  return "M" + pts.join("L") + "Z";
}
