// ===== About Us (about.html) =====
// 소개 문구는 HTML의 data-i18n이 채우고, 여기서는 이메일 복사 버튼만 연결해요.
import { startPage } from "../common/layout.js";
import { t } from "../i18n/index.js";
import { $ } from "../common/dom.js";

startPage({ title: "navAbout" });

// 이메일 복사: 클립보드를 못 쓰면 주소를 선택해 두어 직접 복사하게
$("aboutCopy").onclick = () => {
  const btn = $("aboutCopy"), mail = $("aboutMail");
  const done = () => { btn.textContent = t("copied"); setTimeout(() => { btn.textContent = t("copy"); }, 1500); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(mail); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  try { navigator.clipboard.writeText(mail.textContent).then(done, fallback); } catch (err) { fallback(); }
};
