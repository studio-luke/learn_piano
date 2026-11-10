// ===== 성명(실명) 형식 검사 (2026-11-10 사용자 결정) =====
// 선생님이 학생을 구분할 수 있게 가입할 때 장난스러운 이름을 걸러요. 순수 함수라 Node에서 테스트해요 (tests/account.test.js).
//
// 결과 세 가지
//   ok    통과
//   hard  유효하지 않은 이름 — 고쳐야 가입됨. 같은 규칙을 DB(supabase/schema.sql name_hard_ok)도 다시 검사해요
//   soft  한글 이름인데 흔한 모양이 아님 — 실제 이름일 수도 있어서 본인이 [확인]을 누르면 통과 (화면에서만 검사)
//
// 규칙
//   공통   숫자·기호·이모지 없음, 한글·영문·한자/가나 중 한 가지 글자만, 같은 글자 세 번 연속 없음(aaa, 하하하), 50자까지
//   한글   2~5글자(중간 빈칸은 지움), 자음·모음만 따로 있는 글자(ㄱ, ㅓ) 없음
//          soft: 일상에서 쓰는 한글 2,350자(KS X 1001 완성형) 밖의 글자(괤, 쀍, 믜), 첫 글자가 한국 성씨가 아님
//   영문   글자·빈칸·하이픈·아포스트로피만, 두 단어 이상·글자 4개 이상(Li Na는 됨, ab는 안 됨),
//          키보드를 따라 친 글자(qwer, asdf, zxcv, hjkl, uiop과 거꾸로) 없음
//          soft: 읽을 수 없는 단어 — 모음(a e i o u y, 악센트 모음)이 없거나 자음이 6개 이상 이어짐 (2026-11-10).
//          한 글자 단어(이니셜 F)와 Ng(성씨)는 검사하지 않음. 5개 이어짐은 실제 이름(Engstrom)이 있어서 허용
//   한자·가나(일본어·중국어 이름)  2~10글자(빈칸·가운뎃점 빼고), 가운뎃점(·, ・) 허용 — 실명 판별이 어려워 막친 글자만 거름
import { NAME_MAX } from "./helpers.js";

const HANGUL = /^[가-힣 ]+$/;
const JAMO = /[ᄀ-ᇿㄱ-ㆎ]/;   // 자음·모음만 있는 글자 (호환용 자모 ㄱ~ㆎ, 첫가끝 자모)
const LATIN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const LATIN_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;
const CJK = /^[぀-ヿ㐀-鿿· ]+$/;   // 히라가나·가타카나(・ ー 포함), 한자, 가운뎃점
const KEYBOARD = /qwer|asdf|zxcv|hjkl|uiop|rewq|fdsa|vcxz|lkjh|poiu/;
const VOWEL = /[aeiouyà-æè-ïò-öø-ýÿ]/;           // y도 모음으로 (Lynn, Glynn, Sky)
const CONSONANTS6 = /[^aeiouyà-æè-ïò-öø-ýÿ]{6}/;
/** 영문 이름에 읽을 수 없는 단어가 있는지 (하이픈·아포스트로피로 나뉜 조각마다, 소문자로) */
const unreadable = name => name.toLowerCase().split(/[ '-]+/)
  .some(w => w.length > 1 && w !== "ng" && (!VOWEL.test(w) || CONSONANTS6.test(w)));

// 한국 성씨 (두 글자 성 먼저). 목록에 없는 드문 성은 soft라 본인이 [확인]으로 통과할 수 있어요
const SURNAMES2 = ["남궁", "제갈", "선우", "서문", "독고", "황보", "사공", "동방", "어금", "망절", "소봉", "장곡", "강전"];
const SURNAMES1 = new Set([..."가간갈감강개견경계고곡공곽관교구국군궁궉권근금기길김나남노뇌누단담당대도독돈동두등라랑량려렴로뢰룡류륙리림마만매맹명모목묘무묵문미민박반방배백번범변보복봉부비빈빙사삼상서석선설섭성소손송수순승시신심십아안애야양어엄여연염엽영예오옥온옹왕요용우운웅원위유육윤은음이인임자장전점정제조종좌주준즙증지진차창채천초최추춘탁탄태판팽편평포표풍피필하학한함해허혁현형호홍화환황효후흥"]);

// 일상에서 쓰는 한글 2,350자: 브라우저·Node가 아는 EUC-KR(KS X 1001) 글자표로 처음 쓸 때 한 번 만듦
let common = null;
function commonHangul() {
  if (common) return common;
  common = new Set();
  try {
    const dec = new TextDecoder("euc-kr");
    for (let a = 0xb0; a <= 0xc8; a++) for (let b = 0xa1; b <= 0xfe; b++) {
      const ch = dec.decode(new Uint8Array([a, b]));
      if (/^[가-힣]$/.test(ch)) common.add(ch);
    }
  } catch (e) { /* EUC-KR을 모르는 환경: 이 검사는 건너뜀 (빈 표 → 아래에서 통과) */ }
  return common;
}

/** 빈칸 정리: 앞뒤 빈칸을 자르고 중간 빈칸은 하나로. 한글 이름은 빈칸을 모두 지움 ("김 철수" → "김철수") */
export function normalizeName(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  return HANGUL.test(s) ? s.replace(/ /g, "") : s;
}

/**
 * 성명 검사.
 * @returns { name: 정리한 이름(저장할 값), level: "ok" | "soft" | "hard", script: "ko" | "en" | "cjk" | null (어느 글자의 이름인지 — soft 안내 문구용) }
 */
export function checkName(raw) {
  const name = normalizeName(raw);
  const script = HANGUL.test(name) ? "ko" : LATIN.test(name) ? "en" : CJK.test(name) ? "cjk" : null;
  const out = level => ({ name, level, script });
  if (!name || name.length > NAME_MAX || JAMO.test(name) || /(.)\1\1/u.test(name.toLowerCase())) return out("hard");
  if (HANGUL.test(name)) {
    if (name.length < 2 || name.length > 5) return out("hard");
    const set = commonHangul();
    if (set.size && [...name].some(ch => !set.has(ch))) return out("soft");
    const given = SURNAMES2.some(s => name.startsWith(s)) ? name.slice(2) : SURNAMES1.has(name[0]) ? name.slice(1) : "";
    return out(given ? "ok" : "soft");
  }
  if (LATIN.test(name)) {
    const words = name.split(" ");
    const letters = (name.match(LATIN_LETTER) || []).length;
    if (words.length < 2 || letters < 4 || KEYBOARD.test(name.toLowerCase())) return out("hard");
    return out(unreadable(name) ? "soft" : "ok");
  }
  if (CJK.test(name)) {
    const n = name.replace(/[ ·・]/g, "").length;
    return out(n >= 2 && n <= 10 ? "ok" : "hard");
  }
  return out("hard");
}
