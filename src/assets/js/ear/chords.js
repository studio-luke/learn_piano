// ===== 청음 연습 — 코드 ① 코드 종류: 출제·채점 (순수 함수, 화면 없음 → tests/ear-chords.test.js) =====
// 코드 하나를 듣고 코드 종류(m7, M7, sus4 …)를 맞히는 단계. 규칙은 chordoven-spec.md "청음 연습" 코드 ① (2026-11-25 사용자 결정):
//   - 소리: 베이스(근음 하나, C2~D♯3 중 악기가 낼 수 있는 음 — 옥타브 자리가 둘이면 반반) + 위 화음(F3~D5).
//     베이스는 늘 근음이라 자리바꿈을 허용해도 정답이 여러 개가 되지 않음
//   - 자리바꿈 꺼짐: 기본형만 — 근음부터 1 3 5 7 텐션 순서로 바로 위에 하나씩. 텐션이 있으면 근음은 베이스만, 위 화음은 3음부터
//     (5음은 남김) A5까지(STACK_HIGH)
//   - 자리바꿈 허용일 때 위 화음 배치 (2026-11-25 사용자 규칙, voicings):
//     · 2도(반음·온음)가 세 번 이어지는 네 음 뭉침은 내지 않음(secondRun — 코드 추론하기 보이싱과 같음)
//     · 이웃한 두 음은 7도 미만, 6도는 맨 아래 두 음 사이에서만 — 한 옥타브 안에 모이는 밀집 배치가 아니어도 됨(밀집 배치가 더 자주, CLOSE_P)
//     · 베이스와 위 화음 맨 아래 음은 단3도 이상(MIN_GAP), 맨 아래 음은 코드 음이거나 베이스에서 한 옥타브 이상 떨어진 텐션
//       (C 베이스 + D4 E4 G4 B4 같은 배치를 살림). aug 계열의 ♯5는 코드 음이어도 텐션처럼 셈. 베이스가 E2보다 낮으면
//       한 옥타브 위 베이스도 울린다고 보고 그 음에서 한 옥타브 이상 (낮은 베이스는 배음이 크게 울려서, 2026-11-25 사용자 규칙)
//     · 텐션이 있는 문제만: 핵심음(3음·7음 + sus4의 4음·m7(♭5)의 ♭5음)은 모두 C5 아래, 한 옥타브 안에 모이고,
//       위 화음 높이의 평균보다 위에 있는 핵심음은 하나까지 — 코드의 성격을 정하는 음이 화음 가운데·아래에 있게
//       (D♭M7(♯11,13)·G7sus4(♭9,13)이 다른 코드처럼 들렸음). 7sus4(♭9,13)은 13이 7음 위 장7도일 때만,
//       7sus4(9,♭13)은 아래부터 7 · 9 · 4 · ♭13 순서일 때만 (지금은 7sus4(♭13)을 ♭13 하나로만 내서 쓰이지 않음),
//       7sus4(♭13)은 ♭7 · 4 · ♭13만 — 자리바꿈 꺼짐이면 7sus4(♭13)은 내지 않음 (2026-11-26 사용자 요청)
//   - 근음 글자는 문제에 보여 주고, 답은 그 뒤의 코드 종류만 씀(코드 추론하기의 입력칸·키패드)
//   - 채점: 코드 추론하기의 이름 읽기(core/naming.js parse)로 "근음 + 쓴 글자"를 읽고, 그 코드의 필수 구성음이 문제의 음과
//     맞으면 정답 → m7(♭5) = m7♭5 = m7(-5)처럼 표기가 달라도 맞음. 빈칸으로 제출하면 메이저 3화음(근음만 쓴 것)으로 봄
//     (2026-11-25 사용자 요청 — 메이저 3화음은 그냥 [제출])
//   - 텐션 (2026-11-25 사용자 결정, 출제 설정 "세븐코드에 텐션 추가 허용" + 최대 1·2개): 붙는 텐션은 엔진 규칙(TYPES의 ten·maxTen) 그대로,
//     흔한 것 위주(TEN_W). 켜도 텐션 없는 문제가 섞임. 자리바꿈 허용에서 텐션이 있으면 위 화음에서 근음을 빼고(베이스가 냄 — 9와 근음이 붙어 뭉개지지
//     않게), 텐션이 2개면 완전5음도 뺌.
//     베이스까지 포함해 단9도·단16도가 생기는 배치는 내지 않음(근음–♭9, 완전5음–♭13만 예외, hasMinorNinth)
// 코드 종류·구성음은 core/engine.js(TYPES, tonesFor, spellTone)를 그대로 씀.
import { Engine as E } from "../core/engine.js";
import { parse } from "../core/naming.js";
import { INVERSIONS, HYBRIDS } from "../improv/slash.js";

export const BASS_LOW = 36, BASS_HIGH = 51;    // 베이스(근음): C2 ~ D♯3 — C~D♯은 옥타브 자리 둘(반반). 악기마다 instruments.js low부터
                                               // (기타·합창은 E2부터). 2026-11-25 사용자 요청: E2 → E1 → 너무 낮으면 크게 울려 위 화음이 묻혀서 C2
export const REF_BASS = 40;                    // 이 음(E2)보다 낮은 베이스는 한 옥타브 위 베이스도 함께 울린다고 보고 맨 아래 텐션 규칙을 셈 (voicings)
export const UPPER_LOW = 53, UPPER_HIGH = 74;  // 위 화음: F3 ~ D5 (2026-11-25 사용자 요청 E3 → F3 — 건반 그림 F3~A5와 맞춤)
export const MIN_GAP = 3;                      // 베이스와 위 화음 가장 아래 음 사이 최소 간격 (반음, 단3도 — 2026-11-25 사용자 결정, 전에는 완전4도)
export const STACK_HIGH = 81;                  // 자리바꿈 꺼짐 + 텐션: 3음부터 13까지(반음 17개) 쌓으면 3음이 E4에서 시작해도 A5까지 —
                                               // 위 화음 끝을 여기까지 넓혀 모든 근음에서 나오게 (2026-11-25 사용자 요청)
export const CORE_TOP = 72;                    // 텐션 문제의 핵심음은 이 음(C5) 아래
const CLOSE_P = 0.65;                          // 밀집 배치(위 화음이 한 옥타브 안)를 고를 비율 — 놓을 수 있을 때

// 출제할 수 있는 코드 종류 (출제 설정의 칩 묶음 — 사용자 결정 2026-11-25). id는 engine TYPES의 id
export const GROUPS = [
  { key: "earCTriads", ids: ["maj", "min", "dim", "aug", "sus4", "sus2"] },
  { key: "earCSevenths", ids: ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "aug7", "augM7"] },
  { key: "earCSixths", ids: ["6", "m6", "69", "m69"] },   // 6(9)·m6(9)는 2026-11-26 추가 — 정해진 모양(SHAPES)으로만
];
// 처음 켜짐: 3화음 모두 끔, aug 계열(aug7·augM7)을 뺀 7화음 전부 + 6화음 전부
export const DEFAULT_TYPES = ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "6", "m6", "69", "m69"];

// 텐션 고르는 비율 (코드 종류별 — 흔한 것 위주, 화면에는 쓰지 않음). 없는 텐션은 엔진 TYPES의 ten에서 빠진 것
const TEN_W = {
  M7: { "9": 3, "#11": 1.5, "13": 1 },
  m7: { "9": 3, "11": 2 },
  dom7: { "9": 3, "13": 3, "b9": 1.5, "#9": 1, "#11": 1, "b13": 1 },
  "7sus4": { "9": 2, "13": 1.5, "b9": 1, "b13": 1 },
  aug7: { "9": 1, "#11": 1 },
  m7b5: { "9": 1, "11": 2, "b13": 1 },
  mM7: { "9": 2, "11": 1 },
};
// 텐션 개수 0/1/2개 비율 (켜도 텐션 없는 문제가 섞이게 — 엔진 chooseTensions와 같은 값)
const COUNT_W = { 1: [0.4, 0.6], 2: [0.25, 0.4, 0.35] };

// ---------- 유명한 보이싱 (2026-11-26 사용자 지정) ----------
// 텐션 허용 + 자리바꿈 허용일 때 그 코드 종류에 모양이 있으면 TEMPLATE_P 비율로 아래 모양 중 하나로 냄(텐션은 모양이 정함 — 답도 그 텐션까지).
// 텐션 없는 모양(m7(♭5) 밀집형)은 자리바꿈 허용만 켜져 있어도. 6(9)·m6(9)는 늘 이 모양으로만(자리바꿈 꺼짐은 3·5·6·9만).
// 이미 검증된 모양이라 배치 규칙(핵심음·간격·단9도)은 따지지 않고 음역(F3~A5)·베이스 간격만 봄.
// 모양 고르기: 묶음(g)을 가중치(GROUP_W)대로 → 그 안에서 똑같이. 도수 글자는 근음에서 위로(아래 음부터 쌓을 순서)
//   v       아래부터 순서대로 앞 음 바로 위에 쌓음
//   ust     어퍼스트럭처: 가이드톤 둘(guides) 중 하나가 맨 아래, 다른 하나는 그 바로 위 자리, 3화음(triad — 근음·3음·5음 순)은
//           자리바꿈 자유로 맨 아래 가이드톤보다 위에서 시작(두 가이드톤 사이에서 시작해도 됨: C7의 E–A–B♭–D–F♯). 가이드톤 중복 허용
export const TEMPLATE_P = 0.4;
const GUIDE_DOM = ["3", "b7"], GUIDE_MAJ = ["3", "7"], GUIDE_MIN = ["b3", "b7"];
export const SHAPES = {
  dom7: [
    { g: "251", v: ["b7", "9", "3", "13"] }, { g: "251", v: ["3", "13", "b7", "9"] },
    { g: "251", v: ["b7", "b9", "3", "13"] }, { g: "251", v: ["3", "b13", "b7", "9"] },
    { g: "251", v: ["b7", "b9", "3", "b13"] }, { g: "251", v: ["3", "b13", "b7", "b9"] },
    { g: "#9", v: ["3", "b13", "b7", "#9"] }, { g: "#9", v: ["b7", "#9", "3", "b13"] },
    { g: "4th", v: ["b7", "3", "13", "9"] }, { g: "4th", v: ["b7", "3", "b13", "b9"] }, { g: "4th", v: ["b7", "3", "13", "9", "5"] },
    { g: "dim", v: ["3", "5", "b7", "b9"] },                                   // 7(♭9) 디미니시형 — 근음 위 dim7 모양
    { g: "ust", guides: GUIDE_DOM, triad: ["9", "#11", "13"] },              // C7 + D   → C7(9,♯11,13)
    { g: "ust", guides: GUIDE_DOM, triad: ["#9", "5", "b7"] },               // C7 + E♭  → C7(♯9)
    { g: "ust", guides: GUIDE_DOM, triad: ["#11", "b7", "b9"] },             // C7 + G♭  → C7(♭9,♯11)
    { g: "ust", guides: GUIDE_DOM, triad: ["b13", "1", "#9"] },              // C7 + A♭  → C7(♯9,♭13)
    { g: "ust", guides: GUIDE_DOM, triad: ["13", "b9", "3"] },               // C7 + A   → C7(♭9,13)
  ],
  M7: [
    { g: "251", v: ["3", "5", "7", "9"] }, { g: "251", v: ["7", "9", "3", "5"] },
    { g: "251", v: ["3", "13", "7", "9"] }, { g: "251", v: ["7", "9", "3", "13"] },
    { g: "4th", v: ["7", "3", "13", "9"] }, { g: "4th", v: ["7", "3", "13", "9", "5"] },
    { g: "ust", guides: GUIDE_MAJ, triad: ["9", "#11", "13"] },              // CM7 + D  → CM7(9,♯11,13) (리디안)
    { g: "sowhat", v: ["3", "13", "9", "5", "7"] },                          // So What 모양 (가이드톤 한 옥타브 규칙 예외)
  ],
  m7: [
    { g: "251", v: ["b3", "5", "b7", "9"] }, { g: "251", v: ["b7", "9", "b3", "5"] },
    { g: "ust", guides: GUIDE_MIN, triad: ["b7", "9", "11"] },               // Cm7 + B♭ → Cm7(9,11)
    { g: "sowhat", v: ["11", "b7", "b3", "5"] }, { g: "sowhat", v: ["1", "11", "b7", "b3", "5"] },
  ],
  m7b5: [
    { g: "close", v: ["b7", "1", "b3", "b5"] }, { g: "close", v: ["b3", "b5", "b7", "1"] },
    { g: "ust", v: ["b3", "b5", "b7", "9", "11"] },                          // Cm7(♭5,9,11) — 엔진은 텐션 1개까지지만 이 모양만 예외
  ],
  "7sus4": [
    { g: "hybrid", v: ["b7", "9", "4", "13"] }, { g: "hybrid", v: ["5", "b7", "9", "4"] },
    { g: "hybrid", v: ["b7", "9", "4", "13", "1"] }, { g: "hybrid", v: ["5", "b7", "b9", "4"] },
  ],
  mM7: [{ g: "251", v: ["b3", "5", "7", "9"] }, { g: "251", v: ["7", "9", "b3", "5"] }],
  "69": [{ g: "a", v: ["3", "6", "9", "5"] }, { g: "a", v: ["3", "5", "6", "9"], root: true }, { g: "a", v: ["6", "9", "3", "5"] }],
  m69: [{ g: "a", v: ["b3", "6", "9", "5"] }, { g: "a", v: ["b3", "5", "6", "9"], root: true }, { g: "a", v: ["6", "9", "b3", "5"] }],
};
// 묶음 가중치 (없으면 1) — M7의 어퍼스트럭처 II·So What, m7의 So What은 낮게 (사용자 요청)
const GROUP_W = { M7: { ust: 0.4, sowhat: 0.4 }, m7: { sowhat: 0.4 } };
// 도수 글자 → 근음에서 반음
const SEMI = { "1": 0, b3: 3, "3": 4, "4": 5, b5: 6, "5": 7, "#5": 8, "6": 9, b7: 10, "7": 11, b9: 1, "9": 2, "#9": 3, "11": 5, "#11": 6, b13: 8, "13": 9 };
const TEN_TOKENS = new Set(["b9", "9", "#9", "11", "#11", "b13", "13"]);

/** 모양에 쓰인 텐션 (그 코드 종류의 구성음이 아닌 텐션 글자 — 6(9)의 9처럼 구성음이면 텐션 아님) */
function shapeTens(typeId, shape) {
  const toks = shape.v || [...shape.guides, ...shape.triad];
  const base = new Set(E.BY_ID[typeId].tones.map(([semi]) => semi));
  const out = [...new Set(toks.filter(t => TEN_TOKENS.has(t) && !base.has(SEMI[t])))];
  return out.sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
}

/**
 * 모양 하나를 실제 음으로 — 놓을 수 있는 자리 전부 [[{ midi, tone }]]
 * @param tones  그 코드(텐션 포함)의 구성음 (engine tonesFor) — 도수 글자를 철자 있는 음으로 찾을 때
 */
function placeShape(shape, rootPc, tones, bass) {
  const toneOf = tok => tones.find(t => mod12(t.pc - rootPc) === SEMI[tok]);
  const lo = Math.max(UPPER_LOW, bass + MIN_GAP), hi = STACK_HIGH;
  const out = [];
  if (shape.v) {
    const ts = shape.v.map(toneOf);
    if (ts.some(t => !t)) return out;
    for (let m = lo; m <= hi; m++) {
      if (mod12(m) !== ts[0].pc) continue;
      const v = stack(ts, m);
      if (v.at(-1).midi <= hi) out.push(v);
    }
    return out;
  }
  // 어퍼스트럭처
  const tri = shape.triad.map(toneOf);
  for (const [a, b] of [shape.guides, shape.guides.slice().reverse()]) {
    const g = [toneOf(a), toneOf(b)];
    for (let m = lo; m <= hi; m++) {
      if (mod12(m) !== g[0].pc) continue;
      const [g1, g2] = stack(g, m);
      for (let inv = 0; inv < 3; inv++) {
        const order = tri.slice(inv).concat(tri.slice(0, inv));
        // 3화음 맨 아래 음: 맨 아래 가이드톤보다 위, 위 가이드톤에서 단6도 미만 위까지 (가운데가 비지 않게)
        for (let t = g1.midi + 1; t < g2.midi + 8; t++) {
          if (mod12(t) !== order[0].pc) continue;
          const trv = stack(order, t);
          const all = [g1, g2, ...trv].sort((x, y) => x.midi - y.midi).filter((n, i, arr) => !i || n.midi !== arr[i - 1].midi);
          if (all.at(-1).midi <= hi) out.push(all);
        }
      }
    }
  }
  return out;
}

/**
 * 이 문제에서 쓸 수 있는 유명한 모양들 { shape, tens } (설정에 맞는 것만)
 * @param s  출제 설정 — inv·tens·tenMax
 */
function shapesFor(typeId, s) {
  const list = SHAPES[typeId];
  if (!list) return [];
  const sixNine = typeId === "69" || typeId === "m69";
  return list.map(shape => ({ shape, tens: shapeTens(typeId, shape) })).filter(({ shape, tens }) => {
    if (sixNine) return s.inv || shape.root;                 // 자리바꿈 꺼짐: 기본형(3·5·6·9)만
    if (!s.inv) return false;
    if (!tens.length) return true;                           // 텐션 없는 모양(m7(♭5) 밀집형)
    return s.tens && (s.tenMax !== 1 || tens.length <= 1);   // [최대 1개]면 텐션 1개짜리만, [제한 없음]이면 다 (3개짜리도)
  });
}

/** 묶음 가중치대로 모양 하나 고르기 */
function pickShape(typeId, cands, rnd) {
  const groups = [...new Set(cands.map(c => c.shape.g))];
  const w = g => GROUP_W[typeId]?.[g] ?? 1;
  let x = rnd() * groups.reduce((a, g) => a + w(g), 0), gi = 0;
  while (gi < groups.length - 1 && (x -= w(groups[gi])) >= 0) gi++;
  return pick(cands.filter(c => c.shape.g === groups[gi]), rnd);
}

// ---------- 분수코드 (2026-11-26 사용자 결정) ----------
// 출제 설정 "분수코드 허용"이면 SLASH_RATE 비율로 분수코드. 그 안에서 전위형 90 : 하이브리드 10.
// 전위형은 코드 초견(improv/slash.js INVERSIONS — 단 켜는 조건은 위 코드의 종류 칩 그대로), 하이브리드는 근음 있는 이름으로 적기 애매한 것만(HYBRID_KEEP):
//   D/C · G/C · Ddim7/C · Bdim7/C · Am/D   (B♭/C = C9sus4처럼 근음 이름으로 쓸 수 있는 것은 뺌)
// 화면은 위 코드의 근음 + 입력칸 + "/베이스", 답은 위 코드의 종류만. 텐션·유명한 모양은 붙이지 않음.
// 하이브리드의 위 코드는 자리바꿈 허용이어도 늘 기본형(밀집)
export const SLASH_RATE = 0.25, SLASH_INV_SHARE = 0.9;
export const SLASH_ROOT_BELOW = 64;   // 분수코드 위 코드의 근음은 이 음(E4) 아래
const IV = { "3": [4, 3], b3: [3, 3], "5": [7, 5], b7: [10, 7] };
const HYBRID_KEEP = new Set(["maj|10", "maj|5", "dim7|10", "dim7|1", "min|5"]);
const SLASH_INVS = INVERSIONS.map(([type, iv, when]) => ({ type, iv: IV[iv], when, w: 1 }));
const SLASH_HYBS = HYBRIDS.filter(([type, iv]) => HYBRID_KEEP.has(type + "|" + iv[0])).map(([type, iv, w, when]) => ({ type, iv, when, w }));

/**
 * 분수코드 모양 하나 고르기 — 없으면 null. 위 코드의 종류가 출제 설정에서 켜져 있을 때만 (2026-11-26 사용자 요청 —
 * 코드 초견의 "켜는 조건"(C/E는 M7·7이 켜져 있어도)은 쓰지 않음: 3화음을 고르지 않았는데 3화음 분수코드가 나왔음)
 */
function pickSlash(types, rnd) {
  const on = list => list.filter(x => types.includes(x.type));
  const inv = on(SLASH_INVS), hyb = on(SLASH_HYBS);
  const kind = !hyb.length ? inv : !inv.length ? hyb : rnd() < SLASH_INV_SHARE ? inv : hyb;
  if (!kind.length) return null;
  let x = rnd() * kind.reduce((a, k) => a + k.w, 0), i = 0;
  while (i < kind.length - 1 && (x -= kind[i].w) >= 0) i++;
  return { ...kind[i], hybrid: kind === hyb };
}

const mod12 = n => ((n % 12) + 12) % 12;
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const ACC_TEXT = a => (a > 0 ? "♯" : "♭").repeat(Math.abs(a));

/** 코드 종류의 표준 이름 (근음 뒤에 붙는 글자) — 메이저 3화음은 칩·안내에서 "M"으로 (근음만 쓰면 빈칸이라서) */
export const typeText = (id, forChip = false) => (id === "maj" && forChip ? "M" : E.BY_ID[id].std[0]);
/** 근음 글자 { l, a } → "B♭" */
export const rootText = r => E.LET[r.l] + ACC_TEXT(r.a);

/** 한 문제의 텐션 고르기 (0~max개). 같은 도수끼리는 함께 쓰지 않음(♭9·♯9만 예외 — 엔진과 같은 규칙), 낮은 것부터 */
export function chooseTensions(typeId, max, rnd = Math.random) {
  const T = E.BY_ID[typeId];
  const pool = (T.ten || []).filter(id => TEN_W[typeId]?.[id]);
  max = Math.min(max, T.maxTen || 9);
  if (!pool.length || max < 1) return [];
  const w = COUNT_W[Math.min(max, 2)];
  let x = rnd(), n = 0;
  while (n < w.length - 1 && x > w[n]) { x -= w[n]; n++; }
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, id) => a + TEN_W[typeId][id], 0);
    let y = rnd() * total, i = 0;
    while (i < pool.length - 1 && (y -= TEN_W[typeId][pool[i]]) >= 0) i++;
    const t = pool.splice(i, 1)[0];
    const deg = E.TEN[t][1];
    if (out.every(o => E.TEN[o][1] !== deg || new Set([o, t]).size === 2 && [o, t].includes("b9") && [o, t].includes("#9"))) out.push(t);
  }
  return out.sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
}

/** 위 화음에 쌓을 음 (텐션이 있으면 근음 빼고, 2개면 완전5음도 뺌) — 낮은 도수부터, 텐션은 맨 뒤 */
function upperTones(tones, tens) {
  if (!tens.length) return tones;
  return tones.filter(t => t.deg !== 1 && !(tens.length >= 2 && t.role === "optional" && t.deg === 5));
}
/** 7sus4(♭13)은 완전5음을 뺌 — ♭13과 반음으로 부딪혀서 (2026-11-25 사용자 결정, 두 배치 모두) */
const dropSus5 = (tones, typeId, tens) => (E.susB13({ type: typeId, tens }) ? tones.filter(t => !(t.deg === 5 && t.semi === 7)) : tones);

// 원래 철자가 읽기 어려운 음인지: 𝄫 𝄪, C♭ F♭ E♯ B♯ (코드 추론하기와 같은 기준)
const oddSpelling = t => Math.abs(t.a) === 2 || ((t.l === 0 || t.l === 3) && t.a === -1) || ((t.l === 2 || t.l === 6) && t.a === 1);

// 도수: 엔진의 텐션 음에는 deg가 없어서 텐션 id로 (♭9 → 9)
const degOf = t => t.deg ?? (t.ten ? E.TEN[t.ten][1] : undefined);

/** 음 하나 (건반·악보가 쓰는 모양): 읽기 어려운 철자는 쉬운 이름으로 바꿈(B𝄫 → A, F♭ → E) */
function noteOf(midi, t) {
  let { l, a } = t;
  if (oddSpelling(t)) {
    const name = E.simpleName(mod12(midi), a);
    l = E.LET.indexOf(name[0]);
    a = name.includes("♯") ? 1 : name.includes("♭") ? -1 : 0;
  }
  return { midi, l, a, oct: (midi - E.NAT[l] - a) / 12 - 1, name: E.LET[l] + ACC_TEXT(a), deg: degOf(t) };   // deg: 그 코드에서의 도수 (내 답 듣기에 씀)
}

// 검은 건반 근음의 철자 후보 (♯ 이름, ♭ 이름) — 같으면 기본은 D♭ E♭ F♯ A♭ B♭
const BLACK = { 1: [[0, 1], [1, -1]], 3: [[1, 1], [2, -1]], 6: [[3, 1], [4, -1]], 8: [[4, 1], [5, -1]], 10: [[5, 1], [6, -1]] };
const BLACK_DEFAULT = { 1: 1, 3: 1, 6: 0, 8: 1, 10: 1 };   // 위 후보 중 기본 순번

/** 근음 pc의 철자: 검은 건반이면 구성음에 읽기 어려운 철자가 적은 쪽 (C♯m7 ← D♭m7은 F♭·C♭이 생김), 같으면 기본 */
export function spellRoot(pc, typeId) {
  if (!BLACK[pc]) return { l: E.NAT.indexOf(pc), a: 0 };
  const odd = ([l, a]) => E.tonesFor(typeId, { l, a }, []).tones.filter(oddSpelling).length;
  const [s, f] = BLACK[pc];
  const os = odd(s), of = odd(f);
  const [l, a] = os < of ? s : of < os ? f : BLACK[pc][BLACK_DEFAULT[pc]];
  return { l, a };
}

/** 구성음을 주어진 순서대로, 앞 음 바로 위(같은 pc의 가장 가까운 위 자리)에 하나씩 쌓음 — lowest가 첫 음 */
function stack(tones, lowest) {
  const out = [];
  let m = lowest;
  for (const t of tones) {
    while (mod12(m) !== t.pc) m++;
    out.push({ midi: m, tone: t });
    m++;
  }
  return out;
}

// 맨 아래 음 규칙에서 텐션처럼 세는 음: 텐션 + aug 계열(aug·aug7·augM7)의 ♯5 (2026-11-25 사용자 요청)
const tensionLike = t => t.role === "tension" || (t.deg === 5 && t.semi === 8);

// 핵심음: 코드의 성격을 정하는 음 — 3음·7음(가이드톤) + sus의 2·4음 + m7(♭5)의 ♭5음 (2026-11-25 사용자 정의)
const isCore = (t, typeId) => [2, 3, 4, 7].includes(t.deg) || (typeId === "m7b5" && t.deg === 5);

/**
 * 자리바꿈 허용일 때 위 화음으로 놓을 수 있는 배치 전부 (규칙은 파일 머리 "위 화음 배치").
 * 음마다 음역(F3~D5, 베이스 + 단3도 이상) 안의 모든 옥타브 자리를 조합한 뒤 규칙에 맞는 것만.
 * @param tones   위 화음 구성음 (upperTones)
 * @param bass    베이스 MIDI
 * @param o       { typeId, tension: 텐션이 있는 문제인지 }
 * @returns [[{ midi, tone }] 낮은 음부터]
 */
function voicings(tones, bass, { typeId, tension }) {
  const lo = Math.max(UPPER_LOW, bass + MIN_GAP);
  const spots = tones.map(t => { const a = []; for (let m = lo; m <= UPPER_HIGH; m++) if (mod12(m) === t.pc) a.push({ midi: m, tone: t }); return a; });
  const out = [];
  const walk = (i, acc) => {
    if (i === spots.length) { const v = acc.slice().sort((a, b) => a.midi - b.midi); if (fits(v)) out.push(v); return; }
    for (const p of spots[i]) { acc.push(p); walk(i + 1, acc); acc.pop(); }
  };
  const fits = v => {
    // 이웃한 음 간격: 7도 이상(반음 10개~) 없음, 6도(반음 8·9개)는 맨 아래 두 음 사이에서만 — 아래는 넓게 위는 좁게
    // (드롭 3처럼 맨 아래만 넓은 배치는 살림, 2026-11-25 사용자 결정. 전에는 한 옥타브 미만이면 됐음)
    for (let i = 1; i < v.length; i++) {
      const d = v[i].midi - v[i - 1].midi;
      if (d >= 10 || (d >= 8 && i > 1)) return false;
    }
    const low = v[0];
    // 맨 아래 텐션(aug의 ♯5 포함)은 베이스(E2보다 낮으면 한 옥타브 위 베이스)에서 한 옥타브 이상
    const ref = bass < REF_BASS ? bass + 12 : bass;
    if (tensionLike(low.tone) && low.midi - ref < 12) return false;
    if (tension) {
      const core = v.filter(n => isCore(n.tone, typeId));
      if (core.some(n => n.midi >= CORE_TOP)) return false;
      if (core.length && core.at(-1).midi - core[0].midi >= 12) return false;
      const avg = v.reduce((a, n) => a + n.midi, 0) / v.length;
      if (core.filter(n => n.midi > avg).length >= 2) return false;
      // 7sus4(♭9,13): 13은 7음 위 장7도에만 — 13이 7음 아래로 가면 단2도로 붙어 뭉침(2026-11-25 사용자 요청)
      if (typeId === "7sus4") {
        const s7 = v.find(n => n.tone.deg === 7), t13 = v.find(n => n.tone.ten === "13");
        if (s7 && t13 && v.some(n => n.tone.ten === "b9") && t13.midi - s7.midi !== 11) return false;
        // 7sus4(9,♭13): 아래부터 7 · 9 · 4 · ♭13 순서만 — 다른 자리바꿈은 7sus4처럼 안 들림 (2026-11-25 사용자 요청)
        const ts = v.map(n => n.tone.ten || n.tone.deg);
        if (v.some(n => n.tone.ten === "9") && v.some(n => n.tone.ten === "b13") && ts.join() !== "7,9,4,b13") return false;
        // 7sus4(♭13): 아래부터 ♭7 · 4 · ♭13만 (5음은 이미 뺌)
        if (v.some(n => n.tone.ten === "b13") && !v.some(n => n.tone.ten === "9") && ts.join() !== "7,4,b13") return false;
      }
      // 7(♯11,13): 아래부터 3 · ♯11 · 13 · ♭7 배치는 내지 않음 — 소리가 좋지 않음 (2026-11-26 사용자 요청, C7의 E F♯ A B♭)
      if (typeId === "dom7" && v.map(n => n.tone.ten || n.tone.deg).join() === "3,#11,13,7") return false;
    }
    return true;
  };
  walk(0, []);
  return out;
}

/** 네 음이 이어서 2도(반음·온음) 간격으로 붙은 뭉침이 있는지 — D♭ E♭ F G♭처럼 (2026-11-25 사용자 요청, 코드 추론하기 보이싱과 같은 규칙) */
function secondRun(v) {
  for (let i = 0; i + 3 < v.length; i++) if ([1, 2, 3].every(k => v[i + k].midi - v[i + k - 1].midi <= 2)) return true;
  return false;
}

/**
 * 단9도·단16도(한 옥타브 넘게 떨어진 반음)가 있는지 — 거칠게 들려서 그런 배치는 내지 않음 (2026-11-25 사용자 요청,
 * Gm7(♭5,11)의 C4·D♭5가 이상하게 들렸음). 단2도(한 옥타브 안의 반음)는 괜찮음.
 * 예외: 근음 위의 ♭9(C7(♭9)의 C·D♭), 완전5음 위의 ♭13(C7(♭13)의 G·A♭) — 코드 이름에 든 음정이라서.
 * 코드 추론하기의 보이싱 규칙(spec "코드 추론하기" ③)과 같음
 * @param notes [{ midi, tone }] (tone: engine 구성음 — deg·ten)
 */
function hasMinorNinth(notes) {
  for (const a of notes) for (const b of notes) {
    const d = b.midi - a.midi;
    if (d <= 12 || d % 12 !== 1) continue;
    if (a.tone.deg === 1 && b.tone.ten === "b9") continue;
    if (a.tone.deg === 5 && mod12(b.midi - a.midi) === 1 && b.tone.ten === "b13") continue;
    return true;
  }
  return false;
}

/**
 * 문제 하나.
 * @param s     { types: [코드 종류 id], inv: 자리바꿈 허용, tens: 텐션 허용, tenMax: 1 = 최대 1개 · 2 = 제한 없음, slash: 분수코드 허용,
 *                bassLow: 악기가 낼 수 있는 가장 낮은 음(없으면 BASS_LOW) }
 * @param prev  바로 앞 문제 (같은 코드 종류는 연달아 내지 않음 — 하나뿐이면 예외)
 * @returns { type, tens: [텐션 id], root, rootPc, bass: 음, upper: [음], pcs, name, shape: 유명한 모양의 묶음 이름(아니면 null),
 *            slash?: { name: 베이스 이름, hybrid } (분수코드) }
 */
export function makeChord(s, rnd = Math.random, prev = null) {
  const pool = s.types.length ? s.types : DEFAULT_TYPES;
  const choices = pool.length > 1 && prev ? pool.filter(id => id !== prev.type) : pool;
  const low = Math.max(BASS_LOW, s.bassLow ?? BASS_LOW);
  const bassIn = (pc, rnd) => { const o = []; for (let m = low; m <= BASS_HIGH; m++) if (mod12(m) === pc) o.push(m); return pick(o, rnd); };
  for (let tries = 0; tries < 60; tries++) {
    // 분수코드 (출제 설정에서 켰을 때 SLASH_RATE 비율)
    if (s.slash && rnd() < SLASH_RATE) {
      const q = makeSlash(s, pool, rnd, bassIn);
      if (q) return q;
    }
    const type = pick(choices, rnd);
    // 베이스: 근음 건반(12개 중 무작위) → 그 음의 옥타브 자리가 여럿이면 똑같은 비율로 (2026-11-25 사용자 요청)
    const rootPc = Math.floor(rnd() * 12);
    const bassMidi = bassIn(rootPc, rnd);
    const root = spellRoot(rootPc, type);
    // 유명한 모양 (6(9)·m6(9)는 늘, 나머지는 TEMPLATE_P 비율로)
    const shapes = shapesFor(type, s);
    if (shapes.length && (type === "69" || type === "m69" || rnd() < TEMPLATE_P)) {
      const { shape, tens } = pickShape(type, shapes, rnd);
      const all = E.tonesFor(type, root, tens).tones;
      const cands = placeShape(shape, rootPc, all, bassMidi);
      if (!cands.length) continue;
      // D5 안에 들어가는 자리가 있으면 그중에서 (5음짜리 모양만 A5까지 — 너무 높은 자리만 나오지 않게)
      const inRange = cands.filter(v => v.at(-1).midi <= UPPER_HIGH);
      return build(type, tens, root, rootPc, bassMidi, all, pick(inRange.length ? inRange : cands, rnd), shape.g);
    }
    const tens = s.tens ? chooseTensions(type, s.tenMax === 1 ? 1 : 2, rnd) : [];
    // 7sus4(♭13)은 자리바꿈 허용에서 ♭7 · 4 · ♭13 모양으로만 (텐션은 ♭13 하나) — 꺼져 있으면 내지 않음 (2026-11-26 사용자 요청)
    if (type === "7sus4" && tens.includes("b13") && (!s.inv || tens.length > 1)) continue;
    const all = E.tonesFor(type, root, tens).tones;
    let st, tones;
    if (!s.inv) {
      // 자리바꿈 꺼짐: 기본형만 — 구성음 순서(1 3 5 7 텐션)대로 바로 위에 하나씩 쌓은 밀집 배치 (2026-11-25 사용자 요청).
      // 텐션이 있으면 근음은 베이스만 내고 3음부터 쌓음(5음은 남김), 위쪽 끝은 STACK_HIGH까지 — 3음이 어느 음이든 다 들어가게
      tones = dropSus5(tens.length ? all.filter(t => t.deg !== 1) : all, type, tens);
      st = rootPosition(tones, bassMidi, all[0], tens.length ? STACK_HIGH : UPPER_HIGH, rnd);
      if (!st) continue;
    } else {
      // 자리바꿈 허용: 배치 규칙(voicings)에 맞고 단9도가 없는 것 중 — 밀집 배치(한 옥타브 안)가 있으면 CLOSE_P 비율로 그중에서
      tones = dropSus5(upperTones(all, tens), type, tens);
      st = ruledVoicing(tones, bassMidi, all[0], type, tens.length > 0, rnd);
      if (!st) continue;
    }
    return build(type, tens, root, rootPc, bassMidi, all, st, null);
  }
  return null;
}

/** 위 화음의 근음(있으면)이 모두 rootBelow 아래인지 — 분수코드에서 씀 */
const rootOk = (v, rootBelow) => v.every(n => n.tone.deg !== 1 || n.midi < rootBelow);

/** 자리바꿈 꺼짐: tones를 순서대로 쌓은 기본형 중 하나 (음역 hi까지, 단9도 없는 것) — 없으면 null */
function rootPosition(tones, bassMidi, bassTone, hi, rnd, rootBelow = Infinity) {
  const cands = [];
  for (let m = Math.max(UPPER_LOW, bassMidi + MIN_GAP); m <= hi; m++) {
    if (mod12(m) !== tones[0].pc) continue;
    const v = stack(tones, m);
    if (v.at(-1).midi <= hi && rootOk(v, rootBelow) && !hasMinorNinth([{ midi: bassMidi, tone: bassTone }, ...v])) cands.push(v);
  }
  return cands.length ? pick(cands, rnd) : null;
}

/** 자리바꿈 허용: 배치 규칙에 맞는 것 중 하나 (밀집 배치를 CLOSE_P 비율로) — 없으면 null */
function ruledVoicing(tones, bassMidi, bassTone, typeId, tension, rnd, rootBelow = Infinity) {
  const cands = voicings(tones, bassMidi, { typeId, tension })
    .filter(v => rootOk(v, rootBelow) && !secondRun(v) && !hasMinorNinth([{ midi: bassMidi, tone: bassTone }, ...v]));
  if (!cands.length) return null;
  const close = cands.filter(v => v.at(-1).midi - v[0].midi < 12);
  const open = cands.filter(v => v.at(-1).midi - v[0].midi >= 12);
  return pick(close.length && (!open.length || rnd() < CLOSE_P) ? close : open, rnd);
}

/** 문제 객체 만들기 (보통 코드) */
function build(type, tens, root, rootPc, bassMidi, all, st, shape) {
  const upper = st.map(({ midi, tone }) => noteOf(midi, tone));
  return {
    type, tens, root, rootPc, shape,
    bass: noteOf(bassMidi, all[0]),
    upper,
    pcs: new Set([rootPc, ...upper.map(n => mod12(n.midi))]),   // 채점용 — 근음은 위 화음에서 빠져도 베이스가 냄
    name: chordName({ type, tens, root }),
  };
}

/**
 * 분수코드 문제 하나 (모양은 pickSlash). 위 화음은 위 코드 전부(근음 포함)를 보통 코드와 같은 규칙으로 — 텐션 없음
 * @returns 보통 문제와 같은 모양 + slash: { name: 베이스 이름, hybrid } — 채점 음(pcs)은 위 코드만(베이스 음은 문제에 보여 줌)
 */
function makeSlash(s, types, rnd, bassIn) {
  const sl = pickSlash(types, rnd);
  if (!sl) return null;
  const rootPc = Math.floor(rnd() * 12);
  const root = spellRoot(rootPc, sl.type);
  const [semi, deg] = sl.iv;
  const bt = E.spellTone(root, semi, deg);
  if (Math.abs(bt.a) > 2) return null;
  const bassMidi = bassIn(bt.pc, rnd);
  const bassTone = { ...bt, deg: sl.hybrid ? null : deg, role: "bass" };
  const all = E.tonesFor(sl.type, root, []).tones;
  // 하이브리드의 위 코드는 자리바꿈 허용이어도 늘 기본형 (2026-11-26 사용자 요청)
  // 위 코드의 근음은 E4 아래 — 위에 있으면 다른 코드처럼 들림(B♭m7/D♭이 D♭6처럼, 2026-11-26 사용자 요청)
  const st = s.inv && !sl.hybrid ? ruledVoicing(all, bassMidi, bassTone, sl.type, false, rnd, SLASH_ROOT_BELOW)
    : rootPosition(all, bassMidi, bassTone, UPPER_HIGH, rnd, SLASH_ROOT_BELOW);
  if (!st) return null;
  const upper = st.map(({ midi, tone }) => noteOf(midi, tone));
  const bass = noteOf(bassMidi, bassTone);
  return {
    type: sl.type, tens: [], root, rootPc, shape: null,
    bass, upper,
    slash: { name: bass.name, hybrid: sl.hybrid },
    pcs: new Set(all.map(t => t.pc)),
    name: chordName({ type: sl.type, tens: [], root }) + "/" + bass.name,
  };
}

/**
 * 답 판정.
 * @param input  사용자가 쓴 글자 (근음 뒤 부분 — "m7♭5", 빈칸이면 메이저 3화음)
 * @param q      makeChord가 만든 문제
 * @returns { correct, chord?: { type, tens, root } (읽은 코드 — 내 답 듣기에 씀), error?: "noParen" | "unknown" | "root" }
 *   root: 근음 글자까지 써서 근음이 둘이 된 경우(Cm7 → "C" + "Cm7")
 */
export function judgeChord(input, q) {
  const text = String(input || "").replace(/\s+/g, "");
  if (/^[A-G]/.test(text)) return { correct: false, error: "root" };
  const p = parse(rootText(q.root) + text);
  if (p.error) return { correct: false, error: p.error === "noParen" ? "noParen" : "unknown" };
  const parts = E.tonesFor(p.type, p.root, p.tens);
  const fits = pcs => [...parts.required].every(pc => pcs.has(pc)) && [...pcs].every(pc => parts.required.has(pc) || parts.optional.has(pc));
  // 분수코드: 베이스 음까지 넣은 코드도 정답 — B♭/A♭ = B♭7/A♭, Dm/C = Dm7/C, D/C = D7/C (2026-11-26 사용자 요청)
  const correct = fits(q.pcs) || (!!q.slash && fits(new Set([...q.pcs, mod12(q.bass.midi)])));
  return { correct, chord: { type: p.type, tens: p.tens, root: p.root } };
}

// 도수 → 자리: 근음 1 · 3음 자리(2·3·4 — sus2·sus4는 3음 대신) · 5음 · 7음 자리(6·7 — 6화음의 6은 7음 대신) · 텐션은 그대로
const slotOf = d => (d === 1 ? 1 : d <= 4 ? 3 : d === 5 ? 5 : d <= 7 ? 7 : d);

/**
 * 같은 베이스·같은 배치에서 다른 코드를 울릴 음 (내 답 듣기 — 틀린 답과 정답을 같은 근음으로 비교).
 * 문제의 위 화음에서 음마다 같은 자리(도수)의 음을 내 답 코드의 음으로 바꿔 끼움 → 자리바꿈 모양이 그대로
 * (2026-11-25 사용자 요청 — 정답 CM7이 미솔시도면 C7은 미솔시♭도). 같은 자리가 없는 음은 빼고,
 * 문제에 없는 자리의 음은: 근음이면 뺌(베이스가 냄), 텐션이면 위 화음 맨 위 음 위에, 그 밖(7음 등)은 맨 아래 음 위 한 옥타브 안
 * @returns { bass, upper } (MIDI 번호들, 위 화음은 낮은 음부터)
 */
export function voiceLike(chord, q) {
  const tones = E.tonesFor(chord.type, chord.root, chord.tens).tones;
  const used = new Set(), out = [];
  const nearest = (pc, ref) => { const d = mod12(pc - ref); return d <= 6 ? ref + d : ref + d - 12; };
  const top = q.upper.at(-1).midi;
  for (const t of tones) {
    const d = degOf(t);
    const ref = q.upper.find(n => !used.has(n) && slotOf(n.deg) === slotOf(d));
    if (ref) { used.add(ref); out.push(nearest(t.pc, ref.midi)); }
    else if (d === 1) continue;                                      // 근음 자리가 없음(텐션 문제) → 베이스가 냄
    else if (d >= 9) out.push(top + (mod12(t.pc - top) || 12));      // 문제에 없는 텐션 → 위 화음 위쪽에
    else out.push(q.upper[0].midi + mod12(t.pc - q.upper[0].midi));
  }
  return { bass: q.bass.midi, upper: [...new Set(out)].sort((a, b) => a - b) };
}

/** 코드 이름 (표기용): 근음 + 코드 종류 + 텐션 */
export function chordName(chord) {
  const T = E.BY_ID[chord.type];
  const m = T.std[0].match(/^(.*)\((.*)\)$/);
  const head = m ? m[1] : T.std[0];
  const items = (m ? m[2].split(",") : []).concat((chord.tens || []).map(E.tenText));
  return rootText(chord.root) + head + (items.length ? "(" + items.join(",") + ")" : "");
}
