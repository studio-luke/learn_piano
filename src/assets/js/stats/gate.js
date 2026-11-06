// ===== 통계 페이지 입장 확인 =====
// 마이페이지는 로그인한 회원만, 선생님 페이지는 관리자만 볼 수 있어요.
// 화면에서 막는 것은 안내용이고, 실제 데이터는 DB가 막아요(다른 사람 기록은 RLS·함수가 거절).
import { Account } from "../account/account.js";
import { open as openAuth } from "../account/auth-dialog.js";
import { t } from "../i18n/index.js";
import { esc } from "../common/dom.js";

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
