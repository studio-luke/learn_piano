// 코드 엔진 규칙 + 번역 키 검사.  실행: npm test   (Node 18 이상, 설치할 것 없음)
import test from "node:test";
import assert from "node:assert";
import { Engine as E } from "../public/assets/js/core/engine.js";
import ko from "../public/assets/js/i18n/ko.js";
import en from "../public/assets/js/i18n/en.js";
import ja from "../public/assets/js/i18n/ja.js";
import zh from "../public/assets/js/i18n/zh.js";

const ALL = Object.fromEntries(E.TYPES.map(t => [t.id, true]));
const base = { types: ALL, optB: false, bases: Array(12).fill(false), optC: true, cMax: 2, optD: true, optE: false };
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

test("translations: every language has exactly the keys of ko.js", () => {
  const keys = Object.keys(ko);
  for (const [l, strings] of Object.entries({ en, ja, zh })) {
    assert.deepStrictEqual(keys.filter(k => !(k in strings)), [], `${l} missing keys`);
    assert.deepStrictEqual(Object.keys(strings).filter(k => !(k in ko)), [], `${l} has keys ko.js does not`);
  }
});

test("augM7 is also written M7(♯5)", () => {
  const labels = new Set(gen({ types: { augM7: true }, optD: false }, 400).map(q => q.label));
  assert.deepStrictEqual([...labels].sort(), ["M7(♯5)", "augM7"]);
});

test("rebuild: a saved question comes back the same", () => {
  for (const optE of [false, true]) for (const q of gen({ optE }, 3000)) {
    const r = E.rebuild(JSON.parse(JSON.stringify(E.spec(q))), { optE });
    assert.strictEqual(r.symbol, q.symbol);
    assert.deepStrictEqual(r.tones.map(t => t.name), q.tones.map(t => t.name), q.symbol);
    assert.deepStrictEqual([...r.required].sort(), [...q.required].sort(), q.symbol);
    assert.strictEqual(E.quality(r), q.alt ? "7alt" : q.type);
  }
  assert.strictEqual(E.rebuild({ type: "nope", l: 0, a: 0, tens: [], head: "", items: [] }, {}), null);
  assert.strictEqual(E.rebuild({ type: "dom7", l: 9, a: 0, tens: [], head: "7", items: [] }, {}), null);
  assert.strictEqual(E.rebuild({ type: "dom7", l: 0, a: 0, tens: ["x"], head: "7", items: [] }, {}), null);
});

test("option E: C♭ E♯ A♯ D♯ G♯ a little more often, B♯ and F♭ now and then", () => {
  const qs = gen({ optE: true }, 40000);
  const share = names => qs.filter(q => names.includes(q.rootName)).length / qs.length;
  assert.ok(share(["B♯"]) > 0.002 && share(["F♭"]) > 0.005, "B♯ / F♭ appear");
  const rare = share(["C♭", "E♯", "A♯", "D♯", "G♯"]);
  assert.ok(rare > 0.165 && rare < 0.21, `C♭ E♯ A♯ D♯ G♯: ${rare}`);
  assert.strictEqual(gen({ optE: false }, 20000).filter(q => /^(B♯|F♭|C♭|E♯|A♯|D♯|G♯)/.test(q.rootName)).length, 0);
});

test("the next question never has the same root (key) as the previous one, unless only one root is allowed", () => {
  for (const optE of [false, true]) {
    let prev = null;
    for (let i = 0; i < 5000; i++) {
      const q = E.generate({ ...base, optE }, Math.random, prev);
      if (prev) assert.notStrictEqual(q.rootPc, prev.rootPc, `${prev.symbol} → ${q.symbol}`);
      prev = q;
    }
  }
  // 옵션 B로 C 하나만: 계속 C (같은 베이스밖에 없음)
  const onlyC = { ...base, optB: true, bases: Array.from({ length: 12 }, (_, i) => i === 0) };
  let prev = E.generate(onlyC);
  for (let i = 0; i < 50; i++) { const q = E.generate(onlyC, Math.random, prev); assert.strictEqual(q.rootPc, 0); prev = q; }
  // 두 개면 번갈아
  const cAndG = { ...base, optB: true, bases: Array.from({ length: 12 }, (_, i) => i === 0 || i === 7) };
  prev = E.generate(cAndG);
  for (let i = 0; i < 50; i++) { const q = E.generate(cAndG, Math.random, prev); assert.notStrictEqual(q.rootPc, prev.rootPc); prev = q; }
});
