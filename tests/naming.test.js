// 코드 추론하기 엔진 규칙 검사.  실행: npm test
import test from "node:test";
import assert from "node:assert";
import { Naming as N } from "../src/assets/js/core/naming.js";

const ALL = Object.fromEntries(N.NAME_TYPES.map(t => [t.id, true]));
const base = { types: ALL, optB: false, bases: Array(12).fill(false), optC: true, cMax: 2, optE: false, optInv: false };
const gen = (over = {}, n = 8000) => Array.from({ length: n }, () => N.generate({ ...base, ...over }));
const mod12 = n => ((n % 12) + 12) % 12;

// 음 이름 목록으로 문제 모양 만들기 ("C4 E4 G4" → notes, pcs)
const LET = "CDEFGAB", NAT = [0, 2, 4, 5, 7, 9, 11];
function prob(text, inv = true) {
  const notes = text.split(" ").map(s => {
    const [, L, acc, o] = s.match(/^([A-G])([♯♭]*)(\d)$/);
    const a = [...acc].reduce((x, c) => x + (c === "♯" ? 1 : -1), 0);
    const l = LET.indexOf(L);
    return { midi: (+o + 1) * 12 + NAT[l] + a, name: L + acc, l, a, oct: +o };
  });
  return { inv, notes, pcs: new Set(notes.map(n => mod12(n.midi))), answers: N.answers(notes, inv) };
}
const names = p => p.answers.map(a => a.symbol);

test("naming: notes stay in F3–D6, one per pitch class, and tension chord types never appear", () => {
  for (const optInv of [false, true]) for (const optE of [false, true]) for (const q of gen({ optInv, optE }, 4000)) {
    assert.ok(!q.error, q.error);
    assert.ok(q.notes.every(n => n.midi >= N.LOW && n.midi <= N.HIGH), q.symbol);
    assert.strictEqual(new Set(q.notes.map(n => mod12(n.midi))).size, q.notes.length, q.symbol);
    assert.ok(!q.alt && N.NAME_TYPES.some(t => t.id === q.type), q.symbol);
    // 악보 철자가 건반 높이와 맞음 (옥타브 포함)
    for (const n of q.notes) assert.strictEqual((n.oct + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][n.l] + n.a, n.midi, `${q.symbol} ${n.name}`);
  }
});

test("naming: without inversion the notes are stacked 1 3 5 7 9 11 13 from the root, fifth always shown", () => {
  for (const q of gen({ optInv: false })) {
    assert.strictEqual(mod12(q.notes[0].midi), q.rootPc, q.symbol);
    const want = q.tones.filter(t => t.role !== "alt").length;
    assert.strictEqual(q.notes.length, want, `${q.symbol}: all tones incl. optional fifth`);
  }
});

test("naming: with inversion the bass varies and an optional fifth is left out about half the time", () => {
  const qs = gen({ optInv: true }, 6000);
  assert.ok(qs.filter(q => mod12(q.notes[0].midi) !== q.rootPc).length > 2000, "bass is often not the root");
  const withOpt = qs.filter(q => q.optional.size);
  const omitted = withOpt.filter(q => q.notes.length < q.tones.length).length / withOpt.length;
  assert.ok(omitted > 0.4 && omitted < 0.6, `omitted ${omitted}`);
});

test("naming: the question's own name and every listed answer are graded correct; question root comes first", () => {
  for (const optInv of [false, true]) for (const optE of [false, true]) for (const q of gen({ optInv, optE }, 4000)) {
    assert.ok(q.answers.length >= 1, q.symbol);
    assert.strictEqual(q.answers[0].rootPc, q.rootPc, `${q.symbol} → ${names(q)}`);
    assert.ok(N.check(q.symbol, q).correct, `own symbol ${q.symbol}`);
    for (const a of q.answers) assert.ok(N.check(a.symbol, q).correct, `${a.symbol} for ${q.symbol}`);
    if (!optInv) assert.strictEqual(q.answers.length, 1, `${q.symbol} → ${names(q)}`);
  }
});

test("naming: answer list uses one spelling per root (♯11, ♭13, augM7; no aug7 / ♭5 / ♯5)", () => {
  for (const q of gen({ optInv: true })) for (const a of q.answers) {
    assert.ok(!/aug7|\(.*[♭♯]5|M7\(♯5\)/.test(a.symbol.replace("m7(♭5", "")), a.symbol);
  }
  assert.strictEqual(names(prob("C4 E4 A♭4 B♭4"))[0], "C7(♭13)");
  assert.deepStrictEqual(names(prob("C4 E4 G♭4 B♭4", false)), ["C7(♯11)"]);
  assert.deepStrictEqual(names(prob("C4 E4 G♯4 B4", false)), ["CaugM7"]);
});

test("naming: multiple answers — the examples from the spec", () => {
  assert.deepStrictEqual(names(prob("D4 F4 A♭4 C5")).sort(), ["Dm7(♭5)", "Fm6"].sort());
  assert.deepStrictEqual(names(prob("C4 E♭4 G♭4 A4")).sort(), ["Adim7", "Cdim7", "E♭dim7", "G♭dim7"].sort());
  assert.deepStrictEqual(names(prob("C4 E4 G♯4")).sort(), ["Caug", "Eaug", "G♯aug"].sort());
  assert.deepStrictEqual(names(prob("C4 E4 G♭4 B♭4 D5")).sort(), ["C7(9,♯11)", "D7(9,♭13)", "G♭7(♯11,♭13)"].sort());
  assert.strictEqual(names(prob("C4 D4 E4 G♭4 A♭4 B♭4")).length, 6);
  assert.ok(names(prob("C4 D4 E4 G♭4 A♭4 B♭4")).includes("C7(9,♯11,♭13)"));
  // 자리바꿈 꺼짐: 맨 아래 음이 근음인 이름만
  assert.deepStrictEqual(names(prob("D4 F4 A♭4 C5", false)), ["Dm7(♭5)"]);
});

test("naming: other spellings of the same chord are accepted (enharmonic roots too)", () => {
  const p = prob("C4 E♭4 G♭4 A4");
  for (const s of ["Cdim7", "C°7", "D#dim7", "D♯dim7", "Ebdim7", "Gbdim7", "F#dim7", "Adim7", "Bbbdim7"]) assert.ok(N.check(s, p).correct, s);
  const aug7 = prob("C4 E4 A♭4 B♭4");
  for (const s of ["C7(b13)", "C7(#5)", "Caug7", "C+7", "C7(♯5)"]) assert.ok(N.check(s, aug7).correct, s);
  const b5 = prob("C4 E4 G♭4 B♭4");
  for (const s of ["C7(#11)", "C7(b5)", "C7(♭5)"]) assert.ok(N.check(s, b5).correct, s);
  const augM7 = prob("C4 E4 G♯4 B4");
  for (const s of ["CaugM7", "CM7(#5)", "C+M7", "Caugmaj7", "C+△7"]) assert.ok(N.check(s, augM7).correct, s);
  const m7b5 = prob("D4 F4 A♭4 C5");
  for (const s of ["Dm7(b5)", "Dm7b5", "Dø", "Dø7", "Dmi7(b5)", "D-7(b5)", "Fm6", "F-6"]) assert.ok(N.check(s, m7b5).correct, s);
});

test("naming: keyboard aliases — M7 / m7 / mM7 / 6(9) spellings, case matters", () => {
  const M7 = prob("C4 E4 G4 B4", false);
  for (const s of ["CM7", "Cma7", "Cmaj7", "C△7", "CMaj7", "C△", "C M7"]) assert.ok(N.check(s, M7).correct, s);
  const m7 = prob("C4 E♭4 G4 B♭4", false);
  for (const s of ["Cm7", "Cmi7", "Cmin7", "C-7"]) assert.ok(N.check(s, m7).correct, s);
  assert.ok(!N.check("CM7", m7).correct, "M is major, not minor");
  const mM7 = prob("C4 E♭4 G4 B4", false);
  for (const s of ["CmM7", "Cmmaj7", "Cm(maj7)", "Cm△7", "C-M7", "CminMaj7"]) assert.ok(N.check(s, mM7).correct, s);
  const six9 = prob("C4 E4 G4 A4 D5", false);
  for (const s of ["C6(9)", "C6/9"]) assert.ok(N.check(s, six9).correct, s);
  const sus = prob("C4 F4 G4", false);
  for (const s of ["Csus4", "Csus"]) assert.ok(N.check(s, sus).correct, s);
  assert.ok(N.check("C7(b9", prob("C4 E4 G4 B♭4 D♭5", false)).correct, "missing ) is closed");
});

test("naming: tension chord names count as seventh + tension (C9 = C7(9), Cm11 = Cm7(11), CM13 = CM7(13))", () => {
  const same = [["C9", "C7(9)"], ["C13", "C7(13)"], ["Cm9", "Cm7(9)"], ["Cm11", "Cm7(11)"], ["CM9", "CM7(9)"], ["CM13", "CM7(13)"],
    ["Cmaj9", "CM7(9)"], ["C-11", "Cm7(11)"], ["C9(#11)", "C7(9,#11)"], ["C13(b9)", "C7(b9,13)"]];
  for (const [a, b] of same) assert.deepStrictEqual(N.parse(a), N.parse(b), a);
  assert.ok(N.check("C9", prob("C4 E4 G4 B♭4 D5", false)).correct);
  assert.ok(N.check("C13", prob("C4 E4 B♭4 A5")).correct, "C13 = C7(13), no 9 needed");
});

test("naming: input errors — lowercase root, tensions outside parentheses, unknown", () => {
  const p = prob("C4 E4 G4 B♭4 D5", false);
  assert.strictEqual(N.check("c7(9)", p).error, "lowerRoot");
  assert.strictEqual(N.check("bb7", p).error, "lowerRoot");
  for (const s of ["C69", "C7b9", "C11", "Cm13", "C7#5", "Cmaj7#11"]) assert.strictEqual(N.check(s, p).error, "noParen", s);
  for (const s of ["", "   "]) assert.strictEqual(N.check(s, p).error, "empty", s);
  for (const s of ["H7", "Cxyz", "C(9)", "C7(9))", "Cm6(9)"]) assert.strictEqual(N.check(s, p).error, "unknown", s);
});

test("naming: wrong answers say which notes are missing and which do not belong", () => {
  const p = prob("C4 E4 G4 B♭4", false);
  assert.deepStrictEqual(N.check("Cm7", p), { correct: false, missing: ["E♭"], extra: ["E"], bassWrong: false });
  assert.deepStrictEqual(N.check("C7(9)", p), { correct: false, missing: ["D"], extra: [], bassWrong: false });
  assert.deepStrictEqual(N.check("C", p), { correct: false, missing: [], extra: ["B♭"], bassWrong: false });
  // 자리바꿈 꺼짐: 구성음은 맞아도 근음이 맨 아래가 아니면 오답
  const q = prob("D4 F4 A♭4 C5", false);
  assert.deepStrictEqual(N.check("Fm6", q), { correct: false, missing: [], extra: [], bassWrong: true });
});

test("naming: settings — selected roots only, no tensions when option C is off", () => {
  const bases = Array(12).fill(false); bases[2] = bases[9] = true;
  for (const q of gen({ optB: true, bases, optInv: true }, 2000)) assert.ok([2, 9].includes(q.rootPc), q.symbol);
  for (const q of gen({ optC: false }, 2000)) assert.strictEqual(q.tens.length, 0, q.symbol);
});

// 화면에 보이는 이름에 복잡한 음 표현(𝄫 𝄪 C♭ F♭ E♯ B♯)이 있는지
const ODD = /[𝄫𝄪]|C♭|F♭|E♯|B♯/;
const only = (type, pc, over = {}) => {
  const bases = Array(12).fill(false); bases[pc] = true;
  return gen({ types: { [type]: true }, optB: true, bases, optC: false, ...over }, 300);
};

test("naming spelling: inversion on → always easy spelling, whatever option E says", () => {
  for (const optE of [false, true]) for (const q of gen({ optInv: true, optE }, 4000)) {
    assert.ok(!q.notes.some(n => ODD.test(n.name)), `${q.symbol}: ${q.notes.map(n => n.name)}`);
  }
});

test("naming spelling: inversion off + option E on → original spelling, stacked in thirds on the staff", () => {
  const qs = gen({ optE: true }, 4000);
  assert.ok(qs.some(q => q.notes.some(n => ODD.test(n.name))), "some questions use C♭ / E♯ / 𝄫 …");
  for (const q of qs) for (let i = 1; i < q.notes.length; i++) {
    const step = (q.notes[i].oct * 7 + q.notes[i].l) - (q.notes[i - 1].oct * 7 + q.notes[i - 1].l);
    // 악보 자리가 늘 위로. 예외: ♭9와 ♯9는 같은 글자(G·G𝄪)라 같은 줄에 나란히 — 3단계 악보에서 음표 머리를 옆으로 비켜 그림
    const b9s9 = q.tens.includes("b9") && q.tens.includes("#9") && step === 0;
    assert.ok(step >= 1 || b9s9, `${q.symbol}: ${q.notes.map(n => n.name + n.oct)}`);
  }
  for (const q of only("dom7", 1, { optE: true })) assert.ok(q.notes.some(n => ["C♭", "E♯"].includes(n.name)), q.symbol);
  // 옵션 E에서는 C 건반 근음이 B♯로도 나옴
  for (const q of only("dim7", 0, { optE: true })) assert.ok(["C E♭ G♭ B𝄫", "B♯ D♯ F♯ A"].includes(q.notes.map(n => n.name).join(" ")), q.symbol);
});

test("naming spelling: inversion off + option E off → flip the black-key root, else easy spelling", () => {
  for (const q of gen({ optE: false }, 6000)) assert.ok(!q.notes.some(n => ODD.test(n.name)), `${q.symbol}: ${q.notes.map(n => n.name)}`);
  for (const q of only("min", 1)) assert.strictEqual(q.symbol, "C♯m");      // D♭m는 F♭가 필요 → C♯m
  for (const q of only("min", 8)) assert.strictEqual(q.symbol, "G♯m");      // A♭m는 C♭가 필요 → G♯m
  for (const q of only("M7", 6)) assert.strictEqual(q.symbol, "G♭M7");      // F♯M7는 E♯가 필요 → G♭M7
  for (const q of only("min", 3)) assert.strictEqual(q.symbol, "E♭m");      // 쉬운 철자면 그대로
  // 철자를 바꿔도 안 되는 코드는 빼지 않고 쉬운 표현으로
  for (const q of only("dom7", 1)) assert.deepStrictEqual(q.notes.map(n => n.name), ["D♭", "F", "A♭", "B"]);
  for (const q of only("dim7", 0)) assert.deepStrictEqual(q.notes.map(n => n.name), ["C", "E♭", "G♭", "A"]);
});
