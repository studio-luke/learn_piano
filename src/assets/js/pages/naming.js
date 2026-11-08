// ===== 코드 추론하기 (trainer/chords-name/index.html) — 시작점 =====
// 각 부분을 만들고 서로 연결해요. 규칙은 core/naming.js, 문제 흐름·기록·다시 풀기는 naming/quiz.js.
//   naming/settings.js  출제 설정 카드     naming/keys.js   건반(보기만)     naming/keypad.js  코드 입력 키패드
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
import { initKeypad, type, backspace, moveCaret, caretAtEnd } from "../naming/keypad.js";
import {
  state, stats, renderStats, newQuestion, tryNext, submit, reveal, showHint, answerChanged, draw,
  startReview, stopReview, inReview, renderPrompt, renderFeedback, renderHint, renderReview, timerHooks,
} from "../naming/quiz.js";
import { Sound } from "../practice/audio.js";
import { initTimer, setTimer, renderTimer, timerSettings } from "../practice/timer.js";

startPage({ title: "navNameTrainer", stats: true });

// ---------- 출제 설정·건반·입력·버튼 ----------
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

// ---------- 타이머 (랜덤 코드 연습과 같은 규칙, 세션은 연습 구분 "name") ----------
initTimer(timerHooks, { mode: "name", S, save, sessionSettings: review => timerSettings(S, review, { optInv: !!S.optInv }) });

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
