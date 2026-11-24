// ===== 청음 연습 — 리듬이 있는 악보 (단음 ③ 멜로디 받아쓰기, SVG로 직접 그림) =====
// 4/4 한두 마디를 실제 악보처럼 그려요 (2026-11-24 사용자 결정, chordoven-spec.md "청음 연습" ③):
//   - 높은음자리표 · 조표 · 박자표(4/4, 첫 줄만) · 마디줄(끝은 겹세로줄)
//   - 음표: 2분(빈 머리) · 4분 · 8분 · 16분(칠한 머리), 점, 기둥(가운데 줄 B4부터 위는 아래로), 덧줄
//   - 8분·16분음표는 한 박 안에서 이어진 것끼리 빔(꼬리 연결)으로 묶음 — 16분은 두 번째 빔, 혼자인 16분은 짧은 빔.
//     묶을 짝이 없으면 꼬리(깃발). 쉼표에서는 빔이 끊김. 8분-4분-8분처럼 박을 넘는 음은 묶지 않음
//   - 쉼표: 4분 · 8분 · 16분 (도형으로 그림 — 글꼴마다 모양·자리가 달라서)
//   - 임시표: 조표와 다르면 붙이고, 같은 마디 안 같은 자리에서는 앞 음의 임시표가 이어짐(다시 바뀔 때만 다시 붙임)
//   - 폭: 음표 길이에 따라 넓게(짧은 음도 붙어 보이지 않게 최소 폭), 한 줄에 perLine마디 — 폰은 1마디씩
// 화면 크기는 ear.css의 .ear-score (높이 = 줄 수 × 한 줄 높이). 색은 토큰마다 cls(good·bad·ref)로.
import { ACC_PATH } from "../naming/staff.js";
import { SHARP_STEPS, FLAT_STEPS, NATURAL_PATH } from "./staff.js";
import { sigAcc } from "./theory.js";
import { BAR, BEAT } from "./rhythm.js";

const SP = 10, HALF = SP / 2;
const LINE_H = 110;          // 한 줄(오선 하나)의 높이
const TOP = 34;              // 한 줄 안에서 맨 윗줄(F5)의 y
const STEM = 33;             // 기둥 길이
const BEAM_W = 4.6;          // 빔 두께
const BEAM_GAP = 7.5;        // 첫째·둘째 빔 사이
const UNIT = 6, MIN_W = 20;  // 토큰 폭 = 16분 단위 × UNIT + 12 (최소 MIN_W)
const SIG_X = 40, SIG_W = 9;

const stepOf = n => n.oct * 7 + n.l;
const yOf = (step, line) => line * LINE_H + TOP + (38 - step) * HALF;
const tokenW = t => Math.max(MIN_W, t.dur * UNIT + 12);
const isBeamable = t => !t.rest && t.dur <= 3;   // 8분·점8분·16분

/** 비스듬한 타원 (머리 그리기) */
function ellipse(cx, cy, rx, ry, deg, steps = 24) {
  const r = deg * Math.PI / 180, pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push(`${(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(2)},${(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(2)}`);
  }
  return "M" + pts.join("L") + "Z";
}
const solidHead = (x, y) => ellipse(x, y, 5.8, 4.2, -20);
const hollowHead = (x, y) => ellipse(x, y, 5.8, 4.2, -20) + ellipse(x, y, 4.2, 2, -20);   // 2분음표 (evenodd로 가운데 비움)

// 쉼표 도형 (가운데 = 가운데 줄 높이, 오선 간격 10 기준)
const REST_PATH = {
  4: "M-2.6,-15L3.4,-7.5L-1.2,-1.5L3.6,5.5L1.4,5.2C-1.8,4.4 -3.4,7 -0.8,11.2L-1.6,11.4C-6.4,7 -3.4,1.6 0.6,3.2L-3.6,-3L1,-8.8Z",
  2: "M-2.2,-5.2m-2.6,0a2.6,2.6 0 1,0 5.2,0a2.6,2.6 0 1,0 -5.2,0M-0.6,-4C1.2,-3.6 2.6,-4.4 3.6,-6.4L4.6,-6.2L-0.6,9.8L-2,9.8L2.2,-2.6C0.8,-1.6 -0.6,-1.4 -2,-2Z",
  1: "M-1.2,-7.2m-2.6,0a2.6,2.6 0 1,0 5.2,0a2.6,2.6 0 1,0 -5.2,0M0.4,-6C2.2,-5.6 3.6,-6.4 4.6,-8.4L5.6,-8.2L-0.6,12L-2,12L1.2,2C-0.2,3 -1.6,3.2 -3,2.6M-3.4,-0.4m-2.6,0a2.6,2.6 0 1,0 5.2,0a2.6,2.6 0 1,0 -5.2,0M-1.8,0.8C0,1.2 1.4,0.4 2.4,-1.6L3.2,0.4",
};

/**
 * 악보 그리기.
 * @param el      그릴 상자 (안을 SVG로 채움)
 * @param tokens  [{ pos, dur, rest, note?: {l,a,oct}, cls? }] — rhythm.js makeDictation 모양. note가 없는 음표는 가운데 줄(B4)에 (리듬만 보여 줄 때)
 * @param opt     { bars, sig: theory.js signature(), perLine: 한 줄 마디 수 }
 */
export function renderScore(el, tokens, { bars = 1, sig = { a: 0, count: 0, letters: new Set() }, perLine = 2 } = {}) {
  const lines = Math.ceil(bars / perLine);
  // 마디별 토큰과 폭
  const byBar = Array.from({ length: bars }, (_, b) => tokens.filter(t => Math.floor(t.pos / BAR) === b));
  const barW = b => byBar[b].reduce((a, t) => a + tokenW(t), 0) + 16 || BAR * UNIT;
  const headX = new Map();   // 토큰 → 머리 x
  let svgBody = "", maxW = 0;
  for (let line = 0; line < lines; line++) {
    const first = line * perLine, last = Math.min(bars, first + perLine) - 1;
    // 줄 머리: 음자리표 · 조표 · (첫 줄만) 박자표
    let x = SIG_X + sig.count * SIG_W + 8;
    svgBody += `<text class="st-clef" x="3" y="${yOf(32, line)}">𝄞</text>`;
    const steps = sig.a > 0 ? SHARP_STEPS : FLAT_STEPS;
    for (let i = 0; i < sig.count; i++) svgBody += `<path class="st-acc" transform="translate(${SIG_X + i * SIG_W + SIG_W / 2},${yOf(steps[i], line)})" d="${ACC_PATH[String(sig.a)]}"/>`;
    if (line === 0) {
      svgBody += `<text class="st-time" x="${x + 6}" y="${yOf(34, line) - 1}" text-anchor="middle">4</text><text class="st-time" x="${x + 6}" y="${yOf(30, line) - 1}" text-anchor="middle">4</text>`;
      x += 22;
    }
    x += 6;
    for (let b = first; b <= last; b++) {
      let tx = x + 8;
      for (const t of byBar[b]) { headX.set(t, tx + 6); tx += tokenW(t); }
      x += barW(b);
      // 마디줄 (마지막 마디는 겹세로줄)
      const y1 = yOf(38, line), y2 = yOf(30, line);
      if (b === bars - 1) svgBody += `<line class="st-bar" x1="${x - 5}" x2="${x - 5}" y1="${y1}" y2="${y2}"/><rect class="st-bar-end" x="${x - 2}" y="${y1}" width="3.4" height="${y2 - y1}"/>`;
      else svgBody += `<line class="st-bar" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>`;
      // 이 마디의 음표·쉼표
      svgBody += barSVG(byBar[b], headX, sig, line);
    }
    // 오선 (줄 끝까지)
    for (let i = 0; i < 5; i++) svgBody = `<line class="st-line" x1="0" x2="${x + (last === bars - 1 ? 1.4 : 0)}" y1="${line * LINE_H + TOP + i * SP}" y2="${line * LINE_H + TOP + i * SP}"/>` + svgBody;
    maxW = Math.max(maxW, x + 2);
  }
  const H = lines * LINE_H;
  el.style.setProperty("--score-lines", lines);
  el.innerHTML = `<svg viewBox="0 0 ${maxW} ${H}" aria-hidden="true">${svgBody}</svg>`;
}

/** 한 마디의 음표·쉼표 SVG */
function barSVG(list, headX, sig, line) {
  let s = "";
  const accNow = new Map();   // 이 마디에서 줄·칸(step)마다 지금 적용 중인 변화 (임시표가 마디 끝까지 이어짐)
  // 빔 묶음: 같은 박 안에서 이어진 8분·점8분·16분음표 (쉼표에서 끊김)
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (const t of list) {
    if (isBeamable(t) && cur.length && Math.floor(cur[0].pos / BEAT) === Math.floor(t.pos / BEAT) && Math.floor((t.pos + t.dur - 1) / BEAT) === Math.floor(t.pos / BEAT)) cur.push(t);
    else { flush(); if (isBeamable(t) && Math.floor((t.pos + t.dur - 1) / BEAT) === Math.floor(t.pos / BEAT)) cur.push(t); }
    if (!isBeamable(t)) flush();
  }
  flush();
  const groupOf = new Map();
  for (const g of groups) for (const t of g) groupOf.set(t, g);

  for (const t of list) {
    const x = headX.get(t), cls = t.cls || "";
    // 쉼표: 가운데 줄 높이에 조금 크게(1.2배)·조금 아래로 — 도형 그대로는 작고 높아 보였음
    if (t.rest) { s += `<path class="st-rest ${cls}" transform="translate(${x},${yOf(34, line) + 2}) scale(1.2)" d="${REST_PATH[t.dur]}"/>`; continue; }
    const n = t.note || { l: 6, a: 0, oct: 4 };   // 음높이가 없으면 가운데 줄 B4 (리듬만 보여 줄 때)
    const step = stepOf(n), y = yOf(step, line);
    // 덧줄
    for (let k = 28; k >= step; k -= 2) s += `<line class="st-ledger ${cls}" x1="${x - 9}" x2="${x + 9}" y1="${yOf(k, line)}" y2="${yOf(k, line)}"/>`;
    for (let k = 40; k <= step; k += 2) s += `<line class="st-ledger ${cls}" x1="${x - 9}" x2="${x + 9}" y1="${yOf(k, line)}" y2="${yOf(k, line)}"/>`;
    // 임시표: 이 마디에서 이 자리에 적용 중인 변화와 다를 때만
    if (t.note) {
      const now = accNow.has(step) ? accNow.get(step) : sigAcc(sig, n.l);
      if (n.a !== now) {
        const d = n.a === 0 ? NATURAL_PATH : ACC_PATH[String(n.a)];
        s += `<path class="st-acc ${cls}" transform="translate(${x - 14},${y})" d="${d}"/>`;
        accNow.set(step, n.a);
      }
    }
    // 머리
    s += t.dur >= 8 ? `<path class="st-head ${cls}" fill-rule="evenodd" d="${hollowHead(x, y)}"/>` : `<path class="st-head ${cls}" d="${solidHead(x, y)}"/>`;
    // 점 (점4분 6 · 점8분 3): 머리 오른쪽, 줄 위의 음이면 바로 위 칸으로
    if (t.dur === 6 || t.dur === 3) s += `<circle class="st-dot ${cls}" cx="${x + 10}" cy="${step % 2 === 0 ? y - HALF : y}" r="1.7"/>`;
    // 기둥·꼬리 (빔 묶음은 아래에서 한꺼번에)
    if (!groupOf.has(t) || groupOf.get(t).length === 1) {
      const down = step >= 34, sx = down ? x - 5.3 : x + 5.3, ey = down ? y + STEM : y - STEM;
      s += `<line class="st-stem ${cls}" x1="${sx}" x2="${sx}" y1="${y}" y2="${ey}"/>`;
      const flags = t.dur <= 1 ? 2 : t.dur <= 3 ? 1 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = down ? ey - f * 7 : ey + f * 7, dir = down ? -1 : 1;
        s += `<path class="st-flag ${cls}" d="M${sx},${fy}C${sx + 1},${fy + dir * 7} ${sx + 9},${fy + dir * 9} ${sx + 7},${fy + dir * 18}C${sx + 7},${fy + dir * 12} ${sx + 3},${fy + dir * 10} ${sx},${fy + dir * 8}Z"/>`;
      }
    }
  }
  // 빔 묶음
  for (const g of groups) if (g.length > 1) s += beamSVG(g, headX, line);
  return s;
}

/** 빔으로 묶은 음표들: 기둥 방향은 가운데 줄에서 가장 먼 음 기준, 빔 기울기는 처음·끝 음의 높이 차를 따르되 완만하게 */
function beamSVG(g, headX, line) {
  const pts = g.map(t => {
    const n = t.note || { l: 6, a: 0, oct: 4 };
    return { t, x: headX.get(t), y: yOf(stepOf(n), line), step: stepOf(n), cls: t.cls || "" };
  });
  const far = pts.reduce((a, p) => (Math.abs(p.step - 34) > Math.abs(a.step - 34) ? p : a), pts[0]);
  const down = far.step >= 34, dir = down ? 1 : -1;
  for (const p of pts) p.sx = down ? p.x - 5.3 : p.x + 5.3;
  const x0 = pts[0].sx, x1 = pts[pts.length - 1].sx;
  const slope = Math.max(-0.18, Math.min(0.18, (pts[pts.length - 1].y - pts[0].y) / (x1 - x0 || 1)));
  // 빔 높이: 모든 기둥이 최소 길이(STEM - 3)를 넘게
  let b0 = down ? -Infinity : Infinity;
  for (const p of pts) {
    const need = p.y + dir * (STEM - 3) - slope * (p.sx - x0);
    b0 = down ? Math.max(b0, need) : Math.min(b0, need);
  }
  const beamY = x => b0 + slope * (x - x0);
  let s = "";
  const cls = pts.every(p => p.cls === pts[0].cls) ? pts[0].cls : "";
  for (const p of pts) s += `<line class="st-stem ${p.cls}" x1="${p.sx}" x2="${p.sx}" y1="${p.y}" y2="${beamY(p.sx)}"/>`;
  const bar = (xa, xb, off) => {
    const ya = beamY(xa) - dir * off, yb = beamY(xb) - dir * off, th = -dir * BEAM_W;
    return `<path class="st-beam ${cls}" d="M${xa},${ya}L${xb},${yb}L${xb},${yb + th}L${xa},${ya + th}Z"/>`;
  };
  s += bar(x0 - 0.6, x1 + 0.6, 0);   // 첫째 빔 (8분)
  // 둘째 빔 (16분): 이어진 16분끼리는 이어서, 혼자인 16분은 짧게(앞 음이 있으면 왼쪽, 없으면 오른쪽)
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].t.dur !== 1) continue;
    const next = pts[i + 1], prev = pts[i - 1];
    if (next && next.t.dur === 1) { s += bar(pts[i].sx - 0.6, next.sx + 0.6, BEAM_GAP); continue; }
    if (prev && prev.t.dur === 1) continue;   // 앞 16분과 이미 이어짐
    const stub = 9;
    if (prev) s += bar(pts[i].sx - stub, pts[i].sx + 0.6, BEAM_GAP);
    else s += bar(pts[i].sx - 0.6, pts[i].sx + stub, BEAM_GAP);
  }
  return s;
}
