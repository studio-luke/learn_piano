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
//   gen     "random" | "harmony" — 지금 탭(무작위 코드 / 화성 진행 연습, pages/improv.js setGen이 정함 — 2026-11-16 옵션에서 탭으로).
//           화성이면 아래 h… 옵션만 보임(코드 종류·출제 범위·[심화]는 숨김)
//   hStage  화성 범위 0 다이아토닉 · 1 세컨더리 도미넌트 · 2 SubV7 · 3 SDM · 4 Diminished · 5 모달 인터체인지 (누적, 기본 3) — grammar.js harmonyPhrase
//   hKeyFix 키 고정 (기본 꺼짐 — 2026-11-16 사용자 결정)   hRoot 키 이름(grammar.js KEY_NAMES 철자, 기본 "C")   hMinor 단조 (기본 장조)
//   hSlash  분수코드 출제 허용 (기본 켜짐)   hTen 텐션 허용 (기본 꺼짐)   hTenMax "1" | "2" | "hard"
//   hChance 코드 개연성 0 높음 · 1 중간 · 2 낮음 (기본 중간, [더보기] 안)   hMore [더보기] 펼침
//   hTenUp 텐션 비중 높이기 · hSlashUp 분수코드 비중 높이기 (기본 꺼짐, [더보기] 안 — 텐션·분수코드 허용이 켜져 있을 때만 효과, grammar.js H_TEN 등)
import { Engine } from "../core/engine.js";
import { KEY_NAMES } from "./grammar.js";
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
  gen: "random", hStage: 3, hKeyFix: false, hRoot: "C", hMinor: false, hSlash: true, hTen: false, hTenMax: "1", hChance: 1, hMore: false, hTenUp: false, hSlashUp: false,
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
const saved = store.getJSON(KEY);
/** 이 기기에 저장된 설정이 있었는지 (페이지를 열 때) — 출제 설정 공유 링크를 묻지 않고 적용할지 정할 때 씀 */
export const HAD_SAVED = !!(saved && typeof saved === "object");
{
  if (HAD_SAVED) Object.assign(S, saved);
  if (!["0.5", "1", "2"].includes(S.bars)) S.bars = "1";
  if (!["random", "harmony"].includes(S.gen)) S.gen = "random";
  S.hStage = Math.min(5, Math.max(0, Math.round(+S.hStage) || 0));
  S.hChance = Math.min(2, Math.max(0, Math.round(+S.hChance) || 0));
  if (!["1", "2", "hard"].includes(S.hTenMax)) S.hTenMax = "1";
  if (!KEY_NAMES[S.hMinor ? "minor" : "major"].includes(S.hRoot)) S.hRoot = sameRoot(S.hRoot, !!S.hMinor);
}
const save = () => store.setJSON(KEY, S);

/** 바꾼 설정 번호 — 화성 모드(random.js)가 만들어 둔 코드를 버릴지 정할 때 */
let ver = 0;
export const version = () => ver;

/** 화성 모드 옵션 → grammar.js harmonyPhrase */
export const harmonyOptions = () => ({
  stage: S.hStage, chance: S.hChance + 1, tension: S.hTen ? S.hTenMax : "off", slash: S.hSlash,
  tenUp: S.hTen && S.hTenUp, slashUp: S.hSlash && S.hSlashUp,
  key: S.hKeyFix ? { ...parseKeyName(S.hRoot), minor: S.hMinor, name: S.hRoot + (S.hMinor ? "m" : "") } : null,
});
const LETTERS = "CDEFGAB", NATURAL = [0, 2, 4, 5, 7, 9, 11];
const parseKeyName = n => ({ l: LETTERS.indexOf(n[0]), a: n.includes("♯") ? 1 : n.includes("♭") ? -1 : 0 });
const pcOfName = n => { const k = parseKeyName(n); return (NATURAL[k.l] + k.a + 12) % 12; };
/** Major ↔ minor를 바꿀 때 같은 근음(pc)의 그 조 철자 (D♭ → C♯, G♯ → A♭) — 없으면 C */
function sameRoot(name, minor) {
  const pc = name ? pcOfName(name) : 0;
  return KEY_NAMES[minor ? "minor" : "major"].find(n => pcOfName(n) === pc) || "C";
}
/** 드롭다운 순서: C부터 반음씩 */
const rootsInOrder = minor => [...KEY_NAMES[minor ? "minor" : "major"]].sort((a, b) => pcOfName(a) - pcOfName(b));

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

  // 코드 생성 방식 · 화성 모드 옵션
  $("rStage").oninput = e => { S.hStage = +e.target.value; changed(); };
  [...$("rStageLabels").children].forEach((el, i) => { el.onclick = () => { S.hStage = i; changed(); }; });
  $("rKeyFix").onchange = e => { S.hKeyFix = e.target.checked; changed(); };
  $("rKeyRoot").onchange = e => { S.hRoot = e.target.value; changed(); };
  $("rKeyMode").onclick = () => { S.hMinor = !S.hMinor; S.hRoot = sameRoot(S.hRoot, S.hMinor); changed(); };
  $("rHSlash").onchange = e => { S.hSlash = e.target.checked; changed(); };
  $("rHTen").onchange = e => { S.hTen = e.target.checked; changed(); };
  for (const v of ["1", "2", "hard"]) $("rHTen" + v).onchange = () => { S.hTenMax = v; changed(); };
  $("rHChance").oninput = e => { S.hChance = +e.target.value; changed(); };
  $("rHMoreToggle").onclick = () => { S.hMore = !S.hMore; changed(); };
  $("rHTenUp").onchange = e => { S.hTenUp = e.target.checked; changed(); };
  $("rHSlashUp").onchange = e => { S.hSlashUp = e.target.checked; changed(); };
  syncSettingsUI();
}

function changed() { ver++; syncSettingsUI(); save(); }

/** 탭을 바꿀 때 (pages/improv.js): 무작위 코드 "random" / 화성 진행 연습 "harmony" */
export function setGen(g) { if (S.gen !== g) { S.gen = g; changed(); } }

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
  // 무작위 코드 / 화성 진행 연습 탭: 아래 옵션 묶음을 바꿈 (공유 링크 버튼은 무작위 코드에서만 — 화성 진행 링크는 나중에)
  const harmony = S.gen === "harmony";
  $("rRandomBox").hidden = harmony; $("rHarmonyBox").hidden = !harmony;
  $("sheetRandom").classList.toggle("is-harmony", harmony);
  $("rStage").value = S.hStage;
  $("rStage").style.setProperty("--p", `calc(10px + (100% - 20px) * ${S.hStage / 5})`);   // 손잡이 가운데까지 채움 (--thumb 20px)
  [...$("rStageLabels").children].forEach((el, i) => { el.classList.toggle("on", i === S.hStage); el.classList.toggle("in", i <= S.hStage); });
  $("rKeyFix").checked = S.hKeyFix; $("rKeyBox").hidden = !S.hKeyFix;
  $("rKeyRoot").innerHTML = rootsInOrder(S.hMinor).map(n => `<option value="${n}"${n === S.hRoot ? " selected" : ""}>${n}</option>`).join("");
  $("rKeyMode").textContent = S.hMinor ? "minor" : "Major";
  $("rKeyMode").setAttribute("aria-pressed", String(S.hMinor));
  $("rHSlash").checked = S.hSlash;
  $("rHTen").checked = S.hTen; $("rHTenBox").hidden = !S.hTen;
  for (const v of ["1", "2", "hard"]) $("rHTen" + v).checked = S.hTenMax === v;
  $("rHChance").value = S.hChance;
  $("rHMoreToggle").setAttribute("aria-expanded", String(S.hMore)); $("rHMoreBox").hidden = !S.hMore;
  // 비중 높이기: 허용이 꺼져 있으면 회색으로 비활성 (체크 상태는 기억)
  $("rHTenUp").checked = S.hTenUp; $("rHTenUp").disabled = !S.hTen;
  $("rHSlashUp").checked = S.hSlashUp; $("rHSlashUp").disabled = !S.hSlash;
  // 출제할 수 없는 설정이면 경고 (랜덤 코드 연습과 같은 문구)
  const has7 = Engine.TYPES.some(x => x.seventh && S.types[x.id]);
  const err = !Engine.TYPES.some(x => S.types[x.id]) ? "noTypes" : S.optB && !S.bases.some(Boolean) ? "noBases" : S.optC && !has7 ? "warnC" : "";
  $("rSettingsWarn").textContent = err ? t(err) : "";
}
