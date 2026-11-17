// ===== 코드 초견 — 8마디 코드진행 모드의 출제 설정 =====
// 코드 종류·베이스는 고를 수 없고(전부), 아래 옵션만 (사용자 결정 2026-11-10 — 옵션 알파벳 A~E는 화면에 안 보임).
// 이 기기에만 저장(chordoven.improvProg.v1). 옵션을 바꿔도 지금 악보는 그대로, [새 코드진행]을 누를 때 적용.
//
// S의 항목
//   ten      A 텐션 허용 (처음 꺼짐)          tenMax  "1" | "2" | "hard" — 최대 1개 / 최대 2개 / HARD(텐션 코드도) (처음 "1")
//   slash    B 분수코드 출제 허용 (처음 켜짐)
//   count    C (한 마디 당) 코드 개수 0 1개 · 1 1~2개 · 2 2개 · 3 1~4개 (처음 1) — "2개"는 2026-11-15 추가
//   level    D 코드 진행 난이도 0 ~ 6 그대로 (처음 5 — 2026-11-17, 예전 2) — 2026-11-11 6칸(1~6), 2026-11-12 난이도 0 추가로 7칸. 지금은 0~3까지, 4~6은 3과 같게
//   v        저장 형식 3 = count 4칸 (2는 예전 "최대"라 3으로 옮김) · 2부터 level이 난이도 그대로 (예전 형식은 level 0~5 = 난이도 1~6이라 +1해서 옮김)
//   chance   코드 개연성 0 ~ 3 = 개연성 1~4 (처음 0 = 개연성 1 "높음" — 2026-11-17, 예전 1) — 1 대중적·클리셰 … 4 완전 무작위(비추천)
//   meters   E 다양한 박자표 허용 (처음 꺼짐)
import { $ } from "../common/dom.js";
import { t } from "../i18n/index.js";
import { store } from "../common/storage.js";

const KEY = "improvProg.v1";
export const DEFAULTS = { ten: false, tenMax: "1", slash: true, count: 1, level: 5, chance: 0, meters: false, v: 3 };
export const S = { ...DEFAULTS };
const saved = store.getJSON(KEY);
/** 이 기기에 저장된 8마디 설정이 있었는지 (공유 링크를 열었을 때 묻지 않고 바로 적용할지 — common/share-settings.js) */
export const HAD_SAVED = !!(saved && typeof saved === "object");
{
  if (HAD_SAVED) {
    Object.assign(S, saved);
    if (!(saved.v >= 2)) S.level = (Math.round(+saved.level) || 0) + 1;   // 난이도 0 추가 전에 저장한 값
    if (!(saved.v >= 3) && +saved.count === 2) S.count = 3;   // "2개" 추가 전의 "최대"
    S.v = 3;
  }
  if (!["1", "2", "hard"].includes(S.tenMax)) S.tenMax = "1";
  S.count = Math.min(3, Math.max(0, Math.round(+S.count) || 0));
  S.level = Math.min(6, Math.max(0, Math.round(+S.level) || 0));
  S.chance = Math.min(3, Math.max(0, Math.round(+S.chance) || 0));
}
const save = () => store.setJSON(KEY, S);

const COUNTS = ["low", "mid", "two", "high"];

/** 출제 설정 → 코드진행 만들기(improv/progression.js)에 넘길 옵션 */
export const progOptions = () => ({
  tension: S.ten ? S.tenMax : "off", slash: S.slash, count: COUNTS[S.count], level: S.level, chance: S.chance + 1, meters: S.meters,
});

/** 출제 설정 카드 연결 (한 번) */
export function initProgSettings() {
  $("pTen").onchange = e => { S.ten = e.target.checked; changed(); };
  for (const v of ["1", "2", "hard"]) $("pTen" + v).onchange = () => { S.tenMax = v; changed(); };
  $("pSlash").onchange = e => { S.slash = e.target.checked; changed(); };
  $("pCount").oninput = e => { S.count = +e.target.value; changed(); };
  $("pLevel").oninput = e => { S.level = +e.target.value; changed(); };
  $("pChance").oninput = e => { S.chance = +e.target.value; changed(); };
  $("pMeters").onchange = e => { S.meters = e.target.checked; changed(); };
  syncProgUI();
}

function changed() { syncProgUI(); save(); }

/** 공유 링크(?mode=prog&ppreset=…, common/preset.js decodeProg)의 설정을 넣고 화면·저장 */
export function applyProgPreset(p) { Object.assign(S, p); changed(); }

/** S에 맞게 체크·슬라이더·안내 문구를 다시 그림 (언어를 바꿀 때도) */
export function syncProgUI() {
  $("pTen").checked = S.ten; $("pTenBox").hidden = !S.ten;
  for (const v of ["1", "2", "hard"]) $("pTen" + v).checked = S.tenMax === v;
  $("pTenHardSub").hidden = S.tenMax !== "hard";   // HARD 설명은 HARD를 골랐을 때만
  $("pSlash").checked = S.slash;
  $("pCount").value = S.count;
  $("pLevel").value = S.level; $("pLevelText").textContent = t("progLevel" + S.level);
  $("pChance").value = S.chance;
  $("pMeters").checked = S.meters;
}
