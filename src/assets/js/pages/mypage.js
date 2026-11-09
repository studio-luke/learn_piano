// ===== 마이페이지 (mypage.html) =====
// 로그인한 학생이 자기 연습 통계를 봐요.
//   1. 전체 기간 숫자 (연습한 코드, 정답, 오답, 정답률, 최고 연속, 문제당 평균 시간)
//   2. 연습량 그래프 + 코드 종류·베이스·텐션 표 (7일 / 30일 / 1년 / 기간 설정)
//   3. 틀린 문제 목록 + [다시 풀기] (연습 페이지로 이동해 다시 풀기 모드 시작)
// 맨 위 탭 [전체 통계 | 랜덤 코드 연습 | 코드 추론하기]로 어느 연습의 통계를 볼지 골라요
// (4-3 2026-11-08, 전체 통계 2026-11-09 — 고른 탭은 주소 ?mode=play / ?mode=name, 없으면 전체).
// 표 머리를 누르면 정렬 (stats/view.js sortClicked). 로그아웃하면 홈으로 (2026-11-09 사용자 요청).
// 데이터는 DB 함수 practice_summary 하나로 받아요 (supabase/schema.sql, p_mode로 연습 구분 — 'all'은 합산).
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { hooks } from "../account/auth-dialog.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, esc } from "../common/dom.js";
import { PeriodPicker, totalsHTML, chartHTML, tablesHTML, reviewHTML, currentMode, setModeInUrl, modeTabsHTML, modeClicked, sortClicked, wrongClicked, wrongDialog } from "../stats/view.js";
import { gateHTML, wireGate, leaveOnSignOut } from "../stats/gate.js";

startPage({ title: "menuMy", back: true });

const body = $("statsBody");
const picker = new PeriodPicker();
let data = null;        // 마지막으로 받은 통계 (+ 그때의 기간 range/custom)
let loading = false;    // 새 기간을 불러오는 중 (기존 숫자를 흐리게 둔 채)
let failed = false;
let seq = 0;            // 요청 번호: 늦게 도착한 옛 응답을 버리려고
let mode = currentMode();   // 고른 연습 "all" | "play" | "name"

async function load() {
  loading = true; failed = false;
  render();
  const n = ++seq;
  const { range, custom } = picker;
  const res = await Account.summary(Account.user.id, range, custom, mode);
  if (n !== seq) return;   // 그사이 기간을 또 바꿈 → 이 응답은 버림
  loading = false;
  if (res.error) failed = true; else data = { ...res.data, range, custom };
  render();
}

function render() {
  const gate = gateHTML("member");
  if (gate) { body.innerHTML = gate; return; }
  if (failed) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
  if (!data) { body.innerHTML = `<p class="st-empty">${esc(t("loading"))}</p>`; return; }
  body.innerHTML = `${modeTabsHTML(mode)}
    <section class="st-card"><h3>${esc(t("sAllTime"))}</h3><div class="st-stats">${totalsHTML(data)}</div><p class="note">${esc(t("sCorrectNote"))}</p></section>
    <section class="st-card"><div class="st-head"><h3>${esc(t("byDayH"))}</h3>${picker.html(data.firstDay, data.practiceDays)}</div>
      ${chartHTML(data)}${tablesHTML(data)}</section>
    ${reviewHTML(data, true, mode)}`;
  body.classList.toggle("loading", loading);
}

wireGate(body);
body.addEventListener("click", e => {
  const action = picker.click(e);
  if (action === "load") return load();
  if (action === "render") return render();
  if (sortClicked(e)) return render();   // 표 머리: 정렬 바꾸기
  // 표의 오답 숫자: 그 줄의 오답 목록 창 (표와 같은 기간·탭 — 2026-11-09)
  const w = wrongClicked(e);
  if (w && data) {
    const d = data;
    return wrongDialog(w, d.range === "custom" ? picker.label() : t("range" + d.range), mode, () => Account.wrongAnswers(Account.user.id, d.range, d.custom, mode, w.filter));
  }
  const rb = e.target.closest("[data-review-mode]");
  if (rb) hooks.startReview(rb.dataset.reviewMode);   // 그 연습의 페이지로 이동해 다시 풀기
  const m = modeClicked(e);
  if (m && m !== mode) { mode = m; setModeInUrl(m); data = null; load(); }   // 탭을 바꿈: 기간은 그대로, 그 연습의 통계를 새로
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && picker.escape()) render(); });
onLangChange(render);

// 로그인 상태가 정해지면(또는 바뀌면) 처음 한 번 불러옴
Account.on("change", () => {
  if (!gateHTML("member") && !data && !loading) load(); else render();
});
leaveOnSignOut();   // 로그아웃하면 홈으로 (2026-11-09 사용자 요청)
render();
