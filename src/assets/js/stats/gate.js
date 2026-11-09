// ===== 통계 페이지 입장 확인 =====
// 마이페이지는 로그인한 회원만, 선생님 페이지는 관리자만 볼 수 있어요.
// 화면에서 막는 것은 안내용이고, 실제 데이터는 DB가 막아요(다른 사람 기록은 RLS·함수가 거절).
import { Account } from "../account/account.js";
import { open as openAuth } from "../account/auth-dialog.js";
import { t } from "../i18n/index.js";
import { esc } from "../common/dom.js";
import { pageUrl, ROUTES } from "../common/sitemap.js";

/**
 * 지금 이 페이지를 보여줘도 되는지.
 * @param need  "member"(로그인한 회원) | "admin"(관리자)
 * @returns null(보여줘도 됨) 또는 대신 보여줄 안내 HTML
 */
export function gateHTML(need) {
  const box = (key, withLogin) => `<section class="st-card st-gate"><p class="st-empty">${esc(t(key))}</p>
    ${withLogin ? `<button class="btn primary" type="button" data-open-login>${esc(t("login"))}</button>` : ""}</section>`;
  if (!Account.configured) return box("needLogin", false);
  if (!Account.ready) return box("loading", false);
  if (!Account.user) return box("needLogin", true);
  if (!Account.profile) return box("loading", false);
  if (Account.profile.deleted_at) return box("needLogin", false);   // 탈퇴 유예 중: 복구 창이 따로 뜸
  if (need === "admin" && !Account.isAdmin()) return box("needAdmin", false);
  return null;
}

/** 안내 상자의 [로그인] 버튼 */
export function wireGate(root) {
  root.addEventListener("click", e => { if (e.target.closest("[data-open-login]")) openAuth("login"); });
}

/**
 * 로그아웃하면 홈으로 이동 (마이페이지·선생님 페이지 — 로그인해야 볼 수 있는 화면, 2026-11-09 사용자 요청).
 * 로그인 창이 열려 있으면 닫힐 때 이동: 탈퇴 신청 뒤의 "○일에 삭제돼요" 안내처럼 창에 남은 글을 읽을 수 있게.
 */
export function leaveOnSignOut() {
  Account.on("signedOut", () => {
    const go = () => { location.href = pageUrl(ROUTES.home); };
    const dlg = document.getElementById("authDlg");
    if (dlg && dlg.open) dlg.addEventListener("close", go, { once: true }); else go();
  });
}
