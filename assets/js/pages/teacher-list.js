// ===== 선생님 — 학생 목록 (teacher/index.html) =====
// 관리자만 볼 수 있어요. 학생 이름을 누르면 학생 기록 페이지(teacher/student.html?id=…)로 가요.
// 데이터: DB 함수 student_list (관리자가 아니면 빈 목록을 돌려줌).
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { t, onLangChange } from "../i18n/index.js";
import { $, esc } from "../common/dom.js";
import { dateText } from "../stats/view.js";
import { pct } from "../stats/data.js";
import { gateHTML, wireGate } from "../stats/gate.js";

startPage({ title: "menuStudents", back: true });

const body = $("statsBody");
let list = null, failed = false, loading = false;

async function load() {
  loading = true;
  const res = await Account.students();
  loading = false;
  if (res.error) failed = true; else list = res.data;
  render();
}

function render() {
  const gate = gateHTML("admin");
  if (gate) { body.innerHTML = gate; return; }
  if (failed) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
  if (!list) { body.innerHTML = `<p class="st-empty">${esc(t("loading"))}</p>`; return; }
  if (!list.length) { body.innerHTML = `<p class="st-empty">${esc(t("studentsEmpty"))}</p>`; return; }
  const rows = list.map(s => `<tr>
    <td><a class="st-student" href="student.html?id=${encodeURIComponent(s.id)}"><b>${esc(s.nickname)}</b><span>${esc(s.full_name)}</span></a></td>
    <td class="num">${s.total}</td><td class="num">${pct(s.first_correct, s.total)}%</td>
    <td class="num">${s.last_day ? esc(dateText(s.last_day, { month: "short", day: "numeric" })) : "–"}</td></tr>`).join("");
  body.innerHTML = `<section class="st-card"><table class="st-table">
    <thead><tr><th>${esc(t("colStudent"))}</th><th class="num">${esc(t("sTotal"))}</th><th class="num">${esc(t("sRate"))}</th><th class="num">${esc(t("colLast"))}</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`;
}

wireGate(body);
onLangChange(render);
Account.on("change", () => { if (!gateHTML("admin") && !list && !loading) load(); else render(); });
render();
