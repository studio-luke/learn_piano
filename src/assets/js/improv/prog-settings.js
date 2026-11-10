// ===== 코드 초견 — 8마디 코드진행 모드의 출제 설정 =====
// 코드 종류·베이스는 고를 수 없고(전부), 아래 옵션만 (사용자 결정 2026-11-10 — 옵션 알파벳 A~E는 화면에 안 보임).
// 이 기기에만 저장(chordoven.improvProg.v1). 옵션을 바꿔도 지금 악보는 그대로, [새 코드진행]을 누를 때 적용.
//
// S의 항목
//   ten      A 텐션 허용 (처음 꺼짐)          tenMax  "1" | "2" | "hard" — 최대 1개 / 최대 2개 / HARD(텐션 코드도) (처음 "1")
//   slash    B 분수코드 출제 허용 (처음 켜짐)
//   count    C 코드 개수 0 최소 · 1 적정 · 2 최대 (처음 1)
//   level    D 코드 난이도 0 ~ 3 (처음 2) — 난이도별 코드진행은 6단계, 지금은 모두 완전 무작위
//   meters   E 다양한 박자표 허용 (처음 꺼짐)
import { $ } from "../common/dom.js";
import { t } from "../i18n/index.js";
import { store } from "../common/storage.js";

const KEY = "improvProg.v1";
export const DEFAULTS = { ten: false, tenMax: "1", slash: true, count: 1, level: 2, meters: false };
export const S = { ...DEFAULTS };
{
  const saved = store.getJSON(KEY);
  if (saved && typeof saved === "object") Object.assign(S, saved);
  if (!["1", "2", "hard"].includes(S.tenMax)) S.tenMax = "1";
  S.count = Math.min(2, Math.max(0, Math.round(+S.count) || 0));
  S.level = Math.min(3, Math.max(0, Math.round(+S.level) || 0));
}
const save = () => store.setJSON(KEY, S);

const COUNTS = ["low", "mid", "high"], LEVELS = ["low", "lowmid", "highmid", "high"];

/** 출제 설정 → 코드진행 만들기(improv/progression.js)에 넘길 옵션 */
export const progOptions = () => ({
  tension: S.ten ? S.tenMax : "off", slash: S.slash, count: COUNTS[S.count], level: LEVELS[S.level], meters: S.meters,
});

/** 출제 설정 카드 연결 (한 번) */
export function initProgSettings() {
  $("pTen").onchange = e => { S.ten = e.target.checked; changed(); };
  for (const v of ["1", "2", "hard"]) $("pTen" + v).onchange = () => { S.tenMax = v; changed(); };
  $("pSlash").onchange = e => { S.slash = e.target.checked; changed(); };
  $("pCount").oninput = e => { S.count = +e.target.value; changed(); };
  $("pLevel").oninput = e => { S.level = +e.target.value; changed(); };
  $("pMeters").onchange = e => { S.meters = e.target.checked; changed(); };
  syncProgUI();
}

function changed() { syncProgUI(); save(); }

/** S에 맞게 체크·슬라이더·안내 문구를 다시 그림 (언어를 바꿀 때도) */
export function syncProgUI() {
  $("pTen").checked = S.ten; $("pTenBox").hidden = !S.ten;
  for (const v of ["1", "2", "hard"]) $("pTen" + v).checked = S.tenMax === v;
  $("pSlash").checked = S.slash;
  $("pCount").value = S.count; $("pCountText").textContent = t("progCount" + S.count);
  $("pLevel").value = S.level; $("pLevelText").textContent = t("progLevel" + S.level);
  $("pMeters").checked = S.meters;
}
