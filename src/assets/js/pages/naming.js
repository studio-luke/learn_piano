// ===== 코드 추론하기 (trainer/chords-name/index.html) — 시작점 =====
// 각 부분을 만들고 서로 연결해요. 규칙은 core/naming.js, 문제 흐름·기록·다시 풀기는 naming/quiz.js.
//   naming/settings.js  출제 설정 카드     naming/keys.js   건반(문제 표시·눌린 음 듣기)     naming/keypad.js  코드 입력 키패드
//   naming/staff.js     오선지 악보(SVG)    naming/quiz.js   문제 흐름·기록·다시 풀기
//   practice/audio.js   피아노 소리, practice/timer.js 타이머 (둘 다 랜덤 코드 연습과 함께 씀)
// 그리고 키보드 단축키, 회원 기능(계정 설정·누적 기록·다시 풀기)과의 연결을 여기서 해요.
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { hooks as authHooks, isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { store } from "../common/storage.js";
import { S, save, initSettings, syncSettingsUI, replaceSettings } from "../naming/settings.js";
import { initKeys } from "../naming/keys.js";
import { menuOpen } from "../naming/answer-menu.js";
import { initKeypad, type, backspace, deleteForward, moveCaret, caretTo, caretAtEnd, selectAll, undo, redo, extendCaret } from "../naming/keypad.js";
import {
  state, stats, renderStats, newQuestion, tryNext, submit, reveal, showHint, answerChanged, draw,
  startReview, stopReview, inReview, renderPrompt, renderFeedback, renderHint, renderReview, timerHooks,
} from "../naming/quiz.js";
import { Sound } from "../practice/audio.js";
import { initTimer, setTimer, renderTimer, timerSettings } from "../practice/timer.js";
import { Midi } from "../input/midi.js";

startPage({ title: "navNameTrainer", stats: true });

// ---------- 출제 설정·건반·입력·버튼 ----------
initSettings(newQuestion);
// 건반: 문제로 눌린 건반은 그 음을 들려주고, 안 눌린 건반은 알림만 (2026-11-09 사용자 요청).
// 누른 것은 타이머의 "5분 무입력" 판정에서 입력으로 셈 — practice/timer.js가 화면 어디든 누르면 입력으로 치므로 따로 할 일 없음
initKeys((m, pressed) => pressed ? Sound.note(m) : toast(t("keysQuestionOnly"), 2000));
initKeypad(answerChanged);
$("btnCheck").onclick = submit;
$("btnReveal").onclick = reveal;
$("btnNext").onclick = tryNext;
$("padHint").onclick = showHint;
$("btnListen").onclick = () => { if (state.q) Sound.chord(state.q.notes.map(n => n.midi), false); };
$("optLabels").onchange = e => { S.labels = e.target.checked; save(); draw(); };

// ---------- 키보드 단축키 (사용자 결정 2026-11-08) ----------
// 글자 키는 모두 코드 입력이라(G7, Cmin7) 랜덤 코드 연습의 G·N은 쓰지 않음.
//   Enter  제출 (끝난 문제면 다음 문제)      →  커서가 맨 끝이면 다음 문제, 아니면 커서를 오른쪽으로     ←  커서를 왼쪽으로
//   Backspace / Delete  커서 앞 / 뒤 조각(고른 부분이 있으면 그 부분) 지우기     Home / End  커서를 맨 앞 / 맨 끝으로 (2026-11-08)
//   ⌘A 입력칸 전체 선택(비어 있으면 브라우저 기본), ⌘C 고른 부분 복사, ⌘X 잘라내기, ⌘V 붙여넣기,
//   ⌘Z 되돌리기, ⌘⇧Z·Ctrl+Y 다시 실행, Shift+← → 선택 (2026-11-08)
//   Space  문제 코드 들어보기 — 옵션 체크·코드 칩·키패드 버튼에 초점이 있어도 그것을 누르지 않고 재생 (2026-11-10 사용자 요청,
//          랜덤 코드 연습과 같게. 예전엔 체크가 켜졌다 꺼지며 문제가 바뀌었음. 막는 건 아래 keyup도 함께)
//   글자 키는 어디서 치든 입력칸으로 (입력칸은 <input>이 아니라서 초점과 상관없음 — naming/keypad.js)
document.addEventListener("keydown", e => {
  if (authOpen() || document.querySelector("dialog[open]") || menuOpen()) return;   // 우클릭 메뉴가 열려 있으면 메뉴가 키를 받음
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  // ⌘A / Ctrl+A: 입력칸에 글자가 있으면 입력칸 전체 선택 (비어 있으면 브라우저 기본 = 페이지 전체 선택). ⌘C·⌘V는 keypad.js의 copy·paste
  if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "a" || e.key === "A")) { if (selectAll()) e.preventDefault(); return; }
  // ⌘Z / Ctrl+Z 되돌리기, ⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y 다시 실행 (맥 ⌘Y는 브라우저 방문 기록이라 그대로). 할 게 없으면 브라우저 기본
  if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "z" || e.key === "Z")) { if (e.shiftKey ? redo() : undo()) e.preventDefault(); return; }
  if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "y" || e.key === "Y")) { if (redo()) e.preventDefault(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Enter") {
    e.preventDefault();
    if (state.locked) newQuestion(); else submit();
  } else if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat && state.q) Sound.chord(state.q.notes.map(n => n.midi), false);
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const d = e.key === "ArrowRight" ? 1 : -1;
    if (e.shiftKey) extendCaret(d);                // Shift+← → : 선택 넓히기·줄이기
    else if (d > 0 && caretAtEnd()) tryNext();     // →: 커서가 맨 끝이면 다음 문제
    else moveCaret(d);
  } else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
  else if (e.key === "Delete") { e.preventDefault(); deleteForward(); }
  else if (e.key === "Home" || e.key === "End") { e.preventDefault(); caretTo(e.key === "End"); }
  else if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); type(e.key); }
}, true);

// 체크박스·버튼은 Space를 뗄 때 눌림(클릭)으로 처리하는 브라우저가 있어서, 위에서 재생으로 쓴 Space는 뗄 때도 막음
document.addEventListener("keyup", e => {
  if (e.code !== "Space" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (authOpen() || document.querySelector("dialog[open]") || menuOpen()) return;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  e.preventDefault();
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

// ---------- MIDI 건반: 소리만 (2026-11-10 사용자 요청) ----------
// 랜덤 코드 연습에서 MIDI 건반을 허용한 브라우저면 권한 창 없이 연결(Midi.autoConnect — 아직 허용 안 했으면 아무것도 안 함).
// 누른 음은 문제와 상관없이(화면에 없는 음도) 소리만 내요. 답 입력·채점·타이머(5분 무입력)에는 쓰지 않아요.
// 세기·떼기·서스테인 페달은 랜덤 코드 연습과 같음 (audio.js noteOn 등)
Midi.on("noteon", (m, vel) => { if (!authOpen() && !document.querySelector("dialog[open]")) Sound.noteOn(m, vel); });
Midi.on("noteoff", m => Sound.noteOff(m));
Midi.on("pedal", on => Sound.pedal(on));
Midi.on("state", () => { if (Midi.devices.length) Sound.loadFull(); });   // 88건반 녹음도 미리 받기
Midi.autoConnect();

// ---------- 타이머 (랜덤 코드 연습과 같은 규칙, 세션은 연습 구분 "name") ----------
initTimer(timerHooks, { mode: "name", S, sessionSettings: review => timerSettings(S, review, { optInv: !!S.optInv }) });

// ---------- 언어가 바뀌면 JS로 그린 문구를 다시 ----------
onLangChange(() => { syncSettingsUI(); renderPrompt(); renderFeedback(); renderHint(); renderReview(); renderTimer(); });

// ---------- 회원 기능과 연결 ----------
// 사이드바의 "틀린 문제 다시 풀기 → 코드 추론하기": 이 페이지에서는 바로 시작, 랜덤 코드 연습은 그 페이지로 이동
async function beginReview() {
  const items = await Account.reviewItems("name");
  if (!startReview(items)) toast(t("reviewNone"), 2000);
}
const goTrainerReview = authHooks.startReview;
authHooks.startReview = mode => (mode === "name" ? beginReview() : goTrainerReview(mode));

let reviewFromUrl = new URLSearchParams(location.search).get("review") === "1";   // 다른 페이지에서 [다시 풀기]로 들어옴
Account.on("profile", async profile => {
  // 출제 설정: 계정에 있으면 받아 오고(타이머는 끔), 첫 로그인이면 이 기기 설정을 계정에 올림
  if (profile.name_settings) { setTimer(false); replaceSettings(profile.name_settings); syncSettingsUI(); $("optLabels").checked = S.labels; newQuestion(); }
  else Account.settingsChanged(S, "name_settings");
  // 머리글 숫자: 계정의 이 연습 누적 기록으로 (로그인·새로고침 때만, 그 뒤로는 화면에서 +1, DB에서도 +1)
  const totals = await Account.loadTotals("name");
  if (totals) { Object.assign(stats, totals); renderStats(); }
  if (reviewFromUrl) { reviewFromUrl = false; history.replaceState(null, "", location.pathname); beginReview(); }
});
Account.on("signedOut", () => {
  setTimer(false);
  Object.assign(stats, { first: 0, total: 0, streak: 0 }); renderStats();
  if (inReview()) stopReview(false);
});

// ---------- 시작 ----------
$("optLabels").checked = S.labels;
syncSettingsUI(); renderStats();
newQuestion();
