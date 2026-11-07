// ===== 연습 — 문제 흐름 (출제 → 채점 → 기록) =====
// 한 문제의 흐름:
//   1. newQuestion()  문제를 냄 (다시 풀기 중이면 틀린 문제 목록에서)
//   2. check()        채점. 처음 채점의 결과가 그 문제의 결과(정답/오답). 틀려도 다시 눌러 볼 수 있음
//      reveal()       정답 확인 — 오답으로 처리하고 정답을 보여줌
//   3. 맞히거나 정답을 확인하면 문제가 닫히고(lock) [다음 문제]만 남음
// 결과는 머리글의 정답/시도·연속에 더하고, 로그인했으면 DB에도 기록해요(Account.record).
//
// 타이머가 켜져 있을 때 (timer.js):
//   - 처음 채점에 맞힘 → 바로 정답 + 걸린 시간 기록
//   - 처음 채점에 틀림 → 문제가 끝날 때 기록: 나중에 맞히면 맞힐 때까지의 시간, 정답 확인·넘김이면 시간 없음
//   - 채점하지 않고 [다음 문제]로 넘김 → 오답(시간 없음)  ※ 어려운 문제만 골라 넘기는 것 방지 (사용자 결정 2026-11-06)
//   - 5분 무입력 → 오답·5분, 타이머 꺼짐
//   - 결과 없이 사라진 문제(도중에 끄기, 연결 끊김, 페이지 닫기) → "중단"으로 세어 타이머 세션에 저장
import { Engine } from "../core/engine.js";
import { Account } from "../account/account.js";
import { t } from "../i18n/index.js";
import { $, chordHTML } from "../common/dom.js";
import { S, setLocked } from "./settings.js";
import { selected, setView, renderKeys } from "./keyboard.js";
import { Sound } from "./audio.js";
import { timer, elapsed, startTiming, setTimer, TIME_MAX } from "./timer.js";

/**
 * 지금 문제 상태
 *   q          문제 (engine.js의 문제 객체) 또는 null
 *   err        문제를 낼 수 없는 이유 (예: "noTypes" — 코드 종류를 하나도 안 고름)
 *   fb         채점 결과 표시 { kind, build } — build는 언어를 바꾸면 다시 부르는 함수
 *   answer     정답 확인 때 초록 점을 찍을 건반, good  정답일 때 초록으로 바뀔 건반
 *   locked     문제가 끝남 (맞혔거나 정답 확인) → [다음 문제]만
 *   attempted  첫 결과가 나왔는지 (그 뒤의 채점은 결과를 바꾸지 않음)
 *   skip       이 문제는 기록·집계하지 않음 (타이머 중 연결이 끊긴 문제)
 */
export const state = { q: null, err: null, fb: null, answer: new Set(), good: new Set(), locked: false, attempted: false, skip: false };

/** 머리글의 정답/시도·연속. 비회원은 이번 연습만, 로그인하면 계정 누적값(로그인·새로고침 때 받아 오고 그 뒤로는 +1) */
export const stats = { first: 0, total: 0, streak: 0 };
export function renderStats() {
  $("stFirst").textContent = stats.first; $("stTotal").textContent = stats.total; $("stStreak").textContent = stats.streak;
}

// ---------- 결과 기록 ----------

// 첫 결과(정답/오답)가 나옴: 숫자에 더하고 기록
function finish(q, first) {
  if (state.skip) return;
  stats.total++;
  if (first) { stats.first++; stats.streak++; } else stats.streak = 0;
  renderStats();
  if (review && review.cur && first) review.cur.hits++;
  if (!timer.cur) return Account.record(q, first, !!review);
  // 타이머 중: 정답은 지금 시간과 함께 보내고, 오답은 문제가 끝날 때 보냄(맞히기까지의 시간을 붙이려고)
  timer.cur.first = first;
  if (first) sendTimed(elapsed());
}
// 타이머 중인 문제의 기록 보내기 (ms = null이면 시간 없이)
function sendTimed(ms) {
  const c = timer.cur;
  if (!c || c.sent || state.skip || !state.q) return;
  c.sent = true; c.end = ms == null ? elapsed() : ms;
  Account.record(state.q, c.first, !!review, ms == null ? null : Math.round(ms));
}
// 문제가 맞히지 못한 채 끝남: 이미 나온 오답을 시간 없이 보냄
function settleTimed() { if (timer.cur && timer.cur.first === false && !timer.cur.sent) sendTimed(null); }
// 타이머 중 채점하지 않고 넘김 → 오답 (시간 없음)
function skipTimed() {
  if (timer.cur && timer.cur.first === null && state.q && !state.locked && !state.skip) { state.attempted = true; finish(state.q, false); }
}
// 재던 문제가 결과 없이 사라지는지 (중단)
const unfinished = () => !!(timer.cur && !timer.cur.sent && !state.skip && state.q);

// ---------- 틀린 문제 다시 풀기 ----------
// 남은 틀린 문제 중에서 무작위로 나오고(바로 앞 문제는 연달아 나오지 않게), 처음 채점에 2번 맞히면 목록에서 빠져요
// (DB의 record_attempt도 같은 규칙). 무작위 순서는 사용자 결정 2026-11-06.
// 다시 풀기 중에는 출제 설정이 적용되지 않으므로 설정이 잠겨요.
let review = null;   // { queue: 아직 남은 문제 [{ symbol, spec, hits }], cur: 지금 문제 }
export const inReview = () => !!review;

export function startReview(items) {
  const queue = items.filter(it => Engine.rebuild(it.spec, S));   // 다시 만들 수 없는 문제는 건너뜀
  if (!queue.length) return;
  review = { queue, cur: null };
  newQuestion();
}
export function stopReview(done) {
  review = null;
  renderReview();
  newQuestion();
  if (done) setFeedback("ok", () => t("reviewDone"));
}
function nextReview() {
  const prev = review.cur;
  if (prev && prev.hits < 2) review.queue.push(prev);   // 아직 2번 못 맞힌 문제는 목록에 남음
  // 무작위로 하나. 바로 앞 문제는 빼고 고름 (남은 문제가 그것 하나뿐이면 그대로)
  const choices = review.queue.length > 1 ? review.queue.filter(it => it !== prev) : review.queue;
  review.cur = choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  if (review.cur) review.queue.splice(review.queue.indexOf(review.cur), 1);
  return review.cur && Engine.rebuild(review.cur.spec, S);
}
export function renderReview() {
  $("reviewBar").hidden = !review;
  renderLock();
  if (review) $("reviewText").textContent = t("reviewBar", { n: review.queue.length + (review.cur && review.cur.hits < 2 ? 1 : 0) });
}
/** 출제 설정 잠금: 다시 풀기 중이거나 타이머가 켜져 있으면 */
export function renderLock() { setLocked(review ? "lockNote" : timer.on ? "lockTimer" : null); }

// ---------- 타이머를 켤 때 3·2·1 (2026-11-07 사용자 결정: 첫 문제 전에 마음의 준비 시간) ----------
// 코드가 나오는 자리에 3 → 2 → 1을 1초씩 보여준 뒤 새 문제를 내고, 그때부터 시간을 재요.
// 세는 동안은 문제가 없어서 채점·정답 확인·다음 문제가 동작하지 않고, 타이머를 끄면 세기를 멈추고 바로 새 문제(시간 없이).
let countdown = null;   // { n: 남은 숫자, id: setInterval 번호 } 또는 null
const COUNT_FROM = 3;
function startCountdown() {
  stopCountdown();
  selected.clear();
  Object.assign(state, { q: null, err: null, answer: new Set(), good: new Set(), locked: false, attempted: false, skip: false, fb: null });
  $("btnCheck").disabled = true; $("btnReveal").disabled = true;
  renderFeedback();
  setView({ q: null, answer: state.answer, good: state.good });
  countdown = { n: COUNT_FROM, id: setInterval(() => {
    countdown.n--;
    if (countdown.n > 0) return renderPrompt();
    stopCountdown();
    newQuestion();   // 이때부터 시간 재기 (startTiming)
  }, 1000) };
  renderPrompt();
}
function stopCountdown() {
  if (!countdown) return;
  clearInterval(countdown.id);
  countdown = null;
}

// ---------- 문제 내기와 화면 ----------

export function newQuestion() {
  if (countdown) return;   // 3·2·1 세는 중에는 다음 문제(N·→·버튼) 무시
  skipTimed();     // 타이머 중 넘김 → 오답
  settleTimed();   // 남은 오답 기록 보내기
  let q = review && nextReview();
  if (review && !q) return stopReview(true);   // 다시 풀기를 다 끝냄
  if (!q) q = Engine.generate(S, Math.random, state.q);   // 바로 앞 문제와 같은 베이스는 피함
  selected.clear();
  Object.assign(state, { answer: new Set(), good: new Set(), locked: false, attempted: false, skip: false, fb: null });
  $("btnCheck").disabled = !!q.error; $("btnReveal").disabled = !!q.error;
  state.q = q.error ? null : q; state.err = q.error || null;
  renderFeedback(); renderPrompt(); renderReview();
  setView({ q: state.q, answer: state.answer, good: state.good });
  startTiming(!!state.q, { ...stats });
}

// 안내 힌트 (코드 종류에 따라)
function hintFor(q) {
  if (q.alt) return t("hintAlt");
  if (q.tens.some(x => x === "#5" || x === "b5")) return t("hintSharp5");
  if (q.optional.size) return t("hintOptional");
  // 폰 세로에서는 기본 규칙 대신 "아래 출제 설정" 안내
  return `<span class="hint-wide">${t("hintBasic")}</span><span class="hint-narrow">${t("hintBasicNarrow")}</span>`;
}
// 코드 기호: 괄호 부분은 윗첨자처럼 작게 위로 (2026-11-07 사용자 요청). 괄호 안 항목이 2개 이상이면 세로로 쌓음 (높은 텐션이 위)
function symbolHTML(q) {
  const base = q.rootName + q.head;
  if (q.items.length < 2) return base + (q.items.length ? `<span class="sup">(${q.items[0]})</span>` : "");
  const col = q.items.slice().reverse().map(x => `<span>${x}</span>`).join("");
  return `${base}<span class="stack" style="--n:${q.items.length}" aria-hidden="true"><span class="paren">(</span><span class="col">${col}</span><span class="paren">)</span></span>`;
}
export function renderPrompt() {
  const sym = $("symbol");
  sym.classList.toggle("count", !!countdown);
  if (countdown) {
    sym.textContent = String(countdown.n); sym.removeAttribute("aria-label"); sym.classList.remove("empty");
    $("hint").textContent = t("timerReady");
    // 숫자가 바뀔 때마다 톡 튀어나오는 효과를 처음부터 다시
    sym.classList.remove("pop"); void sym.offsetWidth; sym.classList.add("pop");
    return;
  }
  sym.classList.remove("pop");
  if (state.err) {
    sym.textContent = t(state.err); sym.removeAttribute("aria-label"); sym.classList.add("empty"); $("hint").textContent = "";
  } else if (state.q) {
    sym.innerHTML = symbolHTML(state.q); sym.setAttribute("aria-label", state.q.symbol); sym.classList.remove("empty"); $("hint").innerHTML = hintFor(state.q);
  }
}
// 구성음 목록 (괄호 = 생략 가능한 음). 7alt는 "R 3 ♭7 + altered 텐션 1개 이상(…)"
function toneList(q) {
  if (q.alt) {
    const core = q.tones.filter(x => x.role === "chord").map(x => x.name).join(" ");
    const alts = q.tones.filter(x => x.role === "alt").map(x => x.name).join(" ");
    return t("altList", { core, alts });
  }
  return q.tones.map(x => (x.role === "optional" ? `(${x.name})` : x.name)).join(" ");
}
const answerLine = q => `<span class="tones">${chordHTML(q.symbol)} = ${toneList(q)}</span>`;

// 채점 결과 표시. build는 함수로 받아 두어, 언어를 바꾸면 다시 불러서 그 언어로 그림
export function setFeedback(kind, build) { state.fb = { kind, build }; renderFeedback(); }
export function renderFeedback() {
  const fb = $("feedback");
  if (!state.fb) { fb.className = "feedback"; fb.textContent = ""; return; }
  fb.className = "feedback " + state.fb.kind; fb.innerHTML = state.fb.build();
}
// 문제 닫기: [채점]·[정답 확인]을 끄고 [다음 문제]만. (버튼에 자동 초점을 주면 Enter를 가로채서 초점을 뺌)
function lock() {
  state.locked = true;
  $("btnCheck").disabled = true; $("btnReveal").disabled = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

/** 건반을 누르거나 떼면: 문제가 열려 있을 때 지난 채점 결과를 지움 */
export function keysChanged() {
  if (state.locked) return;
  state.fb = null; renderFeedback();
}

export function check() {
  const q = state.q; if (!q || state.locked) return;
  if (!selected.size) { setFeedback("info", () => t("pickFirst")); return; }
  const g = Engine.grade(selected, q);
  if (!state.attempted) { state.attempted = true; finish(q, g.correct); }
  // 처음엔 틀렸다가 맞힘: 타이머가 켜져 있으면 맞힐 때까지의 시간 (꺼져 있으면 timer.cur가 없어 시간을 잴 수 없음)
  else if (g.correct && timer.cur) sendTimed(elapsed());
  if (g.correct) {
    setFeedback("ok", () => `<strong>${t("correct")}</strong>${answerLine(q)}`);
    state.good = new Set(selected);
    setView({ q, answer: state.answer, good: state.good });
    Sound.chord(selected, false);
    lock();
  } else {
    // 틀림: 몇 개가 빠졌는지·남는지만 알려주고 다시 해 볼 수 있게
    setFeedback("no", () => {
      const parts = [];
      if (g.missing) parts.push(t("missing", { n: g.missing }));
      if (g.extra) parts.push(t("extra", { n: g.extra }));
      if (q.alt && !g.anyOk) parts.push(t("noAlt"));
      return `<strong>${t("notYet")}</strong><span>${parts.join(" · ")}</span>`;
    });
  }
  renderReview();
}

export function reveal() {
  const q = state.q; if (!q || state.locked) return;
  if (!state.attempted) { state.attempted = true; finish(q, false); }
  settleTimed();   // 정답 확인 = 오답, 시간 없음
  showAnswer();
  setFeedback("info", () => `<strong>${t("answer")}</strong>${answerLine(q)}`);
}
// 정답 보이싱에 초록 점 (이미 누른 건반 중 구성음에도), 들려주고 문제 닫기
function showAnswer() {
  const q = state.q;
  const v = Engine.voicing(q);
  const chordPcs = new Set([...q.required, ...q.optional, ...q.anyOf]);
  state.answer = new Set([...v, ...[...selected].filter(m => chordPcs.has(m % 12))]);
  setView({ q, answer: state.answer, good: state.good });
  Sound.chord(v, true);
  lock();
}

// ---------- 타이머와 연결 (timer.js가 부름) ----------
export const timerHooks = {
  inReview,
  locked: () => state.locked,
  // 끄기 직전: 남은 오답은 시간 없이 보내고, 결과가 아직 없던 문제는 "중단"
  beforeOff() {
    settleTimed();
    if (timer.cur && timer.cur.first === null && unfinished()) Account.abandoned();
  },
  changed(on, msgKey) {
    renderLock();
    // 켜면 지금 문제는 버리고(타이머가 꺼져 있을 때 나온 문제라 기록 없음) 3·2·1 뒤 새 문제 → 그 문제부터 시간 재기
    if (on) startCountdown();
    else if (countdown) { stopCountdown(); newQuestion(); }   // 세는 도중에 끔 → 바로 새 문제 (시간 없이)
    if (msgKey) setFeedback("no", () => t(msgKey) + (state.locked && state.q ? ` ${answerLine(state.q)}` : ""));
  },
  // 5분 동안 입력 없음: 오답·5분으로 기록, 정답을 보여주고 타이머 끔
  idle() {
    if (!state.attempted) { state.attempted = true; finish(state.q, false); }
    timer.cur.first = false;
    sendTimed(TIME_MAX);
    showAnswer();
    setTimer(false, "timerTimeout");
  },
  // 연결 끊김: 끝나지 않은 문제는 없던 일로(숫자를 되돌리고 기록도 안 함), "중단"으로 셈, 타이머 끔
  offline() {
    const c = timer.cur;
    if (unfinished()) {
      Object.assign(stats, c.snap); renderStats();
      state.skip = true;
      Account.abandoned();
    }
    timer.cur = null;
    setTimer(false);
    setFeedback("no", () => t("timerOffline"));
  },
  // 페이지를 떠남: 재던 문제가 끝나지 않았으면 중단 1개
  leave: () => (unfinished() ? 1 : 0),
};
