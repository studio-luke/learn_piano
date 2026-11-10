// ===== 코드 초견 — 무작위 코드 모드의 출제 설정 =====
// 랜덤 코드 연습과 같은 출제 설정(코드 종류, 특정 베이스, 텐션, 기호 표기, 복잡한 음 표현)에
// "한 코드당 마디수"와 "분수코드 허용"을 더함 (2026-11-10 사용자 결정). 출제는 랜덤 코드 연습과 같은 엔진(core/engine.js generate).
// 이 기기에만 저장(chordoven.improvRandom.v1) — 랜덤 코드 연습 설정과 따로. 채점·기록이 없어서 계정에는 올리지 않음.
// 정답 규칙 안내(텐션 코드의 생략 가능한 음 등)는 채점이 없으니 넣지 않음.
// 화면 모양은 랜덤 코드 연습의 출제 설정(practice.css .sheet)과 같음. id는 8마디 모드 설정과 겹치지 않게 앞에 r.
//
// S의 항목
//   types, optB, bases, optC, cMax, optD, optE   랜덤 코드 연습과 같은 뜻 (practice/settings.js) — 처음 코드 종류만 다름
//   bars    한 코드당 마디수 "0.5" | "1" | "2" (기본 "1")
//   slash   분수코드 허용 (기본 켜짐 — 전위형·하이브리드 코드를 약 25%, improv/slash.js)
//   adv     [심화] 묶음 펼침
import { Engine } from "../core/engine.js";
import { applyI18n, t } from "../i18n/index.js";
import { $, chipHTML } from "../common/dom.js";
import { store } from "../common/storage.js";

const KEY = "improvRandom.v1";
export const DEFAULTS = {
  // 처음 방문(저장된 설정이 없을 때)의 코드 종류 (사용자 지정 2026-11-10): 7화음 전부, 6·m6, add9·madd9.
  // 3화음 전부(Major·minor도 2026-11-10에 뺌)·sus 코드·6(9)·m6(9)·텐션 코드는 꺼짐. 이미 저장된 기기의 설정은 그대로
  types: {
    M7: true, m7: true, dom7: true, "7sus4": true, aug7: true, dim7: true, m7b5: true, mM7: true, augM7: true,
    "6": true, m6: true,
    add9: true, madd9: true,
  },
  optB: false, bases: Array(12).fill(false), optC: false, cMax: 1, optD: false, optE: false,
  bars: "1", slash: true, adv: false,
};

/**
 * 코드 초견에서만 쓰는 출제 가중치 (엔진 TYPES의 w 대신 — 랜덤 코드 연습·코드 추론하기는 그대로).
 * 드물게 쓰는 코드는 따로 연습하고 싶을 때 그것만 골라 쓰면 되니, 섞어 낼 때는 거의 안 나오게 (사용자 결정 2026-11-10):
 *   mM7·aug7·augM7   처음 설정에서 세 코드 합 약 5% (원래 w 1.2·1·1 → 0.55·0.43·0.43)
 *   3화음            0.05~0.2 (Major·minor 0.2, dim 0.1, aug 0.05 — 원래 1·1·0.5·0.4) → 전체 선택해도 약 2%
 *   텐션 코드        전체 선택해도 합 10% 이하 (원래 0.63·0.42·0.7·0.525·0.77·0.7의 약 64%)
 * 측정(분수코드 켬 / 끔): 처음 설정 — 희귀 3종 5.1% / 6.9%. 코드 종류 전부 — 희귀 3종 4.1% / 5.5%, 3화음 1.6% / 2.1%, 텐션 코드 7.1% / 9.3%
 * (분수코드가 켜져 있으면 약 25%가 분수코드라 나머지 코드의 비율이 그만큼 줄어듦)
 */
export const WEIGHTS = {
  mM7: 0.55, aug7: 0.43, augM7: 0.43,
  maj: 0.2, min: 0.2, dim: 0.1, aug: 0.05,
  M9: 0.4, M13: 0.27, m9: 0.45, m11: 0.34, dom9: 0.5, dom13: 0.45,
};

/** 지금 설정 (다른 파일이 이 객체를 계속 참조하므로 새 객체로 바꾸지 말 것) */
export const S = structuredClone(DEFAULTS);
{
  const saved = store.getJSON(KEY);
  if (saved && typeof saved === "object") Object.assign(S, saved);
  if (!["0.5", "1", "2"].includes(S.bars)) S.bars = "1";
}
const save = () => store.setJSON(KEY, S);

// 출제 설정 묶음 (화면에 이 순서대로 — 랜덤 코드 연습과 같음)
const GROUPS = ["triad", "sus", "seventh", "sixth", "add", "tension"];
const allWhite = () => Engine.WHITE.every(i => S.bases[i]);

/** 출제 설정 카드 만들기 (한 번). 바뀐 설정은 이미 보이는 "다음 코드"가 아니라 그다음 코드부터 적용 — 페이지가 따로 할 일 없음 */
export function initSettings() {
  const tg = $("rTypeGroups");
  for (const g of GROUPS) {
    const types = Engine.TYPES.filter(x => x.group === g);
    const box = document.createElement("div");
    box.className = "group";
    box.innerHTML = `<div class="group-head"><h3 data-i18n="g_${g}"></h3><button class="linkbtn" type="button" data-group="${g}" data-i18n="groupAll"></button></div>` +
      `<div class="chips">${types.map(x => `<label class="chip"><input type="checkbox" id="r-type-${x.id}" data-type="${x.id}"><span>${chipHTML(x.name)}</span></label>`).join("")}</div>`;
    tg.appendChild(box);
  }
  applyI18n(tg);
  tg.addEventListener("change", e => { const id = e.target.dataset.type; if (id) { S.types[id] = e.target.checked; changed(); } });
  // 묶음의 [전체]: 모두 켜져 있으면 모두 끄고, 아니면 모두 켬
  tg.addEventListener("click", e => {
    const g = e.target.dataset.group; if (!g) return;
    const types = Engine.TYPES.filter(x => x.group === g);
    const allOn = types.every(x => S.types[x.id]);
    types.forEach(x => { S.types[x.id] = !allOn; });
    changed();
  });

  // 한 코드당 마디수
  for (const v of ["0.5", "1", "2"]) $("rBars" + v.replace(".", "")).onchange = () => { S.bars = v; changed(); };

  // 특정 베이스 12개
  $("rBases").innerHTML = Engine.PC_NAMES.map((n, i) => `<label class="chip"><input type="checkbox" id="r-base-${i}" data-base="${i}"><span>${n.replace("/", "<br>")}</span></label>`).join("");
  $("rBases").addEventListener("change", e => { const i = e.target.dataset.base; if (i != null) { S.bases[+i] = e.target.checked; changed(); } });
  $("rBasesAll").onclick = () => { S.bases = Array(12).fill(true); changed(); };
  $("rBasesNone").onclick = () => { S.bases = Array(12).fill(false); changed(); };
  $("rBasesWhite").onclick = () => { const on = !allWhite(); Engine.WHITE.forEach(i => { S.bases[i] = on; }); changed(); };

  $("rOptB").onchange = e => { S.optB = e.target.checked; changed(); };
  $("rOptC").onchange = e => { S.optC = e.target.checked; changed(); };
  $("rCMax1").onchange = () => { S.cMax = 1; changed(); };
  $("rCMax2").onchange = () => { S.cMax = 2; changed(); };
  $("rOptD").onchange = e => { S.optD = e.target.checked; changed(); };
  $("rOptE").onchange = e => { S.optE = e.target.checked; changed(); };
  $("rOptSlash").onchange = e => { S.slash = e.target.checked; changed(); };
  $("rAdvToggle").onclick = () => { S.adv = !S.adv; changed(); };
  syncSettingsUI();
}

function changed() { syncSettingsUI(); save(); }

/**
 * 출제 설정 공유 링크(common/share-settings.js)에 담을 값: S에 마디수를 켜짐/꺼짐 두 개로 더한 것
 * (링크의 옵션 글자는 켜짐/꺼짐만 담아서 — H ½마디, L 2마디, 둘 다 없으면 1마디)
 */
export const presetSource = () => ({ ...S, barsHalf: S.bars === "0.5", barsTwo: S.bars === "2" });

/**
 * 공유 링크의 [바꾸기]: 링크의 설정을 넣고(마디수는 barsHalf·barsTwo에서 되돌림) 화면·저장.
 * 템포·MIDI 소리 등 기기별 값은 그대로. 연주 중이면 이미 보이는 다음 코드 다음부터 적용(다른 설정 변경과 같음)
 */
export function applyPreset(p) {
  const { barsHalf, barsTwo, ...rest } = p;
  Object.assign(S, rest);
  S.bars = barsHalf ? "0.5" : barsTwo ? "2" : "1";
  if (S.optD || S.optE) S.adv = true;   // [심화] 옵션이 켜져 있으면 펼쳐서 보여 줌 (랜덤 코드 연습과 같음)
  changed();
}

/** S에 맞게 체크·펼침·경고를 다시 그림 (언어를 바꿀 때도) */
export function syncSettingsUI() {
  Engine.TYPES.forEach(x => { $("r-type-" + x.id).checked = !!S.types[x.id]; });
  S.bases.forEach((v, i) => { $("r-base-" + i).checked = v; });
  for (const v of ["0.5", "1", "2"]) $("rBars" + v.replace(".", "")).checked = S.bars === v;
  $("rOptB").checked = S.optB; $("rBasesBox").hidden = !S.optB;
  $("rBasesWhite").setAttribute("aria-pressed", String(allWhite()));
  $("rOptC").checked = S.optC; $("rCBox").hidden = !S.optC;
  $("rCMax1").checked = S.cMax !== 2; $("rCMax2").checked = S.cMax === 2;
  $("rOptD").checked = S.optD; $("rOptE").checked = S.optE;
  $("rOptSlash").checked = S.slash;
  $("rAdvToggle").setAttribute("aria-expanded", String(S.adv)); $("rAdvBox").hidden = !S.adv;
  // 출제할 수 없는 설정이면 경고 (랜덤 코드 연습과 같은 문구)
  const has7 = Engine.TYPES.some(x => x.seventh && S.types[x.id]);
  const err = !Engine.TYPES.some(x => S.types[x.id]) ? "noTypes" : S.optB && !S.bases.some(Boolean) ? "noBases" : S.optC && !has7 ? "warnC" : "";
  $("rSettingsWarn").textContent = err ? t(err) : "";
}
