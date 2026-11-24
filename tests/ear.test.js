// 청음 연습 검사 (조성·스케일·출제·채점 — ear/theory.js).  실행: npm test
import test from "node:test";
import assert from "node:assert";
import { keyNotes, nameOf, signature, scaleMidis, candidates, pickNote, judgeNote, spellMidi, midiOf, otherKey, sameRoot, KEY_ROOTS, LOW, HIGH } from "../src/assets/js/ear/theory.js";

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

test("ear: scale playback starts on the tonic between G3 and F♯4 and spans one octave", () => {
  for (const minor of [false, true]) for (const root of KEY_ROOTS[minor ? "minor" : "major"]) {
    const ms = scaleMidis({ root, minor });
    assert.strictEqual(ms.length, 8);
    assert.ok(ms[0] >= 55 && ms[0] <= 66, root);
    assert.strictEqual(ms[7] - ms[0], 12);
  }
});

test("ear: candidates stay in G3–G5, diatonic only unless chromatic is on", () => {
  const c = candidates({ root: "C", minor: false });
  assert.ok(c.every(n => n.midi >= LOW && n.midi <= HIGH && n.a === 0));
  assert.strictEqual(c.length, 15);   // G3 ~ G5의 흰 건반
  assert.strictEqual(candidates({ root: "C", minor: false }, { chromatic: true }).length, 25);
  assert.ok(candidates({ root: "B", minor: false }).every(n => n.midi === midiOf(n)));
});

test("ear: the same note is not asked twice in a row", () => {
  const k = { root: "C", minor: false };
  let prev = null;
  for (let i = 0; i < 200; i++) { const q = pickNote(k, {}, prev); assert.notStrictEqual(q.midi, prev); prev = q.midi; }
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
