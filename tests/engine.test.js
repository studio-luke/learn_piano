// Engine rules + translation keys.  Run: npm test   (Node 18+, no dependencies)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");

const ALL = Object.fromEntries(E.TYPES.map(t => [t.id, true]));
const base = { types: ALL, optA: false, optB: false, bases: Array(12).fill(false), optC: true, cMax: 2, optD: true, optE: false };
const gen = (over = {}, n = 20000) => Array.from({ length: n }, () => E.generate({ ...base, ...over }));

test("every question is gradable: answer voicing and an inversion are correct", () => {
  for (const optE of [false, true]) for (const q of gen({ optE })) {
    assert.ok(!q.error, q.error);
    const v = E.voicing(q);
    assert.ok(E.grade(v, q).correct, `voicing ${q.symbol}`);
    const inv = v.map((m, i) => (i === 0 ? m + 12 : m));
    assert.ok(E.grade(inv, q).correct, `inversion ${q.symbol}`);
  }
});

test("note names match their pitch classes", () => {
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  for (const q of gen({ optE: true }, 5000)) for (const t of q.tones) {
    const L = "CDEFGAB".indexOf(t.name[0]);
    const acc = [...t.name.slice(1)].reduce((a, c) => a + ({ "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 }[c] || 0), 0);
    assert.strictEqual(((NAT[L] + acc) % 12 + 12) % 12, t.pc, `${q.symbol} ${t.name}`);
  }
});

test("option E off: no double accidentals and no C♭ F♭ E♯ B♯ among chord tones", () => {
  for (const q of gen({ optE: false })) {
    const names = q.tones.map(t => t.name).join(" ");
    assert.ok(!/[𝄪𝄫]/.test(names) && !/C♭|F♭|E♯|B♯/.test(names), `${q.symbol}: ${names}`);
  }
});

test("tension limits", () => {
  for (const q of gen()) {
    if (["dim7", "augM7", "m11"].includes(q.type)) assert.strictEqual(q.tens.length, 0, q.symbol);
    if (["m7b5", "mM7"].includes(q.type)) assert.ok(q.tens.length <= 1, q.symbol);
    if (q.type === "M9") assert.ok(!q.tens.includes("9"), q.symbol);
    if (q.type === "mM7") assert.ok(!q.tens.includes("13"), q.symbol);
    if (q.tens.includes("#5") || q.tens.includes("b5")) assert.ok(["dom7", "dom9", "dom13"].includes(q.type), q.symbol);
  }
});

test("♯5 / ♭5: playing the perfect 5th is wrong", () => {
  let seen = 0;
  for (const q of gen({ types: { dom7: true, dom9: true, dom13: true } })) {
    if (!(q.tens.includes("#5") || q.tens.includes("b5"))) continue;
    seen++;
    const v = E.voicing(q);
    assert.ok(!E.grade([...v, 48 + q.rootPc + 7], q).correct, q.symbol);
  }
  assert.ok(seen > 0);
});

test("7alt: R 3 ♭7 + at least one altered tension; about 10% of dominant 7ths", () => {
  const qs = gen({ types: { dom7: true }, optC: true, cMax: 1 });
  const alts = qs.filter(q => q.alt);
  const share = alts.length / qs.length;
  assert.ok(share > 0.07 && share < 0.13, `alt share ${share}`);
  const q = alts[0], r = 48 + q.rootPc;
  assert.ok(E.grade([r, r + 4, r + 10, r + 1], q).correct);   // + ♭9
  assert.ok(!E.grade([r, r + 4, r + 10], q).correct);         // no altered tension
  assert.ok(!E.grade([r, r + 4, r + 10, r + 2], q).correct);  // natural 9 is wrong
});

test("translations: every language has every key", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/i18n.js"), "utf8");
  const I18N = new Function(src + "; return I18N;")();
  const keys = Object.keys(I18N.ko);
  for (const l of I18N.LANGS) {
    const missing = keys.filter(k => !(k in I18N[l]));
    assert.deepStrictEqual(missing, [], `${l} missing keys`);
  }
});
