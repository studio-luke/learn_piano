// 청음 연습 검사 (조성·스케일·출제·채점 — ear/theory.js).  실행: npm test
import test from "node:test";
import assert from "node:assert";
import { keyNotes, pcOf, pickMelody, nameOf, signature, scaleMidis, candidates, pickNote, judgeNote, spellMidi, midiOf, otherKey, sameRoot, KEY_ROOTS, LOW, HIGH } from "../src/assets/js/ear/theory.js";

const names = list => list.map(nameOf);

test("ear: major scale spelling and chromatic notes (♭2 ♭3 ♯4 ♭6 ♭7)", () => {
  const d = keyNotes({ root: "E♭", minor: false });
  assert.deepStrictEqual(names(d.diatonic), ["E♭", "F", "G", "A♭", "B♭", "C", "D"]);
  assert.deepStrictEqual(names(d.chromatic), ["F♭", "G♭", "A", "C♭", "D♭"]);
  assert.deepStrictEqual(names(keyNotes({ root: "C", minor: false }).chromatic), ["D♭", "E♭", "F♯", "A♭", "B♭"]);
});

test("ear: minor = natural minor + leading tone (2026-11-24), chromatic ♭2 ♮3 ♯4 ♮6", () => {
  const d = keyNotes({ root: "A", minor: true });
  assert.deepStrictEqual(names(d.diatonic), ["A", "B", "C", "D", "E", "F", "G", "G♯"]);
  assert.deepStrictEqual(names(d.chromatic), ["B♭", "C♯", "D♯", "F♯"]);
  assert.deepStrictEqual(names(keyNotes({ root: "G♯", minor: true }).diatonic).slice(-1), ["F𝄪"]);   // 이끔음은 조 안의 철자 그대로
});

test("ear: double accidentals outside the key become the plain name (G♭ major ♭2 A𝄫 → G)", () => {
  assert.strictEqual(names(keyNotes({ root: "G♭", minor: false }).chromatic)[0], "G");
});

test("ear: key signatures", () => {
  assert.deepStrictEqual(signature({ root: "C", minor: false }).count, 0);
  const d = signature({ root: "D", minor: false });
  assert.deepStrictEqual([d.a, d.count], [1, 2]);
  const g = signature({ root: "G♭", minor: false });
  assert.deepStrictEqual([g.a, g.count], [-1, 6]);
  const c = signature({ root: "C", minor: true });
  assert.deepStrictEqual([c.a, c.count], [-1, 3]);   // 단조는 나란한조와 같은 조표 (이끔음은 임시표)
  for (const minor of [false, true]) for (const root of KEY_ROOTS[minor ? "minor" : "major"]) assert.ok(signature({ root, minor }).count <= 7);
});

test("ear: scale playback starts on the tonic between F3 and E4 and spans one octave", () => {
  for (const minor of [false, true]) for (const root of KEY_ROOTS[minor ? "minor" : "major"]) {
    const ms = scaleMidis({ root, minor });
    assert.strictEqual(ms.length, 8);
    assert.ok(ms[0] >= 53 && ms[0] <= 64, root);
    assert.strictEqual(ms[7] - ms[0], 12);
  }
});

test("ear: candidates stay in F3–F5, diatonic only unless chromatic is on", () => {
  const c = candidates({ root: "C", minor: false });
  assert.ok(c.every(n => n.midi >= LOW && n.midi <= HIGH && n.a === 0));
  assert.strictEqual(c.length, 15);   // F3 ~ F5의 흰 건반
  assert.strictEqual(candidates({ root: "C", minor: false }, { chromatic: true }).length, 25);
  assert.ok(candidates({ root: "B", minor: false }).every(n => n.midi === midiOf(n)));
});

test("ear: the same note is not asked twice in a row, and the next note is at most a major 10th away", () => {
  for (const chromatic of [false, true]) {
    const k = { root: "C", minor: false };
    let prev = null;
    for (let i = 0; i < 400; i++) {
      const q = pickNote(k, { chromatic }, prev);
      assert.notStrictEqual(q.midi, prev);
      if (prev !== null) assert.ok(Math.abs(q.midi - prev) <= 16, `${prev} → ${q.midi}`);
      prev = q.midi;
    }
  }
  // 범위 끝(F3)에서도 E5(76)처럼 먼 음은 안 나옴
  for (let i = 0; i < 200; i++) assert.ok(pickNote({ root: "C", minor: false }, {}, 53).midi <= 69);
});

test("ear: judging — octave must match, same name in another octave is a hint, enharmonic is fine", () => {
  assert.strictEqual(judgeNote(66, 66), "ok");
  assert.strictEqual(judgeNote(66, 54), "octUp");
  assert.strictEqual(judgeNote(66, 78), "octDown");
  assert.strictEqual(judgeNote(66, 67), "no");
});

test("ear: spelling a key press follows the key (D major F♯, C♭ in G♭ major keeps its octave)", () => {
  assert.strictEqual(nameOf(spellMidi({ root: "D", minor: false }, 66)), "F♯");
  const cb = spellMidi({ root: "G♭", minor: false }, 71);   // B4 건반 = C♭5
  assert.deepStrictEqual([nameOf(cb), cb.oct, midiOf(cb)], ["C♭", 5, 71]);
});

test("ear: other key keeps major/minor and changes the tonic; same root keeps the pitch", () => {
  for (let i = 0; i < 50; i++) { const k = otherKey({ root: "C", minor: true }); assert.ok(k.minor && k.root !== "C"); }
  assert.strictEqual(sameRoot("D♭", true), "C♯");
  assert.strictEqual(sameRoot("G♯", false), "A♭");
});

test("ear level 2: 4-note melody — neighbours at most an octave apart, all in F3–F5", () => {
  for (const minor of [false, true]) for (const root of KEY_ROOTS[minor ? "minor" : "major"]) {
    for (let i = 0; i < 40; i++) {
      const m = pickMelody({ root, minor }, { chromatic: true });
      assert.strictEqual(m.length, 4);
      assert.ok(m.every(n => n.midi >= LOW && n.midi <= HIGH && n.midi === midiOf(n)));
      for (let j = 1; j < 4; j++) assert.ok(Math.abs(m[j].midi - m[j - 1].midi) <= 12, root);
    }
  }
});

test("ear level 2: first note is diatonic, near the tonic, mostly a tonic-triad note", () => {
  const key = { root: "D", minor: false };
  const dia = new Set(keyNotes(key).diatonic.map(pcOf)), t0 = scaleMidis(key)[0];
  const triad = new Set([2, 6, 9]);   // D F♯ A
  let tri = 0;
  for (let i = 0; i < 600; i++) {
    const f = pickMelody(key, { chromatic: true })[0];
    assert.ok(dia.has(pcOf(f)) && f.midi >= t0 - 5 && f.midi <= t0 + 12);
    if (triad.has(pcOf(f))) tri++;
  }
  assert.ok(tri > 600 * 0.6, `triad starts ${tri}/600`);
});

test("ear level 2: leaps are not the majority", () => {
  let leaps = 0, total = 0;
  for (let i = 0; i < 500; i++) {
    const m = pickMelody({ root: "C", minor: false });
    for (let j = 1; j < 4; j++) { total++; if (Math.abs(m[j].midi - m[j - 1].midi) > 4) leaps++; }
  }
  assert.ok(leaps / total < 0.5, `leaps ${leaps}/${total}`);
});

test("ear level 2: two notes to answer → 5-note melody with the same rules", () => {
  for (let i = 0; i < 200; i++) {
    const m = pickMelody({ root: "E♭", minor: true }, {}, Math.random, 5);
    assert.strictEqual(m.length, 5);
    for (let j = 1; j < 5; j++) assert.ok(Math.abs(m[j].midi - m[j - 1].midi) <= 12);
    assert.ok(m.every(n => n.midi >= LOW && n.midi <= HIGH));
  }
});
