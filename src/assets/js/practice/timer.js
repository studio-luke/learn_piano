// ===== 연습 — 타이머 =====
// 켜면 바로 새 문제가 나오고, 그 문제부터 문제가 나온 순간부터 맞힐 때까지의 시간을 재요 (최대 5분). 학생의 이해도를 더 정확히 보려고.
// (2026-11-07 사용자 결정: 예전에는 "다음 문제부터" 쟀음 → 켜는 즉시 새 문제로 바꾸고 바로 시작. 새 문제는 quiz.js timerHooks.changed가 냄)
//
// 규칙 (사용자 결정 2026-11-06, 자세한 내용은 chordoven-spec.md "타이머")
//   - 켜는 조건: 코드 종류 5가지 이상, 옵션 B를 쓰면 베이스 7개 이상 (비슷한 쉬운 문제만 반복해 시간을 줄이는 것 방지)
//     → DB 함수 start_timer_session도 같은 조건을 검사해요. 바꿀 때는 두 곳을 함께.
//   - 켜져 있는 동안 출제 설정은 잠김
//   - 5분 동안 아무 입력이 없으면 타이머가 꺼지고, 그 문제는 오답·5분으로 기록
//   - 입력이 있었으면 5분에서 멈추고(그 이상 늘지 않음), 맞히면 5분으로 기록
//   - 인터넷 연결이 끊기면 타이머가 꺼지고, 그 문제는 기록하지 않음
// 기록을 보내는 일(언제 정답/오답·시간으로 보낼지)은 각 페이지(quiz.js, pages/naming.js)가 하고, 여기는 시계·버튼·도움말만 맡아요.
// 두 연습(랜덤 코드 연습·코드 추론하기, 2026-11-08)이 함께 써요. 페이지마다 다른 것(출제 설정, 연습 구분)은 initTimer의 cfg로 받아요.
import { Account } from "../account/account.js";
import { t } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";

export const TIME_MAX = 5 * 60 * 1000;
/** 타이머를 켤 때 필요한 코드 종류 수와 (옵션 B일 때) 베이스 수 */
export const MIN_TYPES = 5, MIN_BASES = 7;

/**
 * 타이머 상태.
 *   on   켜져 있는지
 *   cur  지금 문제의 시간 기록 (켜면 바로 나오는 새 문제부터 생김, 문제가 없으면 null)
 *        { start, last(마지막 입력 시각), first(첫 결과: null=아직, true=정답, false=오답), sent(기록을 보냈는지),
 *          end(멈춘 시간 ms), snap(문제 시작 때의 정답/시도 숫자 — 연결이 끊기면 되돌리려고) }
 */
export const timer = { on: false, cur: null };

/** 지금 문제에 걸린 시간 (ms, 5분에서 멈춤) */
export const elapsed = () => (timer.cur.end != null ? timer.cur.end : Math.min(Date.now() - timer.cur.start, TIME_MAX));

/**
 * 켤 수 없으면 그 이유(문구 키), 켤 수 있으면 null.
 * @param S  그 페이지의 출제 설정 (types, optB, bases)
 */
export function timerBlock(S) {
  if (Object.keys(S.types).filter(k => S.types[k]).length < MIN_TYPES) return "timerNeedTypes";
  if (S.optB && S.bases.filter(Boolean).length < MIN_BASES) return "timerNeedBases";
  return null;
}

/**
 * 타이머 세션에 저장할 설정 (켤 때의 출제 설정 — DB timer_sessions.settings, fits_settings가 이걸로 검사)
 * @param S      그 페이지의 출제 설정
 * @param extra  페이지마다 더 남길 것 (랜덤 코드 연습 { optD }, 코드 추론하기 { optInv })
 */
export const timerSettings = (S, review, extra = {}) => ({
  types: Object.keys(S.types).filter(k => S.types[k]), optB: !!S.optB,
  bases: S.bases.map((v, i) => (v ? i : -1)).filter(i => i >= 0), optC: !!S.optC, cMax: S.cMax, optE: !!S.optE, review: !!review, ...extra,
});

let hooks = {};
// 페이지 설정 (initTimer의 cfg): mode("play" | "name"), S(출제 설정 — timerShow도 여기), save(), sessionSettings(review)
let cfg = {};

/** 시간 재기 시작: 새 문제가 나올 때마다 quiz.js가 부름 (타이머가 꺼져 있으면 재지 않음). snap = 그때의 정답/시도 숫자 */
export function startTiming(hasQuestion, snap) {
  timer.cur = timer.on && hasQuestion ? { start: Date.now(), last: Date.now(), first: null, sent: false, end: null, snap } : null;
  renderTimer();
}

/** 타이머 켜기/끄기. msgKey가 있으면 끈 이유를 화면에 보여줌 */
export function setTimer(on, msgKey) {
  if (on === timer.on) return;
  if (!on) { hooks.beforeOff(); timer.cur = null; }   // 이 문제는 시간 없이 (quiz.js가 정리)
  timer.on = on;
  if (on) Account.timerStarted(cfg.sessionSettings(hooks.inReview()), cfg.mode); else Account.timerEnded();
  renderTimer();
  hooks.changed(on, msgKey);
}

/** 버튼 글자와 지난 시간 표시 */
export function renderTimer() {
  const c = timer.cur;
  const btn = $("timerBtn");
  btn.setAttribute("aria-pressed", String(timer.on));
  $("timerBtnLabel").textContent = t(timer.on ? "timerStop" : "timerStart");
  const el = $("timerText");
  let text = "";
  if (timer.on) {
    if (c) { const sec = Math.floor(elapsed() / 1000); text = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
  }
  el.textContent = text;
  el.classList.toggle("wait", !c);
  el.hidden = !timer.on || !c || cfg.S.timerShow === false;
  // 폰 세로에서는 안내 문구 옆 대신 버튼 안에 지난 시간을 보여줌 (CSS가 둘 중 하나만 보이게 함)
  $("timerBtnTime").textContent = timer.on && c && cfg.S.timerShow !== false ? text.replace("⏱ ", "") : "";
}

/**
 * 타이머 버튼·도움말·시계 연결.
 * @param h.beforeOff()        끄기 직전 (지금 문제 정리)
 * @param h.changed(on, msg)   켜짐/꺼짐이 바뀐 뒤 (설정 잠금, 안내)
 * @param h.inReview()         다시 풀기 중인지
 * @param h.idle()             5분 동안 입력 없음
 * @param h.offline()          인터넷 연결이 끊김
 * @param h.leave()            페이지를 닫거나 새로고침 (중단된 문제 수를 돌려줌)
 * @param h.locked()           지금 문제가 끝났는지 (끝난 뒤에는 시간을 재지 않음)
 * @param c  페이지 설정 { mode: "play" | "name", S: 출제 설정, save(): 설정 저장, sessionSettings(review): 세션에 남길 설정 }
 */
export function initTimer(h, c) {
  hooks = h; cfg = c;
  $("timerBtn").onclick = () => {
    if (!timer.on) { const block = timerBlock(cfg.S); if (block) return toast(t(block)); }
    setTimer(!timer.on);
  };

  // 도움말(?)은 공통 처리 (common/layout.js wireHelp)

  $("optTimerShow").checked = cfg.S.timerShow !== false;
  $("optTimerShow").onchange = e => { cfg.S.timerShow = e.target.checked; cfg.save(); renderTimer(); };

  // 아무 키나 클릭이든 "입력"으로 침 (5분 무입력 판단용)
  const touch = () => { if (timer.cur && timer.cur.end == null) timer.cur.last = Date.now(); };
  document.addEventListener("pointerdown", touch, true);
  document.addEventListener("keydown", touch, true);

  // 0.25초마다: 표시 갱신, 5분 무입력 확인 (탭이 뒤로 가 있어도 Date.now로 재므로 돌아오면 바로 맞춰짐)
  setInterval(() => {
    const c = timer.cur;
    if (!c || c.end != null) return;
    if (!h.locked() && Date.now() - c.last >= TIME_MAX) return h.idle();
    renderTimer();
  }, 250);

  window.addEventListener("offline", () => { if (timer.on) h.offline(); });
  // 페이지를 닫거나 다른 곳으로 이동: 타이머 세션을 끝냄 (재던 문제는 중단으로 셈)
  window.addEventListener("pagehide", () => { if (timer.on) Account.timerEndOnLeave(h.leave()); });
  renderTimer();
}
