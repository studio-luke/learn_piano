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
    const [, L, acc, o] = s.match(/^([A-G])([♯♭𝄪𝄫]*)(\d)$/u);
    const a = [...acc].reduce((x, c) => x + ({ "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 }[c]), 0);
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
  // 바로 옆 음끼리 한 옥타브 이상 벌어지지 않음 (사용자 요청 2026-11-08)
  for (const q of qs) for (let i = 1; i < q.notes.length; i++) assert.ok(q.notes[i].midi - q.notes[i - 1].midi < 12, `${q.symbol}: ${q.notes.map(n => n.name + n.oct)}`);
  assert.ok(qs.filter(q => mod12(q.notes[0].midi) !== q.rootPc).length > 2000, "bass is often not the root");
  // mM7은 텐션이 붙어도 5음을 빼지 않음
  for (const q of gen({ optInv: true, types: { mM7: true } }, 1500)) assert.strictEqual(q.notes.length, q.tones.length, q.symbol);
  const withOpt = qs.filter(q => q.optional.size && q.type !== "mM7");
  const omitted = withOpt.filter(q => q.notes.length < q.tones.length).length / withOpt.length;
  assert.ok(omitted > 0.4 && omitted < 0.6, `omitted ${omitted}`);
});

// 자리바꿈 보이싱 규칙 (사용자 결정 2026-11-10)
const toneAt = (q, n) => q.tones.find(t => t.pc === mod12(n.midi));
const degOfT = t => (t.ten ? { b9: 9, 9: 9, "#9": 9, 11: 11, "#11": 11, b13: 13, 13: 13 }[t.ten] : t.deg);
const show = q => `${q.symbol}: ${q.notes.map(n => n.name + n.oct).join(" ")}`;

test("naming voicing: allowed basses only — no 11, 13(6), ♯9, ♭9, sus 4th/2nd; 9th only with the 3rd a 2nd above", () => {
  for (const q of gen({ optInv: true }, 12000)) {
    const b = toneAt(q, q.notes[0]);
    const d = degOfT(b);
    assert.ok([1, 3, 5, 7, 9].includes(d), show(q));
    if (d !== 9) continue;
    assert.ok(!b.ten || b.ten === "9", show(q));
    assert.ok(!["aug7", "augM7"].includes(q.type), show(q));
    if (q.tones.some(t => t.deg === 7)) assert.strictEqual(q.tones.filter(t => t.ten).length, 1, show(q));
    else assert.ok(["add9", "madd9"].includes(q.type), show(q));
    const next = toneAt(q, q.notes[1]);
    assert.strictEqual(next.deg, 3, show(q));
    assert.ok([1, 2].includes(q.notes[1].midi - q.notes[0].midi), show(q));
    assert.ok(q.notes.some(n => mod12(n.midi) === q.rootPc), show(q));
  }
});

test("naming voicing: aug-sounding sevenths (aug7, augM7, 7(♭13) without the 5th) keep the root in the bass; aug triad may invert (2026-11-10)", () => {
  for (const q of gen({ optInv: true, types: { aug7: true, augM7: true } }, 3000)) assert.strictEqual(mod12(q.notes[0].midi), q.rootPc, show(q));
  const b13 = gen({ optInv: true, cMax: 1, types: { dom7: true } }, 12000).filter(q => q.tens.includes("b13"));
  const noFifth = b13.filter(q => !q.pcs.has(mod12(q.rootPc + 7)));
  assert.ok(noFifth.length > 100, `7(♭13) without 5th: ${noFifth.length}`);
  for (const q of noFifth) assert.strictEqual(mod12(q.notes[0].midi), q.rootPc, show(q));
  assert.ok(b13.some(q => q.pcs.has(mod12(q.rootPc + 7)) && mod12(q.notes[0].midi) !== q.rootPc), "7(♭13) with the 5th may still invert");
  const aug = gen({ optInv: true, types: { aug: true } }, 1500);
  assert.ok(aug.filter(q => degOfT(toneAt(q, q.notes[0])) === 5).length > 300, "aug triad with ♯5 bass");
});

test("naming voicing: mM7 never has the 7th in the bass (nor the 5th with an 11); M7 still may (2026-11-10)", () => {
  for (const q of gen({ optInv: true, types: { mM7: true } }, 3000)) assert.notStrictEqual(degOfT(toneAt(q, q.notes[0])), 7, show(q));
  assert.ok(gen({ optInv: true, optC: false, types: { M7: true } }, 2000).some(q => degOfT(toneAt(q, q.notes[0])) === 7));
  // mM7(11)은 5음 베이스도 없음 (5음이 근음인 도미넌트 7처럼 들려서), 11이 없는 mM7은 5음 베이스가 나옴
  const mm = gen({ optInv: true, types: { mM7: true } }, 6000);
  for (const q of mm.filter(q => q.tens.includes("11"))) assert.notStrictEqual(degOfT(toneAt(q, q.notes[0])), 5, show(q));
  assert.ok(mm.some(q => !q.tens.includes("11") && degOfT(toneAt(q, q.notes[0])) === 5), "mM7 without 11 may have the 5th in the bass");
});

test("naming voicing: M7 and mM7 never end with the root on top a minor 2nd above the major 7th (2026-11-10)", () => {
  let inner = 0;
  for (const q of gen({ optInv: true, types: { M7: true, mM7: true } }, 6000)) {
    const n = q.notes.length, top = q.notes[n - 1], below = q.notes[n - 2];
    assert.ok(!(mod12(top.midi) === q.rootPc && top.midi - below.midi === 1), show(q));
    for (let i = 1; i < n - 1; i++) if (mod12(q.notes[i].midi) === q.rootPc && q.notes[i].midi - q.notes[i - 1].midi === 1) inner++;
  }
  assert.ok(inner > 100, `inner 7–root minor 2nds still allowed: ${inner}`);
});

test("naming voicing: every inverted voicing splits into two hands, each within a 9th (2026-11-10)", () => {
  const ok = ms => ms.some((_, k) => k > 0 && ms[k - 1] - ms[0] <= 14 && ms[ms.length - 1] - ms[k] <= 14) || ms[ms.length - 1] - ms[0] <= 14;
  for (const q of gen({ optInv: true }, 12000)) assert.ok(ok(q.notes.map(n => n.midi)), show(q));
});

test("naming voicing: no four-note cluster of three seconds in a row; one or two seconds are fine (2026-11-10)", () => {
  let two = 0;
  for (const q of gen({ optInv: true }, 12000)) {
    let run = 0;
    for (let i = 1; i < q.notes.length; i++) {
      run = q.notes[i].midi - q.notes[i - 1].midi <= 2 ? run + 1 : 0;
      assert.ok(run < 3, show(q));
      if (run === 2) two++;
    }
  }
  assert.ok(two > 200, `two seconds in a row: ${two}`);
});

test("naming voicing: no minor 9th except root–♭9 and 5th–♭13; minor 2nds are allowed", () => {
  let m2 = 0, b13over5 = 0;
  for (const q of gen({ optInv: true }, 12000)) {
    for (let i = 0; i < q.notes.length; i++) for (let j = i + 1; j < q.notes.length; j++) {
      const d = q.notes[j].midi - q.notes[i].midi, lo = toneAt(q, q.notes[i]), hi = toneAt(q, q.notes[j]);
      if (d === 1) m2++;
      if (d > 12 && d % 12 === 1) {
        const ok = (lo.semi === 0 && hi.ten === "b9") || (lo.semi === 7 && lo.deg === 5 && hi.ten === "b13");
        assert.ok(ok, show(q));
        if (hi.ten === "b13") b13over5++;
      }
    }
  }
  assert.ok(m2 > 500, `minor 2nds ${m2}`);
  assert.ok(b13over5 > 0, "5th–♭13 minor 9th can appear");
});

test("naming voicing: bass ratios — 7th chords 40/20/15/20(/9th 5), triads·6·add·sus root/3rd/5th equal", () => {
  const share = (qs, d) => qs.filter(q => degOfT(toneAt(q, q.notes[0])) === d).length / qs.length;
  const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) < tol, `${what}: ${got.toFixed(3)} vs ${want.toFixed(3)}`);
  // 텐션 없는 7화음: 9음 몫이 없어서 40:20:15:20을 나눠 가짐
  const sev = gen({ optInv: true, optC: false, types: { M7: true, m7: true, dom7: true } }, 8000);
  near(share(sev, 1), 40 / 95, 0.03, "7th root"); near(share(sev, 3), 20 / 95, 0.03, "7th 3rd");
  near(share(sev, 5), 15 / 95, 0.03, "7th 5th"); near(share(sev, 7), 20 / 95, 0.03, "7th 7th");
  // 3화음: 셋이 같은 비율
  const tri = gen({ optInv: true, types: { maj: true, min: true } }, 6000);
  for (const d of [1, 3, 5]) near(share(tri, d), 1 / 3, 0.03, `triad ${d}`);
  // sus: 4음·2음은 베이스가 아님 → 근음·5음 반반
  const sus = gen({ optInv: true, types: { sus4: true, sus2: true } }, 4000);
  near(share(sus, 1), 0.5, 0.04, "sus root"); near(share(sus, 5), 0.5, 0.04, "sus 5th");
  // 6화음: 6음은 베이스가 아님
  assert.strictEqual(share(gen({ optInv: true, types: { "6": true, m6: true } }, 3000), 6), 0);
  // add9: 9음이 전체의 5%
  near(share(gen({ optInv: true, types: { add9: true, madd9: true } }, 8000), 9), 0.05, 0.015, "add9 9th");
});

test("naming voicing: the fifth is dropped first (50%), then the bass is chosen from the notes left", () => {
  const qs = gen({ optInv: true, types: { M7: true, m7: true, dom7: true } }, 10000).filter(q => q.optional.size);
  const dropped = qs.filter(q => q.notes.length < q.tones.filter(t => t.role !== "alt").length);
  const rate = dropped.length / qs.length;
  assert.ok(rate > 0.45 && rate < 0.55, `fifth dropped ${rate}`);
  // 5음을 뺀 문제의 베이스는 5음이 아님 (뺀 음이 베이스로 정해지는 일 없음), 5음이 남은 문제에서는 5음 베이스가 나옴
  for (const q of dropped) assert.notStrictEqual(degOfT(toneAt(q, q.notes[0])), 5, show(q));
  const kept = qs.filter(q => !dropped.includes(q));
  const fifth = kept.filter(q => degOfT(toneAt(q, q.notes[0])) === 5).length / kept.length;
  assert.ok(fifth > 0.11 && fifth < 0.19, `fifth bass when kept ${fifth}`);
});

test("naming: a 7th chord without tensions may leave out a perfect 5th — listed only when its root is the bass (2026-11-10)", () => {
  // D–G–C: D7sus4 목록에 있음 / G–C–D, C–D–G: 목록에는 없지만 입력하면 정답 (화면이 앞에 붙여 보여줌)
  const dgc = prob("D4 G4 C5");
  assert.deepStrictEqual(names(dgc), ["D7sus4", "Gsus4", "Csus2"]);
  assert.deepStrictEqual([N.check("D7sus4", dgc).correct, N.check("D7sus4", dgc).unlisted], [true, null]);
  for (const t of ["G4 C5 D5", "C4 D4 G4"]) {
    const p = prob(t);
    assert.ok(!names(p).includes("D7sus4"), t);
    assert.deepStrictEqual([N.check("D7sus4", p).correct, N.check("D7sus4", p).unlisted], [true, "D7sus4"], t);
  }
  // M7 m7 7 mM7도 같음 (mM7은 출제 때만 5음을 늘 보여줌)
  for (const [t, a] of [["C4 E4 B4", "CM7"], ["C4 E♭4 B♭4", "Cm7"], ["C4 E4 B♭4", "C7"], ["C4 E♭4 B4", "CmM7"], ["E♭4 B4 C5", "CmM7"]]) assert.ok(N.check(a, prob(t)).correct, `${a} for ${t}`);
  // 5음이 코드의 정체인 코드는 그대로 필수: m7(♭5) dim7 aug7(=7(♭13)) augM7
  for (const [t, a] of [["D4 F4 C5", "Dm7(b5)"], ["C4 E♭4 A4", "Cdim7"], ["C4 E4 B♭4", "Caug7"], ["C4 E4 B4", "CaugM7"]]) assert.ok(!N.check(a, prob(t)).correct, `${a} for ${t}`);
  // 자리바꿈 꺼짐에서는 근음이 맨 아래여야 하는 규칙이 먼저
  assert.ok(!N.check("D7sus4", prob("G4 C5 D5", false)).correct);
});

test("naming: a correct answer is named in engine form so the page can show it first (2026-11-10)", () => {
  const first = (a, t) => { const r = N.check(a, prob(t)); return r.unlisted || r.matched; };
  assert.strictEqual(first("Fm6", "D4 F4 A♭4 C5"), "Fm6");
  assert.strictEqual(first("Dø", "D4 F4 A♭4 C5"), "Dm7(♭5)");
  assert.strictEqual(first("C9", "C4 E4 G4 B♭4 D5"), "C7(9)");
  assert.strictEqual(first("Db7", "C♯4 E♯4 G♯4 B4"), "C♯7");          // 근음 철자는 악보를 따름
  assert.strictEqual(first("Cm6(maj7)", "C4 E♭4 G4 A4 B4"), "CmM7(13)");
  assert.strictEqual(first("D7sus4", "G4 C5 D5"), "D7sus4");           // 목록에 없는 정답은 표준 표기로
  assert.strictEqual(first("Cm7", "C4 E4 G4 B♭4"), null);              // 오답이면 없음
  // 목록의 이름으로 답하면 늘 그 이름
  for (const q of gen({ optInv: true }, 2000)) for (const a of q.answers) assert.strictEqual(N.check(a.symbol, q).matched, a.symbol, `${a.symbol} for ${q.symbol}`);
});

test("naming: C6(maj7) = CM7(13), Cm6(maj7) = CmM7(13); mM7(13) is listed but never asked (2026-11-10)", () => {
  for (const [a, b] of [["C6(maj7)", "CM7(13)"], ["C6(M7)", "CM7(13)"], ["CM6(maj7)", "CM7(13)"], ["Cm6(maj7)", "CmM7(13)"], ["Cm6(M7)", "CmM7(13)"], ["Cm6(△7)", "CmM7(13)"], ["C-6(maj7)", "CmM7(13)"]])
    assert.deepStrictEqual(N.parse(a), N.parse(b), a);
  const p = prob("C4 E♭4 G4 A4 B4");
  assert.ok(names(p).includes("CmM7(13)"), names(p).join());
  for (const a of ["Cm6(maj7)", "CmM7(13)"]) assert.deepStrictEqual([N.check(a, p).correct, N.check(a, p).unlisted], [true, null], a);
  for (const q of gen({ optInv: true, types: { mM7: true } }, 3000)) assert.ok(!q.tens.includes("13"), q.symbol);
});

test("naming: a correct answer missing from the answer list is reported (shown first), other spellings of a listed one are not", () => {
  const un = (a, t) => N.check(a, prob(t)).unlisted;
  // 목록에 없는 정답: 목록에서 쓰지 않는 텐션, 7alt
  assert.strictEqual(un("CM7(11)", "C4 E4 G4 B4 F5"), "CM7(11)");
  assert.strictEqual(un("C7alt", "C4 E4 A♭4 B♭4 D♭5"), "C7alt");
  // 목록에 있는 코드의 다른 표기는 붙이지 않음
  assert.strictEqual(un("C9", "C4 E4 G4 B♭4 D5"), null);
  assert.strictEqual(un("Caug7", "C4 E4 G♯4 B♭4"), null);
  assert.strictEqual(un("C#7(b9)", "B♭3 C4 D♭4 E4"), null);
  // 정답 목록의 이름은 모두 목록에 있는 것으로 침
  for (const q of gen({ optInv: true }, 3000)) for (const a of q.answers) assert.strictEqual(N.check(a.symbol, q).unlisted, null, `${a.symbol} for ${q.symbol}`);
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
  const add9 = prob("C4 E4 G4 D5", false);
  for (const s of ["Cadd9", "Cadd2", "C2"]) assert.ok(N.check(s, add9).correct, s);
  const madd9 = prob("C4 E♭4 G4 D5", false);
  for (const s of ["Cmadd9", "Cmadd2", "C-add2"]) assert.ok(N.check(s, madd9).correct, s);
  assert.strictEqual(N.check("Cm2", madd9).error, "unknown", "Cm2는 받지 않음");
  const m69 = prob("C4 E♭4 G4 A4 D5", false);
  for (const s of ["Cm6(9)", "Cm6/9", "C-6/9"]) assert.ok(N.check(s, m69).correct, s);
  assert.deepStrictEqual(names(m69), ["Cm6(9)"]);
  assert.strictEqual(N.check("Cm69", m69).error, "noParen");
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
  for (const s of ["H7", "Cxyz", "C(9)", "C7(9))", "Cdim(9)", "C7sus", "C7sus(9)", "Eb7sus"]) assert.strictEqual(N.check(s, p).error, "unknown", s);
});

test("naming: wrong answers say which notes are missing and which do not belong", () => {
  const p = prob("C4 E4 G4 B♭4", false);
  assert.deepStrictEqual(N.check("Cm7", p), { correct: false, missing: ["E♭"], extra: ["E"], bassWrong: false, unlisted: null, matched: null });
  assert.deepStrictEqual(N.check("C7(9)", p), { correct: false, missing: ["D"], extra: [], bassWrong: false, unlisted: null, matched: null });
  assert.deepStrictEqual(N.check("C", p), { correct: false, missing: [], extra: ["B♭"], bassWrong: false, unlisted: null, matched: null });
  // 자리바꿈 꺼짐: 구성음은 맞아도 근음이 맨 아래가 아니면 오답
  const q = prob("D4 F4 A♭4 C5", false);
  assert.deepStrictEqual(N.check("Fm6", q), { correct: false, missing: [], extra: [], bassWrong: true, unlisted: null, matched: null });
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

// ---------- 오선지 악보 위치 계산 (naming/staff.js layout) ----------
import { layout } from "../src/assets/js/naming/staff.js";
const notesOf = text => prob(text).notes;
const ACC_H = { "1": [3, 3], "-1": [1, 4], "2": [1.5, 1.5], "-2": [1, 4] };   // staff.js SHAPE의 [아래, 위]

test("staff: seconds push the upper note to the right; ♭9 and ♯9 on the same line sit side by side", () => {
  const { heads } = layout(notesOf("C4 D4 E4"));   // 2도 2개: 왼 · 오 · 왼
  assert.deepStrictEqual(heads.map(h => h.right), [false, true, false]);
  const b9s9 = layout(notesOf("C4 E4 G4 B♭4 D♭5 D♯5")).heads;
  const d = b9s9.filter(h => h.note.l === 1);
  assert.strictEqual(d.length, 2);
  assert.notStrictEqual(d[0].right, d[1].right, "D♭와 D♯는 좌우로 비켜 놓임");
  assert.deepStrictEqual(layout(notesOf("C4 E4 G4")).heads.map(h => h.right), [false, false, false], "3도는 비키지 않음");
});

test("staff: ledger lines — F3 needs 3 below, D6 needs 2 above, notes on the staff need none", () => {
  assert.strictEqual(layout(notesOf("F3")).ledgers.length, 3);
  assert.strictEqual(layout(notesOf("D6")).ledgers.length, 2);
  assert.strictEqual(layout(notesOf("E4 G4 B4 D5 F5")).ledgers.length, 0);
});

test("staff: accidentals in one column never overlap, and every generated question fits left of the notes", () => {
  const check = notes => {
    const { accs } = layout(notes);
    for (let i = 0; i < accs.length; i++) for (let j = i + 1; j < accs.length; j++) {
      const p = accs[i], q = accs[j];
      if (p.col !== q.col) continue;
      const sp = p.note.oct * 7 + p.note.l, sq = q.note.oct * 7 + q.note.l;
      const [pl, ph] = ACC_H[p.a], [ql, qh] = ACC_H[q.a];
      assert.ok(sp - pl >= sq + qh || sq - ql >= sp + ph, notes.map(n => n.name + n.oct).join(" "));
    }
    for (const a of accs) assert.ok(a.x > 28, `임시표가 음자리표와 겹침: ${notes.map(n => n.name + n.oct).join(" ")}`);
  };
  check(notesOf("C♯5 E♯5 G♯5 B5"));
  check(notesOf("F3 A♭3 C♭4 E𝄫4"));
  for (const optInv of [false, true]) for (const q of gen({ optInv, optE: true }, 3000)) check(q.notes);
});

test("naming review: a saved question comes back with the same voicing, then with a different one", () => {
  for (const optInv of [false, true]) for (const optE of [false, true]) for (const q of gen({ optInv, optE }, 1500)) {
    const sp = JSON.parse(JSON.stringify(N.specOf(q)));   // DB를 거친 것처럼
    const same = N.fromSpec(sp, true);
    assert.ok(same, q.symbol);
    assert.deepStrictEqual(same.notes.map(n => n.midi + n.name), q.notes.map(n => n.midi + n.name), q.symbol);
    assert.strictEqual(same.symbol, q.symbol);
    assert.deepStrictEqual(same.answers.map(a => a.symbol), q.answers.map(a => a.symbol));
    const other = N.fromSpec(sp, false);
    assert.ok(other && N.check(q.symbol, other).correct, `${q.symbol} 다른 배치도 같은 코드`);
    assert.strictEqual(other.inv, q.inv);
    assert.ok(other.notes.every(n => n.midi >= N.LOW && n.midi <= N.HIGH));
    if (optInv) for (let i = 1; i < other.notes.length; i++) assert.ok(other.notes[i].midi - other.notes[i - 1].midi < 12);
    else assert.strictEqual(other.notes[0].midi % 12, q.rootPc, "자리바꿈 없는 문제는 다시 풀어도 근음이 맨 아래");
    assert.ok(JSON.stringify(sp).length < 600, "DB spec 크기 제한(800바이트) 안");
  }
  const sp = N.specOf(gen({ optInv: true }, 1)[0]);
  assert.strictEqual(N.fromSpec({ ...sp, notes: [[30, "C"]] }, true), null, "범위 밖 음");
  assert.strictEqual(N.fromSpec({ ...sp, notes: [[60, "<b>"]] }, true), null, "이상한 이름");
  assert.strictEqual(N.fromSpec({ ...sp, type: "M9" }, true), null, "이 페이지에 없는 코드 종류");
});

test("naming: chord words in parentheses — (add9) (add2) (sus4) (sus2) 7(sus4); C(6) is not taken", () => {
  const same = [["C(add9)", "Cadd9"], ["C(add2)", "Cadd9"], ["Cm(add9)", "Cmadd9"], ["Cm(add2)", "Cmadd9"], ["C-(add9)", "Cmadd9"],
    ["C(sus4)", "Csus4"], ["C(sus2)", "Csus2"], ["C7(sus4)", "C7sus4"], ["C7(sus4,9)", "C7sus4(9)"], ["C7(9,sus4)", "C7sus4(9)"]];
  for (const [a, b] of same) assert.deepStrictEqual(N.parse(a), N.parse(b), a);
  for (const s of ["C(6)", "Cm(6)", "C(sus)", "Cm(sus4)", "CM7(sus4)", "C(add9,13)", "C(add11)"]) assert.strictEqual(N.parse(s).error, "unknown", s);
  assert.ok(N.check("C(add9)", prob("C4 E4 G4 D5", false)).correct);
  assert.ok(N.check("C7(sus4)", prob("C4 F4 G4 B♭4", false)).correct);
});

test("naming: many accepted spellings — case of words, ^ and o, +/- tensions, sus4 tensions, 6(add9), aug9", () => {
  const same = [
    ["CMA7", "CM7"], ["CMAJ7", "CM7"], ["CMaj7", "CM7"], ["CmAJ7", "CM7"], ["C^7", "CM7"], ["C^", "CM7"], ["CMA9", "CM7(9)"],
    ["CMI7", "Cm7"], ["CMIN7", "Cm7"], ["CMin7", "Cm7"], ["CMI", "Cm"], ["CMIN", "Cm"],
    ["CmMA7", "CmM7"], ["Cm(M7)", "CmM7"], ["Cm(MAJ7)", "CmM7"], ["Cm^7", "CmM7"],
    ["CSUS4", "Csus4"], ["CSus2", "Csus2"], ["CADD9", "Cadd9"], ["CmADD9", "Cmadd9"], ["C(ADD9)", "Cadd9"], ["C7(SUS4)", "C7sus4"],
    ["CDIM", "Cdim"], ["CDIM7", "Cdim7"], ["Co", "Cdim"], ["Co7", "Cdim7"], ["CAUG", "Caug"], ["CAug7", "Caug7"],
    ["C9sus4", "C7sus4(9)"], ["C13sus4", "C7sus4(13)"], ["C9SUS4", "C7sus4(9)"],
    ["Cm7-5", "Cm7(b5)"], ["Cm7(-5)", "Cm7(b5)"], ["C7(+5)", "C7(#5)"], ["C7(-9)", "C7(b9)"], ["C7(+9)", "C7(#9)"], ["C7(+11)", "C7(#11)"], ["C7(-9,+11)", "C7(b9,#11)"],
    ["C6add9", "C6(9)"], ["C6(add9)", "C6(9)"], ["Cm6add9", "Cm6(9)"], ["Cm6(add9)", "Cm6(9)"],
    ["Caug9", "Caug7(9)"], ["CAUG9", "Caug7(9)"],
    ["CM6", "C6"], ["CMa6", "C6"], ["CMA6", "C6"], ["Cma6", "C6"], ["CMaj6", "C6"], ["CMAJ6", "C6"], ["Cmaj6", "C6"],
    ["CM6/9", "C6(9)"], ["CMaj6/9", "C6(9)"], ["CMA6/9", "C6(9)"], ["CM6(9)", "C6(9)"], ["Cmaj6(9)", "C6(9)"], ["CMAJ6(add9)", "C6(9)"], ["CM6add9", "C6(9)"],
    ["GMadd2", "Gadd9"], ["GMadd9", "Gadd9"], ["GMAJadd9", "Gadd9"], ["Gmaj(add9)", "Gadd9"],
  ];
  for (const [a, b] of same) { assert.ok(!N.parse(b).error, b); assert.deepStrictEqual(N.parse(a), N.parse(b), a); }
  // 한 글자 M/m은 그대로 구분, 근음 소문자는 여전히 오류
  assert.notDeepStrictEqual(N.parse("CM7"), N.parse("Cm7"));
  assert.strictEqual(N.parse("cMAJ7").error, "lowerRoot");
  for (const s of ["C(add4)", "C+9", "Cadd4", "Ch", "C^6", "C△6", "C△6/9", "C^6(9)"]) assert.ok(N.parse(s).error, s);
  assert.strictEqual(N.parse("Cm6/9").type, "m69", "소문자 m6/9는 마이너 6(9) 그대로");
  assert.deepStrictEqual(N.parse("Cm6"), { ...N.parse("Cm6") }, "소문자 m6은 마이너 6 그대로");
  assert.strictEqual(N.parse("Cm6").type, "m6");
});

test("naming: Fmajor = F, Fminor = Fm — triads only, any case of the word (2026-11-09)", () => {
  const same = [["Fmajor", "F"], ["FMajor", "F"], ["FMAJOR", "F"], ["F major", "F"], ["Fminor", "Fm"], ["FMinor", "Fm"], ["FMINOR", "Fm"], ["F minor", "Fm"],
    ["Bbmajor", "Bb"], ["F#minor", "F#m"]];
  for (const [a, b] of same) { assert.ok(!N.parse(b).error, b); assert.deepStrictEqual(N.parse(a), N.parse(b), a); }
  for (const s of ["Fmajor7", "Fminor7", "Fminor(add9)", "Fmajor(sus4)", "Fmajor(9)", "Fminor6", "Fmajor9"]) assert.ok(N.parse(s).error, s);
  assert.strictEqual(N.parse("fmajor").error, "lowerRoot");
  assert.ok(N.check("Fmajor", prob("F4 A4 C5", false)).correct);
  assert.ok(N.check("FMINOR", prob("F4 A♭4 C5", false)).correct);
});

test("naming: half-diminished 9/11, C(♯5), Ch7 (2026-11-08)", () => {
  const same = [["Cm9(b5)", "Cm7(b5,9)"], ["Cm11(b5)", "Cm7(b5,11)"], ["Cm9(-5)", "Cm7(b5,9)"], ["Cø9", "Cm7(b5,9)"],
    ["C(#5)", "Caug"], ["C(+5)", "Caug"], ["C(♯5)", "Caug"], ["Ch7", "Cm7(b5)"], ["Ch9", "Cm7(b5,9)"], ["Ch11", "Cm7(b5,11)"]];
  for (const [a, b] of same) { assert.ok(!N.parse(b).error, b); assert.deepStrictEqual(N.parse(a), N.parse(b), a); }
  assert.ok(N.check("Cm9(♭5)", prob("C4 E♭4 G♭4 B♭4 D5", false)).correct);
});

test("naming: 7alt — R 3 ♭7 + one of ♭9 ♯9 ♭13, ♯11 may join, no natural 9/13, perfect 5th allowed", () => {
  for (const s of ["C7alt", "C7Alt", "C7ALT"]) assert.ok(N.parse(s).alt, s);
  assert.strictEqual(N.parse("C7alt(b9)").error, "unknown");
  const yes = ["C4 E4 B♭4 D♭5", "C4 E4 B♭4 D♯5 A♭5", "C4 E4 G4 B♭4 E♭5", "C4 E4 G♭4 B♭4 A♭5", "E4 B♭4 C5 D♭5"];
  for (const n of yes) assert.ok(N.check("C7alt", prob(n)).correct, n);
  const r1 = N.check("C7alt", prob("C4 E4 B♭4 D♭5 A5"));   // C13(♭9): 자연 13
  assert.ok(!r1.correct && r1.extra.includes("A"), "C13(♭9)는 alt 아님");
  const r2 = N.check("C7alt", prob("C4 E4 G4 B♭4 F♯5"));   // C7(♯11): 리디안 도미넌트
  assert.ok(!r2.correct && r2.noAlt, "♯11만으로는 alt 아님");
  assert.ok(!N.check("C7alt", prob("C4 E4 B♭4 D5 A♭5")).correct, "자연 9가 있으면 alt 아님");
  assert.deepStrictEqual(N.check("C7alt", prob("C4 B♭4 D♭5")).missing, ["E"]);
  assert.ok(N.check("C7alt", prob("E4 B♭4 C5 D♭5", false)).bassWrong, "자리바꿈 꺼짐이면 근음이 맨 아래");
});

test("naming: ø11, mM9 forms, aug(maj7) forms", () => {
  const same = [["Cø11", "Cm7(b5,11)"], ["CmM9", "CmM7(9)"], ["Cm(maj9)", "CmM7(9)"], ["Cm(M9)", "CmM7(9)"], ["C-△9", "CmM7(9)"], ["CmMAJ9", "CmM7(9)"],
    ["Caug(maj7)", "CaugM7"], ["C+(M7)", "CaugM7"], ["CAUG(MAJ7)", "CaugM7"], ["Caug(△7)", "CaugM7"]];
  for (const [a, b] of same) { assert.ok(!N.parse(b).error, b); assert.deepStrictEqual(N.parse(a), N.parse(b), a); }
  // 정답 목록에 보이는 이름은 기본 표기 그대로
  assert.deepStrictEqual(names(prob("C4 E♭4 G4 B4 D5", false)), ["CmM7(9)"]);
});
