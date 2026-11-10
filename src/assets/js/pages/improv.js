// ===== 코드 초견 (trainer/chord-improv/index.html) — 시작점 =====
// 메트로놈에 맞춰 나오는 코드를 보고 바로 연주하는 연습. 한 페이지에 모드 탭 두 개:
//   "random"  무작위 코드 — 마디마다 무작위 코드 (주소에 mode 없음)
//   "prog"    8마디 코드진행 — 입시형 코드진행 악보 (주소 ?mode=prog)
// 각 부분을 만들고 서로 연결해요:
//   improv/metronome.js  메트로놈(클릭 예약·카운트인)     improv/keys.js  88건반(컴퓨터만, 누르는 동안만 선택)
//   practice/audio.js    피아노 소리(랜덤 코드 연습과 같음) — 메트로놈도 같은 소리 장치를 씀
//   input/midi.js        MIDI 건반 (hold 규칙)
// 지금(2단계)은 탭·메트로놈·카운트인·박 표시·건반까지. 코드 출제는 다음 단계. 규칙은 chordoven-spec.md "코드 초견".
import { startPage } from "../common/layout.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { store } from "../common/storage.js";
import { Sound } from "../practice/audio.js";
import { Midi } from "../input/midi.js";
import { createMetronome, clampBpm, BPM_MIN, BPM_MAX } from "../improv/metronome.js";
import { initKeys, press } from "../improv/keys.js";

startPage({ title: "navImprov" });

/** 컴퓨터인지 (마우스처럼 정확히 가리키고 올릴 수 있는 기기) — 랜덤 코드 연습 practice/settings.js IS_PC와 같은 기준 */
const IS_PC = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

// ---------- 기기에 저장하는 값 (계정에는 올리지 않음) ----------
//   chordoven.improvBpm        템포 (두 모드 공통)
//   chordoven.improvMidiSound  MIDI 건반 입력 시 소리 재생 ("off"면 끔, 처음엔 켜짐)
let bpm = clampBpm(store.get("improvBpm") ?? undefined);
let midiSound = store.get("improvMidiSound") !== "off";

// ---------- 모드 탭 ----------
const MODES = ["random", "prog"];
const TABS = { random: $("tabRandom"), prog: $("tabProg") };
const PANELS = { random: $("panelRandom"), prog: $("panelProg") };

/** 주소의 ?mode → 지금 모드. 모르는 값이나 없으면 무작위 코드 */
const modeFromUrl = () => (new URLSearchParams(location.search).get("mode") === "prog" ? "prog" : "random");

/**
 * 고른 모드를 주소에 남김. 방문 기록을 새로 쌓지 않고 지금 주소만 바꿔요(replaceState) —
 * 탭을 여러 번 눌러도 뒤로 가기 한 번이면 이전 페이지로 (통계 화면 탭과 같은 방식, stats/view.js setModeInUrl)
 */
function setModeInUrl(mode) {
  const u = new URL(location.href);
  if (mode === "random") u.searchParams.delete("mode"); else u.searchParams.set("mode", mode);
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** 모드 화면 바꾸기: 고른 탭만 선택 표시, 그 모드의 내용만 보임 */
function showMode(mode) {
  for (const m of MODES) {
    TABS[m].setAttribute("aria-selected", String(m === mode));
    TABS[m].tabIndex = m === mode ? 0 : -1;   // 탭 줄 안에서는 ← → 로 옮겨 다님 (아래 keydown)
    PANELS[m].hidden = m !== mode;
  }
}

// 탭을 바꾸면 메트로놈은 멈춤 (모드마다 무엇을 셀지 달라서)
for (const m of MODES) TABS[m].onclick = () => { if (metro.running) metro.stop(); showMode(m); setModeInUrl(m); };

// 키보드: 탭에 초점이 있을 때 ← → 로 다른 탭으로 (탭 목록의 일반적인 키 동작)
$("tabRandom").parentElement.addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const i = MODES.indexOf(e.target.dataset.mode);
  if (i < 0) return;
  const next = MODES[(i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length];
  e.preventDefault();
  TABS[next].focus();
  TABS[next].click();
});

// ---------- 메트로놈·카운트인·박 표시 ----------
// 시작하면 한 마디 카운트인(클릭 4번 동안 "3, 2, 1, GO"), 그다음부터 박 점 4개 중 지금 박을 켬 (2026-11-10 사용자 결정)
const dots = [...$("beatDots").children];
const metro = createMetronome({
  getContext: Sound.context,
  onBeat: info => {
    const c = $("countIn");
    if (info.countIn) {
      c.hidden = false;
      c.textContent = info.label;
      c.classList.toggle("go", info.label === "GO");
      c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");   // 숫자가 바뀔 때마다 톡 튀어나옴 (애니메이션 다시 시작)
    } else c.hidden = true;
    // 박 점: 카운트인 동안에도 같은 자리를 켬 (한 마디 = 점 4개)
    dots.forEach((d, i) => d.classList.toggle("on", i === info.beat));
    dots[0].classList.toggle("accent", info.beat === 0);
  },
  onStop: () => renderPlay(),
});

/** 시작/중지 버튼 글자와 상태 + 멈췄으면 카운트인·박 점 지우기 */
function renderPlay() {
  const on = metro.running;
  $("btnPlay").setAttribute("aria-pressed", String(on));
  $("btnPlayText").textContent = t(on ? "improvStop" : "improvStart");
  if (!on) {
    $("countIn").hidden = true;
    dots.forEach(d => d.classList.remove("on", "accent"));
  }
  keepAwake(on);
}

$("btnPlay").onclick = () => {
  if (metro.running) metro.stop();
  else if (!metro.start({ bpm, beats: 4, countIn: true })) toast(t("improvNoAudio"));
  renderPlay();
};

// ---------- 템포 (30~240, 기본 60 — 사용자 결정 2026-11-10) ----------
// 연주 중에 바꾸면 다음 박부터 적용. 칸에 쓰는 동안(input)에는 범위 밖 값을 그대로 두고, 칸을 벗어날 때(change) 범위로 맞춤
const bpmInput = $("bpm");
function setBpm(v, fromTyping = false) {
  bpm = clampBpm(v);
  if (!fromTyping) bpmInput.value = bpm;
  metro.setBpm(bpm);
  store.set("improvBpm", String(bpm));
}
bpmInput.value = bpm;
bpmInput.addEventListener("input", () => {
  const n = Number(bpmInput.value);
  if (bpmInput.value !== "" && n >= BPM_MIN && n <= BPM_MAX) setBpm(n, true);
});
bpmInput.addEventListener("change", () => setBpm(bpmInput.value === "" ? bpm : bpmInput.value));
/**
 * −/+ 버튼 (2026-11-10 사용자 요청): 누르는 순간 1 바뀌고, 꾹 누르고 있으면 HOLD_DELAY 뒤부터 HOLD_EVERY마다
 * 다음 10단위로 (60에서 + : 61 → 70 → 80…, − : 59 → 50 → 40…).
 * 손가락이 10px 넘게 움직이면(스크롤하려던 것) 반복을 멈춤. 키보드(Tab으로 초점 → Enter·Space)는 click으로 1씩.
 * @param dir  -1(−) | 1(+)
 */
const HOLD_DELAY = 500, HOLD_EVERY = 250;
/** 그 방향의 다음 10단위 값: tenStep(61, 1) = 70, tenStep(70, 1) = 80, tenStep(59, -1) = 50 (범위 끝은 setBpm이 맞춤) */
const tenStep = (v, dir) => (dir > 0 ? Math.floor(v / 10) * 10 + 10 : Math.ceil(v / 10) * 10 - 10);
function stepButton(btn, dir) {
  let timer = 0, start = null;
  const end = () => { clearTimeout(timer); clearInterval(timer); timer = 0; start = null; };
  btn.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();   // 초점·글자 선택이 생기지 않게 (누르는 순간 바뀌므로 click은 아래에서 무시)
    end();
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setBpm(bpm + dir);
    timer = setTimeout(() => { setBpm(tenStep(bpm, dir)); timer = setInterval(() => setBpm(tenStep(bpm, dir)), HOLD_EVERY); }, HOLD_DELAY);
  });
  btn.addEventListener("pointermove", e => {
    if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) end();
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) btn.addEventListener(ev, end);
  btn.addEventListener("contextmenu", e => e.preventDefault());   // 폰에서 꾹 누를 때 메뉴가 뜨지 않게
  // 키보드로 누른 click만 받음 (마우스·터치는 이미 pointerdown에서 바꿨음 — detail 0 = 키보드)
  btn.addEventListener("click", e => { if (e.detail === 0) setBpm(bpm + dir); });
}
stepButton($("bpmDown"), -1);
stepButton($("bpmUp"), 1);

// ---------- 화면 꺼짐 방지 (재생 중에만 — 폰을 악보대에 세워 두고 볼 때, 2026-11-10 사용자 결정) ----------
// Wake Lock은 탭이 뒤로 가면 브라우저가 풀어 버려서, 돌아왔을 때 아직 재생 중이면 다시 요청해요. 지원하지 않는 브라우저는 그냥 넘어감
let wakeLock = null;
async function keepAwake(on) {
  if (!("wakeLock" in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* 배터리 절약 모드 등으로 거절되면 화면 꺼짐 방지 없이 계속 */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && metro.running) keepAwake(true); });

// ---------- 88건반과 MIDI 건반 (컴퓨터에서만, 2026-11-10 사용자 결정) ----------
// 아직 연주를 채점하지 않으니 누르는 동안 하이라이트 + 소리만.
//   - 마우스: 누르면 선택·소리, 떼면 해제·소리 줄어듦 (늘 소리 — "MIDI 건반 입력 시 소리 재생" 옵션은 MIDI에만)
//   - MIDI: hold 규칙(누르는 동안만 선택). 세기·떼기·서스테인 페달 반영(practice/audio.js noteOn 등)
//   - 권한: 전에 허용한 브라우저면 페이지를 열 때 자동 연결, 아니면 [MIDI 건반 연결]을 누를 때 권한 창 (모든 방문자에게 권한 창을 띄우지 않으려고)
if (IS_PC) {
  Sound.preload();   // 피아노 녹음 (폰은 메트로놈만 쓰니 받지 않음)
  $("keysCard").hidden = false;
  initKeys((m, down) => { if (down) Sound.noteOn(m, 90); else Sound.noteOff(m); });

  $("optMidiSound").checked = midiSound;
  $("optMidiSound").onchange = e => { midiSound = e.target.checked; store.set("improvMidiSound", midiSound ? "on" : "off"); };

  let soundTipShown = false;
  Midi.on("noteon", (m, vel) => {
    if (document.querySelector("dialog[open]")) return;   // 로그인 창 등이 열려 있으면 꺼짐 (랜덤 코드 연습과 같은 규칙)
    press(m, "midi", true);
    if (midiSound) {
      Sound.noteOn(m, vel);
      // 화면을 한 번도 누르지 않았으면 브라우저가 소리를 막음(MIDI 입력은 "사용자가 눌렀다"로 인정되지 않음) → 한 번만 안내
      setTimeout(() => { if (!soundTipShown && !Sound.running()) { soundTipShown = true; toast(t("midiClickForSound")); } }, 300);
    }
  });
  Midi.on("noteoff", m => { press(m, "midi", false); Sound.noteOff(m); });
  Midi.on("pedal", on => Sound.pedal(on));
  Midi.on("state", () => { renderMidi(); if (Midi.devices.length) Sound.loadFull(); });   // 건반이 연결되면 88건반 녹음도 미리 받기

  $("midiConnect").onclick = async () => {
    if (!Midi.supported) { toast(t("midiUnsupported")); return; }
    if (!(await Midi.connect())) toast(t("midiDenied"));
    renderMidi();
  };
  Midi.autoConnect();
  renderMidi();
}

/**
 * 건반 위 작은 글씨: "● MIDI 연결됨"(초록 점, 기기 이름은 툴팁) / "● 연결된 MIDI 건반 없음"(빨간 점) /
 * 지원하지 않는 브라우저 안내. 아직 권한을 받지 않았으면(또는 거부했으면) [MIDI 건반 연결] 버튼 — 랜덤 코드 연습과 같은 문구
 */
function renderMidi() {
  if (!IS_PC) return;
  const el = $("midiStatus");
  const ready = Midi.state === "ready";
  const on = ready && Midi.devices.length > 0;
  el.textContent = !Midi.supported ? t("midiUseChrome") : on ? t("midiConnected") : ready ? t("midiNoDevice") : "";
  el.classList.toggle("on", on);
  el.classList.toggle("none", ready && !on);
  if (on) el.title = Midi.devices.join("\n"); else el.removeAttribute("title");
  $("midiConnect").hidden = !Midi.supported || ready;
}

onLangChange(() => { renderPlay(); renderMidi(); });
showMode(modeFromUrl());
renderPlay();
