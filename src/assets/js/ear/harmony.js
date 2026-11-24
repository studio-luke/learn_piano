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
  const pats = MONEY[key.minor ? "minor" : "major"];
  const degs = pats[Math.floor(rnd() * pats.length)].split("-").map(Number);
  const start = rnd() < 0.6 ? 0 : Math.floor(rnd() * degs.length);   // 패턴 처음부터를 더 많이
  const prog = Array.from({ length: n }, (_, i) => diatonic(key, degs[(start + i) % degs.length], rnd));
  if (chromatic) insertChromatic(key, prog, rnd);
  return prog;
}

/**
 * 조 밖의 코드 끼워 넣기 (사용자 결정 2026-11-24 — 끼워넣기 방식). 앞 자리를 바꾸는 방식이라 코드 개수는 그대로:
 *   - 세컨더리 도미넌트: x 앞 자리를 V7/x로 (x가 m7(♭5)·°7이 아니고, V7/x가 원래 다이아토닉 V7이 아닐 때)
 *   - 리딩톤 디미니시드: x 앞 자리를 x 근음 반음 아래의 °7로
 *   - Related II–V: x 앞 두 자리를 IIm7(x가 단조 코드면 IIm7(♭5)) – V7/x로
 *   - 모달 인터체인지(장조): IV → IVm7·IVmM7, VI → ♭VIM7, V → ♭VII7
 * 조 밖 코드가 하나도 안 생기기도 함 (확률)
 */
function insertChromatic(key, prog, rnd) {
  const { scale } = keyNotes(key);
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

// ---------- 멜로디 ----------
// 화성음이 올 확률: 앞 음이 화성음 / 비화성음 하나 / 비화성음 둘 이상 (사용자 제안 — 비화성음이 이어질수록 화성음으로 돌아옴)
const P_CHORD = [0.6, 0.85, 0.97];
// 음정(반음)별 가중치: 순차 > 도약, 같은 음 드물게, 옥타브까지
const STEP_W = s => (s === 0 ? 0.15 : s <= 2 ? 1 : s <= 4 ? 0.75 : s <= 7 ? 0.45 : s <= 11 ? 0.2 : s === 12 ? 0.08 : 0);
const AFTER_NCT_STEP = 2.5;   // 비화성음 다음 음은 순차(반음 1~2개)일 가중치 배수
const AVOID_W = 0.5;          // 비화성음 중 어보이드 노트의 가중치 배수 (나오면 반드시 해결)

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
export function melodyOverChords(key, rhythm, chords, slot, rnd = Math.random) {
  const center = scaleMidis(key)[0] + 5;   // 첫 음은 가운데쯤
  let prev = null, nctRun = 0, prevAvoid = false;
  const notes = rhythm.filter(x => !x.rest);
  const out = [];
  for (let k = 0; k < notes.length; k++) {
    const x = notes[k], ch = chords[Math.min(chords.length - 1, Math.floor(x.pos / slot))];
    const strong = x.pos % 4 === 0, last = k === notes.length - 1;
    const cands = notesFor(key, ch).filter(n => !prev || Math.abs(n.midi - prev.midi) <= 12);
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
    const ws = side.map(n => {
      let w = prev ? STEP_W(Math.abs(n.midi - prev.midi)) : Math.max(0.05, 1 - Math.abs(n.midi - center) / 14);
      if (prev && nctRun > 0 && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2) w *= AFTER_NCT_STEP;
      if (kind(n) === "avoid") w *= AVOID_W;
      return w;
    });
    const pick = weighted(side, ws, rnd);
    if (!pick) return null;
    out.push({ l: pick.l, a: pick.a, oct: pick.oct, midi: pick.midi });
    const kd = kind(pick);
    nctRun = kd === "ct" ? 0 : nctRun + 1;
    prevAvoid = kd === "avoid";
    prev = pick;
  }
  let i = 0;
  return rhythm.map(x => (x.rest ? x : { ...x, note: out[i++] }));
}

/**
 * 받아쓰기 문제 (개연성 높음·중간·낮음): 진행을 만들고 리듬 위에 멜로디. 실패하면 진행부터 다시
 * @returns { tokens, chords, slot }
 */
export function dictationOverChords(key, rhythm, bars, chance, chromatic, rnd = Math.random) {
  const per = PER_BAR[chance] || 2, slot = 16 / per;
  for (let tries = 0; tries < 60; tries++) {
    const chords = makeProgression(key, per * bars, chromatic, rnd);
    const tokens = melodyOverChords(key, rhythm, chords, slot, rnd);
    if (tokens) return { tokens, chords, slot };
  }
  return null;
}
