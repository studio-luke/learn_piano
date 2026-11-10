// 코드 초견 검사 (메트로놈의 박 번호·템포 범위).  실행: npm test
import test from "node:test";
import assert from "node:assert";
import { beatInfo, clampBpm, BPM_MIN, BPM_MAX, BPM_DEFAULT } from "../src/assets/js/improv/metronome.js";

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
