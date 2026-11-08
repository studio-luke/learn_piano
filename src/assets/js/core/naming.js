// ===== 코드 추론하기 엔진 =====
// 눌린 건반·악보를 보고 코드 이름을 맞히는 연습(/trainer/chords-name/)의 규칙이에요.
// engine.js처럼 화면(DOM)을 건드리지 않는 순수 함수만 있어서 Node에서 테스트해요 (tests/naming.test.js).
// 규칙의 "왜"는 chordoven-spec.md "코드 추론하기"에 정리돼 있어요.
//
// 흐름
//   generate()  engine.generate로 코드를 고르고 → voice()로 건반 높이를 정하고 → answers()로 정답 목록을 만듦
//   check()     사용자가 쓴 글자를 parse()로 읽고, 화면의 음과 비교해 맞았는지·빠진 음·들어갈 수 없는 음을 알려줌
//
// 용어 (engine.js와 같음): pc 0~11, MIDI 번호 53=F3 … 86=D6
import { Engine as E } from "./engine.js";

export const LOW = 53, HIGH = 86;   // F3 ~ D6 — 모든 음을 높은음자리표 하나에 그릴 수 있는 범위 (사용자 결정 2026-11-08)

// 이 페이지에서 쓰는 코드 종류: 텐션 코드(M9 M13 m9 m11 9 13)는 빼고, 세븐코드에 괄호 텐션으로 답함 (사용자 결정 2026-11-08)
export const NAME_TYPES = E.TYPES.filter(t => t.group !== "tension");
const NAME_IDS = new Set(NAME_TYPES.map(t => t.id));

// 근음에서 반음 수 → 정답 목록에 쓰는 텐션 이름.
// ♭5는 ♯11로, ♯5는 ♭13으로 통일해서 보여줌 (입력은 둘 다 정답) — 사용자 결정 2026-11-08
const SEMI_TEN = { 1: "b9", 2: "9", 3: "#9", 5: "11", 6: "#11", 8: "b13", 9: "13" };

const mod12 = n => ((n % 12) + 12) % 12;
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// "E♭" → { l: 2, a: -1 } (악보에 그릴 글자와 변화표)
function letterOf(name) {
  const l = E.LET.indexOf(name[0]);
  const a = [...name.slice(1)].reduce((s, c) => s + ({ "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 }[c] || 0), 0);
  return { l, a };
}

/** 음 하나 (건반·악보가 쓰는 모양): midi, 보이는 이름, 글자 l, 변화표 a, 옥타브(C4의 4) */
function note(midi, name) {
  const { l, a } = letterOf(name);
  return { midi, name, l, a, oct: (midi - E.NAT[l] - a) / 12 - 1 };
}

// 원래 철자가 "복잡한 음 표현"인지: 𝄫 𝄪, C♭ F♭ E♯ B♯ (t.l·t.a는 쉬운 이름으로 바꾸기 전의 원래 철자)
const oddSpelling = t => Math.abs(t.a) === 2 || ((t.l === 0 || t.l === 3) && t.a === -1) || ((t.l === 2 || t.l === 6) && t.a === 1);
// 검은 건반 근음의 반대 철자 [글자, 변화표] (기본 근음 D♭ E♭ F♯ A♭ B♭ → C♯ D♯ G♭ G♯ A♯)
const OTHER_ROOT = { 1: [0, 1], 3: [1, 1], 6: [4, -1], 8: [4, 1], 10: [5, 1] };

// 구성음의 도수 (텐션은 9 11 13, ♭5·♯5는 5)
const degOf = t => (t.ten ? E.TEN[t.ten][1] : t.deg);

/**
 * 건반 높이 정하기.
 *   자리바꿈 꺼짐: 근음부터 1 3 5 7 9 11 13 순서로 바로 위에 쌓음 (5음은 늘 보여줌)
 *   자리바꿈 켜짐: 맨 아래 음을 구성음 중에서 무작위로 고르고, 나머지는 그 위 2옥타브 안에서 무작위 높이.
 *                  생략할 수 있는 5음(텐션이 붙은 코드)은 50% 확률로 뺌
 * @returns 음 목록 (낮은 음부터)
 */
export function voice(q, inv, rnd = Math.random) {
  let tones = q.tones.filter(t => t.role !== "alt");
  if (inv && tones.some(t => t.role === "optional") && rnd() < 0.5) tones = tones.filter(t => t.role !== "optional");

  if (!inv) {
    tones = tones.slice().sort((a, b) => degOf(a) - degOf(b) || a.semi - b.semi);
    // 근음에서 몇 반음 위에 놓일지: 앞 음보다 높은 첫 자리
    const offs = [0];
    for (let i = 1; i < tones.length; i++) {
      let o = offs[i - 1] + 1;
      while (mod12(o - tones[i].semi) !== 0) o++;
      offs.push(o);
    }
    const top = offs[offs.length - 1];
    const roots = [];
    for (let m = LOW; m + top <= HIGH; m++) if (mod12(m) === q.rootPc) roots.push(m);
    const root = pick(roots, rnd);
    return tones.map((t, i) => note(root + offs[i], t.name));
  }

  const bassTone = pick(tones, rnd);
  const bassChoices = [];
  for (let m = LOW; m <= HIGH - 12; m++) if (mod12(m) === bassTone.pc) bassChoices.push(m);   // 위로 한 옥타브 이상 남게
  const bass = pick(bassChoices, rnd);
  const out = [note(bass, bassTone.name)];
  for (const t of tones) {
    if (t === bassTone) continue;
    const spots = [];
    for (let m = bass + 1; m <= Math.min(bass + 24, HIGH); m++) if (mod12(m) === t.pc) spots.push(m);
    out.push(note(pick(spots, rnd), t.name));
  }
  return out.sort((a, b) => a.midi - b.midi);
}

// 사용자가 쓴 답의 구성음이 화면의 음(pcs)과 맞는지: 필수음이 다 있고, 코드에 들어갈 수 없는 음이 없어야 함
const fits = (parts, pcs) => [...parts.required].every(pc => pcs.has(pc)) && [...pcs].every(pc => parts.required.has(pc) || parts.optional.has(pc));

// 코드 종류의 표준 이름(std[0]) + 텐션 → { head, items } ("m7(♭5)" + 9 → head "m7", items ["♭5", "9"])
function label(type, tens) {
  const m = type.std[0].match(/^(.*)\((.*)\)$/);
  const head = m ? m[1] : type.std[0];
  const items = (m ? m[2].split(",") : []).concat(tens.map(E.tenText));
  return head + (items.length ? "(" + items.join(",") + ")" : "");
}

/**
 * 화면의 음으로 만들 수 있는 정답 이름 목록 (근음별로 하나씩, 낮은 음부터).
 * 표기 통일 (사용자 결정 2026-11-08):
 *   ♭5 → ♯11, ♯5 → ♭13 (m7(♭5)는 그대로), aug7 → 7(♭13), M7(♯5) → augM7
 *   근음 철자는 악보에 있는 그 음의 철자 (Cdim7 = E♭dim7 = G♭dim7 = Adim7, D♯dim7로는 쓰지 않음)
 * 자리바꿈이 꺼져 있으면 맨 아래 음이 근음인 이름만.
 * 출제 설정에서 고르지 않은 코드 종류도 구성음이 맞으면 정답.
 */
export function answers(notes, inv) {
  const pcs = new Set(notes.map(n => mod12(n.midi)));
  const out = [];
  const seen = new Set();
  for (const n of notes) {
    if (!inv && n !== notes[0]) continue;
    const r = mod12(n.midi);
    if (seen.has(r)) continue;
    seen.add(r);
    for (const T of NAME_TYPES) {
      if (T.id === "aug7") continue;   // 7(♭13)으로 보여줌
      const chordPcs = new Set(T.tones.map(([semi]) => mod12(r + semi)));
      const tens = [];
      let ok = true;
      for (const pc of pcs) {
        if (chordPcs.has(pc)) continue;
        const id = SEMI_TEN[mod12(pc - r)];
        if (!id || !T.seventh || !T.ten.includes(id)) { ok = false; break; }
        tens.push(id);
      }
      if (!ok || !validTens(tens)) continue;
      tens.sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
      const root = { l: n.l, a: n.a };
      if (!fits(E.tonesFor(T.id, root, tens), pcs)) continue;
      out.push({ symbol: n.name + label(T, tens), rootPc: r, type: T.id, tens });
    }
  }
  return out;
}

// 같은 도수의 텐션은 함께 쓰지 않음 (♭9와 ♯9만 예외) — engine.chooseTensions와 같은 규칙
function validTens(tens) {
  if (new Set(tens).size !== tens.length) return false;
  for (let i = 0; i < tens.length; i++) for (let j = i + 1; j < tens.length; j++) {
    const [a, b] = [tens[i], tens[j]];
    if (E.TEN[a][1] === E.TEN[b][1] && !(new Set([a, b]).has("b9") && new Set([a, b]).has("#9"))) return false;
  }
  return true;
}

/**
 * 출제 설정 s로 문제 하나 만들기.
 * @param s     { types, optB, bases, optC, cMax, optE(복잡한 음 표현), optInv(자리바꿈 허용) } — 텐션 코드 종류와 7alt는 쓰지 않음
 *
 * 악보·건반 철자 (사용자 결정 2026-11-08)
 *   자리바꿈 켜짐            늘 쉬운 표현(C♭ → B). 철자보다 "이 보이싱이 무슨 코드인지" 건반으로 아는 힘이 중요해서 — 옵션 E는 쓰지 않음
 *   자리바꿈 꺼짐 + E 켜짐   원래 철자(C♭ F♭ E♯ B♯ 𝄫 𝄪 포함) — 3도씩 쌓인 모양이 악보에 그대로 보이게. 근음도 C♭ E♯ 등이 나옴
 *   자리바꿈 꺼짐 + E 꺼짐   원래 철자가 쉬운 코드만 그대로. 아니면 검은 건반 근음을 반대 철자로 바꿔 봄(D♭m → C♯m).
 *                            그래도 안 되는 코드(D♭7, Cdim7, Fdim 등 22개)는 빼지 않고 쉬운 표현으로 냄
 * @param prev  바로 앞 문제 — 같은 근음이 연달아 나오지 않게 (engine.generate와 같음)
 * @returns 문제: engine 문제 객체 + inv, notes(낮은 음부터), pcs, answers(정답 목록, 문제 코드가 맨 앞)
 *          또는 { error } (engine.generate와 같은 오류)
 */
export function generate(s, rnd = Math.random, prev = null) {
  const types = Object.fromEntries(NAME_TYPES.map(t => [t.id, !!(s.types && s.types[t.id])]));
  const inv = !!s.optInv;
  const optE = !inv && !!s.optE;
  let q = E.generate({ types, optB: s.optB, bases: s.bases, optC: s.optC, cMax: s.cMax, optD: false, optE, noAlt: true }, rnd, prev);
  if (q.error) return q;
  if (!inv && !optE && q.tones.some(oddSpelling)) {
    const other = OTHER_ROOT[q.rootPc];
    const q2 = other && E.rebuild({ ...E.spec(q), l: other[0], a: other[1] }, { optE: true });
    if (q2 && !q2.tones.some(oddSpelling)) q = q2;
  }
  const notes = voice(q, inv, rnd);
  const list = answers(notes, inv);
  // 문제를 낸 근음을 맨 앞으로 (나머지는 낮은 음부터)
  list.sort((a, b) => (b.rootPc === q.rootPc) - (a.rootPc === q.rootPc));
  return { ...q, inv, notes, pcs: new Set(notes.map(n => mod12(n.midi))), answers: list };
}

// ---------- 사용자가 쓴 코드 이름 읽기 ----------
// 키패드(M m dim aug sus add 숫자 ♯ ♭ 괄호)로 쓴 글자와, 컴퓨터 키보드로 친 다른 표기를 모두 읽어요.
// 대소문자를 구분함: M = 메이저, m = 마이너. 근음을 소문자로 쓰면 오류 "lowerRoot" (사용자 결정 2026-11-08)

const MAJ = ["M", "Ma", "ma", "Maj", "maj", "△"];   // 메이저 7의 다른 표기 (CM7 = Cma7 = Cmaj7 = C△7)
const MIN = ["m", "mi", "min", "-"];                // 마이너 (Cm7 = Cmi7 = Cmin7 = C-7)
const AUG = ["aug", "+"];
const HEADS = {};   // 괄호 앞 글자 → 코드 종류 id
const add = (id, ...names) => names.forEach(n => { HEADS[n] = id; });
add("maj", "", "M", "Ma", "Maj", "maj");
MIN.forEach(m => add("min", m));
add("dim", "dim", "°");
AUG.forEach(a => add("aug", a));
add("sus4", "sus4", "sus");
add("sus2", "sus2");
MAJ.forEach(M => add("M7", M + "7"));
add("M7", "△");
MIN.forEach(m => add("m7", m + "7"));
add("dom7", "7");
add("7sus4", "7sus4", "7sus");
AUG.forEach(a => add("aug7", a + "7"));
add("dim7", "dim7", "°7");
add("m7b5", "ø", "ø7");
MIN.forEach(m => add("m7b5", m + "7b5"));   // m7b5는 괄호 없이도 받음 (자주 쓰는 표기)
MIN.forEach(m => MAJ.forEach(M => add("mM7", m + M + "7")));
MIN.forEach(m => add("mM7", m + "△"));
AUG.forEach(a => MAJ.forEach(M => add("augM7", a + M + "7")));
add("6", "6");
MIN.forEach(m => add("m6", m + "6"));
add("add9", "add9");
MIN.forEach(m => add("madd9", m + "add9"));
add("69", "6/9");
// 괄호 안에 "maj7"을 쓰는 표기: Cm(maj7) = CmM7
const PAREN_MAJ7 = new Set(MAJ.map(M => M + "7"));
// 텐션 코드 이름 → 세븐코드 + 텐션 (C9 = C7(9), Cm11 = Cm7(11), CM13 = CM7(13) — 사용자 결정 2026-11-08)
// 이 페이지에는 텐션 코드 종류가 없어서, 이렇게 써도 세븐코드에 괄호 텐션을 쓴 것으로 읽어요. (C11은 해당 없음 → 괄호 안내)
const EXT_HEADS = {};
const ext = (id, ten, ...names) => names.forEach(n => { EXT_HEADS[n] = [id, ten]; });
ext("dom7", "9", "9");
ext("dom7", "13", "13");
MIN.forEach(m => { ext("m7", "9", m + "9"); ext("m7", "11", m + "11"); });
MAJ.forEach(M => { ext("M7", "9", M + "9"); ext("M7", "13", M + "13"); });

/**
 * 코드 이름 글자 → { root: {l, a}, rootPc, type, tens } 또는 { error }
 *   error: "empty" 빈칸 | "lowerRoot" 근음 소문자 | "noParen" 텐션을 괄호 밖에 씀(C7b9, C69, C11) | "unknown" 읽을 수 없음
 */
export function parse(input) {
  let s = String(input || "").replace(/\s+/g, "")
    .replace(/♯/g, "#").replace(/♭/g, "b").replace(/𝄪/g, "##").replace(/𝄫/g, "bb").replace(/Δ/g, "△").replace(/[（]/g, "(").replace(/[）]/g, ")");
  if (!s) return { error: "empty" };
  if (/^[a-g]/.test(s)) return { error: "lowerRoot" };
  const m = s.match(/^([A-G])(##|bb|#|b)?(.*)$/);
  if (!m) return { error: "unknown" };
  const root = { l: E.LET.indexOf(m[1]), a: { "##": 2, "bb": -2, "#": 1, "b": -1 }[m[2]] || 0 };
  let rest = m[3], items = [];
  const open = rest.indexOf("(");
  if (open >= 0) {
    let inner = rest.slice(open + 1);
    if (inner.endsWith(")")) inner = inner.slice(0, -1);   // 닫는 괄호를 빼먹어도 읽음
    rest = rest.slice(0, open);
    if (/[()]/.test(inner) || !inner) return { error: "unknown" };
    items = inner.split(",");
  } else if (rest.includes(")")) return { error: "unknown" };

  let type = HEADS[rest];
  const extTen = [];
  if (type === undefined && EXT_HEADS[rest]) [type, extTen[0]] = EXT_HEADS[rest];   // C9 → 7 + (9)
  if (type === undefined) {
    // C7b9, C69, C9, Cm11처럼 텐션을 괄호 밖에 쓴 경우
    if (rest !== "5" && /^(.*?)(b|#)?(5|9|11|13)$/.test(rest)) return { error: "noParen" };
    return { error: "unknown" };
  }
  // 괄호 안 글자 → 텐션 id
  const tens = [...extTen];
  for (const it of items) {
    if (PAREN_MAJ7.has(it) && type === "min") { type = "mM7"; continue; }
    const tm = it.match(/^(b|#)?(5|9|11|13)$/);
    if (!tm) return { error: "unknown" };
    const id = (tm[1] || "") + tm[2];
    if (!(id in E.TEN)) return { error: "unknown" };
    tens.push(id);
  }
  // 괄호가 코드 종류의 일부인 표기
  const take = id => { const i = tens.indexOf(id); if (i < 0) return false; tens.splice(i, 1); return true; };
  if (type === "m7" && take("b5")) type = "m7b5";            // Cm7(♭5)
  else if (type === "M7" && take("#5")) type = "augM7";      // CM7(♯5) = CaugM7
  else if (type === "6" && tens.length === 1 && take("9")) type = "69";   // C6(9)
  const T = E.BY_ID[type];
  if (!T || !NAME_IDS.has(T.id)) return { error: "unknown" };
  if (tens.length && !T.seventh) return { error: "unknown" };
  if (!validTens(tens)) return { error: "unknown" };
  if (tens.some(t => t === "b5" || t === "#5") && !T.dominant) return { error: "unknown" };
  tens.sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
  return { root, rootPc: E.pcOf(root.l, root.a), type: T.id, tens };
}

/**
 * 사용자가 쓴 답 판정.
 * @returns { correct, missing(꼭 필요한데 화면에 없는 음 이름), extra(화면에 있는데 그 코드에 들어갈 수 없는 음 이름),
 *            bassWrong(자리바꿈 꺼짐인데 맨 아래 음이 근음이 아님) } 또는 { error, correct: false }
 */
export function check(input, prob) {
  const p = parse(input);
  if (p.error) return { error: p.error, correct: false };
  const parts = E.tonesFor(p.type, p.root, p.tens);
  // 빠진 음 이름은 사용자가 쓴 코드의 철자 (겹변화표는 쉬운 이름으로)
  const missing = [];
  for (const t of parts.tones) {
    if (!parts.required.has(t.pc) || prob.pcs.has(t.pc)) continue;
    const name = oddSpelling(t) ? E.simpleName(t.pc, t.a) : t.name;
    if (!missing.includes(name)) missing.push(name);
  }
  // 들어갈 수 없는 음 이름은 악보의 철자
  const extra = prob.notes.filter(n => !parts.required.has(mod12(n.midi)) && !parts.optional.has(mod12(n.midi))).map(n => n.name);
  const bassWrong = !prob.inv && p.rootPc !== mod12(prob.notes[0].midi);
  return { correct: !missing.length && !extra.length && !bassWrong, missing: [...new Set(missing)], extra: [...new Set(extra)], bassWrong };
}

export const Naming = { LOW, HIGH, NAME_TYPES, generate, voice, answers, parse, check };
export default Naming;
