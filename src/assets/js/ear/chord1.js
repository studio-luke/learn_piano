// ===== 청음 연습 — 코드 ① 코드 종류: 화면 (pages/ear.js가 단계를 고를 때 켜고 끔) =====
// 흐름 (2026-11-25 사용자 결정, chordoven-spec.md "청음 연습" 코드 ①):
//   [▶ 시작] → 코드(베이스 + 위 화음)를 한 번에 "짠" — 미리 들려주는 기준 소리 없음
//   근음 글자는 문제에 보여 주고, 그 뒤에 코드 종류만 입력(코드 추론하기의 입력칸·키패드, 근음 글자 키 없음) → [제출]·Enter
//   틀리면: 다시 쓸 수 있고 [▶ 펼쳐 듣기](아래부터 한 음씩)·[▶ 내 답 듣기](쓴 코드를 같은 베이스로) 버튼이 나옴
//   맞히거나 [정답 확인]: 코드 이름·건반의 구성음(베이스 제외)·큰보표. 틀린 답이 있었으면 [▶ 정답 듣기]·[▶ 내 답 듣기]로 비교
//   큰 ▶·Space는 언제든 문제 다시 듣기. 건반은 눌러서 소리만 (답은 키패드)
// 출제·채점은 ear/chords.js, 큰보표는 ear/grand.js, 건반은 ear/chord-keys.js
import { $, esc, toast, chipHTML } from "../common/dom.js";
import { t } from "../i18n/index.js";
import { Engine as E } from "../core/engine.js";
import { store } from "../common/storage.js";
import * as Ins from "./instruments.js";
import { makeChord, judgeChord, voiceLike, chordName, rootText, typeText, GROUPS, DEFAULT_TYPES } from "./chords.js";
import { drawGrand } from "./grand.js";
import { makeChordKeys } from "./chord-keys.js";
import { initKeypad, answerText, clearAnswer, setPadEnabled, type, backspace, deleteForward, moveCaret, extendCaret, caretTo, caretAtEnd, selectAll, undo, redo } from "../naming/keypad.js";
import { menuOpen } from "../naming/answer-menu.js";

const STORE = "ear.chord1.v1";                 // 이 단계의 출제 설정 (기기에 저장)
const DUR = 2.2, VEL = 0.42, BASS_VEL = 0.5;   // 코드 한 번 "짠"의 길이(초)·세기
const ARP_STEP = 0.32;                         // 펼쳐 듣기: 음 사이 간격(초)

let ctx = null;          // pages/ear.js가 넘겨주는 것 { inst(), authOpen(), cardTopIntoView(), revealNextButton() }
let active = false;      // 지금 코드 ① 단계인지 (단축키·MIDI 소리)
let S = null;            // 출제 설정 { types, inv, tens: 텐션 허용, tenMax: 1 = 최대 1개 · 2 = 제한 없음, slash: 분수코드 허용 }
let keys = null;         // 건반
// 문제 상태: q 문제, phase "idle"(시작 전) | "ask"(푸는 중) | "done"(맞힘·정답 확인), wrong 틀린 답 { chord, name }(마지막 것), solved 맞혔는지
const C = { q: null, phase: "idle", wrong: null, solved: false };

// ---------- 출제 설정 ----------
function loadS() {
  const s = Object.assign({ types: DEFAULT_TYPES.slice(), inv: false, tens: false, tenMax: 1, slash: false }, store.getJSON(STORE) || {});
  const known = new Set(GROUPS.flatMap(g => g.ids));
  s.types = s.types.filter(id => known.has(id));
  if (!s.types.length) s.types = DEFAULT_TYPES.slice();
  return s;
}
const saveS = () => store.setJSON(STORE, S);

/** 코드 종류 칩 (묶음마다 제목 + [전체] + 칩 — 코드 추론하기와 같은 모양) — 한 번 그림 */
function buildSettings() {
  $("earCTypes").innerHTML = GROUPS.map(g => `<div class="group"><div class="group-head"><h3 data-i18n="${g.key}">${esc(t(g.key))}</h3>`
    + `<button class="linkbtn" type="button" data-cgroup="${g.key}" data-i18n="groupAll">${esc(t("groupAll"))}</button></div><div class="chips">`
    + g.ids.map(id => `<label class="chip"><input type="checkbox" data-ctype="${id}"><span>${chipHTML(typeText(id, true))}</span></label>`).join("")
    + `</div></div>`).join("");
  $("earCTypes").addEventListener("change", e => {
    const box = e.target.closest("[data-ctype]"); if (!box) return;
    const id = box.dataset.ctype;
    if (!box.checked && S.types.length === 1) { box.checked = true; toast(t("earCNeedType")); return; }   // 하나는 남김
    S.types = box.checked ? [...new Set([...S.types, id])] : S.types.filter(x => x !== id);
    saveS();   // 다음 문제부터
    renderSettings();   // 텐션 안내 다시
  });
  // 묶음의 [전체]: 모두 켜져 있으면 모두 끄고, 아니면 모두 켬 (코드 추론하기와 같음). 끄면 하나도 안 남을 때는 그대로 + 알림
  $("earCTypes").addEventListener("click", e => {
    const b = e.target.closest("[data-cgroup]"); if (!b) return;
    const ids = GROUPS.find(g => g.key === b.dataset.cgroup).ids;
    const allOn = ids.every(id => S.types.includes(id));
    const next = allOn ? S.types.filter(id => !ids.includes(id)) : [...new Set([...S.types, ...ids])];
    if (!next.length) { toast(t("earCNeedType")); return; }
    S.types = next;
    saveS();
    renderSettings();
  });
  $("earCInv").onchange = e => { S.inv = e.target.checked; saveS(); };
  $("earCTens").onchange = e => { S.tens = e.target.checked; saveS(); renderSettings(); };
  $("earCTenMax1").onchange = () => { S.tenMax = 1; saveS(); };
  $("earCTenMax2").onchange = () => { S.tenMax = 2; saveS(); };
  $("earCSlashOpt").onchange = e => { S.slash = e.target.checked; saveS(); };
}
function renderSettings() {
  $("earCTypes").querySelectorAll("[data-ctype]").forEach(b => { b.checked = S.types.includes(b.dataset.ctype); });
  $("earCInv").checked = S.inv;
  $("earCTens").checked = S.tens; $("earCTenBox").hidden = !S.tens;
  $("earCTenMax1").checked = S.tenMax !== 2; $("earCTenMax2").checked = S.tenMax === 2;
  $("earCSlashOpt").checked = !!S.slash;
  // 텐션이 붙을 수 있는 7화음(dim7·augM7 빼고)이 하나도 없으면 안내 (랜덤 코드 연습과 같은 문구)
  $("earCWarn").textContent = S.tens && !S.types.some(id => E.BY_ID[id].ten?.length) ? t("warnC") : "";
}

// 읽을 수 없는 답의 안내 (judgeChord error → 문구 키) — 제출과 내 답 듣기가 같이 씀
const ERR_KEY = { root: "earCRootTyped", noParen: "errNoParen", unknown: "errUnknown" };

// ---------- 소리 ----------
const notesOf = q => [{ m: q.bass.midi, at: 0, dur: DUR, vel: BASS_VEL }, ...q.upper.map(n => ({ m: n.midi, at: 0, dur: DUR, vel: VEL }))];
function playChord(bass, upper) {
  Ins.stopAll();
  Ins.play(ctx.inst(), [{ m: bass, at: 0, dur: DUR, vel: BASS_VEL }, ...upper.map(m => ({ m, at: 0, dur: DUR, vel: VEL }))]);
}
const playQuestion = () => { if (C.q) { Ins.stopAll(); Ins.play(ctx.inst(), notesOf(C.q)); } };
/** 펼쳐 듣기: 베이스부터 위로 한 음씩, 마지막 음까지 이어서 울림 */
function playArp() {
  if (!C.q) return;
  Ins.stopAll();
  const ms = [C.q.bass.midi, ...C.q.upper.map(n => n.midi)];
  const total = ARP_STEP * (ms.length - 1) + DUR;
  Ins.play(ctx.inst(), ms.map((m, i) => ({ m, at: i * ARP_STEP, dur: total - i * ARP_STEP, vel: i ? VEL : BASS_VEL })));
}
/**
 * 내 답 듣기: 지금 입력칸의 글자를 읽어 들려줌 — 제출하지 않고 고친 글자도 바로 (2026-11-25 사용자 요청: 한 번 틀리면 이미 오답이라
 * 그 뒤로 쉬워져도 괜찮음). 읽을 수 없는 글자면 2초 알림만
 */
function playMine() {
  if (!C.q || !C.wrong) return;
  const r = judgeChord(answerText(), C.q);
  if (r.error) { toast(t(ERR_KEY[r.error]), 2000); return; }
  const v = voiceLike(r.chord, C.q);
  playChord(v.bass, v.upper);
}

// ---------- 화면 ----------
function setFeedback(kind, html) {
  const fb = $("earCFeedback");
  fb.className = "feedback" + (kind ? " " + kind : "");
  fb.innerHTML = html;
}
function render() {
  const started = C.phase !== "idle", done = C.phase === "done";
  $("btnCStart").hidden = started;
  $("btnCReplay").hidden = !started;
  $("earCRoot").textContent = C.q ? rootText(C.q.root) : "";
  $("earCSlash").textContent = C.q?.slash ? "/" + C.q.slash.name : "";
  // 틀린 뒤: 펼쳐 듣기·내 답 듣기. 끝난 뒤(틀린 답이 있었으면): 정답 듣기·내 답 듣기
  $("btnCArp").hidden = !started || (!C.wrong && !done);
  $("btnCMine").hidden = !C.wrong;
  $("btnCSubmit").disabled = C.phase !== "ask";
  $("btnCReveal").disabled = C.phase !== "ask";
  $("btnCNext").disabled = !done;
  setPadEnabled(C.phase === "ask");
  // 메이저 3화음이 나올 수 있으면 "그대로 [제출]" 안내도 (빈칸 = 메이저 3화음)
  $("earCHintText").textContent = !started ? t("earC1Intro") : done ? "" : t(S.types.includes("maj") ? "earC1AskMaj" : "earC1Ask");
  // 정답 표시: 끝난 뒤에만 (큰보표·건반). 그전에는 빈 오선과 칠하지 않은 건반
  const cls = C.solved ? "good" : "";
  drawGrand($("earCStaff"), done ? C.q.upper : [], done ? C.q.bass : null, cls);
  keys.draw(done ? C.q.upper : [], C.solved ? "good" : "sel");
}

function newQuestion() {
  const q = makeChord({ ...S, bassLow: Ins.lowest(ctx.inst()) }, Math.random, C.q);   // 베이스는 고른 악기가 낼 수 있는 음까지
  Object.assign(C, { q, phase: "ask", wrong: null, solved: false });
  clearAnswer();
  setFeedback("", "");
  render();
  playQuestion();
}

function submit() {
  if (C.phase !== "ask") return;
  const r = judgeChord(answerText(), C.q);
  if (r.error) {
    setFeedback("info", esc(t(ERR_KEY[r.error])));
    return;   // 시도로 치지 않음
  }
  if (r.correct) {
    C.phase = "done"; C.solved = true;
    setFeedback("ok", t("earRight", { name: esc(C.q.name) }));
    render();
    playQuestion();   // 맞히면 문제 소리를 한 번 더 (▶ 다시 듣기와 같은 소리, 2026-11-25 사용자 요청)
    ctx.revealNextButton();
    return;
  }
  C.wrong = { chord: r.chord, name: chordName(r.chord) };
  setFeedback("no", esc(t("earCWrong", { name: C.wrong.name })));
  render();
}

function reveal() {
  if (C.phase !== "ask") return;
  C.phase = "done";
  setFeedback("info", t("earReveal", { name: esc(C.q.name) }));
  render();
  playQuestion();   // 정답 확인도 문제 소리를 한 번 더
  ctx.revealNextButton();
}

function next() {
  if (C.phase !== "done") return;
  newQuestion();
  ctx.cardTopIntoView();
}

// ---------- 단축키 (코드 추론하기와 같음 — 글자 키는 모두 입력) ----------
//   Enter 제출(끝난 문제면 다음 문제) · Space 문제 다시 듣기 · ←/→ 커서(→는 커서가 맨 끝이고 끝난 문제면 다음 문제) ·
//   Backspace/Delete 지우기 · Home/End · ⌘A·⌘Z·⌘⇧Z·Ctrl+Y · 그 밖의 글자는 입력칸으로
function onKey(e) {
  if (!active || ctx.authOpen() || document.querySelector("dialog[open]") || menuOpen()) return;
  const el = e.target, tag = (el.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(el.type))) return;
  if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "a" || e.key === "A")) { if (selectAll()) e.preventDefault(); return; }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "z" || e.key === "Z")) { if (e.shiftKey ? redo() : undo()) e.preventDefault(); return; }
  if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "y" || e.key === "Y")) { if (redo()) e.preventDefault(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Enter") {
    e.preventDefault();
    if (C.phase === "idle") start(); else if (C.phase === "done") next(); else submit();
  } else if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat && C.phase !== "idle") playQuestion();
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const d = e.key === "ArrowRight" ? 1 : -1;
    if (e.shiftKey) extendCaret(d);
    else if (d > 0 && caretAtEnd() && C.phase === "done") next();
    else moveCaret(d);
  } else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
  else if (e.key === "Delete") { e.preventDefault(); deleteForward(); }
  else if (e.key === "Home" || e.key === "End") { e.preventDefault(); caretTo(e.key === "End"); }
  else if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); type(e.key); }
}

function start() {
  newQuestion();
  ctx.cardTopIntoView();
}

/**
 * 처음 한 번.
 * @param c  { inst(): 악기 id, authOpen(): 로그인 창이 열려 있는지, cardTopIntoView(), revealNextButton() }
 */
export function initChord1(c) {
  ctx = c;
  S = loadS();
  buildSettings();
  renderSettings();
  initKeypad(() => {}, { noRoot: true });
  // 건반 연주: 코드 초견과 같이 앞 음을 끄지 않음 — 마우스는 누르는 동안, 터치는 한 번 (2026-11-25 사용자 요청)
  keys = makeChordKeys($("earCKeyboard"), {
    down: m => { Ins.noteOn(ctx.inst(), m, 90); keys.hold(m, true); },
    up: m => { Ins.noteOff(m); keys.hold(m, false); },
    tap: m => { Ins.tap(ctx.inst(), m); keys.flash(m); },
  });
  $("btnCStart").onclick = start;
  $("btnCReplay").onclick = playQuestion;
  $("btnCArp").onclick = playArp;
  $("btnCMine").addEventListener("pointerdown", e => e.preventDefault());   // 눌러도 입력칸의 커서·선택이 그대로 (⌫와 같음)
  $("btnCMine").onclick = playMine;
  $("btnCSubmit").onclick = submit;
  $("btnCReveal").onclick = reveal;
  $("btnCNext").onclick = next;
  document.addEventListener("keydown", onKey, true);
  // Space로 재생한 뒤 체크박스·버튼이 눌리지 않게 (코드 추론하기와 같음)
  document.addEventListener("keyup", e => {
    if (!active || e.code !== "Space" || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "select" || tag === "textarea" || (tag === "input" && !/^(checkbox|radio)$/.test(e.target.type))) return;
    e.preventDefault();
  }, true);
  render();
}

/** 코드 ① 단계로 들어오거나 나갈 때 — 나가면 소리를 멈추고 시작 전으로 */
export function setChord1Active(on) {
  if (on === active) return;
  active = on;
  if (!on) {
    Ins.stopAll();
    Object.assign(C, { q: null, phase: "idle", wrong: null, solved: false });
    clearAnswer();
    setFeedback("", "");
  }
  render();
}

/** MIDI 건반으로 누른 음 — 코드 ①에서는 소리만 */
/** MIDI 건반 (pages/ear.js가 넘겨줌): 코드 초견과 같이 세기·떼기·서스테인 페달 — kind "on" | "off" | "pedal" */
export function chord1Midi(kind, m, vel) {
  if (!active) return false;
  if (kind === "pedal") Ins.pedal(m);
  else if (kind === "on") { Ins.noteOn(ctx.inst(), m, vel); keys.hold(m, true); }
  else { Ins.noteOff(m); keys.hold(m, false); }
  return true;
}

/** 언어가 바뀌면 다시 그림 */
export function chord1Lang() {
  $("earCTypes").querySelectorAll("[data-i18n]").forEach(h => { h.textContent = t(h.dataset.i18n); });
  render();
}
