// ===== 코드 엔진 =====
// 문제(코드) 만들기, 채점, 정답 보이싱, 음 이름 철자를 담당해요.
// 화면(DOM)을 전혀 건드리지 않는 순수 함수만 있어서 Node에서도 그대로 테스트할 수 있어요 (tests/engine.test.js).
// 출제·채점 규칙의 "왜"는 chordoven-spec.md에 정리돼 있어요.
//
// 용어
//   pc (pitch class)  음높이를 옥타브와 상관없이 0~11로 나타낸 값. C=0, C♯/D♭=1, … B=11
//   l (letter)        음이름 글자. C=0, D=1, E=2, F=3, G=4, A=5, B=6
//   a (accidental)    변화표. -2=𝄫, -1=♭, 0=없음, 1=♯, 2=𝄪
//   도수(degree)      근음에서 몇 번째 음인지. 1(근음) 3 5 7 9 11 13
//   MIDI 번호         건반 하나하나의 번호. 48=C3, 60=C4, 72=C5 (이 앱의 건반 범위)

const LET = "CDEFGAB";
const NAT = [0, 2, 4, 5, 7, 9, 11];   // 변화표 없는 C D E F G A B의 pc
const ACC = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" };
// 근음 철자 하나: l(글자), a(변화표), w(같은 건반의 다른 철자와 비교한 출제 비율)
const r = (l, a = 0, w = 1) => ({ l, a, w });

// 건반(pc)마다 쓸 근음 철자
// 기본: 검은 건반은 D♭ E♭ F♯ A♭ B♭ 하나씩
const ROOTS_DEFAULT = {
  0: [r(0)], 1: [r(1, -1)], 2: [r(1)], 3: [r(2, -1)], 4: [r(2)], 5: [r(3)],
  6: [r(3, 1)], 7: [r(4)], 8: [r(5, -1)], 9: [r(5)], 10: [r(6, -1)], 11: [r(6)],
};
// 옵션 E(복잡한 음 표현): 검은 건반의 ♯/♭ 두 이름 모두 + C♭ E♯ B♯ F♭ 근음 (G♭·F♯·C♯·C♭ 장조 등에서 나오는 표현).
// w: 덜 익숙한 C♭ E♯ A♯ D♯ G♯는 조금 더 자주(1.3), B♯ F♭은 가끔(0.4) — 사용자 요청 2026-11-06
const ROOTS_EXT = {
  0: [r(0), r(6, 1, 0.4)], 1: [r(0, 1), r(1, -1)], 2: [r(1)], 3: [r(1, 1, 1.3), r(2, -1)], 4: [r(2), r(3, -1, 0.4)],
  5: [r(3), r(2, 1, 1.3)], 6: [r(3, 1), r(4, -1)], 7: [r(4)], 8: [r(4, 1, 1.3), r(5, -1)],
  9: [r(5)], 10: [r(5, 1, 1.3), r(6, -1)], 11: [r(6), r(0, -1, 1.3)],
};
const WHITE = [0, 2, 4, 5, 7, 9, 11];   // 흰 건반의 pc
const PC_NAMES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"];

// 텐션 id → [근음에서 반음 수, 도수]
// "b5" / "#5"는 도미넌트 계열에서만 쓰는 ♯11 / ♭13의 다른 표기로, 완전5도 자리를 대신해요 (이때 완전5도를 누르면 오답).
const TEN = { "b5": [6, 5], "#5": [8, 5], "b9": [1, 9], "9": [2, 9], "#9": [3, 9], "11": [5, 11], "#11": [6, 11], "b13": [8, 13], "13": [9, 13] };
const TEN_ORDER = ["b5", "#5", "b9", "9", "#9", "11", "#11", "b13", "13"];   // 괄호 안에 쓰는 순서(낮은 것부터)
const ALT_SET = ["b9", "#9", "#11", "b13"];   // 7alt: 이 중 하나 이상

// 자주 쓰는 구성음 묶음: [반음 수, 도수, "opt"(생략 가능)?]
const T3 = [[0, 1], [4, 3], [7, 5]], t3 = [[0, 1], [3, 3], [7, 5]];   // 장3화음 / 단3화음
const O5 = [7, 5, "opt"], O9 = [2, 9, "opt"];   // 실전 보이싱에서 빼도 되는 음

// 코드 종류 목록. 출제 설정 화면도 이 순서대로 그려요.
//   id     코드 종류 이름(DB의 practice_log.quality에도 이 값이 저장됨 — 바꾸면 예전 기록과 안 맞음)
//   group  출제 설정의 묶음 (triad sus seventh sixth add tension)
//   name   화면에 보이는 이름
//   w      출제 비율 — 고른 코드 종류들 안에서 이 비율대로 뽑음 (두 연습 공통).
//          2026-11-09 사용자 결정: 7화음·6화음 위주로. 3화음·sus는 크게, add는 적당히 줄이고 텐션 코드는 예전 값의 35%.
//          텐션 코드 빼고 전부 고르면 7화음 약 62%, 6화음 12.5%, add 11%, 3화음 10%, sus 4% (spec "출제 가중치")
//   tones  구성음
//   std    표준 표기들 (여러 개면 무작위로 하나), sym  옵션 D(기호 표기)에서 추가로 섞이는 표기
//   seventh  7화음 계열인지 (옵션 C 텐션을 붙일 수 있음), ten  붙일 수 있는 텐션, maxTen  텐션 최대 개수
//   dominant  도미넌트 계열인지 (♯5/♭5 표기, 7alt)
const TYPES = [
  { id: "maj", group: "triad", name: "Major", w: 1, tones: T3, std: [""], sym: [] },
  { id: "min", group: "triad", name: "minor", w: 1, tones: t3, std: ["m"], sym: ["-"] },
  { id: "dim", group: "triad", name: "dim", w: 0.5, tones: [[0, 1], [3, 3], [6, 5]], std: ["dim"], sym: ["°"] },
  { id: "aug", group: "triad", name: "aug", w: 0.4, tones: [[0, 1], [4, 3], [8, 5]], std: ["aug"], sym: ["+"] },

  { id: "sus4", group: "sus", name: "sus4", w: 0.8, tones: [[0, 1], [5, 4], [7, 5]], std: ["sus4"], sym: [] },
  { id: "sus2", group: "sus", name: "sus2", w: 0.3, tones: [[0, 1], [2, 2], [7, 5]], std: ["sus2"], sym: [] },

  { id: "M7", group: "seventh", name: "M7", w: 2.7, tones: [...T3, [11, 7]], std: ["M7"], sym: ["△7", "△"], seventh: true, ten: ["9", "#11", "13"] },
  { id: "m7", group: "seventh", name: "m7", w: 2.7, tones: [...t3, [10, 7]], std: ["m7"], sym: ["-7"], seventh: true, ten: ["9", "11"] },
  { id: "dom7", group: "seventh", name: "7", w: 2.7, tones: [...T3, [10, 7]], std: ["7"], sym: [], seventh: true, ten: ["b9", "9", "#9", "#11", "b13", "13"], dominant: true },
  { id: "7sus4", group: "seventh", name: "7sus4", w: 1.8, tones: [[0, 1], [5, 4], [7, 5], [10, 7]], std: ["7sus4"], sym: [], seventh: true, ten: ["b9", "9", "13"] },
  { id: "aug7", group: "seventh", name: "aug7", w: 1, tones: [[0, 1], [4, 3], [8, 5], [10, 7]], std: ["aug7"], sym: ["+7"], seventh: true, ten: ["9", "#11"] },
  { id: "dim7", group: "seventh", name: "dim7", w: 1.8, tones: [[0, 1], [3, 3], [6, 5], [9, 7]], std: ["dim7"], sym: ["°7"], seventh: true, ten: [] },
  // m7(♭5): (♭5)가 이미 텐션처럼 읽혀서 텐션은 1개까지
  { id: "m7b5", group: "seventh", name: "m7(♭5)", w: 2.4, tones: [[0, 1], [3, 3], [6, 5], [10, 7]], std: ["m7(♭5)"], sym: ["ø7", "ø", "-7(♭5)"], seventh: true, ten: ["9", "11", "b13"], maxTen: 1 },
  { id: "mM7", group: "seventh", name: "mM7", w: 1.2, tones: [...t3, [11, 7]], std: ["mM7"], sym: ["-△7", "m△7"], seventh: true, ten: ["9", "11"], maxTen: 1 },
  // augM7은 M7(♯5)로도 씀 — ♯5 표기는 도미넌트 계열만 쓰는 규칙의 유일한 예외 (사용자 요청 2026-11-05)
  { id: "augM7", group: "seventh", name: "augM7", w: 1, tones: [[0, 1], [4, 3], [8, 5], [11, 7]], std: ["augM7", "M7(♯5)"], sym: ["+△7"], seventh: true, ten: [] },

  { id: "6", group: "sixth", name: "6", w: 1.5, tones: [...T3, [9, 6]], std: ["6"], sym: [] },
  { id: "m6", group: "sixth", name: "m6", w: 2, tones: [...t3, [9, 6]], std: ["m6"], sym: ["-6"] },

  { id: "add9", group: "add", name: "add9", w: 1.3, tones: [...T3, [2, 9]], std: ["add9"], sym: [] },
  { id: "madd9", group: "add", name: "madd9", w: 0.9, tones: [...t3, [2, 9]], std: ["madd9"], sym: ["-add9"] },
  { id: "69", group: "add", name: "6(9)", w: 0.6, tones: [...T3, [9, 6], [2, 9]], std: ["6(9)"], sym: [] },
  // 마이너 6(9): 1 ♭3 5 6 9 (Cm6/9 — 2026-11-08 사용자 요청, 두 페이지 모두. 처음 설정에서는 꺼짐)
  { id: "m69", group: "add", name: "m6(9)", w: 0.4, tones: [...t3, [9, 6], [2, 9]], std: ["m6(9)"], sym: ["-6(9)"] },

  // 텐션 코드: 3음·7음·맨 위 텐션은 필수, 5음과 중간 텐션은 생략 가능. M13·13에는 11을 쓰지 않음
  { id: "M9", group: "tension", name: "M9", w: 0.63, tones: [[0, 1], [4, 3], O5, [11, 7], [2, 9]], std: ["M9"], sym: ["△9"], seventh: true, ten: ["#11", "13"] },
  { id: "M13", group: "tension", name: "M13", w: 0.42, tones: [[0, 1], [4, 3], O5, [11, 7], O9, [9, 13]], std: ["M13"], sym: ["△13"], seventh: true, ten: ["#11"] },
  { id: "m9", group: "tension", name: "m9", w: 0.7, tones: [[0, 1], [3, 3], O5, [10, 7], [2, 9]], std: ["m9"], sym: ["-9"], seventh: true, ten: ["11"] },
  { id: "m11", group: "tension", name: "m11", w: 0.525, tones: [[0, 1], [3, 3], O5, [10, 7], O9, [5, 11]], std: ["m11"], sym: ["-11"], seventh: true, ten: [] },
  { id: "dom9", group: "tension", name: "9", w: 0.77, tones: [[0, 1], [4, 3], O5, [10, 7], [2, 9]], std: ["9"], sym: [], seventh: true, ten: ["#11", "b13", "13"], dominant: true },
  { id: "dom13", group: "tension", name: "13", w: 0.7, tones: [[0, 1], [4, 3], O5, [10, 7], O9, [9, 13]], std: ["13"], sym: [], seventh: true, ten: ["b9", "#9", "#11"], dominant: true },
];
const BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));

const accStr = a => ACC[String(a)] ?? (a > 0 ? "♯".repeat(a) : "♭".repeat(-a));
const nameOf = (l, a) => LET[l] + accStr(a);
const pcOf = (l, a) => (((NAT[l] + a) % 12) + 12) % 12;
/** 텐션 id를 화면 글자로: "b9" → "♭9" */
const tenText = id => id.replace("b", "♭").replace("#", "♯");
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
// w(비율)에 따라 하나 고르기
function pickWeighted(arr, rnd) {
  const total = arr.reduce((s, t) => s + (t.w || 1), 0);
  let x = rnd() * total;
  for (const t of arr) { x -= t.w || 1; if (x < 0) return t; }
  return arr[arr.length - 1];
}

/** 근음(root)에서 semi 반음, deg 도수 떨어진 음의 철자. 도수 철자법: 3도는 근음 글자에서 2칸 위 글자 */
function spellTone(root, semi, deg) {
  const l = (root.l + deg - 1) % 7;
  const target = (pcOf(root.l, root.a) + semi) % 12;
  const a = ((target - NAT[l] + 18) % 12) - 6;
  return { l, a, pc: target, name: nameOf(l, a) };
}

/** pc의 가장 쉬운 이름. 검은 건반은 dir > 0이면 ♯, dir < 0이면 ♭ 이름 */
function simpleName(pc, dir) {
  const w = NAT.indexOf(pc);
  if (w >= 0) return LET[w];
  return dir > 0 ? LET[NAT.indexOf(pc - 1)] + "♯" : LET[NAT.indexOf((pc + 1) % 12)] + "♭";
}

// 출제할 근음 건반(pc) 목록: 옵션 B면 고른 것만, 아니면 12개 모두
function rootPool(s) {
  if (s.optB) return s.bases.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  return [...Array(12).keys()];
}

// 옵션 C: 붙일 텐션 고르기 (0~max개). 같은 도수의 텐션은 함께 쓰지 않음(♭9와 ♯9만 예외)
function chooseTensions(type, max, rnd) {
  const w = max >= 2 ? [0.25, 0.4, 0.35] : [0.4, 0.6];   // 텐션 0개/1개/2개가 나올 비율
  let x = rnd(), n = 0;
  while (n < w.length - 1 && x > w[n]) { x -= w[n]; n++; }
  const pool = type.ten.slice();
  const out = [];
  if (!pool.length) return out;
  while (out.length < n && pool.length) {
    const t = pick(pool, rnd);
    pool.splice(pool.indexOf(t), 1);
    const ok = out.every(o => TEN[o][1] !== TEN[t][1] || (new Set([o, t]).has("b9") && new Set([o, t]).has("#9")));
    if (ok) out.push(t);
  }
  return out.sort((a, b) => TEN_ORDER.indexOf(a) - TEN_ORDER.indexOf(b));
}

// 코드 이름 만들기 → { head, items }. head는 "m7" 같은 본체, items는 괄호 안(낮은 것부터)
function makeLabel(type, tens, alt, useSym, rnd) {
  if (alt) return { head: "7alt", items: [] };
  let variants = type.std.concat(useSym ? type.sym : []);
  if (tens.length) variants = variants.filter(v => v !== "ø" && v !== "△");   // 텐션이 붙으면 축약 기호는 쓰지 않음
  const v = pick(variants, rnd);
  const m = v.match(/^(.*)\((.*)\)$/);   // "m7(♭5)" → head "m7", items ["♭5"]
  const head = m ? m[1] : v;
  const items = (m ? m[2].split(",") : []).concat(tens.map(tenText));
  return { head, items };
}

// 근음·코드 종류·텐션으로 구성음 만들기. 악보에서 쓰지 않을 철자가 나오면 null
//   required  반드시 눌러야 하는 음, optional  눌러도 안 눌러도 되는 음, anyOf  이 중 하나 이상(7alt)
//   loose     true면 철자를 따지지 않음 (코드 추론하기에서 사용자가 쓴 답의 구성음을 셀 때 — G♭dim7처럼
//             겹변화표가 여러 개 나오는 이름도 같은 건반이면 정답이라서)
function buildTones(type, root, tens, alt, s, loose = false) {
  const replaces5 = tens.includes("#5") || tens.includes("b5");
  const tenDegs = new Set(tens.map(t => TEN[t][1]));
  const tones = [];
  const required = new Set(), optional = new Set(), anyOf = new Set();
  if (alt) {
    // 7alt: R 3 ♭7 필수, 완전5도는 선택, ♭9 ♯9 ♯11 ♭13 중 하나 이상
    for (const [semi, deg] of [[0, 1], [4, 3], [10, 7]]) {
      const t = spellTone(root, semi, deg); tones.push({ ...t, role: "chord", semi }); required.add(t.pc);
    }
    const p5 = spellTone(root, 7, 5); optional.add(p5.pc);
    for (const id of ALT_SET) {
      const t = spellTone(root, TEN[id][0], TEN[id][1]); tones.push({ ...t, role: "alt", semi: TEN[id][0], ten: id }); anyOf.add(t.pc);
    }
  } else {
    for (const [semi, deg, flag] of type.tones) {
      if (replaces5 && semi === 7 && deg === 5) continue;   // ♯5/♭5가 5음 자리를 대신함: 완전5도는 오답
      if (flag === "opt" && tenDegs.has(deg)) continue;      // 예: C13(♭9)에는 원래 9가 없음
      const t = spellTone(root, semi, deg);
      // 텐션이 붙은 코드는 완전5도를 빼도 정답
      const omittable = flag === "opt" || (tens.length > 0 && semi === 7 && deg === 5);
      tones.push({ ...t, role: omittable ? "optional" : "chord", semi, deg });
      (omittable ? optional : required).add(t.pc);
    }
    for (const id of tens) {
      const t = spellTone(root, TEN[id][0], TEN[id][1]);
      tones.push({ ...t, role: "tension", semi: TEN[id][0], ten: id }); required.add(t.pc);
    }
  }
  // 악보에서 쓰지 않는 철자(3중 변화표, 겹변화표 2개 이상)는 출제하지 않음
  if (!loose && tones.some(t => Math.abs(t.a) > 2)) return null;
  if (!loose && tones.filter(t => Math.abs(t.a) === 2).length >= 2) return null;
  // 보이는 이름: 옵션 E면 원래 철자(C♭ E♯ A𝄫 F𝄪) 그대로, 아니면 쉬운 이름으로 바꿈
  for (const t of tones) {
    const odd = (t.l === 0 || t.l === 3) && t.a === -1 || (t.l === 2 || t.l === 6) && t.a === 1;   // C♭ F♭ E♯ B♯
    if (!s.optE && (Math.abs(t.a) === 2 || odd)) t.name = simpleName(t.pc, t.a);
  }
  return { tones, required, optional, anyOf };
}

// 문제 객체 만들기 (화면·채점·기록이 모두 이 모양을 씀)
function question(type, root, tens, alt, head, items, parts) {
  const rootName = nameOf(root.l, root.a);
  const label = head + (items.length ? "(" + items.join(",") + ")" : "");
  return {
    symbol: rootName + label,   // "C7(♭9)"
    rootName, label, head, items,
    root: { l: root.l, a: root.a }, rootPc: pcOf(root.l, root.a),
    type: type.id, group: type.group, tens, alt,
    ...parts,   // tones, required, optional, anyOf
  };
}

/** 통계에서 쓰는 코드 종류: 코드 종류 id, 단 7alt는 일반 7과 따로 */
const quality = q => (q.alt ? "7alt" : q.type);

/** 틀린 문제를 나중에 똑같이 다시 내기 위해 저장하는 정보 */
const spec = q => ({ l: q.root.l, a: q.root.a, type: q.type, tens: q.tens, alt: q.alt, head: q.head, items: q.items });

/** 저장한 정보(spec)로 문제를 다시 만듦. 정보가 이상하면 null (DB에서 온 값이라 꼼꼼히 확인) */
function rebuild(sp, s) {
  const type = sp && BY_ID[sp.type];
  if (!type || !Number.isInteger(sp.l) || sp.l < 0 || sp.l > 6 || !Number.isInteger(sp.a) || Math.abs(sp.a) > 2) return null;
  const tens = Array.isArray(sp.tens) ? sp.tens : [];
  if (!tens.every(t => t in TEN) || !Array.isArray(sp.items) || typeof sp.head !== "string") return null;
  const alt = !!sp.alt && type.id === "dom7";
  const parts = buildTones(type, { l: sp.l, a: sp.a }, tens, alt, s);
  return parts && question(type, { l: sp.l, a: sp.a }, tens, alt, sp.head, sp.items.map(String), parts);
}

/**
 * 출제 설정 s로 문제 하나 만들기.
 * @param s           출제 설정 (types, optB, bases, optC, cMax, optD, optE, noAlt — 코드 추론하기는 7alt를 내지 않음)
 * @param rnd         난수 함수 (테스트에서 고정값을 넣을 수 있게)
 * @param prev        바로 앞 문제 (문제 객체) — 같은 베이스(건반 기준: C♯과 D♭은 같은 베이스)가 연달아 나오지 않게.
 *                    출제할 베이스가 하나뿐이면(옵션 B로 하나만 고름) 어쩔 수 없이 같은 베이스 (사용자 결정 2026-11-06)
 * @returns 문제 객체, 또는 { error: "noTypes" | "noBases" | "noChord" } (화면이 번역해서 보여줌)
 */
function generate(s, rnd = Math.random, prev = null) {
  const types = TYPES.filter(t => s.types[t.id]);
  if (!types.length) return { error: "noTypes" };
  const all = rootPool(s);
  // 바로 앞 문제의 베이스는 빼고 고름 (고를 베이스가 그것 하나뿐이면 그대로)
  const pcs = prev && all.length > 1 ? all.filter(pc => pc !== prev.rootPc) : all;
  if (!pcs.length) return { error: "noBases" };

  for (let tries = 0; tries < 80; tries++) {
    const type = pickWeighted(types, rnd);
    const pc = pick(pcs, rnd);
    const root = pickWeighted((s.optE ? ROOTS_EXT : ROOTS_DEFAULT)[pc], rnd);

    let tens = [], alt = false;
    if (s.optC && type.seventh) {
      if (type.id === "dom7" && !s.noAlt && rnd() < 0.1) alt = true;   // 도미넌트 7의 약 10%는 7alt (코드 추론하기는 noAlt — 7alt 없음)
      else tens = chooseTensions(type, Math.min(s.cMax, type.maxTen || 9), rnd);
      // 도미넌트 계열: ♭13을 ♯5로, ♯11을 ♭5로 반쯤 바꿔 씀 (♯11과 ♭13이 함께 있으면 그대로)
      if (type.dominant && !alt) {
        const swaps = [["b13", "#5"], ["#11", "b5"]].filter(([a]) => tens.includes(a));
        if (swaps.length === 1 && rnd() < 0.5) {
          const [from, to] = pick(swaps, rnd);
          tens = tens.map(t => (t === from ? to : t));
        }
        tens.sort((a, b) => TEN_ORDER.indexOf(a) - TEN_ORDER.indexOf(b));
      }
    }
    const parts = buildTones(type, root, tens, alt, s);
    if (!parts) continue;   // 쓰지 않는 철자 → 다시 뽑기
    const { head, items } = makeLabel(type, tens, alt, s.optD, rnd);
    const q = question(type, root, tens, alt, head, items, parts);
    return q;
  }
  // 앞 문제의 베이스를 뺀 나머지로는 만들 수 없었음(아주 드묾) → 그 베이스도 포함해서 다시
  if (pcs !== all) return generate(s, rnd, null);
  return { error: "noChord" };
}

/**
 * 채점. 피치클래스(pc) 집합으로 비교하므로 자리바꿈·옥타브·중복음은 상관없어요.
 * @param selected  누른 건반의 MIDI 번호들
 * @returns { correct, extra(필요 없는 음 수), missing(빠진 음 수), anyOk(7alt 조건 충족) }
 */
function grade(selected, q) {
  const sel = new Set([...selected].map(m => ((m % 12) + 12) % 12));
  let extra = 0, missing = 0;
  for (const pc of sel) if (!q.required.has(pc) && !q.optional.has(pc) && !q.anyOf.has(pc)) extra++;
  for (const pc of q.required) if (!sel.has(pc)) missing++;
  const anyOk = q.anyOf.size === 0 || [...q.anyOf].some(pc => sel.has(pc));
  if (!anyOk) missing++;
  return { correct: sel.size > 0 && extra === 0 && missing === 0, extra, missing, anyOk };
}

/** 정답 확인 때 들려주고 초록 점으로 보여줄 보이싱 (MIDI 48~72 안) */
function voicing(q) {
  const root = 48 + q.rootPc;
  const out = [];
  for (const t of q.tones) {
    if (t.role === "alt" && !(t.ten === "#9" || t.ten === "b13")) continue;   // 7alt는 ♯9·♭13으로 들려줌
    let m = root + t.semi;
    const deg = t.ten ? TEN[t.ten][1] : t.deg;
    if (deg >= 9) { m = root + 12 + t.semi; if (m > 72) m -= 12; }   // 텐션은 한 옥타브 위
    out.push(m);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * 철자를 따지지 않고 구성음 만들기 (코드 추론하기에서 사용자가 쓴 답을 판정할 때).
 * @returns { tones, required, optional, anyOf } — 7alt는 없음
 */
const tonesFor = (typeId, root, tens) => buildTones(BY_ID[typeId], root, tens, false, { optE: true }, true);

export const Engine = { TYPES, BY_ID, PC_NAMES, TEN, TEN_ORDER, WHITE, NAT, LET, generate, rebuild, spec, quality, grade, voicing, tenText, spellTone, simpleName, tonesFor, pcOf };
export default Engine;
