// ===== 청음 연습 — 코드 ① 코드 종류: 출제·채점 (순수 함수, 화면 없음 → tests/ear-chords.test.js) =====
// 코드 하나를 듣고 코드 종류(m7, M7, sus4 …)를 맞히는 단계. 규칙은 chordoven-spec.md "청음 연습" 코드 ① (2026-11-25 사용자 결정):
//   - 소리: 베이스(근음 하나, E2~D♯3) + 위 화음(E3~D5, 밀집 배치). 베이스와 위 화음의 가장 아래 음은 완전4도(반음 5개) 이상 떨어짐
//     → 자리바꿈을 허용해도 위 성부의 보이싱만 달라지고 베이스는 늘 근음이라, 정답이 여러 개가 되지 않음
//   - 근음 글자는 문제에 보여 주고, 답은 그 뒤의 코드 종류만 씀(코드 추론하기의 입력칸·키패드)
//   - 채점: 코드 추론하기의 이름 읽기(core/naming.js parse)로 "근음 + 쓴 글자"를 읽고, 그 코드의 필수 구성음이 문제의 음과
//     맞으면 정답 → m7(♭5) = m7♭5 = m7(-5)처럼 표기가 달라도 맞음. 빈칸으로 제출하면 메이저 3화음(근음만 쓴 것)으로 봄
//     (2026-11-25 사용자 요청 — 메이저 3화음은 그냥 [제출])
// 코드 종류·구성음은 core/engine.js(TYPES, tonesFor, spellTone)를 그대로 씀.
import { Engine as E } from "../core/engine.js";
import { parse } from "../core/naming.js";

export const BASS_LOW = 40, BASS_HIGH = 51;    // 베이스(근음): E2 ~ D♯3 (E3 미만 — 기타 음역 고려)
export const UPPER_LOW = 52, UPPER_HIGH = 74;  // 위 화음: E3 ~ D5
export const MIN_GAP = 5;                      // 베이스와 위 화음 가장 아래 음 사이 최소 간격 (반음, 완전4도)

// 출제할 수 있는 코드 종류 (출제 설정의 칩 묶음 — 사용자 결정 2026-11-25). id는 engine TYPES의 id
export const GROUPS = [
  { key: "earCTriads", ids: ["maj", "min", "dim", "aug", "sus4", "sus2"] },
  { key: "earCSevenths", ids: ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "aug7", "augM7"] },
  { key: "earCSixths", ids: ["6", "m6"] },
];
// 처음 켜짐: 3화음 모두 끔, aug 계열(aug7·augM7)을 뺀 7화음 전부 + 6화음
export const DEFAULT_TYPES = ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "6", "m6"];

const mod12 = n => ((n % 12) + 12) % 12;
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const ACC_TEXT = a => (a > 0 ? "♯" : "♭").repeat(Math.abs(a));

/** 코드 종류의 표준 이름 (근음 뒤에 붙는 글자) — 메이저 3화음은 칩·안내에서 "M"으로 (근음만 쓰면 빈칸이라서) */
export const typeText = (id, forChip = false) => (id === "maj" && forChip ? "M" : E.BY_ID[id].std[0]);
/** 근음 글자 { l, a } → "B♭" */
export const rootText = r => E.LET[r.l] + ACC_TEXT(r.a);

// 원래 철자가 읽기 어려운 음인지: 𝄫 𝄪, C♭ F♭ E♯ B♯ (코드 추론하기와 같은 기준)
const oddSpelling = t => Math.abs(t.a) === 2 || ((t.l === 0 || t.l === 3) && t.a === -1) || ((t.l === 2 || t.l === 6) && t.a === 1);

/** 음 하나 (건반·악보가 쓰는 모양): 읽기 어려운 철자는 쉬운 이름으로 바꿈(B𝄫 → A, F♭ → E) */
function noteOf(midi, t) {
  let { l, a } = t;
  if (oddSpelling(t)) {
    const name = E.simpleName(mod12(midi), a);
    l = E.LET.indexOf(name[0]);
    a = name.includes("♯") ? 1 : name.includes("♭") ? -1 : 0;
  }
  return { midi, l, a, oct: (midi - E.NAT[l] - a) / 12 - 1, name: E.LET[l] + ACC_TEXT(a), deg: t.deg };   // deg: 그 코드에서의 도수 (내 답 듣기에 씀)
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

/**
 * 위 화음 배치: 코드 구성음(근음 포함)을 밀집 배치로 쌓음.
 * @param tones  engine tonesFor(...).tones (근음부터, 겹치는 pc 없이)
 * @param inv    자리바꿈 순번 (0 = 기본형, k = k번째 구성음이 맨 아래)
 * @param lowest 맨 아래 음의 MIDI 번호 (그 음의 pc는 tones[inv]의 pc여야 함)
 * @returns [{ midi, tone }] 낮은 음부터 (한 옥타브 안)
 */
function stack(tones, inv, lowest) {
  const order = tones.slice(inv).concat(tones.slice(0, inv));
  const out = [];
  let m = lowest;
  for (const t of order) {
    while (mod12(m) !== t.pc) m++;
    out.push({ midi: m, tone: t });
    m++;
  }
  return out;
}

/** 위 화음의 맨 아래 음으로 놓을 수 있는 MIDI 번호들 (pc가 맞고, 베이스와 간격·음역 안) */
function lowestOptions(tones, inv, bass) {
  const span = stack(tones, inv, 0).at(-1).midi - stack(tones, inv, 0)[0].midi;
  const out = [];
  for (let m = Math.max(UPPER_LOW, bass + MIN_GAP); m + span <= UPPER_HIGH; m++) if (mod12(m) === tones[inv].pc) out.push(m);
  return out;
}

/**
 * 문제 하나.
 * @param s     { types: [코드 종류 id], inv: 자리바꿈 허용 }
 * @param prev  바로 앞 문제 (같은 코드 종류는 연달아 내지 않음 — 하나뿐이면 예외)
 * @returns { type, root, rootPc, bass: 음, upper: [음], pcs, name, inv: 자리바꿈 순번 }
 */
export function makeChord(s, rnd = Math.random, prev = null) {
  const pool = s.types.length ? s.types : DEFAULT_TYPES;
  const choices = pool.length > 1 && prev ? pool.filter(id => id !== prev.type) : pool;
  for (let tries = 0; tries < 50; tries++) {
    const type = pick(choices, rnd);
    const bassMidi = BASS_LOW + Math.floor(rnd() * (BASS_HIGH - BASS_LOW + 1));
    const rootPc = mod12(bassMidi);
    const root = spellRoot(rootPc, type);
    const tones = E.tonesFor(type, root, []).tones;
    const inv = s.inv ? Math.floor(rnd() * tones.length) : 0;
    const opts = lowestOptions(tones, inv, bassMidi);
    if (!opts.length) continue;
    const upper = stack(tones, inv, pick(opts, rnd)).map(({ midi, tone }) => noteOf(midi, tone));
    return {
      type, root, rootPc, inv,
      bass: noteOf(bassMidi, tones[0]),
      upper,
      pcs: new Set(upper.map(n => mod12(n.midi))),
      name: rootText(root) + typeText(type),
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
 * 문제에 없는 자리의 음(7음·텐션 등)은 문제의 맨 아래 음 위 한 옥타브 안에 끼움
 * @returns { bass, upper } (MIDI 번호들, 위 화음은 낮은 음부터)
 */
export function voiceLike(chord, q) {
  const tones = E.tonesFor(chord.type, chord.root, chord.tens).tones;
  const used = new Set(), out = [];
  const nearest = (pc, ref) => { const d = mod12(pc - ref); return d <= 6 ? ref + d : ref + d - 12; };
  for (const t of tones) {
    const ref = q.upper.find(n => !used.has(n) && slotOf(n.deg) === slotOf(t.deg));
    if (ref) { used.add(ref); out.push(nearest(t.pc, ref.midi)); }
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
