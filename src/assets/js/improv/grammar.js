// ===== 코드 초견 — 8마디 코드진행 문법 (난이도 0~4, 순수 함수, tests/improv.test.js) =====
// 규칙 초안: docs/chord-progression-rules.md (사용자 검토 2026-11-11). 요약은 chordoven-spec.md "코드 초견".
//
// 만드는 방법 (규칙 기반 확률):
//   1) 조(키)를 고르고, 그 난이도에서 쓸 수 있는 코드를 "역할"(로마숫자)로 펼침 — 다이아토닉, (난이도 2) 세컨더리 도미넌트·II-minor,
//      (3) 디미니시드·SubV7·서브도미넌트 마이너, (4) 모달 인터체인지
//      난이도 (2026-11-12·13 사용자 결정): 0 다이아토닉만·분수코드 없음·V7sus4 없음 / 1 + V7sus4·분수코드 / 2 + 세컨더리·II-minor, add 코드 없음 /
//      3 + dim7(단조 VII°7 포함)·SubV7과 그 Related II·Extended Dominant·서브도미넌트 마이너(장조)·유사 5도 / 4 + 모달 인터체인지·7alt. 5~6은 아직 — 지금은 4와 같음
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
// 단조: 자연단음계 + V7 · VII°7 (사용자 결정 1). ♭VII7은 ♭III로 가는 도미넌트처럼.
// Vm7(v)은 2026-11-13 사용자 결정으로 추가 — 이끔음이 없어 해결 규칙(도미넌트 7)은 따르지 않고 표 점수대로(weak)
const DIA_MINOR = [
  ["i", 1, 0, [["m7", 0.7], ["m6", 0.2], ["madd9", 0.05], ["min", 0.05]], "T"], ["ii", 2, 0, [["m7b5", 1]], "S"],
  ["bIII", 3, 0, [["M7", 0.85], ["6", 0.1], ["maj", 0.05]], "T"], ["iv", 4, 0, [["m7", 0.7], ["m6", 0.25], ["min", 0.05]], "S"],
  ["V", 5, 0, [["dom7", 1]], "D"], ["Vsus", 5, 0, [["7sus4", 1]], "D"], ["v", 5, 0, [["m7", 0.9], ["min", 0.1]], "D"],
  ["bVI", 6, 0, [["M7", 0.85], ["6", 0.1], ["maj", 0.05]], "S"],
  ["bVII", 7, 0, [["dom7", 1]], "D"], ["viio", 7, 1, [["dim7", 1]], "D"],
];

// 다이아토닉끼리의 기능 화성 점수 (행 = 지금, 열 = 다음 — docs §2, 2026-11-13 사용자 조정). Vsus는 V와 같은 줄·칸.
// V(·단조 ♭VII) 줄은 도미넌트 규칙(transition)이 대신해서 쓰지 않음 — 반대 조 표로 빌린 코드 점수를 낼 때만 씀
const TABLE_MAJOR = {
  I: { II: 5, III: 3, IV: 7, V: 6, VI: 7 },
  II: { I: 2, III: 4, IV: 3, V: 10, VI: 5 },
  III: { I: 2, II: 4, IV: 5, V: 2, VI: 9 },
  IV: { I: 5, II: 3, III: 4, V: 6, VI: 3 },
  V: { I: 10, II: 1, III: 2, IV: 3, VI: 6 },
  VI: { I: 3, II: 8, III: 5, IV: 7, V: 3 },
};
const TABLE_MINOR = {
  i: { ii: 4, bIII: 5, iv: 7, V: 6, v: 3, bVI: 6, bVII: 3, viio: 2 },
  ii: { i: 1, bIII: 4, iv: 3, V: 10, v: 1, bVI: 4, bVII: 3, viio: 2 },
  bIII: { i: 1, ii: 3, iv: 5, V: 1, v: 3, bVI: 6, bVII: 2, viio: 1 },
  iv: { i: 4, ii: 3, bIII: 3, V: 7, v: 3, bVI: 4, bVII: 6, viio: 3 },
  V: { i: 10, bIII: 1, iv: 1, bVI: 6, viio: 2 },
  v: { i: 4, ii: 1, bIII: 2, iv: 5, bVI: 5, bVII: 3 },
  bVI: { i: 3, ii: 5, bIII: 3, iv: 3, V: 6, v: 2, bVII: 5, viio: 2 },
  bVII: { i: 3, ii: 1, bIII: 9, iv: 1, V: 1, bVI: 2 },
  viio: { i: 9, bIII: 1, V: 2, bVI: 1 },
};
const DEG_ID = { major: [, "I", "II", "III", "IV", "V", "VI"], minor: [, "i", "ii", "bIII", "iv", "V", "bVI", "bVII"] };
/** 도수(1~7)로 표 점수 — 빌린 코드를 반대 조 표로 잴 때 */
const byDeg = (table, a, b) => { const ids = DEG_ID[table === TABLE_MINOR ? "minor" : "major"]; return table[ids[a]]?.[ids[b]]; };

// ---------- 서브도미넌트 마이너 (난이도 3, 장조) · 모달 인터체인지 (난이도 4) — 사용자 결정 2026-11-13 ----------
// [id, 으뜸음에서 반음, 도수, 코드 종류, 코드스케일(같은 으뜸음의 선법), 나오는 점수 배율, 그 밖]
//   나오는 점수 = 배율 × 반대 조 표의 (지금 도수 → 이 코드 도수) 점수. own = 반대 조 대신 이 조의 표, fixed = 앞 코드와 상관없이 고정
//   modalDom = 모달 인터체인지의 도미넌트 7 — "5도 하행 해결" 규칙에서 빼고 아래 ROWS대로 (텐션은 리디안 도미넌트 9·♯11·13)
const SDM_MAJOR = [
  ["iv", 5, 4, [["m7", 0.6], ["m6", 0.3], ["mM7", 0.1]], "aeolian", 0.4],   // IV-M7은 이 4도 자리에서만 단독으로 (사용자 결정)
  ["bVI", 8, 6, [["M7", 0.9], ["6", 0.1]], "aeolian", 0.4],
  ["bVII7", 10, 7, [["dom7", 1]], "aeolian", 0.4, { modalDom: true }],
  ["bII", 1, 2, [["M7", 1]], "phrygian", 0.4],
  ["ii7b5", 2, 2, [["m7b5", 1]], "aeolian", 0.4],
];
const MODAL_MAJOR = [
  ["im", 0, 1, [["m7", 0.8], ["m6", 0.2]], "aeolian", 0.4],
  ["bIII", 3, 3, [["M7", 0.9], ["6", 0.1]], "aeolian", 0.4],
  ["v", 7, 5, [["m7", 1]], "mixolydian", 0.4],
  ["bVI7", 8, 6, [["dom7", 1]], "locrian", 0.4, { modalDom: true }],
  ["bVIIM7", 10, 7, [["M7", 1]], "mixolydian", 0.4],
  ["bVIIm7", 10, 7, [["m7", 1]], "phrygian", 0.2],   // ♭VIIM7의 절반
  ["#iv7b5", 6, 4, [["m7b5", 1]], "lydian", 0.4],
  ["IV7", 5, 4, [["dom7", 1]], "dorian", 0.4, { modalDom: true }],
  ["vi7b5", 9, 6, [["m7b5", 1]], "dorian", 0.4],
  ["bIIIm7", 3, 3, [["m7", 1]], "locrian", 0.12],   // 드물게: 0.4 × 0.3
  ["bVM7", 6, 5, [["M7", 1]], "locrian", 0, { fixed: 0.3 }],
];
const MODAL_MINOR = [
  ["PicI", 0, 1, [["M7", 0.9], ["6", 0.1]], "ionian", 0.4],
  ["IIm", 2, 2, [["m7", 1]], "ionian", 0.4],
  ["IVM", 5, 4, [["M7", 1]], "ionian", 0.4],
  ["IV7", 5, 4, [["dom7", 1]], "dorian", 0.4, { modalDom: true }],
  ["bII", 1, 2, [["M7", 1]], "phrygian", 0.4],
  ["vi7b5", 9, 6, [["m7b5", 1]], "dorian", 0.4],
  ["bVIIm7", 10, 7, [["m7", 1]], "phrygian", 0.5, { own: true }],   // ♭VII7의 절반
  ["bIIIm7", 3, 3, [["m7", 1]], "locrian", 0.12],
  ["bVM7", 6, 5, [["M7", 1]], "locrian", 0, { fixed: 0.3 }],
];
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
};
// 빌린 코드 다음 점수 (장조 id로 씀 — 단조에서는 ALIAS_MINOR로 바꿔 읽음). 여기 없는 다음 코드는 근음 이동 점수(motion)
const ROWS = {
  iv: { I: 6, V: 4, bVII7: 4 },
  bVI: { bVII7: 5, V: 4, I: 3 },
  bVII7: { I: 8, bIII: 2, iv: 1, bVI: 1 },
  bII: { I: 6, V: 3 },
  ii7b5: { V: 10, "subv/I": 2 },
  IV7: { I: 6, bVII7: 3, iv: 2 },
  bVI7: { I: 4, V: 4, bVII7: 2 },
  vi7b5: { bVI: 6, I: 6, bVII7: 3, iv: 2 },   // IV7(9)로도 보아 IV7의 다음 후보도 (사용자 결정)
  bIIIm7: { bVI7: 6, IV: 4, iv: 4, II: 4, ii7b5: 3, bII: 3, "V/V": 2.5, "subv/I": 2, I: 2, V: 1.5, VI: 0.5 },
  bVM7: { iv: 5, IV: 4, IV7: 2.5, I: 2, V: 2, "V/III": 1.5, bVI7: 1.2, "ii/subv/I": 1.2, bIIIm7: 1 },
};
const ALIAS_MINOR = { I: "i", II: "ii", ii7b5: "ii", IV: "IV7", bVI7: "bVI", bVII7: "bVII", im: "i", VI: null, "V/III": null, "subv/I": "subv/i", "ii/subv/I": "ii/subv/i" };
/** 단조용 ROWS (같은 다음 코드가 둘이면 높은 쪽) */
const rowsFor = minor => {
  if (!minor) return ROWS;
  const out = {};
  for (const [id, row] of Object.entries(ROWS)) {
    out[id] = {};
    for (const [k, v] of Object.entries(row)) { const m = k in ALIAS_MINOR ? ALIAS_MINOR[k] : k; if (m) out[id][m] = Math.max(out[id][m] || 0, v); }
  }
  return out;
};
const baseId = id => (id === "Vsus" ? "V" : id);

/** add 코드는 난이도 0·1에서만 (사용자 결정 2026-11-12) — 2부터는 목록에서 빼고 나머지 비율로 */
const withoutAdd = types => types.filter(t => !/add/.test(t[0]));
/** 6th 코드(6·m6)는 난이도 2부터 (사용자 결정 2026-11-13) — 0·1에서는 목록에서 빼고 나머지 비율로 */
const SIXTH = ["6", "m6"];
const withoutSixth = types => types.filter(t => !SIXTH.includes(t[0]));

/** 조 하나의 역할 목록 (난이도 0~4) */
export function buildRoles(key, level) {
  const sc = key.minor ? MINOR : MAJOR;
  const tonic = { l: key.l, a: key.a };
  const roles = [];
  for (let [id, deg, alt, types, fn] of key.minor ? DIA_MINOR : DIA_MAJOR) {
    if (id === "Vsus" && level < 1) continue;   // V7sus4는 난이도 1부터
    if (id === "viio" && level < 3) continue;   // dim7은 난이도 3부터 (단조 VII°7도)
    types = level >= 2 ? withoutAdd(types) : withoutSixth(types);
    roles.push({ id, root: spell(tonic, sc[deg - 1] + alt, deg), types, kind: "dia", fn, sus: id === "Vsus", weak: id === "v" });
  }
  const byId = Object.fromEntries(roles.map(r => [r.id, r]));
  // 도미넌트가 해결할 곳 (다이아토닉 V → I, Vsus → I, ♭VII7 → ♭III, VII°7 → i)
  const tonicId = key.minor ? "i" : "I";
  for (const r of roles) if (r.fn === "D") r.target = (r.id === "bVII" ? byId.bIII : byId[tonicId]).root.pc;
  for (const r of roles) if (r.fn === "D") r.targetMinor = key.minor && r.id !== "bVII";
  if (byId.V) byId.V.targetId = tonicId;
  if (level < 2) return withDeg(roles, key);

  // 세컨더리 도미넌트 5개 (장조 →II III IV V VI, 단조 →♭III iv V ♭VI ♭VII)
  const targets = key.minor ? ["bIII", "iv", "V", "bVI", "bVII"] : ["II", "III", "IV", "V", "VI"];
  const minorish = t => ["II", "III", "VI", "iv"].includes(t);
  for (const t of targets) {
    const tr = byId[t].root;
    roles.push({ id: "V/" + t, root: spell(tr, 7, 5), types: [["dom7", 1]], kind: "sec", fn: "D", target: tr.pc, targetMinor: minorish(t), targetId: t });
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
  if (level < 3) return withDeg(roles, key);
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

  // SubV7 (사용자 결정 2026-11-13): 세컨더리 5개의 목표 + 토닉 — 목표의 반음 위 도미넌트 7, 반음 아래로 해결. 텐션은 리디안 도미넌트(9·♯11·13)
  // Related II: SubV7의 완전5도 위 m7 (A♭m7 – D♭7 – C)
  for (const t of [...targets, tonicId]) {
    const tr = byId[t].root;
    const sub = { id: "subv/" + t, root: spell(tr, 1, 2), types: [["dom7", 1]], kind: "subv", fn: "D", target: tr.pc, targetMinor: minorish(t) || (key.minor && t === tonicId), lyd: true };
    roles.push(sub, { id: "ii/" + sub.id, root: spell(sub.root, 7, 5), types: [["m7", 1]], kind: "ii", fn: "S", dominant: sub.id });
  }
  const borrowed = (list, kind) => {
    for (const [id, semi, deg, types, mode, entry, extra = {}] of list) {
      const scale = new Set(MODES[mode].map(x => (Engine.pcOf(key.l, key.a) + x) % 12));
      const entryTbl = extra.own ? TABLE_MINOR : key.minor ? TABLE_MAJOR : TABLE_MINOR;
      roles.push({ id, root: spell(tonic, semi, deg), types, kind, fn: "S", entry, entryTbl, scale, ...extra, lyd: !!extra.modalDom });
    }
  };
  if (!key.minor) borrowed(SDM_MAJOR, "sdm");   // 서브도미넌트 마이너는 장조에서만 (단조에서는 이미 다이아토닉)
  if (level < 4) return withDeg(roles, key);
  borrowed(key.minor ? MODAL_MINOR : MODAL_MAJOR, "modal");
  return withDeg(roles, key);
}

/** 역할마다 도수(1~7, 으뜸음에서 글자 거리)와 코드스케일(다이아토닉은 조의 음계) */
function withDeg(roles, key) {
  const scale = new Set((key.minor ? MINOR : MAJOR).map(x => (Engine.pcOf(key.l, key.a) + x) % 12));
  for (const r of roles) {
    r.deg = ((r.root.l - key.l + 7) % 7) + 1;
    if (r.kind === "dia") r.scale = scale;
  }
  return roles;
}

// ---------- 점수 ----------
// 모달 인터체인지의 도미넌트 7(modalDom)과 단조 Vm7(weak)은 도미넌트 해결 규칙에서 뺌 (사용자 결정)
const isDominant = r => r.fn === "D" && r.kind !== "dim" && !(r.kind === "dia" && r.id === "viio") && !r.weak;
const isBorrowed = r => r.kind === "sdm" || r.kind === "modal";
const iv = (a, b) => (((b - a) % 12) + 12) % 12;   // a에서 b까지 위로 반음 수

/**
 * 도미넌트 7 다음의 위종지 점수 (도미넌트 근음 기준 위로 잰 간격 → 점수, G7 기준 — 2026-11-11, 2026-11-13 사용자 조정):
 * Am7 +2 m7 30 · Em7 +9 m7 20 · FM7 +10 M7 15 · A♭M7 +1 M7 10 · D♭M7 +6 M7 7.5 · B♭M7 +3 M7 7.5 · A7 +2 7 7 · E♭M7 +8 M7 5
 * 그 조에 없는 코드는 후보가 아니므로 모달(A♭M7 등)은 난이도 3·4부터
 */
const DECEPTIVE = [[2, "m", 30], [9, "m", 20], [10, "M", 15], [1, "M", 10], [6, "M", 7.5], [3, "M", 7.5], [2, "7", 7], [8, "M", 5]];
const MINORISH = ["min", "m7", "m6", "madd9", "m7b5", "mM7", "m9", "m11", "m69"];
const quality = typeId => (MINORISH.includes(typeId) ? "m" : ["dom7", "7sus4", "dom9", "dom13"].includes(typeId) ? "7" : "M");

/**
 * 근음 이동 점수 (docs §3 — "그 밖"의 고정값 대신, 사용자 결정 2026-11-13 조정 A):
 * 완전5도 하행 2 · 반음·온음 1.6 · 3도 하행 1.2 · 3도 상행 0.8 · 완전5도 상행 0.7 · 증4도 0.5, 다이아토닉 밖 코드는 절반.
 * 어그질러리 디미니시드는 같은 근음 다음에만. 난이도 3부터 증4도는 유사 5도(pseudoFifth) 점수와 큰 쪽
 */
const MOTION = { 0: 1, 5: 2, 1: 1.6, 2: 1.6, 10: 1.6, 11: 1.6, 8: 1.2, 9: 1.2, 3: 0.8, 4: 0.8, 7: 0.7, 6: 0.5 };
function motion(a, b, roles, ctx) {
  if (b.dimKind === "aux" && b.root.pc !== a.root.pc) return 0;
  const s = MOTION[iv(a.root.pc, b.root.pc)] * (b.kind === "dia" ? 1 : 0.5);
  return Math.max(s, pseudoFifth(a, b, roles, ctx));
}

/**
 * 유사 5도 (증4도 근음 진행, 난이도 3부터 — docs 11-6 사용자 결정): 두 코드가 도미넌트 7이 아니고, 도착 코드가 M7·m7, 공통음이 있고,
 * 코드스케일의 다른 음이 3개 이하 → 완전5도 하행 점수의 70%(개연성 1은 30%). 도착이 빌린 코드면 그 코드의 나오는 배율도 곱함
 */
const CHORD = { M7: [0, 4, 7, 11], "6": [0, 4, 7, 9], maj: [0, 4, 7], m7: [0, 3, 7, 10], m6: [0, 3, 7, 9], min: [0, 3, 7], mM7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10], dom7: [0, 4, 7, 10] };
const tonesOf = r => (CHORD[r.types[0][0]] || []).map(x => (r.root.pc + x) % 12);
function pseudoFifth(a, b, roles, ctx) {
  if (ctx.level < 3 || iv(a.root.pc, b.root.pc) !== 6 || !a.scale || !b.scale) return 0;
  if (isDominant(a) || a.modalDom || !["M7", "m7"].includes(b.types[0][0])) return 0;
  if (!tonesOf(a).some(x => tonesOf(b).includes(x)) || [...a.scale].filter(x => !b.scale.has(x)).length > 3) return 0;
  const fifth = roles.find(r => r.kind === "dia" && r.root.pc === (a.root.pc + 5) % 12);
  const f = fifth ? transition(a, fifth, roles, ctx) : MOTION[5];
  return (ctx.chance === 1 ? 0.3 : 0.7) * f * (isBorrowed(b) ? b.entry || 0.3 : 1);
}

/**
 * 지금 역할 a 다음에 역할 b가 올 점수 (박 위치·개연성 보정 전).
 * 도미넌트: 해결 65 · 위종지(DECEPTIVE) · 지연 해결 몫 · 새 II-V의 II · 그 밖 근음 이동 점수 (사용자 결정, docs §4)
 */
function transition(a, b, roles, ctx) {
  // 자기 자신으로: 아주 낮게 (사용자 결정 2026-11-13 — 같은 마디 안에서는 이름이 달라야 함: C → C/G·CM7 → C6은 되고 C → C는 안 됨)
  if (a === b) return SELF;
  const base = ctx.table;
  // 디미니시드 다음: 목표로 85 · 다른 디미니시드 5 · 공통음 3개 도미넌트(근음 -4·-1·+2·+5) 2 (2026-11-13 사용자 조정)
  if (a.kind === "dim") {
    if (a.dimKind === "aux") return b.root.pc === a.root.pc && b.kind === "dia" ? 90 : 1;
    if (b.root.pc === a.target && b.kind === "dia") return 85;
    if (b.kind === "dim") return 5;
    if (isDominant(b) && [8, 11, 2, 5].includes(iv(a.root.pc, b.root.pc))) return 2;
    return motion(a, b, roles, ctx);
  }
  // II-minor 다음: 자기 도미넌트 85 (난이도 3부터는 70 + 그 도미넌트의 SubV7 15 — Dm7 → D♭7)
  if (a.kind === "ii" || a.iiOf) {
    const dom = a.kind === "ii" ? [a.dominant] : a.iiOf;
    const subOf = id => "subv/" + ctx.byId[id]?.targetId;
    if (dom.includes(b.id)) return a.kind === "ii" ? (ctx.byId[subOf(a.dominant)] ? 70 : 85) : Math.max(base[baseId(a.id)]?.[baseId(b.id)] || 0, 10) * 1.5;
    if (b.kind === "subv" && dom.some(id => subOf(id) === b.id)) return a.kind === "ii" ? 15 : 3;
    if (a.kind === "ii") return motion(a, b, roles, ctx);
  }
  // 도미넌트 다음
  if (isDominant(a)) {
    if (a.sus && b.id === "V" && b.root.pc === a.root.pc) return ctx.chance === 1 ? 40 : 6;   // V7sus4 → V7 (개연성 1이면 V7·I만)
    if (a.sus && ctx.chance === 1 && b.root.pc !== a.target) return 0.2;
    // 해결: 목표 근음의 코드끼리 65를 나눔 — 빌린 코드(G7 → Cm7)는 6.5만
    if (b.root.pc === a.target && !b.sus && b.kind !== "dim") return isBorrowed(b) ? 6.5 : 65 / ctx.count(r => r.root.pc === a.target && !r.sus && r.kind !== "dim" && !isBorrowed(r));
    // Extended Dominant를 SubV7로: 목표에서 다시 5도 아래로 갈 도미넌트 대신 그 SubV7 (E7 → E♭7 → D7)
    if (b.kind === "subv" && b.target === (a.target + 5) % 12) return 10;
    const dec = DECEPTIVE.find(([gap, q]) => gap === iv(a.root.pc, b.root.pc) && q === quality(b.types[0][0]) && b.kind !== "dim");
    if (dec) return dec[2];
    if (b.kind === "ii" || b.iiOf) return 5 / 3;
    if (b.kind === "dia" && b.fn !== "D") return 8 / 4;   // 지연 해결 몫 (다음에 원래 목표가 오도록 ctx.pending)
    return motion(a, b, roles, ctx);
  }
  // 빌린 코드(서브도미넌트 마이너·모달) 다음: ROWS에 있으면 그 점수, 없으면 다이아토닉은 근음 이동 점수
  // (ROWS가 없는 빌린 코드는 빌려 온 조의 표 × 1.5 — 원래 조로 돌아가는 쪽에 가산)
  if (isBorrowed(a)) {
    const row = ctx.rows[a.id];
    const v = row?.[baseId(b.id)];
    if (v != null) return v;
    if (b.kind === "dia") return row ? motion(a, b, roles, ctx) : 1.5 * (byDeg(a.entryTbl, a.deg, b.deg) ?? 1);
  } else if (b.kind === "dia") return base[baseId(a.id)]?.[baseId(b.id)] ?? 1;
  return enter(a, b, roles, ctx);
}

/**
 * 토닉·서브도미넌트(빌린 코드 포함) 다음에 다이아토닉 밖 코드가 올 점수 (사용자 결정 2026-11-13 조정 B — 앞 코드에 따라):
 *   세컨더리 0.3 × (지금 → 그 목표) · SubV7 0.15 × (지금 → 그 목표) · II-minor 0.25 × (지금 → 그 II-V가 도착할 코드), SubV7의 Related II는 0.125 ×
 *   디미니시드(어센딩·디센딩) 0.25 × (지금 → 그 목표) · 어그질러리는 같은 근음 다음에만 1.5
 *   빌린 코드: 배율 × 빌려 온 조 표의 (지금 도수 → 그 도수) 점수 (♭VM7은 0.3 고정), 유사 5도면 그 점수와 큰 쪽
 */
function enter(a, b, roles, ctx) {
  const dia = pc => roles.find(r => r.kind === "dia" && r.root.pc === pc && !r.sus);
  const toward = (t, k) => (t ? k * transition(a, t, roles, ctx) : 0);
  if (b.kind === "sec") return toward(dia(b.target), 0.3);
  if (b.kind === "subv") return toward(dia(b.target), 0.15);
  if (b.kind === "ii") { const d = ctx.byId[b.dominant]; return toward(dia(d.target), d.kind === "subv" ? 0.125 : 0.25); }
  if (b.kind === "dim") {
    if (b.dimKind === "aux") return b.root.pc === a.root.pc ? 1.5 : 0;
    return toward(dia(b.target), 0.25);
  }
  if (isBorrowed(b)) return Math.max(b.fixed ?? b.entry * (byDeg(b.entryTbl, a.deg, b.deg) ?? 1), pseudoFifth(a, b, roles, ctx));
  return motion(a, b, roles, ctx);
}

const SELF = 0.5;   // 자기 자신 (2026-11-13 사용자 조정 0.4 → 0.5)

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
    // 캐논·하행 베이스: 분수코드(G/B 등)는 베이스 라인 단계(bassLine)가 경과 베이스로 붙임 — 패턴에 박아 두지 않음 (2026-11-13)
    { name: "canon", seq: ["I", "V", "VI", "III", "IV", "I", "IV", "V"] },
    { name: "desc-bass", seq: ["I", "V", "VI", "I", "IV", "I", "II", "V"] },
    { name: "sec-chain", seq: ["I", "V/VI", "VI", "V/V", "V"], level: 2 },
    // 난이도 3 (2026-11-13): 플라갈 마이너 · 백도어 · Extended · II – SubV – I
    { name: "plagal-minor", seq: ["IV", "iv", "I"], level: 3 },
    { name: "backdoor", seq: [["iv", "m7"], "bVII7", "I"], level: 3 },
    { name: "extended", seq: ["V/VI", "V/II", "V/V", "V", "I"], level: 3 },
    { name: "2-subV-1", seq: ["II", "subv/I", "I"], level: 3 },
    // 난이도 4: 믹솔리디안 · 에올리안 종지
    { name: "mixolydian", seq: ["I", "bVIIM7", "IV", "I"], level: 4 },
    { name: "aeolian", seq: ["I", "bVI", "bVII7", "I"], level: 4 },
  ],
  minor: [
    { name: "andalusian", seq: ["i", "bVII", "bVI", "V"] },
    { name: "minor-2-5-1", seq: ["ii", "V", "i"] },
    { name: "6-7-1", seq: ["bVI", "bVII", "i"] },
    { name: "4-5-1", seq: ["iv", "V", "i"] },
    { name: "minor-2-subV-1", seq: ["ii", "subv/i", "i"], level: 3 },
    { name: "picardy", seq: ["iv", "V", "PicI"], level: 4 },
  ],
};

// ---------- 라인 클리셰 (사용자 결정 2026-11-13) ----------
// 패턴과 따로: 진행 중에 아래 코드가 뽑히면 그 자리에서 클리셰로 늘어날 수 있음 (마디 첫 박에서 시작).
//   한 마디 안이면 1~7마디 어디서든, 2마디면 1·3·5·7마디, 2마디를 넘으면 1·5마디. 4박 마디의 2박짜리(1박 코드 둘)는 셋째 박에서도.
//   30%는 두 번째 코드(mM7·augM7)부터 시작 — 가장 짧으면 DmM7 – Dm7, m7을 건너뛴 DmM7 – Dm6도. 끝나면 원래 코드(마지막 코드의 역할)의 다음 후보로 이어짐
//   마이너: Im(단조, 난이도 0부터) · IVm(단조) · IIm7·VIm7(장조) — 난이도 1부터. m – mM7 – m7 – m6, 베이스 하행형(m – mM7/7 – m7/♭7 – m6/6)과 윗성부형 반반.
//     50%는 m7에서 끝남, 난이도 0·1은 6th 코드가 없어 항상 m7에서
//   메이저(윗성부형만): I·IV(장조), ♭III·♭VI(단조) — 난이도 2부터. M7 – augM7 – 6 – 7, 50%는 6에서 끝남.
//     7까지 가면 I7은 V7/IV로, IV7은 모달 인터체인지(난이도 4부터)로 이어짐. IV는 난이도 2·3, ♭III·♭VI는 늘 6에서 끝남
const CLICHE_ODDS = { 1: 0.52, 2: 0.36, 3: 0.19 };   // 클리셰가 될 수 있는 코드가 뽑혔을 때 (개연성별 — 2026-11-13 사용자 결정으로 1.5배쯤 늘림)
const CLICHE_DEG = { i: 1, iv: 0.5, II: 0.6, VI: 0.6, I: 0.25, IV: 0.35, bIII: 0.35, bVI: 0.35 };   // 도수별 배율 — 마이너 총량은 예전(Im만)과 비슷하게, 메이저는 그 절반쯤
const CLICHE_LONG = 0.12;   // 2마디를 넘게 걸치면 (코드 개수 최소 등) ×0.12 — 4마디짜리는 드물게 (2026-11-13 사용자 결정 "최소일 때 비율 낮추기")
const CLICHE_BAR_EACH = 0.25;   // 코드 둘이 한 마디씩 2마디(코드 개수 최소 등)면 ×0.25
const CLICHE_LOW_LEVEL = { 0: 0.35, 1: 0.25 };   // 난이도 0·1: 클리셰가 짧고(m7에서 끝남) 코드 종류가 적어 더 자주 걸리므로 낮춤 — 난이도마다 비슷하게

/** 이 역할에서 시작하는 라인 클리셰 { name, items: [[역할 id, 코드 종류, 베이스]…] } 또는 null */
function clicheFor(role, key, level, rnd) {
  if (role.kind !== "dia") return null;
  const minorDeg = key.minor ? ["i", "iv"] : ["II", "VI"], majorDeg = key.minor ? ["bIII", "bVI"] : ["I", "IV"];
  if (minorDeg.includes(role.id) && (role.id === "i" || level >= 1)) {
    const bass = rnd() < 0.5;
    let seq = bass ? [["min"], ["mM7", "7"], ["m7", "b7"], ["m6", "6"]] : [["min"], ["mM7"], ["m7"], ["m6"]];
    if (level < 2 || rnd() < 0.5) seq.pop();
    if (rnd() < CLICHE_SECOND) {
      seq.shift();   // 두 번째 코드부터 (DmM7 – Dm7 …)
      if (seq.length === 3 && rnd() < 1 / 3) seq.splice(1, 1);   // m7을 건너뛴 DmM7 – Dm6도 (사용자 결정)
    }
    return { name: bass ? "cliche-bass" : "cliche-top", items: seq.map(([t, b]) => [role.id, t, b]) };
  }
  if (majorDeg.includes(role.id) && level >= 2) {
    const items = [[role.id, "M7"], [role.id, "augM7"], [role.id, "6"]];
    const seventh = key.minor ? null : role.id === "I" ? "V/IV" : level >= 4 ? "IV7" : null;
    if (seventh && rnd() >= 0.5) items.push([seventh, "dom7"]);
    if (rnd() < CLICHE_SECOND) items.shift();   // 두 번째 코드부터 (C+M7 – C6 …)
    return { name: "cliche-major", items };
  }
  return null;
}
const CLICHE_SECOND = 0.3;   // 두 번째 코드(mM7·augM7)부터 시작 (사용자 결정 2026-11-13)
const PATTERN_ODDS = { 1: 0.7, 2: 0.4, 3: 0.15 };   // 개연성별로 패턴을 통째로 쓸 확률 (docs §5)
const TEMPERATURE = { 1: 0.6, 2: 0.9, 3: 1.3 };

// ---------- 코드 만들기 ----------
const pickBy = (list, w, rnd) => { let x = rnd() * list.reduce((s, e) => s + w(e), 0); for (const e of list) { x -= w(e); if (x < 0) return e; } return list[list.length - 1]; };
const BASS = { "3": null, "5": null, b7: [10, 7], "7": [11, 7], "6": [9, 6] };
/** 코드 종류의 3음·5음 (근음에서 반음 수) — 전위형 베이스를 코드 구성음으로 (m7(♭5)의 5음은 ♭5: Am7(♭5)/E♭, 2026-11-13 버그 수정) */
const thirdOf = typeId => (MINORISH.includes(typeId) || /^dim/.test(typeId) ? 3 : 4);
const fifthOf = typeId => (/^(m7b5|dim)/.test(typeId) ? 6 : /^aug/.test(typeId) ? 8 : 7);

// ---------- 하이브리드 코드 (사용자 결정 2026-11-13) ----------
// 모양: [위 코드 근음이 베이스에서 위로 몇 반음, 도수, 위 코드 종류, 비율] — 베이스 = 그 자리 코드의 근음(무작위 코드 모드 slash.js HYBRIDS와 같은 모양)
// 서스 도미넌트형 (베이스 = 도미넌트 근음): IV/V(F/G) IVM7/V IIm7/V(Dm7/G) IVm/V IIm7(♭5)/V IIm/V(Am/D형)
const SUS_HYBRIDS = [[10, 7, "maj", 3, "IV/V"], [10, 7, "M7", 1.5], [7, 5, "m7", 1], [10, 7, "min", 0.7], [7, 5, "m7b5", 0.25], [7, 5, "min", 0.25]];
// 페달형 (베이스 = 토닉·IV 근음): 리디안 II/I(D/C) · V/I(G/C) · dim7(D°7/C · B°7/C)
const PEDAL_HYBRIDS = [[2, 2, "maj", 2], [7, 5, "maj", 2], [2, 2, "dim7", 0.5], [11, 7, "dim7", 0.5]];
/** V7sus4 자리가 하이브리드가 될 확률과 모양: 1 IV/V만 40% · 2 서스 도미넌트형 6종 30% · 3 20% · 4~6 IV/V를 뺀 5종 20% */
const susHybrids = level => (level <= 1 ? SUS_HYBRIDS.slice(0, 1) : level >= 4 ? SUS_HYBRIDS.slice(1) : SUS_HYBRIDS);
const SUS_HYBRID_ODDS = { 1: 0.4, 2: 0.3, 3: 0.2 };
/** V7·세컨더리 도미넌트 자리(서스 도미넌트형), 토닉·IV 자리(페달형)가 하이브리드로 바뀔 확률: 3 0% · 4 2% · 5~6 5% */
const SWAP_ODDS = { 4: 0.02, 5: 0.05, 6: 0.05 };

/** 하이브리드 코드 하나 — 베이스는 role의 근음 */
function makeHybrid(role, shapes, o, rnd) {
  const [semi, deg, type] = pickBy(shapes, h => h[3], rnd);
  const q = makeChord({ ...role, root: spell(role.root, semi, deg), sus: false }, type, null, { ...o, tension: "off" }, rnd);
  return q && Object.assign(q, { bass: role.root.name, bassPc: role.root.pc, slash: "hybrid", why: "hybrid", symbol: q.symbol + "/" + role.root.name });
}

// ---------- 베이스 라인 (분수코드, 사용자 결정 2026-11-13) ----------
// 화성(역할·코드 종류)을 다 정한 뒤 베이스 라인을 따로 다듬음 — "몇 %가 분수코드" 같은 목표는 없음.
// 용법이 있는 전위형(난이도 1부터, 2전위 포함): 경과(앞·뒤 베이스와 같은 방향으로 순차) · 같은 코드 안의 전위(C – C/G) · 종지 6/4(C/G – G7) · 페달(앞 베이스 유지: C – F/C)
//   개연성에 따라 그 자리에서 쓸 확률 높음 70% · 중간 50% · 낮음 35%
// 용법이 없는 전위형(낯선 소리): 난이도 2부터 코드마다 3% · 6% · 8% · 10% · 12%
// 지켜야 할 해결: 7음 베이스는 다음 베이스가 반음·온음 아래(페달로 그대로도 됨), 도미넌트의 3음(이끔음) 베이스는 다음 베이스가 반음 위
const USE_ODDS = { 1: 0.7, 2: 0.5, 3: 0.35 };
const FREE_ODDS = { 2: 0.03, 3: 0.06, 4: 0.08, 5: 0.1, 6: 0.12 };
const RANDOM_INV = 0.2;   // 개연성 랜덤: 용법·해결과 상관없이 코드마다 20%
const hasMinor7 = typeId => /^(dom7|dom9|dom13|m7|m9|m11|m7b5|7sus4)$/.test(typeId);

// 텐션 (사용자 결정 2026-11-13) — 출제 설정의 텐션 옵션을 켰을 때만, 코드 진행 난이도에 따라:
//   텐션이 붙는 비율(붙일 수 있는 코드 중): 0·1·2 10% (0은 8마디에 하나까지) · 3 15% · 4 20% · 5 40% · 6 60%
//   괄호 안 텐션 2개: 옵션이 '최대 2개'·HARD이고 난이도 3부터 — 텐션이 붙는 코드 중 3 10% · 4 20% · 5 30% · 6 47% (2026-11-13 사용자 결정, 그 밖에는 1개)
//     m7(♭5)는 ♭5가 이미 괄호에 있어서 텐션을 붙이면 괄호 안 2개 → '2개'가 뽑혔을 때만 m7(♭5,9)·m7(♭5,11)·m7(♭5,♭13)
//   난이도 0·1은 조의 음계 음(단조는 자연단음계)인 텐션만 — G7(9)·G7(13)은 되고 G7(♭9)는 안 됨, 7alt는 난이도 4부터(아래)
//   텐션 코드(HARD — M9·13·m11 …): 난이도 3부터, 텐션이 붙는 코드 중 3 5% · 4 10% · 5 20% · 6 50%. 괄호 텐션은 '2개'가 뽑혔을 때만 하나 더(CM9(13))
const TEN_ODDS = { 0: 0.1, 1: 0.1, 2: 0.1, 3: 0.15, 4: 0.2, 5: 0.4, 6: 0.6 };
const TWO_ODDS = { 3: 0.1, 4: 0.2, 5: 0.3, 6: 0.47 };
const HARD_ODDS = { 3: 0.05, 4: 0.1, 5: 0.2, 6: 0.5 };
const ALT_ODDS = { 4: 0.1, 5: 0.3, 6: 0.5 };

/**
 * 역할 + 코드 종류 → 엔진 코드 (q). 텐션은 위 규칙대로, 베이스("3" 등)가 있으면 분수코드.
 * o.scale = 조의 음계 pc 집합(난이도 0·1의 텐션 거르기용)
 * @returns q 또는 null(엔진이 쓰지 않는 철자)
 */
function makeChord(role, typeId, bass, o, rnd) {
  let type = Engine.BY_ID[typeId];
  let tens = [], alt = false;
  const level = o.level ?? 6;
  // 텐션 (7화음만). 마이너로 해결하는 도미넌트는 ♭9·♯9·♭13, 메이저로 해결하면 9·13·♯11·♭9
  const twoOk = level >= 3 && (o.tension === "2" || o.tension === "hard");
  const two = twoOk && rnd() < (TWO_ODDS[level] || 0);   // 이 코드는 괄호 안 2개까지
  const canTen = type.seventh && !role.sus && typeId !== "dim7" && typeId !== "mM7" && (typeId !== "m7b5" || two);
  if (o.tension !== "off" && canTen && rnd() < (TEN_ODDS[level] ?? 0.6)) {
    {
      let pool = type.ten.slice();
      // SubV7·모달 도미넌트 7은 리디안 도미넌트(9·♯11·13)
      if (typeId === "dom7") pool = pool.filter(t => (role.lyd ? ["9", "#11", "13"] : role.targetMinor ? ["b9", "#9", "b13"] : ["9", "13", "#11", "b9"]).includes(t));
      if (level <= 1 && o.scale) pool = pool.filter(t => o.scale.has((role.root.pc + Engine.TEN[t][0]) % 12));
      const n = two && type.maxTen !== 1 ? 2 : 1;   // m7(♭5)는 텐션 1개 = 괄호 안 2개
      while (tens.length < n && pool.length) {
        const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        if (tens.every(u => Engine.TEN[u][1] !== Engine.TEN[t][1])) tens.push(t);
      }
      tens.sort((p, q) => Engine.TEN_ORDER.indexOf(p) - Engine.TEN_ORDER.indexOf(q));
      // HARD: 9·13·11을 텐션 코드 이름으로 (M7+9 → M9, 7+13 → 13, m7+11 → m11 …), 텐션 코드는 추가 텐션 1개까지 (사용자 결정)
      if (o.tension === "hard" && level >= 3 && rnd() < (HARD_ODDS[level] || 0)) {
        const conv = { M7: [["13", "M13"], ["9", "M9"]], m7: [["11", "m11"], ["9", "m9"]], dom7: [["13", "dom13"], ["9", "dom9"]] }[typeId] || [];
        const hit = conv.find(([t]) => tens.includes(t));
        if (hit) { type = Engine.BY_ID[hit[1]]; tens = tens.filter(t => t !== hit[0] && (hit[0] !== "13" || t !== "9")).slice(0, 1); }
      }
      // 7alt (2026-11-13 사용자 결정): 난이도 4부터, 텐션이 alt 조건(♭9·♯9·♭13 중 하나 이상, 9·13 없음)이면 4 10% · 5 30% · 6 50% (HARD면 +10%)
      const altOk = type.id === "dom7" && tens.some(t => ["b9", "#9", "b13"].includes(t)) && !tens.some(t => ["9", "13"].includes(t));
      if (altOk && level >= 4 && rnd() < ALT_ODDS[Math.min(level, 6)] + (o.tension === "hard" ? 0.1 : 0)) { alt = true; tens = []; }
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
    const [semi, deg] = bass === "3" ? [thirdOf(type.id), 3] : bass === "5" ? [fifthOf(type.id), 5] : BASS[bass];
    const b = spell(role.root, semi, deg);
    // 베이스가 실제 구성음일 때만 (7alt는 완전5도가 없어 G7alt/D가 되면 틀린 코드 — 그때는 기본형으로)
    if (q.tones.some(t => t.pc === b.pc)) Object.assign(q, { bass: b.name, bassPc: b.pc, slash: "inv", symbol: q.symbol + "/" + b.name });
  }
  return q;
}

/**
 * 역할을 코드로 (기본형): 코드 종류를 비율대로. 분수코드 허용이면 V7sus4 자리·(난이도 4부터) 도미넌트·토닉·IV 자리를 가끔 하이브리드로.
 * 전위형은 여기서 붙이지 않음 — bassLine이 진행을 다 만든 뒤에. forced = 패턴이 정한 { type, bass }(라인 클리셰)
 */
function realize(role, o, rnd, forced) {
  const typeId = forced?.type || pickBy(role.types, t => t[1], rnd)[0];
  if (!forced && o.slash) {
    if (role.sus && rnd() < (SUS_HYBRID_ODDS[o.level] ?? 0.2)) return makeHybrid(role, susHybrids(o.level), o, rnd);
    const swap = SWAP_ODDS[o.level] || 0;
    if (swap && rnd() < swap) {
      if (isDominant(role) && !role.sus && (role.id === "V" || role.kind === "sec")) return makeHybrid(role, susHybrids(o.level), o, rnd);
      if (role.kind === "dia" && ["I", "i", "IV", "iv"].includes(role.id)) return makeHybrid(role, PEDAL_HYBRIDS, o, rnd);
    }
  }
  const q = makeChord(role, typeId, forced?.bass || null, o, rnd);
  if (q?.bass) q.why = "pattern";
  return q;
}

const step = (a, b) => { const d = iv(a, b); return d === 1 || d === 2 ? 1 : d === 10 || d === 11 ? -1 : 0; };   // 순차 상행 1 · 하행 -1 · 아니면 0

/** 전위형 후보: [베이스 종류, 근음에서 반음, 도수] — sus는 3음 없음, M7의 7음 베이스(CM7/B)·6음 베이스는 부딪혀서 안 씀, dim7·aug는 전위 안 함 */
function inversionsOf(q) {
  const t = q.type;
  if (q.alt || /^(dim7|aug)/.test(t)) return [];
  const list = [];
  if (!/sus/.test(t)) list.push(["3", thirdOf(t), 3]);
  list.push(["5", fifthOf(t), 5]);
  if (hasMinor7(t)) list.push(["b7", 10, 7]);
  return list;
}

/** 이 베이스(전위형)가 다음 베이스에 요구하는 해결 — 지키면 true */
function resolves(kind, role, bass, next) {
  if (kind === "b7") return next === bass || step(bass, next) === -1;          // 7음 베이스: 아래로 순차 (페달이면 그대로)
  if (kind === "3" && role && isDominant(role)) return iv(bass, next) === 1;    // 도미넌트의 이끔음 베이스: 반음 위로
  return true;
}

/**
 * 베이스 라인 단계: 기본형으로 만든 진행에 전위형을 붙임 (위 설명 참고). 같은 마디의 같은 이름 코드(C – C)는 반드시 전위형으로 바꿈.
 * @param chords  [q] 진행 순서대로 (q.roleObj = 역할), 이 함수가 q를 바꿈
 * @param flat    자리 목록 { bar, idx, len … }
 * @param random  개연성 랜덤 — 용법·해결 없이 코드마다 RANDOM_INV
 */
function bassLine(chords, flat, o, rnd, fits, key, random = false) {
  if (!o.slash) return;
  const n = chords.length;
  const tonic = Engine.pcOf(key.l, key.a), dominant = (tonic + 7) % 12;
  const upper = c => c.rootName + c.label;   // 베이스를 뺀 코드 이름
  for (let i = 0; i < n; i++) {
    const q = chords[i], role = q.roleObj, prev = chords[i - 1], nextQ = chords[(i + 1) % n];
    const sameBarPrev = prev && flat[i - 1].bar === flat[i].bar ? prev : null;
    const must = !!(sameBarPrev && sameBarPrev.symbol === q.symbol);   // C – C (같은 마디) → 이름이 달라지게
    if (q.bass || !role || /^cliche/.test(q.pattern || "")) continue;   // 하이브리드·라인 클리셰는 그대로
    const prevBass = prev ? prev.bassPc : null, next = nextQ.bassPc;
    // 앞 코드의 전위가 이 코드의 베이스에 기대고 있으면(7음·이끔음 해결, 경과 베이스의 방향) 그걸 깨는 전위는 안 됨
    const before2 = chords[i - 2];
    const prevNeeds = b => !prev || prev.slash !== "inv" || random ||
      (resolves(prev.invKind, prev.roleObj, prev.bassPc, b) && (prev.why !== "passing" || step(before2.bassPc, prev.bassPc) === step(prev.bassPc, b)));
    const opts = inversionsOf(q).map(([kind, semi, deg]) => ({ kind, semi, deg, pc: (q.rootPc + semi) % 12 }))
      .filter(x => q.tones.some(t => t.pc === x.pc) && prevNeeds(x.pc) && (random || resolves(x.kind, role, x.pc, next)));
    let pick = null;
    if (random) {
      if (opts.length && (must || rnd() < RANDOM_INV)) pick = { ...opts[Math.floor(rnd() * opts.length)], why: "random" };
    } else {
      const uses = [];
      for (const x of opts) {
        if (prevBass != null && step(prevBass, x.pc) && step(prevBass, x.pc) === step(x.pc, next)) uses.push({ ...x, why: "passing" });
        else if (prev && upper(prev) === upper(q)) uses.push({ ...x, why: "same" });   // 같은 코드 안의 전위 (C – C/G)
        else if (x.kind === "5" && /^(I|i)$/.test(q.role) && isDominant(nextQ.roleObj || {}) && nextQ.rootPc === x.pc) uses.push({ ...x, why: "cad64" });
        // 페달: 토닉 베이스를 유지(C – F/C), 또는 도미넌트 베이스를 유지하고 다음도 그 베이스(G – C/G – G7)
        else if (prevBass === x.pc && (x.pc === tonic || (x.pc === dominant && next === dominant))) uses.push({ ...x, why: "pedal" });
      }
      if (must && opts.length) pick = (uses.length ? uses : opts.map(x => ({ ...x, why: "same" })))[Math.floor(rnd() * (uses.length || opts.length))];
      else if (uses.length && rnd() < (USE_ODDS[o.chance] || 0)) pick = uses[Math.floor(rnd() * uses.length)];
      else if (opts.length && rnd() < (FREE_ODDS[o.level] || 0)) pick = { ...opts[Math.floor(rnd() * opts.length)], why: "free" };
    }
    if (!pick) continue;
    const b = spell(role.root, pick.semi, pick.deg);
    const inv = { ...q, bass: b.name, bassPc: b.pc, slash: "inv", invKind: pick.kind, why: pick.why, symbol: q.symbol + "/" + b.name };
    // 긴 코드 자리 규칙: 이 마디의 다른 코드(앞·뒤 모두 — 화성은 이미 다 정해짐)와 함께 검사
    const barOthers = chords.filter((_, k) => k !== i && flat[k].bar === flat[i].bar);
    if (!fits(inv, flat[i], barOthers)) continue;
    if (sameBarPrev && sameBarPrev.symbol === inv.symbol) continue;
    Object.assign(q, inv);
  }
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
  o = { ...o, scale: scaleOf(key) };
  const roles = buildRoles(key, o.level);
  const chords = [];
  let prevBass = null;
  for (const bar of slots) {
    const out = [];
    for (const slot of bar) {
      let q = null;
      for (let k = 0; k < 40 && !q; k++) {
        // 종류별 비율: 디미니시드는 역할 수가 많아서 하나하나를 낮게(전체에서 가끔만) — 다이아토닉·세컨더리 1, II-minor 0.7, 디미니시드 0.25,
        // SubV7·서브도미넌트 마이너 0.6, 모달 인터체인지 0.4
        const role = pickBy(roles, r => ({ dia: 1, sec: 1, ii: 0.7, dim: 0.25, subv: 0.6, sdm: 0.6, modal: 0.4 })[r.kind] || 1, rnd);
        const c = realize(role, k < 30 ? o : { ...o, tension: "off", slash: false }, rnd);
        // 난이도 1부터: 5마디 첫 코드는 1마디 첫 코드와 다른 코드(이름 전체로 비교, 2026-11-13)
        const sameAsBar1 = o.level >= 1 && chords.length === 4 && !out.length && c && c.symbol === chords[0][0].symbol;
        if (c && !sameAsBar1 && c.bassPc !== prevBass && fits(c, slot, out)) q = tag(c, role, null);
      }
      q = q || tag(makeChord(roles[0], key.minor ? "min" : "maj", null, { ...o, tension: "off" }, rnd), roles[0], null);
      out.push(q); prevBass = q.bassPc;
    }
    chords.push(out);
  }
  capTensions(chords.flat(), o, rnd);
  // 분수코드: 용법과 상관없이 코드마다 RANDOM_INV (하이브리드는 realize가 난이도별로)
  bassLine(chords.flat(), slots.flatMap((bar, b) => bar.map((sl, i) => ({ ...sl, bar: b, idx: i }))), o, rnd, fits, key, true);
  return { key, chords, violations: [] };
}

/** 조의 음계 pc 집합 (단조는 자연단음계) — 난이도 0·1의 텐션 거르기용 */
const scaleOf = key => new Set((key.minor ? MINOR : MAJOR).map(x => (Engine.pcOf(key.l, key.a) + x) % 12));

/** 난이도 0: 텐션이 붙은 코드는 8마디에 하나까지 — 두 번째부터는 텐션을 떼고 다시 만듦 (사용자 결정 2026-11-13) */
function capTensions(chords, o, rnd) {
  if (o.level !== 0 || o.tension === "off") return;
  let seen = false;
  for (const q of chords) {
    if (!q.tens.length && !q.alt) continue;
    if (!seen) { seen = true; continue; }
    const plain = makeChord(q.roleObj, q.type, null, { ...o, tension: "off" }, rnd);
    if (plain) Object.assign(q, plain);
  }
}

/** 코드에 역할 정보를 붙임 (roleObj는 베이스 라인 단계용 — 화면·테스트에 안 보이게 열거 안 됨) */
function tag(q, role, pattern) {
  Object.defineProperty(q, "roleObj", { value: role, enumerable: false, writable: true });
  return Object.assign(q, { role: role.id, kind: role.kind, fn: role.fn, pattern });
}

function chooseKey(rnd) {
  const minor = rnd() < 0.5;   // 장·단조 반반 (사용자 결정 19)
  const [name] = pickBy(minor ? MINOR_KEYS : MAJOR_KEYS, k => k[1], rnd);
  return { ...parseName(name), minor, name: name + (minor ? "m" : "") };
}

function attempt(o, slots, rnd, fits) {
  const key = chooseKey(rnd);
  o = { ...o, scale: scaleOf(key) };
  const roles = buildRoles(key, o.level);
  const byId = Object.fromEntries(roles.map(r => [r.id, r]));
  const ctx = { table: key.minor ? TABLE_MINOR : TABLE_MAJOR, rows: rowsFor(key.minor), byId, level: o.level, chance: o.chance, count: f => roles.filter(f).length || 1 };
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
    const firstId = it => (Array.isArray(it) ? it[0] : it);
    const pool = pats.filter(p => o.chance === 1 || !used.includes(p.name)).filter(p => start + p.seq.length <= flat.length && p.seq.every((_, j) => !out[start + j]))
      // 난이도 1부터: 5마디 패턴이 1마디 패턴과 같은 코드(같은 역할·종류·베이스)로 시작하지 않게 — 종류·베이스를 정하지 않은 같은 역할이면 아직 같을 수 있어 뺌
      .filter(p => !(o.level >= 1 && startBar === 4 && out[0] && firstId(p.seq[0]) === out[0].item[0] && !Array.isArray(p.seq[0]) && out[0].item.length === 1));
    if (!pool.length) continue;
    const p = pool[Math.floor(rnd() * pool.length)];
    used.push(p.name);
    p.seq.forEach((it, j) => { out[start + j] = { pattern: p.name, item: Array.isArray(it) ? it : [it] }; });
  }

  // 한 자리씩
  const chords = [];
  let prev = null, pending = null;
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
        const c = realize(role, opt, rnd, forced && opt.slash === false ? { ...forced, bass: null } : forced);
        // 같은 마디에서 바로 앞과 같은 이름(C – C)은 베이스 라인 단계에서 전위형으로 바꿀 수 있을 때만
        const before = barOf(n).at(-1);
        if (c && before && before.symbol === c.symbol && !(o.slash && inversionsOf(c).length)) continue;
        if (c && fits(c, slot, barOf(n))) { q = c; break; }
      }
      if (!q) cand = cand.filter(c => c[0] !== role);
    }
    if (!q) {   // 마지막 수단: 이 조의 토닉 3화음 (짧아서 어디든 맞음)
      role = byId[key.minor ? "i" : "I"];
      q = makeChord(role, key.minor ? "min" : "maj", null, { ...o, tension: "off" }, rnd);
    }
    // 라인 클리셰로 늘이기 (위 clicheFor) — 첫 코드도 클리셰의 첫 코드로 바꿈
    const barPulses = slots[slot.bar].reduce((a, sl) => a + sl.len, 0);
    if (!out[n] && (slot.idx === 0 || (barPulses === 4 && slot.start === 2)) && o.chance <= 3 && CLICHE_DEG[role.id] && rnd() < (CLICHE_ODDS[o.chance] || 0) * CLICHE_DEG[role.id] * (CLICHE_LOW_LEVEL[o.level] ?? 1)) {
      const cl = clicheFor(role, key, o.level, rnd);
      const end = cl && n + cl.items.length - 1;
      const span = cl && end < flat.length ? flat[end].bar - slot.bar + 1 : 99;
      // 시작 자리: 한 마디 안이면 1~7마디 어디서든, 2마디면 1·3·5·7마디, 그보다 길면 1·5마디 — 마디 첫 박에서.
      // 4박 마디에서 2박짜리(1박 코드 둘)는 셋째 박에서도 (사용자 결정 2026-11-13)
      const pulses = cl ? cl.items.reduce((a, _, j) => a + (flat[n + j]?.len || 99), 0) : 99;
      const startOk = slot.idx === 0 ? (span === 1 ? slot.bar <= 6 : span === 2 ? [0, 2, 4, 6].includes(slot.bar) : span <= 4 && [0, 4].includes(slot.bar))
        : span === 1 && pulses === 2 && slot.bar <= 6;
      if (cl && startOk && cl.items.every((_, j) => !out[n + j]) && rnd() < (span > 2 ? CLICHE_LONG : span === 2 && cl.items.length === 2 ? CLICHE_BAR_EACH : 1)) {
        // 미리 만들어 긴 코드 자리 규칙에 맞는지 (텐션 없이)
        const pre = [];
        const ok = cl.items.every(([id, t, b], j) => {
          const c = byId[id] && makeChord(byId[id], t, b, { ...o, tension: "off" }, rnd);
          const bar = [...barOf(n + j), ...pre.filter((_, i) => flat[n + i].bar === flat[n + j].bar)];
          if (!c || !fits(c, flat[n + j], j ? bar : barOf(n))) return false;
          pre.push(c); return true;
        });
        if (ok) {
          cl.items.forEach((it, j) => { out[n + j] = { pattern: cl.name, item: it }; });
          used.push(cl.name);
          q = pre[0];
          if (q.bass) q.why = "pattern";   // 두 번째 코드부터면 첫 코드가 mM7/7
        }
      }
    }
    tag(q, role, out[n]?.pattern || null);
    chords.push(q);
    // 지연 해결 기억: 도미넌트 다음에 해결이 아닌 다이아토닉이 왔으면 다음 2코드 안에 원래 목표가 오도록 점수를 올림
    if (prev && isDominant(prev) && role.root.pc !== prev.target && role.kind === "dia" && role.fn !== "D") pending = { pc: prev.target, left: 2 };
    else if (pending && (role.root.pc === pending.pc || --pending.left <= 0)) pending = null;
    prev = role;
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
      // 평행 악절: 5마디 첫 코드 = 1마디 첫 코드(×4, 난이도 0만) 또는 3도 위아래 대리화음(×2)
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

  capTensions(chords, o, rnd);
  // 베이스 라인: 화성을 다 정한 뒤 전위형 (위 bassLine)
  bassLine(chords, flat, o, rnd, fits, key);

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
  // II-V 최소: 개연성 1 → 2번, 2 → 1번. 라인 클리셰가 2마디 이상을 차지하면 하나 줄임 (남은 마디가 적어서 — 사용자 결정 2026-11-13, 4마디 → 2마디는 클리셰 비율을 맞추며 Claude가 바꿈)
  const clicheBars = new Set(flat.filter((s, n) => /^cliche/.test(chords[n].pattern || "")).map(s => s.bar)).size;
  const need = Math.max(0, ({ 1: 2, 2: 1 }[o.chance] || 0) - (clicheBars >= 2 ? 1 : 0));
  if (countIIV(chords) < need) v.push("II-V " + countIIV(chords) + "/" + need);
  // 같은 2코드 묶음 3번 이상 (패턴 밖)
  const pairs = {};
  for (let i = 1; i < chords.length; i++) if (!chords[i].pattern) { const k = chords[i - 1].symbol + ">" + chords[i].symbol; pairs[k] = (pairs[k] || 0) + 1; }
  if (Object.values(pairs).some(n => n >= 3)) v.push("repeat pair");
  // 1–4마디와 5–8마디가 완전히 같음 (개연성 1도 금지)
  const half = (a, b) => flat.map((s, n) => (s.bar >= a && s.bar < b ? chords[n].symbol : null)).filter(Boolean).join(" ");
  if (half(0, 4) === half(4, 8)) v.push("halves identical");
  // 같은 마디 안에서 같은 이름이 연달아 (C – C) — 전위형으로 못 바꾼 경우
  if (chords.some((c, i) => i && flat[i].bar === flat[i - 1].bar && c.symbol === chords[i - 1].symbol)) v.push("same chord in a bar");
  // 난이도 1부터: 1마디 첫 코드와 5마디 첫 코드가 같은 코드면 안 됨 — 코드 이름 전체로 비교(CM7 → C6·C/E는 다른 코드, 사용자 결정 2026-11-13)
  const bar5 = flat.findIndex(s => s.bar === 4);
  if (o.level >= 1 && chords[0].symbol === chords[bar5].symbol) v.push("bar 5 = bar 1");
  // 개연성 2부터: 같은 패턴 두 번 이상 금지
  if (o.chance >= 2 && new Set(used).size !== used.length) v.push("pattern twice");
  // 다이아토닉 밖 코드 연속: 난이도 2는 최대 2개, 3부터 4개 (Extended Dominant 사슬 최대 4개 — docs §1)
  let run = 0, maxRun = 0;
  for (const c of chords) { run = c.kind === "dia" || c.kind === "surprise" ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
  if (maxRun > (o.level < 2 ? 0 : o.level < 3 ? 2 : 4)) v.push("non-diatonic run " + maxRun);
  return v;
}
