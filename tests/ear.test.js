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

// ---------- 단음 ③ 리듬 (ear/rhythm.js) ----------
import { generateRhythm, rhythmProblem, makeDictation, mergeable, notate, isCanonical, BAR } from "../src/assets/js/ear/rhythm.js";
import * as rhythmMod from "../src/assets/js/ear/rhythm.js";

test("ear level 3: every generated rhythm follows the placement rules (all minimums, 1 and 2 bars)", () => {
  for (const min of [4, 2, 1]) for (const bars of [1, 2]) {
    for (let i = 0; i < 1500; i++) {
      const r = generateRhythm(bars, min);
      assert.strictEqual(rhythmProblem(r, min, bars), "", JSON.stringify(r));
    }
  }
});

test("ear level 3: minimum value limits the lengths (quarter → only half/quarter, eighth → no 16ths or dotted eighths)", () => {
  const lens = min => new Set(Array.from({ length: 800 }, () => generateRhythm(2, min)).flat().map(x => (x.rest ? "r" : "n") + x.dur));
  assert.deepStrictEqual([...lens(4)].sort(), ["n4", "n8", "r4"].filter(x => lens(4).has(x)).sort());
  assert.ok([...lens(2)].every(x => !["n1", "r1", "n3"].includes(x)));
  const all16 = lens(1);
  for (const x of ["n1", "n2", "n3", "n4", "n6", "n8", "r1", "r2", "r4"]) assert.ok(all16.has(x), x);   // 16분이면 모든 길이가 나옴
});

test("ear level 3: starts mostly with a note on beat 1 (rests first a bit more from eighth minimum), rest-heavy rhythms are rare", () => {
  const N = 3000;
  const share = min => { let f = 0; for (let i = 0; i < N; i++) if (generateRhythm(1, min)[0].rest) f++; return f / N; };
  assert.ok(share(4) < 0.08, "quarter minimum");
  for (const min of [2, 1]) { const s = share(min); assert.ok(s > 0.06 && s < 0.3, `min ${min}: ${s}`); }
  let heavy = 0;
  for (let i = 0; i < N; i++) {
    const r = generateRhythm(1, 1), rest = r.filter(x => x.rest).reduce((a, x) => a + x.dur, 0);
    if (rest > BAR - rest) heavy++;
  }
  assert.ok(heavy < N * 0.05, `rest-heavy ${heavy}/${N}`);
});

test("ear level 3: 16th minimum follows the one-beat shape rules (16th-rest syncopations off strong beats, pickups lead on)", () => {
  for (let i = 0; i < 2000; i++) {
    const r = generateRhythm(2, 1), at = r.filter(x => !x.rest).map(x => x.pos);
    const beat = b => at.filter(p => p >= b * 4 && p < b * 4 + 4).map(p => p - b * 4);
    for (let b = 0; b < 8; b++) {
      const s = beat(b).join(","), prev = b > 0 ? beat(b - 1) : [];
      if (["1,3", "1,2", "1"].includes(s)) {   // [4]-1·2·3: 약박에만, 앞 박 둘째 칸 이후에 어택
        assert.ok(b % 2 === 1 && prev.length && Math.max(...prev) >= 1, JSON.stringify(r));
      }
      if (s === "3") {                           // [5]: 마지막 박 아님, 다음 박은 [5]·빈 박이 아님
        const next = beat(b + 1).join(",");
        assert.ok(b < 7 && next !== "" && next !== "3", JSON.stringify(r));
      }
    }
  }
});

test("ear level 3: higher melody chance → more common two-beat patterns, fewer rare one-beat shapes (16th minimum)", () => {
  const CH = ["0,1,3,5", "0,1,3,5,7", "0,2,3,5,7", "0,2,3,5", "0,3,5", "0,3,6"];
  const count = chance => {
    let chunk = 0, rare = 0;
    for (let i = 0; i < 4000; i++) {
      const at = generateRhythm(1, 1, Math.random, chance).filter(x => !x.rest).map(x => x.pos);
      const part = (from, n) => at.filter(p => p >= from && p < from + n).map(p => p - from).join(",");
      for (const h of [0, 8]) if (CH.includes(part(h, 8))) chunk++;
      for (const b of [0, 4, 8, 12]) if (["0,1", "1,2"].includes(part(b, 4))) rare++;   // [3]-1 · [4]-2
    }
    return { chunk, rare };
  };
  const hi = count("high"), lo = count("random");
  assert.ok(hi.chunk > lo.chunk * 1.8, JSON.stringify({ hi, lo }));
  assert.ok(hi.rare * 2.5 < lo.rare, JSON.stringify({ hi, lo }));
});

test("ear level 3: 16th minimum limits the kinds of 16th one-beat shapes per question (2 bars: high 3, mid 4 · 1 bar: high 3, mid 3)", () => {
  const kinds = (bars, chance) => {
    let most = 0, sum = 0;
    for (let i = 0; i < 3000; i++) {
      const at = generateRhythm(bars, 1, Math.random, chance).filter(x => !x.rest).map(x => x.pos), set = new Set();
      for (let b = 0; b < bars * 4; b++) {
        const s = at.filter(p => p >= b * 4 && p < b * 4 + 4).map(p => p - b * 4);
        if (s.some(p => p % 2 === 1)) set.add(s.join(","));
      }
      most = Math.max(most, set.size); sum += set.size;
    }
    return { most, mean: sum / 3000 };
  };
  assert.ok(kinds(2, "high").most <= 3 && kinds(2, "mid").most <= 4);
  assert.ok(kinds(2, "low").most > 4);
  const h1 = kinds(1, "high");
  assert.ok(h1.most <= 3 && h1.mean < 2.15, JSON.stringify(h1));   // 1마디 높음은 평균 2 가까이
  assert.ok(kinds(1, "mid").most <= 3);
});

test("ear level 3: in 2-bar 16th questions the second bar copies first-bar beats more with higher melody chance", () => {
  const stats = chance => {
    let same = 0, rs = 0, rs2 = 0;
    for (let i = 0; i < 4000; i++) {
      const at = generateRhythm(2, 1, Math.random, chance).filter(x => !x.rest).map(x => x.pos);
      const beat = b => at.filter(p => p >= b * 4 && p < b * 4 + 4).map(p => p - b * 4).join(",");
      for (let b = 0; b < 4; b++) if (beat(b) === beat(b + 4)) same++;
      if (!at.includes(0)) { rs++; if (!at.includes(16)) rs2++; }
    }
    return { same, again: rs2 / rs };
  };
  const hi = stats("high"), lo = stats("low");
  assert.ok(hi.same > lo.same * 1.5, JSON.stringify({ hi, lo }));
  assert.ok(Math.abs(hi.again - 0.8) < 0.1 && Math.abs(lo.again - 0.8) < 0.1, JSON.stringify({ hi, lo }));   // 쉼표 시작도 80% 따라 함
});

test("ear level 3: dictation gives a pitch to every note and none to rests", () => {
  for (let i = 0; i < 300; i++) {
    const d = makeDictation({ root: "G", minor: false }, {}, { bars: 2, min: 1 });
    assert.ok(d.every(x => (x.rest ? !x.note : x.note && x.note.midi >= LOW && x.note.midi <= HIGH)));
    const ms = d.filter(x => !x.rest).map(x => x.note.midi);
    for (let j = 1; j < ms.length; j++) assert.ok(Math.abs(ms[j] - ms[j - 1]) <= 12);
  }
});

test("ear level 3: rests may follow each other (up to 3) only when they cannot be merged", () => {
  assert.ok(mergeable([{ pos: 0, dur: 2 }, { pos: 2, dur: 2 }]));     // 정박의 8분쉼표 둘 → 4분쉼표
  assert.ok(mergeable([{ pos: 0, dur: 4 }, { pos: 4, dur: 4 }]));     // 1·2박 4분쉼표 둘 → 2분쉼표
  assert.ok(!mergeable([{ pos: 4, dur: 4 }, { pos: 8, dur: 4 }]));    // 2·3박은 마디 가운데를 넘어 그대로
  assert.ok(!mergeable([{ pos: 0, dur: 4 }, { pos: 4, dur: 2 }]));    // 4분 + 8분 (점4분쉼표는 따지지 않음)
  assert.ok(!mergeable([{ pos: 2, dur: 2 }, { pos: 4, dur: 2 }]));    // 반박 8분 + 정박 8분: 박을 넘어서 그대로
  let runs = 0;
  for (let i = 0; i < 3000; i++) {
    const r = generateRhythm(2, 1);
    for (let j = 1; j < r.length; j++) if (r[j].rest && r[j - 1].rest) runs++;
  }
  assert.ok(runs > 0, "consecutive rests should appear sometimes");
});

test("ear level 3: one notation per sound — notes last until the next attack, rests only where a note can't go on", () => {
  const n = (set, min) => notate([new Set(set)], min).map(x => (x.rest ? "r" : "n") + x.dur).join(" ");
  assert.strictEqual(n([0, 4, 8, 12], 2), "n4 n4 n4 n4");          // 정박마다 어택 → 4분음표 (8분 + 8분쉼표로 쓰지 않음)
  assert.strictEqual(n([0, 8, 12], 2), "n8 n4 n4");             // 1박 4분 + 4분쉼표 → 2분음표
  assert.strictEqual(n([2, 6, 8, 12], 2), "r2 n4 n2 n4 n4");     // 0.5박의 엇박 음은 4분음표로 이어 씀
  assert.strictEqual(n([0, 6, 8, 12], 2), "n6 n2 n4 n4");        // 점4분
  assert.strictEqual(n([3, 5, 8, 12], 1), "r2 r1 n1 r1 n3 n4 n4"); // 0.75박 16분은 박을 못 넘어서 16분쉼표가 남음
  for (const min of [4, 2, 1]) for (let i = 0; i < 1500; i++) assert.ok(isCanonical(generateRhythm(2, min), min));
});

test("ear level 3: judging one slot — pitch and length, rests, write modes", () => {
  const { judgeToken } = rhythmMod;
  const q = { dur: 4, rest: false, note: { midi: 60 } }, r = { dur: 2, rest: true };
  assert.strictEqual(judgeToken(q, { dur: 4, midi: 60 }), "ok");
  assert.strictEqual(judgeToken(q, { dur: 2, midi: 60 }), "len");      // 음은 맞고 길이가 다름
  assert.strictEqual(judgeToken(q, { dur: 4, midi: 62 }), "pitch");    // 길이는 맞고 음이 다름
  assert.strictEqual(judgeToken(q, { dur: 4, midi: 72 }), "octDown");
  assert.strictEqual(judgeToken(q, { dur: 2, midi: 62 }), "no");
  assert.strictEqual(judgeToken(q, { dur: 4, rest: true }), "no");     // 음표 자리에 쉼표
  assert.strictEqual(judgeToken(r, { dur: 2, midi: 60 }), "no");       // 쉼표 자리에 음표
  assert.strictEqual(judgeToken(r, { dur: 2, rest: true }), "ok");
  assert.strictEqual(judgeToken(r, { dur: 1, rest: true }), "no");     // 8분쉼표 자리에 16분쉼표
  assert.strictEqual(judgeToken(q, { dur: 2, midi: 60 }, "pitch"), "ok");   // 음높이만: 길이는 안 봄
  assert.strictEqual(judgeToken(q, { dur: 4, midi: 50 }, "rhythm"), "ok");  // 리듬만: 음은 안 봄
  assert.strictEqual(judgeToken({ dur: 6, rest: false, note: { midi: 60 } }, { dur: 6, midi: 60 }), "ok");   // 점4분
  assert.strictEqual(judgeToken({ dur: 8, rest: false, note: { midi: 60 } }, { dur: 12, midi: 60 }), "len"); // 점2분은 늘 틀림
});

// ---------- 단음 ③ 멜로디 개연성 (ear/harmony.js) ----------
import { makeProgression, dictationOverChords, PER_BAR } from "../src/assets/js/ear/harmony.js";

test("ear level 3 harmony: progressions use only the allowed 7th-chord types, chromatic chords only when asked", () => {
  const allowed = new Set(["M7", "7", "m7", "m7b5", "7sus4", "mM7", "dim7"]);
  for (const minor of [false, true]) for (const chromatic of [false, true]) for (let i = 0; i < 400; i++) {
    const p = makeProgression({ root: minor ? "A" : "C", minor }, 4, chromatic);
    assert.strictEqual(p.length, 4);
    assert.ok(p.every(c => allowed.has(c.type)), p.map(c => c.name).join(" "));
    if (!chromatic) assert.ok(p.every(c => !c.chromatic));
    else assert.ok(p.some(c => c.chromatic), "조 밖 음을 허용하면 조 밖 코드가 하나 이상");
    assert.ok(p.every(c => c.type !== "mM7" || c.degree === 4), "mM7 only on the 4th degree");
  }
  for (const minor of [false, true]) for (const n of [1, 2]) for (let i = 0; i < 300; i++) {   // 코드가 적어도 (1마디 개연성 높음 = 코드 하나)
    const p = makeProgression({ root: minor ? "A" : "C", minor }, n, true);
    assert.ok(p.some(c => c.chromatic), p.map(c => c.name).join(" "));
    if (minor && n === 1) assert.ok(["AM7", "A7", "Bm7", "B7", "B♭M7", "C7", "D7"].includes(p[0].name), p[0].name);   // 단조 코드 하나: 세컨더리·모달
  }
});

test("ear level 3 harmony: melody over chords — avoid notes never on a beat, always resolved by step to a chord tone", () => {
  for (const chance of ["high", "mid", "low"]) for (const chromatic of [false, true]) for (let i = 0; i < 300; i++) {
    const key = { root: ["C", "G", "E♭"][i % 3], minor: i % 2 === 1 };
    const rhythm = generateRhythm(2, 1);
    const r = dictationOverChords(key, rhythm, 2, chance, chromatic);
    assert.ok(r, "should find a melody");
    const notes = r.tokens.filter(x => !x.rest);
    notes.forEach((x, k) => {
      assert.ok(x.note.midi >= LOW && x.note.midi <= HIGH);
      if (k) assert.ok(Math.abs(x.note.midi - notes[k - 1].note.midi) <= 12);
      const ch = r.chords[Math.floor(x.pos / r.slot)];
      if (!ch.avoid.has(((x.note.midi % 12) + 12) % 12) || ch.pcs.has(x.note.midi % 12)) return;
      assert.ok(x.pos % 4 !== 0, "avoid note on a beat");
      const nx = notes[k + 1];
      assert.ok(nx, "avoid note can't be last");
      const ch2 = r.chords[Math.floor(nx.pos / r.slot)], d = Math.abs(nx.note.midi - x.note.midi);
      assert.ok(ch2.pcs.has(nx.note.midi % 12) && d >= 1 && d <= 2, "avoid note resolves by step to a chord tone");
    });
    assert.strictEqual(r.chords.length, PER_BAR[chance] * 2);
  }
});

test("ear level 3 harmony: mostly chord tones, and mostly diatonic when chromatic is off", () => {
  let ct = 0, all = 0;
  for (let i = 0; i < 500; i++) {
    const r = dictationOverChords({ root: "C", minor: false }, generateRhythm(1, 2), 1, "mid", false);
    for (const x of r.tokens) if (!x.rest) { all++; if (r.chords[Math.floor(x.pos / r.slot)].pcs.has(x.note.midi % 12)) ct++; assert.strictEqual(x.note.a, 0); }
  }
  assert.ok(ct / all > 0.6, `chord tones ${ct}/${all}`);
});

import { layoutBar, fitsBar, shownAccidentals, BAR_W } from "../src/assets/js/ear/layout.js";

test("ear level 3 layout: accidentals push a note right instead of hitting the one before; written notes never move", () => {
  const sig = signature({ root: "C", minor: false });
  const n = (pos, dur, l, a = 0, oct = 4) => ({ pos, dur, rest: false, note: { l, a, oct } });
  // 16분 넷, 둘째·셋째에 임시표: 시간 비례(15)보다 넓게, 그 뒤 긴 음은 다시 제자리
  const list = [n(0, 1, 0), n(1, 1, 1, 1), n(2, 1, 3, 1), n(3, 1, 4), n(4, 4, 0), n(8, 8, 2)];
  const lay = layoutBar(list, sig), xs = list.map(t => lay.x.get(t));
  assert.ok(xs[1] - xs[0] >= 6 + 19 + 2 && xs[2] - xs[1] >= 6 + 19 + 2, xs.join(","));
  assert.strictEqual(xs[5], 14 + 8 * 15);   // 3박 2분음표는 시간 비례 자리 그대로
  // 앞에서부터 정함: 뒤 음을 더해도 앞 음 자리는 그대로
  for (let k = 1; k < list.length; k++) {
    const part = layoutBar(list.slice(0, k), sig);
    for (const t of list.slice(0, k)) assert.strictEqual(part.x.get(t), lay.x.get(t));
  }
  assert.strictEqual(shownAccidentals([n(0, 4, 3, 1), n(4, 4, 3, 1)], sig).size, 1);   // 같은 마디 같은 자리는 이어짐
});

test("ear level 3 layout: generated questions always fit the bar (busy 16ths with many accidentals are redrawn)", () => {
  for (const chance of ["high", "random"]) for (let i = 0; i < 300; i++) {
    const key = { root: "F♯", minor: false };
    const d = makeDictation(key, { chromatic: true }, { bars: 2, min: 1, chance });
    assert.ok(fitsBar(d, signature(key)));
    for (const b of [0, 1]) assert.ok(layoutBar(d.filter(t => Math.floor(t.pos / BAR) === b), signature(key)).right <= BAR_W - 4);
  }
});

test("ear level 3: motif repetition — beat 3 echoes beat 1 and beat 4 echoes beat 2 more with higher chance (16th); 8th 2-bar questions sometimes repeat the first two beats", () => {
  const beat = (at, b) => at.filter(p => p >= b * 4 && p < b * 4 + 4).map(p => p - b * 4).join(",");
  const count = (chance, bars, min, same) => {
    let k = 0;
    for (let i = 0; i < 4000; i++) if (same(generateRhythm(bars, min, Math.random, chance).filter(x => !x.rest).map(x => x.pos))) k++;
    return k;
  };
  const echo = at => beat(at, 2) === beat(at, 0);
  assert.ok(count("high", 1, 1, echo) > count("low", 1, 1, echo) * 1.6);
  const front = at => beat(at, 0) === beat(at, 4) && beat(at, 1) === beat(at, 5);
  assert.ok(count("high", 2, 2, front) > count("random", 2, 2, front) * 1.4);
});

test("ear level 3 harmony: melody direction — leaps are usually answered by a step back, rarely followed by another leap the same way, awkward leaps rare", () => {
  let leaps = 0, recover = 0, sameLeap = 0, ints = 0, awkward = 0;
  for (let i = 0; i < 1500; i++) {
    const d = makeDictation({ root: "C", minor: i % 2 === 1 }, {}, { bars: 2, min: 2, chance: "mid" });
    const m = d.filter(x => !x.rest).map(x => x.note.midi);
    for (let k = 1; k < m.length; k++) {
      const a = m[k] - m[k - 1];
      ints++; if ([6, 10, 11].includes(Math.abs(a))) awkward++;
      if (k < 2) continue;
      const b = m[k - 1] - m[k - 2];
      if (Math.abs(b) < 5) continue;
      leaps++;
      if (Math.sign(a) === -Math.sign(b) && Math.abs(a) >= 1 && Math.abs(a) <= 2) recover++;
      if (Math.sign(a) === Math.sign(b) && Math.abs(a) >= 3) sameLeap++;
    }
  }
  assert.ok(recover / leaps > 0.35, `recover ${recover}/${leaps}`);
  assert.ok(sameLeap / leaps < 0.08, `same-way leap ${sameLeap}/${leaps}`);
  assert.ok(awkward / ints < 0.035, `awkward ${awkward}/${ints}`);
});

test("ear level 3 harmony: one question stays within a perfect 11th (high · mid · low)", () => {
  for (const chance of ["high", "mid", "low"]) for (let i = 0; i < 600; i++) {
    const d = makeDictation({ root: "G", minor: i % 2 === 1 }, { chromatic: i % 3 === 0 }, { bars: 2, min: 1, chance });
    const m = d.filter(x => !x.rest).map(x => x.note.midi);
    assert.ok(Math.max(...m) - Math.min(...m) <= 17, m.join(" "));
  }
});

test("ear level 3 harmony: contours pull the melody their way (rising questions end higher, falling ones lower)", () => {
  const diff = { asc: 0, desc: 0 }, n = { asc: 0, desc: 0 };
  for (let i = 0; i < 2500; i++) {
    const d = makeDictation({ root: "C", minor: false }, {}, { bars: 2, min: 2, chance: "high" });
    if (!(d.contour in diff)) continue;
    const ns = d.filter(x => !x.rest), avg = a => a.reduce((p, q) => p + q, 0) / a.length;
    const first = ns.filter(x => x.pos < 8).map(x => x.note.midi), last = ns.filter(x => x.pos >= 24).map(x => x.note.midi);
    if (!first.length || !last.length) continue;
    diff[d.contour] += avg(last) - avg(first); n[d.contour]++;
  }
  assert.ok(diff.asc / n.asc > 2 && diff.desc / n.desc < -2, JSON.stringify({ diff, n }));
});

test("ear level 3 harmony: pitch motifs — repeated or sequenced from an earlier unit, more with higher chance, no exact repeats at low", () => {
  const rate = (chance, min) => {
    let any = 0, exact = 0;
    for (let i = 0; i < 800; i++) {
      const d = makeDictation({ root: "C", minor: i % 2 === 1 }, {}, { bars: 2, min, chance });
      if (d.motifs.length) any++;
      exact += d.motifs.filter(m => m.includes("=")).length;
    }
    return { any, exact };
  };
  for (const min of [1, 2]) {
    const hi = rate("high", min), lo = rate("low", min);
    assert.ok(hi.any > lo.any * 1.8, JSON.stringify({ min, hi, lo }));
    assert.strictEqual(lo.exact, 0);
  }
  // 최소 4분에는 없음
  assert.ok(Array.from({ length: 200 }, () => makeDictation({ root: "C", minor: false }, {}, { bars: 2, min: 4, chance: "high" })).every(d => !d.motifs.length));
  // 동형진행은 같은 자리의 음이 조 안에서 같은 칸 수만큼 옮겨짐 (같은 리듬일 때)
  for (let i = 0; i < 400; i++) {
    const d = makeDictation({ root: "C", minor: false }, {}, { bars: 2, min: 1, chance: "high" });
    for (const m of d.motifs) {
      const g = /^b(\d)←b(\d) ([+-]\d)$/.exec(m);
      if (!g) continue;
      const [u, s, dd] = [g[1] - 1, g[2] - 1, +g[3]];
      const at = u0 => d.filter(x => !x.rest && Math.floor(x.pos / 4) === u0).map(x => x.note);
      at(u).forEach((n, j) => assert.strictEqual(n.oct * 7 + n.l - (at(s)[j].oct * 7 + at(s)[j].l), dd, m));
    }
  }
});

test("ear level 3: no beat of rest right before or after a half note (it would sound like a dotted half)", () => {
  assert.ok(rhythmProblem([{ pos: 0, dur: 8, rest: false }, { pos: 8, dur: 4, rest: true }, { pos: 12, dur: 4, rest: false }, { pos: 16, dur: 4, rest: false }, { pos: 20, dur: 4, rest: false }, { pos: 24, dur: 8, rest: false }], 4, 2).startsWith("beat of rest"));
  for (const min of [4, 2, 1]) for (let i = 0; i < 1500; i++) {
    const r = generateRhythm(2, min);
    r.forEach((x, k) => {
      if (x.rest || x.dur !== 8) return;
      let a = 0; for (let j = k - 1; j >= 0 && r[j].rest; j--) a += r[j].dur;
      let b = 0; for (let j = k + 1; j < r.length && r[j].rest; j++) b += r[j].dur;
      assert.ok(a < 4 && b < 4, JSON.stringify(r));
    });
  }
});

test("ear level 3 harmony: modal chords take their notes from the borrowed scale (C major Fm7 · A♭M7 → no B♮ except a chromatic semitone step)", () => {
  const PER = { high: 1, mid: 2, low: 4 };
  let modal = 0;
  for (const chance of ["high", "mid", "low"]) for (let i = 0; i < 500; i++) {
    const d = makeDictation({ root: "C", minor: false }, { chromatic: true }, { bars: 2, min: 2, chance });
    if (!d.chords) continue;
    const ns = d.filter(x => !x.rest), slot = 16 / PER[chance];
    ns.forEach((t, j) => {
      const c = d.chords[Math.min(d.chords.length - 1, Math.floor(t.pos / slot))];
      if (!c.src) return;
      modal++;
      if (t.note.l !== 6 || t.note.a !== 0) return;
      // 남은 B♮는 조 밖의 반음 경과음·보조음뿐 (앞뒤가 반음)
      assert.ok(Math.abs(ns[j - 1].note.midi - t.note.midi) === 1 && Math.abs(ns[j + 1].note.midi - t.note.midi) === 1, c.name);
    });
  }
  assert.ok(modal > 500, String(modal));
});

test("ear level 3 harmony: common interval patterns at high (more) and mid, never at low", () => {
  const count = chance => {
    let n = 0;
    for (let i = 0; i < 400; i++) n += makeDictation({ root: "C", minor: false }, {}, { bars: 2, min: 1, chance }).motifs.filter(m => /^h\d+ [a-zA-Z]/.test(m)).length;
    return n;
  };
  const hi = count("high"), mid = count("mid"), lo = count("low");
  assert.ok(hi > mid * 1.5 && mid > 0 && lo === 0, JSON.stringify({ hi, mid, lo }));
  // 화성음 패턴(ctRun)의 음은 모두 화성음(9음 포함)
  for (let i = 0; i < 400; i++) {
    const d = makeDictation({ root: "C", minor: false }, {}, { bars: 1, min: 1, chance: "high" });
    for (const m of d.motifs) {
      const g = /^h(\d+) ctRun$/.exec(m);
      if (!g) continue;
      const c = d.chords[0], ninth = (pcOf(c.root) + 2) % 12;
      const ns = d.filter(x => !x.rest && Math.floor(x.pos / 8) === g[1] - 1).slice(0, 3);
      for (const t of ns) assert.ok(c.pcs.has(pcOf(t.note)) || pcOf(t.note) === ninth, `${c.name} ${JSON.stringify(t.note)}`);
    }
  }
});

test("ear level 3 harmony: chromatic passing / neighbour tones — only with chromatic on, off the beat, in and out by semitone, at most 2", () => {
  const PER = { high: 1, mid: 2, low: 4 };
  let seen = 0;
  for (const chance of ["high", "mid", "low"]) for (let i = 0; i < 400; i++) {
    const off = makeDictation({ root: "C", minor: false }, {}, { bars: 2, min: 1, chance });
    assert.ok(!off.motifs.some(m => m.startsWith("chrom")));
    const d = makeDictation({ root: "C", minor: false }, { chromatic: true }, { bars: 2, min: 1, chance });
    if (!d.chords) continue;
    const n = d.motifs.filter(m => m.startsWith("chrom")).length;
    assert.ok(n <= 2);
    seen += n;
  }
  assert.ok(seen > 100, String(seen));
});
