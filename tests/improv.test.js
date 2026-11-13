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

// ---------- 8마디 코드진행 (improv/progression.js, 5단계 2026-11-10) ----------
const progs = async (o, n = 300) => {
  const P = await import("../src/assets/js/improv/progression.js");
  return Array.from({ length: n }, () => P.generateProgression({ tension: "off", slash: true, count: "mid", level: 3, chance: 2, meters: false, ...o }));
};
const chordsOf = ps => ps.flatMap(p => p.bars.flat());

test("improv prog: 8 bars, chord lengths fill each bar on strong beats, splits follow the chord-count option", async () => {
  for (const [count, maxPer] of [["low", 1], ["mid", 2], ["high", 4]]) {
    const ps = await progs({ count, meters: true });
    for (const p of ps) {
      assert.strictEqual(p.bars.length, 8);
      for (const bar of p.bars) {
        assert.ok(bar.length >= 1 && bar.length <= maxPer, count + " " + bar.length);
        assert.strictEqual(bar.reduce((a, c) => a + c.len, 0), p.meter.pulses);
        let s = 0; for (const c of bar) { assert.strictEqual(c.start, s); s += c.len; }
      }
    }
  }
  // 불균등 분할(3+1·1+3)은 최대일 때만
  const uneven = bar => bar.length === 2 && bar[0].len !== bar[1].len && bar.reduce((a, c) => a + c.len, 0) === 4;
  assert.ok(!(await progs({ count: "mid" })).some(p => p.bars.some(uneven)));
  assert.ok((await progs({ count: "high" }, 600)).some(p => p.bars.some(uneven)));
});

test("improv prog: time signatures — 4/4 only unless the option is on, then all six with 4/4 most often", async () => {
  assert.ok((await progs({ meters: false })).every(p => p.meter.id === "4/4"));
  const c = {}; for (const p of await progs({ meters: true }, 3000)) c[p.meter.id] = (c[p.meter.id] || 0) + 1;
  assert.deepStrictEqual(Object.keys(c).sort(), ["12/8", "2/4", "3/4", "4/4", "6/8", "9/8"]);
  assert.ok(c["4/4"] > c["6/8"] && c["6/8"] > c["9/8"]);
});

test("improv prog: one notation per progression, no ø, no +/- tensions; HARD-only tension chords; 7alt only with tensions; tidy root spelling", async () => {
  const P = await import("../src/assets/js/improv/progression.js");
  for (const p of await progs({ tension: "hard" }, 500)) {
    const heads = p.bars.flat().map(c => c.q.head);
    const st = p.style;
    for (const h of heads) {
      assert.ok(!h.includes("ø"), h);
      if (st.m === "-") assert.ok(!/^m/.test(h), h); else assert.ok(!/^-/.test(h), h);
      if (st.M === "△") assert.ok(!h.includes("M"), h); else assert.ok(!h.includes("△"), h);
      if (st.dim === "°") assert.ok(!h.includes("dim"), h); else assert.ok(!h.includes("°"), h);
      if (st.aug === "+") assert.ok(!h.includes("aug"), h); else assert.ok(!h.includes("+"), h);
    }
    for (const c of p.bars.flat()) assert.ok(c.q.items.every(x => !/[+-]/.test(x)), c.q.symbol);
  }
  const off = chordsOf(await progs({ tension: "off" }, 400)), hard = chordsOf(await progs({ tension: "hard", level: 6 }, 400)), one = chordsOf(await progs({ tension: "1", level: 6 }, 400));
  assert.ok(!off.some(c => c.q.group === "tension" || c.q.alt || c.q.tens.length), "텐션 꺼짐");
  assert.ok(!one.some(c => c.q.group === "tension") && one.some(c => c.q.alt) && one.every(c => c.q.tens.length <= 1), "최대 1개");
  assert.ok(hard.some(c => c.q.group === "tension") && hard.filter(c => c.q.group === "tension").every(c => c.q.tens.length <= 1), "HARD");
  // 근음 철자: 조를 따르되 겹변화표·E♯·B♯·F♭은 쉬운 이름으로 (C♭은 G♭장조·E♭단조에서만, 아주 드물게)
  const roots = chordsOf(await progs({ slash: false }, 3000)).map(c => c.q.rootName);
  assert.ok(roots.every(r => !/[𝄪𝄫]/.test(r) && !["E♯", "B♯", "F♭"].includes(r)), [...new Set(roots)].join(" "));
  const cflat = roots.filter(r => r === "C♭").length / roots.length;
  assert.ok(cflat < 0.01, "C♭ " + (100 * cflat).toFixed(2) + "%");
  // 기호 표기 바꾸기
  const q = { rootName: "C", head: "mM7", items: [], bass: null };
  assert.strictEqual(P.restyle(q, { M: "△", m: "-", dim: "dim", aug: "aug" }).symbol, "C-△7");
  assert.strictEqual(P.restyle({ ...q, head: "dim7" }, { M: "M", m: "m", dim: "°", aug: "+" }).symbol, "C°7");
  assert.strictEqual(P.restyle({ ...q, head: "m", items: ["add9"], bass: "E♭" }, { M: "M", m: "-", dim: "dim", aug: "aug" }).symbol, "C-(add9)/E♭");
});

// ---------- 코드진행 문법 (improv/grammar.js, 6단계 난이도 1·2 — 2026-11-11) ----------
test("improv grammar: level 0 = diatonic only, no slash chords, no V7sus4; level 1 adds V7sus4 + slash; add chords only on 0·1; dim7 from level 3; ImM7 only in the line cliché (2026-11-12)", async () => {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10, 11];   // 단조는 V7의 이끔음 포함
  const { Engine } = await import("../src/assets/js/core/engine.js");
  for (const level of [0, 1]) {
    for (const chance of [1, 2, 3]) {
      for (const p of await progs({ level, chance, slash: level === 0 }, 300)) {   // 난이도 0은 분수코드를 켜도 없음
        const tonic = Engine.pcOf(p.key.l, p.key.a), sc = p.key.minor ? MINOR : MAJOR;
        for (const c of p.bars.flat()) {
          if (level === 1 && c.q.kind === "surprise") continue;   // 개연성 3의 뜬금 도미넌트
          assert.strictEqual(c.q.kind, "dia", c.q.symbol);
          assert.ok(sc.includes((c.q.rootPc - tonic + 12) % 12), p.key.name + " " + c.q.symbol);
          assert.ok(!["sus4", "sus2", "dim7"].includes(c.q.type), c.q.symbol);
          if (level === 0) assert.ok(!c.q.bass && c.q.type !== "7sus4", "난이도 0 " + c.q.symbol);
          if (c.q.type === "mM7") assert.ok(/^cliche/.test(c.q.pattern), "ImM7은 클리셰로만 " + c.q.symbol);
        }
      }
    }
  }
  // 6th 코드는 난이도 2부터, 난이도 0·1의 라인 클리셰는 Im7까지 (2026-11-13)
  for (const level of [0, 1]) assert.ok(chordsOf(await progs({ level, chance: 1 }, 600)).every(c => !["6", "m6"].includes(c.q.type)), "난이도 " + level + " 6th");
  assert.ok(chordsOf(await progs({ level: 2 }, 600)).some(c => ["6", "m6"].includes(c.q.type)), "난이도 2 6th");
  const one = chordsOf(await progs({ level: 1 }, 600));
  assert.ok(one.some(c => c.q.bass) && one.some(c => c.q.type === "7sus4") && one.some(c => /add/.test(c.q.type)));
  const two = chordsOf(await progs({ level: 2 }, 600));
  const kinds2 = new Set(two.map(c => c.q.kind));
  for (const k of ["dia", "sec", "ii"]) assert.ok(kinds2.has(k), k);
  assert.ok(two.every(c => c.q.type !== "dim7" && !/add/.test(c.q.type)), "난이도 2: dim7·add 없음");
  for (const chance of [3, 4]) assert.ok(chordsOf(await progs({ level: 2, chance }, 400)).every(c => c.q.type !== "dim7"), "개연성 " + chance);
  const three = chordsOf(await progs({ level: 3 }, 600));
  assert.ok(three.some(c => c.q.kind === "dim") && three.every(c => !/add/.test(c.q.type)), "난이도 3: 디미니시드 있음, add 없음");
  // 난이도 5~6은 아직 4와 같게
  assert.ok(chordsOf(await progs({ level: 6 }, 200)).some(c => c.q.kind === "dim"));
});

test("improv grammar: level 3 adds SubV7 (+ related II) and subdominant minor in major keys; level 4 adds modal interchange; minor Vm7; 7alt only from level 4 (2026-11-13)", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const kindsOf = (ps, minor) => new Set(ps.filter(p => p.key.minor === minor).flatMap(p => p.bars.flat().map(c => c.q.kind)));
  const lv = async (level, n = 600) => progs({ level, tension: "hard" }, n);
  const two = await lv(2);
  assert.ok(chordsOf(two).every(c => !["subv", "sdm", "modal"].includes(c.q.kind) && !c.q.alt), "난이도 2");
  const three = await lv(3);
  assert.ok(kindsOf(three, false).has("subv") && kindsOf(three, false).has("sdm") && kindsOf(three, true).has("subv"), "난이도 3");
  assert.ok(!kindsOf(three, true).has("sdm") && chordsOf(three).every(c => c.q.kind !== "modal" && !c.q.alt), "서브도미넌트 마이너는 장조만, 모달은 4부터, 7alt는 4부터");
  // SubV7: 목표의 반음 위 도미넌트 7, 그 Related II는 완전5도 위 m7
  for (const c of chordsOf(three)) if (c.q.kind === "subv") assert.ok(/^dom/.test(c.q.type), c.q.symbol);   // HARD면 9·13 텐션 코드도
  // 서브도미넌트 마이너 (장조, 으뜸음에서): ♭II 1 · II(♭5) 2 · IVm 5 · ♭VI 8 · ♭VII7 10
  for (const p of three.filter(p => !p.key.minor)) {
    const tonic = Engine.pcOf(p.key.l, p.key.a);
    for (const c of p.bars.flat()) if (c.q.kind === "sdm") assert.ok([1, 2, 5, 8, 10].includes((c.q.rootPc - tonic + 12) % 12), p.key.name + " " + c.q.symbol);
  }
  // 다이아토닉 밖 코드 연속은 난이도 3부터 4개까지 (Extended Dominant 사슬)
  for (const p of three) {
    let run = 0, max = 0;
    for (const c of p.bars.flat()) { run = c.q.kind === "dia" || c.q.kind === "surprise" ? 0 : run + 1; max = Math.max(max, run); }
    assert.ok(max <= 4, "연속 " + max);
  }
  const four = await lv(4, 800);
  assert.ok(kindsOf(four, false).has("modal") && kindsOf(four, true).has("modal"), "난이도 4 모달");
  // 7alt: 난이도 4부터, 괄호 텐션 없이
  const alts = chordsOf(await lv(6, 600)).filter(c => c.q.alt);
  assert.ok(alts.length && alts.every(c => c.q.type === "dom7" && !c.q.items.length), "7alt");
  // 단조 Vm7 (2026-11-13 사용자 결정)
  assert.ok(chordsOf(await progs({ level: 1 }, 600)).some(c => c.q.role === "v" && c.q.type === "m7"), "단조 Vm7");
});

test("improv grammar: slash chords come from the bass line — passing, same chord, cadential 6/4, tonic/dominant pedal; free inversions from level 2; 7th basses fall by step, leading-tone basses rise (2026-11-13)", async () => {
  const iv = (a, b) => (((b - a) % 12) + 12) % 12;
  const why = {};
  for (const level of [1, 2, 4, 6]) for (const chance of [1, 2, 3]) {
    for (const p of await progs({ slash: true, level, chance, tension: "2" }, 250)) {
      const f = p.bars.flatMap((bar, b) => bar.map(c => ({ ...c.q, bar: b })));
      f.forEach((q, j) => {
        const nx = f[(j + 1) % f.length];
        if (j && f[j - 1].bar === q.bar) assert.notStrictEqual(f[j - 1].symbol, q.symbol, "같은 마디에 같은 이름 연달아");
        if (!q.bass) return;
        why[q.why] = (why[q.why] || 0) + 1;
        assert.ok(["passing", "same", "cad64", "pedal", "free", "hybrid", "pattern"].includes(q.why), q.symbol + " " + q.why);
        if (q.why === "free") assert.ok(level >= 2, "낯선 전위는 난이도 2부터 " + q.symbol);
        if (q.slash === "inv") {
          assert.ok(q.tones.some(t => t.pc === q.bassPc), "베이스는 구성음 " + q.symbol);   // Am7(♭5)/E 같은 버그 (2026-11-13)
          if (/sus/.test(q.type)) assert.notStrictEqual(q.invKind, "3", q.symbol);
          if (q.invKind === "b7") assert.ok(nx.bassPc === q.bassPc || [1, 2].includes(iv(nx.bassPc, q.bassPc)), "7음 베이스는 아래로 " + q.symbol + " → " + nx.symbol);
          if (q.invKind === "3" && ["dom7", "dom9", "dom13"].includes(q.type) && !["sdm", "modal"].includes(q.kind)) assert.strictEqual(iv(q.bassPc, nx.bassPc), 1, "이끔음 베이스는 반음 위로 " + q.symbol + " → " + nx.symbol);
        }
        if (q.slash === "hybrid" && level === 1) assert.ok(/\//.test(q.symbol) && q.kind === "dia" && q.role === "Vsus", "난이도 1 하이브리드는 V7sus4 자리의 IV/V만 " + q.symbol);
      });
    }
  }
  for (const k of ["passing", "same", "cad64", "pedal", "free", "hybrid"]) assert.ok(why[k] > 0, k);
  // 난이도 1의 하이브리드는 IV/V(장3화음)만, 4부터는 IV/V 없이
  const hyb = async level => chordsOf(await progs({ slash: true, level }, 800)).filter(c => c.q.slash === "hybrid" && c.q.role === "Vsus");
  assert.ok((await hyb(1)).every(c => c.q.type === "maj" && (c.q.bassPc - c.q.rootPc + 12) % 12 === 2));
  assert.ok((await hyb(4)).every(c => !(c.q.type === "maj" && (c.q.bassPc - c.q.rootPc + 12) % 12 === 2)));
  // 난이도 4부터 V7·세컨더리·토닉·IV 자리도 가끔 하이브리드
  assert.ok(chordsOf(await progs({ slash: true, level: 5 }, 800)).some(c => c.q.slash === "hybrid" && c.q.role !== "Vsus"));
  assert.ok(chordsOf(await progs({ slash: true, level: 3 }, 800)).every(c => c.q.slash !== "hybrid" || c.q.role === "Vsus"));
});

test("improv grammar: tensions by level — 10% on 0~2 (one per chart on 0), 15/20/40/60% on 3~6; two in parentheses and tension chords only from 3 with the '2'·HARD option; scale tones only on 0·1 (2026-11-13)", async () => {
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const rate = {};
  for (const level of [0, 1, 2, 3, 4, 5, 6]) {
    let can = 0, has = 0, tc = 0;
    for (const p of await progs({ tension: "hard", level, slash: false }, 400)) {
      const sc = new Set((p.key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(x => (Engine.pcOf(p.key.l, p.key.a) + x) % 12));
      const qs = p.bars.flat().map(c => c.q);
      if (level === 0) assert.ok(qs.filter(q => q.tens.length || q.alt).length <= 1, "난이도 0은 8마디에 하나까지");
      for (const q of qs) {
        if (q.group === "tension") tc++;
        assert.ok(q.items.length <= (level >= 3 ? 2 : 1), "괄호 안 개수 " + q.symbol);   // m7(♭5)의 ♭5도 괄호 안 1개
        if (level <= 1) {
          assert.ok(!q.alt && q.group !== "tension", q.symbol);
          for (const t of q.tones) if (t.role === "tension") assert.ok(sc.has(t.pc), "조 안의 텐션만 " + p.key.name + " " + q.symbol);
        }
        const eligible = Engine.BY_ID[q.type].seventh && !["7sus4", "dim7", "mM7", "m7b5"].includes(q.type);
        if (eligible || q.group === "tension") { can++; if (q.tens.length || q.alt || q.group === "tension") has++; }
      }
    }
    rate[level] = 100 * has / can;
    if (level < 3) assert.strictEqual(tc, 0, "텐션 코드는 난이도 3부터");
    if (level >= 4) assert.ok(tc > 0, "난이도 " + level + " 텐션 코드");
  }
  // 옵션 '최대 1개'면 어느 난이도든 괄호 안 1개, 텐션 코드 없음
  assert.ok(chordsOf(await progs({ tension: "1", level: 6, slash: false }, 300)).every(c => c.q.items.length <= 1 && c.q.group !== "tension"));
  const near = (v, want, tol) => Math.abs(v - want) < tol;
  assert.ok(near(rate[1], 10, 3) && near(rate[2], 10, 3) && near(rate[3], 15, 3.5) && near(rate[4], 20, 4) && near(rate[5], 40, 5) && near(rate[6], 60, 5), JSON.stringify(rate));
});

test("improv grammar: tonic appears, II-V at least 2 (chance 1) / 1 (chance 2), halves never identical, bar 5 never starts on bar 1's chord, at most 2 non-diatonic in a row on level 2", async () => {
  const { countIIV } = await import("../src/assets/js/improv/grammar.js");
  for (const [chance, need] of [[1, 2], [2, 1]]) {
    let ok = 0, N = 300;
    for (const p of await progs({ level: 2, chance }, N)) {
      const flat = p.bars.flat().map(c => c.q);
      // 라인 클리셰가 2마디 이상이면 II-V 최소가 하나 줄어듦 (2026-11-13)
      const clBars = new Set(p.bars.flatMap((bar, b) => bar.some(c => /^cliche/.test(c.q.pattern || "")) ? [b] : [])).size;
      if (countIIV(flat) >= need - (clBars >= 2 ? 1 : 0)) ok++;
      const half = (a, b) => p.bars.slice(a, b).map(bar => bar.map(c => c.q.symbol).join(" ")).join("|");
      assert.notStrictEqual(p.bars[4][0].q.symbol, p.bars[0][0].q.symbol, "5마디 첫 코드 = 1마디 첫 코드");   // 난이도 1부터 (2026-11-13)
      assert.notStrictEqual(half(0, 4), half(4, 8));
      let run = 0, max = 0; for (const q of flat) { run = q.kind === "dia" || q.kind === "surprise" ? 0 : run + 1; max = Math.max(max, run); }
      assert.ok(max <= 2, "연속 " + max);
    }
    assert.ok(ok / N > 0.95, "II-V 조건 " + ok + "/" + N);
  }
});

test("improv grammar: dominant 7ths mostly on weak beats (~80%), chance 4 is random within the level's chords", async () => {
  const DOM = ["dom7", "7sus4", "dom9", "dom13"];
  for (const chance of [1, 2, 3]) {
    let weak = 0, all = 0;
    for (const p of await progs({ level: 2, chance, slash: false }, 800)) {
      p.bars.forEach((bar, b) => bar.forEach((c, i) => {
        if (!DOM.includes(c.q.type)) return;
        all++;
        const strong = bar.length === 1 ? b % 2 === 0 : i % 2 === 0;
        if (!strong) weak++;
      }));
    }
    assert.ok(weak / all > 0.72 && weak / all < 0.86, "개연성 " + chance + " 약박 " + (100 * weak / all).toFixed(1));
  }
  const rand = chordsOf(await progs({ level: 3, chance: 4 }, 600));
  const dim = rand.filter(c => c.q.type === "dim7").length / rand.length;
  assert.ok(dim < 0.15, "무작위에서 dim7 " + (100 * dim).toFixed(1));
  for (const level of [0, 1]) assert.ok(chordsOf(await progs({ level, chance: 4 }, 300)).every(c => c.q.kind === "dia"), "난이도 " + level + " 무작위는 다이아토닉만");
  assert.ok((await progs({ level: 1, chance: 4 }, 500)).every(p => p.bars[4][0].q.symbol !== p.bars[0][0].q.symbol), "무작위도 5마디 첫 코드 ≠ 1마디 첫 코드");
});

test("improv prog: slash chords only when allowed and more on higher levels; notation odds M 10% · m 50% · dim/aug 60% symbols; max-count split ratios (2026-11-10)", async () => {
  const P = await import("../src/assets/js/improv/progression.js");
  // 분수코드는 비율 목표 없음 — 용법(베이스 라인)·하이브리드 자리에서만 (2026-11-13). 끄면 없음, 난이도가 오를수록 많아짐
  assert.ok(chordsOf(await progs({ slash: false }, 300)).every(c => !c.q.bass));
  const slashShare = async level => { const all = chordsOf(await progs({ slash: true, level, chance: 2 }, 800)); return all.filter(c => c.q.bass).length / all.length; };
  assert.ok(await slashShare(1) + 0.02 < await slashShare(6), "난이도 6이 1보다 분수코드가 많음");
  const N = 20000, st = { M: 0, m: 0, dim: 0, aug: 0 };
  for (let i = 0; i < N; i++) { const s = P.randomStyle(Math.random); st.M += s.M === "△"; st.m += s.m === "-"; st.dim += s.dim === "°"; st.aug += s.aug === "+"; }
  const near = (v, want) => assert.ok(Math.abs(100 * v / N - want) < 2, (100 * v / N).toFixed(1) + " ≈ " + want);
  near(st.M, 10); near(st.m, 50); near(st.dim, 60); near(st.aug, 60);
  const c = {}; let n = 0;
  for (const p of await progs({ count: "high", chance: 3 }, 3000)) for (const b of p.bars) { const k = b.map(x => x.len).join("+"); c[k] = (c[k] || 0) + 1; n++; }   // 개연성 3 = 화성 리듬 가속 없음
  const share = k => 100 * (c[k] || 0) / n;
  assert.ok(Math.abs(share("2+1+1") - 10) < 1.2 && Math.abs(share("1+1+2") - 4) < 0.8 && Math.abs(share("1+1+1+1") - 2) < 0.6, JSON.stringify(c));
  // 코드 둘인 마디 중: 3+1 8% · 1+3 1% (나머지 2+2)
  const two = share("2+2") + share("3+1") + share("1+3");
  assert.ok(Math.abs(100 * share("3+1") / two - 8) < 1.2 && Math.abs(100 * share("1+3") / two - 1) < 0.6, JSON.stringify(c));
  // 3펄스 마디(3/4·9/8): 1+1+1은 1%
  const P3 = (await progs({ count: "high", meters: true, chance: 3 }, 6000)).filter(p => p.meter.pulses === 3).flatMap(p => p.bars);
  const ones = 100 * P3.filter(b => b.length === 3).length / P3.length;
  assert.ok(P3.length > 1000 && ones < 2, "1+1+1 " + ones.toFixed(2));
});

test("improv prog: long chord names (length ≥ 6) only in slots of half a bar or more, at most one per bar (2026-11-10)", async () => {
  const P = await import("../src/assets/js/improv/progression.js");
  const parse = s => { const m = s.match(/^([A-G][♯♭]?)([^/(]*)(?:\(([^)]*)\))?(?:\/(.+))?$/); return { rootName: m[1], head: m[2], items: m[3] ? m[3].split(",") : [], bass: m[4] }; };
  assert.deepStrictEqual(["Cm7", "Gm7(♭5)", "C7sus4", "B♭M7/C", "F♯m7(♭5)", "A♭m7/G♭", "D♭7sus4(9)"].map(x => P.displayLength(parse(x))), [3, 5.4, 6, 6, 6.4, 7, 8.8]);
  assert.ok(!P.isLong(parse("Gm7(♭5)")) && P.isLong(parse("C7sus4")));
  let longs = 0, total = 0;
  for (const p of await progs({ count: "high", tension: "2", meters: true }, 1500)) {
    for (const bar of p.bars) {
      const L = bar.filter(c => P.isLong(c.q));
      assert.ok(L.length <= 1, "한 마디에 긴 코드 둘 " + bar.map(c => c.q.symbol).join(" "));
      for (const c of L) assert.ok(c.len * 2 >= p.meter.pulses, p.meter.id + " 짧은 자리에 긴 코드 " + c.q.symbol + " (" + c.len + "박)");
      longs += L.length; total += bar.length;
    }
  }
  assert.ok(longs / total > 0.08, "긴 코드도 나옴 " + (100 * longs / total).toFixed(1));
});

test("improv prog: if dim or aug lands on a one-beat slot, that chart writes it with the symbol (° / +) everywhere (2026-11-10)", async () => {
  let forced = 0, free = 0, wordDim = 0;
  for (const p of await progs({ count: "high", tension: "2" }, 3000)) {
    const all = p.bars.flat();
    // 표기에 dim·aug(또는 그 기호)가 들어간 코드가 1박 자리에 있는지 — augM7의 다른 이름 M7(♯5)·△7(♯5)는 aug 글자가 없어서 해당 없음
    const oneDim = all.some(c => c.len === 1 && /dim|°/.test(c.q.head));
    const oneAug = all.some(c => c.len === 1 && /aug|\+/.test(c.q.head));
    if (oneDim) { forced++; assert.strictEqual(p.style.dim, "°"); assert.ok(all.every(c => !c.q.head.includes("dim")), all.map(c => c.q.symbol).join(" ")); }
    if (oneAug) { assert.strictEqual(p.style.aug, "+"); assert.ok(all.every(c => !c.q.head.includes("aug"))); }
    if (!oneDim && all.some(c => c.q.type === "dim7")) { free++; if (p.style.dim === "dim") wordDim++; }
  }
  assert.ok(forced > 50, "1박 dim이 나온 악보 " + forced);
  // 1박에 없으면 60% 확률 그대로 → 글자 dim도 나옴
  assert.ok(free > 100 && wordDim / free > 0.25 && wordDim / free < 0.55, (100 * wordDim / free).toFixed(0) + "% 글자");
});

test("improv grammar: line clichés — minor (Im·IVm in minor, IIm·VIm in major, from level 1; Im from 0) and major (I·IV, ♭III·♭VI, from level 2); early stops; may start on the 2nd chord; start spots by length (2026-11-13)", async () => {
  const MINOR = ["min", "mM7", "m7", "m6"], MAJOR = ["M7", "augM7", "6", "dom7"];
  const seen = {}, forms = new Set();
  for (const level of [0, 1, 2, 3, 4]) for (const count of ["low", "mid", "high"]) {
    for (const p of await progs({ level, chance: 1, count, slash: true, tension: "off" }, 300)) {
      const flat = p.bars.flatMap((bar, b) => bar.map((c, i) => ({ ...c.q, bar: b, idx: i, start: c.start, len: c.len })));
      for (let j = 0; j < flat.length; j++) {
        const q = flat[j], order = q.pattern === "cliche-major" ? MAJOR : MINOR;
        if (!/^cliche/.test(q.pattern || "")) continue;
        const prev = flat[j - 1];
        if (prev && prev.pattern === q.pattern && order.indexOf(prev.type) < order.indexOf(q.type) && (prev.role === q.role || q.type === "dom7")) continue;   // 클리셰 안
        let k = j + 1;
        while (k < flat.length && flat[k].pattern === q.pattern && order.indexOf(flat[k].type) > order.indexOf(flat[k - 1].type) && (flat[k].role === q.role || flat[k].type === "dom7")) k++;
        const run = flat.slice(j, k), types = run.map(c => c.type), span = run.at(-1).bar - q.bar + 1;
        const pulses = run.reduce((a, c) => a + c.len, 0);
        // 시작 자리: 한 마디 안 1~7마디, 2마디 1·3·5·7마디, 더 길면 1·5마디 — 첫 박, 4박 마디의 2박짜리는 셋째 박도
        if (q.idx === 0) assert.ok(span === 1 ? q.bar <= 6 : span === 2 ? [0, 2, 4, 6].includes(q.bar) : [0, 4].includes(q.bar), "시작 마디 " + (q.bar + 1) + " · " + span + "마디 " + types.join(" "));
        else assert.ok(span === 1 && pulses === 2 && q.start === 2 && q.bar <= 6, "셋째 박 시작 " + types.join(" "));
        assert.ok(types.length >= 2, types.join(" "));
        const tag = (p.key.minor ? "m:" : "M:") + q.role;
        seen[tag] = true; forms.add(types.join(" "));
        if (q.pattern === "cliche-major") {
          assert.ok(level >= 2, "메이저 클리셰는 난이도 2부터");
          assert.ok(MAJOR.join(" ").includes(types.join(" ")) && types.includes("augM7"), types.join(" "));
          assert.ok(p.key.minor ? ["bIII", "bVI"].includes(q.role) : ["I", "IV"].includes(q.role), tag);
          if (types.includes("dom7")) assert.ok(!p.key.minor && (q.role === "I" ? run.at(-1).role === "V/IV" : level >= 4 && run.at(-1).role === "IV7"), tag + " → " + run.at(-1).role);
        } else {
          assert.ok(MINOR.join(" ").includes(types.join(" ")) || types.join(" ") === "mM7 m6", types.join(" "));
          assert.ok(types.includes("mM7"), types.join(" "));
          assert.ok(p.key.minor ? ["i", "iv"].includes(q.role) : ["II", "VI"].includes(q.role), tag);
          if (q.role !== "i") assert.ok(level >= 1, "Im 밖의 클리셰는 난이도 1부터");
          if (level <= 1) assert.ok(!types.includes("m6"), "난이도 0·1은 m7에서 끝");
        }
      }
    }
  }
  for (const k of ["m:i", "m:iv", "M:II", "M:VI", "M:I", "M:IV", "m:bIII", "m:bVI"]) assert.ok(seen[k], k);
  for (const f of ["min mM7 m7", "mM7 m7", "mM7 m6", "mM7 m7 m6", "augM7 6", "M7 augM7 6 dom7"]) assert.ok(forms.has(f), f);
});
