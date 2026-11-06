// ===== 홈 (index.html) =====
// 학습 메뉴 카드를 sitemap.js의 "학습" 묶음으로 그려요. 준비 중인 기능은 흐리게, 누를 수 없게.
// 로그인했으면 소개 아래에 "내 연습 통계 보기" 링크를 보여줘요.
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { SITEMAP, pageUrl } from "../common/sitemap.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, esc } from "../common/dom.js";

startPage({ title: "homeTitle" });

function renderCards() {
  const learn = SITEMAP.find(g => g.group === "navLearn").items;
  $("homeCards").innerHTML = learn.map(it => {
    const body = `<span class="card-icon" aria-hidden="true">${it.icon || ""}</span>
      <span class="card-name">${esc(t(it.key))}</span>
      <span class="card-desc">${esc(t(it.key + "Desc"))}</span>
      <span class="card-foot">${esc(t(it.soon ? "navSoon" : "homeOpen"))}</span>`;
    return it.soon
      ? `<div class="card soon" aria-disabled="true">${body}</div>`
      : `<a class="card" href="${pageUrl(it.path)}">${body}</a>`;
  }).join("");
}

renderCards();
onLangChange(renderCards);
Account.on("change", () => { $("homeMy").hidden = !Account.user; });
