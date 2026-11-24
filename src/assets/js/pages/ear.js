// ===== 청음 연습 (trainer/ear/index.html) — 시작점 =====
// 들려주는 음·멜로디·코드를 듣고 맞히는 연습. 갈래 [단음 | 코드] × 단계(레벨), 고른 단계는 주소 ?mode=note1 … chord5.
// 지금 만든 단계: 단음 ① 음 하나 — 나머지는 "준비 중"으로 보이기만 함. 규칙은 chordoven-spec.md "청음 연습".
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
import { startPage } from "../common/layout.js";
import { isOpen as authOpen } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $ } from "../common/dom.js";
import { store } from "../common/storage.js";
import * as Ins from "../ear/instruments.js";
import { initKeys, markKeys, refKey } from "../ear/keys.js";
import { initStaff, setSignature, showNotes } from "../ear/staff.js";
import { KEY_ROOTS, LOW, HIGH, signature, scaleMidis, pickNote, judgeNote, spellMidi, midiOf, sigAcc, fullName, otherKey, sameRoot } from "../ear/theory.js";

startPage({ title: "navEar" });

// ---------- 갈래·단계 ----------
// mode = 주소 ?mode 값(한 번 정하면 바꾸지 않음 — 화면 번호(num)와 따로라 0단계·2.5단계를 끼워 넣어도 됨).
// key = 이름 문구 키(설명은 key + "Desc"), hard = 기준 없이 듣는 단계, ready = 만든 단계
const LEVELS = [
  { mode: "note1", track: "note", num: "1", key: "earN1", ready: true },
  { mode: "note2", track: "note", num: "2", key: "earN2" },
  { mode: "note3", track: "note", num: "3", key: "earN3" },
  { mode: "note4", track: "note", num: "4", key: "earN4", hard: true },
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
  $("panelNote1").hidden = mode !== "note1";
  $("earKeyRow").hidden = mode !== "note1";   // 맨 윗줄의 조 표시는 단음 단계만
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

// ---------- 단음 출제 설정 (단음 단계끼리 같이 씀, 기기에 저장: chordoven.earNote.v1) ----------
// tonicEach = 문제마다 기준음 재생 (처음 켜짐, 2026-11-24 사용자 요청)
const S = Object.assign({ root: "C", minor: false, chromatic: false, tonicEach: true }, store.getJSON("earNote.v1") || {});
if (!KEY_ROOTS[S.minor ? "minor" : "major"].includes(S.root)) S.root = "C";
const saveS = () => store.setJSON("earNote.v1", S);
const key = () => ({ root: S.root, minor: S.minor });
const keyLabel = () => `${S.root} ${S.minor ? "minor" : "Major"}`;

function renderSettings() {
  $("earRoot").innerHTML = KEY_ROOTS[S.minor ? "minor" : "major"].map(r => `<option value="${r}"${r === S.root ? " selected" : ""}>${r}</option>`).join("");
  $("earMode").textContent = S.minor ? "minor" : "Major";
  $("earMode").setAttribute("aria-pressed", String(S.minor));
  $("earChrom").checked = S.chromatic;
  $("earTonicEach").checked = S.tonicEach;
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

// ---------- 단음 ① 음 하나 ----------
// phase: "idle"(시작 전) | "ask"(풀고 있음) | "done"(맞힘·정답 확인)
const N = { phase: "idle", q: null, wrong: false };
const SCALE_STEP = 0.42;   // 스케일 음 사이 간격(초)
const Q_DUR = 1.4;         // 문제 음 길이(초)
const TONIC_DUR = 1.0;     // 기준음 길이(초)
const GAP = 0.5;           // 스케일·기준음과 다음 소리 사이 쉼(초)
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

/** 스케일 음 목록(at초부터). { notes, end: 끝나는 시각 } */
function scaleNotes(at) {
  const ms = scaleMidis(key());
  const notes = ms.map((m, i) => ({ m, at: at + i * SCALE_STEP, dur: i === ms.length - 1 ? 0.9 : SCALE_STEP + 0.05, vel: 0.45 }));
  return { notes, end: at + (ms.length - 1) * SCALE_STEP + 0.9 };
}
/** 기준음(으뜸음 — 스케일의 첫 음) */
const tonicNotes = at => ({ notes: [{ m: scaleMidis(key())[0], at, dur: TONIC_DUR, vel: 0.5 }], end: at + TONIC_DUR });
const questionNotes = at => ({ notes: [{ m: N.q.midi, at, dur: Q_DUR, vel: 0.55 }], end: at + Q_DUR });

/** 소리를 모두 멈추고 예약한 문구·잠금도 취소 */
function stopListening() {
  listenTok++;
  timers.forEach(clearTimeout); timers = [];
  Ins.stopAll();
  refKey(null);
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
  const notes = [], spans = [];   // spans: [{ start, end, text }] 잠그는 구간
  const dots = [];                // 건반을 칠할 스케일·기준음 (문제 음은 칠하지 않음 — 답이 되므로)
  let at = 0;
  for (const p of parts) {
    const seg = p.kind === "scale" ? scaleNotes(at) : p.kind === "tonic" ? tonicNotes(at) : questionNotes(at);
    notes.push(...seg.notes);
    if (p.kind !== "question") dots.push(...seg.notes);
    if (p.kind !== "question") spans.push({ start: at, end: seg.end, text: t(p.kind === "scale" ? "earPlayingScale" : "earPlayingTonic", { key: keyLabel() }) });
    at = seg.end + GAP;
  }
  const locking = required && spans.length > 0;
  if (locking) setRef(spans[0].text);   // 소리가 준비되기 전부터 잠금
  Ins.play(inst, notes).then(() => {
    if (tok !== listenTok) return;
    // 스케일·기준음이 울리는 동안 그 건반을 파란색으로 (2026-11-24 사용자 요청 — 필수 재생이든 버튼으로 다시 듣든)
    // 스케일 음은 소리가 살짝 겹치므로(다음 음 시작 뒤 0.05초) 색은 다음 음이 시작될 때 넘겨줌 — 두 건반이 함께 칠해지지 않게
    dots.forEach((n, i) => {
      const next = dots[i + 1];
      const off = next && next.at < n.at + n.dur ? next.at : n.at + n.dur;
      timers.push(setTimeout(() => tok === listenTok && refKey(n.m, true), n.at * 1000));
      timers.push(setTimeout(() => tok === listenTok && refKey(n.m, false), off * 1000 - 5));
    });
    if (!locking) return;
    spans.forEach((sp, i) => {
      if (i) timers.push(setTimeout(() => tok === listenTok && setRef(sp.text), sp.start * 1000));
    });
    // 마지막 기준 소리가 끝나고 쉼이 지나면(= 문제 음이 시작될 때) 풀림
    timers.push(setTimeout(() => tok === listenTok && setRef(""), (spans[spans.length - 1].end + GAP) * 1000));
  });
}

/** 잠금과 안내 문구 바꾸기 (text가 ""이면 풀림) */
function setRef(text) {
  refText = text;
  const locked = !!text;
  for (const id of ["keyboard", "earStaff"]) $(id).classList.toggle("locked", locked);
  document.querySelector(".ear-accs").classList.toggle("locked", locked);
  renderNoteButtons();
}

/** [생략하기]: 필수 재생의 남은 스케일·기준음을 건너뛰고 바로 문제 음 */
$("btnSkip").onclick = () => { if (refText) listen([{ kind: "question" }]); };

const playPicked = m => Ins.play(inst, [{ m, at: 0, dur: 0.9, vel: 0.5 }]);

/** 새 문제. withScale = 스케일을 먼저 들려줌 (시작, 조를 바꿨을 때) */
function newQuestion(withScale) {
  N.q = pickNote(key(), { chromatic: S.chromatic }, N.q && N.q.midi);
  N.phase = "ask"; N.wrong = false;
  markKeys(); showNotes([]);
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
  $("btnNext").disabled = N.phase !== "done";
  $("earHintText").textContent = refText || (!started ? t("earN1Intro") : t("earN1Ask"));
  $("btnSkip").hidden = !refText;
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
  playPicked(m);
  if (N.phase !== "ask") return;   // 시작 전·끝난 문제: 소리만
  const note = spelled || spellMidi(key(), m);
  const r = judgeNote(N.q.midi, m);
  if (r === "ok") {
    N.phase = "done";
    markKeys(new Map([[m, "good"]]));
    showNotes([{ note: N.q, cls: "good" }]);
    setFeedback("ok", t("earRight", { name: fullName(N.q) }));
  } else {
    N.wrong = true;
    markKeys(new Map([[m, "bad"]]));
    showNotes([{ note, cls: "bad" }]);
    const msg = r === "octUp" ? t("earOctUp") : r === "octDown" ? t("earOctDown") : t("earWrong");
    setFeedback("no", msg);
  }
  renderNoteButtons();
}

initKeys(LOW, HIGH, m => pick(m));
initStaff(({ l, oct }) => {
  const a = acc === "key" ? sigAcc(signature(key()), l) : acc;
  const note = { l, a, oct };
  setAcc("key");   // 변화표 버튼은 한 번 쓰고 조표대로로
  const m = midiOf(note);
  if (m < LOW - 1 || m > HIGH + 1) return;   // F3 아래 F♭3 등 건반 밖 (반음까지만 허용)
  pick(m, note);
});

function setAcc(v) {
  acc = v;
  for (const b of document.querySelectorAll(".ear-acc")) {
    const bv = b.dataset.acc === "key" ? "key" : +b.dataset.acc;
    b.setAttribute("aria-pressed", String(bv === v));
  }
}
for (const b of document.querySelectorAll(".ear-acc")) b.onclick = () => setAcc(b.dataset.acc === "key" ? "key" : (acc === +b.dataset.acc ? "key" : +b.dataset.acc));

$("btnStart").onclick = () => newQuestion(true);
$("btnReplay").onclick = () => listen([{ kind: "question" }]);
$("btnTonic").onclick = () => listen([{ kind: "tonic" }]);
$("btnScale").onclick = () => listen([{ kind: "scale" }]);
$("btnReveal").onclick = () => {
  if (N.phase !== "ask" || refText) return;
  N.phase = "done";
  markKeys(new Map([[N.q.midi, "ans"]]));
  showNotes([{ note: N.q, cls: "good" }]);
  setFeedback("info", t("earReveal", { name: fullName(N.q) }));
  listen([{ kind: "question" }]);
  renderNoteButtons();
};
$("btnNext").onclick = () => { if (N.phase === "done") newQuestion(false); };

// 단축키 (물리 키 기준): Enter·N·→ 다음 문제(끝난 문제), Space 문제 다시 듣기. 입력칸·드롭다운·로그인 창에서는 안 함
document.addEventListener("keydown", e => {
  if (mode !== "note1" || authOpen() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if ((e.code === "Enter" || e.code === "KeyN" || e.code === "ArrowRight") && N.phase === "done") { e.preventDefault(); newQuestion(false); }
  else if (e.code === "Space" && N.phase !== "idle") { e.preventDefault(); if (!refText) listen([{ kind: "question" }]); }
});

renderInst(); renderSettings(); renderLevels(); renderNoteButtons();
onLangChange(() => { renderInst(); renderLevels(); renderNoteButtons(); });
