// 청음 연습 코드 ① 코드 종류 — 출제·채점 규칙 (src/assets/js/ear/chords.js, chordoven-spec.md "청음 연습" 코드 ①)
import test from "node:test";
import assert from "node:assert";
import * as C from "../src/assets/js/ear/chords.js";
import { Engine as E } from "../src/assets/js/core/engine.js";

const mod12 = n => ((n % 12) + 12) % 12;
const ALL = C.GROUPS.flatMap(g => g.ids);

test("ear chords: bass is the root (C2–D♯3, from the instrument's lowest note, octaves half and half), upper voices from F3 a minor third or more above the bass", () => {
  let close = 0, open = 0;
  const octs = new Map();   // 베이스 건반 → [낮은 옥타브 횟수, 높은 옥타브 횟수]
  for (const inv of [false, true]) for (let i = 0; i < 3000; i++) {
    const q = C.makeChord({ types: ALL, inv });
    const k = q.rootPc, o = octs.get(k) || [0, 0];
    if (k <= 3) o[q.bass.midi < 48 ? 0 : 1]++;   // C~D♯: C2~D♯2 또는 C3~D♯3
    octs.set(k, o);
    assert.ok(q, "should make a chord");
    assert.ok(q.bass.midi >= C.BASS_LOW && q.bass.midi <= C.BASS_HIGH);
    assert.strictEqual(mod12(q.bass.midi), q.rootPc);
    assert.ok(q.upper[0].midi >= C.UPPER_LOW && q.upper.at(-1).midi <= C.UPPER_HIGH);
    assert.ok(q.upper[0].midi - q.bass.midi >= C.MIN_GAP, `${q.name} gap`);
    // 자리바꿈 허용: 이웃한 음은 한 옥타브 미만 (밀집 배치가 아니어도 됨) / 꺼짐: 기본형 밀집 배치만 (2026-11-25 사용자 결정)
    for (let k = 1; k < q.upper.length; k++) assert.ok(q.upper[k].midi - q.upper[k - 1].midi < 12, `${q.name}: gap`);
    if (!inv) assert.ok(q.upper.at(-1).midi - q.upper[0].midi < 12, `${q.name}: close root position`);
    // 자리바꿈 허용: 7도 이상 없음, 6도는 맨 아래 두 음 사이에서만 (2026-11-25 사용자 결정)
    if (inv) {
      for (let k = 1; k < q.upper.length; k++) {
        const d = q.upper[k].midi - q.upper[k - 1].midi;
        assert.ok(d < 10 && (d < 8 || k === 1), `${q.name}: wide gap ${q.upper.map(n => n.name + n.oct)}`);
      }
      if (q.upper.at(-1).midi - q.upper[0].midi < 12) close++; else open++;
    }
    // 위 화음은 그 코드의 구성음 전부, 겹치지 않게
    const want = new Set(E.tonesFor(q.type, q.root, []).tones.map(t => t.pc));
    assert.deepStrictEqual(new Set(q.upper.map(n => mod12(n.midi))), want);
    assert.strictEqual(q.upper.length, want.size);
    if (!inv) assert.strictEqual(mod12(q.upper[0].midi), q.rootPc, "root position without inversions");
    // 철자와 높이가 맞음
    for (const n of [q.bass, ...q.upper]) assert.ok(Number.isInteger(n.oct) && Math.abs(n.a) <= 1, JSON.stringify(n));
    // aug 계열의 ♯5는 맨 아래 음 규칙에서 텐션처럼: 베이스(낮으면 한 옥타브 위 베이스)에서 한 옥타브 이상일 때만 맨 아래
    if (inv && mod12(q.upper[0].midi - q.rootPc) === 8 && ["aug", "aug7", "augM7"].includes(q.type)) {
      const ref = q.bass.midi < C.REF_BASS ? q.bass.midi + 12 : q.bass.midi;
      assert.ok(q.upper[0].midi - ref >= 12, `${q.name}: ♯5 low`);
    }
  }
  assert.ok(open > 0 && close > open, `close voicings are more common (${close} / ${open})`);
  for (const [k, [lo, hi]] of octs) if (k <= 3) assert.ok(lo > 0.35 * (lo + hi) && hi > 0.35 * (lo + hi), `bass octaves of ${k}: ${lo} / ${hi}`);
  // 악기가 E2까지만 내면(기타·합창) 베이스는 E2 이상
  for (let i = 0; i < 500; i++) assert.ok(C.makeChord({ types: ALL, inv: i % 2 === 0, bassLow: 40 }).bass.midi >= 40);
});

test("ear chords: only the chosen types, never the same type twice in a row (when there are two or more)", () => {
  let prev = null;
  for (let i = 0; i < 2000; i++) {
    const q = C.makeChord({ types: ["m7", "dom7"], inv: false }, Math.random, prev);
    assert.ok(["m7", "dom7"].includes(q.type));
    if (prev) assert.notStrictEqual(q.type, prev.type);
    prev = q;
  }
  for (let i = 0; i < 50; i++) assert.strictEqual(C.makeChord({ types: ["6"], inv: false }, Math.random, { type: "6" }).type, "6");
  assert.deepStrictEqual(C.DEFAULT_TYPES, ["M7", "dom7", "m7", "m7b5", "dim7", "mM7", "7sus4", "6", "m6"]);
});

test("ear chords: black-key roots take the spelling with fewer hard notes (C♯m7, not D♭m7)", () => {
  assert.deepStrictEqual(C.spellRoot(1, "m7"), { l: 0, a: 1 });     // C♯ E G♯ B
  assert.deepStrictEqual(C.spellRoot(1, "M7"), { l: 1, a: -1 });    // D♭ F A♭ C
  assert.deepStrictEqual(C.spellRoot(6, "M7"), { l: 4, a: -1 });    // G♭ B♭ D♭ F (F♯M7은 E♯이 생김)
  assert.deepStrictEqual(C.spellRoot(6, "m7"), { l: 3, a: 1 });     // F♯ A C♯ E (G♭m7은 B𝄫·F♭)
  assert.deepStrictEqual(C.spellRoot(6, "dom7"), { l: 3, a: 1 });   // F♯ A♯ C♯ E (G♭7은 F♭)
});

test("ear chords: judging — any common spelling of the right type is correct, the root letter is not typed", () => {
  const q = C.makeChord({ types: ["m7b5"], inv: false });
  for (const s of ["m7b5", "m7(♭5)", "m7(b5)", "m7(-5)", "ø", "ø7", "m7-5"]) assert.ok(C.judgeChord(s, q).correct, s);
  for (const s of ["m7", "dim7", "7", "m6"]) assert.strictEqual(C.judgeChord(s, q).correct, false, s);
  // 빈칸 = 메이저 3화음 (근음만 쓴 것 — 그냥 [제출])
  assert.strictEqual(C.judgeChord("", q).correct, false);
  assert.strictEqual(C.judgeChord("", q).chord.type, "maj");
  assert.strictEqual(C.judgeChord("Cm7", q).error, "root");
  assert.strictEqual(C.judgeChord("7b9", q).error, "noParen");
  assert.strictEqual(C.judgeChord("xyz", q).error, "unknown");
  // 7화음 쪽: 5음이 생략 가능한 표기도 같은 소리면 정답 (CM7 = Cmaj7 = C△7)
  const q2 = C.makeChord({ types: ["M7"], inv: true });
  for (const s of ["M7", "maj7", "△7", "Ma7"]) assert.ok(C.judgeChord(s, q2).correct, s);
  assert.strictEqual(C.judgeChord("M7(9)", q2).correct, false, "extra tension is wrong");
  const q3 = C.makeChord({ types: ["maj"], inv: false });
  assert.ok(C.judgeChord("M", q3).correct);
  assert.ok(C.judgeChord("", q3).correct, "empty answer is a major triad");
});

test("ear chords: a wrong answer is voiced like the question — same bass, each voice swapped for the same chord degree", () => {
  // 정답 CM7이 미솔시도(자리바꿈)면 C7은 미솔시♭도 (2026-11-25 사용자 예시)
  const n = (midi, l, deg) => ({ midi, l, a: 0, oct: 4, name: "", deg });
  const q = { bass: { midi: 48 }, upper: [n(64, 2, 3), n(67, 4, 5), n(71, 6, 7), n(72, 0, 1)], root: { l: 0, a: 0 } };
  assert.deepStrictEqual(C.voiceLike({ type: "dom7", tens: [], root: q.root }, q), { bass: 48, upper: [64, 67, 70, 72] });
  // 7sus4는 3음 자리에 4음(파솔시♭도), 3화음은 7음 자리를 뺌, 6화음은 7음 자리에 6음
  assert.deepStrictEqual(C.voiceLike({ type: "7sus4", tens: [], root: q.root }, q).upper, [65, 67, 70, 72]);
  assert.deepStrictEqual(C.voiceLike({ type: "maj", tens: [], root: q.root }, q).upper, [64, 67, 72]);
  // Csus4(7음 없음)는 문제가 세븐코드여도 7음 자리를 빼고 파솔도 (2026-11-25 사용자 확인)
  assert.deepStrictEqual(C.voiceLike({ type: "sus4", tens: [], root: q.root }, q).upper, [65, 67, 72]);
  assert.deepStrictEqual(C.voiceLike({ type: "6", tens: [], root: q.root }, q).upper, [64, 67, 69, 72]);
  for (let i = 0; i < 500; i++) {
    const qq = C.makeChord({ types: ["m7", "M7", "dom7", "6"], inv: true });
    for (const s of ["7sus4", "", "m6", "7(9)"]) {
      const v = C.voiceLike(C.judgeChord(s, qq).chord, qq);
      assert.strictEqual(v.bass, qq.bass.midi);
      // 문제의 위 화음 자리 안에서 (자리가 없어 빠진 음 때문에 맨 아래 음이 올라갈 수는 있음).
      // 문제에 없는 텐션(9)만 위 화음 맨 위 음 위에 (2026-11-25)
      const top = s === "7(9)" ? qq.upper.at(-1).midi + 12 : qq.upper.at(-1).midi + 2;
      assert.ok(v.upper[0] >= qq.upper[0].midi - 2 && v.upper.at(-1) <= top, `${qq.name} → ${s}`);
      const want = new Set(E.tonesFor(C.judgeChord(s, qq).chord.type, qq.root, C.judgeChord(s, qq).chord.tens).tones.map(t => t.pc));
      assert.deepStrictEqual(new Set(v.upper.map(mod12)), want);
    }
  }
  assert.strictEqual(C.chordName({ type: "m7b5", tens: [], root: { l: 6, a: -1 } }), "B♭m7(♭5)");
  assert.strictEqual(C.chordName({ type: "dom7", tens: ["b9"], root: { l: 4, a: 0 } }), "G7(♭9)");
});

// 텐션 (2026-11-25 사용자 결정): 엔진 규칙대로만, 근음은 위 화음에서 빼고(베이스가 냄), 텐션 2개면 완전5음도 뺌
test("ear chords: tensions follow the engine rules; with inversions the upper voices drop the root (and the fifth with two tensions), without them everything is stacked in order", () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 4000; i++) {
    const inv = i % 2 === 0;
    const q = C.makeChord({ types: ALL, inv, tens: true, tenMax: 2 });
    const T = E.BY_ID[q.type];
    counts[q.tens.length]++;
    assert.ok(q.tens.length <= Math.min(2, T.maxTen || 9), q.name);
    for (const id of q.tens) assert.ok((T.ten || []).includes(id), `${q.name}: ${id}`);
    const degs = q.tens.map(id => E.TEN[id][1]);
    if (degs.length === 2 && degs[0] === degs[1]) assert.deepStrictEqual(q.tens, ["b9", "#9"]);
    // 범위·간격 (자리바꿈 꺼짐 + 텐션만 위쪽 끝이 G♯5)
    assert.ok(q.upper[0].midi >= C.UPPER_LOW && q.upper.at(-1).midi <= (inv ? C.UPPER_HIGH : C.STACK_HIGH), q.name);
    assert.ok(q.upper[0].midi - q.bass.midi >= C.MIN_GAP, q.name);
    const up = new Set(q.upper.map(n => mod12(n.midi)));
    if (!inv) {
      // 자리바꿈 꺼짐: 기본형 — 구성음 순서(1 3 5 7 텐션)대로 위로. 텐션이 있으면 근음은 베이스만(5음은 남김), G♯5까지 (2026-11-25 사용자 요청)
      const want = E.tonesFor(q.type, q.root, q.tens).tones.filter(t => (!q.tens.length || t.deg !== 1) && !(E.susB13(q) && t.deg === 5));
      assert.ok(q.upper.at(-1).midi <= (q.tens.length ? C.STACK_HIGH : C.UPPER_HIGH), q.name);
      assert.deepStrictEqual(q.upper.map(n => mod12(n.midi)), want.map(t => t.pc), q.name);
      for (let k = 1; k < q.upper.length; k++) assert.ok(q.upper[k].midi - q.upper[k - 1].midi < 12, `${q.name}: stacked`);
    } else {
      // 베이스 바로 위: 코드 음이거나, 베이스(E2보다 낮으면 한 옥타브 위 베이스)에서 한 옥타브 이상 떨어진 텐션
      const ref = q.bass.midi < C.REF_BASS ? q.bass.midi + 12 : q.bass.midi;
      if (q.upper[0].deg >= 9) assert.ok(q.upper[0].midi - ref >= 12, `${q.name}: low tension near the bass`);
      for (let k = 1; k < q.upper.length; k++) assert.ok(q.upper[k].midi - q.upper[k - 1].midi < 12, `${q.name}: gap`);
      // 텐션 문제: 핵심음(3·7 + sus4의 4 · m7(♭5)의 ♭5)은 C5 아래, 한 옥타브 안, 평균보다 위에는 하나까지
      if (q.tens.length) {
        const core = q.upper.filter(n => [2, 3, 4, 7].includes(n.deg) || (q.type === "m7b5" && n.deg === 5)).map(n => n.midi);
        const avg = q.upper.reduce((a, n) => a + n.midi, 0) / q.upper.length;
        assert.ok(core.every(m => m < C.CORE_TOP), `${q.name}: core below C5`);
        assert.ok(Math.max(...core) - Math.min(...core) < 12, `${q.name}: core within an octave`);
        assert.ok(core.filter(m => m > avg).length <= 1, `${q.name}: core not on top`);
      }
    }
    // 2도(반음·온음)가 세 번 이어지는 네 음 뭉침 없음
    for (let k = 0; k + 3 < q.upper.length; k++) assert.ok(![1, 2, 3].every(j => q.upper[k + j].midi - q.upper[k + j - 1].midi <= 2), `${q.name}: cluster of seconds`);
    // 7sus4(♭13): 완전5음 없음 (♭13과 반음으로 부딪혀서)
    if (q.type === "7sus4" && q.tens.includes("b13")) assert.ok(!up.has(mod12(q.rootPc + 7)), `${q.name}: no 5th with ♭13`);
    // 7sus4(9,♭13): 자리바꿈 허용이면 아래부터 7 · 9 · 4 · ♭13 순서만
    if (inv && q.type === "7sus4" && q.tens.join() === "9,b13") assert.deepStrictEqual(q.upper.map(n => mod12(n.midi - q.rootPc)), [10, 2, 5, 8], q.name);
    // 7sus4(♭9,13): 13은 7음 위 장7도 (뭉치지 않게)
    if (q.type === "7sus4" && q.tens.join() === "b9,13") {
      const s7 = q.upper.find(n => n.deg === 7).midi, t13 = q.upper.find(n => n.deg === 13).midi;
      assert.strictEqual(t13 - s7, 11, q.name);
    }
    // 단9도·단16도 없음 (근음 – ♭9, 완전5음 – ♭13만 예외), 단2도는 괜찮음
    const all = [q.bass, ...q.upper];
    for (const a of all) for (const b of all) {
      const d = b.midi - a.midi;
      const ok = (mod12(a.midi - q.rootPc) === 0 && q.tens.includes("b9") && mod12(b.midi - q.rootPc) === 1)
        || (q.tens.includes("b13") && mod12(a.midi - q.rootPc) === 7 && mod12(b.midi - q.rootPc) === 8);
      if (d > 12 && d % 12 === 1) assert.ok(ok, `${q.name}: minor 9th ${a.name}–${b.name}`);
    }
    if (q.tens.length) assert.ok(!up.has(q.rootPc), `${q.name}: no root in the upper voices`);
    if (q.tens.length && inv) {
      for (const id of q.tens) assert.ok(up.has(mod12(q.rootPc + E.TEN[id][0])), `${q.name}: ${id} sounds`);
      if (q.tens.length === 2 && E.BY_ID[q.type].tones.some(([s, d]) => s === 7 && d === 5)) assert.ok(!up.has(mod12(q.rootPc + 7)), `${q.name}: no 5th`);
    }
    // 맞는 이름을 쓰면 정답 (근음 글자 뒤 부분)
    assert.ok(C.judgeChord(q.name.slice(C.rootText(q.root).length), q).correct, q.name);
  }
  assert.ok(counts[0] > 0 && counts[1] > 0 && counts[2] > 0, "mixed: no tension, one, two");
  // 자리바꿈 꺼짐 + 텐션 2개도 모든 근음에서 나옴 (위쪽 끝을 넓힌 이유)
  const roots2 = new Set();
  for (let i = 0; i < 6000; i++) { const q = C.makeChord({ types: ["dom7", "M7", "m7"], inv: false, tens: true, tenMax: 2 }); if (q.tens.length === 2) roots2.add(q.rootPc); }
  assert.strictEqual(roots2.size, 12);
  // 도미넌트 7만 골라도 문제가 늘 만들어짐 (단9도를 피하느라 못 만드는 일 없음)
  for (let i = 0; i < 2000; i++) assert.ok(C.makeChord({ types: ["dom7"], inv: i % 2 === 0, tens: true, tenMax: 2 }));
  // 텐션을 꺼 두면 텐션 없음
  for (let i = 0; i < 300; i++) assert.deepStrictEqual(C.makeChord({ types: ALL, inv: true }).tens, []);
});

test("ear chords: judging with tensions — the tension must be written; hear-my-answer keeps the question's slots", () => {
  let q;
  do q = C.makeChord({ types: ["dom7"], inv: false, tens: true, tenMax: 1 }, Math.random); while (q.tens.join() !== "9");
  assert.ok(C.judgeChord("7(9)", q).correct);
  assert.ok(C.judgeChord("9", q).correct);          // C9 = C7(9)
  assert.strictEqual(C.judgeChord("7", q).correct, false);
  assert.strictEqual(C.judgeChord("7(♭9)", q).correct, false);
  // 내 답 듣기: ♭9로 답하면 9 자리의 음만 반음 내림, 근음은 위 화음에 다시 넣지 않음
  const up = q.upper.map(n => n.midi);
  const nine = q.upper.find(n => n.deg === 9).midi;
  const v = C.voiceLike({ type: "dom7", tens: ["b9"], root: q.root }, q);
  assert.deepStrictEqual(v.upper, up.map(m => (m === nine ? m - 1 : m)).sort((a, b) => a - b));
  // 텐션 없는 C7로 답하면 9가 빠지고, 근음은 베이스만
  const v2 = C.voiceLike({ type: "dom7", tens: [], root: q.root }, q);
  assert.deepStrictEqual(v2.upper, up.filter(m => m !== nine));
  // 문제에 없는 텐션(13)은 위 화음 맨 위 음보다 위에
  const v3 = C.voiceLike({ type: "dom7", tens: ["9", "13"], root: q.root }, q);
  assert.ok(v3.upper.at(-1) > up.at(-1) && mod12(v3.upper.at(-1) - q.rootPc) === 9);
});
