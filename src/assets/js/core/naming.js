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

// ---------- 자리바꿈 보이싱 규칙 (사용자 결정 2026-11-10) ----------
// 맨 아래 음(베이스) 비율. 빠진 음(생략한 5음, sus의 3음 자리 등)의 몫은 남은 음들이 비율대로 나눠 가짐
//   7화음(텐션 포함)            근음 40, 3음 20, 5음 15, 7음 20, 9음 5
//   3화음·sus·6·add             근음·3음·5음 같은 비율 (모양이 적어서 자리바꿈을 더 연습), add9·madd9의 9음 5
// 11·13(6)·♯9·♭9, sus의 4음·2음은 베이스에 두지 않음.
// 9음 베이스는 7화음에 텐션이 9 하나뿐일 때(aug7 제외)와 add9·madd9에서만, 그리고 3음이 바로 다음 음(2도 위)이어야 함
// aug7·augM7의 ♯5도 베이스에 두지 않음 — 온음음계 모양이 되어 근음이 들리지 않음 (aug 3화음은 대칭이라 그대로, 2026-11-10)
const BASS_7TH = { 1: 40, 3: 20, 5: 15, 7: 20, 9: 5 };
const BASS_OTHER = { 1: 1, 3: 1, 5: 1 };
const NINE_BASS = 5 / 95;   // 3화음 쪽 비율(합 3)에 맞춘 9음 몫 — 전체의 5%

/** 이 음을 베이스에 둘 비중 (0이면 베이스로 쓰지 않음) */
function bassWeight(q, t, tones) {
  const seventh = tones.some(x => x.role !== "tension" && x.deg === 7);
  const third = tones.some(x => x.role !== "tension" && x.deg === 3);
  if (t.ten || degOf(t) === 9) {
    if (t.ten && t.ten !== "9") return 0;   // ♭9 ♯9 11 ♯11 13 ♭13
    if (!third) return 0;                   // 9음 바로 위에 둘 3음이 없음 (7sus4(9) 등)
    if (seventh) {
      const tens = tones.filter(x => x.ten);
      return tens.length === 1 && q.type !== "aug7" && q.type !== "augM7" ? BASS_7TH[9] : 0;
    }
    return q.type === "add9" || q.type === "madd9" ? 3 * NINE_BASS : 0;
  }
  if (t.deg === 5 && (q.type === "aug7" || q.type === "augM7")) return 0;
  return (seventh ? BASS_7TH : BASS_OTHER)[t.deg] || 0;   // 6음(deg 6), sus의 4음·2음은 0
}

// 단9도(13반음, 또는 그 옥타브 위)는 피함. 코드 이름에 들어 있는 음정만 허용: 근음–♭9, 완전5도–♭13
const m9ok = (lo, hi) => (lo.semi === 0 && hi.ten === "b9") || (lo.semi === 7 && lo.deg === 5 && hi.ten === "b13");
function m9Free(order, offs) {
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    const d = offs[j] - offs[i];
    if (d > 12 && d % 12 === 1 && !m9ok(order[i], order[j])) return false;
  }
  return true;
}

// 순서 → 맨 아래 음에서 몇 반음 위인지: 앞 음보다 1~11반음 위의 같은 음이름 자리 (pc가 모두 달라서 하나뿐)
function offsetsOf(order) {
  const offs = [0];
  for (let i = 1; i < order.length; i++) offs.push(offs[i - 1] + 1 + mod12(order[i].pc - order[i - 1].pc - 1));
  return offs;
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => { for (const rest of permutations(arr.filter((_, j) => j !== i))) out.push([x, ...rest]); });
  return out;
}

/** 비중대로 하나 고르기 (w: 각 항목의 비중) */
function pickWeighted(items, w, rnd) {
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((r -= w[i]) < 0) return items[i];
  return items[items.length - 1];
}

/**
 * 건반 높이 정하기.
 *   자리바꿈 꺼짐: 근음부터 1 3 5 7 9 11 13 순서로 바로 위에 쌓음 (5음은 늘 보여줌)
 *   자리바꿈 켜짐 (규칙은 위 "자리바꿈 보이싱 규칙"):
 *     1) 5음 생략을 먼저 정함 — 생략할 수 있는 5음(텐션이 붙은 코드)은 50% 확률로 뺌, 단 mM7은 늘 보여줌
 *     2) 남은 음 가운데서 베이스를 비율대로 고름 (생략한 5음이 베이스가 되는 일은 없음)
 *     3) 나머지 음을 무작위 순서로 베이스 위에 쌓음 — 각 음은 바로 앞 음보다 높고 한 옥타브 안
 *        (사용자 요청 2026-11-08). 단9도가 생기는 순서는 버림. 단2도는 허용(재즈에서 즐겨 쓰는 B–C–E–G 같은 배치)
 * @returns 음 목록 (낮은 음부터)
 */
export function voice(q, inv, rnd = Math.random) {
  let tones = q.tones.filter(t => t.role !== "alt");
  // mM7은 5음을 빼면 알아듣기 너무 어려워서 늘 보여줌 (출제만 — 판정은 그대로, 사용자 결정 2026-11-08)
  if (inv && q.type !== "mM7" && tones.some(t => t.role === "optional") && rnd() < 0.5) tones = tones.filter(t => t.role !== "optional");

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

  // 베이스 후보와 비중. 고른 베이스로 규칙에 맞는 배치가 없으면 그 후보를 빼고 다시 고름
  const cands = tones.filter(t => bassWeight(q, t, tones) > 0);
  while (cands.length) {
    const bassTone = pickWeighted(cands, cands.map(t => bassWeight(q, t, tones)), rnd);
    const rest = tones.filter(t => t !== bassTone);
    const ninthBass = !!bassTone.ten || degOf(bassTone) === 9;
    const orders = permutations(rest).map(r => [bassTone, ...r]).filter(order => {
      if (ninthBass && order[1].deg !== 3) return false;   // 9음 베이스: 3음이 바로 위 (2도 위)
      const offs = offsetsOf(order);
      return offs[offs.length - 1] <= HIGH - LOW && m9Free(order, offs);
    });
    if (orders.length) {
      const order = pick(orders, rnd);
      const offs = offsetsOf(order);
      const top = offs[offs.length - 1];
      const basses = [];
      for (let m = LOW; m + top <= HIGH; m++) if (mod12(m) === bassTone.pc) basses.push(m);
      if (basses.length) {
        const bass = pick(basses, rnd);
        return order.map((t, i) => note(bass + offs[i], t.name));
      }
    }
    cands.splice(cands.indexOf(bassTone), 1);
  }
  return voice(q, false, rnd);   // (만일을 위한 대비) 자리바꿈 없이
}

// 텐션 없는 7화음의 완전5도도 빼도 정답 (코드 추론하기 판정만 — 사용자 결정 2026-11-10).
// 5음이 코드의 정체인 m7(♭5)·dim7·aug7·augM7은 그대로 필수. 랜덤 코드 연습("C7을 눌러보세요")은 engine.js 그대로 5음 필수,
// 출제(voice)도 그대로 — 텐션 없는 7화음은 5음을 빼고 내지 않음
const FIFTH_OPTIONAL = new Set(["M7", "m7", "dom7", "7sus4", "mM7"]);
function partsOf(typeId, root, tens) {
  const parts = E.tonesFor(typeId, root, tens);
  if (FIFTH_OPTIONAL.has(typeId) && !tens.length) {
    const fifth = parts.tones.find(t => t.semi === 7 && t.deg === 5);
    if (fifth) { parts.required.delete(fifth.pc); parts.optional.add(fifth.pc); }
  }
  return parts;
}
// 5음을 뺀 텐션 없는 7화음인지 (화면에 그 코드의 완전5도가 없음)
const fifthLeftOut = (typeId, rootPc, tens, pcs) => FIFTH_OPTIONAL.has(typeId) && !tens.length && !pcs.has(mod12(rootPc + 7));

// 사용자가 쓴 답의 구성음이 화면의 음(pcs)과 맞는지: 필수음이 다 있고, 코드에 들어갈 수 없는 음이 없어야 함
const fits = (parts, pcs) => [...parts.required].every(pc => pcs.has(pc)) && [...pcs].every(pc => parts.required.has(pc) || parts.optional.has(pc));

// 코드 종류의 표준 이름(std[0]) + 텐션 → { head, items } ("m7(♭5)" + 9 → head "m7", items ["♭5", "9"])
function label(type, tens) {
  const m = type.std[0].match(/^(.*)\((.*)\)$/);
  const head = m ? m[1] : type.std[0];
  const items = (m ? m[2].split(",") : []).concat(tens.map(E.tenText));
  return head + (items.length ? "(" + items.join(",") + ")" : "");
}

// 정답 목록에 쓰는 텐션: 출제 텐션(engine의 ten) + mM7(13) — 출제는 하지 않고 목록에만 (사용자 결정 2026-11-10)
const listTens = T => (T.id === "mM7" ? [...T.ten, "13"] : T.ten);

/**
 * 화면의 음으로 만들 수 있는 정답 이름 목록 (근음별로 하나씩, 낮은 음부터).
 * 표기 통일 (사용자 결정 2026-11-08):
 *   ♭5 → ♯11, ♯5 → ♭13 (m7(♭5)는 그대로), aug7 → 7(♭13), M7(♯5) → augM7
 *   근음 철자는 악보에 있는 그 음의 철자 (Cdim7 = E♭dim7 = G♭dim7 = Adim7, D♯dim7로는 쓰지 않음)
 * 자리바꿈이 꺼져 있으면 맨 아래 음이 근음인 이름만.
 * 5음을 뺀 텐션 없는 7화음(D–G–C의 D7sus4)은 그 근음이 맨 아래일 때만 목록에 넣음 — 판정은 베이스와 상관없이 정답
 *   (G–C–D를 D7sus4로 먼저 떠올리긴 무리라서, 사용자 결정 2026-11-10)
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
        if (!id || !T.seventh || !listTens(T).includes(id)) { ok = false; break; }
        tens.push(id);
      }
      if (!ok || !validTens(tens)) continue;
      tens.sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
      const root = { l: n.l, a: n.a };
      if (!fits(partsOf(T.id, root, tens), pcs)) continue;
      if (fifthLeftOut(T.id, r, tens, pcs) && r !== mod12(notes[0].midi)) continue;
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

// ---------- 틀린 문제 다시 풀기 (2026-11-08) ----------
// DB review_queue.spec에 남기는 정보: engine의 spec(근음·코드 종류·텐션·이름) + 자리바꿈 여부 + 그때의 음 배치(MIDI와 보이던 철자)
/** 다시 풀기용 정보 */
export const specOf = q => ({ ...E.spec(q), inv: !!q.inv, notes: q.notes.map(n => [n.midi, n.name]) });

/**
 * 저장한 정보로 문제를 다시 만듦 (DB에서 온 값이라 꼼꼼히 확인, 이상하면 null).
 * @param same  true = 처음과 같은 음 배치, false = 같은 방식(자리바꿈 여부)의 다른 배치
 *              — 다시 풀기의 첫 번째는 같은 배치, 두 번째(한 번 맞힌 뒤)는 다른 배치 (사용자 결정 2026-11-08)
 */
export function fromSpec(sp, same, rnd = Math.random) {
  if (!sp || !Array.isArray(sp.notes) || !sp.notes.length || sp.notes.length > 8) return null;
  if (!sp.notes.every(x => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= LOW && x[0] <= HIGH && typeof x[1] === "string" && /^[A-G][♯♭𝄪𝄫]{0,2}$/u.test(x[1]))) return null;
  const q = E.rebuild(sp, { optE: false });   // 쉬운 철자로 만든 뒤, 처음에 보이던 철자로 바꿔 씀
  if (!q || q.alt || !NAME_IDS.has(q.type)) return null;
  const inv = !!sp.inv;
  const shown = new Map(sp.notes.map(([m, name]) => [mod12(m), name]));
  for (const t of q.tones) if (shown.has(t.pc)) t.name = shown.get(t.pc);
  let notes;
  if (same) notes = sp.notes.map(([m, name]) => note(m, name)).sort((a, b) => a.midi - b.midi);
  else {
    // 다른 배치: 몇 번 다시 뽑아 처음과 다른 배치를 고름 (자리바꿈 없는 문제는 근음 옥타브만 다를 수 있음 — 하나뿐이면 같은 배치)
    const before = sp.notes.map(x => x[0]).sort((a, b) => a - b).join();
    for (let i = 0; i < 12; i++) { notes = voice(q, inv, rnd); if (notes.map(n => n.midi).join() !== before) break; }
  }
  if (notes.some(n => !Number.isInteger(n.oct))) return null;   // 철자와 높이가 안 맞음 (조작된 값)
  const list = answers(notes, inv);
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
// Fmajor = F, Fminor = Fm (말로 부르는 이름, 대소문자 무관 — 사용자 결정 2026-11-09). 3화음에만: 숫자·괄호를 붙이면 받지 않음(parse)
const WORD_TRIADS = { major: "maj", minor: "min" };
Object.entries(WORD_TRIADS).forEach(([w, id]) => add(id, w));
add("dim", "dim", "°");
AUG.forEach(a => add("aug", a));
add("sus4", "sus4", "sus");
add("sus2", "sus2");
MAJ.forEach(M => add("M7", M + "7"));
add("M7", "△");
MIN.forEach(m => add("m7", m + "7"));
add("dom7", "7");
add("7sus4", "7sus4");   // "7sus"는 받지 않음 — 어떤 경우에도 오답 (sus만 쓴 Csus = Csus4와 다름, 사용자 결정 2026-11-08)
AUG.forEach(a => add("aug7", a + "7"));
add("dim7", "dim7", "°7");
add("m7b5", "ø", "ø7", "h7");   // h7: iReal Pro 등의 하프 디미니시드 표기 (2026-11-08 사용자 결정. "Ch"만 쓴 건 받지 않음)
MIN.forEach(m => add("m7b5", m + "7b5"));   // m7b5는 괄호 없이도 받음 (자주 쓰는 표기)
MIN.forEach(m => MAJ.forEach(M => add("mM7", m + M + "7")));
MIN.forEach(m => add("mM7", m + "△"));
AUG.forEach(a => MAJ.forEach(M => add("augM7", a + M + "7")));
add("6", "6");
// CM6 = CMa6 = CMAJ6 = C6 (메이저를 밝혀 쓴 표기, 2026-11-08). 여러 글자 Ma·Maj는 대소문자 무관(normWords),
// 한 글자 M은 대문자만(소문자 m6은 마이너 6). △6·^6은 △가 메이저 7을 뜻해 받지 않음
MAJ.filter(M => M !== "△").forEach(M => add("6", M + "6"));
// 6(9)도 같게: CM6/9 = CMaj6add9 = C6(9). CM6(9)·CMaj6(add9)는 위 "6" + 괄호 규칙으로 읽힘
MAJ.filter(M => M !== "△").forEach(M => add("69", M + "6/9", M + "6add9"));
MIN.forEach(m => add("m6", m + "6"));
add("add9", "add9", "add2", "2");                                // C2 = Cadd2 = Cadd9 (2026-11-08)
MAJ.forEach(M => add("add9", M + "add9", M + "add2"));           // CMadd9 = CMadd2 = Cmaj(add9)처럼 메이저를 밝혀 쓴 표기 (2026-11-08)
MIN.forEach(m => add("madd9", m + "add9", m + "add2"));           // Cmadd2 = Cmadd9. Cm2는 공신력 있는 표기가 아니라 받지 않음
add("69", "6/9", "6add9");
MIN.forEach(m => add("m69", m + "6/9", m + "6add9"));             // Cm6/9 = Cm6add9 = Cm6(9)
MIN.forEach(m => add("m7b5", m + "7-5"));                         // Cm7-5 (일본·한국 실용음악 교재 표기, 2026-11-08)
// 괄호 안에 "maj7"을 쓰는 표기: Cm(maj7) = CmM7
const PAREN_MAJ7 = new Set(MAJ.map(M => M + "7"));
const PAREN_MAJ9 = new Set(MAJ.map(M => M + "9"));   // Cm(maj9) = Cm(M9) = CmM7(9) (2026-11-08)
// 괄호 안에 코드 종류를 쓰는 표기: 괄호 앞 코드 종류 → { 괄호 안 글자 → 코드 종류 } (괄호 하나에 이것 하나만)
const PAREN_WORD = {
  maj: { add9: "add9", add2: "add9", sus4: "sus4", sus2: "sus2", "#5": "aug" },   // C(♯5) = Caug
  min: { add9: "madd9", add2: "madd9" },
  dom7: { sus4: "7sus4" },
  "6": { add9: "69" },     // C6(add9) = C6(9)
  m6: { add9: "m69" },     // Cm6(add9) = Cm6(9)
};
// 텐션 코드 이름 → 세븐코드 + 텐션 (C9 = C7(9), Cm11 = Cm7(11), CM13 = CM7(13) — 사용자 결정 2026-11-08)
// 이 페이지에는 텐션 코드 종류가 없어서, 이렇게 써도 세븐코드에 괄호 텐션을 쓴 것으로 읽어요. (C11은 해당 없음 → 괄호 안내)
const EXT_HEADS = {};
const ext = (id, ten, ...names) => names.forEach(n => { EXT_HEADS[n] = [id, ten]; });
ext("dom7", "9", "9");
ext("dom7", "13", "13");
MIN.forEach(m => { ext("m7", "9", m + "9"); ext("m7", "11", m + "11"); });
MAJ.forEach(M => { ext("M7", "9", M + "9"); ext("M7", "13", M + "13"); });
ext("7sus4", "9", "9sus4");     // C9sus4 = C7sus4(9) (재즈 악보 표기, 2026-11-08)
ext("7sus4", "13", "13sus4");   // C13sus4 = C7sus4(13)
ext("aug7", "9", "aug9");       // Caug9 = Caug7(9) ("C+9"는 C(♯9)와 헷갈려서 받지 않음)
ext("m7b5", "9", "ø9");
ext("m7b5", "11", "ø11");       // Cø11 = Cm7(♭5,11)
ext("m7b5", "9", "h9");         // Ch9 = Cø9, Ch11 = Cø11 (h7처럼 h = ø로 읽음, "Ch"만은 받지 않음)
ext("m7b5", "11", "h11");
MIN.forEach(m => MAJ.forEach(M => ext("mM7", "9", m + M + "9")));   // CmM9 = Cmmaj9 = C-△9 = CmM7(9)         // Cø9 = Cm7(♭5,9). Cm9(♭5)·Cm11(♭5)는 m9·m11 + 괄호 ♭5로 읽혀 따로 적지 않아도 됨

/**
 * 표기 차이 맞추기 (2026-11-08 사용자 결정: 공식적으로 틀린 표기가 아니면 여러 표기를 존중).
 *   여러 글자 단어는 대소문자 구분 없이: MAJOR MINOR DIM AUG SUS ADD MAJ MIN MA MI ALT (CMA7 = CMAJ7 = Cmaj7, CMI7 = CMIN7 = Cm7, CMajor = C)
 *   ^ = △ (메이저 7, iReal Pro 등), 맨 앞의 o = ° (dim — Co7 = Cdim7)
 *   한 글자 M(메이저)·m(마이너)은 그대로 구분
 * @param head  괄호 앞 부분이면 true (o → °는 여기서만)
 */
function normWords(w, head) {
  w = w.replace(/\^/g, "△").replace(/major|minor|dim|aug|sus|add|maj|min|alt/gi, x => x.toLowerCase());   // major·minor를 maj·min보다 먼저
  w = w.replace(/[mM][aA](?![jdu])/g, "ma").replace(/[mM][iI](?!n)/g, "mi");   // maj·min·madd·maug는 앞에서 처리됨
  return head ? w.replace(/^[oO](?=\d|$)/, "°") : w;
}

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
    // 괄호 안: 대소문자 맞추고, -/+ 텐션은 ♭/♯로 (C7(-9) = C7(♭9), C7(+5) = C7(♯5) — 일본·한국 교재 표기)
    items = inner.split(",").map(it => normWords(it, false).replace(/^-(?=\d)/, "b").replace(/^\+(?=\d)/, "#"));
  } else if (rest.includes(")")) return { error: "unknown" };
  rest = normWords(rest, true);

  // 7alt: 텐션 없이 따로 판정 (checkAlt). 괄호를 붙이면 받지 않음
  if (rest === "7alt") return items.length ? { error: "unknown" } : { root, rootPc: E.pcOf(root.l, root.a), type: "dom7", tens: [], alt: true };
  if (rest in WORD_TRIADS && items.length) return { error: "unknown" };   // Fminor(add9)·Fmajor(sus4)는 받지 않음 (3화음만)
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
    if (PAREN_MAJ9.has(it) && type === "min") { type = "mM7"; tens.push("9"); continue; }   // Cm(maj9) = CmM7(9)
    if (PAREN_MAJ7.has(it) && type === "aug") { type = "augM7"; continue; }                // Caug(maj7) = C+(M7) = CaugM7
    // C6(maj7) = CM7(13), Cm6(maj7) = CmM7(13) (사용자 결정 2026-11-10)
    if (PAREN_MAJ7.has(it) && (type === "6" || type === "m6")) { type = type === "6" ? "M7" : "mM7"; tens.push("13"); continue; }
    // 괄호 안에 쓴 코드 종류 (사용자 결정 2026-11-08): C(add9)·C(add2) = Cadd9, Cm(add9)·Cm(add2) = Cmadd9,
    // C(sus4) = Csus4, C(sus2) = Csus2, C7(sus4) = C7sus4. 괄호 하나에 이것 하나만 (C(6)·Cm(6)은 받지 않음)
    const word = PAREN_WORD[type] && PAREN_WORD[type][it];
    if (word && items.length === 1) { type = word; continue; }
    if (it === "sus4" && type === "dom7") { type = "7sus4"; continue; }   // C7(sus4,9)처럼 텐션과 함께도
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
  else if (type === "m6" && tens.length === 1 && take("9")) type = "m69";  // Cm6(9)
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
/**
 * 7alt 판정 (사용자 결정 2026-11-08, 알터드 스케일 = 가락단음계 7번째 모드에는 자연 9·11·13·5가 없음):
 *   R 3 ♭7 필수 / ♭9 ♯9 ♭13(=♯5) 중 하나 이상 / ♯11(=♭5)은 있어도 됨(♯11만으로는 alt가 아님 — 리디안 도미넌트) /
 *   자연 9·13 있으면 오답(C13(♭9)는 하프-홀 디미니시드 코드) / 완전5도는 있어도 됨(랜덤 코드 연습의 7alt 판정과 같게)
 * 정답 목록에는 7alt를 보여주지 않고 텐션으로 풀어 쓴 이름만 보여줌 (입력으로만 받음)
 */
function checkAlt(p, prob) {
  const sp = (semi, deg) => E.spellTone(p.root, semi, deg);
  const required = [sp(0, 1), sp(4, 3), sp(10, 7)];
  const altered = [sp(1, 9), sp(3, 9), sp(8, 13)];
  const allowed = new Set([...required, ...altered, sp(6, 11), sp(7, 5)].map(t => t.pc));
  const name = t => (oddSpelling(t) ? E.simpleName(t.pc, t.a) : t.name);
  const missing = required.filter(t => !prob.pcs.has(t.pc)).map(name);
  const extra = [...new Set(prob.notes.filter(n => !allowed.has(mod12(n.midi))).map(n => n.name))];
  const noAlt = !altered.some(t => prob.pcs.has(t.pc));
  const bassWrong = !prob.inv && p.rootPc !== mod12(prob.notes[0].midi);
  const correct = !missing.length && !extra.length && !noAlt && !bassWrong;
  // 7alt는 정답 목록에 넣지 않으므로 맞히면 늘 앞에 붙여 보여줌
  return { correct, missing, extra, bassWrong, noAlt, unlisted: correct ? rootText(p.root) + "7alt" : null, matched: null };
}

export function check(input, prob) {
  const p = parse(input);
  if (p.error) return { error: p.error, correct: false };
  if (p.alt) return checkAlt(p, prob);
  const parts = partsOf(p.type, p.root, p.tens);
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
  const correct = !missing.length && !extra.length && !bassWrong;
  // 맞힌 이름을 엔진 표기로: 정답 목록에 있으면 그 이름(matched), 없으면 표준 표기로 만든 이름(unlisted)
  const hit = correct ? listed(p, parts, prob) : null;
  const unlisted = correct && !hit ? rootText(p.root) + label(E.BY_ID[p.type], sortTens(p.tens)) : null;
  return { correct, missing: [...new Set(missing)], extra: [...new Set(extra)], bassWrong, unlisted, matched: hit ? hit.symbol : null };
}

// ---------- 맞힌 이름을 정답 목록 맨 앞에 (사용자 결정 2026-11-10) ----------
// 맞히면 화면이 맞힌 이름을 목록 맨 앞에, 나머지 정답을 그 뒤에 보여줌. 이름은 입력 그대로가 아니라 엔진 표기
// (목록에 있으면 목록의 이름 — C9 → C7(9), D♭7 → 악보 철자 C♯7, 없으면 표준 표기 — D7sus4, C7alt).
// 목록에 없는 경우: 5음을 뺀 7화음인데 근음이 맨 아래가 아님(G–C–D의 D7sus4), 7alt, 목록에서 쓰지 않는 텐션(mM7(13) 등)
// 같은 근음에 필수음이 같으면 같은 코드로 봄 (C9 = C7(9), Caug7 = C7(♭13) — 표기만 다른 것은 붙이지 않음)
const rootText = r => E.LET[r.l] + (r.a > 0 ? "♯" : "♭").repeat(Math.abs(r.a));
const sortTens = tens => tens.slice().sort((a, b) => E.TEN_ORDER.indexOf(a) - E.TEN_ORDER.indexOf(b));
const samePcs = (a, b) => a.size === b.size && [...a].every(pc => b.has(pc));
function listed(p, parts, prob) {
  return (prob.answers || []).find(a => a.rootPc === p.rootPc && samePcs(partsOf(a.type, p.root, a.tens).required, parts.required));
}

export const Naming = { LOW, HIGH, NAME_TYPES, generate, voice, answers, parse, check, specOf, fromSpec };
export default Naming;
