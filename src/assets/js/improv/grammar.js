// ===== 코드 초견 — 8마디 코드진행 문법 (난이도 0~3, 순수 함수, tests/improv.test.js) =====
// 규칙 초안: docs/chord-progression-rules.md (사용자 검토 2026-11-11). 요약은 chordoven-spec.md "코드 초견".
//
// 만드는 방법 (규칙 기반 확률):
//   1) 조(키)를 고르고, 그 난이도에서 쓸 수 있는 코드를 "역할"(로마숫자)로 펼침 — 다이아토닉, (난이도 2) 세컨더리 도미넌트·II-minor, (3) 디미니시드
//      난이도 (2026-11-12 사용자 결정): 0 다이아토닉만·분수코드 없음·V7sus4 없음 / 1 + V7sus4·분수코드 / 2 + 세컨더리·II-minor, add 코드 없음 /
//      3 + dim7(단조 VII°7 포함). 3의 나머지(SubV7 등)와 4~6은 아직 — 지금은 3과 같음
//   2) 1마디 첫 코드부터 한 자리씩: 다음 후보마다 점수 = 기능 화성 점수 × 박 위치 × 그 밖의 규칙, 점수를 "온도"로 확률로 바꿔 하나 고름
//   3) 코드 개연성(1~3)에 따라 대중적 패턴을 통째로 끼워 넣음
//   4) 다 만든 뒤 조건 검사(II-V 횟수, 토닉, 반복, 종지 …) — 안 맞으면 처음부터 다시(최대 RETRIES번, 그래도 안 되면 어긴 것이 가장 적은 것)
// 코드 이름은 엔진(core/engine.js rebuild)으로 만들어서 철자·구성음 규칙이 다른 연습과 같음. 기호 표기·긴 코드 자리 등은 progression.js가 이어서 처리.
import { Engine } from "../core/engine.js";

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const RETRIES = 60;

// ---------- 조 ----------
// 자주 쓰는 조일수록 자주 (G♭장조·E♭단조는 C♭이 나오는 조라 아주 드물게 — 사용자 결정 "C♭은 아주 드물게")
const MAJOR_KEYS = [["C", 10], ["G", 9], ["F", 9], ["D", 8], ["B♭", 8], ["E♭", 7], ["A", 7], ["E", 5], ["A♭", 5], ["D♭", 3], ["B", 2], ["G♭", 1]];
const MINOR_KEYS = [["A", 10], ["E", 9], ["D", 9], ["G", 8], ["C", 8], ["B", 6], ["F♯", 5], ["F", 5], ["C♯", 4], ["B♭", 2], ["G♯", 2], ["E♭", 1]];
const parseName = n => ({ l: "CDEFGAB".indexOf(n[0]), a: n.includes("♯") ? 1 : n.includes("♭") ? -1 : 0 });

/** 철자 정리: 겹변화표와 E♯·B♯·F♭은 쉬운 이름으로, C♭은 그대로(아주 드문 조에서만 나옴) — 사용자 결정 2026-11-11 */
function tidy(t) {
  const odd = (t.l === 2 || t.l === 6) && t.a === 1 || t.l === 3 && t.a === -1;   // E♯ B♯ F♭
  if (Math.abs(t.a) < 2 && !odd) return t;
  const name = Engine.simpleName(t.pc, t.a);
  return { ...parseName(name), pc: t.pc, name };
}
const spell = (root, semi, deg) => tidy(Engine.spellTone(root, ((semi % 12) + 12) % 12, deg));

// ---------- 역할 (로마숫자) ----------
// 역할: { id, root {l,a,pc,name}, types [[코드 종류 id, 비율]…], kind, fn, target(해결할 근음 pc), targetMinor, sus }
//   kind  "dia" 다이아토닉 | "sec" 세컨더리 도미넌트 | "ii" II-minor | "dim" 디미니시드(asc·desc·aux)
//   fn    "T" 토닉 | "S" 서브도미넌트 | "D" 도미넌트
// 코드 종류 비율: 7화음 위주, 6화음·add·3화음은 조금 (8마디 모드 목표 비율 — progression.js PROG_WEIGHTS와 같은 생각)
const T_MAJ = [["M7", 0.78], ["6", 0.14], ["add9", 0.04], ["maj", 0.04]];
const T_MIN = [["m7", 0.94], ["min", 0.06]];
const DIA_MAJOR = [
  ["I", 1, 0, T_MAJ, "T"], ["II", 2, 0, T_MIN, "S"], ["III", 3, 0, T_MIN, "T"], ["IV", 4, 0, T_MAJ, "S"],
  ["V", 5, 0, [["dom7", 1]], "D"], ["Vsus", 5, 0, [["7sus4", 1]], "D"], ["VI", 6, 0, [["m7", 0.9], ["madd9", 0.04], ["min", 0.06]], "T"],
];
// 단조: 자연단음계 + V7 · VII°7 (사용자 결정 1), Vm7은 쓰지 않음. ♭VII7은 ♭III로 가는 도미넌트처럼
const DIA_MINOR = [
  ["i", 1, 0, [["m7", 0.7], ["m6", 0.2], ["madd9", 0.05], ["min", 0.05]], "T"], ["ii", 2, 0, [["m7b5", 1]], "S"],
  ["bIII", 3, 0, [["M7", 0.85], ["6", 0.1], ["maj", 0.05]], "T"], ["iv", 4, 0, [["m7", 0.7], ["m6", 0.25], ["min", 0.05]], "S"],
  ["V", 5, 0, [["dom7", 1]], "D"], ["Vsus", 5, 0, [["7sus4", 1]], "D"], ["bVI", 6, 0, [["M7", 0.85], ["6", 0.1], ["maj", 0.05]], "S"],
  ["bVII", 7, 0, [["dom7", 1]], "D"], ["viio", 7, 1, [["dim7", 1]], "D"],
];

// 다이아토닉끼리의 기능 화성 점수 (행 = 지금, 열 = 다음 — docs §2). Vsus는 V와 같은 줄·칸
const TABLE_MAJOR = {
  I: { II: 5, III: 3, IV: 7, V: 6, VI: 7 },
  II: { I: 2, III: 2, IV: 3, V: 10, VI: 2 },
  III: { I: 2, II: 2, IV: 5, V: 2, VI: 9 },
  IV: { I: 5, II: 3, III: 4, V: 8, VI: 3 },
  V: { I: 10, II: 1, III: 2, IV: 3, VI: 6 },
  VI: { I: 2, II: 8, III: 2, IV: 7, V: 4 },
};
const TABLE_MINOR = {
  i: { ii: 4, bIII: 5, iv: 7, V: 6, bVI: 6, bVII: 4, viio: 2 },
  ii: { i: 2, bIII: 1, iv: 2, V: 10, bVI: 1, bVII: 1, viio: 2 },
  bIII: { i: 3, ii: 2, iv: 5, V: 2, bVI: 6, bVII: 3, viio: 1 },
  iv: { i: 4, ii: 3, bIII: 2, V: 7, bVI: 3, bVII: 7, viio: 3 },
  V: { i: 10, bIII: 1, iv: 1, bVI: 6, viio: 2 },
  bVI: { i: 3, ii: 5, bIII: 2, iv: 3, V: 6, bVII: 6, viio: 2 },
  bVII: { i: 3, ii: 1, bIII: 9, iv: 1, V: 1, bVI: 2 },
  viio: { i: 9, bIII: 1, V: 2, bVI: 1 },
};
const baseId = id => (id === "Vsus" ? "V" : id);

/** add 코드는 난이도 0·1에서만 (사용자 결정 2026-11-12) — 2부터는 목록에서 빼고 나머지 비율로 */
const withoutAdd = types => types.filter(t => !/add/.test(t[0]));

/** 조 하나의 역할 목록 (난이도 0~3) */
export function buildRoles(key, level) {
  const sc = key.minor ? MINOR : MAJOR;
  const tonic = { l: key.l, a: key.a };
  const roles = [];
  for (let [id, deg, alt, types, fn] of key.minor ? DIA_MINOR : DIA_MAJOR) {
    if (id === "Vsus" && level < 1) continue;   // V7sus4는 난이도 1부터
    if (id === "viio" && level < 3) continue;   // dim7은 난이도 3부터 (단조 VII°7도)
    if (level >= 2) types = withoutAdd(types);
    roles.push({ id, root: spell(tonic, sc[deg - 1] + alt, deg), types, kind: "dia", fn, sus: id === "Vsus" });
  }
  const byId = Object.fromEntries(roles.map(r => [r.id, r]));
  // 도미넌트가 해결할 곳 (다이아토닉 V → I, Vsus → I, ♭VII7 → ♭III, VII°7 → i)
  const tonicId = key.minor ? "i" : "I";
  for (const r of roles) if (r.fn === "D") r.target = (r.id === "bVII" ? byId.bIII : byId[tonicId]).root.pc;
  for (const r of roles) if (r.fn === "D") r.targetMinor = key.minor && r.id !== "bVII";
  if (level < 2) return roles;

  // 세컨더리 도미넌트 5개 (장조 →II III IV V VI, 단조 →♭III iv V ♭VI ♭VII)
  const targets = key.minor ? ["bIII", "iv", "V", "bVI", "bVII"] : ["II", "III", "IV", "V", "VI"];
  const minorish = t => ["II", "III", "VI", "iv"].includes(t);
  for (const t of targets) {
    const tr = byId[t].root;
    roles.push({ id: "V/" + t, root: spell(tr, 7, 5), types: [["dom7", 1]], kind: "sec", fn: "D", target: tr.pc, targetMinor: minorish(t) });
  }
  // II-minor: 각 도미넌트(다이아토닉 V·세컨더리)의 완전5도 위. 해결 대상이 마이너면 m7(♭5) 70%, 아니면 m7 90% (사용자 결정)
  // 다이아토닉 코드와 같은 근음·같은 종류면 따로 만들지 않음(그 다이아토닉 코드가 II 역할을 함)
  for (const d of roles.filter(r => r.fn === "D" && !r.sus && (r.kind === "sec" || r.id === "V"))) {
    const root = spell(d.root, 7, 5);
    const types = d.targetMinor ? [["m7b5", 0.7], ["m7", 0.3]] : [["m7", 0.9], ["m7b5", 0.1]];
    const dup = roles.find(r => r.kind === "dia" && r.root.pc === root.pc && r.types[0][0] === types[0][0]);
    if (dup) { (dup.iiOf = dup.iiOf || []).push(d.id); continue; }
    roles.push({ id: "ii/" + d.id, root, types, kind: "ii", fn: "S", dominant: d.id });
  }
  if (level < 3) return roles;
  // 디미니시드 (사용자 결정 Q1 — 난이도 2부터였다가 2026-11-12 사용자 결정으로 3부터): 어센딩 = 목표의 반음 아래, 디센딩 = 목표의 반음 위, 어그질러리 = I°7·V°7
  const dimTargets = key.minor ? ["ii", "bIII", "iv", "V", "bVI", "bVII"] : ["II", "III", "IV", "V", "VI"];
  for (const t of dimTargets) {
    const tr = byId[t].root;
    const up = spell(tr, 11, 7);   // 반음 아래 (다음 글자 아래: D → C♯)
    if (!roles.some(r => r.root.pc === up.pc && r.types[0][0] === "dim7")) roles.push({ id: "asc/" + t, root: up, types: [["dim7", 1]], kind: "dim", fn: "D", target: tr.pc, dimKind: "asc" });
    roles.push({ id: "desc/" + t, root: spell(tr, 1, 2), types: [["dim7", 1]], kind: "dim", fn: "D", target: tr.pc, dimKind: "desc" });
  }
  roles.push({ id: "aux/I", root: byId[tonicId].root, types: [["dim7", 1]], kind: "dim", fn: "T", target: byId[tonicId].root.pc, dimKind: "aux" });
  roles.push({ id: "aux/V", root: byId.V.root, types: [["dim7", 1]], kind: "dim", fn: "D", target: byId.V.root.pc, dimKind: "aux" });
  return roles;
}

// ---------- 점수 ----------
const isDominant = r => r.fn === "D" && r.kind !== "dim" && !(r.kind === "dia" && r.id === "viio");
const iv = (a, b) => (((b - a) % 12) + 12) % 12;   // a에서 b까지 위로 반음 수

/**
 * 도미넌트 7 다음의 위종지 점수 (도미넌트 근음 기준 위로 잰 간격 → 점수, 사용자 결정 2026-11-11, G7 기준):
 * Am7 +2 m7 6 · Em7 +9 m7 5 · A♭M7 +1 M7 4 · A7 +2 7 3 · E♭M7 +8 M7 2 · FM7 +10 M7 1.5 · D♭M7 +6 M7 1 · B♭M7 +3 M7 1
 * 난이도 1·2에서는 그 조에 있는 코드만 후보가 되므로 모달(A♭M7 등)은 자연히 빠짐
 */
const DECEPTIVE = [[2, "m", 6], [9, "m", 5], [1, "M", 4], [2, "7", 3], [8, "M", 2], [10, "M", 1.5], [6, "M", 1], [3, "M", 1]];
const MINORISH = ["min", "m7", "m6", "madd9", "m7b5", "mM7", "m9", "m11", "m69"];
const quality = typeId => (MINORISH.includes(typeId) ? "m" : ["dom7", "7sus4", "dom9", "dom13"].includes(typeId) ? "7" : "M");

/**
 * 지금 역할 a 다음에 역할 b가 올 점수 (박 위치·개연성 보정 전).
 * 도미넌트: 해결 65 · 위종지 15 · 지연 해결 8 · 새 II-V의 II 5 · 그 밖 4 (사용자 결정, docs §4) — 후보 수에 상관없이 이 몫을 나눠 줌
 */
function transition(a, b, roles, ctx) {
  if (a === b) return 0;
  const base = ctx.table;
  // 디미니시드 다음: 목표로 85 · 공통음 3개 도미넌트(근음 -4·-1·+2·+5) 10 · 다른 디미니시드 5
  if (a.kind === "dim") {
    if (a.dimKind === "aux") return b.root.pc === a.root.pc && b.kind === "dia" ? 90 : 1;
    if (b.root.pc === a.target && b.kind === "dia") return 85;
    if (isDominant(b) && [8, 11, 2, 5].includes(iv(a.root.pc, b.root.pc))) return 10;
    if (b.kind === "dim") return 2;
    return 0.5;
  }
  // II-minor 다음: 자기 도미넌트 85
  if (a.kind === "ii" || a.iiOf) {
    const dom = a.kind === "ii" ? [a.dominant] : a.iiOf;
    if (dom.includes(b.id)) return a.kind === "ii" ? 85 : Math.max(base[baseId(a.id)]?.[baseId(b.id)] || 0, 10) * 1.5;
    if (a.kind === "ii") return 2;
  }
  // 도미넌트 다음
  if (isDominant(a)) {
    if (a.sus && b.id === "V" && b.root.pc === a.root.pc) return ctx.chance === 1 ? 40 : 6;   // V7sus4 → V7 (개연성 1이면 V7·I만)
    if (a.sus && ctx.chance === 1 && b.root.pc !== a.target) return 0.2;
    if (b.root.pc === a.target && !b.sus && b.kind !== "dim") return 65 / ctx.count(r => r.root.pc === a.target && !r.sus && r.kind !== "dim");
    const dec = DECEPTIVE.find(([gap, q]) => gap === iv(a.root.pc, b.root.pc) && q === quality(b.types[0][0]) && b.kind !== "dim");
    if (dec) return 15 * dec[2] / 6;
    if (b.kind === "ii" || b.iiOf) return 5 / 3;
    if (b.kind === "dia" && b.fn !== "D") return 8 / 4;   // 지연 해결 몫 (다음에 원래 목표가 오도록 ctx.pending)
    return 4 / 6;
  }
  // 그 밖(토닉·서브도미넌트) 다음
  if (b.kind === "dia") return base[baseId(a.id)]?.[baseId(b.id)] ?? 1;
  if (b.kind === "sec") return 1.6;
  if (b.kind === "ii") return 1.2;
  if (b.kind === "dim") {
    if (b.dimKind === "aux") return b.root.pc === a.root.pc ? 1.5 : 0;
    const t = roles.find(r => r.root.pc === b.target && r.kind === "dia");
    return t ? 0.25 * (base[baseId(a.id)]?.[baseId(t.id)] ?? 1) : 0;
  }
  return 1;
}

// ---------- 패턴 (대중적 진행 — 개연성 1·2에서 통째로) ----------
// 항목: 역할 id, 또는 [역할 id, 코드 종류(없으면 보통대로), 베이스("3"·"5"·"b7"·"7"·"6", 분수코드 허용일 때만)]
const PATTERNS = {
  major: [
    { name: "1-5-6-4", seq: ["I", "V", "VI", "IV"] },
    { name: "6-4-1-5", seq: ["VI", "IV", "I", "V"] },
    { name: "1-6-4-5", seq: ["I", "VI", "IV", "V"] },
    { name: "1-6-2-5", seq: ["I", "VI", "II", "V"] },
    { name: "4-5-3-6", seq: ["IV", "V", "III", "VI"] },
    { name: "2-5-1", seq: ["II", "V", "I"] },
    { name: "3-6-2-5", seq: ["III", "VI", "II", "V"] },
    { name: "4-5-6", seq: ["IV", "V", "VI"] },
    { name: "canon", seq: ["I", ["V", null, "3"], "VI", ["III", null, "5"], "IV", ["I", null, "3"], "IV", "V"] },
    { name: "desc-bass", seq: ["I", ["V", null, "3"], "VI", ["I", null, "5"], "IV", ["I", null, "3"], "II", "V"] },
    { name: "sec-chain", seq: ["I", "V/VI", "VI", "V/V", "V"], level: 2 },
  ],
  minor: [
    { name: "andalusian", seq: ["i", "bVII", "bVI", "V"] },
    { name: "minor-2-5-1", seq: ["ii", "V", "i"] },
    { name: "6-7-1", seq: ["bVI", "bVII", "i"] },
    { name: "4-5-1", seq: ["iv", "V", "i"] },
    // 하행 클리셰 (ImM7은 이 용법으로만 — 사용자 결정)
    { name: "cliche-bass", seq: [["i", "min"], ["i", "mM7", "7"], ["i", "m7", "b7"], ["i", "m6", "6"]] },
    { name: "cliche-top", seq: [["i", "min"], ["i", "mM7"], ["i", "m7"], ["i", "m6"]] },
  ],
};
const PATTERN_ODDS = { 1: 0.7, 2: 0.4, 3: 0.15 };   // 개연성별로 패턴을 통째로 쓸 확률 (docs §5)
const TEMPERATURE = { 1: 0.6, 2: 0.9, 3: 1.3 };

// ---------- 코드 만들기 ----------
const pickBy = (list, w, rnd) => { let x = rnd() * list.reduce((s, e) => s + w(e), 0); for (const e of list) { x -= w(e); if (x < 0) return e; } return list[list.length - 1]; };
const BASS = { "3": null, "5": [7, 5], b7: [10, 7], "7": [11, 7], "6": [9, 6] };
// 전위형을 시도할 비율 — 앞 베이스와 순차(반음·온음)로 이어지는 전위가 있을 때만 실제로 붙음.
// 분수코드를 켰을 때 전체의 약 18%가 되게 맞춤 (사용자 결정 2026-11-10 "분수코드 18%", 측정은 tests/improv.test.js)
const INV_TRY = 0.8;

/**
 * 역할 + 코드 종류 → 엔진 코드 (q). 텐션은 출제 설정의 텐션 옵션대로, 베이스("3" 등)가 있으면 분수코드.
 * @returns q 또는 null(엔진이 쓰지 않는 철자)
 */
function makeChord(role, typeId, bass, o, rnd) {
  let type = Engine.BY_ID[typeId];
  let tens = [], alt = false;
  // 텐션 (7화음만): 끔 0 / 최대 1개 / 최대 2개·HARD. 마이너로 해결하는 도미넌트는 ♭9·♯9·♭13, 메이저로 해결하면 9·13·♯11·♭9
  if (o.tension !== "off" && type.seventh && !role.sus && typeId !== "dim7" && typeId !== "mM7") {
    if (typeId === "dom7" && rnd() < 0.1) alt = true;
    else {
      let pool = type.ten.slice();
      if (typeId === "dom7") pool = pool.filter(t => (role.targetMinor ? ["b9", "#9", "b13"] : ["9", "13", "#11", "b9"]).includes(t));
      const max = Math.min(o.tension === "1" ? 1 : 2, type.maxTen || 9);
      const w = max >= 2 ? [0.25, 0.4, 0.35] : [0.4, 0.6];
      let n = 0, x = rnd(); while (n < w.length - 1 && x > w[n]) { x -= w[n]; n++; }
      while (tens.length < n && pool.length) {
        const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        if (tens.every(u => Engine.TEN[u][1] !== Engine.TEN[t][1])) tens.push(t);
      }
      tens.sort((p, q) => Engine.TEN_ORDER.indexOf(p) - Engine.TEN_ORDER.indexOf(q));
      // HARD: 9·13·11을 텐션 코드 이름으로 (M7+9 → M9, 7+13 → 13, m7+11 → m11 …), 텐션 코드는 추가 텐션 1개까지 (사용자 결정)
      if (o.tension === "hard" && rnd() < 0.5) {
        const conv = { M7: [["13", "M13"], ["9", "M9"]], m7: [["11", "m11"], ["9", "m9"]], dom7: [["13", "dom13"], ["9", "dom9"]] }[typeId] || [];
        const hit = conv.find(([t]) => tens.includes(t));
        if (hit) { type = Engine.BY_ID[hit[1]]; tens = tens.filter(t => t !== hit[0] && (hit[0] !== "13" || t !== "9")).slice(0, 1); }
      }
    }
  }
  const m = type.std[0].match(/^(.*)\((.*)\)$/);
  const head = alt ? "7alt" : m ? m[1] : type.std[0];
  const items = alt ? [] : (m ? m[2].split(",") : []).concat(tens.map(Engine.tenText));
  const q = Engine.rebuild({ l: role.root.l, a: role.root.a, type: type.id, tens, alt, head, items }, { optE: true });
  if (!q) return null;
  q.rootName = role.root.name; q.symbol = q.rootName + q.label;   // 철자 정리(tidy)한 근음 이름으로
  q.bassPc = q.rootPc;
  if (bass && o.slash) {
    const third = MINORISH.includes(type.id) || type.id === "dim7" ? 3 : 4;
    const [semi, deg] = bass === "3" ? [third, 3] : BASS[bass];
    const b = spell(role.root, semi, deg);
    Object.assign(q, { bass: b.name, bassPc: b.pc, slash: "inv", symbol: q.symbol + "/" + b.name });
  }
  return q;
}

/** 베이스 진행 점수: 순차(반음·온음) ×1.4, 같은 음 ×1.2, 완전5도 하행 ×1.2 (docs §3) */
const bassFactor = (from, to) => { const d = Math.min(iv(from, to), iv(to, from)); return d === 1 || d === 2 ? 1.4 : d === 0 ? 1.2 : iv(from, to) === 5 ? 1.2 : 1; };

/**
 * 역할을 코드로: 코드 종류를 비율대로, 분수코드 허용이면 베이스를 앞 베이스와 매끄럽게 잇는 전위형을 가끔
 * (사용자 결정 Q6 — 분수코드는 난이도 1부터 베이스 진행용. V7sus4는 하이브리드 IV/V · IIm7/V로도)
 */
function realize(role, prevBass, o, rnd, forced) {
  const typeId = forced?.type || pickBy(role.types, t => t[1], rnd)[0];
  let bass = forced?.bass || null;
  if (!forced && o.slash && prevBass != null && rnd() < INV_TRY) {
    // sus 코드는 3음이 없으니 5음 베이스만 (G7sus4/D)
    const opts = (typeId === "dim7" || role.kind === "dim") ? [] : /sus/.test(typeId) ? ["5"] : ["3", "5"];
    const cands = opts.map(b => {
      const third = MINORISH.includes(typeId) ? 3 : 4;
      const pc = (role.root.pc + (b === "3" ? third : 7)) % 12;
      return [b, bassFactor(prevBass, pc) > 1.3 ? 1 : 0.05];
    });
    const keep = [null, 1];
    const ch = pickBy([keep, ...cands], c => c[1], rnd);
    bass = ch[0];
  }
  // V7sus4의 하이브리드 표기: IV/V(F/G) · IIm7/V(Dm7/G) — 분수코드 허용일 때 40%
  if (role.sus && o.slash && !forced && rnd() < 0.4) {
    const hybrid = rnd() < 0.6 ? { root: spell(role.root, 10, 7), type: "maj" } : { root: spell(role.root, 7, 5), type: "m7" };
    const q = makeChord({ ...role, root: hybrid.root, sus: false }, hybrid.type, null, { ...o, tension: "off" }, rnd);
    if (q) return Object.assign(q, { bass: role.root.name, bassPc: role.root.pc, slash: "hybrid", symbol: q.symbol + "/" + role.root.name });
  }
  return makeChord(role, typeId, bass, o, rnd);
}

/** 개연성 3의 "뜬금없는" 코드: 아무 근음의 dim7(어센딩처럼) 또는 도미넌트 7(완전5도 아래로 가려 함) */
function surprise(rnd, level) {
  const r0 = Math.floor(rnd() * 12);
  const root = tidy(Engine.spellTone({ l: 0, a: 0 }, r0, [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7][r0]));   // C D♭ D E♭ E F G♭ G A♭ A B♭ B
  return level >= 3 && rnd() < 0.5   // dim7은 난이도 3부터
    ? { id: "surprise", root, types: [["dim7", 1]], kind: "surprise", fn: "D", target: (r0 + 1) % 12, dimKind: "asc" }
    : { id: "surprise", root, types: [["dom7", 1]], kind: "surprise", fn: "D", target: (r0 + 5) % 12 };
}

// ---------- 박 위치 ----------
/** 마디 안 자리의 강약 (사용자 결정): 2+2 강약 · 2+1+1 강강약 · 1+1+2 강약강 · 1+1+1+1 강약강약 · 3+1·1+3 강약. 한 마디 하나면 짝수 마디가 약 */
export function strong(lens, i, bar) {
  if (lens.length === 1) return bar % 2 === 0;
  const k = lens.join("+");
  if (k === "2+1+1") return i < 2;
  if (k === "1+1+2") return i !== 1;
  return i % 2 === 0;
}

// ---------- 한 진행 만들기 ----------
/**
 * 난이도 1·2 코드진행.
 * @param o       { tension, slash, level(0~3), chance(1~3) }
 * @param slots   [[{ len, start, strong, longOk }] × 8] — 마디 나누기(progression.js가 정함)
 * @param rnd     난수
 * @param fits    (q, slot) => boolean — 그 자리에 그 코드를 써도 되는지(긴 코드 자리 규칙 등, progression.js가 줌)
 * @returns { key, chords: [[q × 마디의 자리 수] × 8], violations }
 */
export function generateGrammar(o, slots, rnd, fits = () => true) {
  let best = null;
  for (let t = 0; t < RETRIES; t++) {
    const r = attempt(o, slots, rnd, fits);
    if (!best || r.violations.length < best.violations.length) best = r;
    if (!r.violations.length) break;
  }
  return best;
}

/**
 * 코드 개연성 4 — 완전 무작위 (비추천, 사용자 결정 Q7): 그 난이도의 코드 목록 안에서 같은 비율로 아무거나. 진행 규칙 없음.
 * 바로 앞과 같은 맨 아래 음만 피하고, 긴 코드 자리(fits)는 지킴. 인자와 돌려주는 값은 generateGrammar와 같음
 */
export function generateRandom(o, slots, rnd, fits = () => true) {
  const key = chooseKey(rnd);
  const roles = buildRoles(key, o.level);
  const chords = [];
  let prevBass = null;
  for (const bar of slots) {
    const out = [];
    for (const slot of bar) {
      let q = null;
      for (let k = 0; k < 40 && !q; k++) {
        // 종류별 비율: 디미니시드는 역할 수가 많아서 하나하나를 낮게(전체에서 가끔만) — 다이아토닉·세컨더리 1, II-minor 0.7, 디미니시드 0.25
        const role = pickBy(roles, r => ({ dia: 1, sec: 1, ii: 0.7, dim: 0.25 })[r.kind] || 1, rnd);
        const c = realize(role, prevBass, k < 30 ? o : { ...o, tension: "off", slash: false }, rnd);
        if (c && c.bassPc !== prevBass && fits(c, slot, out)) q = Object.assign(c, { role: role.id, kind: role.kind, fn: role.fn, pattern: null });
      }
      q = q || Object.assign(makeChord(roles[0], key.minor ? "min" : "maj", null, { ...o, tension: "off" }, rnd), { role: roles[0].id, kind: "dia", fn: "T", pattern: null });
      out.push(q); prevBass = q.bassPc;
    }
    chords.push(out);
  }
  return { key, chords, violations: [] };
}

function chooseKey(rnd) {
  const minor = rnd() < 0.5;   // 장·단조 반반 (사용자 결정 19)
  const [name] = pickBy(minor ? MINOR_KEYS : MAJOR_KEYS, k => k[1], rnd);
  return { ...parseName(name), minor, name: name + (minor ? "m" : "") };
}

function attempt(o, slots, rnd, fits) {
  const key = chooseKey(rnd);
  const roles = buildRoles(key, o.level);
  const byId = Object.fromEntries(roles.map(r => [r.id, r]));
  const ctx = { table: key.minor ? TABLE_MINOR : TABLE_MAJOR, chance: o.chance, count: f => roles.filter(f).length || 1 };
  const T = TEMPERATURE[o.chance] || 1;
  const flat = slots.flatMap((bar, b) => bar.map((s, i) => ({ ...s, bar: b, idx: i })));
  const out = flat.map(() => null);
  const used = [];   // 쓴 패턴 이름

  // 패턴 끼워 넣기: 1마디(그리고 개연성 1·2면 5마디)에서 확률로
  const patOdds = PATTERN_ODDS[o.chance] || 0;
  const pats = (key.minor ? PATTERNS.minor : PATTERNS.major).filter(p => (p.level || 0) <= o.level);
  for (const startBar of [0, 4]) {
    if (rnd() >= patOdds) continue;
    const start = flat.findIndex(s => s.bar === startBar);
    const pool = pats.filter(p => o.chance === 1 || !used.includes(p.name)).filter(p => start + p.seq.length <= flat.length && p.seq.every((_, j) => !out[start + j]));
    if (!pool.length) continue;
    const p = pool[Math.floor(rnd() * pool.length)];
    used.push(p.name);
    p.seq.forEach((it, j) => { out[start + j] = { pattern: p.name, item: Array.isArray(it) ? it : [it] }; });
  }

  // 한 자리씩
  const chords = [];
  let prev = null, prevBass = null, pending = null;
  const barOf = n => chords.filter((_, i) => flat[i].bar === flat[n].bar);   // 이 마디에서 이미 고른 코드들
  for (let n = 0; n < flat.length; n++) {
    const slot = flat[n];
    let forced = null, cand;
    if (out[n] && byId[out[n].item[0]]) {
      // 패턴 자리: 정해진 역할 (코드 종류·베이스가 정해져 있으면 그대로)
      const [id, type, bass] = out[n].item;
      const role = byId[id];
      if (type || bass) forced = { type: type || pickBy(role.types, t => t[1], rnd)[0], bass: bass && o.slash ? bass : null };
      cand = [[role, 1]];
    } else if (!prev) {
      // 첫 코드: 토닉 60 · II(ii) 15 · IV(iv) 15 · VI(♭VI) 10 (docs §7)
      const firsts = key.minor ? [["i", 60], ["ii", 15], ["iv", 15], ["bVI", 10]] : [["I", 60], ["II", 15], ["IV", 15], ["VI", 10]];
      cand = firsts.map(([id, w]) => [byId[id], w]);
    } else {
      // 온도는 화성 점수에만 — 박 위치(도미넌트 약박 80%)는 온도와 상관없이 같은 힘으로 (개연성이 낮아도 박 규칙은 지킴)
      cand = roles.map(r => [r, score(r, slot, n)]).filter(c => c[1] > 0).map(([r, s]) => [r, Math.pow(s, 1 / T) * beat(r, slot)]);
    }
    // 개연성 3: 코드마다 10%로 "뜬금없는" 디미니시드(난이도 3부터)·도미넌트 7 (사용자 결정). 난이도 0은 다이아토닉만이라 없음
    if (o.chance === 3 && o.level > 0 && !out[n] && prev && rnd() < 0.1) cand = [[surprise(rnd, o.level), 1]];

    // 역할을 고르고 코드로 — 그 자리에 맞지 않으면(긴 코드 자리 등) 텐션·분수코드를 빼 보고, 그래도 안 되면 다른 역할로
    let role = null, q = null;
    for (let k = 0; k < 8 && !q && cand.length; k++) {
      role = pickBy(cand, c => c[1], rnd)[0];
      for (const opt of [o, o, { ...o, tension: "off" }, { ...o, tension: "off", slash: false }]) {
        const c = realize(role, prevBass, opt, rnd, forced && opt.slash === false ? { ...forced, bass: null } : forced);
        if (c && fits(c, slot, barOf(n))) { q = c; break; }
      }
      if (!q) cand = cand.filter(c => c[0] !== role);
    }
    if (!q) {   // 마지막 수단: 이 조의 토닉 3화음 (짧아서 어디든 맞음)
      role = byId[key.minor ? "i" : "I"];
      q = makeChord(role, key.minor ? "min" : "maj", null, { ...o, tension: "off" }, rnd);
    }
    Object.assign(q, { role: role.id, kind: role.kind, fn: role.fn, pattern: out[n]?.pattern || null });
    chords.push(q);
    // 지연 해결 기억: 도미넌트 다음에 해결이 아닌 다이아토닉이 왔으면 다음 2코드 안에 원래 목표가 오도록 점수를 올림
    if (prev && isDominant(prev) && role.root.pc !== prev.target && role.kind === "dia" && role.fn !== "D") pending = { pc: prev.target, left: 2 };
    else if (pending && (role.root.pc === pending.pc || --pending.left <= 0)) pending = null;
    prev = role; prevBass = q.bassPc;
  }

  /** 박 위치 점수: 도미넌트 7은 강박에서 ×0.12 (약박 80% 목표 — 측정해서 맞춘 값), 디미니시드는 ×0.5 */
  function beat(r, slot) {
    if (!slot.strong) return 1;
    return isDominant(r) ? 0.12 : r.kind === "dim" ? 0.5 : 1;
  }

  /** 다음 역할 r의 점수 (지금 = prev) — 기능 화성 × 개연성 1의 악절·종지 규칙 (박 위치는 beat) */
  function score(r, slot, n) {
    let s = transition(prev, r, roles, ctx);
    if (s <= 0) return 0;
    if (pending && r.root.pc === pending.pc) s *= 5;
    if (o.chance === 1 && slot.bar === 4 && slot.idx === 0 && chords[0]) {
      // 평행 악절: 5마디 첫 코드 = 1마디 첫 코드(×4) 또는 3도 위아래 대리화음(×2)
      const d = iv(chords[0].rootPc, r.root.pc);
      if (d === 0) s *= 4; else if ([3, 4, 8, 9].includes(d) && r.kind === "dia") s *= 2;
    }
    if (o.chance === 1 && slot.bar === 3 && slot.idx === slots[3].length - 1) s *= isDominant(r) ? 6 : 0.2;   // 4마디 끝 반종지
    if (o.chance === 1 && n === flat.length - 1 && chords[0]) {
      // 8마디 끝 종지: 1마디 첫 코드(C1)의 도미넌트(완전종지), C1의 IV(변격), C1으로 가지 않는 도미넌트(위종지) 모두 가능
      const c1 = chords[0].rootPc;
      const ok = isDominant(r) || iv(r.root.pc, c1) === 7 || (iv(r.root.pc, c1) === 5 && r.fn === "S");
      s *= ok ? 6 : 0.15;
    }
    return s;
  }

  // 마디별로 다시 묶기
  const bars = slots.map(() => []);
  flat.forEach((s, n) => bars[s.bar].push(chords[n]));
  return { key, chords: bars, violations: check(o, key, flat, chords, used) };
}

// ---------- 조건 검사 (docs §11, 사용자 결정 2026-11-11) ----------
/** II-V 개수: II-minor(m7·m7(♭5) 계열) 바로 뒤에 그 완전5도 아래 도미넌트 7(sus 포함) */
export function countIIV(chords) {
  let n = 0;
  for (let i = 1; i < chords.length; i++) {
    const a = chords[i - 1], b = chords[i];
    if (/^(m7|m7b5|m9|m11)$/.test(a.type) && /^(dom7|7sus4|dom9|dom13)$/.test(b.type) && !b.bass && iv(b.rootPc, a.rootPc) === 7) n++;
  }
  return n;
}

function check(o, key, flat, chords, used) {
  const v = [];
  const tonicPc = Engine.pcOf(key.l, key.a);
  // 토닉이 한 번은 (조가 들리게)
  if (!chords.some(c => c.rootPc === tonicPc && (c.role === "I" || c.role === "i"))) v.push("no tonic");
  // II-V 최소: 개연성 1 → 2번, 2 → 1번
  const need = { 1: 2, 2: 1 }[o.chance] || 0;
  if (countIIV(chords) < need) v.push("II-V " + countIIV(chords) + "/" + need);
  // 같은 2코드 묶음 3번 이상 (패턴 밖)
  const pairs = {};
  for (let i = 1; i < chords.length; i++) if (!chords[i].pattern) { const k = chords[i - 1].symbol + ">" + chords[i].symbol; pairs[k] = (pairs[k] || 0) + 1; }
  if (Object.values(pairs).some(n => n >= 3)) v.push("repeat pair");
  // 1–4마디와 5–8마디가 완전히 같음 (개연성 1도 금지)
  const half = (a, b) => flat.map((s, n) => (s.bar >= a && s.bar < b ? chords[n].symbol : null)).filter(Boolean).join(" ");
  if (half(0, 4) === half(4, 8)) v.push("halves identical");
  // 개연성 2부터: 같은 패턴 두 번 이상 금지
  if (o.chance >= 2 && new Set(used).size !== used.length) v.push("pattern twice");
  // 다이아토닉 밖 코드 연속: 난이도 2는 최대 2개
  let run = 0, maxRun = 0;
  for (const c of chords) { run = c.kind === "dia" || c.kind === "surprise" ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
  if (maxRun > (o.level < 2 ? 0 : 2)) v.push("non-diatonic run " + maxRun);
  return v;
}
