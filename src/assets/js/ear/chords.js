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
//       7sus4(9,♭13)은 아래부터 7 · 9 · 4 · ♭13 순서일 때만
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
  { key: "earCSixths", ids: ["6", "m6"] },
];
// 처음 켜짐: 3화음 모두 끔, aug 계열(aug7·augM7)을 뺀 7화음 전부 + 6화음
export const DEFAULT_TYPES = ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "6", "m6"];

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
      }
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
 * @param s     { types: [코드 종류 id], inv: 자리바꿈 허용, tens: 텐션 허용, tenMax: 텐션 최대 개수(1·2),
 *                bassLow: 악기가 낼 수 있는 가장 낮은 음(없으면 BASS_LOW) }
 * @param prev  바로 앞 문제 (같은 코드 종류는 연달아 내지 않음 — 하나뿐이면 예외)
 * @returns { type, tens: [텐션 id], root, rootPc, bass: 음, upper: [음], pcs, name, inv: 자리바꿈 순번 }
 */
export function makeChord(s, rnd = Math.random, prev = null) {
  const pool = s.types.length ? s.types : DEFAULT_TYPES;
  const choices = pool.length > 1 && prev ? pool.filter(id => id !== prev.type) : pool;
  const low = Math.max(BASS_LOW, s.bassLow ?? BASS_LOW);
  for (let tries = 0; tries < 60; tries++) {
    const type = pick(choices, rnd);
    // 베이스: 근음 건반(12개 중 무작위) → 그 음의 옥타브 자리가 여럿이면 똑같은 비율로 (2026-11-25 사용자 요청)
    const rootPc = Math.floor(rnd() * 12);
    const bassOpts = [];
    for (let m = low; m <= BASS_HIGH; m++) if (mod12(m) === rootPc) bassOpts.push(m);
    const bassMidi = pick(bassOpts, rnd);
    const root = spellRoot(rootPc, type);
    const tens = s.tens ? chooseTensions(type, s.tenMax || 1, rnd) : [];
    const all = E.tonesFor(type, root, tens).tones;
    let st, tones;
    if (!s.inv) {
      // 자리바꿈 꺼짐: 기본형만 — 구성음 순서(1 3 5 7 텐션)대로 바로 위에 하나씩 쌓은 밀집 배치 (2026-11-25 사용자 요청).
      // 텐션이 있으면 근음은 베이스만 내고 3음부터 쌓음(5음은 남김), 위쪽 끝은 STACK_HIGH까지 — 3음이 어느 음이든 다 들어가게
      tones = dropSus5(tens.length ? all.filter(t => t.deg !== 1) : all, type, tens);
      const top = tens.length ? STACK_HIGH : UPPER_HIGH;
      const cands = [];
      for (let m = Math.max(UPPER_LOW, bassMidi + MIN_GAP); m <= top; m++) {
        if (mod12(m) !== tones[0].pc) continue;
        const v = stack(tones, m);
        if (v.at(-1).midi <= top && !hasMinorNinth([{ midi: bassMidi, tone: all[0] }, ...v])) cands.push(v);
      }
      if (!cands.length) continue;
      st = pick(cands, rnd);
    } else {
      // 자리바꿈 허용: 배치 규칙(voicings)에 맞고 단9도가 없는 것 중 — 밀집 배치(한 옥타브 안)가 있으면 CLOSE_P 비율로 그중에서
      tones = dropSus5(upperTones(all, tens), type, tens);
      const cands = voicings(tones, bassMidi, { typeId: type, tension: tens.length > 0 })
        .filter(v => !secondRun(v) && !hasMinorNinth([{ midi: bassMidi, tone: all[0] }, ...v]));
      if (!cands.length) continue;
      const close = cands.filter(v => v.at(-1).midi - v[0].midi < 12);
      const open = cands.filter(v => v.at(-1).midi - v[0].midi >= 12);
      st = pick(close.length && (!open.length || rnd() < CLOSE_P) ? close : open, rnd);
    }
    const inv = tones.indexOf(st[0].tone);
    const upper = st.map(({ midi, tone }) => noteOf(midi, tone));
    return {
      type, tens, root, rootPc, inv,
      bass: noteOf(bassMidi, all[0]),
      upper,
      pcs: new Set([rootPc, ...upper.map(n => mod12(n.midi))]),   // 채점용 — 근음은 위 화음에서 빠져도 베이스가 냄
      name: chordName({ type, tens, root }),
    };
  }
  return null;
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
  const correct = [...parts.required].every(pc => q.pcs.has(pc)) && [...q.pcs].every(pc => parts.required.has(pc) || parts.optional.has(pc));
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
