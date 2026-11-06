// ===== 회원 기능 — 로그인 상태와 DB 연결 (화면 없음) =====
// Supabase(로그인 + Postgres DB)와 이야기하는 곳은 이 파일뿐이에요. 화면(로그인 창, 사이드바)은 auth-dialog.js,
// 페이지별 화면은 각 페이지 JS가 맡고, 여기 있는 함수와 이벤트를 써요.
//
// 이벤트 (Account.on("이름", 함수)로 받음)
//   "change"     로그인/로그아웃, 프로필이 바뀜 → 머리글 버튼 등 다시 그리기
//   "profile"    로그인한 회원의 프로필을 다 불러옴(탈퇴 유예 중이 아님) → 출제 설정·언어 적용
//   "restore"    탈퇴 신청 후 7일 안에 로그인함 → 계정 복구 창
//   "complete"   필수 항목이 비어 있음 → 정보 추가 입력 창
//   "recovery"   비밀번호 재설정 메일의 링크로 들어옴 → 새 비밀번호 창
//   "signedOut"  로그아웃됨
//
// 권한은 DB가 지켜요(RLS, supabase/schema.sql): 브라우저는 자기 기록만 읽고, 쓰기는 정해진 함수(record_attempt 등)로만.
// 그래서 여기서 하는 검사는 편의용이고, 조작해도 DB 규칙은 못 넘어요.
import { CONFIG } from "../config.js";
import { Engine } from "../core/engine.js";
import { localDay } from "../stats/data.js";
import { isPublicKey, missingFields, syncable } from "./helpers.js";

// supabase-js는 회원 기능이 켜져 있을 때만 CDN에서 불러와요. integrity(SRI)는 그 파일 내용이 바뀌면 거부하게 하는 지문.
// 버전을 올리면 두 값을 같이 바꿀 것 (지문: https://www.srihash.org 또는 openssl dgst -sha384 -binary | openssl base64 -A)
const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
const SDK_SRI = "sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R";
const PROFILE_COLS = "nickname, full_name, preferred_lang, role, settings, deleted_at";

/** 회원 기능이 켜져 있는지 (config.js에 주소와 공개 키가 있을 때) */
export const configured = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey) && isPublicKey(CONFIG.supabaseKey);
if (CONFIG.supabaseKey && !isPublicKey(CONFIG.supabaseKey)) console.error("config.js의 supabaseKey가 공개 키가 아니에요 — 회원 기능을 끕니다");

let sb = null;              // Supabase 클라이언트
let user = null;            // 로그인한 사용자 (Supabase Auth) 또는 null
let profile = null;         // profiles 행 (닉네임, 성명, 역할, 출제 설정 …) 또는 null
let accessToken = null;     // 페이지를 닫을 때 보내는 요청에 씀 (아래 timerEnded)
let ready = false;          // 처음 로그인 상태 확인이 끝났는지
const handlers = {};

function emit(name, ...args) { (handlers[name] || []).forEach(fn => fn(...args)); }

function loadSDK() {
  return new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement("script");
    s.src = SDK_URL; s.integrity = SDK_SRI; s.crossOrigin = "anonymous";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadProfile() {
  const { data, error } = await sb.from("profiles").select(PROFILE_COLS).eq("id", user.id).single();
  if (error) { console.warn("profile", error); return; }
  profile = data;
  emit("change");
  // 탈퇴 신청 후 7일 안: 다른 걸 동기화하기 전에 복구할지 먼저 물어봄
  if (profile.deleted_at) return emit("restore");
  emit("profile", profile);
  if (missingFields(profile).length) emit("complete");
}

let pushTimer;
const timer = { promise: null, id: null, abandoned: 0 };   // 타이머 세션 (아래 timerStarted)

export const Account = {
  configured,
  on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
  get user() { return user; },
  get profile() { return profile; },
  get ready() { return ready; },
  get client() { return sb; },
  /** 로그인했고 탈퇴 유예 중이 아님 → 기록·설정 동기화를 함 */
  active: () => !!(user && profile && !profile.deleted_at),
  isAdmin: () => !!(profile && profile.role === "admin"),

  /** 페이지가 열릴 때 한 번: SDK를 불러오고 로그인 상태를 지켜봄 */
  async start() {
    if (!configured) { ready = true; emit("change"); return; }
    try { await loadSDK(); } catch (e) { console.warn("supabase-js를 불러오지 못했어요", e); ready = true; emit("change"); return; }
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    sb.auth.onAuthStateChange((event, session) => {
      const prev = user && user.id;
      user = session ? session.user : null;
      accessToken = session ? session.access_token : null;
      if (event === "INITIAL_SESSION") ready = true;
      if (!user && prev) { profile = null; emit("signedOut"); }
      // 이 콜백 안에서 Supabase를 바로 부르면 멈출 수 있어서 다음 차례로 미룸 (supabase-js 안내)
      if (user && user.id !== prev) setTimeout(loadProfile, 0);
      if (event === "PASSWORD_RECOVERY") setTimeout(() => emit("recovery"), 0);
      emit("change");
    });
  },

  // ---------- 로그인·가입·비밀번호 (결과는 { data, error } 그대로 돌려줌) ----------
  signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
  signUp: (email, password, data, redirectTo) => sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data } }),
  resetPassword: (email, redirectTo) => sb.auth.resetPasswordForEmail(email, { redirectTo }),
  updatePassword: password => sb.auth.updateUser({ password }),
  /** 현재 비밀번호 확인: 그 비밀번호로 다시 로그인해 봄 (틀려도 지금 로그인은 유지됨 — supabase-js 코드로 확인) */
  verifyPassword: password => sb.auth.signInWithPassword({ email: user.email, password }),
  signOut: () => sb.auth.signOut(),
  /** 회원 탈퇴 신청 → 지워지는 날짜를 돌려줌 */
  requestDeletion: () => sb.rpc("request_account_deletion"),
  async restore() {
    const res = await sb.rpc("restore_account");
    if (!res.error) { profile.deleted_at = null; emit("change"); emit("profile", profile); }
    return res;
  },
  /** 탈퇴 직후: 로그아웃을 "복구 거절"로 오해하지 않게 프로필을 먼저 비움 */
  forgetProfile() { profile = null; },

  /** 프로필 고치기 (브라우저가 바꿀 수 있는 열: nickname, settings, full_name, preferred_lang) */
  async updateProfile(fields) {
    if (!sb || !user) return { error: null };
    const res = await sb.from("profiles").update(fields).eq("id", user.id);
    if (res.error) console.warn("profile update", res.error);
    else if (profile) { Object.assign(profile, fields); emit("change"); }
    return res;
  },
  /** 출제 설정이 바뀔 때마다 부름 → 1.2초 동안 더 안 바뀌면 계정에 저장 */
  settingsChanged(settings) {
    if (!Account.active()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => Account.updateProfile({ settings: syncable(settings) }), 1200);
  },
  /** 화면 언어를 바꿨을 때 계정의 사용 언어도 바꿈. 저장이 끝날 때까지 기다릴 수 있게 Promise를 돌려줌 */
  langChanged(lang) { if (Account.active() && profile.preferred_lang !== lang) return Account.updateProfile({ preferred_lang: lang }); },

  // ---------- 연습 기록 ----------
  /** 계정의 누적 기록 (머리글 정답/시도·연속). 로그인·새로고침 때만 불러와 화면 값을 바꿈 */
  async loadTotals() {
    const { data, error } = await sb.from("practice_stats").select("total, first_correct, streak").eq("user_id", user.id).maybeSingle();
    if (error) { console.warn("practice stats", error); return null; }
    return { total: data ? data.total : 0, first: data ? data.first_correct : 0, streak: data ? data.streak : 0 };
  },
  /**
   * 끝난 문제 하나를 기록 (DB 함수 record_attempt). 합계는 DB에서 +1 하므로 여러 기기가 서로 덮어쓰지 않아요.
   * 인터넷이 끊겨 실패하면 그 기록만 빠져요(사용자 결정).
   * @param q       문제 객체 (engine.js)
   * @param first   처음 채점에서 맞혔는지 (정답) — false면 오답
   * @param review  틀린 문제 다시 풀기 중이었는지
   * @param ms      타이머가 켜져 있을 때 맞히기까지 걸린 시간(ms), 없으면 null
   */
  record(q, first, review, ms = null) {
    if (!Account.active()) return;
    const args = {
      p_quality: Engine.quality(q), p_symbol: q.symbol, p_first: first, p_day: localDay(),
      p_review: !!review, p_spec: first || review ? null : Engine.spec(q), p_ms: ms, p_session: null,
    };
    const send = () => sb.rpc("record_attempt", args).then(({ error }) => { if (error) console.warn("record", error); });
    // 시간이 있는 기록은 타이머 세션 번호와 함께 보냄 (DB는 유효한 세션이 있을 때만 시간을 저장).
    // 세션 번호가 아직 안 왔을 수 있어서 지금 시점의 세션을 기억해 두고 기다림
    const s = ms != null && timer.promise;
    if (s) s.then(id => { args.p_session = id; send(); }); else send();
  },

  // ---------- 타이머 세션 ----------
  // 타이머를 켤 때마다 그때의 출제 설정을 timer_sessions에 저장해요(DB가 켜는 조건도 다시 검사).
  // "중단된 문제"(시간을 재던 문제가 결과 없이 사라짐: 문제 도중 타이머 끄기, 연결 끊김, 페이지 닫기)는 세어 두었다가
  // 세션을 끝낼 때 함께 보내요. 선생님 화면에서 일부러 중단하는지 볼 수 있게.
  timerStarted(settings) {
    timer.abandoned = 0; timer.id = null;
    timer.promise = Account.active()
      ? sb.rpc("start_timer_session", { p_settings: settings }).then(({ data, error }) => {
        if (error) { console.warn("timer session", error); return null; }
        timer.id = data;
        return data;
      })
      : null;
  },
  /** 시간을 재던 문제가 결과 없이 사라짐 */
  abandoned() { timer.abandoned++; },
  /** 타이머 끔 → 세션 끝 시각과 중단된 문제 수 저장 */
  timerEnded() {
    const p = timer.promise, n = timer.abandoned;
    timer.promise = null;
    if (p) p.then(id => { if (id) sb.rpc("end_timer_session", { p_session: id, p_abandoned: n }).then(({ error }) => { if (error) console.warn("timer session", error); }); });
  },
  /** 페이지를 닫거나 새로고침할 때: 일반 요청은 페이지와 함께 취소되므로 keepalive 요청으로 세션을 끝냄 */
  timerEndOnLeave(extraAbandoned) {
    if (!timer.id || !accessToken) return;
    fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/end_timer_session`, {
      method: "POST", keepalive: true,
      headers: { apikey: CONFIG.supabaseKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_session: timer.id, p_abandoned: timer.abandoned + extraAbandoned }),
    }).catch(() => { /* 닫히는 중이라 결과를 볼 수 없음 */ });
    timer.promise = null; timer.id = null;
  },

  // ---------- 틀린 문제 ----------
  async reviewItems() {
    if (!Account.active()) return null;
    const { data, error } = await sb.from("review_queue").select("symbol, spec, hits").eq("user_id", user.id).order("added_at");
    if (error) { console.warn("review", error); return null; }
    return data;
  },
  async reviewCount() {
    if (!Account.active()) return 0;
    const { count } = await sb.from("review_queue").select("symbol", { count: "exact", head: true }).eq("user_id", user.id);
    return count || 0;
  },

  // ---------- 통계 (마이페이지·선생님 화면) ----------
  /** 기간별 통계. range: "7d" | "30d" | "1y" | "custom"(custom = { from, to }) */
  summary: (uid, range, custom) => sb.rpc("practice_summary", {
    p_user: uid, p_range: range, p_today: localDay(), p_from: custom ? custom.from : null, p_to: custom ? custom.to : null,
  }),
  /** 선생님 화면 전용: 약점·연습 습관·최근 문제 (관리자만, DB가 확인) */
  overview: uid => sb.rpc("student_overview", { p_user: uid, p_today: localDay() }),
  /** 학생 목록 (관리자만) */
  students: () => sb.rpc("student_list"),
};
