// ===== 코드 추론하기 — 출제 설정 =====
// 오른쪽 "출제 설정" 카드의 상태(S)와 화면. 랜덤 코드 연습(practice/settings.js)과 모양은 같지만 고를 수 있는 옵션이 달라서
// 따로 저장해요: 이 기기 localStorage chordoven.nameSettings.v1, 로그인했으면 계정 profiles.name_settings (사용자 결정 2026-11-08).
//
// S의 항목
//   types        코드 종류별 출제 여부 { maj: true, M7: false, … } (텐션 코드 종류 M9 M13 m9 m11 9 13은 없음)
//   optB, bases  옵션 B(특정 베이스만) 켜짐, 건반(pc 0~11)별 선택
//   optC, cMax   옵션 C(세븐코드에 텐션) 켜짐, 텐션 최대 개수(1 또는 2)
//   optInv       자리바꿈 허용
//   optE         옵션 E(복잡한 표현이 포함된 코드 출제) — 자리바꿈을 켜면 쓰지 않음(비활성화, 값은 그대로 둠)
//   adv          [심화] 묶음 펼침
//   labels       건반에 음이름 표시
import { Engine } from "../core/engine.js";
import { NAME_TYPES } from "../core/naming.js";
import { Account } from "../account/account.js";
import { t, applyI18n } from "../i18n/index.js";
import { $, toast, chipHTML } from "../common/dom.js";
import { store } from "../common/storage.js";

const KEY = "nameSettings.v1";

export const DEFAULTS = {
  // 처음 방문의 코드 종류: 랜덤 코드 연습의 기본값과 같음 (3화음·sus·7화음·6화음 전부 + add9, madd9)
  types: {
    maj: true, min: true, dim: true, aug: true,
    sus4: true, sus2: true,
    M7: true, m7: true, dom7: true, "7sus4": true, aug7: true, dim7: true, m7b5: true, mM7: true, augM7: true,
    "6": true, m6: true,
    add9: true, madd9: true,
  },
  optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optInv: false, optE: false,
  adv: false, labels: false,
};

/** 지금 출제 설정. 다른 파일이 이 객체를 계속 참조하므로 새 객체로 바꾸지 말 것 */
export const S = structuredClone(DEFAULTS);
{
  const saved = store.getJSON(KEY);
  if (saved && typeof saved === "object") Object.assign(S, saved);
}
const saveLocal = () => store.setJSON(KEY, S);
/** 저장: 이 기기 + (로그인했으면) 계정의 name_settings */
export function save() { saveLocal(); Account.settingsChanged(S, "name_settings"); }
/** S의 내용을 통째로 바꿈 (기본값 + 계정의 값). 로그인 때 계정 설정을 받을 때 씀 */
export function replaceSettings(remote) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, structuredClone(DEFAULTS), remote);
  saveLocal();
}

// 출제 설정 묶음 (화면에 이 순서대로). 텐션 코드 묶음은 없음
const GROUPS = ["triad", "sus", "seventh", "sixth", "add"];
const allWhite = () => Engine.WHITE.every(i => S.bases[i]);

let onChange = () => {};

/**
 * 출제 설정 카드 만들기.
 * @param changed  출제 범위가 바뀌면 부를 함수 (새 문제를 냄)
 */
export function initSettings(changed) {
  onChange = changed;
  const tg = $("typeGroups");
  for (const g of GROUPS) {
    const types = NAME_TYPES.filter(x => x.group === g);
    const box = document.createElement("div");
    box.className = "group";
    box.innerHTML = `<div class="group-head"><h3 data-i18n="g_${g}"></h3><button class="linkbtn" type="button" data-group="${g}" data-i18n="groupAll"></button></div>` +
      `<div class="chips">${types.map(x => `<label class="chip"><input type="checkbox" id="type-${x.id}" data-type="${x.id}"><span>${chipHTML(x.name)}</span></label>`).join("")}</div>`;
    tg.appendChild(box);
  }
  applyI18n(tg);
  tg.addEventListener("change", e => { const id = e.target.dataset.type; if (id) { S.types[id] = e.target.checked; settingsChanged(); } });
  // 묶음의 [전체]: 모두 켜져 있으면 모두 끄고, 아니면 모두 켬
  tg.addEventListener("click", e => {
    const g = e.target.dataset.group; if (!g) return;
    const types = NAME_TYPES.filter(x => x.group === g);
    const allOn = types.every(x => S.types[x.id]);
    types.forEach(x => { S.types[x.id] = !allOn; });
    settingsChanged();
  });

  // 옵션 B: 베이스 12개
  $("bases").innerHTML = Engine.PC_NAMES.map((n, i) => `<label class="chip"><input type="checkbox" id="base-${i}" data-base="${i}"><span>${n.replace("/", "<br>")}</span></label>`).join("");
  $("bases").addEventListener("change", e => { const i = e.target.dataset.base; if (i != null) { S.bases[+i] = e.target.checked; settingsChanged(); } });
  $("basesAll").onclick = () => { S.bases = Array(12).fill(true); settingsChanged(); };
  $("basesNone").onclick = () => { S.bases = Array(12).fill(false); settingsChanged(); };
  $("basesWhite").onclick = () => { const on = !allWhite(); Engine.WHITE.forEach(i => { S.bases[i] = on; }); settingsChanged(); };

  $("optB").onchange = e => { S.optB = e.target.checked; settingsChanged(); };
  $("optC").onchange = e => { S.optC = e.target.checked; settingsChanged(); };
  $("cMax1").onchange = () => { S.cMax = 1; settingsChanged(); };
  $("cMax2").onchange = () => { S.cMax = 2; settingsChanged(); };
  $("optInv").onchange = e => { S.optInv = e.target.checked; settingsChanged(); };
  $("optE").onchange = e => { S.optE = e.target.checked; settingsChanged(); };
  $("advToggle").onclick = () => { S.adv = !S.adv; syncSettingsUI(); save(); };
  // 잠긴 설정을 누르면 왜 잠겼는지 알려줌
  $("sheetLock").onclick = () => { if (lockReason) toast(t(lockReason)); };
}

// 출제 범위가 바뀜: 화면 맞추고 저장, 0.25초 뒤 새 문제 (칩을 연달아 누를 때 문제가 계속 바뀌지 않게)
let timer;
function settingsChanged() { syncSettingsUI(); save(); clearTimeout(timer); timer = setTimeout(onChange, 250); }

/** S에 맞게 출제 설정 카드의 체크 상태·펼침·경고를 다시 그림 */
export function syncSettingsUI() {
  NAME_TYPES.forEach(x => { $("type-" + x.id).checked = !!S.types[x.id]; });
  S.bases.forEach((v, i) => { $("base-" + i).checked = v; });
  $("optB").checked = S.optB; $("basesBox").hidden = !S.optB;
  $("basesWhite").setAttribute("aria-pressed", String(allWhite()));
  $("optC").checked = S.optC; $("cBox").hidden = !S.optC;
  $("cMax1").checked = S.cMax !== 2; $("cMax2").checked = S.cMax === 2;
  $("optInv").checked = S.optInv;
  // 자리바꿈을 켜면 옵션 E는 비활성화 + 이유 안내 (사용자 결정 2026-11-08)
  $("optE").checked = S.optE; $("optE").disabled = S.optInv;
  $("optELabel").classList.toggle("off", S.optInv); $("optELocked").hidden = !S.optInv;
  $("advToggle").setAttribute("aria-expanded", String(S.adv)); $("advBox").hidden = !S.adv;
  // 옵션 C를 켰는데 7화음이 하나도 없으면 텐션이 붙을 코드가 없음
  const has7 = NAME_TYPES.some(x => x.seventh && S.types[x.id]);
  $("settingsWarn").textContent = S.optC && !has7 ? t("warnC") : "";
}

// ---------- 잠금 (랜덤 코드 연습과 같음, practice/settings.js) ----------
// 틀린 문제 다시 풀기 중(출제 설정이 적용되지 않음)과 타이머 실행 중(타이머 세션에 저장한 설정을 지키려고)에는
// 출제 설정을 회색으로 잠가요. 위에 투명한 막(#sheetLock)이 클릭을 받아 이유를 알려줘요.
let lockReason = null;
/** reason: 안내 문구 키("lockNote" | "lockTimer") 또는 null(잠금 해제) */
export function setLocked(reason) {
  lockReason = reason;
  const sheet = document.querySelector(".sheet");
  sheet.classList.toggle("locked", !!reason);
  $("lockNote").hidden = !reason; $("sheetLock").hidden = !reason;
  if (reason) $("lockNote").textContent = t(reason);
  sheet.querySelectorAll("input, button:not(.sheet-lock)").forEach(el => { el.disabled = !!reason; });
  if (!reason) syncSettingsUI();   // 옵션 E는 자리바꿈일 때 계속 꺼져 있어야 해서 다시 맞춤
}
