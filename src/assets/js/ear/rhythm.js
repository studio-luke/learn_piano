// ===== 청음 연습 — 단음 ③ 멜로디 받아쓰기의 리듬 (순수 함수, 화면 없음 → tests/ear.test.js) =====
// 4/4 한두 마디의 리듬(음표·쉼표 길이와 자리)을 만들고, 음높이를 붙여 문제를 만들어요.
// 규칙은 chordoven-spec.md "청음 연습" ③ (2026-11-24 사용자 결정) — 요약:
//   - 단위: 16분음표 = 1, 한 박 = 4, 한 마디 = 16. 자리(pos)는 마디 안에서 0~15 (1박 시작 = 0)
//   - 어택으로 출제, 표기는 한 가지 (2026-11-24 사용자 결정): 귀로 확실히 들리는 건 음이 시작되는 자리(어택)뿐이라
//     "8분 + 8분쉼표"와 "4분"처럼 소리가 같은 표기가 둘 이상이면 정답이 여러 개가 됨. 그래서
//       1) 어느 자리에서 음이 시작되는지(어택)를 먼저 뽑고 (pickOnsets)
//       2) 정해진 한 가지 방법으로 표기 (notate): 음은 다음 어택(또는 마디 끝)까지 이어진다고 보고, 아래 자리 규칙 안에서
//          가장 긴 음표 하나로 씀. 그 음표로 다 못 채운 부분만 쉼표 — 가장 큰 쉼표부터(점 없이)
//     → 쉼표는 첫 어택 앞(엇박 시작)과 규칙상 음을 더 이어 쓸 수 없는 자리에만 남음. 0.5박의 엇박 음도 4분음표로 이어 씀
//   - 쓰는 길이: 2분(8) · 점4분(6) · 4분(4) · 점8분(3) · 8분(2) · 16분(1) 음표, 4분(4) · 8분(2) · 16분(1) 쉼표.
//     최소 박자(min: 4 = 4분, 2 = 8분, 1 = 16분)의 배수인 길이만 (점4분은 8분 이상, 점8분은 16분일 때)
//   - 박 경계를 넘지 않음. 예외는 아래 NOTE_OK (2분음표 1박→3박, 4분음표 0.5·2.5박, 점4분음표 0·0.5·2·2.5박)
//   - 2분음표는 한 마디에 최대 1개. 2분쉼표·점2분·점16분은 출제 안 함
//   - 쉼표: 4분쉼표는 정박, 8분쉼표는 정박·반박, 16분쉼표는 어디서나. 이어진 쉼표는 3개까지, 합칠 수 있으면 안 됨(mergeable —
//     1·3박에서 시작하는 4분쉼표 둘은 2분쉼표 자리라서 그런 리듬은 다시 뽑음). 점쉼표로 합치는 것은 따지지 않음
//   - 한 마디에서 쉬는 박의 합은 3박 미만. 음표는 문제 전체에서 최소 3개
//   - 첫 어택은 1박 위주, 최소 박자가 8분·16분이면 쉼표로 시작하는 경우를 조금 더
import { pickMelody } from "./theory.js";
import { dictationOverChords } from "./harmony.js";

export const BAR = 16, BEAT = 4;

/** 음표 길이별 놓을 수 있는 자리 (마디 안 pos, 박 경계를 넘는 예외 포함) */
const NOTE_OK = {
  8: p => p === 0 || p === 4 || p === 8,                  // 2분: 1박·3박, 예외로 2박(→ 4박 전까지)
  6: p => p === 0 || p === 2 || p === 8 || p === 10,      // 점4분: 0·0.5·2·2.5박에서만
  4: p => p % 4 === 0 || p === 2 || p === 10,             // 4분: 정박, 예외로 0.5·2.5박(8분-4분-8분)
  3: p => p % 4 <= 1,                                     // 점8분: 박 경계를 넘지 않을 때만 (박 시작·16분 뒤)
  2: p => p % 4 <= 2,                                     // 8분: 한 박 안이면 어디서나 (16분-8분-16분 포함)
  1: () => true,                                          // 16분
};
/** 쉼표 길이별 놓을 수 있는 자리 */
const REST_OK = {
  4: p => p % 4 === 0,                    // 4분쉼표: 정박
  2: p => p % 4 === 0 || p % 4 === 2,     // 8분쉼표: 정박·반박
  1: () => true,                          // 16분쉼표
};
const NOTE_LENS = [8, 6, 4, 3, 2, 1], REST_LENS = [4, 2, 1];   // 긴 것부터 (표기할 때 가장 긴 것을 먼저 시도)

// 어택이 생길 확률 — 자리의 박 세기별 (정박 > 반박 > 16분 자리). 최소 4분·8분, 그리고 최소 16분 + 멜로디 개연성 랜덤
// (2026-11-25 사용자 결정 — 처음 만든 그대로). 최소 16분의 다른 개연성은 아래 한 박 모양 규칙(BEAT16)
// 평균 음표 수가 예전(길이로 뽑던 방식)과 비슷하게 맞춘 값 — 화면에는 비율을 쓰지 않음
const ONSET_P = {
  4: { beat: 0.8 },
  2: { beat: 0.78, half: 0.5 },
  1: { beat: 0.75, half: 0.5, sixteenth: 0.3 },
};
// 문제 맨 처음(1박)에 어택이 있을 확률 — 1박에서 음으로 시작하는 쪽을 더 많이, 8분·16분이면 쉼표로 시작하는 경우를 조금 더
// (2026-11-24 사용자 요청)
const FIRST_ONSET = { 4: 0.97, 2: 0.86, 1: 0.87 };
const MIN_NOTES = 3;           // 문제 전체에서 음표 최소 개수
const MAX_REST_RUN = 3;        // 쉼표가 연달아 나올 수 있는 최대 개수

/**
 * 이어진 쉼표들이 큰 쉼표 하나로 합쳐질 수 있는지 — 점 없는 쉼표(8분·4분·2분)로만 따짐.
 * 2분쉼표는 출제하지 않지만, 1박·3박에서 시작하는 4분쉼표 둘은 2분쉼표로 써야 하는 자리라 합칠 수 있는 것으로 봄
 * @param run  이어진 쉼표들 [{ pos(마디 안), dur }] (앞에서부터)
 */
export function mergeable(run) {
  const total = run.reduce((a, x) => a + x.dur, 0), p = run[0].pos % BAR;
  if (total === 8) return p === 0 || p === 8;
  return (total === 4 || total === 2) && REST_OK[total](p);
}

/**
 * 어택 자리 뽑기 (마디마다, 마디 안 자리 0~15). 최소 박자의 배수 자리만.
 * 최소 4분·8분(그리고 최소 16분 + 개연성 랜덤)은 자리마다 확률로, 최소 16분은 한 박 모양 규칙으로 (pickOnsets16)
 * @returns [Set(pos) × bars]
 */
export function pickOnsets(bars, min, rnd = Math.random, chance = "mid") {
  if (min === 1 && chance !== "random") return pickOnsets16(bars, rnd, chance);
  const P = ONSET_P[min] || ONSET_P[2];
  return Array.from({ length: bars }, (_, b) => {
    const set = new Set();
    for (let p = 0; p < BAR; p += min) {
      const prob = b === 0 && p === 0 ? (FIRST_ONSET[min] ?? 0.9) : p % 4 === 0 ? P.beat : p % 2 === 0 ? P.half : P.sixteenth;
      if (rnd() < prob) set.add(p);
    }
    return set;
  });
}

// ----- 최소 16분: 한 박 모양 규칙 (2026-11-24 사용자 설계) -----
// 한 박을 16분 네 칸(0~3)으로 보고, 그 박에서 어택이 있는 칸의 조합(= 한 박 모양)을 고름. 표기는 notate가 정함
// (박 시작에 어택이 없으면 쉼표로 시작하거나, 앞 음이 이어지는 것으로 적힘 — 규칙은 어택 기준).
//   kind "free"  어디에나 올 수 있는 모양 (4분·8분 모양, [1], [2], [3], [4]-4·5)
//   kind "back"  [4]-1·2·3 (16쉼으로 시작하는 당김): 강박(1·3박)에 못 옴. 앞 박의 마지막 어택에서 1박 안에 첫 어택이
//                와야 함(= 앞 박 둘째 칸 이후에 어택) — 앞 박과 함께 두 박 패턴이 됨
//   kind "pick"  [5] 점8쉼 16 (다음 박으로 들어가는 못갖춘 16분): 다음 박이 함께 두 박 패턴이 됨 — 다음 박에 [5]·빈 박은
//                못 오고, 첫 어택이 0.5박 넘게 늦는 [4]-5·8쉼 8은 낮은 확률로. 문제의 마지막 박에는 못 옴. 강박에도 옴(낮게)
//   w            상대 비중 (흔한 정도: 많이 1.6 · 보통 1 · 적게 0.4~0.6). 박 시작에 어택이 없는 모양은 강박에서 STRONG_EMPTY배
const BEAT16 = [
  { at: [], w: 0.6, kind: "free" },          // 빈 박 (앞 음이 이어지거나 4분쉼표)
  { at: [0], w: 3.5, kind: "free" },         // 4분
  { at: [0, 2], w: 2.5, kind: "free" },      // 8 8
  { at: [2], w: 0.6, kind: "free" },         // 8쉼 8
  { at: [0, 1, 2, 3], w: 1, kind: "free" },  // [1] 16 16 16 16
  { at: [0, 1, 2], w: 1.6, kind: "free" },   // [2]-1 16 16 8
  { at: [0, 1, 3], w: 1, kind: "free" },     // [2]-2 16 8 16
  { at: [0, 2, 3], w: 1.6, kind: "free" },   // [2]-3 8 16 16
  { at: [0, 1], w: 0.5, kind: "free", rare: true },   // [3]-1 16 점8
  { at: [0, 3], w: 1.6, kind: "free" },      // [3]-2 점8 16
  { at: [1, 3], w: 0.5, kind: "back" },      // [4]-1 16쉼 8 16
  { at: [1, 2], w: 0.4, kind: "back", rare: true },   // [4]-2 16쉼 16 8
  { at: [1], w: 0.4, kind: "back", rare: true },      // [4]-3 16쉼 점8
  { at: [1, 2, 3], w: 0.4, kind: "free" },   // [4]-4 16쉼 16 16 16
  { at: [2, 3], w: 0.5, kind: "free" },      // [4]-5 8쉼 16 16
  { at: [3], w: 0.4, kind: "pick" },         // [5] 점8쉼 16
];
const STRONG_EMPTY = 0.2;     // 박 시작에 어택이 없는 모양이 강박에 올 때 비중 배수
const AFTER_PICK_LATE = 0.3;  // [5] 다음 박의 첫 어택이 0.5박 넘게 늦는 모양([4]-5·8쉼 8)의 비중 배수
// 흔한 두 박 패턴 — 반 마디 자리(1·3박)마다 CHUNK_P 확률로 통째로 넣음 (2026-11-24 사용자 지정, 자리는 16분 단위 0~7)
const CHUNKS16 = [
  [0, 1, 3, 5],      // 16 8 16 · 16쉼 점8
  [0, 1, 3, 5, 7],   // 16 8 16 · 16쉼 8 16 (보컬 당김)
  [0, 2, 3, 5, 7],   // 8 16 16 · 16쉼 8 16
  [0, 2, 3, 5],      // 8 16 16 · 16쉼 점8
  [0, 3, 5],         // 점8 16 · 16쉼 점8
  [0, 3, 6],         // 점8 16 · 8쉼 8 (3-3-2)
];
// 멜로디 개연성별 (2026-11-25 사용자 요청): 높을수록 흔한 두 박 패턴이 더 자주(CHUNK_P),
// 잘 안 쓰이는 한 박 모양(rare: [3]-1 16 점8, [4]-2 16쉼 16 8, [4]-3 16쉼 점8)은 덜(RARE_MUL 배).
// 두 박 패턴 안에 든 16쉼 점8은 사용자가 고른 흔한 모양이라 RARE_MUL을 적용하지 않음. "random"은 이 규칙을 안 씀(pickOnsets)
const CHUNK_P = { high: 0.35, mid: 0.25, low: 0.15 };
const RARE_MUL = { high: 0.3, mid: 1, low: 1.3 };
// 한 문제에서 쓰는 "16분이 든 한 박 모양"(16분 자리 1·3칸에 어택이 있는 모양) 종류 수 상한 — 마디 수·멜로디 개연성별
// (2026-11-25 사용자 결정, 없는 칸은 제한 없음). 두 박 패턴 안의 박도 셈. 상한에 닿으면 이미 쓴 16분 모양과 16분 없는
// 모양만 — 고를 게 없는 박만 예외로 상한 무시
const MAX_KINDS16 = { 1: { high: 3, mid: 3 }, 2: { high: 3, mid: 4 } };
// 이미 16분 모양을 하나 이상 썼을 때 새 16분 모양의 비중 배수 — 1마디 높음은 평균 종류 수를 2 가까이로 (사용자 요청)
const NEW_KIND_MUL = { 1: { high: 0.4 } };
const has16 = at => at.some(p => p % 2 === 1);

/** 무게대로 하나 고르기 */
function weighted(items, rnd) {
  const total = items.reduce((a, x) => a + x.w, 0);
  let r = rnd() * total;
  for (const x of items) { if ((r -= x.w) < 0) return x; }
  return items[items.length - 1];
}

/**
 * 최소 16분 어택 뽑기 — 박마다 위 규칙에 맞는 한 박 모양을 고르고, 반 마디 자리엔 가끔 흔한 두 박 패턴을 통째로.
 * 문제 맨 처음 박은 FIRST_ONSET 확률로 박 시작에 어택이 있는 모양 (강박 배수는 적용 안 함)
 */
// 2마디 문제에서 둘째 마디가 첫 마디 리듬을 따라 하기 (최소 16분, 2026-11-25 사용자 결정 — 같은 자리의 박을 그대로).
// 개연성별 [통째로, 세 박, 두 박, 한 박] 확률, 나머지는 따라 하지 않음. 랜덤은 따라 하기 없음(처음 방식).
// 세 박 중 70%는 앞 세 박, 두 박 중 40%는 앞 두 박, 한 박 중 40%는 첫 박 — 나머지는 다른 자리 조합에서 고르게
const COPY16 = { high: [0.10, 0.25, 0.30, 0.20], mid: [0.05, 0.15, 0.25, 0.15], low: [0, 0.05, 0.15, 0.15] };
const COPY_SETS = [
  [[[0, 1, 2, 3]], 1],
  [[[0, 1, 2]], 0.7, [[1, 2, 3], [0, 1, 3], [0, 2, 3]]],
  [[[0, 1]], 0.4, [[0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]],
  [[[0]], 0.4, [[1], [2], [3]]],
];
// 첫 마디가 박 시작 어택 없이(쉼표로) 시작하면 둘째 마디도 그렇게 시작할 확률 (사용자 결정)
const REST_START_AGAIN = 0.8;

/** 둘째 마디에서 따라 할 박 자리(0~3) 고르기 — 없으면 빈 Set */
function pickCopySet(chance, rnd) {
  const P = COPY16[chance] || COPY16.low;
  let r = rnd();
  for (let k = 0; k < P.length; k++) {
    if ((r -= P[k]) >= 0) continue;
    const [front, frontP, others] = COPY_SETS[k];
    const pick = !others || rnd() < frontP ? front[0] : others[Math.floor(rnd() * others.length)];
    return new Set(pick);
  }
  return new Set();
}

function pickOnsets16(bars, rnd, chance = "mid") {
  const chunkP = CHUNK_P[chance] ?? CHUNK_P.mid, rareMul = RARE_MUL[chance] ?? 1;
  const maxKinds = MAX_KINDS16[bars]?.[chance] ?? Infinity, newMul = NEW_KIND_MUL[bars]?.[chance] ?? 1;
  const beats = bars * 4, shapes = [];   // 박마다 어택 칸 배열
  const used = new Set();                // 지금까지 쓴 16분 모양 (어택 칸을 글자로)
  const isNew = at => has16(at) && !used.has(at.join(","));
  const note = at => { if (has16(at)) used.add(at.join(",")); };
  const firstHead = rnd() < FIRST_ONSET[1];   // 맨 처음 박을 박 시작 어택으로 시작할지
  const copy = bars === 2 ? pickCopySet(chance, rnd) : new Set();   // 둘째 마디에서 따라 할 박
  let head2 = null;   // 둘째 마디 첫 박을 박 시작 어택으로 시작할지 (첫 마디가 쉼표로 시작했을 때만 정함)

  /** i번째 박에 올 수 있는 모양인지 — 한 박 모양 규칙 (앞 박·마지막 박·문제 처음) */
  const fits = (s, i) => {
    const strong = i % 2 === 0, prev = shapes[i - 1];
    const afterPick = !!prev && prev.length === 1 && prev[0] === 3;   // 앞 박이 [5] 점8쉼 16
    if (i === 0 && (s.at[0] === 0) !== firstHead) return false;
    if (i === 4 && head2 !== null && (s.at[0] === 0) !== head2) return false;
    if (s.kind === "back" && (strong || !prev || !prev.length || Math.max(...prev) < 1)) return false;
    if (s.kind === "pick" && i === beats - 1) return false;
    if (afterPick && (s.kind === "pick" || !s.at.length)) return false;
    return true;
  };
  const shapeOf = at => BEAT16.find(s => s.at.join(",") === at.join(","));

  for (let i = 0; i < beats; i++) {
    if (i === 4 && shapes[0][0] !== 0) {   // 첫 마디가 쉼표로 시작 → 둘째 마디도 80%
      head2 = rnd() >= REST_START_AGAIN;
      if (head2) copy.delete(0);           // 박 시작 어택으로 시작하기로 했으면 첫 박은 따라 하지 않음
    }
    // 첫 마디 같은 자리의 박을 따라 함 — 앞뒤 박과 규칙이 맞지 않으면 그 박만 새로 고름
    if (i >= 4 && copy.has(i - 4)) {
      const s = shapeOf(shapes[i - 4]);
      if (s && fits(s, i)) { shapes.push(s.at); continue; }
    }
    const strong = i % 2 === 0, prev = shapes[i - 1];
    // 흔한 두 박 패턴 (모두 박 시작 어택으로 시작 — 쉼표로 시작할 맨 처음 박·둘째 마디 첫 박엔 안 넣음, 따라 할 박 자리엔 안 넣음)
    const free2 = !(i >= 4 && (copy.has(i - 4) || copy.has(i - 3)));
    if (strong && free2 && (i > 0 || firstHead) && !(i === 4 && head2 === false) && rnd() < chunkP) {
      const c = CHUNKS16[Math.floor(rnd() * CHUNKS16.length)];
      const pair = [c.filter(p => p < 4), c.filter(p => p >= 4).map(p => p - 4)];
      const fresh = new Set(pair.filter(isNew).map(at => at.join(","))).size;
      if (used.size + fresh <= maxKinds) {   // 종류 상한을 넘기면 이 자리는 한 박씩 고름
        pair.forEach(note);
        shapes.push(...pair);
        i++;
        continue;
      }
    }
    const afterPick = !!prev && prev.length === 1 && prev[0] === 3;
    const allowed = BEAT16.filter(s => fits(s, i)).map(s => {
      let w = s.w * (s.rare ? rareMul : 1);
      if (afterPick && s.at[0] >= 2) w *= AFTER_PICK_LATE;
      if (strong && i > 0 && !(i === 4 && head2 !== null) && s.at[0] !== 0) w *= STRONG_EMPTY;   // 둘째 마디 첫 박을 정해 뒀으면 배수 없음
      if (used.size && isNew(s.at)) w *= newMul;
      return { ...s, w };
    });
    const capped = used.size >= maxKinds ? allowed.filter(s => !isNew(s.at)) : allowed;
    const at = weighted(capped.length ? capped : allowed, rnd).at;
    note(at);
    shapes.push(at);
  }
  return Array.from({ length: bars }, (_, b) =>
    new Set(shapes.slice(b * 4, b * 4 + 4).flatMap((at, k) => at.map(p => k * BEAT + p))));
}

/**
 * 어택 → 표기 (한 가지로 정해진 방법). 음은 다음 어택(없으면 마디 끝)까지 이어진다고 보고 자리 규칙 안에서 가장 긴
 * 음표 하나로, 남는 부분과 첫 어택 앞은 가장 큰 쉼표부터. 최소 박자보다 짧은 길이는 쓰지 않음
 * @param onsets  [Set(pos) × bars]
 * @returns [{ pos: 문제 처음부터의 자리, dur, rest }]
 */
export function notate(onsets, min) {
  const out = [];
  const fits = d => d % min === 0;
  const rests = (from, to, base) => {   // [from, to) 마디 안 자리를 쉼표로 (가장 큰 것부터)
    let p = from;
    while (p < to) {
      const d = REST_LENS.find(L => fits(L) && p + L <= to && REST_OK[L](p)) || 1;
      out.push({ pos: base + p, dur: d, rest: true });
      p += d;
    }
  };
  onsets.forEach((set, b) => {
    const base = b * BAR, starts = [...set].sort((x, y) => x - y);
    rests(0, starts.length ? starts[0] : BAR, base);
    starts.forEach((p, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : BAR;
      const d = NOTE_LENS.find(L => fits(L) && p + L <= end && NOTE_OK[L](p)) || min;
      out.push({ pos: base + p, dur: d, rest: false });
      rests(p + d, end, base);
    });
  });
  return out;
}

/**
 * 리듬 만들기 — 어택을 뽑고(pickOnsets) 표기한 뒤(notate), 규칙(rhythmProblem)에 맞지 않으면 다시 뽑음.
 * @param bars  마디 수 (1 · 2)
 * @param min   최소 박자 (4 = 4분, 2 = 8분, 1 = 16분)
 * @param chance  멜로디 개연성 "high" | "mid" | "low" | "random" — 최소 16분일 때 한 박 모양 규칙의 비중에 씀, "random"이면 자리별 확률(처음 방식)
 * @returns [{ pos, dur, rest }] — 음표·쉼표가 순서대로, 마디를 빈틈없이 채움
 */
export function generateRhythm(bars = 1, min = 2, rnd = Math.random, chance = "mid") {
  for (let tries = 0; tries < 300; tries++) {
    const r = notate(pickOnsets(bars, min, rnd, chance), min);
    if (!rhythmProblem(r, min, bars)) return r;
  }
  // 거의 일어나지 않지만, 못 만들면 4분음표로 채움
  return Array.from({ length: bars * 4 }, (_, i) => ({ pos: i * BEAT, dur: BEAT, rest: false }));
}

/**
 * 리듬 하나가 규칙에 맞는지 (생성·테스트·답 확인용).
 * @returns 맞으면 "", 아니면 어긋난 이유 글자
 */
export function rhythmProblem(tokens, min = 1, bars = 1) {
  let p = 0;
  for (let i = 0; i < tokens.length; i++) {
    const x = tokens[i], local = x.pos % BAR;
    if (x.pos !== p) return `gap at ${p}`;
    if (x.dur % min !== 0) return `too short ${x.dur}`;
    if (local + x.dur > BAR) return `crosses barline at ${x.pos}`;
    if (x.rest ? !REST_OK[x.dur]?.(local) : !NOTE_OK[x.dur]?.(local)) return `bad place ${x.rest ? "rest" : "note"} ${x.dur} at ${local}`;
    if (x.rest) {
      // 이어진 쉼표: 최대 3개, 어느 이어진 부분도 합칠 수 있으면 안 됨
      let k = i; while (k > 0 && tokens[k - 1].rest && Math.floor(tokens[k - 1].pos / BAR) === Math.floor(x.pos / BAR)) k--;
      if (i - k + 1 > MAX_REST_RUN) return `more than ${MAX_REST_RUN} rests in a row at ${x.pos}`;
      for (let a = k; a < i; a++) {
        if (mergeable(tokens.slice(a, i + 1).map(t => ({ pos: t.pos % BAR, dur: t.dur })))) return `mergeable rests at ${tokens[a].pos}`;
      }
    }
    p += x.dur;
  }
  if (p !== bars * BAR) return `length ${p}`;
  for (let b = 0; b < bars; b++) {
    const inBar = tokens.filter(x => Math.floor(x.pos / BAR) === b);
    if (inBar.filter(x => !x.rest && x.dur === 8).length > 1) return `two halves in bar ${b}`;
    if (inBar.filter(x => x.rest).reduce((a, x) => a + x.dur, 0) >= 3 * BEAT) return `rests ≥ 3 beats in bar ${b}`;
  }
  if (tokens.filter(x => !x.rest).length < MIN_NOTES) return "fewer than 3 notes";
  return "";
}

/**
 * 표기가 "한 가지로 정해진 방법"인지 — 음표 바로 뒤의 쉼표 자리까지 그 음표를 규칙 안에서 더 길게 쓸 수 있으면 아님
 * (예: 8분 + 8분쉼표가 4분음표 자리면 false). 테스트·답 확인용
 */
export function isCanonical(tokens, min = 1) {
  for (let i = 0; i + 1 < tokens.length; i++) {
    const x = tokens[i];
    if (x.rest || !tokens[i + 1].rest) continue;
    let end = x.pos + x.dur;
    for (let k = i + 1; k < tokens.length && tokens[k].rest && Math.floor(tokens[k].pos / BAR) === Math.floor(x.pos / BAR); k++) end = tokens[k].pos + tokens[k].dur;
    const local = x.pos % BAR, room = end - x.pos;
    if (NOTE_LENS.some(L => L > x.dur && L % min === 0 && L <= room && NOTE_OK[L](local))) return false;
  }
  return true;
}

/**
 * 받아쓰기 문제: 리듬 + 음표마다 음높이.
 *   멜로디 개연성(chance) "high"·"mid"·"low" → 코드 진행 위의 멜로디(harmony.js), "random" → ②의 멜로디 규칙(theory.js pickMelody)
 * @returns [{ pos, dur, rest, note?: { l, a, oct, midi } }] — 코드 위 멜로디면 배열에 chords(진행)도 붙임
 */
export function makeDictation(key, opt = {}, { bars = 1, min = 2, chance = "random" } = {}, rnd = Math.random) {
  const rhythm = generateRhythm(bars, min, rnd, chance);
  if (chance !== "random") {
    const r = dictationOverChords(key, rhythm, bars, chance, !!opt.chromatic, rnd);
    if (r) return Object.assign(r.tokens, { chords: r.chords });
  }
  const pitches = pickMelody(key, opt, rnd, rhythm.filter(x => !x.rest).length);
  let i = 0;
  return rhythm.map(x => (x.rest ? x : { ...x, note: pitches[i++] }));
}

/**
 * 답 한 칸 채점 (단음 ③ — 순서대로 한 칸씩).
 * @param target  정답 토큰 { dur, rest, note? }
 * @param input   입력 { rest: 쉼표 버튼인지, dur: 길이(16분 단위 — 점이 붙으면 1.5배라 12·6·3·1.5), midi?: 누른 건반 }
 * @param write   받아쓸 것 "both"(음높이와 리듬) | "pitch"(음높이만 — 길이는 보지 않음) | "rhythm"(리듬만 — 음높이는 보지 않음)
 * @returns "ok" | "len"(음은 맞고 길이가 다름) | "pitch"(길이는 맞고 음이 다름) | "octUp" | "octDown"(길이는 맞고 음이름만 맞음) | "no"
 *   쉼표 자리에 음표, 음표 자리에 쉼표는 늘 "no" (2026-11-24 사용자 결정). 점2분·점16분·2분쉼표·점쉼표는 정답 길이가 될 수 없어 늘 틀림
 */
export function judgeToken(target, input, write = "both") {
  if (!!target.rest !== !!input.rest) return "no";
  const lenOk = write === "pitch" || input.dur === target.dur;
  if (target.rest) return lenOk ? "ok" : "no";
  if (write === "rhythm") return lenOk ? "ok" : "no";
  const d = input.midi - target.note.midi;
  const pitch = d === 0 ? "ok" : d % 12 === 0 ? (d < 0 ? "octUp" : "octDown") : "no";
  if (pitch === "ok") return lenOk ? "ok" : "len";
  if (!lenOk) return "no";
  return pitch === "no" ? "pitch" : pitch;
}
