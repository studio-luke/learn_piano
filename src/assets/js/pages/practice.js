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
import { initTimer, setTimer, renderTimer, timerSettings } from "../practice/timer.js";
import {
  state, stats, renderStats, newQuestion, tryNext, check, reveal, keysChanged,
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
$("btnNext").onclick = tryNext;   // 건반이 눌려 있으면 막고 안내
$("btnClear").onclick = () => { selected.clear(); renderKeys(); };
$("btnPlaySel").onclick = () => { if (selected.size) Sound.chord(selected, false); };
$("reviewStop").onclick = () => stopReview(false);

// ---------- 키보드 단축키 ----------
// 초점이 어디 있든 동작해요(초점 받은 버튼이 Enter/Space를 먹지 않게). 언어 고르기·글자 입력 칸에서는 꺼짐.
// 물리 키(e.code)로 맞춰서 한글 입력 상태에서도 동작해요.
//   Enter 채점 (끝난 문제면 다음 문제)   Space 누른 건반 재생   Esc/Backspace 지우기
//   N 또는 → 다음 문제(풀던 문제에 건반이 눌려 있으면 막힘)   G 정답 확인(2026-11-07 L → G, L이 건반 키가 되어서)   그 밖: 키보드로 건반 입력(옵션)
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
  else if (e.code === "KeyN" || e.code === "ArrowRight") { e.preventDefault(); tryNext(); }
  else if (e.code === "KeyG") { e.preventDefault(); reveal(); }
  else if (S.kbd && IS_PC && e.code in CODE_TO_MIDI) {
    e.preventDefault();
    if (!e.repeat) kb.toggle(CODE_TO_MIDI[e.code]);   // 키를 누르고 있어도 한 번만
  }
}, true);

// ---------- 폰 세로 안내 (한 번 닫으면 다시 안 나옴, 보이는 곳은 CSS가 정함) ----------
$("rotateTip").hidden = store.get("rotateTip") === "closed";
$("rotateTipClose").onclick = () => { $("rotateTip").hidden = true; store.set("rotateTip", "closed"); };

// ---------- 폰 세로 첫 방문: 출제 설정이 아래에 있다고 알려주는 알약 (2026-11-07 사용자 요청) ----------
// 지인들이 폰에서 스크롤을 내려야 코드 종류를 고를 수 있다는 걸 몰랐음.
// "첫 방문"은 쿠키가 아니라 localStorage로 판단: 서버에 보낼 필요가 없는 이 기기만의 표시라서 (rotateTip과 같은 방식).
// 들어오기만 해서는 표시하지 않고, 출제 설정 제목이 실제로 화면에 한 번 들어와야(또는 알약을 눌러야) "seen" → 다시 안 나옴.
// 그래서 넓은 화면처럼 출제 설정이 처음부터 보이는 기기는 곧바로 seen이 되고, 알약도 CSS가 폰 세로에서만 보여줌.
{
  const tip = $("scrollTip");
  const head = document.querySelector(".sheet h2");
  const done = () => { tip.hidden = true; store.set("scrollTip", "seen"); seen.disconnect(); };
  // 제목이 화면 위쪽 65% 안에 들어와야 "봤다"고 침 — 맨 아래에 제목만 걸쳐 있으면(채점 버튼 줄 뒤, 코드 칩은 안 보임) 아직 모르는 상태라서
  const seen = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) done(); }, { rootMargin: "0px 0px -35% 0px" });
  if (store.get("scrollTip") !== "seen" && head && "IntersectionObserver" in window) {
    tip.hidden = false;
    seen.observe(head);
    $("scrollTipGo").onclick = () => { done(); head.closest(".sheet").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("scrollTipX").onclick = done;   // ×: 스크롤하지 않고 닫기 (다시 안 나옴 — 2026-11-08)
  }
}

// ---------- 타이머 ----------
initTimer(timerHooks, { mode: "play", S, save, sessionSettings: review => timerSettings(S, review, { optD: !!S.optD }) });

// ---------- 언어가 바뀌면 JS로 그린 문구를 다시 ----------
onLangChange(() => { syncSettingsUI(); renderPrompt(); renderFeedback(); renderKeys(); renderReview(); renderTimer(); });

// ---------- 회원 기능과 연결 ----------
// 사이드바의 "틀린 문제 다시 풀기": 이 페이지에서는 바로 시작
async function beginReview() {
  const items = await Account.reviewItems();
  if (items && items.length) startReview(items);
}
// 사이드바에서 고른 연습: 랜덤 코드 연습이면 여기서 바로 시작, 코드 추론하기는 그 페이지로 이동
const goOtherReview = authHooks.startReview;
authHooks.startReview = mode => (mode === "name" ? goOtherReview(mode) : beginReview());

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
