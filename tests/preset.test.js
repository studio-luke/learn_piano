// 출제 설정 공유 링크(?preset=…)의 값 만들기·읽기 검사.  실행: npm test
// 링크는 메신저로 오가고 누구나 손으로 고칠 수 있으므로, 읽을 때 걸러야 할 값을 특히 꼼꼼히 확인해요.
import test from "node:test";
import assert from "node:assert";
import { encodePreset, decodePreset } from "../src/assets/js/common/preset.js";
import { Engine } from "../src/assets/js/core/engine.js";
import { Naming } from "../src/assets/js/core/naming.js";

const PLAY = { route: "trainer/chords/", types: Engine.TYPES.map(x => x.id), flags: ["B", "C", "D", "E"] };
const NAME = { route: "trainer/chords-name/", types: Naming.NAME_TYPES.map(x => x.id), flags: ["B", "C", "E", "I"] };
const settings = (on, over = {}) => ({
  types: Object.fromEntries(PLAY.types.map(id => [id, on.includes(id)])),
  optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optD: false, optE: false, ...over,
});

test("만들고 다시 읽으면 같은 설정", () => {
  const bases = Array(12).fill(false); bases[0] = bases[3] = bases[11] = true;
  const S = settings(["M7", "m7", "dom7", "7sus4", "6"], { optB: true, bases, optC: true, cMax: 2, optE: true, labels: true, kbd: true, midi: true });
  const v = encodePreset(S, PLAY);
  assert.match(v, /^[A-Za-z0-9.-]+$/);   // 메신저에서 바뀌지 않는 글자만
  const p = decodePreset(v, PLAY);
  assert.deepStrictEqual(p.types, S.types);
  assert.deepStrictEqual(p.bases, bases);
  assert.strictEqual(p.cMax, 2);
  assert.deepStrictEqual([p.optB, p.optC, p.optD, p.optE], [true, true, false, true]);
});

test("기기별·취향 설정(소리, 음이름, 키보드, MIDI, 심화 펼침)과 타이머는 담지 않음", () => {
  const p = decodePreset(encodePreset(settings(["M7"], { labels: true, sound: false, kbd: true, kbdTouched: true, midi: true, adv: true }), PLAY), PLAY);
  assert.deepStrictEqual(Object.keys(p).sort(), ["bases", "cMax", "optB", "optC", "optD", "optE", "types"]);
});

test("코드 종류를 전부 골라도 링크가 짧음", () => {
  assert.ok(encodePreset(settings(PLAY.types, { optB: true, bases: Array(12).fill(true) }), PLAY).length < 250);
});

test("코드 추론하기: 자리바꿈(I)을 담고, 기호 표기(D)는 담지 않음", () => {
  const v = encodePreset(settings(["M7"], { optInv: true, optD: true }), NAME);
  const p = decodePreset(v, NAME);
  assert.strictEqual(p.optInv, true);
  assert.ok(!("optD" in p));
});

test("다른 페이지의 코드 종류·옵션은 버림 (랜덤 코드 연습 링크를 코드 추론하기에서 읽기)", () => {
  const p = decodePreset("1-M7.M9.13-0-1-BDI", NAME);
  assert.strictEqual(p.types.M7, true);
  assert.ok(!("M9" in p.types) && !("13" in p.types));   // 텐션 코드 종류는 코드 추론하기에 없음
  assert.strictEqual(p.optB, true);
  assert.strictEqual(p.optInv, true);
  assert.ok(!("optD" in p));
});

test("모르는 코드 종류 id는 건너뛰고, 아는 것이 하나도 없으면 거부", () => {
  assert.strictEqual(decodePreset("1-M7.hello-0-1-", PLAY).types.M7, true);
  assert.strictEqual(decodePreset("1-hello.__proto__-0-1-", PLAY), null);
  assert.strictEqual(decodePreset("1--0-1-B", PLAY), null);
});

test("잘못된 값은 거부", () => {
  const bad = [
    "", null, undefined, 123,
    "2-M7--1-",              // 모르는 버전
    "1-M7--3-",              // 텐션 개수는 1·2만
    "1-M7-12-1-",            // 베이스는 0~11
    "1-M7-1.x-1-",
    "1-M7-1-1",              // 칸 수가 다름
    "1-M7-1-1--",
    "1-M7<script>-0-1-",     // 허용하지 않는 글자
    "1-" + "M7.".repeat(300) + "-0-1-",   // 너무 김
  ];
  for (const v of bad) assert.strictEqual(decodePreset(v, PLAY), null, String(v));
});

test("베이스가 비어 있어도 됨, 링크에 없는 옵션은 꺼짐", () => {
  const p = decodePreset("1-M7--1-", PLAY);
  assert.deepStrictEqual(p.bases, Array(12).fill(false));
  assert.deepStrictEqual([p.optB, p.optC, p.optD, p.optE], [false, false, false, false]);
});

// 코드 초견 무작위 코드 모드 (2026-11-10): 분수코드 S, 한 코드당 ½마디 H · 2마디 L (둘 다 없으면 1마디)
test("preset: chord sight-reading — slash chords and bars per chord travel in the link", async () => {
  const { encodePreset: enc, decodePreset: dec } = await import("../src/assets/js/common/preset.js");
  const { Engine } = await import("../src/assets/js/core/engine.js");
  const { DEFAULTS } = await import("../src/assets/js/improv/settings.js");
  const spec = { route: "trainer/chord-improv/", types: Engine.TYPES.map(x => x.id), flags: ["B", "C", "D", "E", "S", "H", "L"] };
  const src = (bars, slash) => ({ ...structuredClone(DEFAULTS), bars, slash, barsHalf: bars === "0.5", barsTwo: bars === "2" });
  for (const [bars, slash, flags] of [["0.5", true, "SH"], ["1", true, "S"], ["2", false, "L"], ["1", false, ""]]) {
    const v = enc(src(bars, slash), spec);
    assert.ok(v.endsWith("-" + flags), v);
    const p = dec(v, spec);
    assert.strictEqual(p.slash, slash);
    assert.strictEqual(p.barsHalf ? "0.5" : p.barsTwo ? "2" : "1", bars);
    assert.deepStrictEqual(Object.keys(p.types).filter(id => p.types[id]).sort(), Object.keys(DEFAULTS.types).filter(id => DEFAULTS.types[id]).sort());
  }
  // 다른 페이지의 링크에는 S·H·L이 없음 → 랜덤 코드 연습 링크를 코드 초견에서 읽으면 분수코드 꺼짐, 1마디
  const p = dec("1-M7.m7-0-1-BC", spec);
  assert.ok(p.optB && p.optC && !p.slash && !p.barsHalf && !p.barsTwo);
});

// 링크 설정이 지금 설정과 같으면 "바꿀까요?" 창을 띄우지 않음 (2026-11-10)
test("preset: samePreset — same settings are recognized, hidden differences (bases with B off, tension count with C off) don't count", async () => {
  const { samePreset } = await import("../src/assets/js/common/preset.js");
  const cur = settings(["M7", "m7", "dom7"], { optB: true, bases: [true, false, false, false, false, false, false, true, false, false, false, false], optC: true, cMax: 2 });
  const p = decodePreset(encodePreset(cur, PLAY), PLAY);
  assert.ok(samePreset(p, cur, PLAY));
  assert.ok(!samePreset(p, { ...cur, types: { ...cur.types, M7: false } }, PLAY), "코드 종류가 다름");
  assert.ok(!samePreset(p, { ...cur, cMax: 1 }, PLAY), "텐션 개수가 다름");
  assert.ok(!samePreset(p, { ...cur, bases: Array(12).fill(false) }, PLAY), "베이스가 다름");
  assert.ok(!samePreset(p, { ...cur, optD: true }, PLAY), "옵션이 다름");
  // 특정 베이스·텐션이 꺼져 있으면 베이스 목록·텐션 개수는 화면에 차이가 없어서 같은 것으로
  const off = settings(["M7"], { bases: [true, ...Array(11).fill(false)], cMax: 2 });
  const q = decodePreset(encodePreset(settings(["M7"]), PLAY), PLAY);
  assert.ok(samePreset(q, off, PLAY));
});
