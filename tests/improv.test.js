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

test("improv random: page-only weights — rare chords ~5% of the default set, triads ~2% and tension chords under 10% when everything is on", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const Slash = await import("../src/assets/js/improv/slash.js");
  const { DEFAULTS, WEIGHTS } = await import("../src/assets/js/improv/settings.js");
  const on = Object.keys(DEFAULTS.types).filter(id => DEFAULTS.types[id]);
  assert.deepStrictEqual([...on].sort(), ["6", "7sus4", "M7", "add9", "aug7", "augM7", "dim7", "dom7", "m6", "m7", "m7b5", "mM7", "madd9"]);
  const share = (types, slash, ids, N = 40000) => {
    const s = { ...structuredClone(DEFAULTS), types, slash, weights: WEIGHTS };
    let n = 0, prev = null;
    for (let i = 0; i < N; i++) { const q = Slash.generate(s, Math.random, prev); prev = q; if (!q.slash && ids.includes(q.type)) n++; }
    return 100 * n / N;
  };
  const rare = ["mM7", "aug7", "augM7"], all = Object.fromEntries(Engine.TYPES.map(x => [x.id, true]));
  const r = share(DEFAULTS.types, true, rare);
  assert.ok(r > 4.3 && r < 5.9, "희귀 3종 " + r.toFixed(1));
  const tri = share(all, false, ["maj", "min", "dim", "aug"]);
  assert.ok(tri < 3, "3화음 " + tri.toFixed(1));
  const ten = share(all, false, ["M9", "M13", "m9", "m11", "dom9", "dom13"]);
  assert.ok(ten < 10, "텐션 코드 " + ten.toFixed(1));
  assert.ok(["maj", "min", "dim", "aug"].every(id => WEIGHTS[id] >= 0.05 && WEIGHTS[id] <= 0.2));
  // 다른 연습이 쓰는 원래 가중치는 그대로
  assert.deepStrictEqual(["mM7", "aug7", "augM7", "maj", "M9"].map(id => Engine.BY_ID[id].w), [1.2, 1, 1, 1, 0.63]);
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

test("improv slash: every inversion and hybrid follows its on-condition — related chord types must be chosen (2026-11-10)", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const { INVERSIONS, HYBRIDS } = await import("../src/assets/js/improv/slash.js");
  const IV = { "3": 4, b3: 3, "5": 7, b7: 10 };
  const ids = Engine.TYPES.map(x => x.id);
  // 무작위로 고른 코드 종류 조합 여러 개로: 나온 분수코드는 모두 조건이 맞는 모양이어야 함
  for (let round = 0; round < 40; round++) {
    const types = Object.fromEntries(ids.filter(() => Math.random() < 0.3).map(id => [id, true]));
    if (!Object.keys(types).length) continue;
    const qs = (await many(await slashBase({ types, optC: true, cMax: 2 }), 3000)).filter(q => q.slash);
    for (const q of qs) {
      const iv = (q.bassPc - q.rootPc + 12) % 12;
      const list = q.slash === "inv" ? INVERSIONS.filter(([id, k]) => id === q.type && IV[k] === iv).map(e => e[2])
        : HYBRIDS.filter(([id, [semi]]) => id === q.type && semi === iv).map(h => h[3]);
      assert.ok(list.length === 1, "목록에 있는 모양 " + q.symbol);
      assert.ok(list[0].some(id => types[id]), q.symbol + " 조건 " + list[0] + " / 켜진 것 " + Object.keys(types));
      assert.ok(q.tens.length === 0, "텐션 없음 " + q.symbol);
    }
  }
  // 코드 종류를 전부 켜면 모든 모양이 나옴
  const all = Object.fromEntries(ids.map(id => [id, true]));
  const qs = (await many(await slashBase({ types: all }), 60000)).filter(q => q.slash === "inv");
  const seen = new Set(qs.map(q => q.type + ":" + (q.bassPc - q.rootPc + 12) % 12));
  for (const [id, k] of INVERSIONS) assert.ok(seen.has(id + ":" + IV[k]), id + "/" + k);
  // CM7/B·C6/G·Csus4/G·mM7/B·m7(♭5)/♭7은 무작위 모드에서 안 나옴
  assert.ok(!qs.some(q => (q.type === "M7" && (q.bassPc - q.rootPc + 12) % 12 === 11) || ["sus4", "mM7", "m7b5"].includes(q.type)));
});

test("improv slash: on-condition examples — M7 alone, dim7 alone, 7sus4 alone, triads come with 7th chords", async () => {
  const kinds = async types => {
    const qs = (await many(await slashBase({ types }), 8000)).filter(q => q.slash);
    return new Set(qs.map(q => q.slash + ":" + q.type + ":" + (q.bassPc - q.rootPc + 12) % 12));
  };
  // M7만: 전위형 CM7/E·CM7/G와 C/E·C/G(Major 3화음), 하이브리드 D/C·G/C·B♭M7/C
  assert.deepStrictEqual([...(await kinds({ M7: true }))].sort(),
    ["hybrid:M7:2", "hybrid:maj:10", "hybrid:maj:5", "inv:M7:4", "inv:M7:7", "inv:maj:4", "inv:maj:7"]);
  // dim7만: Ddim7/C·Bdim7/C뿐 (전위형 없음)
  assert.deepStrictEqual([...(await kinds({ dim7: true }))].sort(), ["hybrid:dim7:1", "hybrid:dim7:10"]);
  // 7sus4만: 서스 도미넌트 모양들만 — B♭/C B♭M7/C Gm7/C B♭m/C Am/D Gm7(♭5)/C
  assert.deepStrictEqual([...(await kinds({ "7sus4": true }))].sort(),
    ["hybrid:M7:2", "hybrid:m7:5", "hybrid:m7b5:5", "hybrid:maj:2", "hybrid:min:2", "hybrid:min:5"]);
  // 7만: C/E C/G C/B♭(Major), C7 전위형, D/C
  assert.deepStrictEqual([...(await kinds({ dom7: true }))].sort(),
    ["hybrid:maj:10", "inv:dom7:10", "inv:dom7:4", "inv:dom7:7", "inv:maj:10", "inv:maj:4", "inv:maj:7"]);
  // 분수코드가 하나도 안 되는 설정(sus2만)이면 보통 코드만
  assert.strictEqual((await kinds({ sus2: true })).size, 0);
});

test("improv slash: hybrid shapes — B♭/C B♭M7/C Gm7/C Am/D B♭m/C Gm7(♭5)/C D/C G/C Ddim7/C Bdim7/C", async () => {
  const { HYBRIDS } = await import("../src/assets/js/improv/slash.js");
  const qs = (await many(await slashBase(), 60000)).filter(q => q.slash === "hybrid");
  const shape = q => q.type + ":" + (q.bassPc - q.rootPc + 12) % 12;
  const want = new Set(HYBRIDS.map(([id, [semi]]) => id + ":" + semi));
  assert.deepStrictEqual(new Set(qs.map(shape)), want);
  // 비율은 HYBRIDS의 가중치대로 (B♭/C 약 25% … Am/D·Gm7(♭5)/C 약 2%, 2026-11-10)
  const c = {}; for (const q of qs) c[shape(q)] = (c[shape(q)] || 0) + 1;
  const total = HYBRIDS.reduce((a, h) => a + h[2], 0);
  for (const [id, [semi], w] of HYBRIDS) {
    const got = (c[id + ":" + semi] || 0) / qs.length, exp = w / total;
    assert.ok(Math.abs(got - exp) < Math.max(0.012, exp * 0.2), id + ":" + semi + " " + got.toFixed(3) + " ≈ " + exp.toFixed(3));
  }
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
