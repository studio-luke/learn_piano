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

// 빌려 온 음계 (2026-11-25 사용자 확인 — C장조 Fm7·A♭M7 위에 B♮가 나오던 버그): 모달 코드는 빌려 온 조·선법의 음계로
// 멜로디 음을 고름 (notesFor). 으뜸음에서의 반음 — 글자는 으뜸음부터 차례로
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],      // 같은 으뜸음 장조 (단조의 IM7 피카르디)
  minor: [0, 2, 3, 5, 7, 8, 10],      // 같은 으뜸음 자연단음계 (장조의 IVm7·IVmM7·♭VIM7·♭VII7)
  dorian: [0, 2, 3, 5, 7, 9, 10],     // 도리안 (단조의 IIm7·IV7 — 6음이 반음 높음)
  phrygian: [0, 1, 3, 5, 7, 8, 10],   // 프리지안 (단조의 ♭IIM7 나폴리 — 2음이 반음 낮음)
};
/** 조의 으뜸음에서 선법 mode의 음계 7음 {l, a} */
function modeScale(key, mode) {
  const tonic = keyNotes(key).scale[0];
  return MODES[mode].map((semis, i) => above(tonic, semis, i));
}
/** 모달 코드 표시: 멜로디를 고를 음계를 붙임 */
const borrowed = (key, c, mode) => ({ ...c, chromatic: true, src: modeScale(key, mode) });

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
  if (prog.length === 1) return singleChord(key, scale[0], prog, rnd);
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
    if (c.degree === 4) prog[i] = { ...borrowed(key, chord(c.root, rnd() < 0.5 ? "m7" : "mM7"), "minor"), degree: 4 };   // IVm7 · IVmM7
    else if (c.degree === 6) prog[i] = borrowed(key, chord(above(scale[0], 8, 5), "M7"), "minor");                       // ♭VIM7
    else if (c.degree === 5) prog[i] = borrowed(key, chord(above(scale[0], 10, 6), "7", [5]), "minor");                  // ♭VII7
  });
}

// 코드 하나(1마디 · 개연성 높음)는 끼워 넣을 앞 자리가 없어서, 그 코드를 같은 근음의 세컨더리 도미넌트나
// 모달 인터체인지 코드로 바꿈 (2026-11-25 사용자 결정). 도수별 후보 [반음(으뜸음부터), 글자, 종류, 어보이드] —
// 5도(V7은 이미 화성단음계)·6도는 후보가 없어서 makeProgression이 진행을 다시 뽑음
const MINOR_SINGLE = {
  1: [[0, 0, "M7", [5], 1, "major"], [0, 0, "7", [5]]],                              // IM7(피카르디) · I7(V7/iv)
  2: [[2, 1, "m7", [], 1, "dorian"], [2, 1, "7", [5]], [1, 1, "M7", [], 1, "phrygian"]],   // IIm7(도리안) · II7(V7/V) · ♭IIM7(나폴리)
  3: [[3, 2, "7", [5]]],                                                              // III7(V7/VI)
  4: [[5, 3, "7", [5], 1, "dorian"]],                                                 // IV7(도리안)
};
// 장조 + 코드 하나: 모달 인터체인지만 나오던 것을 세컨더리 도미넌트·디미니시드(낮게)도 (2026-11-25 사용자 요청).
// [반음, 글자, 종류, 어보이드, 비중(없으면 1), 빌려 온 음계(모달만 — MODES)] — 같은 도수 안에서 비중대로. 모달은 예전과 같은 코드
const MAJOR_SINGLE = {
  1: [[0, 0, "7", [5]], [0, 0, "dim7", [], 0.3]],                         // I7(V7/IV) · I°7(공통음 디미니시드)
  2: [[2, 1, "7", [5]]],                                                   // II7(V7/V)
  3: [[4, 2, "7", [5]]],                                                   // III7(V7/vi)
  4: [[5, 3, "m7", [], 1, "minor"], [5, 3, "mM7", [], 1, "minor"]],      // IVm7 · IVmM7 (모달)
  5: [[10, 6, "7", [5], 1, "minor"], [11, 6, "dim7", [], 0.3]],           // ♭VII7(모달) · VII°7(V7(♭9) 대신)
  6: [[9, 5, "7", [5]], [8, 5, "M7", [], 1, "minor"]],                     // VI7(V7/ii) · ♭VIM7(모달)
};
function singleChord(key, tonic, prog, rnd) {
  const c = prog[0], opts = (key.minor ? MINOR_SINGLE : MAJOR_SINGLE)[c.degree];
  if (!opts) return;
  const [semis, letters, type, avoid, , mode] = weighted(opts, opts.map(o => o[4] ?? 1), rnd);
  const ch = chord(above(tonic, semis, letters), type, avoid);
  prog[0] = { ...(mode ? borrowed(key, ch, mode) : { ...ch, chromatic: true }), degree: c.degree };
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
const CONTOUR_S = { high: 3, mid: 4.5, low: 7 };
// 음정 모티브 반복 (2026-11-25 사용자 결정) — 최소 16분은 한 박, 최소 8분은 반 마디를 한 단위로 봄(최소 4분·랜덤은 안 씀).
// 앞 단위(16분: 4박 전 · 2박 전 · 1박 전, 8분: 한 마디 전 · 반 마디 전)와 리듬을 비교해서
//   ① 같음(배수 1) → 같은 자리 음  ② 한쪽이 부분집합(0.7) → 겹치는 자리만 따오고, 새 자리는 앞뒤 사이를 순차·화성음으로 메움
//   ③ 음 개수만 같음(3개 이상, 0.5) → 순서대로 맞춤.  ①·②는 지금 단위에 음이 2개 이상일 때만. 1박 전은 배수 0.5를 더 곱함
// 방식별 확률(관계 ① 기준): 그대로 MOTIF_EXACT · 동형진행 MOTIF_SEQ(조 안의 음으로 1~2칸, 방향은 윤곽 기울기)
const MOTIF_EXACT = { high: 0.20, mid: 0.12, low: 0 };
const MOTIF_SEQ = { high: 0.40, mid: 0.28, low: 0.15 };   // 끄는 세기 (작을수록 셈) — 개연성이 높을수록 모양이 뚜렷
const CONTOUR_SPAN = { 1: 7, 2: 10 };
// 흔한 음정 패턴 (2026-11-25 사용자 결정): 반 마디(2박)가 시작할 때, 그 반 마디에 음이 3개 이상이고 모티브 반복을 안 하기로
// 정해졌으면 PATTERN_P 확률로 앞 3~4음을 패턴 하나로 정함. 최소 16분(모티브 단위가 한 박)은 반 마디의 첫 박에서만 검사하고,
// 패턴이 둘째 박 음까지 정했으면 둘째 박은 모티브를 검사하지 않음. 오르내림은 그 자리 윤곽의 기울기 쪽을 더 자주.
// 화성음에는 9음(근음 위 2도, 어보이드가 아닐 때)도 넣음. w = 고를 비중 (사용자가 정한 두 가지를 높게)
const PATTERN_P = { high: 0.25, mid: 0.10, low: 0 };
const PATTERNS = {
  ctRun:     { w: 3, len: [3, 4] },   // 화성음만 3~4개 (미솔시도 · 미솔시레 · 미도솔)
  ctPass:    { w: 3, len: [4] },      // 화성음 3개 + 경과음 1개 (미파솔도 · 라도레미)
  enclosure: { w: 1, len: [3] },      // 둘러싸기: 목표 화성음의 위·아래 이웃음을 거쳐 (레시도)
  neighbor:  { w: 1, len: [3] },      // 보조음 돌아오기: 화성음 – 이웃음 – 같은 화성음 (미파미 · 도시도)
  scaleRun:  { w: 1, len: [4] },      // 음계 4음 런, 화성음에서 시작 (도레미파 · 솔파미레)
  leapBack:  { w: 1, len: [4] },      // 6도쯤 도약 후 순차로 반대 방향 두 번 (솔–미′–레′–도′)
};
// 조 밖의 반음 경과음·보조음 (2026-11-25 사용자 결정 — "조 밖의 음 포함"일 때만): 약박의 음 하나를 반음으로 들어가서 반음으로
// 나오는 조 밖 음으로 하고, 바로 다음 음을 그 해결음으로 정함
//   - 경과음: 온음 간격인 두 음 사이 (미–파–파♯–솔, 솔–솔♭–파) — 올라가면 ♯, 내려가면 ♭
//   - 아래 보조음: 화성음 – 반음 아래 – 같은 화성음 (라–솔♯–라), 위 보조음: 반음 위 (솔–라♭–솔, 사용자 추가)
//     — 조 안의 이웃음이 온음 떨어져 있을 때만 (반음이면 이미 조 안의 음)
// 쓰지 않는 자리: 강박, 마지막 음, 다음 음과 사이에 쉼표가 있을 때, 모티브·패턴으로 정한 음. 한 문제에 CHROM_MAX번까지
const CHROM_P = { high: 0.08, mid: 0.10, low: 0.12 };
const CHROM_MAX = 2;              // 목표 선의 높낮이 폭 (반음) — 1마디는 좁게

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

/** 코드 위에서 고를 수 있는 음: 조의 음계(단조는 자연단음계, 모달 코드는 빌려 온 음계 ch.src) 글자마다,
 *  코드 구성음과 글자가 같으면 코드 철자로 바꿈 → F3~F5 모든 옥타브 */
function notesFor(key, ch) {
  const scale = ch.src || keyNotes(key).scale;
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
export function melodyOverChords(key, rhythm, chords, slot, rnd = Math.random, contour = null, { min = 2, chance = "mid", chromatic = false } = {}) {
  const center = scaleMidis(key)[0] + 5;   // 첫 음은 가운데쯤 (윤곽이 있으면 윤곽의 시작 높이 쪽으로도 끎)
  const total = rhythm.length ? rhythm[rhythm.length - 1].pos + rhythm[rhythm.length - 1].dur : 16;
  const pull = contour && contour.pts ? contour : null;
  let prev = null, prev2 = null, nctRun = 0, prevAvoid = false, hi = -Infinity, lo = Infinity;
  const notes = rhythm.filter(x => !x.rest);
  const out = [];
  const chordAt = pos => chords[Math.min(chords.length - 1, Math.floor(pos / slot))];
  const kindIn = (ch, n) => (ch.pcs.has(n.pc) ? "ct" : ch.avoid.has(n.pc) ? "avoid" : "nct");

  // ----- 음정 모티브 -----
  const U = min === 1 ? 4 : min === 2 ? 8 : 0;                 // 모티브 단위 길이 (16분 단위), 0이면 안 씀
  const OFFS = min === 1 ? [[4, 1], [2, 1], [1, 0.5]] : [[2, 1], [1, 1]];   // [몇 단위 전, 확률 배수] — 앞 것을 먼저
  const unitNotes = new Map();                                 // 단위 → [노트 순번 k]
  if (U) notes.forEach((x, k) => { const u = Math.floor(x.pos / U); if (!unitNotes.has(u)) unitNotes.set(u, []); unitNotes.get(u).push(k); });
  const motifs = [];                                           // 디버그용 기록
  let plan = null, lastSeq = null;                             // plan: 지금 단위의 { at: Map(k → 정한 음), fill: Set(k) }

  /** 음 하나를 조 안에서 d칸 옮기고(0이면 그대로) 그 자리 코드의 철자로 — 범위 밖이면 null */
  const moveNote = (src, d, pos) => {
    const L = src.l + d, l = ((L % 7) + 7) % 7, oct = src.oct + Math.floor(L / 7);
    return notesFor(key, chordAt(pos)).find(n => n.l === l && n.oct === oct) || null;
  };
  /** 단위 u를 시작할 때: 따올 앞 단위·관계·방식을 정하고, 정한 음이 규칙에 맞는 이동량을 고름 */
  const makePlan = u => {
    const cur = unitNotes.get(u) || [];
    const rel = ks => ks.map(k => notes[k].pos % U);
    const cr = rel(cur);
    let best = null;
    for (const [o, omul] of OFFS) {
      const src = unitNotes.get(u - o);
      if (!src || !src.length || src.some(k => k >= out.length)) continue;
      const sr = rel(src), sub = (a, b) => a.every(p => b.includes(p));
      let rank = 0, mul = 0;
      if (cr.length >= 2 && cr.length === sr.length && sub(cr, sr)) { rank = 3; mul = 1; }
      else if (cr.length >= 2 && sr.length >= 2 && (sub(cr, sr) || sub(sr, cr))) { rank = 2; mul = 0.7; }
      else if (cr.length >= 3 && cr.length === sr.length) { rank = 1; mul = 0.5; }
      if (rank && (!best || rank > best.rank)) best = { o, src, sr, rank, mul: mul * omul };
    }
    if (!best) return null;
    const pE = (MOTIF_EXACT[chance] ?? 0) * best.mul, pS = (MOTIF_SEQ[chance] ?? 0) * best.mul, r = rnd();
    const mode = r < pE ? "exact" : r < pE + pS ? "seq" : null;
    if (!mode) return null;
    // 지금 단위 음마다 따올 앞 음 (없으면 메울 자리)
    const srcOf = cur.map((k, i) => {
      if (best.rank === 1) return out[best.src[i]];
      const j = best.sr.indexOf(cr[i]);
      return j >= 0 ? out[best.src[j]] : null;
    });
    // 이동량 순서: 그대로 [0], 동형진행은 윤곽 기울기 방향 1·2칸 → 반대 방향 (앞 단위를 같은 출처로 옮겼으면 그 이동량부터)
    let ds = [0];
    if (mode === "seq") {
      const mid = notes[cur[0]].pos / total;
      const slope = pull ? contourAt(pull, Math.min(1, mid + 0.1)) - contourAt(pull, Math.max(0, mid - 0.1)) : rnd() - 0.5;
      const dir = slope >= 0 ? 1 : -1;
      ds = [dir, 2 * dir, -dir, -2 * dir];
      if (lastSeq && lastSeq.o === best.o && lastSeq.u === u - 1) ds = [lastSeq.d, ...ds.filter(d => d !== lastSeq.d)];
      if (chance !== "low") ds.push(0);   // 동형진행이 안 되면 그대로 (낮음은 그대로 없음)
    }
    // 정한 음이 규칙에 맞는지: 범위·옥타브 이내·어보이드 아님·같은 방향 연속 도약 아님, 강박 음은 화성음을 먼저
    const tryD = (d, strictStrong) => {
      const at = new Map();
      let h = hi, l = lo, p1 = prev, p2 = prev2;
      for (let i = 0; i < cur.length; i++) {
        const k = cur[i], x = notes[k];
        if (!srcOf[i]) { p2 = p1; p1 = null; continue; }   // 메울 자리 — 앞뒤 관계는 따지지 않음
        const n = moveNote(srcOf[i], d, x.pos);
        if (!n) return null;
        const ch = chordAt(x.pos), kd = kindIn(ch, n);
        if (kd === "avoid") return null;
        if (i === 0 && prevAvoid && !(kd === "ct" && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2)) return null;
        if (strictStrong && x.pos % 4 === 0 && kd !== "ct") return null;
        h = Math.max(h, n.midi); l = Math.min(l, n.midi);
        if (h - l > RANGE) return null;
        if (p1 && Math.abs(n.midi - p1.midi) > 12) return null;
        if (p1 && p2 && directionW(p1.midi - p2.midi, n.midi - p1.midi, true, true) === 0) return null;
        at.set(k, n);
        p2 = p1; p1 = n;
      }
      return at;
    };
    for (const strict of [true, false]) for (const d of ds) {
      const at = tryD(d, strict);
      if (!at) continue;
      const realMode = d === 0 ? "exact" : "seq";
      lastSeq = realMode === "seq" ? { o: best.o, d, u } : null;
      const name = x => (min === 1 ? "b" : "h") + (x + 1);
      motifs.push(`${name(u)}←${name(u - best.o)} ${realMode === "seq" ? (d > 0 ? "+" : "") + d : "="}${best.rank === 3 ? "" : best.rank === 2 ? " sub" : " cnt"}`);
      return { at, fill: new Set(cur.filter(k => !at.has(k))) };
    }
    return null;
  };

  // ----- 흔한 음정 패턴 (PATTERNS) -----
  const halfNotes = new Map();                                 // 반 마디 → [노트 순번 k]
  notes.forEach((x, k) => { const h = Math.floor(x.pos / 8); if (!halfNotes.has(h)) halfNotes.set(h, []); halfNotes.get(h).push(k); });
  let pat = null;                                              // 패턴으로 정한 음 Map(k → 음)
  /** 그 자리 윤곽의 기울기 쪽(+1 위 / −1 아래)을 3:1로 — 윤곽이 없으면 반반 */
  const slopeDir = pos => {
    if (!pull) return rnd() < 0.5 ? 1 : -1;
    const t = pos / total, sl = contourAt(pull, Math.min(1, t + 0.1)) - contourAt(pull, Math.max(0, t - 0.1));
    const up = sl >= 0;
    return (rnd() < 0.75) === up ? 1 : -1;
  };
  /** 정한 음들이 규칙에 맞는지: 범위·옥타브 이내·방향성(같은 방향 연속 도약 등), 어보이드는 약박이고 다음 음이 순차 화성음 */
  const seqFits = (ks, seq) => {
    let h = hi, l = lo, p1 = prev, p2 = prev2;
    for (let i = 0; i < ks.length; i++) {
      const n = seq[i], x = notes[ks[i]], ch = chordAt(x.pos), kd = kindIn(ch, n);
      h = Math.max(h, n.midi); l = Math.min(l, n.midi);
      if (h - l > RANGE) return false;
      if (p1 && Math.abs(n.midi - p1.midi) > 12) return false;
      if (p1 && p2 && directionW(p1.midi - p2.midi, n.midi - p1.midi, kd === "ct", ch.pcs.has(p1.pc) && ch.pcs.has(p2.pc)) === 0) return false;
      if (kd === "avoid") {
        if (x.pos % 4 === 0 || ks[i] === notes.length - 1) return false;
        const nx = seq[i + 1];
        if (nx && !(kindIn(ch, nx) === "ct" && Math.abs(nx.midi - n.midi) >= 1 && Math.abs(nx.midi - n.midi) <= 2)) return false;
      }
      p2 = p1; p1 = n;
    }
    return true;
  };
  /** 반 마디 h의 앞 3~4음을 패턴으로 — 정했으면 Map(k → 음), 못 정했으면 null */
  const makePattern = h => {
    const ks = halfNotes.get(h);
    if (!ks || ks.length < 3 || prevAvoid || !(rnd() < (PATTERN_P[chance] ?? 0))) return null;
    const ch = chordAt(notes[ks[0]].pos);
    const ns = notesFor(key, ch).filter(n => Math.max(hi, n.midi) - Math.min(lo, n.midi) <= RANGE + 12).sort((a, b) => a.midi - b.midi);
    const ninth = (pcOf(ch.root) + 2) % 12;
    const isCT = n => ch.pcs.has(n.pc) || (n.pc === ninth && !ch.avoid.has(n.pc));
    const cts = ns.filter(isCT);
    const step = (n, d) => ns[ns.findIndex(m => m.midi === n.midi) + d] || null;     // 조 안에서 한 칸 위·아래
    const ctNear = (n, d, maxGap) => (d > 0 ? cts.filter(m => m.midi > n.midi && m.midi - n.midi <= maxGap)
      : cts.filter(m => m.midi < n.midi && n.midi - m.midi <= maxGap).reverse());
    // 첫 음: 앞 음에서 가깝고 윤곽 쪽으로 (첫 음이면 가운데쯤)
    const startW = n => (prev ? STEP_W(Math.abs(n.midi - prev.midi)) || 0.02 : Math.max(0.05, 1 - Math.abs(n.midi - center) / 14)) *
      (pull ? Math.exp(-Math.abs(n.midi - contourAt(pull, notes[ks[0]].pos / total)) / pull.s) : 1);
    const names = Object.keys(PATTERNS);
    for (let tries = 0; tries < 12; tries++) {
      const name = weighted(names, names.map(k => PATTERNS[k].w), rnd);
      const lens = PATTERNS[name].len.filter(L => L <= ks.length);
      if (!lens.length) continue;
      const len = lens[Math.floor(rnd() * lens.length)], dir = slopeDir(notes[ks[0]].pos);
      let seq = null;
      if (name === "ctRun") {                       // 화성음끼리 6도 이내로 (방향은 섞여도 됨 — 미도솔)
        const a = weighted(cts, cts.map(startW), rnd); seq = a && [a];
        while (seq && seq.length < len) {
          const p = seq[seq.length - 1], opts = cts.filter(m => m.midi !== p.midi && Math.abs(m.midi - p.midi) <= 9);
          const nx = weighted(opts, opts.map(m => STEP_W(Math.abs(m.midi - p.midi)) * (Math.sign(m.midi - p.midi) === dir ? 2 : 1)), rnd);
          seq = nx ? [...seq, nx] : null;
        }
      } else if (name === "ctPass") {               // 화성음 – (경과음 자리 1 또는 2) – 화성음 … 3도 사이를 순차로
        const pi = rnd() < 0.5 ? 1 : 2;
        const a = weighted(cts, cts.map(startW), rnd); seq = a && [a];
        while (seq && seq.length < len) {
          const p = seq[seq.length - 1];
          if (seq.length === pi) {                  // 경과음: 위(아래) 3도 화성음과의 사이 음
            const tgt = ctNear(p, dir, 4).find(m => Math.abs(m.midi - p.midi) >= 3);
            const mid = tgt && step(p, dir);
            seq = mid && !isCT(mid) && step(mid, dir)?.midi === tgt.midi ? [...seq, mid, tgt] : null;
          } else {
            const opts = cts.filter(m => m.midi !== p.midi && Math.abs(m.midi - p.midi) <= 7 && Math.sign(m.midi - p.midi) === dir);
            const nx = weighted(opts, opts.map(m => STEP_W(Math.abs(m.midi - p.midi))), rnd);
            seq = nx ? [...seq, nx] : null;
          }
        }
        if (seq) seq = seq.slice(0, len);
      } else if (name === "enclosure") {           // 위 이웃 – 아래 이웃 – 목표 (또는 반대)
        const t = weighted(cts, cts.map(startW), rnd), u = t && step(t, 1), d = t && step(t, -1);
        seq = u && d ? (dir < 0 ? [u, d, t] : [d, u, t]) : null;
      } else if (name === "neighbor") {            // 화성음 – 이웃음 – 같은 화성음
        const a = weighted(cts, cts.map(startW), rnd), nb = a && step(a, rnd() < 0.6 ? 1 : -1);
        seq = nb ? [a, nb, a] : null;
      } else if (name === "scaleRun") {            // 화성음에서 순차로 같은 방향 4음
        const a = weighted(cts, cts.map(startW), rnd); seq = a && [a];
        while (seq && seq.length < len) { const nx = step(seq[seq.length - 1], dir); seq = nx ? [...seq, nx] : null; }
      } else if (name === "leapBack") {            // 화성음 – 6도쯤 도약한 화성음 – 반대 방향 순차 둘
        const a = weighted(cts, cts.map(startW), rnd);
        const b = a && cts.filter(m => (m.midi - a.midi) * dir >= 8 && (m.midi - a.midi) * dir <= 9)[0];
        const c = b && step(b, -dir), d = c && step(c, -dir);
        seq = d ? [a, b, c, d] : null;
      }
      if (!seq || seq.length !== len) continue;
      const use = ks.slice(0, len);
      if (!seqFits(use, seq)) continue;
      motifs.push(`h${h + 1} ${name}`);
      return new Map(use.map((k, i) => [k, seq[i]]));
    }
    return null;
  };

  // ----- 조 밖의 반음 경과음·보조음 (CHROM_P) -----
  let chromCount = 0, forced = null;                           // forced: { k, note } — 다음 음을 반음 해결음으로 정해 둠
  /** 음 n에서 반음 dir만큼 옮긴 음 — 글자 letterStep칸 옮긴 철자 (겹변화표면 null) */
  const semitone = (n, dir, letterStep) => {
    const L = n.l + letterStep, l = ((L % 7) + 7) % 7, oct = n.oct + Math.floor(L / 7);
    const midi = n.midi + dir, a = midi - midiOf({ l, a: 0, oct });
    if (Math.abs(a) > 1) return null;
    // C♭·F♭·E♯·B♯ 대신 같은 글자로 (B♭–C♭–B♭ → B♭–B♮–B♭)
    if (letterStep && ((a < 0 && (l === 0 || l === 3)) || (a > 0 && (l === 2 || l === 6)))) return semitone(n, dir, 0);
    return { l, a, oct, midi, pc: ((midi % 12) + 12) % 12 };
  };
  /** 약박 음 k를 조 밖 반음 음으로 — 되면 그 음(다음 음은 forced), 안 되면 null */
  const makeChromatic = (k, ch, busy) => {
    const x = notes[k], nx = notes[k + 1];
    if (!chromatic || chromCount >= CHROM_MAX || !prev || prevAvoid || x.pos % 4 === 0 || !nx || x.pos + x.dur !== nx.pos ||
      busy(k) || busy(k + 1) || !(rnd() < (CHROM_P[chance] ?? 0))) return null;
    const here = notesFor(key, ch), inScale = n => here.some(m => m.pc === n.pc);
    const nextNs = notesFor(key, chordAt(nx.pos)), nextCh = chordAt(nx.pos);
    const at = midi => nextNs.find(m => m.midi === midi && kindIn(nextCh, m) !== "avoid");
    const opts = [];
    for (const dir of [1, -1]) {
      // 경과음: 앞 음에서 같은 방향으로 온음 위(아래)의 음까지 — 철자는 앞 음 글자에 ♯(♭)
      const tgt = at(prev.midi + 2 * dir), c = semitone(prev, dir, 0);
      if (tgt && c && !inScale(c)) opts.push({ c, tgt, w: kindIn(nextCh, tgt) === "ct" ? 1.5 : 1 });
    }
    if (kindIn(ch, prev) === "ct") {
      // 보조음: 아래는 아래 글자에 ♯, 위는 위 글자에 ♭ — 돌아올 음(앞 음과 같은 음)이 다음 코드에서도 어보이드가 아닐 때
      const back = at(prev.midi);
      const lo2 = semitone(prev, -1, -1), up2 = semitone(prev, 1, 1);
      if (back && lo2 && !inScale(lo2)) opts.push({ c: lo2, tgt: back, w: 1 });
      if (back && up2 && !inScale(up2)) opts.push({ c: up2, tgt: back, w: 0.6 });
    }
    // 그 코드의 어보이드 노트와 같은 음(D7sus4 위의 F♯ 등)은 장식음이어도 부딪혀서 뺌
    const ok = opts.filter(o => !ch.avoid.has(o.c.pc) && o.c.midi >= LOW && o.c.midi <= HIGH && Math.abs(o.c.midi - prev.midi) === 1 &&
      Math.max(hi, o.c.midi, o.tgt.midi) - Math.min(lo, o.c.midi, o.tgt.midi) <= RANGE);
    const o = weighted(ok, ok.map(v => v.w), rnd);
    if (!o) return null;
    chromCount++;
    forced = { k: k + 1, note: o.tgt };
    motifs.push(`chrom ${"CDEFGAB"[o.c.l]}${o.c.a > 0 ? "♯" : o.c.a < 0 ? "♭" : "♮"}`);
    return o.c;
  };

  for (let k = 0; k < notes.length; k++) {
    const x = notes[k], ch = chordAt(x.pos);
    const strong = x.pos % 4 === 0, last = k === notes.length - 1;
    if (pat && ![...pat.keys()].some(kk => kk >= k)) pat = null;
    const resolving = !!(forced && forced.k === k);           // 이 음은 반음 해결음으로 이미 정해짐 → 모티브·패턴을 새로 시작하지 않음
    if (U) {
      const u = Math.floor(x.pos / U);
      if (unitNotes.get(u)[0] === k) {
        // 패턴이 이 단위의 음까지 이미 정했으면 모티브는 검사하지 않음
        if (resolving || (pat && unitNotes.get(u).some(kk => pat.has(kk)))) plan = null;
        else { plan = makePlan(u); if (!plan) lastSeq = null; }
      }
    }
    // 반 마디의 첫 음: 모티브를 안 따르기로 했으면 패턴 검사
    const h = Math.floor(x.pos / 8);
    if (halfNotes.get(h)[0] === k && !resolving && !(plan && plan.at.size)) { pat = makePattern(h); if (pat) plan = null; }
    const kind = n => kindIn(ch, n);
    const cands = notesFor(key, ch).filter(n => (!prev || Math.abs(n.midi - prev.midi) <= 12) &&
      Math.max(hi, n.midi) - Math.min(lo, n.midi) <= RANGE);
    let pick = null;
    // 반음 해결음 (앞 음이 조 밖의 반음 경과음·보조음)
    if (forced && forced.k === k) { pick = forced.note; forced = null; }
    // 모티브·패턴으로 정한 음 (지금 범위에 여전히 맞으면 그대로)
    const planned = (plan && plan.at.get(k)) || (pat && pat.get(k));
    if (!pick && planned && cands.some(c => c.midi === planned.midi && c.l === planned.l)) pick = planned;
    // 조 밖의 반음 경과음·보조음 (정해 둔 음이 아닌 약박)
    if (!pick) pick = makeChromatic(k, ch, kk => !!((plan && (plan.at.has(kk) || plan.fill.has(kk))) || (pat && pat.has(kk))));
    if (!pick) {
      let pool = cands;
      // 어보이드 노트 다음: 반드시 순차 화성음
      if (prevAvoid) pool = cands.filter(n => kind(n) === "ct" && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2);
      // 어보이드 노트는 강박·마지막 음에 안 옴, 다음 음이 해결할 수 있을 때만 (다음 음이 같은 코드라고 보고 순차 화성음이 있는지)
      // — 모티브 단위 안에서 메우는 음에는 안 씀 (다음 음이 이미 정해져 있어서)
      const filling = plan && plan.fill.has(k);
      pool = pool.filter(n => kind(n) !== "avoid" || (!strong && !last && !filling &&
        cands.some(c => kind(c) === "ct" && Math.abs(c.midi - n.midi) >= 1 && Math.abs(c.midi - n.midi) <= 2)));
      if (!pool.length) return null;
      // 메우는 음: 다음에 정해진 음이 있으면 앞 음과 그 음 사이(순차·화성음) 쪽으로
      const nextPlanned = filling ? [...plan.at.entries()].find(([kk]) => kk > k)?.[1] : null;
      const wantCT = rnd() < P_CHORD[Math.min(nctRun, 2)];
      let side = pool.filter(n => (kind(n) === "ct") === wantCT);
      if (!side.length) side = pool;
      const wOf = n => {
        let w = prev ? STEP_W(Math.abs(n.midi - prev.midi)) : Math.max(0.05, 1 - Math.abs(n.midi - center) / 14);
        if (prev && nctRun > 0 && Math.abs(n.midi - prev.midi) >= 1 && Math.abs(n.midi - prev.midi) <= 2) w *= AFTER_NCT_STEP;
        if (kind(n) === "avoid") w *= AVOID_W;
        if (prev) w *= AWKWARD[Math.abs(n.midi - prev.midi)] ?? 1;
        if (pull) w *= Math.exp(-Math.abs(n.midi - contourAt(pull, x.pos / total)) / pull.s);   // 윤곽 쪽으로 약하게
        // 아르페지오 = 앞 두 음과 이 음이 모두 지금 코드의 구성음
        if (prev && prev2) w *= directionW(prev.midi - prev2.midi, n.midi - prev.midi, kind(n) === "ct", ch.pcs.has(prev.pc) && ch.pcs.has(prev2.pc));
        if (filling && prev && nextPlanned) {
          const mid = (prev.midi + nextPlanned.midi) / 2, step = Math.abs(n.midi - nextPlanned.midi) <= 2;
          w *= Math.exp(-Math.abs(n.midi - mid) / 1.5) * (step ? 2 : 1);
        }
        return w;
      };
      pick = weighted(side, side.map(wOf), rnd);
      if (!pick) return null;
      // 도약 뒤 반대 방향으로 또 도약해서 비화성음이면 (1 − OPP_LEAP_NCT) 확률로 그런 음을 빼고 다시 고름 — 화성음·비화성음을
      // 먼저 정하는 방식이라 가중치만 곱하면 비화성음끼리만 바뀌어서, 전체 비율이 OPP_LEAP_NCT배가 되게 다시 고름
      const oppLeapNct = n => prev && prev2 && Math.abs(prev.midi - prev2.midi) >= LEAP && kind(n) !== "ct" &&
        Math.abs(n.midi - prev.midi) >= 3 && Math.sign(n.midi - prev.midi) === -Math.sign(prev.midi - prev2.midi);
      if (oppLeapNct(pick) && rnd() >= OPP_LEAP_NCT) {
        const alt = pool.filter(n => !oppLeapNct(n));
        pick = weighted(alt, alt.map(wOf), rnd) || pick;
      }
    }
    out.push({ l: pick.l, a: pick.a, oct: pick.oct, midi: pick.midi });
    if (pick.pc === undefined) pick = { ...pick, pc: ((pick.midi % 12) + 12) % 12 };
    const kd = kind(pick);
    nctRun = kd === "ct" ? 0 : nctRun + 1;
    prevAvoid = kd === "avoid";
    prev2 = prev;
    prev = pick;
    hi = Math.max(hi, pick.midi); lo = Math.min(lo, pick.midi);
  }
  let i = 0;
  return Object.assign(rhythm.map(x => (x.rest ? x : { ...x, note: out[i++] })), { motifs });
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
 * @param min  최소 박자 (모티브 단위: 16분 = 한 박, 8분 = 반 마디, 4분 = 안 씀)
 * @returns { tokens, chords, slot, contour: 윤곽 이름, motifs: 모티브 기록(디버그용) }
 */
export function dictationOverChords(key, rhythm, bars, chance, chromatic, rnd = Math.random, min = 2) {
  const per = PER_BAR[chance] || 2, slot = 16 / per;
  const contour = pickContour(key, bars, chance, rnd);
  for (let tries = 0; tries < 60; tries++) {
    const chords = makeProgression(key, per * bars, chromatic, rnd);
    const tokens = melodyOverChords(key, rhythm, chords, slot, rnd, contour, { min, chance, chromatic });
    if (tokens) return { tokens, chords, slot, contour: contour.name, motifs: tokens.motifs };
  }
  return null;
}
