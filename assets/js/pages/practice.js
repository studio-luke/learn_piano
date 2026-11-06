// ===== 연습 페이지 (index.html) — 시작점 =====
// 각 부분을 만들고 서로 연결해요.
//   settings.js  출제 설정 카드        keyboard.js  건반        audio.js  소리
//   quiz.js      문제 흐름·채점·기록    timer.js     타이머
// 그리고 키보드 단축키, 회원 기능(계정 설정·누적 기록·다시 풀기)과의 연결을 여기서 해요.
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { hooks as authHooks, isOpen as authOpen } from "../account/auth-dialog.js";
import { onLangChange } from "../i18n/index.js";
import { $ } from "../common/dom.js";
import { store } from "../common/storage.js";
import { S, IS_PC, initSettings, syncSettingsUI, replaceSettings, save } from "../practice/settings.js";
import { initKeyboard, setKeyLabels, selected, renderKeys, CODE_TO_MIDI } from "../practice/keyboard.js";
import { Sound } from "../practice/audio.js";
import { initTimer, setTimer, renderTimer } from "../practice/timer.js";
import {
  state, stats, renderStats, newQuestion, check, reveal, keysChanged,
  startReview, stopReview, inReview, renderPrompt, renderFeedback, renderReview, timerHooks,
} from "../practice/quiz.js";

startPage({ stats: true });

// ---------- 출제 설정·건반·작은 옵션 ----------
initSettings(newQuestion);
const kb = initKeyboard((m, on) => { if (on && S.sound) Sound.note(m); keysChanged(); });
const syncToggles = () => {
  $("optLabels").checked = S.labels; $("optSound").checked = S.sound; $("optKbd").checked = S.kbd;
  setKeyLabels(S.labels, !!S.kbd && IS_PC);
};
$("optLabels").onchange = e => { S.labels = e.target.checked; syncToggles(); save(); };
$("optSound").onchange = e => { S.sound = e.target.checked; save(); };
$("optKbd").onchange = e => { S.kbd = e.target.checked; S.kbdTouched = true; syncToggles(); save(); };

// ---------- 버튼 ----------
$("btnCheck").onclick = check;
$("btnReveal").onclick = reveal;
$("btnNext").onclick = newQuestion;
$("btnClear").onclick = () => { selected.clear(); renderKeys(); };
$("btnPlaySel").onclick = () => { if (selected.size) Sound.chord(selected, false); };
$("reviewStop").onclick = () => stopReview(false);

// ---------- 키보드 단축키 ----------
// 초점이 어디 있든 동작해요(초점 받은 버튼이 Enter/Space를 먹지 않게). 언어 고르기·글자 입력 칸에서는 꺼짐.
// 물리 키(e.code)로 맞춰서 한글 입력 상태에서도 동작해요.
//   Enter 채점 (끝난 문제면 다음 문제)   Space 누른 건반 재생   Esc/Backspace 지우기
//   N 또는 → 다음 문제                    L 정답 확인            그 밖: 키보드로 건반 입력(옵션)
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // 로그인 창·메뉴 등 창이 열려 있으면 꺼짐 (로그인 창에 글자를 치는 동안 피아노가 울리면 안 됨)
  if (authOpen() || document.querySelector("dialog[open]")) return;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  const onPianoKey = el.classList && el.classList.contains("key");
  const onToggle = tag === "input";
  if (e.code === "Enter" || e.code === "NumpadEnter") {
    if (onPianoKey || onToggle) return;
    e.preventDefault();
    if (state.locked) newQuestion(); else check();
  } else if (e.code === "Space") {
    if (onPianoKey || onToggle) return;
    e.preventDefault(); if (selected.size) Sound.chord(selected, false);
  } else if (e.code === "Escape" || e.code === "Backspace") { e.preventDefault(); selected.clear(); renderKeys(); }
  else if (e.code === "KeyN" || e.code === "ArrowRight") { e.preventDefault(); newQuestion(); }
  else if (e.code === "KeyL") { e.preventDefault(); reveal(); }
  else if (S.kbd && IS_PC && e.code in CODE_TO_MIDI) {
    e.preventDefault();
    if (!e.repeat) kb.toggle(CODE_TO_MIDI[e.code]);   // 키를 누르고 있어도 한 번만
  }
}, true);

// ---------- 폰 세로 안내 (한 번 닫으면 다시 안 나옴, 보이는 곳은 CSS가 정함) ----------
$("rotateTip").hidden = store.get("rotateTip") === "closed";
$("rotateTipClose").onclick = () => { $("rotateTip").hidden = true; store.set("rotateTip", "closed"); };

// ---------- 타이머 ----------
initTimer(timerHooks);

// ---------- 언어가 바뀌면 JS로 그린 문구를 다시 ----------
onLangChange(() => { syncSettingsUI(); renderPrompt(); renderFeedback(); renderKeys(); renderReview(); renderTimer(); });

// ---------- 회원 기능과 연결 ----------
// 사이드바의 "틀린 문제 다시 풀기": 이 페이지에서는 바로 시작
async function beginReview() {
  const items = await Account.reviewItems();
  if (items && items.length) startReview(items);
}
authHooks.startReview = beginReview;

let reviewFromUrl = new URLSearchParams(location.search).get("review") === "1";   // 마이페이지의 [다시 풀기]
Account.on("profile", async profile => {
  // 출제 설정: 계정에 있으면 받아 오고(타이머는 끔), 첫 로그인이면 이 기기 설정을 계정에 올림
  if (profile.settings) { setTimer(false); replaceSettings(profile.settings); syncSettingsUI(); syncToggles(); newQuestion(); }
  else Account.settingsChanged(S);
  // 머리글 숫자: 계정의 누적 기록으로 (로그인·새로고침 때만, 그 뒤로는 화면에서 +1, DB에서도 +1)
  const totals = await Account.loadTotals();
  if (totals) { Object.assign(stats, totals); renderStats(); }
  if (reviewFromUrl) { reviewFromUrl = false; history.replaceState(null, "", location.pathname); beginReview(); }
});
Account.on("signedOut", () => {
  setTimer(false);
  Object.assign(stats, { first: 0, total: 0, streak: 0 }); renderStats();
  if (inReview()) stopReview(false);
});

// ---------- 시작 ----------
syncSettingsUI(); syncToggles(); renderStats();
newQuestion();
