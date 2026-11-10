// 코드 초견 검사 (메트로놈의 박 번호·템포 범위).  실행: npm test
import test from "node:test";
import assert from "node:assert";
import { beatInfo, clampBpm, BPM_MIN, BPM_MAX, BPM_DEFAULT } from "../src/assets/js/improv/metronome.js";
import { spanBeats } from "../src/assets/js/improv/timing.js";

test("improv metronome: 4/4 count-in shows 3, 2, 1, GO, then bar 1 beat 1", () => {
  assert.deepStrictEqual([0, 1, 2, 3].map(i => beatInfo(i, 4).label), ["3", "2", "1", "GO"]);
  assert.ok([0, 1, 2, 3].every(i => beatInfo(i, 4).countIn));
  assert.deepStrictEqual(beatInfo(4, 4), { countIn: false, bar: 0, beat: 0 });
  assert.deepStrictEqual(beatInfo(7, 4), { countIn: false, bar: 0, beat: 3 });
  assert.deepStrictEqual(beatInfo(8, 4), { countIn: false, bar: 1, beat: 0 });
});

test("improv metronome: other meters and no count-in", () => {
  assert.deepStrictEqual([0, 1, 2].map(i => beatInfo(i, 3).label), ["2", "1", "GO"]);
  assert.deepStrictEqual(beatInfo(5, 3), { countIn: false, bar: 0, beat: 2 });
  assert.deepStrictEqual(beatInfo(0, 4, 0), { countIn: false, bar: 0, beat: 0 });
  assert.deepStrictEqual(beatInfo(9, 4, 0), { countIn: false, bar: 2, beat: 1 });
});

test("improv metronome: tempo is kept between 30 and 240, default 60", () => {
  assert.strictEqual(BPM_MIN, 30); assert.strictEqual(BPM_MAX, 240); assert.strictEqual(BPM_DEFAULT, 60);
  assert.strictEqual(clampBpm(10), 30);
  assert.strictEqual(clampBpm(999), 240);
  assert.strictEqual(clampBpm("120"), 120);
  assert.strictEqual(clampBpm(72.6), 73);
  assert.strictEqual(clampBpm("abc"), 60);
  assert.strictEqual(clampBpm(undefined), 60);
});

test("improv random: bars per chord → beats per chord (½ = 2, 1 = 4, 2 = 8, unknown = 4)", () => {
  assert.deepStrictEqual(["0.5", "1", "2", 1, "x"].map(spanBeats), [2, 4, 8, 4, 4]);
});

test("improv random: page-only weights bring mM7 + aug7 + augM7 to about 9–10% of the default chord set", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const { WEIGHTS } = await import("../src/assets/js/improv/settings.js");
  const { DEFAULTS } = await import("../src/assets/js/improv/settings.js");
  const on = Object.keys(DEFAULTS.types).filter(id => DEFAULTS.types[id]);
  assert.deepStrictEqual([...on].sort(), ["6", "7sus4", "M7", "add9", "aug7", "augM7", "dim7", "dom7", "m6", "m7", "m7b5", "mM7", "madd9"]);
  const s = { types: Object.fromEntries(on.map(id => [id, true])), optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optD: false, optE: false, weights: WEIGHTS };
  const N = 40000; let n = 0;
  for (let i = 0; i < N; i++) if (["mM7", "aug7", "augM7"].includes(Engine.generate(s).type)) n++;
  const pct = 100 * n / N;
  assert.ok(pct > 8.8 && pct < 10.6, pct.toFixed(1));
  // 다른 연습이 쓰는 원래 가중치는 그대로
  assert.deepStrictEqual(["mM7", "aug7", "augM7"].map(id => Engine.BY_ID[id].w), [1.2, 1, 1]);
});

// ---------- 분수코드 (improv/slash.js, 2026-11-10) ----------
const slashBase = async (over = {}) => {
  const { DEFAULTS, WEIGHTS } = await import("../src/assets/js/improv/settings.js");
  return { ...structuredClone(DEFAULTS), weights: WEIGHTS, slash: true, ...over };
};
const many = async (s, n = 20000) => {
  const Slash = await import("../src/assets/js/improv/slash.js");
  const out = []; let prev = null;
  for (let i = 0; i < n; i++) { const q = Slash.generate(s, Math.random, prev); out.push(q); prev = q; }
  return out;
};

test("improv slash: about 25% slash chords, 60:40 inversions to hybrids, none when the option is off", async () => {
  const qs = await many(await slashBase());
  const sl = qs.filter(q => q.slash), pct = 100 * sl.length / qs.length, inv = 100 * sl.filter(q => q.slash === "inv").length / sl.length;
  assert.ok(pct > 23 && pct < 27, "slash " + pct.toFixed(1));
  assert.ok(inv > 56 && inv < 64, "inversions " + inv.toFixed(1));
  assert.ok(qs.every(q => !q.slash || q.symbol === q.rootName + q.label + "/" + q.bass));
  assert.strictEqual((await many(await slashBase({ slash: false }), 3000)).filter(q => q.slash).length, 0);
});

test("improv slash: inversions use the chosen chord types and the allowed bass notes only", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const { INVERSIONS } = await import("../src/assets/js/improv/slash.js");
  const types = Object.fromEntries(Engine.TYPES.map(x => [x.id, true]));
  const qs = (await many(await slashBase({ types, optC: true, cMax: 2 }), 40000)).filter(q => q.slash === "inv");
  const IV = { "3": 4, b3: 3, "5": 7, b7: 10 };
  const seenTypes = new Set();
  for (const q of qs) {
    seenTypes.add(q.type);
    assert.ok(q.type in INVERSIONS, q.symbol);
    assert.ok(q.tens.length === 0, "텐션 없음 " + q.symbol);
    const iv = (q.bassPc - q.rootPc + 12) % 12;
    assert.ok(INVERSIONS[q.type].some(k => IV[k] === iv), q.symbol);
  }
  assert.deepStrictEqual([...seenTypes].sort(), Object.keys(INVERSIONS).sort());
  // CM7/B·C6/G·Csus4/G·mM7/B·m7(♭5)/♭7은 무작위 모드에서 안 나옴
  assert.ok(!qs.some(q => (q.type === "M7" && (q.bassPc - q.rootPc + 12) % 12 === 11) || ["sus4", "mM7", "m7b5"].includes(q.type)));
  // 3화음을 고르지 않으면(처음 설정) 3화음 전위형은 없음
  const def = (await many(await slashBase())).filter(q => q.slash === "inv");
  assert.ok(def.length > 0 && def.every(q => !["maj", "min"].includes(q.type)));
});

test("improv slash: hybrid shapes — B♭/C B♭M7/C Gm7/C Am/D B♭m/C Gm7(♭5)/C D/C G/C Ddim7/C Bdim7/C", async () => {
  const { HYBRIDS } = await import("../src/assets/js/improv/slash.js");
  const qs = (await many(await slashBase(), 60000)).filter(q => q.slash === "hybrid");
  const shape = q => q.type + ":" + (q.bassPc - q.rootPc + 12) % 12;
  const want = new Set(HYBRIDS.map(([id, [semi]]) => id + ":" + semi));
  assert.deepStrictEqual(new Set(qs.map(shape)), want);
  // 같은 비율 (10가지 각 약 10%)
  const c = {}; for (const q of qs) c[shape(q)] = (c[shape(q)] || 0) + 1;
  for (const k of want) assert.ok(c[k] / qs.length > 0.08 && c[k] / qs.length < 0.12, k + " " + (c[k] / qs.length).toFixed(3));
  // 베이스 철자는 음정에 맞는 글자: C 위 코드의 예
  const Slash = await import("../src/assets/js/improv/slash.js");
  const names = new Set();
  for (let i = 0; i < 40000; i++) { const q = Slash.generate(await slashBase({ optB: true, bases: [...Array(12)].map((_, j) => j === 10 || j === 7 || j === 2 || j === 11 || j === 9) }), Math.random); if (q.slash === "hybrid" && q.bass === "C") names.add(q.symbol); }
  for (const n of ["B♭/C", "B♭M7/C", "Gm7/C", "B♭m/C", "Gm7(♭5)/C", "D/C", "G/C", "Ddim7/C", "Bdim7/C"]) assert.ok(names.has(n), n + " in " + [...names].join(" "));
});

test("improv slash: option B filters the chord before the slash; the lowest note never repeats; odd bass names follow option E", async () => {
  const qs = await many(await slashBase({ optB: true, bases: [true, false, false, false, false, false, false, true, false, false, false, false] }), 20000);
  assert.ok(qs.every(q => q.rootPc === 0 || q.rootPc === 7), "위 코드 근음은 C·G만");
  for (let i = 1; i < qs.length; i++) assert.notStrictEqual(qs[i].bassPc, qs[i - 1].bassPc, qs[i - 1].symbol + " → " + qs[i].symbol);
  const easy = await many(await slashBase({ types: { m7: true, min: true, maj: true } }), 30000);
  assert.ok(easy.filter(q => q.bass).every(q => !/[𝄪𝄫]|^(C♭|F♭|E♯|B♯)$/.test(q.bass)), "옵션 E 꺼짐: 쉬운 베이스 이름");
});
