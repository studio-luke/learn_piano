// ===== 청음 연습 — 코드 위의 멜로디 (단음 ③ "멜로디 개연성" 높음·중간·낮음, 순수 함수 → tests/ear.test.js) =====
// 말이 되는 멜로디를 위해 코드 진행을 먼저 정하고, 그 코드에 맞춰 음을 확률로 골라요. 규칙은 chordoven-spec.md "청음 연습" ③
// "멜로디 개연성" (2026-11-24 사용자 결정) — 요약:
//   1) 진행 (makeProgression): 머니코드 패턴(코드 초견 improv/grammar.js와 같은 목록, 1~6도만)에서 필요한 개수만큼 연속으로.
//      "조 밖의 음 포함"이면 세컨더리 도미넌트·리딩톤 디미니시드·Related II–V를 앞 자리에 끼워 넣고, 모달 인터체인지로 바꿈
//   2) 코드 종류는 7화음만 (M7 · 7 · m7 · m7(♭5) · 7sus4 · mM7(4도에만) · °7)
//   3) 멜로디 (melodyOverChords): 음마다 화성음 / 비화성음 / 어보이드 노트. 화성음 확률은 앞 음에 따라(비화성음 뒤 더 높게),
//      비화성음 뒤는 순차 우선, 어보이드 노트는 강박에 안 오고 다음은 반드시 순차 화성음, 순차 > 도약, 같은 음 반복 드물게, 옥타브 이내
// 음은 { l(글자 0~6), a(변화), oct } — theory.js와 같은 모양. 조 밖 코드의 음은 그 코드의 철자대로(C장조 E7의 G♯).
import { keyNotes, pcOf, midiOf, scaleMidis, LOW, HIGH } from "./theory.js";

// ---------- 코드 ----------
// 코드 종류: 구성음 [반음, 글자 차이] (근음부터)
const TYPES = {
  M7: [[0, 0], [4, 2], [7, 4], [11, 6]],
  "7": [[0, 0], [4, 2], [7, 4], [10, 6]],
  m7: [[0, 0], [3, 2], [7, 4], [10, 6]],
  m7b5: [[0, 0], [3, 2], [6, 4], [10, 6]],
  "7sus4": [[0, 0], [5, 3], [7, 4], [10, 6]],
  mM7: [[0, 0], [3, 2], [7, 4], [11, 6]],
  dim7: [[0, 0], [3, 2], [6, 4], [9, 6]],
};
export const TYPE_NAMES = { M7: "M7", "7": "7", m7: "m7", m7b5: "m7(♭5)", "7sus4": "7sus4", mM7: "mM7", dim7: "°7" };

/** 근음 { l, a }에서 반음 semis·글자 letters만큼 위의 음 철자 */
function above(root, semis, letters) {
  const l = (root.l + letters) % 7;
  const want = (pcOf(root) + semis) % 12;
  let a = want - pcOf({ l, a: 0 });
  if (a > 6) a -= 12;
  if (a < -6) a += 12;
  return { l, a };
}

/**
 * 코드 하나 만들기.
 * @param root   근음 { l, a }
 * @param type   TYPES의 이름
 * @param avoid  어보이드 노트 (근음에서 반음 수 목록)
 * @returns { root, type, tones: [{l,a}], pcs: Set, avoid: Set(pc), name }
 */
function chord(root, type, avoid = []) {
  const tones = TYPES[type].map(([s, k]) => above(root, s, k));
  const name = "CDEFGAB"[root.l] + (root.a > 0 ? "♯".repeat(root.a) : "♭".repeat(-root.a)) + TYPE_NAMES[type];
  return { root, type, tones, pcs: new Set(tones.map(pcOf)), avoid: new Set(avoid.map(s => (pcOf(root) + s) % 12)), name };
}

// 다이아토닉 코드 (도수 1~6): [종류, 어보이드(반음)] — 사용자 결정 2026-11-24 (IIm7의 13은 어보이드가 아님)
const DIATONIC = {
  major: { 1: ["M7", [5]], 2: ["m7", []], 3: ["m7", [1, 8]], 4: ["M7", []], 5: ["7", [5]], 6: ["m7", [8]] },
  minor: { 1: ["m7", [8]], 2: ["m7b5", [1]], 3: ["M7", [5]], 4: ["m7", []], 5: ["7", [5]], 6: ["M7", []] },
};

/** 조의 d도 다이아토닉 코드 (단조 5도는 V7 · 가끔 자연단음계 Vm7, 5도는 가끔 7sus4) */
function diatonic(key, d, rnd) {
  const { scale } = keyNotes(key);
  const mode = key.minor ? "minor" : "major";
  let [type, avoid] = DIATONIC[mode][d];
  let root = scale[d - 1];
  if (d === 5) {
    const r = rnd();
    if (key.minor && r < 0.3) { type = "m7"; avoid = [1, 8]; }        // v — 자연단음계 (사용자 결정)
    else if (r > 0.75) { type = "7sus4"; avoid = [4]; }              // V7sus4 — 3음이 어보이드
  }
  return { ...chord(root, type, avoid), degree: d };
}

// 머니코드 패턴 (도수) — 코드 초견 improv/grammar.js PATTERNS의 난이도 0·1 목록에서 1~6도만인 것 (7도가 든 단조 패턴은 뺌)
const MONEY = {
  major: ["1-5-6-4", "6-4-1-5", "1-6-4-5", "1-6-2-5", "4-5-3-6", "2-5-1", "3-6-2-5", "4-5-6", "1-5-6-3-4-1-4-5", "1-5-6-1-4-1-2-5",
    "4-3-2-1", "1-5-6-3", "4-1-2-5", "6-2-5-1", "2-5-1-6", "2-4-6-5", "6-3-4-1", "4-2-6-5", "6-4-2-5"],
  minor: ["2-5-1", "4-5-1", "1-3-4-5"],
};
// 단조는 장조 패턴도 같은 도수로 씀 (코드 초견과 같음)
MONEY.minor.push(...MONEY.major);

/** 몇 마디·개연성 → 코드 개수 (높음 마디당 1 · 중간 2 · 낮음 4) */
export const PER_BAR = { high: 1, mid: 2, low: 4 };

/**
 * 코드 진행 만들기.
 * @param n          코드 개수
 * @param chromatic  "조 밖의 음 포함" — 켜면 끼워 넣기·모달 인터체인지
 * @returns [chord × n]
 */
export function makeProgression(key, n, chromatic = false, rnd = Math.random) {
  // 조 밖의 음을 허용하면 조 밖 코드가 하나 이상 들어간 진행만 (2026-11-25 사용자 결정 — 개연성 높음·중간에서 코드가 적어
  // 조 밖 코드가 거의 안 나오던 문제). 맞을 때까지 진행부터 다시 뽑아서 끼워 넣기 종류의 비율은 그대로.
  // 끝내 못 만들면(단조 + 코드 하나처럼 끼워 넣을 자리가 없을 때) 마지막 진행을 그대로
  let prog;
  for (let tries = 0; tries < 80; tries++) {
    prog = diatonicProgression(key, n, rnd);
    if (!chromatic) return prog;
    insertChromatic(key, prog, rnd);
    if (prog.some(c => c.chromatic)) return prog;
  }
  return prog;
}

/** 머니코드 패턴에서 n개를 이어서 (다이아토닉만) */
function diatonicProgression(key, n, rnd) {
  const pats = MONEY[key.minor ? "minor" : "major"];
  const degs = pats[Math.floor(rnd() * pats.length)].split("-").map(Number);
  const start = rnd() < 0.6 ? 0 : Math.floor(rnd() * degs.length);   // 패턴 처음부터를 더 많이
  return Array.from({ length: n }, (_, i) => diatonic(key, degs[(start + i) % degs.length], rnd));
}

/**
 * 조 밖의 코드 끼워 넣기 (사용자 결정 2026-11-24 — 끼워넣기 방식). 앞 자리를 바꾸는 방식이라 코드 개수는 그대로:
 *   - 세컨더리 도미넌트: x 앞 자리를 V7/x로 (x가 m7(♭5)·°7이 아니고, V7/x가 원래 다이아토닉 V7이 아닐 때)
 *   - 리딩톤 디미니시드: x 앞 자리를 x 근음 반음 아래의 °7로
 *   - Related II–V: x 앞 두 자리를 IIm7(x가 단조 코드면 IIm7(♭5)) – V7/x로
 *   - 모달 인터체인지(장조): IV → IVm7·IVmM7, VI → ♭VIM7, V → ♭VII7
 * 한 번에 조 밖 코드가 하나도 안 생기기도 함 (확률) — makeProgression이 생길 때까지 다시 뽑음
 */
function insertChromatic(key, prog, rnd) {
  const { scale } = keyNotes(key);
  if (key.minor && prog.length === 1) return minorSingle(scale[0], prog, rnd);
  for (let i = prog.length - 1; i >= 1; i--) {
    const x = prog[i];
    if (x.chromatic || prog[i - 1].chromatic || x.type === "m7b5" || x.type === "dim7") continue;
    const r = rnd();
    if (r < 0.28) {
      const v = chord(above(x.root, 7, 4), "7", [5]);
      if (pcOf(v.root) !== pcOf(scale[4]) || key.minor) prog[i - 1] = { ...v, chromatic: true };   // V7/x (원래 V7이면 그대로)
    } else if (r < 0.4) {
      prog[i - 1] = { ...chord(above(x.root, 11, 6), "dim7"), chromatic: true };                  // °7 (x 반음 아래)
    } else if (r < 0.55 && i >= 2 && !prog[i - 2].chromatic) {
      const minorTarget = x.type === "m7" || x.type === "mM7";
      prog[i - 2] = { ...chord(above(x.root, 2, 1), minorTarget ? "m7b5" : "m7", minorTarget ? [1] : []), chromatic: true };   // Related II
      prog[i - 1] = { ...chord(above(x.root, 7, 4), "7", [5]), chromatic: true };                                             // V7/x
      i--;
    }
  }
  if (!key.minor) prog.forEach((c, i) => {
    if (c.chromatic || rnd() >= 0.3) return;
    if (c.degree === 4) prog[i] = { ...chord(c.root, rnd() < 0.5 ? "m7" : "mM7"), chromatic: true, degree: 4 };   // IVm7 · IVmM7
    else if (c.degree === 6) prog[i] = { ...chord(above(scale[0], 8, 5), "M7"), chromatic: true };                 // ♭VIM7
    else if (c.degree === 5) prog[i] = { ...chord(above(scale[0], 10, 6), "7", [5]), chromatic: true };            // ♭VII7
  });
}

// 단조 + 코드 하나(1마디 · 개연성 높음)는 끼워 넣을 앞 자리가 없어서, 그 코드를 같은 근음의 세컨더리 도미넌트나
// 모달 인터체인지 코드로 바꿈 (2026-11-25 사용자 결정). 도수별 후보 [반음(으뜸음부터), 글자, 종류, 어보이드] —
// 5도(V7은 이미 화성단음계)·6도는 후보가 없어서 makeProgression이 진행을 다시 뽑음
const MINOR_SINGLE = {
  1: [[0, 0, "M7", [5]], [0, 0, "7", [5]]],                    // IM7(피카르디) · I7(V7/iv)
  2: [[2, 1, "m7", []], [2, 1, "7", [5]], [1, 1, "M7", []]],   // IIm7(도리안) · II7(V7/V) · ♭IIM7(나폴리)
  3: [[3, 2, "7", [5]]],                                       // III7(V7/VI)
  4: [[5, 3, "7", [5]]],                                       // IV7(도리안)
};
function minorSingle(tonic, prog, rnd) {
  const c = prog[0], opts = MINOR_SINGLE[c.degree];
  if (!opts) return;
  const [semis, letters, type, avoid] = opts[Math.floor(rnd() * opts.length)];
  prog[0] = { ...chord(above(tonic, semis, letters), type, avoid), chromatic: true, degree: c.degree };
}

// ---------- 멜로디 ----------
// 화성음이 올 확률: 앞 음이 화성음 / 비화성음 하나 / 비화성음 둘 이상 (사용자 제안 — 비화성음이 이어질수록 화성음으로 돌아옴)
const P_CHORD = [0.6, 0.85, 0.97];
// 음정(반음)별 가중치: 순차 > 도약, 같은 음 드물게, 옥타브까지
const STEP_W = s => (s === 0 ? 0.15 : s <= 2 ? 1 : s <= 4 ? 0.75 : s <= 7 ? 0.45 : s <= 11 ? 0.2 : s === 12 ? 0.08 : 0);
const AFTER_NCT_STEP = 2.5;   // 비화성음 다음 음은 순차(반음 1~2개)일 가중치 배수
const AVOID_W = 0.5;          // 비화성음 중 어보이드 노트의 가중치 배수 (나오면 반드시 해결)
// 방향성 (2026-11-25 사용자 결정 — 멜로디 다듬기 ② 1단계). 앞 음정(prev2 → prev)을 보고 다음 음정의 가중치를 곱함:
//   - 도약 후 반진행(gap-fill): 완전4도(5반음) 이상 도약한 뒤 반대 방향 순차는 ×GAP_FILL(6도 이상 도약이면 ×GAP_FILL_BIG),
//     같은 방향 순차는 ×0.5, 같은 방향으로 또 도약(3반음 이상)은 안 함 — 앞 세 음과 이 음이 모두 지금 코드 구성음이면
//     (아르페지오) ×ARP_W로 허용
//   - 관성: 순차로 가던 방향으로 또 순차면 ×INERTIA
//   - 어색한 도약: 증4도 ×0.25, 단7·장7도 ×0.3
//   - 도약 뒤 반대 방향으로 또 도약해서 비화성음 ×OPP_LEAP_NCT (2026-11-25 사용자 결정)
const LEAP = 5, GAP_FILL = 3, GAP_FILL_BIG = 5, ARP_W = 0.4, INERTIA = 1.4, OPP_LEAP_NCT = 0.4;
const AWKWARD = { 6: 0.25, 10: 0.3, 11: 0.3 };
// 한 문제의 음역: 가장 높은 음과 가장 낮은 음이 완전11도(17반음) 이내 (2026-11-25 사용자 결정) — 벗어나는 음은 후보에서 뺌
const RANGE = 17;

// 윤곽 (2026-11-25 사용자 결정): 문제마다 하나를 골라 그 모양 쪽으로 약하게 끎. 점 [문제 안 위치 0~1, 높이 0~1]을 이은 선이
// 목표 높이가 되고, 음 후보마다 목표에서 멀수록 가중치를 exp(−거리/세기)로 줄임 (반드시 따라가지는 않음 — 다른 규칙과 함께).
// "free"는 끌지 않음(예전과 같음). w = 고를 비중
export const CONTOURS = {
  arch:   { w: 28, pts: [[0, 0.15], [0.6, 1], [1, 0.4]] },                              // 아치: 올라갔다 내려옴
  desc:   { w: 22, pts: [[0, 1], [1, 0.1]] },                                          // 하행
  asc:    { w: 18, pts: [[0, 0.1], [1, 1]] },                                          // 상행 (빌드업)
  valley: { w: 10, pts: [[0, 0.85], [0.55, 0], [1, 0.7]] },                            // 역아치
  M:      { w: 5, pts: [[0, 0.2], [0.25, 1], [0.5, 0.45], [0.75, 1], [1, 0.2]] },     // M형
  W:      { w: 5, pts: [[0, 0.8], [0.25, 0], [0.5, 0.55], [0.75, 0], [1, 0.8]] },     // W형
  free:   { w: 12, pts: null },                                                        // 끌지 않음
};
const CONTOUR_S = { high: 3, mid: 4.5, low: 7 };   // 끄는 세기 (작을수록 셈) — 개연성이 높을수록 모양이 뚜렷
const CONTOUR_SPAN = { 1: 7, 2: 10 };              // 목표 선의 높낮이 폭 (반음) — 1마디는 좁게

/** 윤곽 하나 고르기 → { name, pts, base(목표 선의 가장 낮은 midi), span, s } */
export function pickContour(key, bars, chance, rnd = Math.random) {
  const names = Object.keys(CONTOURS);
  const name = weighted(names, names.map(k => CONTOURS[k].w), rnd);
  const span = CONTOUR_SPAN[bars] ?? 10;
  const base = scaleMidis(key)[0] + 5 - span / 2 + Math.round(rnd() * 4 - 2);   // 가운데쯤 (조마다 조금씩 위아래로)
  return { name, pts: CONTOURS[name].pts, base: Math.max(LOW + 2, Math.min(HIGH - 2 - span, base)), span, s: CONTOUR_S[chance] ?? 4.5 };
}

/** 윤곽 목표 높이 (midi) — t: 문제 안 위치 0~1 */
function contourAt(c, t) {
  const p = c.pts;
  let k = 0;
  while (k < p.length - 2 && t > p[k + 1][0]) k++;
  const [t0, v0] = p[k], [t1, v1] = p[k + 1];
  return c.base + c.span * (v0 + (v1 - v0) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0))));
}

/** 코드 위에서 고를 수 있는 음: 조의 음계(단조는 자연단음계) 글자마다, 코드 구성음과 글자가 같으면 코드 철자로 바꿈 → F3~F5 모든 옥타브 */
function notesFor(key, ch) {
  const { scale } = keyNotes(key);
  const letters = scale.map(n => ch.tones.find(t => t.l === n.l) || n);
  const out = [];
  for (const n of letters) for (let oct = 2; oct <= 6; oct++) {
    const note = { l: n.l, a: n.a, oct }, m = midiOf(note);
    if (m >= LOW && m <= HIGH) out.push({ ...note, midi: m, pc: pcOf(n) });
  }
  return out;
}

function weighted(items, ws, rnd) {
  const total = ws.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

/**
 * 리듬 위에 코드에 맞는 음높이 붙이기.
 * @param rhythm  [{ pos, dur, rest }] (rhythm.js)
 * @param chords  코드 진행, 코드 하나의 길이 = slot (16분 단위)
 * @returns [{ ..., note? }] 또는 실패하면 null (어보이드 노트를 해결할 음이 없는 등 — 다시 뽑음)
 */
export function melodyOverChords(key, rhythm, chords, slot, rnd = Math.random, contour = null) {
  const center = scaleMidis(key)[0] + 5;   // 첫 음은 가운데쯤 (윤곽이 있으면 윤곽의 시작 높이 쪽으로도 끎)
  const total = rhythm.length ? rhythm[rhythm.length - 1].pos + rhythm[rhythm.length - 1].dur : 16;
  const pull = contour && contour.pts ? contour : null;
  let prev = null, prev2 = null, nctRun = 0, prevAvoid = false, hi = -Infinity, lo = Infinity;
  const notes = rhythm.filter(x => !x.rest);
  const out = [];
  for (let k = 0; k < notes.length; k++) {
    const x = notes[k], ch = chords[Math.min(chords.length - 1, Math.floor(x.pos / slot))];
    const strong = x.pos % 4 === 0, last = k === notes.length - 1;
    const cands = notesFor(key, ch).filter(n => (!prev || Math.abs(n.midi - prev.midi) <= 12) &&
      Math.max(hi, n.midi) - Math.min(lo, n.midi) <= RANGE);
    const kind = n => (ch.pcs.has(n.pc) ? "ct" : ch.avoid.has(n.pc) ? "avoid" : "nct");
    let pool = cands;
    // 어보이드 노트 다음: 반드시 순차 화성음
    if (prevAvoid) pool = cands.filter(n => kind(n) === "ct" && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2);
    // 어보이드 노트는 강박·마지막 음에 안 옴, 다음 음이 해결할 수 있을 때만 (다음 음이 같은 코드라고 보고 순차 화성음이 있는지)
    pool = pool.filter(n => kind(n) !== "avoid" || (!strong && !last &&
      cands.some(c => kind(c) === "ct" && Math.abs(c.midi - n.midi) >= 1 && Math.abs(c.midi - n.midi) <= 2)));
    if (!pool.length) return null;
    const wantCT = rnd() < P_CHORD[Math.min(nctRun, 2)];
    let side = pool.filter(n => (kind(n) === "ct") === wantCT);
    if (!side.length) side = pool;
    const wOf = n => {
      let w = prev ? STEP_W(Math.abs(n.midi - prev.midi)) : Math.max(0.05, 1 - Math.abs(n.midi - center) / 14);
      if (prev && nctRun > 0 && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2) w *= AFTER_NCT_STEP;
      if (kind(n) === "avoid") w *= AVOID_W;
      if (prev) w *= AWKWARD[Math.abs(n.midi - prev.midi)] ?? 1;
      // 아르페지오 = 앞 두 음과 이 음이 모두 지금 코드의 구성음
      if (pull) w *= Math.exp(-Math.abs(n.midi - contourAt(pull, x.pos / total)) / pull.s);   // 윤곽 쪽으로 약하게
      if (prev && prev2) w *= directionW(prev.midi - prev2.midi, n.midi - prev.midi, kind(n) === "ct", ch.pcs.has(prev.pc) && ch.pcs.has(prev2.pc));
      return w;
    };
    let pick = weighted(side, side.map(wOf), rnd);
    if (!pick) return null;
    // 도약 뒤 반대 방향으로 또 도약해서 비화성음이면 (1 − OPP_LEAP_NCT) 확률로 그런 음을 빼고 다시 고름 — 화성음·비화성음을
    // 먼저 정하는 방식이라 가중치만 곱하면 비화성음끼리만 바뀌어서, 전체 비율이 OPP_LEAP_NCT배가 되게 다시 고름
    const oppLeapNct = n => prev && prev2 && Math.abs(prev.midi - prev2.midi) >= LEAP && kind(n) !== "ct" &&
      Math.abs(n.midi - prev.midi) >= 3 && Math.sign(n.midi - prev.midi) === -Math.sign(prev.midi - prev2.midi);
    if (oppLeapNct(pick) && rnd() >= OPP_LEAP_NCT) {
      const alt = pool.filter(n => !oppLeapNct(n));
      pick = weighted(alt, alt.map(wOf), rnd) || pick;
    }
    out.push({ l: pick.l, a: pick.a, oct: pick.oct, midi: pick.midi });
    const kd = kind(pick);
    nctRun = kd === "ct" ? 0 : nctRun + 1;
    prevAvoid = kd === "avoid";
    prev2 = prev;
    prev = pick;
    hi = Math.max(hi, pick.midi); lo = Math.min(lo, pick.midi);
  }
  let i = 0;
  return rhythm.map(x => (x.rest ? x : { ...x, note: out[i++] }));
}

/**
 * 방향성 가중치 (위 LEAP·GAP_FILL·INERTIA 설명).
 * @param last  앞 음정 (반음, 위 +)
 * @param next  다음 음정 후보
 * @param ct    이 후보가 지금 코드 구성음인지
 * @param prevCT  앞 두 음이 모두 지금 코드 구성음인지 (ct와 함께면 아르페지오 — 같은 방향 연속 도약 예외)
 */
function directionW(last, next, ct, prevCT) {
  const L = Math.abs(last), N = Math.abs(next), same = Math.sign(last) === Math.sign(next) && next !== 0;
  if (L >= LEAP) {
    if (N >= 1 && N <= 2) return same ? 0.5 : L >= 8 ? GAP_FILL_BIG : GAP_FILL;
    if (same && N >= 3) return ct && prevCT ? ARP_W : 0;
    return 1;
  }
  if (L >= 1 && L <= 2 && same && N <= 2) return INERTIA;
  return 1;
}

/**
 * 받아쓰기 문제 (개연성 높음·중간·낮음): 진행을 만들고 리듬 위에 멜로디. 실패하면 진행부터 다시
 * @returns { tokens, chords, slot, contour: 윤곽 이름 }
 */
export function dictationOverChords(key, rhythm, bars, chance, chromatic, rnd = Math.random) {
  const per = PER_BAR[chance] || 2, slot = 16 / per;
  const contour = pickContour(key, bars, chance, rnd);
  for (let tries = 0; tries < 60; tries++) {
    const chords = makeProgression(key, per * bars, chromatic, rnd);
    const tokens = melodyOverChords(key, rhythm, chords, slot, rnd, contour);
    if (tokens) return { tokens, chords, slot, contour: contour.name };
  }
  return null;
}
