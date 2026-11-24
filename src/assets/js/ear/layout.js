// ===== 청음 연습 — 리듬 악보의 마디 안 배치 (순수 함수, 화면 없음 → tests/ear.test.js) =====
// score.js(그리기)와 rhythm.js(출제 — 마디에 다 들어가는지 확인)가 함께 씀.
// 배치 규칙 (2026-11-25 사용자 요청 — 임시표가 옆 음표와 겹쳐서):
//   - 기본은 시간 비례(16분 하나 = COL). 그런데 앞 음(머리·점·꼬리)과 이 음(머리·임시표)이 겹치면 겹치지 않을 만큼 오른쪽으로
//     밀고, 그 뒤 음은 다시 시간 비례 자리로 돌아올 수 있으면 돌아옴 → 긴 음 뒤의 빈 공간을 줄여서 맞춤
//   - 앞에서부터 차례로 정함: 어떤 음의 자리는 그 음과 앞 음들만 보고 정해져서, 받아쓰는 중에 뒤에 올 음을 적어도
//     이미 적은 음이 움직이지 않고, 아직 안 적은 음(임시표 유무 등)이 간격으로 드러나지 않음
//   - 마디를 넘칠 만큼 빽빽한 문제는 출제하지 않음 (fitsBar — rhythm.js makeDictation이 다시 뽑음)
import { sigAcc } from "./theory.js";

export const COL = 15;                     // 16분음표 하나의 폭 (시간 비례 배치)
export const BAR_PAD = 14;                 // 마디 안 왼쪽 여백 (마디줄과 첫 음 사이 — 시간 비례 자리)
export const BAR_W = BAR_PAD + 16 * COL + 6;   // 마디 폭 (늘 같음)
const BAR = 16, BEAT = 4;
const GAP = 2;                             // 앞 음의 오른쪽 끝과 이 음의 왼쪽 끝 사이 최소 틈
const ACC_LEFT = 19;                       // 임시표가 있는 음의 왼쪽 끝 (머리 가운데에서 — 임시표는 머리 14 왼쪽, 폭 ~9)

const stepOf = n => n.oct * 7 + n.l;
export const isBeamable = t => !t.rest && t.dur <= 3;   // 8분·점8분·16분

/** 빔 묶음: 같은 박 안에서 이어진 8분·점8분·16분음표 (쉼표·박을 넘는 음에서 끊김) → [[토큰]] */
export function beamGroups(list) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  const inBeat = t => Math.floor((t.pos + t.dur - 1) / BEAT) === Math.floor(t.pos / BEAT);
  for (const t of list) {
    if (isBeamable(t) && cur.length && Math.floor(cur[0].pos / BEAT) === Math.floor(t.pos / BEAT) && inBeat(t)) cur.push(t);
    else { flush(); if (isBeamable(t) && inBeat(t)) cur.push(t); }
    if (!isBeamable(t)) flush();
  }
  flush();
  return groups;
}

/**
 * 마디 안에서 임시표를 붙일 음 — 조표와 다르거나, 같은 마디 앞 음의 임시표와 다를 때 (같은 줄·칸마다 마디 끝까지 이어짐)
 * @returns Map(토큰 → 붙일 변화 a)
 */
export function shownAccidentals(list, sig) {
  const accNow = new Map(), out = new Map();
  for (const t of list) {
    if (t.rest || !t.note) continue;
    const step = stepOf(t.note), now = accNow.has(step) ? accNow.get(step) : sigAcc(sig, t.note.l);
    if (t.note.a !== now) { out.set(t, t.note.a); accNow.set(step, t.note.a); }
  }
  return out;
}

/** 머리 가운데에서 왼쪽·오른쪽으로 차지하는 폭 */
function extents(t, acc, flagged) {
  if (t.rest) return { left: t.dur === 4 ? 4 : 6, right: t.dur === 4 ? 6 : 7 };
  const n = t.note || { l: 6, a: 0, oct: 4 }, up = stepOf(n) < 34;   // 가운데 줄보다 낮으면 기둥이 위로 (꼬리가 오른쪽으로 나옴)
  let right = 6;
  if (t.dur === 6 || t.dur === 3) right = 12;          // 점
  if (flagged && up) right = Math.max(right, 15);      // 꼬리 (빔으로 안 묶인 8분·16분)
  return { left: acc ? ACC_LEFT : 6, right };
}

/**
 * 한 마디 배치 — 토큰마다 마디 시작에서의 머리 x.
 * @param list      이 마디의 토큰들 (자리 순서, { pos, dur, rest, note? })
 * @param extraAcc  임시표가 붙는 것으로 칠 토큰 (Set — 입력 자리 미리 보기용, 보통 없음)
 * @returns { x: Map(토큰 → x), at(pos, acc): 이 마디의 pos 자리에 다음 음을 놓으면 그 x (입력 자리·흐린 음표용),
 *            right: 마지막 토큰의 오른쪽 끝 }
 */
export function layoutBar(list, sig, extraAcc = null) {
  const accs = shownAccidentals(list, sig);
  if (extraAcc) for (const t of extraAcc) accs.set(t, 0);
  const flagged = new Set();
  for (const g of beamGroups(list)) if (g.length === 1) flagged.add(g[0]);
  const x = new Map();
  let prevX = 0, prevRight = 0, first = true;
  const place = (pos, left) => Math.max(BAR_PAD + (pos % BAR) * COL, first ? left + 3 : prevX + prevRight + left + GAP);
  for (const t of list) {
    const e = extents(t, accs.has(t), flagged.has(t));
    const tx = place(t.pos, e.left);
    x.set(t, tx);
    prevX = tx; prevRight = e.right; first = false;
  }
  return {
    x,
    // pos 자리에 다음 음을 놓을 때의 x — 그 자리에 토큰이 있으면 그 x, 없으면 그보다 앞 토큰들 뒤에 이어서
    at(pos, acc = false) {
      const here = list.find(t => t.pos === pos);
      if (here) return x.get(here);
      const before = list.filter(t => t.pos < pos);
      const probe = { pos, dur: 1, rest: false, note: null, probe: true };
      const lay = layoutBar([...before, probe], sig, acc ? new Set([probe]) : null);
      return lay.x.get(probe);
    },
    right: first ? 0 : prevX + prevRight,
  };
}

/** 문제(모든 마디)가 마디 폭 안에 들어가는지 — 빽빽해서 마디줄을 넘으면 false */
export function fitsBar(tokens, sig) {
  const bars = Math.ceil(Math.max(...tokens.map(t => t.pos + t.dur)) / BAR);
  for (let b = 0; b < bars; b++) {
    const list = tokens.filter(t => Math.floor(t.pos / BAR) === b);
    if (layoutBar(list, sig).right > BAR_W - 4) return false;
  }
  return true;
}
