// ===== 코드 초견 (trainer/chord-improv/index.html) — 시작점 =====
// 메트로놈에 맞춰 나오는 코드를 보고 바로 연주하는 연습. 한 페이지에 모드 탭 두 개:
//   "random"  무작위 코드 — 이전·현재·다음 코드, 한 코드당 ½·1·2마디 (주소에 mode 없음)
//   "prog"    8마디 코드진행 — 입시형 코드진행 악보 (주소 ?mode=prog, 5단계부터)
// 각 부분을 만들고 서로 연결해요:
//   improv/metronome.js  메트로놈(클릭 예약·카운트인)     improv/keys.js      88건반(컴퓨터만, 누르는 동안만 선택)
//   improv/random.js     무작위 코드 모드(코드 넘기기)    improv/settings.js  무작위 코드 모드의 출제 설정
//   practice/audio.js    피아노 소리(랜덤 코드 연습과 같음) — 메트로놈도 같은 소리 장치를 씀
//   input/midi.js        MIDI 건반 (hold 규칙)
// 규칙은 chordoven-spec.md "코드 초견".
import { startPage } from "../common/layout.js";
import { isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { store } from "../common/storage.js";
import { Sound } from "../practice/audio.js";
import { Midi } from "../input/midi.js";
import { createMetronome, clampBpm, BPM_MIN, BPM_MAX } from "../improv/metronome.js";
import { initKeys, press } from "../improv/keys.js";
import { initSettings, syncSettingsUI, presetSource, applyPreset } from "../improv/settings.js";
import { initPresetLink } from "../common/share-settings.js";
import { Engine } from "../core/engine.js";
import { ROUTES } from "../common/sitemap.js";
import * as Random from "../improv/random.js";

startPage({ title: "navImprov" });

/** 컴퓨터인지 (마우스처럼 정확히 가리키고 올릴 수 있는 기기) — 랜덤 코드 연습 practice/settings.js IS_PC와 같은 기준 */
const IS_PC = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

// ---------- 기기에 저장하는 값 (계정에는 올리지 않음) ----------
//   chordoven.improvBpm        템포 (두 모드 공통)
//   chordoven.improvMidiSound  MIDI 건반 입력 시 소리 재생 ("off"면 끔, 처음엔 켜짐)
//   chordoven.improvRandom.v1  무작위 코드 모드의 출제 설정 (improv/settings.js)
let bpm = clampBpm(store.get("improvBpm") ?? undefined);
let midiSound = store.get("improvMidiSound") !== "off";

// ---------- 모드 탭 ----------
const MODES = ["random", "prog"];
const TABS = { random: $("tabRandom"), prog: $("tabProg") };
const PANELS = { random: $("panelRandom"), prog: $("panelProg") };
const SHEETS = { random: $("sheetRandom"), prog: null };   // 모드별 출제 설정 (8마디 모드는 5단계에서)
let mode = "random";

/** 주소의 ?mode → 지금 모드. 모르는 값이나 없으면 무작위 코드 */
const modeFromUrl = () => (new URLSearchParams(location.search).get("mode") === "prog" ? "prog" : "random");

/**
 * 고른 모드를 주소에 남김. 방문 기록을 새로 쌓지 않고 지금 주소만 바꿔요(replaceState) —
 * 탭을 여러 번 눌러도 뒤로 가기 한 번이면 이전 페이지로 (통계 화면 탭과 같은 방식, stats/view.js setModeInUrl)
 */
function setModeInUrl(m) {
  const u = new URL(location.href);
  if (m === "random") u.searchParams.delete("mode"); else u.searchParams.set("mode", m);
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** 모드 화면 바꾸기: 고른 탭만 선택 표시, 그 모드의 내용·출제 설정만 보임 (출제 설정이 없으면 연습 카드가 전체 폭) */
function showMode(m) {
  mode = m;
  for (const x of MODES) {
    TABS[x].setAttribute("aria-selected", String(x === m));
    TABS[x].tabIndex = x === m ? 0 : -1;   // 탭 줄 안에서는 ← → 로 옮겨 다님 (아래 keydown)
    PANELS[x].hidden = x !== m;
    if (SHEETS[x]) SHEETS[x].hidden = x !== m;
  }
  document.querySelector(".im-layout").classList.toggle("no-sheet", !SHEETS[m]);
  renderDots(null);
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

// ---------- 박 점 ----------
/**
 * 박 점 그리기. d = { count: 점 개수, on: 켤 점, accent: 마디 첫 박인 점들 } — null이면 멈춘 상태(한 마디 4개, 모두 꺼짐).
 * 무작위 코드 모드는 한 코드가 이어지는 박 수만큼(½마디 2 · 1마디 4 · 2마디 8 — 4개마다 띄움), 그 밖에는 한 마디 4개
 */
function renderDots(d) {
  const box = $("beatDots");
  const count = d ? d.count : 4;
  if (box.children.length !== count) box.innerHTML = "<i></i>".repeat(count);
  [...box.children].forEach((el, i) => {
    el.classList.toggle("on", !!d && i === d.on);
    el.classList.toggle("accent", !!d && d.accent.includes(i));
  });
}

// ---------- 메트로놈·카운트인 ----------
// 시작하면 한 마디 카운트인(클릭 4번 동안 "3, 2, 1, GO"), 그다음부터 박마다 모드가 화면을 바꿈 (2026-11-10 사용자 결정)
const metro = createMetronome({
  getContext: Sound.context,
  onBeat: info => {
    if (mode === "random") { renderDots(Random.beat(info)); return; }
    // 8마디 모드 (지금은 메트로놈만 — 악보 강조는 나중에)
    const c = $("countIn");
    if (info.countIn) {
      c.hidden = false;
      c.textContent = info.label;
      c.classList.toggle("go", info.label === "GO");
      c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");   // 숫자가 바뀔 때마다 톡 튀어나옴 (애니메이션 다시 시작)
    } else c.hidden = true;
    renderDots({ count: 4, on: info.beat, accent: [0] });
  },
  onStop: () => renderPlay(),
  // 소리 장치를 쓸 수 없음(영상통화 중 등) → 클릭 소리 없이 그대로 진행하고 안내만 (2026-11-10 사용자 결정, 이유는 metronome.js)
  onSilent: () => toast(t("improvSilent"), 6000),
});

/** 시작/중지 버튼 글자와 상태 + 멈췄으면 화면을 처음 상태로 */
function renderPlay() {
  const on = metro.running;
  $("btnPlay").setAttribute("aria-pressed", String(on));
  $("btnPlayText").textContent = t(on ? "improvStop" : "improvStart");
  if (!on) {
    $("countIn").hidden = true;
    Random.stop();
    renderDots(null);
  }
  keepAwake(on);
}

/** 시작/중지 바꾸기 — [▶ 시작 / ■ 중지] 버튼과 Space 키 */
function togglePlay() {
  if (metro.running) { metro.stop(); return; }
  // 무작위 코드 모드: 첫 코드를 뽑을 수 없는 설정이면(코드 종류·베이스 0개) 시작하지 않고 이유를 알림
  if (mode === "random") { const err = Random.start(); if (err) { toast(t(err)); return; } }
  metro.start({ bpm, beats: 4, countIn: true });   // 소리를 낼 수 없어도 소리 없이 진행 (onSilent)
  renderPlay();
}
$("btnPlay").onclick = togglePlay;

// ---------- Space: 시작/중지 (2026-11-10 사용자 요청) ----------
// 옵션 체크·코드 칩·라디오·버튼에 초점이 있어도 그것을 누르지 않고 시작/중지 (랜덤 코드 연습·코드 추론하기의 Space와 같은 방식).
// 템포 칸에 숫자를 쓴 뒤 바로 Space로 시작할 수 있게 템포 칸에서도 동작. 로그인 창 등이 열려 있거나 글자 칸(select 등)이면 그대로
const spaceTarget = e => {
  if (e.code !== "Space" || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (authOpen() || document.querySelector("dialog[open]")) return false;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  return !(tag === "select" || tag === "textarea" || el.isContentEditable || (tag === "input" && !/^(checkbox|radio|number)$/.test(el.type)));
};
document.addEventListener("keydown", e => {
  if (!spaceTarget(e)) return;
  e.preventDefault();             // 페이지 스크롤·체크 바꾸기 막기
  if (!e.repeat) togglePlay();    // 누르고 있어도 한 번만
}, true);
// 체크박스·버튼은 Space를 뗄 때 눌림(클릭)으로 처리하는 브라우저가 있어서, 뗄 때도 막음
document.addEventListener("keyup", e => { if (spaceTarget(e)) e.preventDefault(); }, true);

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

initSettings();

// 출제 설정 공유 링크(?preset=…, 2026-11-10): 관리자에게 [🔗 이 설정으로 링크 만들기], 링크로 들어오면 바꿀지 묻기 (common/share-settings.js).
// 무작위 코드 모드의 출제 설정만 담음 — 코드 종류, 특정 베이스, 텐션, 기호 표기, 복잡한 음 표현, 분수코드, 한 코드당 마디수.
// 링크는 무작위 코드 모드(주소에 mode 없음)로 열림. 템포는 담지 않음(출제 설정이 아니라서). 이 페이지 설정은 계정에 올리지 않아서 consume()은 쓰지 않음
initPresetLink({
  spec: { route: ROUTES.improv, types: Engine.TYPES.map(x => x.id), flags: ["B", "C", "D", "E", "S", "H", "L"] },
  S: presetSource,
  apply(p) {
    if (mode !== "random") TABS.random.click();   // 8마디 모드를 보고 있었으면 무작위 코드 모드로
    applyPreset(p);
  },
});

onLangChange(() => { renderPlay(); renderMidi(); syncSettingsUI(); if (metro.running) Random.render(); });
showMode(modeFromUrl());
renderPlay();
