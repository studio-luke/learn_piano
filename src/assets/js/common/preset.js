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
