// ===== 선생님 — 학생 목록 (teacher/index.html) =====
// 관리자만 볼 수 있어요. 학생 이름을 누르면 학생 기록 페이지(teacher/student.html?id=…)로 가요.
// 맨 위 탭으로 어느 연습의 숫자를 볼지 골라요 (4-3, 2026-11-08). 학생을 누르면 같은 탭이 열린 채 학생 기록으로.
// 데이터: DB 함수 student_list(p_mode) (관리자가 아니면 빈 목록을 돌려줌).
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, esc } from "../common/dom.js";
import { dateText, currentMode, setModeInUrl, modeTabsHTML, modeClicked } from "../stats/view.js";
import { pct } from "../stats/data.js";
import { gateHTML, wireGate } from "../stats/gate.js";

startPage({ title: "menuStudents", back: true });

const body = $("statsBody");
let list = null, failed = false, loading = false, seq = 0;
let mode = currentMode();   // 고른 연습 "play" | "name"

async function load() {
  loading = true;
  const n = ++seq;
  const res = await Account.students(mode);
  if (n !== seq) return;   // 그사이 탭을 바꿈 → 이 응답은 버림
  loading = false;
  if (res.error) failed = true; else list = res.data;
  render();
}

function render() {
  const gate = gateHTML("admin");
  if (gate) { body.innerHTML = gate; return; }
  if (failed) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
  const tabs = modeTabsHTML(mode);
  if (!list) { body.innerHTML = `${tabs}<p class="st-empty">${esc(t("loading"))}</p>`; return; }
  if (!list.length) { body.innerHTML = `${tabs}<p class="st-empty">${esc(t("studentsEmpty"))}</p>`; return; }
  const q = mode === "name" ? "&mode=name" : "";
  const rows = list.map(s => `<tr>
    <td><a class="st-student" href="student?id=${encodeURIComponent(s.id)}${q}"><b>${esc(s.nickname)}</b><span>${esc(s.full_name)}</span></a></td>
    <td class="num">${s.total}</td><td class="num">${pct(s.first_correct, s.total)}%</td>
    <td class="num">${s.last_day ? esc(dateText(s.last_day, { month: "short", day: "numeric" })) : "–"}</td></tr>`).join("");
  body.innerHTML = `${tabs}<section class="st-card"><table class="st-table">
    <thead><tr><th>${esc(t("colStudent"))}</th><th class="num">${esc(t("sTotal"))}</th><th class="num">${esc(t("sRate"))}</th><th class="num">${esc(t("colLast"))}</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`;
}

wireGate(body);
body.addEventListener("click", e => {
  const m = modeClicked(e);
  if (m && m !== mode) { mode = m; setModeInUrl(m); list = null; render(); load(); }
});
onLangChange(render);
Account.on("change", () => { if (!gateHTML("admin") && !list && !loading) load(); else render(); });
render();
