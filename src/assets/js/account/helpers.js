// ===== 회원 기능 — 화면·DB와 상관없는 작은 규칙들 =====
// 순수 함수만 있어서 Node에서 바로 테스트해요 (tests/account.test.js).

/** 가입할 때 동의하는 약관·개인정보처리방침의 날짜. 두 페이지를 고치면 이 값과 두 페이지의 시행일을 함께 바꿀 것 */
export const TERMS_VERSION = "2026-11-05";
export const PW_MIN = 8, NICK_MAX = 20, NAME_MAX = 50;
/** 탈퇴 유예 기간(일). supabase/schema.sql의 interval '7 days' 두 곳과 같아야 함 */
export const GRACE_DAYS = 7;

// 계정에 올리지 않고 기기마다 따로 두는 설정 (폰에는 컴퓨터 키보드가 없으니까)
const LOCAL_ONLY = ["kbd", "kbdTouched"];
// 모든 회원이 꼭 가져야 하는 프로필 항목. 항목이 늘면 여기에 넣고, 예전 회원은 다음 로그인 때 "정보 추가 입력" 창에서 채워요
// (순서는 docs/supabase-setup.md "회원가입 항목 추가").
const REQUIRED = ["full_name"];

/** Supabase 오류 → 화면 문구 키(i18n) */
export function errorKey(err) {
  if (!err) return "errGeneric";
  const code = err.code || "", msg = String(err.message || "");
  const byCode = {
    invalid_credentials: "errInvalid", email_not_confirmed: "errNotConfirmed",
    user_already_exists: "errExists", email_exists: "errExists",
    weak_password: "errWeak", same_password: "errSamePw", email_address_invalid: "errEmail",
    over_email_send_rate_limit: "errRate", over_request_rate_limit: "errRate",
  };
  if (byCode[code]) return byCode[code];
  if (err.status === 429) return "errRate";
  if (err.name === "AuthRetryableFetchError" || err.status === 0 || /fetch|network/i.test(msg)) return "errNetwork";
  return "errGeneric";
}

// 기기 시간대 → 가입 화면의 언어 기본값. 위치 권한 팝업이 뜨지 않게 GPS 대신 시간대로 지역을 짐작 (사용자 결정 2026-10-27)
const TZ_LANG = [[/^Asia\/(Seoul|Pyongyang)$/, "ko"], [/^Asia\/Tokyo$/, "ja"],
  [/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar|Hong_Kong|Macau|Taipei)$|^PRC$|^ROC$/, "zh"]];
export function langForTimeZone(tz) {
  for (const [re, lang] of TZ_LANG) if (re.test(tz || "")) return lang;
  return "en";
}

/** 소셜 로그인으로 처음 들어와 아직 14세 확인·약관 동의를 안 한 회원인지 (DB의 complete_signup으로 채워짐) */
export const needsConsent = p => !!p && (!p.age14_confirmed || !p.terms_version);

/** 프로필에서 비어 있는 필수 항목 목록 */
export const missingFields = p => REQUIRED.filter(k => !p || p[k] == null || String(p[k]).trim() === "");

/** 계정에 올릴 출제 설정 (기기별 설정은 뺌) */
export function syncable(settings) {
  const out = { ...settings };
  LOCAL_ONLY.forEach(k => delete out[k]);
  return out;
}

/** 공개 키(anon / publishable)면 true. 비밀 키(secret / service_role)는 사이트에 절대 실으면 안 돼서 false */
export function isPublicKey(key) {
  if (!key) return false;
  if (/^sb_secret_/.test(key)) return false;
  if (/^sb_publishable_/.test(key)) return true;
  const part = key.split(".")[1];   // 예전 형식(JWT): 가운데 부분에 role이 들어 있음
  if (!part) return false;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json).role === "anon";
  } catch (e) { return false; }
}
