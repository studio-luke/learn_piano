// ===== 코드 추론하기 — 문제 흐름 (출제 → 제출 → 기록) =====
// 랜덤 코드 연습의 practice/quiz.js와 같은 규칙이에요 (4단계, 2026-11-08). 다른 점만:
//   - 답은 건반이 아니라 코드 이름 (core/naming.js check). 빈 칸 제출은 시도로 치지 않고, 근음 소문자·괄호 밖 텐션 같은
//     표기 오류는 오답
//   - 기록은 연습 구분 "name"으로 (DB practice_log.mode), 힌트를 봤으면 hinted (정답은 정답, 시간도 평균에 포함 — 사용자 결정)
//   - 틀린 문제 다시 풀기: 첫 번째는 처음과 같은 음 배치, 한 번 맞힌 뒤 두 번째는 같은 방식의 다른 배치 (core/naming.js fromSpec)
//
// 한 문제의 흐름:
//   1. newQuestion()  문제를 냄 (다시 풀기 중이면 틀린 문제 목록에서)
//   2. submit()       제출. 처음 제출의 결과가 그 문제의 결과(정답/오답). 틀려도 다시 제출해 볼 수 있음
//      reveal()       정답 확인 — 오답으로 처리하고 정답을 보여줌
//   3. 맞히거나 정답을 확인하면 문제가 닫히고(lock) [다음 문제]만 남음
// 결과는 머리글의 정답/시도·연속에 더하고(연습별로 따로), 로그인했으면 DB에도 기록해요(Account.record).
//
// 타이머가 켜져 있을 때 (practice/timer.js — 두 연습이 함께 씀):
//   - 처음 제출에 맞힘 → 바로 정답 + 걸린 시간 기록
//   - 처음 제출에 틀림 → 문제가 끝날 때 기록: 나중에 맞히면 맞힐 때까지의 시간, 정답 확인·넘김이면 시간 없음
//   - 제출하지 않고 [다음 문제]로 넘김 → 오답(시간 없음) + "제출하지 않고 넘어간 문제는…" 알림
//   - 5분 무입력 → 오답·5분, 타이머 꺼짐
//   - 결과 없이 사라진 문제(도중에 끄기, 연결 끊김, 페이지 닫기) → "중단"으로 세어 타이머 세션에 저장
import { Naming } from "../core/naming.js";
import { Account } from "../account/account.js";
import { t } from "../i18n/index.js";
import { $, toast, chordHTML, esc } from "../common/dom.js";
import { S, setLocked } from "./settings.js";
import { drawKeys } from "./keys.js";
import { drawStaff } from "./staff.js";
import { answerText, clearAnswer, setPadEnabled } from "./keypad.js";
import { Sound } from "../practice/audio.js";
import { timer, elapsed, startTiming, setTimer, TIME_MAX } from "../practice/timer.js";

const MODE = "name";   // DB의 연습 구분 (supabase/schema.sql practice_log.mode)

/**
 * 지금 문제 상태
 *   q          문제 (core/naming.js generate·fromSpec) 또는 null
 *   err        문제를 낼 수 없는 이유("noTypes" | "noBases" | "noChord") 또는 null
 *   locked     문제가 끝남(정답을 맞혔거나 정답 확인) — 더 풀 수 없음
 *   attempted  첫 결과가 나왔는지 (그 뒤의 제출은 결과를 바꾸지 않음)
 *   skip       이 문제는 기록·집계하지 않음 (타이머 중 연결이 끊긴 문제)
 *   bad        오답일 때 주황색으로 표시할 건반(MIDI)
 *   good       정답을 맞혔는지 (건반·악보를 초록색으로)
 *   hinted     힌트를 봤는지 (기록에 "힌트 사용")
 *   fb         결과 안내 { kind, build } — build는 언어를 바꾸면 다시 부르는 함수
 */
export const state = { q: null, err: null, locked: false, attempted: false, skip: false, bad: new Set(), good: false, hinted: false, fb: null };

/** 머리글의 정답/시도·연속 (이 연습만). 비회원은 이번 연습만, 로그인하면 계정 누적값(로그인·새로고침 때 받아 오고 그 뒤로는 +1) */
export const stats = { first: 0, total: 0, streak: 0 };
export function renderStats() {
  $("stFirst").textContent = stats.first; $("stTotal").textContent = stats.total; $("stStreak").textContent = stats.streak;
}

// 사용자가 화면을 누르거나 키를 쳤는지 (그 전에는 자동 재생을 하지 않음 — newQuestion)
let touched = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { touched = true; }, { capture: true, once: true });

// ---------- 결과 기록 ----------

const record = (q, first, ms = null) => Account.record(q, first, !!review, ms, { mode: MODE, hint: state.hinted, spec: Naming.specOf(q) });

// 첫 결과(정답/오답)가 나옴: 숫자에 더하고 기록
function finish(q, first) {
  if (state.skip) return;
  stats.total++;
  if (first) { stats.first++; stats.streak++; } else stats.streak = 0;
  renderStats();
  if (review && review.cur && first) review.cur.hits++;
  if (!timer.cur) return record(q, first);
  // 타이머 중: 정답은 지금 시간과 함께 보내고, 오답은 문제가 끝날 때 보냄(맞히기까지의 시간을 붙이려고)
  timer.cur.first = first;
  if (first) sendTimed(elapsed());
}
// 타이머 중인 문제의 기록 보내기 (ms = null이면 시간 없이)
function sendTimed(ms) {
  const c = timer.cur;
  if (!c || c.sent || state.skip || !state.q) return;
  c.sent = true; c.end = ms == null ? elapsed() : ms;
  record(state.q, c.first, ms == null ? null : Math.round(ms));
}
// 문제가 맞히지 못한 채 끝남: 이미 나온 오답을 시간 없이 보냄
function settleTimed() { if (timer.cur && timer.cur.first === false && !timer.cur.sent) sendTimed(null); }
// 타이머 중 제출하지 않고 넘김 → 오답 (시간 없음). 기록했으면 true (알림을 띄우려고)
function skipTimed() {
  if (timer.cur && timer.cur.first === null && state.q && !state.locked && !state.skip) { state.attempted = true; finish(state.q, false); return true; }
  return false;
}
// 재던 문제가 결과 없이 사라지는지 (중단)
const unfinished = () => !!(timer.cur && !timer.cur.sent && !state.skip && state.q);

// ---------- 틀린 문제 다시 풀기 ----------
// 남은 틀린 문제 중에서 무작위로 나오고(바로 앞 문제는 연달아 나오지 않게), 처음 제출에 2번 맞히면 목록에서 빠져요
// (DB의 record_attempt도 같은 규칙). 첫 번째(hits 0)는 처음과 같은 음 배치, 두 번째(hits 1)는 다른 배치.
// 다시 풀기 중에는 출제 설정이 적용되지 않으므로 설정이 잠겨요.
let review = null;   // { queue: 아직 남은 문제 [{ symbol, spec, hits }], cur: 지금 문제 }
export const inReview = () => !!review;

/** 다시 풀기 시작. 다시 만들 수 있는 문제가 하나도 없으면 false */
export function startReview(items) {
  const queue = (items || []).filter(it => Naming.fromSpec(it.spec, true));   // 다시 만들 수 없는 문제는 건너뜀
  if (!queue.length) return false;
  review = { queue, cur: null };
  newQuestion();
  return true;
}
export function stopReview(done) {
  review = null;
  renderReview();
  newQuestion();
  if (done) setFeedback("ok", () => esc(t("reviewDone")));
}
function nextReview() {
  const prev = review.cur;
  if (prev && prev.hits < 2) review.queue.push(prev);   // 아직 2번 못 맞힌 문제는 목록에 남음
  const choices = review.queue.length > 1 ? review.queue.filter(it => it !== prev) : review.queue;
  review.cur = choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  if (review.cur) review.queue.splice(review.queue.indexOf(review.cur), 1);
  return review.cur && Naming.fromSpec(review.cur.spec, review.cur.hits === 0);
}
export function renderReview() {
  $("reviewBar").hidden = !review;
  renderLock();
  if (review) $("reviewText").textContent = t("reviewBar", { n: review.queue.length + (review.cur && review.cur.hits < 2 ? 1 : 0) });
}
/** 출제 설정 잠금: 다시 풀기 중이거나 타이머가 켜져 있으면 */
export function renderLock() { setLocked(review ? "lockNote" : timer.on ? "lockTimer" : null); }

// ---------- 타이머를 켤 때 3·2·1 (랜덤 코드 연습과 같음) ----------
// 악보 자리에 3 → 2 → 1을 1초씩 보여준 뒤 새 문제를 내고, 그때부터 시간을 재요. 세는 동안은 문제가 없어서
// 제출·정답 확인·다음 문제가 동작하지 않고, 타이머를 끄면 세기를 멈추고 바로 새 문제(시간 없이).
let countdown = null;   // { n: 남은 숫자, id: setInterval 번호 } 또는 null
const COUNT_FROM = 3;
function startCountdown() {
  stopCountdown();
  Sound.stopAll();   // 문제가 바뀌면 울리던 소리를 모두 멈춤 (2026-11-09 사용자 요청)
  Object.assign(state, { q: null, err: null, locked: false, attempted: false, skip: false, bad: new Set(), good: false, hinted: false, fb: null });
  clearAnswer(); setPadEnabled(false);
  $("btnCheck").disabled = true; $("btnReveal").disabled = true; $("btnListen").disabled = true; $("padHint").disabled = true;
  renderAll();
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

// ---------- 화면 그리기 ----------

export function draw() {
  const notes = state.q ? state.q.notes : [];
  drawKeys(notes, state.bad, S.labels, state.good);
  drawStaff(notes, state.bad, state.good);   // 악보는 음이름 없이 (음이름 표시는 건반에만 — 사용자 결정)
}
/** 악보 자리: 3·2·1, 또는 악보 + (문제를 낼 수 없으면) 안내 */
export function renderPrompt() {
  const cd = $("countdown");
  cd.hidden = !countdown;
  $("staff").hidden = !!countdown;
  if (countdown) { cd.textContent = String(countdown.n); cd.classList.remove("pop"); void cd.offsetWidth; cd.classList.add("pop"); }
  $("nameMsg").hidden = !state.err || !!countdown;
  $("nameMsg").textContent = state.err ? t(state.err) : "";
}
export function setFeedback(kind, build) { state.fb = kind ? { kind, build } : null; renderFeedback(); }
export function renderFeedback() {
  const fb = $("feedback");
  fb.className = "feedback" + (state.fb ? " " + state.fb.kind : "");
  fb.innerHTML = state.fb ? state.fb.build() : "";
}
// 정답 목록: "Dm7(♭5) 또는 Fm6" (근음별로 하나씩, 문제 근음이 맨 앞 — core/naming.js answers)
const answerList = q => q.answers.map(a => `<b class="ans-name">${chordHTML(a.symbol)}</b>`).join(` <span class="ans-or">${esc(t("orWord"))}</span> `);

// ---------- 힌트 (자리바꿈 허용일 때만) ----------
// 정답이 될 수 있는 코드들의 근음만 알려줌. 예: Dm7(♭5)/Fm6 → "근음 후보: D, F". 그 문제가 끝날 때까지 남음
export function renderHint() {
  const box = $("nameHint");
  box.hidden = !(state.hinted && state.q);
  if (box.hidden) return;
  const roots = state.q.answers.map(a => state.q.notes.find(n => n.midi % 12 === a.rootPc).name);
  box.innerHTML = `<strong>${esc(t("hintRoots"))}</strong><span class="ans-list">${roots.map(r => `<b class="ans-name">${esc(r)}</b>`).join(", ")}</span>`;
}
export function showHint() {
  if (!state.q) return;
  state.hinted = true;
  renderHint();
}

// ---------- [다음 문제] 막기 ----------
// 아직 끝나지 않은 문제(제출 전이거나 오답)에 입력칸 글자가 남아 있으면 [다음 문제]·→를 막고 안내.
// 끝난 문제(정답·정답 확인)는 글자가 있어도 넘어감. 버튼은 꺼진 모양(.is-off)만 — 눌러야 안내를 띄울 수 있음
const nextBlocked = () => !!state.q && !state.locked && answerText().trim() !== "";
export function renderNext() {
  const off = nextBlocked();
  $("btnNext").classList.toggle("is-off", off);
  $("btnNext").setAttribute("aria-disabled", String(off));
}
export function tryNext() {
  if (nextBlocked()) return toast(t("clearAnswerFirst"), 2000);
  newQuestion();
}

function renderAll() { renderPrompt(); renderFeedback(); renderHint(); renderNext(); renderReview(); draw(); }

// ---------- 문제 흐름 ----------

export function newQuestion() {
  if (countdown) return;   // 3·2·1 세는 중에는 다음 문제 무시
  const skipped = skipTimed();     // 타이머 중 넘김 → 오답
  settleTimed();                   // 남은 오답 기록 보내기
  let q = review && nextReview();
  if (review && !q) return stopReview(true);   // 다시 풀기를 다 끝냄
  if (!q) q = Naming.generate(S, Math.random, state.q);   // 바로 앞 문제와 같은 근음은 피함
  Sound.stopAll();   // 다음 문제로 넘어가면 앞 문제의 소리를 모두 멈춤 (2026-11-09 사용자 요청) — 새 문제 소리는 아래에서
  Object.assign(state, { q: q.error ? null : q, err: q.error || null, locked: false, attempted: false, skip: false, bad: new Set(), good: false, hinted: false, fb: null });
  clearAnswer();
  const ok = !!state.q;
  setPadEnabled(ok);
  $("btnCheck").disabled = !ok; $("btnReveal").disabled = !ok; $("btnListen").disabled = !ok;
  $("padHint").hidden = !(review ? state.q && state.q.inv : S.optInv); $("padHint").disabled = !ok;
  renderAll();
  startTiming(ok, { ...stats });
  if (skipped) toast(t("timerSkipped"), 2000);
  // 문제가 나오면 모든 음을 동시에 들려줌. 단 사용자가 화면을 한 번이라도 누르기 전에는 시도하지 않음 (iPhone 소리 문제)
  if (ok && touched) Sound.chord(state.q.notes.map(n => n.midi), false);
}

// 문제 끝내기: [제출]·[정답 확인]을 끄고 [다음 문제]만. (버튼에 자동 초점을 주면 Enter를 가로채서 초점을 뺌)
function lock() {
  state.locked = true;
  $("btnCheck").disabled = true; $("btnReveal").disabled = true;
  renderNext();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// 입력 안내 문구 키 (core/naming.js parse의 오류)
const ERR_KEY = { lowerRoot: "errLowerRoot", noParen: "errNoParen", unknown: "errUnknown" };

export function submit() {
  const q = state.q; if (!q || state.locked) return;
  const r = Naming.check(answerText(), q);
  if (r.error === "empty") return setFeedback("info", () => esc(t("errEmpty")));   // 빈 칸은 시도로 치지 않음
  if (!state.attempted) { state.attempted = true; finish(q, r.correct); }
  // 처음엔 틀렸다가 맞힘: 타이머가 켜져 있으면 맞힐 때까지의 시간
  else if (r.correct && timer.cur) sendTimed(elapsed());
  state.bad = new Set();
  if (r.error) {
    // 근음 소문자·괄호 밖 텐션·읽을 수 없는 이름: 안내와 함께 오답
    setFeedback("no", () => `<strong>${esc(t("notYet"))}</strong><span>${esc(t(ERR_KEY[r.error]))}</span>`);
  } else if (r.correct) {
    state.good = true;
    setFeedback("ok", () => `<strong>${esc(t("correct"))}</strong><span class="ans-list">${answerList(q)}</span>`);
    lock();
  } else {
    // 오답: 줄을 나눠 알려줌. 이름은 "문제 쪽에서 본" 기준 (예: E♭ A♭ B♭ D♭에 E♭7로 답하면)
    //   빠진 음          화면에 있는데 답한 코드에 없는 음 (A♭) = engine의 extra → 건반·악보에 주황색
    //   들어갈 수 없는 음  답한 코드에는 있는데 화면에 없는 음 (G) = engine의 missing
    //   근음이 맨 아래가 아님 (자리바꿈 꺼짐)
    state.bad = new Set(q.notes.filter(n => r.extra.includes(n.name)).map(n => n.midi));
    setFeedback("no", () => {
      const lines = [];
      if (r.extra.length) lines.push(`<span class="why">${esc(t("wrongMissing"))}: <b class="bad-name">${esc(r.extra.join(", "))}</b></span>`);
      if (r.missing.length) lines.push(`<span class="why">${esc(t("wrongExtra"))}: <b>${esc(r.missing.join(", "))}</b></span>`);
      if (r.noAlt) lines.push(`<span class="why">${esc(t("altNeed"))}</span>`);   // 7alt인데 ♭9·♯9·♭13이 없음
      if (r.bassWrong) lines.push(`<span class="why">${esc(t("wrongBass"))}</span>`);
      return `<strong>${esc(t("notYet"))}</strong>${lines.join("")}`;
    });
  }
  renderReview();
  draw();
}

// 정답을 보여주고 문제 닫기 (정답 확인, 5분 무입력)
function showAnswer() {
  state.bad = new Set();
  setFeedback("info", () => `<strong>${esc(t("answer"))}</strong><span class="ans-list">${answerList(state.q)}</span>`);
  lock();
  draw();
}

export function reveal() {
  const q = state.q; if (!q || state.locked) return;
  if (!state.attempted) { state.attempted = true; finish(q, false); }
  settleTimed();   // 정답 확인 = 오답, 시간 없음
  showAnswer();
}

/** 입력칸 글자가 바뀜: 풀던 문제면 지난 오답 안내·주황 표시를 지움 */
export function answerChanged() {
  if (!state.locked && state.fb) { state.bad = new Set(); setFeedback(null); draw(); }
  renderNext();
}

// ---------- 타이머와 연결 (practice/timer.js가 부름) ----------
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
    if (msgKey) setFeedback("no", () => esc(t(msgKey)) + (state.locked && state.q ? ` <span class="ans-list">${answerList(state.q)}</span>` : ""));
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
    setFeedback("no", () => esc(t("timerOffline")));
  },
  // 페이지를 떠남: 재던 문제가 끝나지 않았으면 중단 1개
  leave: () => (unfinished() ? 1 : 0),
};
$("reviewStop").onclick = () => stopReview(false);
