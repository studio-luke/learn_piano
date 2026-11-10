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
  const on = ["maj", "min", "M7", "m7", "dom7", "7sus4", "aug7", "dim7", "m7b5", "mM7", "augM7", "6", "m6", "add9", "madd9"];
  const s = { types: Object.fromEntries(on.map(id => [id, true])), optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optD: false, optE: false, weights: WEIGHTS };
  const N = 40000; let n = 0;
  for (let i = 0; i < N; i++) if (["mM7", "aug7", "augM7"].includes(Engine.generate(s).type)) n++;
  const pct = 100 * n / N;
  assert.ok(pct > 8.8 && pct < 11, pct.toFixed(1));
  // 다른 연습이 쓰는 원래 가중치는 그대로
  assert.deepStrictEqual(["mM7", "aug7", "augM7"].map(id => Engine.BY_ID[id].w), [1.2, 1, 1]);
});
