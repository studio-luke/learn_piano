// ===== 연습 — 출제 설정 =====
// 오른쪽 "출제 설정" 카드의 상태(S)와 화면. 이 기기(localStorage)에 저장하고, 로그인했으면 계정에도 저장해요.
//
// S의 항목
//   types        코드 종류별 출제 여부 { maj: true, M7: false, … } (engine.js TYPES의 id)
//   optB, bases  옵션 B(특정 베이스만) 켜짐, 건반(pc 0~11)별 선택 [true, false, …]
//   optC, cMax   옵션 C(세븐코드에 텐션) 켜짐, 텐션 최대 개수(1 또는 2)
//   optD, optE   옵션 D(기호 표기), 옵션 E(복잡한 음 표현)
//   adv          [심화] 묶음 펼침
//   labels, sound              건반 음이름 표시, 소리
//   kbd, kbdTouched            키보드로 건반 입력(기기별 — 계정에 안 올림), 사용자가 직접 바꿨는지
//   midi                       MIDI 입력 모드 — 88건반 표시(기기별 — 계정에 안 올림, 2026-11-09)
import { Engine } from "../core/engine.js";
import { Account } from "../account/account.js";
import { t, applyI18n } from "../i18n/index.js";
import { $, toast, chipHTML } from "../common/dom.js";
import { store } from "../common/storage.js";

/** 마우스·트랙패드가 있는 기기 = 컴퓨터 (키보드로 건반 입력을 기본으로 켬) */
export const IS_PC = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

export const DEFAULTS = {
  // 처음 방문·처음 가입(계정에 설정이 없을 때)의 코드 종류: 3화음·sus·7화음·6화음 전부 + add9, madd9 (2026-11-07 사용자 요청)
  // 텐션 코드·6(9)는 꺼 둠. 이미 설정이 저장된 기기·계정은 그대로
  types: {
    maj: true, min: true, dim: true, aug: true,
    sus4: true, sus2: true,
    M7: true, m7: true, dom7: true, "7sus4": true, aug7: true, dim7: true, m7b5: true, mM7: true, augM7: true,
    "6": true, m6: true,
    add9: true, madd9: true,
  },
  optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optD: false, optE: false,
  labels: false, sound: true, adv: false, kbd: IS_PC, kbdTouched: false, midi: false,
};

/** 지금 출제 설정. 다른 파일이 이 객체를 계속 참조하므로 새 객체로 바꾸지 말고 replaceSettings()로 내용만 바꿀 것 */
export const S = structuredClone(DEFAULTS);

// 출제 설정 묶음 (화면에 이 순서대로). note: 묶음 아래 안내 문구가 있는지
const GROUPS = [{ id: "triad" }, { id: "sus" }, { id: "seventh" }, { id: "sixth" }, { id: "add" }, { id: "tension", note: true }];

/** 예전 설정 고치기: 옵션 A(흰 건반 베이스만)는 2026-11-05에 없어지고 옵션 B의 "흰 건반" 버튼이 됨 */
export function migrate(o) {
  if (o && o.optA) { o.optB = true; o.bases = Array.from({ length: 12 }, (_, i) => Engine.WHITE.includes(i)); }
  if (o) delete o.optA;
  return o;
}

/** S의 내용을 통째로 바꿈 (기본값 + 새 값). 계정 설정을 받을 때 씀 — 기기별 설정(kbd, midi)은 그대로 둠 */
export function replaceSettings(remote) {
  const keep = { kbd: S.kbd, kbdTouched: S.kbdTouched, midi: S.midi };
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, structuredClone(DEFAULTS), migrate({ ...remote }), keep);
  saveLocal();
}

const saveLocal = () => store.setJSON("settings.v2", S);
/** 저장: 이 기기 + (로그인했으면) 계정 */
export function save() { saveLocal(); Account.settingsChanged(S); }

/** 고른 코드 종류 수, 고른 베이스 수, 흰 건반 7개가 모두 골라졌는지 */
export const typeCount = () => Engine.TYPES.filter(x => S.types[x.id]).length;
export const baseCount = () => S.bases.filter(Boolean).length;
export const allWhite = () => Engine.WHITE.every(i => S.bases[i]);

// 처음 열 때: 저장된 설정 읽기
const saved = migrate(store.getJSON("settings.v2"));
/** 이 기기에 저장된 설정이 있었는지 (페이지를 열 때) — 출제 설정 공유 링크를 묻지 않고 적용할지 정할 때 씀 */
export const HAD_SAVED = !!(saved && typeof saved === "object");
{
  if (HAD_SAVED) Object.assign(S, saved);
  if (!S.kbdTouched) S.kbd = IS_PC;   // 사용자가 직접 바꾸기 전까지 컴퓨터면 켬, 폰이면 끔
}

let onChange = () => {};

/**
 * 출제 설정 카드 만들기.
 * @param changed  출제 범위가 바뀌면 부를 함수 (새 문제를 냄)
 */
export function initSettings(changed) {
  onChange = changed;
  // 코드 종류 칩
  const tg = $("typeGroups");
  for (const g of GROUPS) {
    const types = Engine.TYPES.filter(x => x.group === g.id);
    const box = document.createElement("div");
    box.className = "group";
    box.innerHTML = `<div class="group-head"><h3 data-i18n="g_${g.id}"></h3><button class="linkbtn" type="button" data-group="${g.id}" data-i18n="groupAll"></button></div>` +
      (g.note ? `<p class="note" data-i18n="g_${g.id}Note"></p>` : "") +
      `<div class="chips">${types.map(x => `<label class="chip"><input type="checkbox" id="type-${x.id}" data-type="${x.id}"><span>${chipHTML(x.name)}</span></label>`).join("")}</div>`;
    tg.appendChild(box);
  }
  applyI18n(tg);   // 방금 만든 묶음 제목·[전체] 버튼에 문구 넣기
  tg.addEventListener("change", e => { const id = e.target.dataset.type; if (id) { S.types[id] = e.target.checked; settingsChanged(); } });
  // 묶음의 [전체]: 모두 켜져 있으면 모두 끄고, 아니면 모두 켬
  tg.addEventListener("click", e => {
    const g = e.target.dataset.group; if (!g) return;
    const types = Engine.TYPES.filter(x => x.group === g);
    const allOn = types.every(x => S.types[x.id]);
    types.forEach(x => { S.types[x.id] = !allOn; });
    settingsChanged();
  });

  // 옵션 B: 베이스 12개
  $("bases").innerHTML = Engine.PC_NAMES.map((n, i) => `<label class="chip"><input type="checkbox" id="base-${i}" data-base="${i}"><span>${n.replace("/", "<br>")}</span></label>`).join("");
  $("bases").addEventListener("change", e => { const i = e.target.dataset.base; if (i != null) { S.bases[+i] = e.target.checked; settingsChanged(); } });
  $("basesAll").onclick = () => { S.bases = Array(12).fill(true); settingsChanged(); };
  $("basesNone").onclick = () => { S.bases = Array(12).fill(false); settingsChanged(); };
  // [흰 건반]: 흰 건반 7개를 모두 켜거나(이미 다 켜져 있으면) 끔. 검은 건반은 그대로
  $("basesWhite").onclick = () => { const on = !allWhite(); Engine.WHITE.forEach(i => { S.bases[i] = on; }); settingsChanged(); };

  $("optB").onchange = e => { S.optB = e.target.checked; settingsChanged(); };
  $("optC").onchange = e => { S.optC = e.target.checked; settingsChanged(); };
  $("cMax1").onchange = () => { S.cMax = 1; settingsChanged(); };
  $("cMax2").onchange = () => { S.cMax = 2; settingsChanged(); };
  $("optD").onchange = e => { S.optD = e.target.checked; settingsChanged(); };
  $("optE").onchange = e => { S.optE = e.target.checked; settingsChanged(); };
  $("advToggle").onclick = () => { S.adv = !S.adv; syncSettingsUI(); save(); };

  // 잠긴 설정을 누르면 왜 잠겼는지 알려줌
  $("sheetLock").onclick = () => { if (lockReason) toast(t(lockReason)); };
}

// 출제 범위가 바뀜: 화면 맞추고 저장, 잠깐(0.25초) 기다렸다가 새 문제 (칩을 연달아 누를 때 문제가 계속 바뀌지 않게)
let timer;
function settingsChanged() { syncSettingsUI(); save(); clearTimeout(timer); timer = setTimeout(onChange, 250); }

/** S에 맞게 출제 설정 카드의 체크 상태·펼침·경고를 다시 그림 */
export function syncSettingsUI() {
  Engine.TYPES.forEach(x => { $("type-" + x.id).checked = !!S.types[x.id]; });
  S.bases.forEach((v, i) => { $("base-" + i).checked = v; });
  $("optB").checked = S.optB; $("basesBox").hidden = !S.optB;
  $("basesWhite").setAttribute("aria-pressed", String(allWhite()));
  $("optC").checked = S.optC; $("cBox").hidden = !S.optC;
  $("cMax1").checked = S.cMax !== 2; $("cMax2").checked = S.cMax === 2;
  $("optD").checked = S.optD; $("optE").checked = S.optE;
  $("advToggle").setAttribute("aria-expanded", String(S.adv)); $("advBox").hidden = !S.adv;
  // 옵션 C를 켰는데 7화음이 하나도 없으면 텐션이 붙을 코드가 없음
  const has7 = Engine.TYPES.some(x => x.seventh && S.types[x.id]);
  $("settingsWarn").textContent = S.optC && !has7 ? t("warnC") : "";
}

// ---------- 잠금 ----------
// 틀린 문제 다시 풀기 중(출제 설정이 적용되지 않음)과 타이머 실행 중(타이머 세션에 저장한 설정을 지키려고)에는
// 출제 설정을 회색으로 잠가요. 위에 투명한 막(#sheetLock)이 클릭을 받아 이유를 알려줘요.
// 공유 링크 버튼(.preset-btn)은 설정을 바꾸지 않고 읽기만 하므로 잠그지 않아요.
let lockReason = null;
/** reason: 안내 문구 키("lockNote" | "lockTimer") 또는 null(잠금 해제) */
export function setLocked(reason) {
  lockReason = reason;
  const sheet = document.querySelector(".sheet");
  sheet.classList.toggle("locked", !!reason);
  $("lockNote").hidden = !reason; $("sheetLock").hidden = !reason;
  if (reason) $("lockNote").textContent = t(reason);
  sheet.querySelectorAll("input, button:not(.sheet-lock):not(.preset-btn)").forEach(el => { el.disabled = !!reason; });
}
