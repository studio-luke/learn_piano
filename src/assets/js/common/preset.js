// ===== 출제 설정 공유 링크 — 값 만들기·읽기 (순수 함수, 2026-11-10) =====
// 화면(버튼·확인 창)은 common/share-settings.js. 브라우저 없이 테스트하려고(tests/preset.test.js) 따로 둠.
// 링크 형식·공유하는 항목은 share-settings.js 머리 주석.
export const PRESET_PARAM = "preset";
const VERSION = "1";
const MAX_LEN = 600;   // 이보다 긴 값은 읽지 않음 (코드 종류를 전부 골라도 200자 안팎)
// 옵션 글자 ↔ 설정 이름 (켜짐/꺼짐). 코드 초견(2026-11-10): S 분수코드 허용, H ½마디·L 2마디(둘 다 없으면 1마디) —
// 마디수는 켜짐/꺼짐이 아니라서 페이지가 barsHalf·barsTwo로 바꿔 넘기고 받아서 되돌림(pages/improv.js)
const FLAGS = { B: "optB", C: "optC", D: "optD", E: "optE", I: "optInv", S: "slash", H: "barsHalf", L: "barsTwo" };

/**
 * 페이지별 규칙 (어떤 코드 종류·옵션을 담을 수 있는지).
 * @typedef {{ route: string, types: string[], flags: string[] }} PresetSpec
 *   route  링크가 가리킬 페이지(sitemap.js ROUTES), types  그 페이지의 코드 종류 id, flags  그 페이지의 옵션 글자(FLAGS의 키)
 */

/** 출제 설정 → ?preset 값 (순수 함수) */
export function encodePreset(S, spec) {
  const types = spec.types.filter(id => S.types && S.types[id]);
  const bases = (S.bases || []).map((on, pc) => (on ? pc : -1)).filter(pc => pc >= 0);
  const flags = spec.flags.filter(f => S[FLAGS[f]]).join("");
  return [VERSION, types.join("."), bases.join("."), S.cMax === 2 ? 2 : 1, flags].join("-");
}

/**
 * ?preset 값 → 출제 설정 일부 (순수 함수). 잘못된 값이면 null.
 * 돌려주는 것은 그 페이지에서 담을 수 있는 항목 전부(types는 모든 코드 종류의 켜짐/꺼짐) — 링크에 없는 옵션은 꺼짐.
 * 모르는 코드 종류 id·옵션 글자는 건너뜀(나중에 생긴 것일 수 있어서), 출제할 코드 종류가 하나도 없으면 null.
 */
export function decodePreset(value, spec) {
  if (typeof value !== "string" || !value || value.length > MAX_LEN || !/^[A-Za-z0-9.-]+$/.test(value)) return null;
  const parts = value.split("-");
  if (parts.length !== 5 || parts[0] !== VERSION) return null;
  const [, typePart, basePart, cMaxPart, flagPart] = parts;
  const wanted = new Set(typePart ? typePart.split(".") : []);
  const types = Object.fromEntries(spec.types.map(id => [id, wanted.has(id)]));
  if (!Object.values(types).some(Boolean)) return null;
  const bases = Array(12).fill(false);
  for (const s of basePart ? basePart.split(".") : []) {
    if (!/^\d{1,2}$/.test(s) || +s > 11) return null;
    bases[+s] = true;
  }
  if (cMaxPart !== "1" && cMaxPart !== "2") return null;
  const out = { types, bases, cMax: +cMaxPart };
  for (const f of spec.flags) out[FLAGS[f]] = flagPart.includes(f);
  return out;
}

/**
 * 링크의 설정(decodePreset 결과)이 지금 설정과 같은지 (순수 함수) — 같으면 "바꿀까요?" 창을 띄우지 않음 (2026-11-10 사용자 요청).
 * 화면에 차이가 없는 값은 같은 것으로 봄: 특정 베이스가 꺼져 있으면 베이스 목록, 텐션이 꺼져 있으면 텐션 개수는 비교하지 않음
 * @param cur  지금 설정 (페이지의 S, 코드 초견은 presetSource()처럼 링크에 담는 모양으로 바꾼 것)
 */
export function samePreset(p, cur, spec) {
  if (spec.types.some(id => !!(cur.types && cur.types[id]) !== !!p.types[id])) return false;
  for (const f of spec.flags) if (!!cur[FLAGS[f]] !== !!p[FLAGS[f]]) return false;
  if (p.optB && (cur.bases || []).some((on, pc) => !!on !== p.bases[pc])) return false;
  if (p.optC && (cur.cMax === 2 ? 2 : 1) !== p.cMax) return false;
  return true;
}

// ---------- 코드 초견의 화성 진행 연습 · 8마디 초견 (2026-11-16 사용자 요청) ----------
// 코드 종류를 고르지 않는 탭이라 위 형식 대신 탭마다 따로. 주소에 탭(mode)도 담아 그 탭으로 열림:
//   화성 진행 연습  ?mode=harmony&hpreset=1-<화성 범위 0~5>-<키>-<텐션 개수 1|2|h>-<개연성 0~2>-<옵션 글자>
//     키: 근음 글자 + s(♯)·b(♭) (예: C, Fs, Bb) — 장·단조는 옵션 글자 M
//     옵션 글자: K 키 고정 · M 단조 · S 분수코드 출제 허용 · T 텐션 허용 · U 텐션 비중 높이기 · V 분수코드 비중 높이기 · H ½마디 · L 2마디
//   8마디 초견     ?mode=prog&ppreset=1-<코드 개수 0~3>-<난이도 0~6>-<개연성 0~3>-<텐션 개수 1|2|h>-<옵션 글자>
//     옵션 글자: T 텐션 허용 · S 분수코드 출제 허용 · M 다양한 박자표 허용
// 링크에 없는 옵션 글자는 꺼짐. 화면에 차이가 없는 값(키 고정이 꺼졌을 때의 키, 텐션이 꺼졌을 때의 개수 등)은 같은 설정으로 봄.
const TEN_CODE = { 1: "1", 2: "2", hard: "h" };
const TEN_OF = { 1: "1", 2: "2", h: "hard" };
/** "0~max 사이 정수" 글자만 숫자로, 아니면 null */
const intIn = (s, max) => (/^\d$/.test(s) && +s <= max ? +s : null);
/** 출제 설정의 켜짐/꺼짐 항목과 옵션 글자 */
const H_FLAGS = { K: "hKeyFix", M: "hMinor", S: "hSlash", T: "hTen", U: "hTenUp", V: "hSlashUp", H: "barsHalf", L: "barsTwo" };
const P_FLAGS = { T: "ten", S: "slash", M: "meters" };
const flagsOf = (S, map) => Object.keys(map).filter(f => S[map[f]]).join("");
function readFlags(s, map, out) {
  if (!/^[A-Z]*$/.test(s)) return null;
  for (const [f, k] of Object.entries(map)) out[k] = s.includes(f);
  return out;
}
/** 공통 겉모양 검사: 글자 종류·길이·버전·칸 수 → 칸 목록 또는 null */
function parts(value, n) {
  if (typeof value !== "string" || !value || value.length > 60 || !/^[A-Za-z0-9.-]+$/.test(value)) return null;
  const p = value.split("-");
  return p.length === n && p[0] === VERSION ? p : null;
}

/** 화성 진행 연습: 출제 설정(presetSource() 모양 — barsHalf·barsTwo 포함) → hpreset 값 */
export function encodeHarmony(S) {
  const root = (S.hRoot || "C").replace("♯", "s").replace("♭", "b");
  return [VERSION, S.hStage, root, TEN_CODE[S.hTenMax] || "1", S.hChance, flagsOf(S, H_FLAGS)].join("-");
}
/** hpreset 값 → 출제 설정 일부 (잘못되면 null). 키 이름이 그 조에 없는 철자면 페이지(applyPreset)가 같은 근음으로 맞춤 */
export function decodeHarmony(value) {
  const p = parts(value, 6);
  if (!p) return null;
  const [, stage, root, ten, chance, flags] = p;
  const m = root.match(/^([A-G])([sb]?)$/);
  if (intIn(stage, 5) == null || !m || !TEN_OF[ten] || intIn(chance, 2) == null) return null;
  return readFlags(flags, H_FLAGS, { hStage: +stage, hRoot: m[1] + ({ s: "♯", b: "♭" }[m[2]] || ""), hTenMax: TEN_OF[ten], hChance: +chance });
}
/** 화성 진행 연습: 링크 설정 p가 지금 설정 cur와 같은지 (화면에 차이가 없는 값은 비교하지 않음) */
export function sameHarmony(p, cur) {
  if (p.hStage !== cur.hStage || p.hChance !== cur.hChance) return false;
  for (const k of ["hKeyFix", "hSlash", "hTen", "barsHalf", "barsTwo"]) if (!!p[k] !== !!cur[k]) return false;
  if (p.hKeyFix && (p.hRoot !== cur.hRoot || !!p.hMinor !== !!cur.hMinor)) return false;
  if (p.hTen && (p.hTenMax !== cur.hTenMax || !!p.hTenUp !== !!cur.hTenUp)) return false;
  if (p.hSlash && !!p.hSlashUp !== !!cur.hSlashUp) return false;
  return true;
}

/** 8마디 초견: 출제 설정(improv/prog-settings.js S) → ppreset 값 */
export function encodeProg(S) {
  return [VERSION, S.count, S.level, S.chance, TEN_CODE[S.tenMax] || "1", flagsOf(S, P_FLAGS)].join("-");
}
/** ppreset 값 → 출제 설정 일부 (잘못되면 null) */
export function decodeProg(value) {
  const p = parts(value, 6);
  if (!p) return null;
  const [, count, level, chance, ten, flags] = p;
  if (intIn(count, 3) == null || intIn(level, 6) == null || intIn(chance, 3) == null || !TEN_OF[ten]) return null;
  return readFlags(flags, P_FLAGS, { count: +count, level: +level, chance: +chance, tenMax: TEN_OF[ten] });
}
/** 8마디 초견: 링크 설정이 지금 설정과 같은지 */
export function sameProg(p, cur) {
  if (p.count !== cur.count || p.level !== cur.level || p.chance !== cur.chance) return false;
  if (!!p.slash !== !!cur.slash || !!p.meters !== !!cur.meters || !!p.ten !== !!cur.ten) return false;
  return !p.ten || p.tenMax === cur.tenMax;
}
