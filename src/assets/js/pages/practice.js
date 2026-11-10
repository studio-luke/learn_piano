// ===== 연습 페이지 (index.html) — 시작점 =====
// 각 부분을 만들고 서로 연결해요.
//   settings.js  출제 설정 카드        keyboard.js  건반        audio.js  소리
//   quiz.js      문제 흐름·채점·기록    timer.js     타이머
// 그리고 키보드 단축키, MIDI 건반(input/midi.js), 회원 기능(계정 설정·누적 기록·다시 풀기)과의 연결을 여기서 해요.
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { hooks as authHooks, isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { store } from "../common/storage.js";
import { S, IS_PC, initSettings, syncSettingsUI, replaceSettings, save } from "../practice/settings.js";
import { initKeyboard, setKeyLabels, selected, renderKeys, CODE_TO_MIDI, LOW, HIGH, setFull, selectable, select } from "../practice/keyboard.js";
import { Sound } from "../practice/audio.js";
import { initTimer, setTimer, renderTimer, timerSettings, markInput } from "../practice/timer.js";
import { Midi, midiSelection } from "../input/midi.js";
import {
  state, stats, renderStats, newQuestion, tryNext, check, reveal, keysChanged,
  startReview, stopReview, inReview, renderPrompt, renderFeedback, renderReview, timerHooks,
} from "../practice/quiz.js";

startPage({ stats: true });

// ---------- 출제 설정·건반·작은 옵션 ----------
initSettings(newQuestion);
// 건반을 누르면 그 음, 선택을 풀면 울리던 그 음을 멈춤 (2026-11-09 사용자 요청)
const kb = initKeyboard((m, on) => { if (on) { if (S.sound) Sound.note(m); } else Sound.stop(m); keysChanged(); });
/** 건반 선택 모두 해제 ([지우기]·Esc·Backspace) — 해제하는 음의 소리도 멈춤 */
const clearKeys = () => { for (const m of selected) Sound.stop(m); selected.clear(); renderKeys(); };
/** MIDI 입력 모드(88건반)가 켜져 있는지 — 컴퓨터 + Web MIDI를 지원하는 브라우저에서만 */
const midiMode = () => !!S.midi && IS_PC && Midi.supported;
const syncToggles = () => {
  $("optLabels").checked = S.labels; $("optSound").checked = S.sound; $("optKbd").checked = S.kbd;
  // MIDI 입력 모드에서는 컴퓨터 키보드로 건반 입력이 꺼짐 (88건반에 키를 다 붙일 수 없어서) — 체크는 회색으로
  $("optMidi").checked = midiMode(); $("optKbd").disabled = midiMode();
  setFull(midiMode());
  document.querySelector(".layout").classList.toggle("midi-full", midiMode());
  setKeyLabels(S.labels, !!S.kbd && IS_PC && !midiMode());
};
$("optLabels").onchange = e => { S.labels = e.target.checked; syncToggles(); save(); };
$("optSound").onchange = e => { S.sound = e.target.checked; save(); };
$("optKbd").onchange = e => { S.kbd = e.target.checked; S.kbdTouched = true; syncToggles(); save(); };

// ---------- 버튼 ----------
$("btnCheck").onclick = check;
$("btnReveal").onclick = reveal;
$("btnNext").onclick = tryNext;   // 건반이 눌려 있으면 막고 안내
$("btnClear").onclick = clearKeys;
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
  if (e.code === "Enter" || e.code === "NumpadEnter") {
    // 코드 칩·옵션 체크·건반을 마우스로 누른 뒤 초점이 거기 남아 있어도 Enter는 제출 (2026-11-09 사용자 요청 — 예전엔 건너뛰어서
    // 칩을 고른 뒤 Enter가 안 먹었음. 체크박스는 Enter로 켜지지 않고, 건반은 Space로 누를 수 있어서 잃는 것 없음)
    e.preventDefault();
    if (state.locked) newQuestion(); else check();
  } else if (e.code === "Space") {
    // 코드 칩·옵션 체크에 초점이 있어도 Space는 재생 — 체크를 켜고 끄지 않음 (2026-11-09 사용자 요청, 막는 건 아래 keyup도 함께).
    // Tab으로 초점을 옮긴 건반만 예외: Space로 그 건반을 누름 (keyboard.js, 접근성)
    if (onPianoKey) return;
    e.preventDefault(); if (selected.size) Sound.chord(selected, false);
  } else if (e.code === "Escape" || e.code === "Backspace") { e.preventDefault(); clearKeys(); }
  else if (e.code === "KeyN" || e.code === "ArrowRight") { e.preventDefault(); tryNext(); }
  else if (e.code === "KeyG") { e.preventDefault(); reveal(); }
  else if (S.kbd && IS_PC && !midiMode() && e.code in CODE_TO_MIDI) {
    e.preventDefault();
    if (!e.repeat) kb.toggle(CODE_TO_MIDI[e.code]);   // 키를 누르고 있어도 한 번만
  }
}, true);

// 체크박스·버튼은 Space를 뗄 때 눌림(클릭)으로 처리하는 브라우저가 있어서, 위에서 재생으로 쓴 Space는 뗄 때도 막음
document.addEventListener("keyup", e => {
  if (e.code !== "Space" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (authOpen() || document.querySelector("dialog[open]")) return;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  if (el.classList && el.classList.contains("key")) return;
  e.preventDefault();
}, true);

// ---------- MIDI 건반 (2026-11-09 사용자 요청, 연결·권한은 input/midi.js) ----------
// - MIDI 입력은 "MIDI 입력 모드" 체크와 상관없이 동작해요. 체크는 88건반을 보여주고 모든 음을 고를 수 있게 하는 것.
//   권한은 처음 한 번 체크를 켤 때 묻고, 한 번 허용한 브라우저면 페이지를 열 때 자동으로 연결(Midi.autoConnect)
// - 보통 건반(C3~C5)일 때 범위 밖 음: 소리만 내고 고르지 않음 + "한 옥타브 아래 음으로 눌러주세요" 같은 안내
// - 고르는 규칙은 "latch": 누르면 선택, 떼도 유지, 모든 건반을 뗀 뒤 다시 누르면 새 화음으로 교체
// - 소리는 "건반 누를 때 소리" 설정을 따름(소리 없는 마스터 키보드도 있어서). 세기·떼기·서스테인 페달 반영(audio.js noteOn 등)
// - Safari 등 지원하지 않는 브라우저: 체크를 꺼진 모양으로, 누르면 "Chrome이나 Edge에서 열어 주세요" 안내
{
  const pick = midiSelection("latch", {
    add: m => select(m, true),
    remove: m => select(m, false),
    clear: () => { selected.clear(); renderKeys(); },   // 새 화음 시작 — 소리는 건반을 뗄 때 이미 줄어들고 있어서 따로 멈추지 않음
  });
  /** 보통 건반 범위(C3~C5) 밖의 음 → 옥타브 이동 안내 문구 키 (A0~C8이면 최대 세 옥타브, 그보다 멀면 범위 안내) */
  const octaveMsg = m => {
    const n = m > HIGH ? Math.ceil((m - HIGH) / 12) : Math.ceil((LOW - m) / 12);
    return n > 3 ? "octOut" : (m > HIGH ? "octDown" : "octUp") + n;
  };
  let soundTipShown = false;
  Midi.on("noteon", (m, vel) => {
    // 로그인 창 등이 열려 있으면 꺼짐 (컴퓨터 키보드 입력과 같은 규칙)
    if (authOpen() || document.querySelector("dialog[open]")) return;
    markInput();   // 타이머의 5분 무입력 판단
    if (S.sound) {
      Sound.noteOn(m, vel);
      // 화면을 한 번도 누르지 않았으면 브라우저가 소리를 막음(MIDI 입력은 "사용자가 눌렀다"로 인정되지 않음) → 한 번만 안내
      setTimeout(() => { if (!soundTipShown && !Sound.running()) { soundTipShown = true; toast(t("midiClickForSound")); } }, 300);
    }
    if (!selectable(m)) { if (!midiMode()) toast(t(octaveMsg(m)), 2000); return; }
    pick.down(m);
    keysChanged();
  });
  Midi.on("noteoff", m => { Sound.noteOff(m); if (selectable(m)) pick.up(m); });
  Midi.on("pedal", on => Sound.pedal(on));
  Midi.on("state", () => { renderMidi(); if (Midi.devices.length) Sound.loadFull(); });   // 건반이 연결되면 88건반 녹음도 미리 받기

  // MIDI 입력 모드 켜기/끄기 — 켤 때 아직 권한이 없으면 브라우저가 권한 창을 띄움. 거부하면 다시 끔
  $("optMidi").onchange = async e => {
    S.midi = e.target.checked; save(); syncToggles(); renderMidi();
    if (S.midi && !(await Midi.connect())) { S.midi = false; save(); syncToggles(); renderMidi(); toast(t("midiDenied")); }
  };
  // 지원하지 않는 브라우저: 체크는 켜지지 않고 안내만 ([다음 문제] 막기처럼 꺼진 모양이지만 누를 수 있음)
  if (!Midi.supported) {
    $("midiOpt").classList.add("is-off");
    $("midiOpt").addEventListener("click", e => { e.preventDefault(); toast(t("midiUnsupported")); });
  }
  // 시작: MIDI 입력 모드가 켜져 있던 기기면 연결(권한이 없으면 물음), 아니면 전에 허용한 브라우저일 때만 조용히 연결
  if (midiMode()) Midi.connect().then(ok => { if (!ok) { S.midi = false; save(); syncToggles(); renderMidi(); } });
  else Midi.autoConnect();
}
/**
 * 체크 옆 작은 글씨: "● MIDI 연결됨"(초록 점) / "● 연결된 MIDI 건반 없음"(빨간 점, 모드가 켜져 있을 때) / 지원 안 하는 브라우저 안내.
 * 연결됨은 기기 이름 없이 초록 점과 짧은 문구만, 이름은 마우스를 올리면 보이는 툴팁으로 (2026-11-09 사용자 결정 —
 * MODX처럼 한 기기가 포트 여러 개로 잡히면 "MODX 포트 1, MODX 포트 2, …"로 너무 길어져서)
 */
function renderMidi() {
  const el = $("midiStatus");
  const on = Midi.state === "ready" && Midi.devices.length > 0;
  const none = !on && Midi.state === "ready" && midiMode();
  let text = "";
  if (!Midi.supported) text = t("midiUseChrome");
  else if (on) text = t("midiConnected");
  else if (none) text = t("midiNoDevice");
  el.textContent = text;
  el.classList.toggle("on", on);
  el.classList.toggle("none", none);
  if (on) el.title = Midi.devices.join("\n"); else el.removeAttribute("title");
}

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
initTimer(timerHooks, { mode: "play", S, sessionSettings: review => timerSettings(S, review, { optD: !!S.optD }) });

// ---------- 언어가 바뀌면 JS로 그린 문구를 다시 ----------
onLangChange(() => { syncSettingsUI(); renderPrompt(); renderFeedback(); renderKeys(); renderReview(); renderTimer(); renderMidi(); });

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
syncSettingsUI(); syncToggles(); renderStats(); renderMidi();
newQuestion();
