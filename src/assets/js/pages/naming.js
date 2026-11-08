// ===== 코드 추론하기 (trainer/chords-name/index.html) — 시작점 =====
// 문제 흐름(출제 → 제출 → 정답/오답 → 다음 문제)과 버튼·단축키를 여기서 연결해요. 규칙은 core/naming.js.
//   naming/settings.js  출제 설정 카드     naming/keys.js  건반(보기만)     naming/keypad.js  코드 입력 키패드
//   practice/audio.js   피아노 소리(랜덤 코드 연습과 같음)
// 기록·타이머·숫자판·다시 풀기는 4단계에서 붙여요.
//   naming/staff.js  오선지 악보(SVG)
import { startPage } from "../common/layout.js";
import { isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast, chordHTML, esc } from "../common/dom.js";
import { store } from "../common/storage.js";
import { Naming } from "../core/naming.js";
import { S, save, initSettings, syncSettingsUI } from "../naming/settings.js";
import { initKeys, drawKeys } from "../naming/keys.js";
import { drawStaff } from "../naming/staff.js";
import { initKeypad, type, backspace, moveCaret, caretAtEnd, answerText, clearAnswer, setPadEnabled } from "../naming/keypad.js";
import { Sound } from "../practice/audio.js";

startPage({ title: "navNameTrainer" });

// 지금 문제 상태
//   q          문제 (core/naming.js generate) 또는 null
//   err        문제를 낼 수 없는 이유("noTypes" | "noBases" | "noChord") 또는 null
//   locked     문제가 끝남(정답을 맞혔거나 정답 확인) — 더 풀 수 없음
//   attempted  첫 제출이 있었는지 (4단계 기록에서 첫 결과만 셀 때 씀)
//   bad        오답일 때 주황색으로 표시할 건반(MIDI)
//   fb         결과 안내 { kind, build } — build는 언어를 바꾸면 다시 부르는 함수
//   good       정답을 맞혔는지 (건반을 초록색으로)
//   hinted     힌트를 봤는지 (4단계 기록: 정답은 그대로 정답, "힌트 사용" 표시만 남김 — 사용자 결정 2026-11-08)
const state = { q: null, err: null, locked: false, attempted: false, bad: new Set(), good: false, hinted: false, fb: null };
const answer = answerText;
// 사용자가 화면을 누르거나 키를 쳤는지 (그 전에는 자동 재생을 하지 않음 — newQuestion)
let touched = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { touched = true; }, { capture: true, once: true });

// ---------- 화면 그리기 ----------

function draw() {
  const notes = state.q ? state.q.notes : [];
  drawKeys(notes, state.bad, S.labels, state.good);
  drawStaff(notes, state.bad, state.good);   // 악보는 음이름 없이 (음이름 표시는 건반에만 — 사용자 결정)
}
function renderMsg() {
  $("nameMsg").hidden = !state.err;
  $("nameMsg").textContent = state.err ? t(state.err) : "";
}
function setFeedback(kind, build) { state.fb = kind ? { kind, build } : null; renderFeedback(); }
function renderFeedback() {
  const fb = $("feedback");
  fb.className = "feedback" + (state.fb ? " " + state.fb.kind : "");
  fb.innerHTML = state.fb ? state.fb.build() : "";
}
// ---------- 힌트 (자리바꿈 허용일 때만, 2026-11-08 사용자 요청) ----------
// 정답이 될 수 있는 코드들의 근음만 알려줌 (코드 종류는 알려주지 않음). 예: Dm7(♭5)/Fm6 → "근음 후보: D, F"
// 근음 이름은 악보의 철자. 결과 안내 자리 위에 따로 두어서, 입력을 바꾸거나 오답 안내가 떠도 그 문제가 끝날 때까지 남음
function renderHint() {
  const box = $("nameHint");
  box.hidden = !(state.hinted && state.q);
  if (box.hidden) return;
  const roots = state.q.answers.map(a => state.q.notes.find(n => n.midi % 12 === a.rootPc).name);
  box.innerHTML = `<strong>${esc(t("hintRoots"))}</strong><span class="ans-list">${roots.map(r => `<b class="ans-name">${esc(r)}</b>`).join(", ")}</span>`;
}
function showHint() {
  if (!state.q) return;
  state.hinted = true;
  renderHint();
}

// 정답 목록: "Dm7(♭5) 또는 Fm6" (근음별로 하나씩, 문제 근음이 맨 앞 — core/naming.js answers)
const answerList = q => q.answers.map(a => `<b class="ans-name">${chordHTML(a.symbol)}</b>`).join(` <span class="ans-or">${esc(t("orWord"))}</span> `);

// ---------- [다음 문제] 막기 (2026-11-08 사용자 결정) ----------
// 아직 끝나지 않은 문제(제출 전이거나 오답)에 입력칸 글자가 남아 있으면 [다음 문제]·→를 막고 안내.
// 끝난 문제(정답·정답 확인)는 글자가 있어도 넘어감. 버튼은 진짜 disabled가 아니라 꺼진 모양(.is-off)만 — 눌러야 안내를 띄울 수 있음
const nextBlocked = () => !!state.q && !state.locked && answer().trim() !== "";
function renderNext() {
  const off = nextBlocked();
  $("btnNext").classList.toggle("is-off", off);
  $("btnNext").setAttribute("aria-disabled", String(off));
}
function tryNext() {
  if (nextBlocked()) return toast(t("clearAnswerFirst"), 2000);
  newQuestion();
}

// ---------- 문제 흐름 ----------

function newQuestion() {
  const q = Naming.generate(S, Math.random, state.q);
  Object.assign(state, { q: q.error ? null : q, err: q.error || null, locked: false, attempted: false, bad: new Set(), good: false, hinted: false, fb: null });
  clearAnswer();
  const ok = !!state.q;
  setPadEnabled(ok);
  $("btnCheck").disabled = !ok; $("btnReveal").disabled = !ok; $("btnListen").disabled = !ok;
  $("padHint").hidden = !S.optInv; $("padHint").disabled = !ok;
  renderMsg(); renderFeedback(); renderHint(); renderNext(); draw();
  // 문제가 나오면 모든 음을 동시에 들려줌 (사용자 결정). 단 사용자가 화면을 한 번이라도 누르기 전에는 시도하지 않음:
  // 누르기 전에 소리 장치를 만들면 iPhone이 막힌 채로 두어서 그 뒤 [들어보기]까지 안 들렸음 (2026-11-08)
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

function submit() {
  const q = state.q; if (!q || state.locked) return;
  const r = Naming.check(answer(), q);
  if (r.error === "empty") return setFeedback("info", () => esc(t("errEmpty")));
  state.attempted = true;
  state.bad = new Set();
  if (r.error) {
    // 근음 소문자·괄호 밖 텐션·읽을 수 없는 이름: 안내와 함께 오답 (사용자 결정 2026-11-08)
    setFeedback("no", () => `<strong>${esc(t("notYet"))}</strong><span>${esc(t(ERR_KEY[r.error]))}</span>`);
  } else if (r.correct) {
    state.good = true;
    setFeedback("ok", () => `<strong>${esc(t("correct"))}</strong><span class="ans-list">${answerList(q)}</span>`);
    lock();
  } else {
    // 오답: 줄을 나눠 알려줌. 이름은 "문제 쪽에서 본" 기준 (사용자 결정 2026-11-08 — 예: E♭ A♭ B♭ D♭에 E♭7로 답하면)
    //   빠진 음          화면에 있는데 답한 코드에 없는 음 (A♭) = engine의 extra → 건반에 주황색
    //   들어갈 수 없는 음  답한 코드에는 있는데 화면에 없는 음 (G) = engine의 missing
    //   근음이 맨 아래가 아님 (자리바꿈 꺼짐)
    state.bad = new Set(q.notes.filter(n => r.extra.includes(n.name)).map(n => n.midi));
    setFeedback("no", () => {
      const lines = [];
      if (r.extra.length) lines.push(`<span class="why">${esc(t("wrongMissing"))}: <b class="bad-name">${esc(r.extra.join(", "))}</b></span>`);
      if (r.missing.length) lines.push(`<span class="why">${esc(t("wrongExtra"))}: <b>${esc(r.missing.join(", "))}</b></span>`);
      if (r.bassWrong) lines.push(`<span class="why">${esc(t("wrongBass"))}</span>`);
      return `<strong>${esc(t("notYet"))}</strong>${lines.join("")}`;
    });
  }
  draw();
}

function reveal() {
  const q = state.q; if (!q || state.locked) return;
  state.attempted = true;
  state.bad = new Set();
  setFeedback("info", () => `<strong>${esc(t("answer"))}</strong><span class="ans-list">${answerList(q)}</span>`);
  lock();
  draw();
}

// 입력칸 글자가 바뀜: 풀던 문제면 지난 오답 안내·주황 표시를 지움 (랜덤 코드 연습에서 건반을 다시 누를 때와 같음)
function answerChanged() {
  if (!state.locked && state.fb) { state.bad = new Set(); setFeedback(null); draw(); }
  renderNext();
}

// ---------- 연결 ----------

initSettings(newQuestion);
initKeys();
initKeypad(answerChanged);
$("btnCheck").onclick = submit;
$("btnReveal").onclick = reveal;
$("btnNext").onclick = tryNext;
$("padHint").onclick = showHint;
$("btnListen").onclick = () => { if (state.q) Sound.chord(state.q.notes.map(n => n.midi), false); };
$("optLabels").onchange = e => { S.labels = e.target.checked; save(); draw(); };
// 건반은 문제 표시 전용: 누르면 알림만 (2026-11-08 사용자 결정 — 흰 건반을 회색으로 칠하던 방식 대신)
$("keyboard").addEventListener("pointerdown", () => toast(t("keysDisplayOnly"), 2000));

// ---------- 키보드 단축키 (사용자 결정 2026-11-08) ----------
// 글자 키는 모두 코드 입력이라(G7, Cmin7) 랜덤 코드 연습의 G·N은 쓰지 않음.
//   Enter  제출 (끝난 문제면 다음 문제)      →  커서가 맨 끝이면 다음 문제, 아니면 커서를 오른쪽으로     ←  커서를 왼쪽으로
//   글자 키·Backspace는 어디서 치든 입력칸으로 (입력칸은 <input>이 아니라서 초점과 상관없음 — naming/keypad.js)
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (authOpen() || document.querySelector("dialog[open]")) return;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  if (e.key === "Enter") {
    e.preventDefault();
    if (state.locked) newQuestion(); else submit();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (caretAtEnd()) tryNext(); else moveCaret(1);
  } else if (e.key === "ArrowLeft") { e.preventDefault(); moveCaret(-1); }
  else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
  else if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); type(e.key); }
}, true);

// ---------- 폰 세로 첫 방문: 출제 설정이 아래에 있다고 알려주는 알약 (사용자 요청 2026-11-08) ----------
// 랜덤 코드 연습(pages/practice.js)과 같은 방식이지만 따로 기억 (chordoven.nameScrollTip): 랜덤 코드 연습에서 봤어도 이 페이지에선 한 번 보여줌.
// 출제 설정 제목이 화면 위쪽 65% 안에 한 번 들어오거나 알약을 누르면 다시 안 나옴. 넓은 화면은 처음부터 보여서 곧바로 끝남(알약은 CSS가 폰 세로에서만)
{
  const tip = $("scrollTip");
  const head = document.querySelector(".sheet h2");
  const done = () => { tip.hidden = true; store.set("nameScrollTip", "seen"); seen.disconnect(); };
  const seen = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) done(); }, { rootMargin: "0px 0px -35% 0px" });
  if (store.get("nameScrollTip") !== "seen" && head && "IntersectionObserver" in window) {
    tip.hidden = false;
    seen.observe(head);
    $("scrollTipGo").onclick = () => { done(); head.closest(".sheet").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("scrollTipX").onclick = done;   // ×: 스크롤하지 않고 닫기 (다시 안 나옴 — 2026-11-08)
  }
}

// ---------- 언어가 바뀌면 JS로 그린 문구를 다시 ----------
onLangChange(() => { syncSettingsUI(); renderMsg(); renderFeedback(); renderHint(); });

// ---------- 시작 ----------
$("optLabels").checked = S.labels;
syncSettingsUI();
newQuestion();
