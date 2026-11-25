// 청음 연습 코드 ① 코드 종류 — 출제·채점 규칙 (src/assets/js/ear/chords.js, chordoven-spec.md "청음 연습" 코드 ①)
import test from "node:test";
import assert from "node:assert";
import * as C from "../src/assets/js/ear/chords.js";
import { Engine as E } from "../src/assets/js/core/engine.js";

const mod12 = n => ((n % 12) + 12) % 12;
const ALL = C.GROUPS.flatMap(g => g.ids);

test("ear chords: bass is the root in E2–D♯3, upper voices in E3–D5 at least a fourth above the bass, close position", () => {
  for (const inv of [false, true]) for (let i = 0; i < 3000; i++) {
    const q = C.makeChord({ types: ALL, inv });
    assert.ok(q, "should make a chord");
    assert.ok(q.bass.midi >= C.BASS_LOW && q.bass.midi <= C.BASS_HIGH);
    assert.strictEqual(mod12(q.bass.midi), q.rootPc);
    assert.ok(q.upper[0].midi >= C.UPPER_LOW && q.upper.at(-1).midi <= C.UPPER_HIGH);
    assert.ok(q.upper[0].midi - q.bass.midi >= C.MIN_GAP, `${q.name} gap`);
    assert.ok(q.upper.at(-1).midi - q.upper[0].midi < 12, "close position fits in an octave");
    // 위 화음은 그 코드의 구성음 전부, 겹치지 않게
    const want = new Set(E.tonesFor(q.type, q.root, []).tones.map(t => t.pc));
    assert.deepStrictEqual(new Set(q.upper.map(n => mod12(n.midi))), want);
    assert.strictEqual(q.upper.length, want.size);
    if (!inv) assert.strictEqual(mod12(q.upper[0].midi), q.rootPc, "root position without inversions");
    // 철자와 높이가 맞음
    for (const n of [q.bass, ...q.upper]) assert.ok(Number.isInteger(n.oct) && Math.abs(n.a) <= 1, JSON.stringify(n));
  }
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
      // 문제의 위 화음 자리 안에서 (자리가 없어 빠진 음 때문에 맨 아래 음이 올라갈 수는 있음)
      assert.ok(v.upper[0] >= qq.upper[0].midi - 2 && v.upper.at(-1) <= qq.upper.at(-1).midi + 2, `${qq.name} → ${s}`);
      const want = new Set(E.tonesFor(C.judgeChord(s, qq).chord.type, qq.root, C.judgeChord(s, qq).chord.tens).tones.map(t => t.pc));
      assert.deepStrictEqual(new Set(v.upper.map(mod12)), want);
    }
  }
  assert.strictEqual(C.chordName({ type: "m7b5", tens: [], root: { l: 6, a: -1 } }), "B♭m7(♭5)");
  assert.strictEqual(C.chordName({ type: "dom7", tens: ["b9"], root: { l: 4, a: 0 } }), "G7(♭9)");
});
