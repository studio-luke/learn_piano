// ===== 청음 연습 (trainer/ear/index.html) — 시작점 =====
// 들려주는 음·멜로디·코드를 듣고 맞히는 연습. 갈래 [단음 | 코드] × 단계(레벨), 고른 단계는 주소 ?mode=note1 … chord5.
// 지금 만든 단계: 단음 ① 음 하나, ② 마지막 음 — 나머지는 "준비 중"으로 보이기만 함. 규칙은 chordoven-spec.md "청음 연습".
// 각 부분:
//   ear/theory.js       조성·스케일·출제·채점 (순수 함수)      ear/instruments.js  연주 악기(피아노·목소리·EP·기타·현악기)
//   ear/keys.js         답 고르는 건반 (F3~F5)                 ear/staff.js        눌러서 음을 고르는 오선지(조표 포함)
//
// 단음 ① 흐름 (2026-11-24 사용자 결정):
//   [▶ 시작] → 스케일 → 기준음(으뜸음) → 문제 음. 그다음 문제부터는 기준음 → 문제 음 (문제마다 기준음을 먼저)
//   조를 바꾸면(출제 설정, [다른 조로 바꾸기]) 스케일을 다시 들려주고 새 문제
//   [기준음 듣기]는 언제든. 건반·오선지에서 고르는 즉시 채점. 오답이면 다시 고를 수 있고, 그때부터 그 문제는 ▶ 오른쪽에 [스케일]도 나옴
//   문제 다시 듣기는 안내 문구와 오선지 사이의 큰 ▶ 버튼(·Space)
//   [정답 확인]은 정답을 보여 주고 끝냄. 끝난 문제에서 건반·오선지를 누르면 소리만
// 단음 ② 마지막 음: 같은 화면·설정·채점. 문제 음 자리에 4음 멜로디 — 앞의 3음은 울릴 때 건반을 칠하고 악보에 하나씩 나타나고,
//   4번째 음이 문제(악보에 "?"). 처음 들려줄 때는 4번째 음이 시작될 때까지 잠금 (2026-11-24 사용자 결정)
import { startPage } from "../common/layout.js";
import { isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, toast } from "../common/dom.js";
import { store } from "../common/storage.js";
import * as Ins from "../ear/instruments.js";
import { Midi } from "../input/midi.js";
import { Account } from "../account/account.js";
import { initKeys, markKeys, refKey, setKeyLabels } from "../ear/keys.js";
import { initStaff, setSignature, showNotes, setSlots, setAnswerSlot, setGhostEnabled } from "../ear/staff.js";
import { renderScore, stepAtY } from "../ear/score.js";
import { makeDictation, judgeToken, BAR } from "../ear/rhythm.js";
import { KEY_ROOTS, LOW, HIGH, signature, scaleMidis, pickNote, pickMelody, judgeNote, spellMidi, midiOf, sigAcc, fullName, otherKey, sameRoot } from "../ear/theory.js";

startPage({ title: "navEar" });

// ---------- 갈래·단계 ----------
// mode = 주소 ?mode 값(한 번 정하면 바꾸지 않음 — 화면 번호(num)와 따로라 0단계·2.5단계를 끼워 넣어도 됨).
// key = 이름 문구 키(설명은 key + "Desc"), hard = 기준 없이 듣는 단계, ready = 만든 단계
const LEVELS = [
  { mode: "note1", track: "note", num: "1", key: "earN1", ready: true },
  { mode: "note2", track: "note", num: "2", key: "earN2", ready: true },
  { mode: "note3", track: "note", num: "3", key: "earN3", ready: true },   // 만드는 중 (2단계: 악보 미리보기)
  { mode: "chord1", track: "chord", num: "1", key: "earC1" },
  { mode: "chord2", track: "chord", num: "2", key: "earC2" },
  { mode: "chord3", track: "chord", num: "3", key: "earC3" },
  { mode: "chord4", track: "chord", num: "4", key: "earC4" },
  { mode: "chord5", track: "chord", num: "5", key: "earC5", hard: true },
];
const levelOf = m => LEVELS.find(x => x.mode === m);
const modeFromUrl = () => levelOf(new URLSearchParams(location.search).get("mode")) ? new URLSearchParams(location.search).get("mode") : "note1";
let mode = modeFromUrl();
// 갈래마다 마지막으로 본 단계 (갈래를 오갈 때 그 단계로) — 이번 방문 동안만
const lastOfTrack = { note: "note1", chord: "chord1" };
/** 단음 단계(①·②)인지 — 같은 화면·출제 설정을 씀 */
const isNoteMode = () => mode === "note1" || mode === "note2" || mode === "note3";
/** 단음 ②(멜로디의 마지막 음)인지 */
const melodic = () => mode === "note2";
/** 단음 ③(멜로디 받아쓰기 — 리듬 악보, 메트로놈)인지 */
const dictation = () => mode === "note3";

/** 고른 단계를 주소에 남김 — 방문 기록을 쌓지 않고 지금 주소만 바꿈 (코드 초견 setModeInUrl과 같은 방식) */
function setModeInUrl(m) {
  const u = new URL(location.href);
  if (u.searchParams.get("mode") === m) return;
  u.searchParams.set("mode", m);
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** 갈래 전환·단계 막대·설명·패널을 지금 mode에 맞게 */
function renderLevels() {
  const lv = levelOf(mode);
  lastOfTrack[lv.track] = mode;
  for (const tr of ["note", "chord"]) {
    const b = $(tr === "note" ? "trackNote" : "trackChord");
    b.setAttribute("aria-selected", String(tr === lv.track));
  }
  $("earLevels").innerHTML = LEVELS.filter(x => x.track === lv.track).map(x => {
    const tag = !x.ready ? `<span class="tag">${t("navSoon")}</span>` : x.hard ? `<span class="tag hard">${t("earHard")}</span>` : "";
    return `<button type="button" class="ear-level${x.ready ? "" : " soon"}" data-mode="${x.mode}"${x.mode === mode ? ' aria-current="step"' : ""}>`
      + `<span class="num">${x.num}</span><span>${t(x.key)}</span>${tag}</button>`;
  }).join("");
  $("earLevelDesc").textContent = t(lv.key + "Desc");
  const cur = $("earLevels").querySelector('[aria-current="step"]');
  if (cur) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  levelArrows();
  // 패널: 만든 단계만 내용, 나머지는 "준비 중"
  $("panelNote").hidden = !isNoteMode();
  $("earKeyRow").hidden = lv.track !== "note";   // 맨 윗줄의 조 표시는 단음 단계만
  $("earSoon").hidden = lv.ready;
  $("sheetNote").hidden = lv.track !== "note" || !lv.ready;
  document.querySelector(".ear-layout").classList.toggle("no-sheet", $("sheetNote").hidden);
}

function goMode(m) {
  if (m === mode) return;
  stopListening();
  mode = m;
  setModeInUrl(m);
  renderLevels();
  S = loadS(); renderSettings();   // 출제 설정은 레벨마다 따로
  resetNote();   // 단계를 바꾸면 시작 전으로 ([▶ 시작]부터)
}
$("earLevels").addEventListener("click", e => {
  if (dragged) { dragged = false; return; }   // 마우스로 끌어서 움직였으면 단계를 고르지 않음
  const b = e.target.closest(".ear-level");
  if (b) goMode(b.dataset.mode);
});

// ---------- 단계 막대 가로 스크롤 (2026-11-24 사용자 요청) ----------
// 폰은 손가락으로 밀면 되고, 컴퓨터는 마우스로 누른 채 좌우로 끌어도 움직임(5px 넘게 끌면 단계 고르기는 안 함).
// 잘린 쪽에만 ‹ › 버튼: 누르면 막대 폭의 70%만큼 부드럽게
let dragged = false;
{
  const bar = $("earLevels");
  let drag = null;   // { x: 누른 곳, left: 그때의 scrollLeft }
  bar.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: bar.scrollLeft };
    dragged = false;
  });
  window.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { dragged = true; bar.classList.add("dragging"); }
    if (dragged) bar.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => { drag = null; bar.classList.remove("dragging"); });
  bar.addEventListener("dragstart", e => e.preventDefault());   // 글자·버튼을 끄는 브라우저 기본 동작 막기

  // 목표 위치를 직접 계산해 끝(0 ~ 최대)에서 멈춤 — iPhone Safari에서 scrollBy를 빠르게 두 번 부르면
  // 끝을 넘어 빈 곳까지 밀려 갔음 (2026-11-24). 움직이는 중에 또 누르면 앞의 목표에서 이어서
  let target = null;
  const maxLeft = () => bar.scrollWidth - bar.clientWidth;
  const step = dir => {
    const from = target ?? bar.scrollLeft;
    target = Math.max(0, Math.min(maxLeft(), from + dir * bar.clientWidth * 0.7));
    bar.scrollTo({ left: target, behavior: "smooth" });
  };
  // 스크롤이 멈추면(0.15초 동안 움직임 없음) 목표를 잊음 — scrollend 이벤트는 옛 Safari에 없어서 직접 잼
  let quiet = 0;
  bar.addEventListener("scroll", () => { clearTimeout(quiet); quiet = setTimeout(() => { target = null; }, 150); }, { passive: true });
  bar.addEventListener("pointerdown", () => { target = null; });
  $("levelsPrev").onclick = () => step(-1);
  $("levelsNext").onclick = () => step(1);
  bar.addEventListener("scroll", levelArrows, { passive: true });
  window.addEventListener("resize", levelArrows);
}
/** 잘린 쪽에만 ‹ › 보이기 (1px 오차는 무시) */
function levelArrows() {
  const bar = $("earLevels");
  const max = bar.scrollWidth - bar.clientWidth;
  if (bar.scrollLeft > max + 1) bar.scrollLeft = max;   // 혹시 끝을 넘어갔으면 되돌림 (iPhone Safari)
  $("levelsPrev").hidden = bar.scrollLeft <= 1;
  $("levelsNext").hidden = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 1;
}
$("trackNote").onclick = () => goMode(lastOfTrack.note);
$("trackChord").onclick = () => goMode(lastOfTrack.chord);

// ---------- 연주 악기 (기기에 저장: chordoven.earInstrument) ----------
let inst = Ins.INSTRUMENTS.some(x => x.id === store.get("earInstrument")) ? store.get("earInstrument") : "piano";
function renderInst() {
  $("earInst").innerHTML = Ins.INSTRUMENTS.map(x => `<option value="${x.id}"${x.id === inst ? " selected" : ""}>${t(x.key)}</option>`).join("");
}
$("earInst").onchange = e => { inst = e.target.value; store.set("earInstrument", inst); Ins.load(inst); };
Ins.load(inst);   // 고른 악기 녹음은 페이지를 열 때 받기 시작 (첫 소리가 늦지 않게)

// ---------- 단음 출제 설정 — 레벨마다 따로 기억 (기기에 저장: chordoven.ear.<mode>.v1, 2026-11-24 사용자 결정) ----------
//   root·minor 조성, chromatic 조 밖의 음 포함, tonicEach 문제마다 기준음 재생(처음 켜짐),
//   speed 멜로디 재생 속도 0 느리게·1 보통·2 빠르게·3 매우 빠르게, count 맞힐 음 개수 1·2 (speed·count는 단음 ②만)
//   min 최소 박자 4·2·1(4분·8분·16분, 처음 8분), bars 마디 수 1·2, bpm 40~160(처음 60 — 2026-11-24 사용자 요청, 처음엔 80),
//   write 받아쓸 것 "both" 음높이와 리듬(처음) · "pitch" 음높이만 · "rhythm" 리듬만,
//   chance 멜로디 개연성 "high"·"mid"(처음)·"low"·"random" (min·bars·bpm·write·chance는 단음 ③만)
// 예전에 단음 단계끼리 같이 쓰던 값(chordoven.earNote.v1)이 있으면 그 레벨을 처음 열 때 시작값으로 씀
const S_DEFAULTS = { root: "C", minor: false, chromatic: false, tonicEach: true, speed: 1, count: 1, min: 2, bars: 1, bpm: 60, write: "both", chance: "high" };   // 멜로디 개연성 처음 "높음" (2026-11-25 사용자 결정)
let S = loadS();
function loadS() {
  const s = Object.assign({}, S_DEFAULTS, store.getJSON("earNote.v1") || {}, store.getJSON(`ear.${mode}.v1`) || {});
  if (!KEY_ROOTS[s.minor ? "minor" : "major"].includes(s.root)) s.root = "C";
  return s;
}
const saveS = () => store.setJSON(`ear.${mode}.v1`, S);
const key = () => ({ root: S.root, minor: S.minor });
const keyLabel = () => `${S.root} ${S.minor ? "minor" : "Major"}`;

function renderSettings() {
  $("earRoot").innerHTML = KEY_ROOTS[S.minor ? "minor" : "major"].map(r => `<option value="${r}"${r === S.root ? " selected" : ""}>${r}</option>`).join("");
  $("earMode").textContent = S.minor ? "minor" : "Major";
  $("earMode").setAttribute("aria-pressed", String(S.minor));
  $("earChrom").checked = S.chromatic;
  $("earTonicEach").checked = S.tonicEach;
  // 단음 ②만: 멜로디 재생 속도(슬라이더)·맞힐 음 개수
  $("earMelodyOpts").hidden = !melodic();
  $("earSpeed").value = S.speed;
  $("earSpeed").style.setProperty("--p", (S.speed / 3 * 100) + "%");   // 슬라이더에서 손잡이 왼쪽을 칠함
  [...$("earSpeedLabels").children].forEach((el, i) => el.classList.toggle("on", i === S.speed));
  $("earCount1").checked = S.count === 1; $("earCount2").checked = S.count === 2;
  // 단음 ③만: 최소 박자(슬라이더 0·1·2 = 4분·8분·16분)·마디 수
  $("earRhythmOpts").hidden = mode !== "note3";
  const mi = [4, 2, 1].indexOf(S.min);
  $("earMin").value = mi;
  $("earMin").style.setProperty("--p", (mi / 2 * 100) + "%");
  [...$("earMinLabels").children].forEach((el, i) => el.classList.toggle("on", i === mi));
  $("earBars1").checked = S.bars === 1; $("earBars2").checked = S.bars === 2;
  $("earBpm").value = S.bpm;
  for (const w of ["Both", "Pitch", "Rhythm"]) $("earWrite" + w).checked = S.write === w.toLowerCase();
  for (const c of ["High", "Mid", "Low", "Random"]) $("earChance" + c).checked = S.chance === c.toLowerCase();
  $("earKeyName").textContent = keyLabel();
  setSignature(signature(key()));
}
/** 조를 바꿈 → 저장, 화면, 시작한 뒤라면 스케일부터 다시 들려주고 새 문제 */
function keyChanged() {
  saveS();
  renderSettings();
  if (N.phase !== "idle") newQuestion(true);
}
$("earRoot").onchange = e => { S.root = e.target.value; keyChanged(); };
$("earMode").onclick = () => { S.minor = !S.minor; S.root = sameRoot(S.root, S.minor); keyChanged(); };
$("earOtherKey").onclick = () => { S.root = otherKey(key()).root; keyChanged(); };
// 조 밖의 음은 다음 문제부터 (지금 문제는 그대로)
$("earChrom").onchange = e => { S.chromatic = e.target.checked; saveS(); };
// 문제마다 기준음 재생도 다음 문제부터
$("earTonicEach").onchange = e => { S.tonicEach = e.target.checked; saveS(); };
// 멜로디 재생 속도: 다음에 들려줄 때부터 (지금 문제의 다시 듣기에도), 맞힐 음 개수: 다음 문제부터
const setSpeed = v => { S.speed = v; saveS(); renderSettings(); };
$("earSpeed").oninput = e => setSpeed(+e.target.value);
[...$("earSpeedLabels").children].forEach((el, i) => { el.onclick = () => setSpeed(i); });
for (const n of [1, 2]) $("earCount" + n).onchange = () => { S.count = n; saveS(); };
// 단음 ③: 최소 박자·마디 수 — 바꾸면 새 예시 (지금은 악보 미리보기만)
const setMin = i => { S.min = [4, 2, 1][i]; saveS(); renderSettings(); };   // 다음 문제부터
$("earMin").oninput = e => setMin(+e.target.value);
[...$("earMinLabels").children].forEach((el, i) => { el.onclick = () => setMin(i); });
for (const n of [1, 2]) $("earBars" + n).onchange = () => { S.bars = n; saveS(); };   // 다음 문제부터
// BPM: 40~160 (처음 60). 바꾸면 다음에 들려줄 때부터
const BPM_MIN = 40, BPM_MAX = 160;
const setBpm = v => { S.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(+v) || 60)); saveS(); renderSettings(); };
$("earBpm").onchange = e => setBpm(e.target.value);
$("earBpmDown").onclick = () => setBpm(S.bpm - 1);
$("earBpmUp").onclick = () => setBpm(S.bpm + 1);
// 받아쓸 것: 다음 문제부터
for (const w of ["Both", "Pitch", "Rhythm"]) $("earWrite" + w).onchange = () => { S.write = w.toLowerCase(); saveS(); };
// 멜로디 개연성: 다음 문제부터
for (const c of ["High", "Mid", "Low", "Random"]) $("earChance" + c).onchange = () => { S.chance = c.toLowerCase(); saveS(); };

// ---------- 단음 ① 음 하나 ----------
// phase: "idle"(시작 전) | "ask"(풀고 있음) | "done"(맞힘·정답 확인)
// wrong = 이 문제를 틀린 적이 있음([스케일] 버튼), life = 첫 오답을 한 번 봐주는 기회가 남았음
//   ("문제마다 기준음 재생"을 끈 문제만 — 기준음 없이 듣는 만큼 첫 입력은 오답으로 치지 않음, 2026-11-24 사용자 요청.
//    나중에 기록을 붙일 때도 이 첫 오답은 "첫 결과"로 세지 않을 것)
// melody = 단음 ②의 멜로디(앞 SHOWN음은 보여 주고 그 뒤가 문제 — 맞힐 음 1개면 4음, 2개면 5음),
// ans = 지금 맞히는 숨은 음의 순서(0부터 — q = melody[SHOWN + ans]), revealed = 악보에 보여 준 자리 수(처음 들려줄 때
// 하나씩 늘어남 — 앞 3자리는 음표, 그 뒤는 "?")
// playing = 지금 울리고 있는 멜로디 음의 자리(악보에서 파랗게 — 건반처럼, 2026-11-24 사용자 요청), 없으면 -1
// dict = 단음 ③ 문제(rhythm.js makeDictation — 리듬 + 음높이), playTok = 지금 울리는 ③ 악보의 토큰 번호(파랗게), 없으면 -1
// dAns = 단음 ③에서 다음에 적을 토큰 번호(앞에서부터 순서대로), dTry = 방금 틀린 입력(악보에 빨갛게, 없으면 null)
// dictBars = 지금 ③ 문제의 마디 수, replaying = 큰 ▶로 다시 듣는 중(버튼이 ■ 중지로 바뀜)
// write = 지금 ③ 문제의 받아쓸 것 (출제 설정을 바꿔도 지금 문제는 그대로 — 마디 수와 같음)
const N = { write: "both", phase: "idle", q: null, wrong: false, life: false, melody: null, ans: 0, revealed: 0, playing: -1, dict: null, playTok: -1, dAns: 0, dTry: null, dictBars: 1, replaying: false };
const SHOWN = 3;           // 단음 ②에서 보여 주는 앞 음 수
const SCALE_STEP = 0.42;   // 스케일 음 사이 간격(초)
const Q_DUR = 1.4;         // 문제 음 길이(초)
const TONIC_DUR = 1.0;     // 기준음 길이(초)
const GAP = 0.5;           // 스케일·기준음과 다음 소리 사이 쉼(초)
// 단음 ② 멜로디 음 사이 간격(초) — 모든 음 같은 길이. 출제 설정 "재생 속도": 느리게·보통(처음 값, 처음 만든 속도)·빠르게·매우 빠르게
// (2026-11-24 사용자 결정, 매우 빠르게는 같은 날 추가)
const MEL_STEPS = [0.85, 0.6, 0.4, 0.2];   // 매우 빠르게: 0.28 → 0.2초 (2026-11-24 사용자 요청 — 더 빠르게)
const melStep = () => MEL_STEPS[S.speed] ?? 0.6;
let acc = "key";           // 오선지 변화표: "key"(조표대로) | 1 | 0 | -1

// ---------- 소리 예약과 필수 재생 중 잠금 ----------
// 필수 재생 = 새 문제를 낼 때 문제 음 앞에 저절로 들려주는 스케일(시작·조를 바꿨을 때)·기준음(문제마다 — 옵션).
// 필수 재생 동안에는 건반·오선지를 회색으로 잠그고 [기준음 듣기]·[스케일 들어보기]도 끄며, 안내 문구를
// "D Major 스케일의 첫 음을 재생 중이에요. 생략하기"처럼 바꿈 — [생략하기]는 남은 기준을 건너뛰고 바로 문제 음으로.
// 문제 음이 시작되면 풀림. 사용자가 버튼으로 다시 듣는 기준음·스케일은 잠그지 않음 (2026-11-24 사용자 결정).
// 소리는 악기 녹음이 준비된 뒤에 실제로 시작하므로(Ins.play가 돌려주는 Promise), 그때부터 시간을 잼
let listenTok = 0;          // 새로 듣기를 시작하거나 멈추면 +1 → 앞의 예약(문구 바꾸기·잠금 풀기)은 무시
let timers = [];
let refText = "";           // 필수 재생 중의 안내 문구 ("" = 필수 재생 아님, 잠기지 않음)
let refSkip = false;        // 지금 [생략하기]를 보일지 (스케일·기준음 중에만 — 멜로디 중에는 없음)

/** 스케일 음 목록(at초부터). { notes, end: 끝나는 시각 } */
function scaleNotes(at) {
  const ms = scaleMidis(key());
  const notes = ms.map((m, i) => ({ m, at: at + i * SCALE_STEP, dur: i === ms.length - 1 ? 0.9 : SCALE_STEP + 0.05, vel: 0.45 }));
  return { notes, end: at + (ms.length - 1) * SCALE_STEP + 0.9 };
}
/** 기준음(으뜸음 — 스케일의 첫 음) */
const tonicNotes = at => ({ notes: [{ m: scaleMidis(key())[0], at, dur: TONIC_DUR, vel: 0.5 }], end: at + TONIC_DUR });
/**
 * 문제 소리. 단음 ①은 문제 음 하나, ②는 멜로디(같은 길이 — 마지막 음만 조금 길게 울림).
 * qAt = 잠금을 풀 시각 = 마지막 음이 시작될 때(①은 문제 음, ②는 멜로디의 마지막 음 — 2026-11-24 사용자 요청), shown = 건반을 칠하고 악보에 보여 줄 앞 음들(② 앞 3음, 순서 번호 idx),
 * marks = "?"가 나타날 시각들(② 숨은 음마다 — 그 음이 울리기 시작할 때)
 */
function questionNotes(at) {
  if (dictation()) return dictationNotes(at);
  if (!melodic()) return { notes: [{ m: N.q.midi, at, dur: Q_DUR, vel: 0.55 }], end: at + Q_DUR, qAt: at, shown: [], marks: [], slots: [] };
  const step = melStep(), last = N.melody.length - 1;
  const notes = N.melody.map((n, i) => ({ m: n.midi, at: at + i * step, dur: i === last ? Q_DUR : step + 0.05, vel: 0.55 }));
  return {
    notes, end: at + last * step + Q_DUR, qAt: at + last * step,   // 잠금은 마지막 음이 울리기 시작할 때 풀림 (맞힐 음이 2개여도 끝까지 듣게)
    shown: notes.slice(0, SHOWN).map((n, idx) => ({ ...n, idx })),
    marks: notes.slice(SHOWN).map((n, i) => ({ at: n.at, upto: SHOWN + i + 1 })),
    slots: notes.map((n, i) => ({ at: n.at, off: i < last ? notes[i + 1].at : n.at + n.dur, slot: i })),   // 악보 칠하기
  };
}

/**
 * 단음 ③ 소리: 카운트인 두 박("Ready" "Start" — 2026-11-24 사용자 결정) → 멜로디 + 메트로놈(박마다, 마디 첫 박은 높게 — 늘 들림).
 * 음은 표기된 길이만큼만 울리고(조금 짧게 — 다음 음과 이어 붙지 않게) 쉼표에서는 소리가 없음.
 * count = 카운트인 글자를 바꿀 시각들, plays = 악보에서 파랗게 칠할 토큰과 시각, qAt = 마지막 음이 시작될 때(잠금을 풂)
 */
function dictationNotes(at) {
  const beat = 60 / S.bpm, u = beat / 4;   // 박 길이·16분 길이(초)
  const m0 = at + 2 * beat;                // 멜로디가 시작되는 시각 (카운트인 두 박 뒤)
  const notes = [{ click: true, accent: false, at }, { click: true, accent: false, at: at + beat }];
  // 마디 수는 지금 문제의 것 (출제 설정을 바꿔도 지금 문제는 그대로 — 2026-11-24 버그: 2마디 문제에서 1마디로 바꾸면 메트로놈이 1마디만)
  const bars = N.dictBars;
  for (let b = 0; b < bars * 4; b++) notes.push({ click: true, accent: b % 4 === 0, at: m0 + b * beat });
  const plays = [];
  let lastAt = m0;
  N.dict.forEach((x, i) => {
    const t0 = m0 + x.pos * u, len = x.dur * u;
    plays.push({ at: t0, off: t0 + len, idx: i });
    if (x.rest) return;
    notes.push({ m: x.note.midi, at: t0, dur: Math.max(0.08, len * 0.92), vel: 0.55 });
    lastAt = t0;
  });
  return {
    notes, end: m0 + bars * 4 * beat, qAt: lastAt, shown: [], marks: [], slots: [],
    count: [{ at, text: "Ready" }, { at: at + beat, text: "Start" }, { at: m0, text: "" }], plays,
  };
}

/**
 * 단음 ③ 악보 그리기 — 지금까지 맞힌 것(초록)만 보여 주고, 다음 자리에 세로선과 방금 틀린 입력(빨강).
 *   음높이만 받아쓸 때는 리듬을 처음부터 보여 줌(아직 안 맞힌 음표는 음높이 없이 흐리게), 리듬만이면 음표는 음높이 없이(가운데 줄).
 *   문제가 끝나면(다 맞힘·정답 확인) 전부. 지금 울리는 토큰은 파랗게
 */
function drawScore() {
  renderDebug();
  if (!dictation() || !N.dict) { $("earScore").innerHTML = ""; return; }
  const done = N.phase === "done";
  const toks = [];
  N.dict.forEach((x, i) => {
    const answered = i < N.dAns, ref = i === N.playTok ? "ref" : "";
    // 맞힌 칸은 들려준 음 그대로(리듬만 받아쓸 때도 — 2026-11-24 사용자 요청, 처음엔 가운데 줄에 그렸음)
    if (done || answered) toks.push({ ...x, cls: ref || (answered ? "good" : "") });
    else if (N.write === "pitch") toks.push({ ...x, note: undefined, cls: ref || (x.rest ? "" : "hint") });
  });
  if (N.dTry && !done) toks.push(N.dTry);
  const perLine = scorePerLine();
  const cursor = !done && N.phase === "ask" && N.dAns < N.dict.length ? N.dict[N.dAns].pos : null;
  // 흐린 음표: 마우스를 올린 높이에, 다음 자리에 지금 고른 길이로 (음높이만 받아쓰면 정답 길이) — 잠겨 있으면 안 보임
  const ghost = cursor !== null && scoreGhost !== null && !refText && N.write !== "rhythm"
    ? { pos: cursor, dur: ghostDur(), step: scoreGhost, a: acc === "key" ? null : acc } : null;
  const solved = done && N.dAns >= N.dict.length;   // 정답 확인으로 끝난 게 아니라 끝까지 맞힘
  renderScore($("earScore"), toks, { bars: N.dictBars, sig: signature(key()), perLine, cursor, ghost, solved });
}
// ---------- 디버그 모드 (관리자만, 기기에 저장 chordoven.earDebug) (2026-11-24 사용자 요청) ----------
// 켜면: 정답을 글자로 바로 보여 줌(③은 코드 진행도), [다음 문제]·단축키는 문제를 안 끝내도 늘 됨
let debugOn = store.get("earDebug") === "on";
const debugMode = () => debugOn && Account.isAdmin();
const DBG_DUR = { 8: "2", 6: "4.", 4: "4", 3: "8.", 2: "8", 1: "16" };   // 길이 → 짧은 글자 (관리자용이라 번역 안 함)
function renderDebug() {
  const el = $("earDebugOut");
  let lines = [];
  if (debugMode() && N.phase !== "idle") {
    if (dictation() && N.dict) {
      if (N.dict.chords) lines.push(N.dict.chords.map(c => c.name).join(" | ") + (N.dict.contour ? `   (contour: ${N.dict.contour})` : ""));
      if (N.dict.motifs && N.dict.motifs.length) lines.push("motif: " + N.dict.motifs.join(", "));
      let bar = 0, out = "";
      for (const x of N.dict) {
        const b = Math.floor(x.pos / BAR);
        if (b !== bar) { out += "| "; bar = b; }
        out += (x.rest ? "r" + DBG_DUR[x.dur] : fullName(x.note) + ":" + DBG_DUR[x.dur]) + " ";
      }
      lines.push(out.trim());
    } else if (melodic() && N.melody) lines.push(N.melody.slice(SHOWN).map(fullName).join(" · "));
    else if (N.q) lines.push(fullName(N.q));
  }
  el.hidden = !lines.length;
  el.textContent = lines.join("\n");
}
/** 다음 문제로 넘어갈 수 있는지 — 끝난 문제, 디버그 모드면 시작한 뒤 언제나 */
const canNext = () => N.phase === "done" || (debugMode() && N.phase !== "idle");
{
  const showDebug = () => { $("earDebugLabel").hidden = !Account.isAdmin(); renderDebug(); renderNoteButtons(); };
  $("earDebugOpt").checked = debugOn;
  $("earDebugOpt").onchange = e => { debugOn = e.target.checked; store.set("earDebug", debugOn ? "on" : "off"); renderDebug(); renderNoteButtons(); };
  Account.on("change", showDebug); showDebug();
}
const scorePerLine = () => (window.innerWidth < 600 ? 1 : 2);   // 폰은 한 줄에 1마디
// 화면을 돌리면(세로 ↔ 가로) 한 줄의 마디 수가 바뀔 수 있음 → 그때 바로 다시 그림
// (예전에는 다음 입력 때 그려져서, 세로에서 만든 두 줄 악보가 가로로 돌려도 한동안 두 줄로 남았음 — 2026-11-25 사용자 제보)
let lastPerLine = scorePerLine();
window.addEventListener("resize", () => {
  if (scorePerLine() === lastPerLine) return;
  lastPerLine = scorePerLine();
  drawScore();
});
/** 흐린 음표·입력에 쓸 길이: 음높이만이면 정답 길이, 아니면 고른 길이(+점 — 그릴 수 없는 점2분·점16분은 가까운 모양으로) */
function ghostDur() {
  if (N.write === "pitch") return N.dict[N.dAns].dur;
  const d = dotOn ? curDur * 1.5 : curDur;
  return d === 12 ? 8 : d === 1.5 ? 1 : d;
}

// ---------- 단음 ③ 악보에서 고르기: 마우스를 올리면 다음 자리에 흐린 음표, 누르면 그 음으로 적음 (2026-11-24 사용자 요청) ----------
// 높이는 F3~F5, 변화표는 조표대로 (①·②의 오선지와 같음). 터치는 손을 뗄 때(10px 넘게 움직이면 스크롤)
let scoreGhost = null;   // 마우스를 올린 줄·칸 번호 (없으면 null)
function scoreStep(e) {
  const svg = $("earScore").querySelector("svg"), ctm = svg && svg.getScreenCTM();
  if (!ctm || !N.dict || N.dAns >= N.dict.length) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  const line = Math.floor(Math.floor(N.dict[N.dAns].pos / 16) / scorePerLine());   // 다음 자리가 있는 줄
  const st = stepAtY(p.y, line);
  return st >= 23 && st <= 39 ? Math.max(24, Math.min(38, st)) : null;
}
function scorePick(st) {
  if (!IS_PC) return;   // 폰·태블릿: 악보를 눌러 적기 없음 (건반으로만 — 2026-11-25 사용자 요청)
  if (!dictation() || N.phase !== "ask" || refText || N.write === "rhythm") return;
  // 변화표는 ①·②의 오선지처럼 [♯ ♮ ♭ 해제] 중 고른 것 (한 번 쓰고 해제로) — 2026-11-24 사용자 요청
  const l = st % 7, a = acc === "key" ? sigAcc(signature(key()), l) : acc;
  setAcc("key");
  pick(midiOf({ l, a, oct: Math.floor(st / 7) }), { l, a, oct: Math.floor(st / 7) });
}
{
  const box = $("earScore");
  box.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse" || !dictation() || N.phase !== "ask" || N.write === "rhythm") return;   // 리듬만이면 악보에서 음을 고르지 않음
    const st = scoreStep(e);
    if (st !== scoreGhost) { scoreGhost = st; drawScore(); }
  });
  box.addEventListener("pointerleave", () => { if (scoreGhost !== null) { scoreGhost = null; drawScore(); } });
  let touch = null;
  box.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") { if (e.button === 0) { const st = scoreStep(e); if (st !== null) { e.preventDefault(); scorePick(st); } } }
    else touch = { x: e.clientX, y: e.clientY };
  });
  box.addEventListener("pointermove", e => { if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) touch = null; });
  box.addEventListener("pointerup", e => {
    if (!touch || e.pointerType === "mouse") return;
    touch = null;
    const st = scoreStep(e);
    if (st !== null) scorePick(st);
  });
  box.addEventListener("pointercancel", () => { touch = null; });
}

// ---------- 단음 ③ 답 입력: 길이 버튼(+점) 고른 뒤 건반, 쉼표 버튼은 바로 (2026-11-24 사용자 결정) ----------
let curDur = 4, dotOn = false;   // 고른 음표 길이(16분 단위), 점(다음 음표 하나에만)
function renderDurs() {
  // 리듬만이면 고른 길이를 남겨 두지 않음 (누르면 바로 적히므로 — 선택 표시 없음)
  const keep = !(dictation() && N.write === "rhythm");
  for (const b of document.querySelectorAll(".ear-dur")) b.setAttribute("aria-pressed", String(keep && +b.dataset.dur === curDur));
  $("earDot").setAttribute("aria-pressed", String(dotOn));
  if (scoreGhost !== null) drawScore();   // 흐린 음표의 길이도 바뀜
}
// 리듬만 받아쓸 때는 음표 버튼을 누르는 것이 곧 제출 (건반·임시표는 꺼짐 — 2026-11-24 사용자 요청), 그 밖에는 길이 고르기
for (const b of document.querySelectorAll(".ear-dur")) b.onclick = () => {
  if (dictation() && N.write === "rhythm") {
    if (N.phase !== "ask" || refText) return;
    const d = +b.dataset.dur;
    submitToken({ rest: false, dur: dotOn ? d * 1.5 : d });
    dotOn = false; renderDurs();
    return;
  }
  curDur = +b.dataset.dur; renderDurs();
};
$("earDot").onclick = () => { dotOn = !dotOn; renderDurs(); };
// 쉼표: 점 없이 그 길이 그대로 (점이 켜져 있어도 쉼표에는 쓰지 않고 다음 음표를 위해 남겨 둠)
for (const b of document.querySelectorAll(".ear-rest")) b.onclick = () => {
  if (!dictation() || N.phase !== "ask" || refText || N.write === "pitch") return;
  submitToken({ rest: true, dur: +b.dataset.rest });
};

/** 음높이만 받아쓸 때: 쉼표는 악보에 있으니 건너뜀 */
function skipRests() {
  if (N.write !== "pitch") return;
  while (N.dAns < N.dict.length && N.dict[N.dAns].rest) N.dAns++;
}

/**
 * 단음 ③ 입력 하나를 다음 자리와 비교 (rhythm.js judgeToken). 맞으면 다음 자리로(끝까지 맞히면 문제 끝),
 * 틀리면 빨갛게 보여 주고 그 자리를 다시 — 기준음을 끈 문제의 첫 오답은 기회(①·②와 같음)
 * @param input { rest, dur, midi? }
 */
function submitToken(input) {
  const target = N.dict[N.dAns];
  const r = judgeToken(target, input, N.write);
  if (r === "ok") {
    N.dAns++; N.dTry = null;
    skipRests();
    if (input.midi !== undefined) markKeys(new Map([[input.midi, "good"]]));
    // 리듬만: 맞힌 음표의 실제 음을 들려줌 (건반을 누르지 않으니 — 2026-11-24 사용자 요청)
    if (N.write === "rhythm" && !target.rest) playPicked(target.note.midi);
    if (N.dAns >= N.dict.length) { N.phase = "done"; setFeedback("ok", t("earN3Done")); revealNextButton(); }
    else setFeedback("ok", t("earN3Next"));
  } else {
    // 틀린 입력을 그 자리에 빨갛게 (그릴 수 없는 길이 — 점2분·점16분 — 는 가까운 모양으로)
    const shown = input.dur === 12 ? 8 : input.dur === 1.5 ? 1 : input.dur;
    N.dTry = { pos: target.pos, dur: shown, rest: !!input.rest, cls: "bad",
      // 리듬만: 음높이를 고르지 않으니 그 칸의 실제 음 높이에 그림(쉼표 칸이면 가운데 줄) — 2026-11-24 사용자 요청
      note: input.rest ? undefined : N.write === "rhythm" ? target.note : input.note || spellMidi(key(), input.midi) };
    if (input.midi !== undefined) markKeys(new Map([[input.midi, "bad"]]));
    // 음높이가 틀렸으면 정답이 더 높은지·낮은지 힌트를 덧붙임 (옥타브 힌트가 아닐 때, 리듬만 받아쓸 때는 없음 — 2026-11-25 사용자 요청)
    const pitchOff = !target.rest && input.midi !== undefined && N.write !== "rhythm" && (r === "pitch" || r === "no") && input.midi !== target.note.midi;
    const dir = pitchOff ? " " + t(target.note.midi > input.midi ? "earHigher" : "earLower") : "";
    const msg = (r === "len" ? t("earN3LenOk") : r === "pitch" ? t("earN3PitchOk") : r === "octUp" ? t("earOctUp") : r === "octDown" ? t("earOctDown") : t("earWrong")) + dir;
    // 쉼표 자리에 음표: 기회(첫 오답 봐주기)를 쓰지 않고 바로 오답 + "쉼표가 와야 할 자리예요." (2026-11-24 사용자 요청)
    if (target.rest && !input.rest) { N.wrong = true; setFeedback("no", t("earN3NeedRest")); }
    // 음표 자리에 쉼표도 마찬가지로 바로 오답 + "음표가 와야 할 자리예요." (2026-11-24 사용자 요청)
    else if (!target.rest && input.rest) { N.wrong = true; setFeedback("no", t("earN3NeedNote")); }
    // 쉼표 자리에 길이가 다른 쉼표: 기회를 쓰지 않고 바로 오답 + 더 짧은/긴 쉼표 안내 — 기회는 첫 음을 못 듣고 시작했을 때
    // 음을 잘못 짚는 경우를 봐주려는 것이라 쉼표에는 안 맞음 (2026-11-25 사용자 요청)
    else if (target.rest) { N.wrong = true; setFeedback("no", t(input.dur > target.dur ? "earN3RestShorter" : "earN3RestLonger")); }
    else if (N.life) { N.life = false; setFeedback("no", t("earLife") + (r === "no" ? dir : " " + msg)); }
    else { N.wrong = true; setFeedback("no", msg); }
  }
  drawScore();
  renderNoteButtons();
}

/** 카운트인 글자 ("Ready" → "Start" → 지움) */
function setCount(text) {
  const el = $("earCount");
  el.textContent = text;
  el.classList.toggle("go", text === "Start");
}

/** 소리를 모두 멈추고 예약한 문구·잠금도 취소 */
function stopListening() {
  listenTok++;
  setReplaying(false);
  setSounding(false);
  timers.forEach(clearTimeout); timers = [];
  Ins.stopAll();
  refKey(null);
  if (N.playing !== -1) { N.playing = -1; drawStaff(); }
  if (N.playTok !== -1) { N.playTok = -1; drawScore(); }
  setCount("");
  setRef("");
}

/**
 * 순서대로 들려주기.
 * @param parts     [{ kind: "scale" | "tonic" | "question" }] — 사이에 GAP초 쉼
 * @param required  필수 재생인지 — 그러면 스케일·기준음 동안 잠금 + 그 문구, 문제 음이 시작되면 풀림
 */
function listen(parts, required = false) {
  stopListening();
  const tok = listenTok;
  const notes = [];
  const spans = [];   // 잠그는 동안 바뀌는 안내 [{ start, text, skip: [생략하기]를 보일지 }]
  const dots = [];    // 건반을 칠할 음 — 스케일·기준음, 단음 ②의 앞 3음 (문제 음은 칠하지 않음 — 답이 되므로)
  let at = 0, unlockAt = 0;
  const marks = [];   // 단음 ②: 악보의 "?"가 나타날 때 [{ at, upto: 그때까지 보여 줄 자리 수 }]
  const slotPlays = [];   // 단음 ②: 악보에서 파랗게 칠할 자리와 시각 [{ at, off, slot }]
  const counts = [], tokPlays = [];   // 단음 ③: 카운트인 글자, 악보에서 칠할 토큰
  for (const p of parts) {
    const seg = p.kind === "scale" ? scaleNotes(at) : p.kind === "tonic" ? tonicNotes(at) : questionNotes(at);
    notes.push(...seg.notes);
    if (p.kind === "question") {
      dots.push(...seg.shown);
      if (seg.shown.length || dictation()) spans.push({ start: at, text: t("earPlayingMelody"), skip: false });
      if (seg.count) { counts.push(...seg.count); tokPlays.push(...seg.plays); }
      unlockAt = seg.qAt;   // 문제 음이 시작될 때 풀림
      // 단음 ②: 악보의 "?"는 그 숨은 음이 울리기 시작할 때 나타남 (처음부터 보이지 않게 — 2026-11-24 사용자 요청)
      marks.push(...seg.marks);
      slotPlays.push(...seg.slots);
    } else {
      dots.push(...seg.notes);
      spans.push({ start: at, text: t(p.kind === "scale" ? "earPlayingScale" : "earPlayingTonic", { key: keyLabel() }), skip: true });
    }
    at = seg.end + GAP;
  }
  const endAt = at - GAP;   // 마지막 소리가 끝나는 시각 (큰 ▶ → ■ 되돌리기, 악기 고르기 다시 켜기에 씀)
  setSounding(true);
  const locking = required && spans.length > 0;
  if (locking) setRef(spans[0].text, spans[0].skip);   // 소리가 준비되기 전부터 잠금
  Ins.play(inst, notes).then(() => {
    if (tok !== listenTok) return;
    if (N.replaying) timers.push(setTimeout(() => { if (tok === listenTok) setReplaying(false); }, endAt * 1000));
    timers.push(setTimeout(() => { if (tok === listenTok) setSounding(false); }, endAt * 1000 + 300));
    // 울리는 동안 그 건반을 파란색으로 (2026-11-24 사용자 요청 — 필수 재생이든 버튼으로 다시 듣든)
    // 스케일 음은 소리가 살짝 겹치므로(다음 음 시작 뒤 0.05초) 색은 다음 음이 시작될 때 넘겨줌 — 두 건반이 함께 칠해지지 않게.
    // 단음 ②의 앞 3음은 울리기 시작할 때 악보에도 나타남(처음 들려줄 때)
    dots.forEach((n, i) => {
      const next = dots[i + 1];
      const off = next && next.at < n.at + n.dur ? next.at : n.at + n.dur;
      timers.push(setTimeout(() => {
        if (tok !== listenTok) return;
        refKey(n.m, true);
        if (n.idx !== undefined && N.revealed < n.idx + 1) { N.revealed = n.idx + 1; drawStaff(); }
      }, n.at * 1000));
      timers.push(setTimeout(() => tok === listenTok && refKey(n.m, false), off * 1000 - 5));
    });
    for (const mk of marks) timers.push(setTimeout(() => {
      if (tok === listenTok && N.revealed < mk.upto) { N.revealed = mk.upto; drawStaff(); }
    }, mk.at * 1000));
    // 악보의 음표(숨은 음은 "?")도 울리는 동안 파랗게 — 건반과 같은 색
    for (const c of counts) timers.push(setTimeout(() => tok === listenTok && setCount(c.text), c.at * 1000));
    tokPlays.forEach((tp, i) => {
      timers.push(setTimeout(() => { if (tok === listenTok) { N.playTok = tp.idx; drawScore(); } }, tp.at * 1000 + 1));
      // 다음 토큰이 바로 이어지면 그쪽이 칠하므로, 마지막 토큰만 끝날 때 지움
      if (i === tokPlays.length - 1) timers.push(setTimeout(() => { if (tok === listenTok && N.playTok === tp.idx) { N.playTok = -1; drawScore(); } }, tp.off * 1000));
    });
    for (const sp of slotPlays) {
      timers.push(setTimeout(() => { if (tok === listenTok) { N.playing = sp.slot; drawStaff(); } }, sp.at * 1000 + 1));
      timers.push(setTimeout(() => { if (tok === listenTok && N.playing === sp.slot) { N.playing = -1; drawStaff(); } }, sp.off * 1000 - 5));
    }
    if (!locking) return;
    spans.forEach((sp, i) => {
      if (i) timers.push(setTimeout(() => tok === listenTok && setRef(sp.text, sp.skip), sp.start * 1000));
    });
    timers.push(setTimeout(() => tok === listenTok && setRef(""), unlockAt * 1000));
  });
}

/** 잠금과 안내 문구 바꾸기 (text가 ""이면 풀림). skip = [생략하기]를 보일지 */
function setRef(text, skip = false) {
  refText = text;
  refSkip = !!text && skip;
  const locked = !!text;
  for (const id of ["keyboard", "earStaff"]) $(id).classList.toggle("locked", locked);
  document.querySelector(".ear-accs").classList.toggle("locked", locked);
  $("earDurs").classList.toggle("locked", locked);
  drawStaff();   // 잠금이 바뀌면 악보의 흐린 음표(마우스를 올린 자리)도 다시 — 잠긴 동안은 안 그림
  renderNoteButtons();
}

/** [생략하기]: 필수 재생의 남은 스케일·기준음을 건너뛰고 바로 문제 음 (단음 ②·③은 멜로디 처음부터 — 멜로디 동안은 다시 잠금) */
$("btnSkip").onclick = () => { if (refSkip) listen([{ kind: "question" }], melodic() || dictation()); };

const playPicked = m => Ins.play(inst, [{ m, at: 0, dur: 0.9, vel: 0.5 }]);

/** 새 문제. withScale = 스케일을 먼저 들려줌 (시작, 조를 바꿨을 때) */
function newQuestion(withScale) {
  N.ans = 0;
  if (dictation()) {
    // 단음 ③: 문제를 만들고 처음 자리부터 순서대로 받아씀
    N.dict = makeDictation(key(), { chromatic: S.chromatic }, { bars: S.bars, min: S.min, chance: S.chance });
    N.dictBars = S.bars;   // 이 문제의 마디 수 (재생·악보는 이것을 씀)
    N.write = S.write;     // 이 문제의 받아쓸 것
    N.melody = null; N.q = null;
    N.phase = "ask"; N.wrong = false; N.life = !S.tonicEach; N.playTok = -1; N.dAns = 0; N.dTry = null;
    skipRests(); dotOn = false; renderDurs();
    applyWriteMode();   // 받아쓸 것을 바꿨을 수 있어서
    markKeys(); setFeedback("", ""); drawScore();
    listen([...(withScale ? [{ kind: "scale" }] : []), ...(S.tonicEach ? [{ kind: "tonic" }] : []), { kind: "question" }], true);
    return;
  }
  if (melodic()) {
    N.melody = pickMelody(key(), { chromatic: S.chromatic }, Math.random, SHOWN + S.count);
    N.q = N.melody[SHOWN];
    setSlots(N.melody.length, true);   // 맞힐 음 개수가 바뀌었을 수 있어서 자리 수를 다시
    setAnswerSlot(SHOWN);
  } else { N.melody = null; N.q = pickNote(key(), { chromatic: S.chromatic }, N.q && N.q.midi); }
  N.phase = "ask"; N.wrong = false; N.life = !S.tonicEach; N.revealed = 0;
  markKeys(); drawStaff(null);
  setFeedback("", "");
  // 문제마다 기준음을 먼저 (2026-11-24 사용자 요청), 시작·조를 바꿨을 때는 그 앞에 스케일
  // (기준음은 "문제마다 기준음 재생" 옵션 — 꺼져 있으면 스케일 뒤에도 바로 문제 음)
  listen([...(withScale ? [{ kind: "scale" }] : []), ...(S.tonicEach ? [{ kind: "tonic" }] : []), { kind: "question" }], true);
}

function renderNoteButtons() {
  const started = N.phase !== "idle";
  $("btnStart").hidden = started;
  $("btnReplay").hidden = !started;
  // [기준음]은 늘, [스케일]은 이 문제를 한 번이라도 틀린 뒤에 함께 (2026-11-24 사용자 결정 — 예전엔 기준음 자리를 스케일이 대신했음)
  $("btnTonic").hidden = !started;
  $("btnScale").hidden = !started || !N.wrong;
  // 필수 재생 중에는 끔 (누르면 스케일이 끊겨서 — 2026-11-24 사용자 결정). 대신 안내 문구 옆 [생략하기]
  $("btnTonic").disabled = $("btnScale").disabled = !!refText;
  $("btnReplay").disabled = !!refText;   // 문제 다시 듣기(큰 ▶)도 필수 재생 중에는 끔 — 생략은 [생략하기]로 (2026-11-24 사용자 요청)
  $("btnReveal").disabled = N.phase !== "ask" || !!refText;   // 필수 재생 중에도 막음 (2026-11-24 사용자 요청)
  $("btnNext").disabled = !canNext();   // 디버그 모드면 문제 도중에도
  renderDebug();
  setGhostEnabled(N.phase !== "done");   // 끝난 문제(맞힘·정답 확인)에서는 악보에 마우스를 올려도 흐린 음표를 안 보임
  const lv = dictation() ? "earN3" : melodic() ? "earN2" : "earN1";
  // 단음 ②에서 맞힐 음이 2개인 문제는 "숨은 두 음을 순서대로…"
  const ask = melodic() && N.melody && N.melody.length - SHOWN > 1 ? "earN2Ask2" : lv + "Ask";
  // ③은 문제를 푸는 동안 안내 문구를 비움 — 폰에서 세로 공간이 모자라서 (2026-11-25 사용자 요청, 줄 높이는 남김)
  $("earHintText").textContent = refText || (!started ? t(lv + "Intro") : dictation() ? "" : t(ask));
  $("btnSkip").hidden = !refSkip;
  setHintWidth(lv);
}

/**
 * 폰 가로: 안내 문구 칸의 최소 폭 = 이 단계에서 문제를 푸는 동안 나올 수 있는 문구 중 가장 긴 것 (CSS 변수 --hint-w, ear.css).
 * 문구가 바뀔 때마다 가운데 칸 폭이 달라져 재생 버튼이 좌우로 움직이던 것을 막음 (2026-11-25 사용자 요청).
 * 후보: 단계의 질문 문구(③은 없음) · "멜로디를 재생 중이에요." · 스케일·첫 음 재생 문구 + [생략하기]. 글자 폭은 canvas로 잼
 */
// (상태는 함수 자체에 둠 — renderNoteButtons가 이 파일의 let 선언보다 먼저 불릴 수 있어서)
function setHintWidth(lv) {
  const key = lv + "|" + keyLabel() + "|" + t("earPlayingMelody");
  if (key === setHintWidth.key) return;
  const hint = $("earHint"), skip = $("btnSkip"), cs = getComputedStyle(hint), ss = getComputedStyle(skip);
  if (!cs.fontSize) return;
  setHintWidth.key = key;
  const ctx = (setHintWidth.ctx ||= document.createElement("canvas").getContext("2d"));
  const w = (text, st) => { ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`; return ctx.measureText(text).width; };
  const skipW = w(" ", cs) + w(t("earSkip"), ss) + 4;   // 띄어쓰기 + [생략하기](왼쪽 여백 4px)
  const asks = lv === "earN3" ? [] : lv === "earN2" ? ["earN2Ask", "earN2Ask2"] : ["earN1Ask"];
  const plain = [...asks.map(k => t(k)), t("earPlayingMelody")].map(s => w(s, cs));
  const withSkip = ["earPlayingScale", "earPlayingTonic"].map(k => w(t(k, { key: keyLabel() }), cs) + skipW);
  $("panelNote").style.setProperty("--hint-w", Math.ceil(Math.max(...plain, ...withSkip)) + 2 + "px");
}

/**
 * 악보 그리기: 단음 ②면 보여 준 앞 음(revealed개)과 답 자리(고른 음 answer 또는 "?"), ①이면 답 자리만.
 * @param answer  답 자리에 그릴 { note, cls } — null이면 비움(②는 "?", ①은 빈 자리), 안 주면 앞에 그린 것을 그대로
 *                (소리에 맞춰 음표를 칠하거나 잠금이 바뀌어 다시 그릴 때 고른 음이 지워지지 않게)
 */
let staffAnswer = null;
function drawStaff(answer) {
  if (answer !== undefined) staffAnswer = answer;
  answer = staffAnswer;
  const list = [];
  if (melodic() && N.melody) {
    for (let i = 0; i < N.melody.length && i < N.revealed; i++) {
      const cur = SHOWN + N.ans;   // 지금 고르는 자리
      const ref = i === N.playing ? "ref" : "";   // 지금 울리는 자리
      if (i < SHOWN) list.push({ note: N.melody[i], cls: ref, slot: i });
      else if (i < cur) list.push({ note: N.melody[i], cls: ref || "good", slot: i });   // 이미 맞힌 숨은 음
      else if (!(i === cur && answer)) list.push({ placeholder: true, slot: i, cls: ref });
    }
  }
  if (answer) list.push(answer);
  showNotes(list);
}

/** 이미 맞힌 숨은 음들의 건반 표시 (단음 ②, 맞힐 음이 2개일 때 앞 음을 초록으로 남김) + more */
function answeredMarks(more = []) {
  const marks = new Map();
  if (melodic() && N.melody) for (let i = SHOWN; i < SHOWN + N.ans; i++) marks.set(N.melody[i].midi, "good");
  for (const [m, k] of more) marks.set(m, k);
  return marks;
}

/** 시작 전으로 (단계를 바꿨을 때): 악보 자리 수도 그 단계에 맞게 — ① 온음표 하나, ② 4분음표 넷 */
function resetNote() {
  staffAnswer = null;
  N.phase = "idle"; N.q = null; N.melody = null; N.wrong = false; N.revealed = 0; N.ans = 0; N.dict = null; N.playTok = -1;
  // 단음 ③은 리듬 악보, ①·②는 눌러서 고르는 오선지 (③의 답 입력은 다음 단계에서 — 지금은 건반 소리만)
  $("earScore").hidden = !dictation();
  N.dAns = 0; N.dTry = null; N.write = S.write;
  $("earStaff").hidden = dictation();   // ③은 악보에서 고름 — 임시표 줄은 ③에서도 씀(오선지만 숨김)
  // 맞았다/틀렸다 안내는 악보 바로 밑 (2026-11-25 사용자 요청): ③은 리듬 악보 밑, ①·②는 오선지(+임시표) 줄 밑
  (dictation() ? $("earScore") : document.querySelector(".ear-staff-wrap")).after($("earFeedback"));
  applyWriteMode();
  drawScore(); setCount("");
  setSlots(melodic() ? SHOWN + S.count : 1, melodic());
  markKeys(); setFeedback("", "");
  renderNoteButtons();
}

/**
 * 단음 ③ 받아쓸 것에 따라 입력 도구 켜고 끄기:
 *   음높이만 — 길이 버튼 숨김 / 리듬만 — 건반·임시표를 회색으로 꺼 두고 음표 버튼을 누르면 바로 적힘 / 그 밖(①·②, 음높이와 리듬)은 모두 켬
 */
function applyWriteMode() {
  const rhythmOnly = dictation() && N.write === "rhythm";
  $("earDurs").hidden = !dictation() || N.write === "pitch";
  $("keyboard").classList.toggle("disabled", rhythmOnly);
  document.querySelector(".ear-accs").classList.toggle("disabled", rhythmOnly);
  renderDurs();
}

function setFeedback(cls, html) {
  const el = $("earFeedback");
  el.className = "feedback" + (cls ? " " + cls : "");
  el.innerHTML = html;
}

/**
 * 답 고르기 (건반이든 오선지든). spelled = 오선지에서 고른 철자(없으면 조에 맞는 철자로)
 */
function pick(m, spelled) {
  if (refText) return;   // 기준을 들려주는 중에는 입력 안 받음 (건반·오선지가 회색)
  if (dictation()) {
    // 단음 ③: 고른 길이(+점)로 다음 자리에 — 음높이만 받아쓸 때는 길이를 보지 않으니 정답 길이 그대로
    if (N.write === "rhythm") return;   // 리듬만: 건반은 꺼져 있음 (키보드·MIDI도 받지 않음)
    if (m < LOW || m > HIGH) { playPicked(m); toast(t("earOutOfRange")); return; }
    playPicked(m);
    if (N.phase !== "ask") return;
    const target = N.dict[N.dAns];
    const dur = N.write === "pitch" ? target.dur : dotOn ? curDur * 1.5 : curDur;
    dotOn = false; renderDurs();   // 점은 음표 하나에만
    submitToken({ rest: false, dur, midi: m, note: spelled });
    return;
  }
  // MIDI 건반은 범위 밖 음도 올 수 있음 → 소리만 내고 안내 (화면 건반·컴퓨터 키보드는 늘 범위 안)
  if (m < LOW || m > HIGH) { playPicked(m); toast(t("earOutOfRange")); return; }
  playPicked(m);
  if (N.phase !== "ask") return;   // 시작 전·끝난 문제: 소리만
  const note = spelled || spellMidi(key(), m);
  const r = judgeNote(N.q.midi, m);
  if (r === "ok") {
    markKeys(answeredMarks([[m, "good"]]));
    if (melodic()) N.revealed = N.melody.length;
    // 단음 ②에서 맞힐 음이 더 남았으면 다음 자리로 (2026-11-24 사용자 결정 — 순서대로 한 음씩 바로 채점)
    if (melodic() && SHOWN + N.ans + 1 < N.melody.length) {
      N.ans++;
      N.q = N.melody[SHOWN + N.ans];
      setAnswerSlot(SHOWN + N.ans);
      drawStaff(null);
      setFeedback("ok", t("earRightNext", { name: fullName(N.melody[SHOWN + N.ans - 1]) }));
    } else {
      N.phase = "done";
      drawStaff({ note: N.q, cls: "good" });
      setFeedback("ok", t("earRight", { name: fullName(N.q) }));
      revealNextButton();
    }
  } else {
    markKeys(answeredMarks([[m, "bad"]]));
    drawStaff({ note, cls: "bad" });
    const oct = r === "octUp" ? t("earOctUp") : r === "octDown" ? t("earOctDown") : "";
    if (N.life) {
      // 기준음 없이 들은 문제의 첫 오답: 기회를 하나 쓰고 오답으로 치지 않음 ([스케일]도 아직 안 나옴)
      N.life = false;
      setFeedback("no", t("earLife") + (oct ? " " + oct : ""));
    } else {
      N.wrong = true;
      setFeedback("no", oct || t("earWrong"));
    }
  }
  renderNoteButtons();
}

initKeys(LOW, HIGH, m => pick(m));
initStaff(({ l, oct }) => {
  if (!IS_PC) return;   // 폰·태블릿: 오선지를 눌러 고르기 없음 — 줄·칸을 정확히 누르기 어려워서, 건반으로만 (2026-11-25 사용자 요청)
  // 끝난 문제(맞힘·정답 확인)에서는 오선지를 눌러도 아무것도 안 함 — 소리도 없음 (2026-11-24 사용자 요청, 건반은 지금처럼 소리)
  if (N.phase === "done") return;
  const a = acc === "key" ? sigAcc(signature(key()), l) : acc;
  const note = { l, a, oct };
  setAcc("key");   // 변화표 버튼은 한 번 쓰고 조표대로로
  const m = midiOf(note);
  if (m < LOW - 1 || m > HIGH + 1) return;   // F3 아래 F♭3 등 건반 밖 (반음까지만 허용)
  pick(m, note);
});

function setAcc(v) {
  acc = v;
  if (dictation() && scoreGhost !== null) drawScore();   // ③ 악보의 흐린 음표에도 변화표 반영
  for (const b of document.querySelectorAll(".ear-acc")) {
    const bv = b.dataset.acc === "key" ? "key" : +b.dataset.acc;
    b.setAttribute("aria-pressed", String(bv === v));
  }
}
for (const b of document.querySelectorAll(".ear-acc")) b.onclick = () => setAcc(b.dataset.acc === "key" ? "key" : (acc === +b.dataset.acc ? "key" : +b.dataset.acc));

$("btnStart").onclick = () => {
  newQuestion(true);
  // 폰: 시작하면 카드 위쪽이 화면 맨 위에 닿게 — 갈래·단계 막대는 위로 밀려나고 건반·버튼이 한 화면에 들어오게
  // (2026-11-24 사용자 요청). 컴퓨터는 화면이 넉넉해서 그대로
  if (!IS_PC) cardTopIntoView();
};
// 큰 ▶: 누르면 다시 듣기 + ■(중지)로 바뀜, ■를 누르면 멈춤. 다 들으면 ▶로 돌아옴 (2026-11-24 사용자 요청)
$("btnReplay").onclick = () => {
  if (N.replaying) { stopListening(); return; }
  listen([{ kind: "question" }]);
  setReplaying(true);
};
/** 들려주는 동안(스케일·기준음·문제 모두) 악기 고르기를 끔 — 도중에 바꾸면 소리가 섞여서 (2026-11-24 사용자 요청) */
function setSounding(on) { $("earInst").disabled = on; }

/** 큰 ▶ ↔ ■ 바꾸기 */
function setReplaying(on) {
  N.replaying = on;
  $("btnReplay").classList.toggle("stop", on);
  $("btnReplay").setAttribute("aria-label", t(on ? "earStop" : "earReplay"));
  $("btnReplay").title = t(on ? "earStop" : "earReplay");
}
$("btnTonic").onclick = () => listen([{ kind: "tonic" }]);
$("btnScale").onclick = () => listen([{ kind: "scale" }]);
$("btnReveal").onclick = () => {
  if (N.phase !== "ask" || refText) return;
  if (dictation()) {
    // 단음 ③: 정답 악보를 모두 보여 주고 다시 들려줌
    N.phase = "done"; N.dTry = null;
    markKeys(); drawScore();
    setFeedback("info", t("earN3Reveal"));
    listen([{ kind: "question" }]);
    renderNoteButtons();
    return;
  }
  N.phase = "done";
  // 남은 숨은 음을 모두 보여 줌 (단음 ②에서 맞힐 음이 2개면 아직 안 맞힌 것 전부)
  const rest = melodic() ? N.melody.slice(SHOWN + N.ans) : [N.q];
  markKeys(answeredMarks(rest.map(n => [n.midi, "ans"])));
  if (melodic()) { N.revealed = N.melody.length; N.ans = N.melody.length - SHOWN; }
  drawStaff(melodic() ? null : { note: N.q, cls: "good" });
  setFeedback("info", t("earReveal", { name: rest.map(fullName).join(" · ") }));
  listen([{ kind: "question" }]);
  renderNoteButtons();
};
$("btnNext").onclick = () => { if (canNext()) { newQuestion(false); cardTopIntoView(); } };

// ---------- 자동 스크롤 (2026-11-25 사용자 요청, 화면이 작을 때) ----------
/** 정답을 맞혔는데 [다음 문제]가 화면 아래로 잘려 있으면 보이는 데까지 내림 */
function revealNextButton() {
  requestAnimationFrame(() => {
    const r = $("btnNext").getBoundingClientRect(), over = r.bottom + 12 - window.innerHeight;
    if (over > 0) window.scrollBy({ top: over, behavior: "smooth" });
  });
}
/**
 * [시작]·다음 문제 뒤 카드 위치 맞추기.
 *   - 폰: 지금 어디에 있든 카드 위 경계선이 화면 맨 위에 딱 붙게 (2026-11-25 사용자 요청 — 화면이 빽빽해서 카드가 조금만
 *     내려가 있어도 건반 아랫부분이 가려짐)
 *   - 컴퓨터: 카드 위 경계선이 화면 위로 잘려 있을 때만 조금 여유(8px)를 두고 올림
 */
function cardTopIntoView() {
  requestAnimationFrame(() => {
    const top = document.querySelector(".ear-card").getBoundingClientRect().top;
    if (!IS_PC) { if (Math.abs(top) > 1) window.scrollTo({ top: Math.max(0, top + window.scrollY), behavior: "smooth" }); }
    else if (top < 0) window.scrollTo({ top: Math.max(0, top + window.scrollY - 8), behavior: "smooth" });
  });
}

// 단축키 (물리 키 기준): Enter·N·→ 다음 문제(끝난 문제), Space 문제 다시 듣기. 입력칸·드롭다운·로그인 창에서는 안 함
document.addEventListener("keydown", e => {
  if (!isNoteMode() || authOpen() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if ((e.code === "Enter" || e.code === "KeyN" || e.code === "ArrowRight") && canNext()) { e.preventDefault(); newQuestion(false); cardTopIntoView(); }
  else if (e.code === "Space" && N.phase !== "idle") { e.preventDefault(); if (!refText) listen([{ kind: "question" }]); }
});

// ---------- 컴퓨터 키보드·MIDI 건반으로 답 고르기 (컴퓨터에서만, 2026-11-24 사용자 요청) ----------
// 컴퓨터 판별은 다른 연습과 같은 기준 (마우스처럼 정확히 가리키는 기기). 폰·태블릿은 화면 건반만
const IS_PC = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
// 출제 설정 "MIDI 입력 허용". 직접 켜고 끈 적이 있으면 그 값(chordoven.earMidi), 없으면 이 브라우저가 MIDI 권한을
// 이미 허용했는지로 정함 — 허용했으면 켜짐, 아니면 꺼짐 (2026-11-24 사용자 결정, 아래 IS_PC 블록의 midiDefault)
let midiOn = store.get("earMidi") === "on";

// 키보드 배열 (물리 키 e.code 기준 → 한글 입력 상태에서도 동작): F3부터 반음씩
//   q 2 w 3 e 4 r t 6 y 7 u i 9 o 0 p - [ ] k , l . /
//   = F3 F♯3 G3 G♯3 A3 A♯3 B3 C4 C♯4 D4 D♯4 E4 F4 F♯4 G4 G♯4 A4 A♯4 B4 C5 C♯5 D5 D♯5 E5 F5
//   윗줄(q~])이 흰 건반, 그 사이 숫자·- 가 검은 건반 — 랜덤 코드 연습의 C3부터 배열과 같은 모양, 끝 다섯 개(k , l . /)도 같은 방식
const KEY_CODES = ["KeyQ", "Digit2", "KeyW", "Digit3", "KeyE", "Digit4", "KeyR", "KeyT", "Digit6", "KeyY", "Digit7", "KeyU",
  "KeyI", "Digit9", "KeyO", "Digit0", "KeyP", "Minus", "BracketLeft", "BracketRight", "KeyK", "Comma", "KeyL", "Period", "Slash"];
const KEY_MIDI = new Map(KEY_CODES.map((c, i) => [c, LOW + i]));   // F3(53)부터
/** e.code → 건반에 적을 글자 ("KeyQ" → "Q", "Digit2" → "2", "BracketLeft" → "[") */
const KEY_CHAR = { Minus: "-", BracketLeft: "[", BracketRight: "]", Comma: ",", Period: ".", Slash: "/" };
const keyChar = c => KEY_CHAR[c] || c.replace(/^(Key|Digit)/, "");

if (IS_PC) {
  document.addEventListener("keydown", e => {
    if (!isNoteMode() || authOpen() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const m = KEY_MIDI.get(e.code);
    if (m === undefined) return;
    e.preventDefault();
    pick(m);
  });

  // 건반에 키보드 글자 (2026-11-24 사용자 요청 — 랜덤 코드 연습처럼)
  setKeyLabels(new Map(KEY_CODES.map((c, i) => [LOW + i, keyChar(c)])));

  // MIDI: 출제 설정의 "MIDI 입력 허용"이 켜져 있을 때만. 누르는 순간 답 (뗌·페달은 쓰지 않음 —
  // 한 음씩 고르는 단계라서). 켤 때 아직 권한이 없으면 브라우저가 권한 창을 띄우고, 거부하면 다시 끔 (랜덤 코드 연습의 MIDI 입력 모드와 같은 흐름)
  Midi.on("noteon", m => { if (midiOn && isNoteMode()) pick(m); });
  Midi.on("state", renderMidi);
  $("earMidiOpt").checked = midiOn;
  $("earMidiOpt").onchange = async e => {
    midiOn = e.target.checked; store.set("earMidi", midiOn ? "on" : "off"); renderMidi();
    if (midiOn && !(await Midi.connect())) { midiOn = false; store.set("earMidi", "off"); $("earMidiOpt").checked = false; renderMidi(); toast(t("midiDenied")); }
  };
  // 지원하지 않는 브라우저(Safari 등): 체크는 켜지지 않고 안내만
  if (!Midi.supported) {
    $("earMidiLabel").classList.add("is-off");
    $("earMidiLabel").addEventListener("click", e => { e.preventDefault(); toast(t("midiUnsupported")); });
  }
  // 처음 값: 직접 고른 적이 없으면 권한 상태로 (허용한 브라우저 → 켜짐). 그다음 켜져 있으면 연결 (허용했으면 권한 창 없이)
  midiDefault().then(() => {
    $("earMidiOpt").checked = midiOn;
    renderMidi();
    if (midiOn) Midi.connect().then(ok => { if (!ok) { midiOn = false; store.set("earMidi", "off"); $("earMidiOpt").checked = false; renderMidi(); } });
  });
}

/** 직접 켜고 끈 적이 없으면(저장된 값 없음) MIDI 권한이 이미 허용돼 있는지로 midiOn을 정함. 조회를 못 하는 브라우저는 꺼짐 */
async function midiDefault() {
  if (store.get("earMidi") !== null || !Midi.supported || !navigator.permissions) return;
  try { midiOn = (await navigator.permissions.query({ name: "midi" })).state === "granted"; } catch (e) { /* Firefox 등 — 꺼짐 */ }
}

/**
 * MIDI 상태 글씨: 연결됨(초록 점, 기기 이름은 툴팁) / 켜져 있는데 기기 없음(빨간 점) / 미지원 브라우저 안내.
 * 출제 설정의 체크 옆(#midiStatus)과 건반 오른쪽 위(#midiStatusKb) 두 곳에 똑같이 (2026-11-24 사용자 요청)
 */
function renderMidi() {
  if (!IS_PC) return;
  const on = midiOn && Midi.state === "ready" && Midi.devices.length > 0;
  const none = midiOn && Midi.state === "ready" && !on;
  for (const id of ["midiStatus", "midiStatusKb"]) {
    const el = $(id);
    el.textContent = !Midi.supported ? t("midiUseChrome") : on ? t("midiConnected") : none ? t("midiNoDevice") : "";
    el.className = "midi-status" + (on ? " on" : none ? " none" : "");
    if (on) el.title = Midi.devices.join("\n"); else el.removeAttribute("title");
  }
}

setModeInUrl(mode);   // 주소에 mode가 없거나 모르는 값이면 지금 단계(처음엔 note1)로 고쳐 둠 (코드 초견과 같은 방식)
renderInst(); renderSettings(); renderLevels(); resetNote(); renderMidi(); renderDurs();
onLangChange(() => { renderInst(); renderLevels(); renderNoteButtons(); renderMidi(); });
// 웹 글꼴을 다 받은 뒤 안내 문구 칸 폭을 다시 잼 (받기 전에는 대체 글꼴 폭이라서)
if (document.fonts) document.fonts.ready.then(() => { setHintWidth.key = ""; renderNoteButtons(); });

// ---------- 폰 세로 안내 (2026-11-25 사용자 요청 — 다른 연습 페이지와 같게, 건반 바로 위) ----------
// 보이는 곳(폰 세로)은 CSS(practice.css)가 정함. 랜덤 코드 연습과 따로 기억: chordoven.earRotateTip · chordoven.earScrollTip
// - "폰을 가로로 돌리면 건반이 커져요." + ×: 닫으면 이 기기에서 다시 안 나옴
// - "▼ 아래로 내리면 출제 설정을 바꿀 수 있어요" 알약: 누르면 출제 설정으로 스크롤. 출제 설정 제목이 화면 위쪽 65% 안에
//   한 번 들어오거나 알약·×를 누르면 다시 안 나옴 (넓은 화면은 처음부터 보여서 곧바로 끝남)
$("earRotateTip").hidden = store.get("earRotateTip") === "closed";
$("earRotateTipX").onclick = () => { $("earRotateTip").hidden = true; store.set("earRotateTip", "closed"); };
{
  const tip = $("earScrollTip");
  const head = document.querySelector("#sheetNote h2");
  const done = () => { tip.hidden = true; store.set("earScrollTip", "seen"); seen.disconnect(); };
  const seen = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) done(); }, { rootMargin: "0px 0px -35% 0px" });
  if (store.get("earScrollTip") !== "seen" && head && "IntersectionObserver" in window) {
    tip.hidden = false;
    seen.observe(head);
    $("earScrollTipGo").onclick = () => { done(); head.closest(".sheet").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("earScrollTipX").onclick = done;
  }
}
