// ===== 선생님 — 학생 기록 (teacher/student.html?id=학생ID) =====
// 관리자가 학생 한 명의 연습을 지도용으로 보는 화면. 학생 마이페이지와 같은 데이터를 쓰지만 배치가 달라요(사용자 요청).
//   1. 약점: 전체 기간, 정답률이 낮은 코드 종류·베이스·텐션 각 3개
//   2. 연습 습관: 연습한 날, 하루 평균, 최근 연습일, 가입일, 타이머 사용·중단, 최근 7일
//   3. 전체 기간 숫자
//   4. 연습량 그래프 + 코드 종류·베이스·텐션 표 (기간 선택)
//   5. 최근 푼 문제 50개 (날짜·(전체 탭이면 연습 종류)·코드·종류·결과·입력한 답·걸린 시간)
//   6. 틀린 문제 목록
// 맨 위 탭 [전체 통계 | 랜덤 코드 연습 | 코드 추론하기]로 어느 연습을 볼지 골라요 (4-3 2026-11-08, 전체 통계 2026-11-09 —
// 주소 ?mode=play / ?mode=name, 없으면 전체). 힌트를 쓴 문제는 최근 문제에 "힌트" 표, 전체 통계 탭에서는 날짜와 코드 사이에 "연습 종류" 열.
// 표 머리를 누르면 정렬 (stats/view.js sortClicked). 로그아웃하면 홈으로 (2026-11-09 사용자 요청).
// 데이터: practice_summary(기간별) + student_overview(이 화면 전용, 관리자만) — 둘 다 p_mode로 연습 구분.
import { startPage } from "../common/layout.js";
import { Account } from "../account/account.js";
import { errorKey } from "../account/helpers.js";
import { t, locale, onLangChange } from "../i18n/index.js";
import { $, esc, chordHTML } from "../common/dom.js";
import { PeriodPicker, totalsHTML, chartHTML, tablesHTML, reviewHTML, card, dateText, sec, typeName, rootName, tensionName, currentMode, setModeInUrl, modeTabsHTML, modeClicked, sortClicked, wrongClicked, wrongDialog, answerHTML } from "../stats/view.js";
import { localDay, buckets, rootRows, tensionRows, weakest, pct, WEAK_MIN } from "../stats/data.js";
import { Engine } from "../core/engine.js";
import { gateHTML, wireGate, leaveOnSignOut } from "../stats/gate.js";
import { checkName } from "../account/names.js";

startPage({ title: "studentPage", back: true });

const body = $("statsBody");
const uid = new URLSearchParams(location.search).get("id");
const picker = new PeriodPicker();
let data = null, ov = null, loading = false, failed = false, seq = 0;
let mode = currentMode();   // 고른 연습 "all" | "play" | "name"
let ovMode = null;          // ov가 어느 연습의 것인지 (탭을 바꾸면 새로 받되, 받는 동안은 예전 것을 흐리게 보여줌)
// 학생 성명 고치기 (2026-11-10 — 가입 뒤 성명은 관리자만, 나중에 선생님도): null = 보기, { value, err } = 고치는 중
let nameEdit = null;

async function load() {
  loading = true; failed = false;
  render();
  const n = ++seq;
  const { range, custom } = picker;
  // 학생 정보·약점·습관(ov)은 기간과 상관없어서 연습마다 한 번만 받음 (탭을 바꾸면 다시)
  const want = mode;
  const [res, ovRes] = await Promise.all([Account.summary(uid, range, custom, want), ov && ovMode === want ? { data: ov } : Account.overview(uid, want)]);
  if (n !== seq) return;
  loading = false;
  if (res.error || ovRes.error || !ovRes.data || !ovRes.data.nickname) failed = true;
  else { data = { ...res.data, range, custom }; ov = ovRes.data; ovMode = want; }
  render();
}

// 약점 목록 하나 (정답률이 낮은 순)
function weakList(rows, name) {
  const w = weakest(rows);
  if (!w.length) return `<p class="st-empty">${esc(t("weakNone"))}</p>`;
  return `<ol class="st-weak">${w.map(r => `<li><span class="st-weak-row"><b>${chordHTML(name(r))}</b><span class="st-rate-n">${pct(r.ok, r.n)}% · ${esc(t("unitQ", { n: r.n }))}</span></span><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span></li>`).join("")}</ol>`;
}

function render() {
  const gate = gateHTML("admin");
  if (gate) { body.innerHTML = gate; return; }
  if (!uid || failed) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
  if (!data) { body.innerHTML = `<p class="st-empty">${esc(t("loading"))}</p>`; return; }

  // 성명 옆: 흔하지 않은 이름을 학생이 직접 확인한 표시, [이름 수정]
  const nameTag = ov.name_confirmed ? `<span class="st-tag" title="${esc(t("nameConfirmedTip"))}">${esc(t("nameConfirmedTag"))}</span>` : "";
  const who = nameEdit
    ? `<div class="st-who"><b>${esc(ov.nickname)}</b><span class="st-name-edit"><input type="text" id="nameInput" maxlength="50" value="${esc(nameEdit.value)}" autocomplete="off">
        <button type="button" class="mini-btn" data-name="save">${esc(t("doSave"))}</button><button type="button" class="linkbtn" data-name="cancel">${esc(t("nameCancel"))}</button></span>
        ${nameEdit.err ? `<span class="st-name-err">${esc(t(nameEdit.err))}</span>` : ""}</div>`
    : `<p class="st-who"><b>${esc(ov.nickname)}</b><span>${esc(ov.full_name)}</span>${nameTag}<button type="button" class="linkbtn" data-name="edit">${esc(t("nameEdit"))}</button></p>`;
  const weak = `<section class="st-card"><h3>${esc(t("weakH"))}</h3>
    <div class="st-pair">
      <div><h4>${esc(t("weakTypes"))}</h4>${weakList(ov.byQuality || [], r => typeName(r.q))}</div>
      <div><h4>${esc(t("weakRoots"))}</h4>${weakList(rootRows(ov.byRoot), r => rootName(r.pc))}</div>
      <div><h4>${esc(t("weakTensions"))}</h4>${weakList(tensionRows(ov.byTension, Engine.TYPES), tensionName)}</div>
    </div>
    <p class="note">${esc(t("weakNote", { n: WEAK_MIN }))}</p></section>`;

  const total = data.totals ? data.totals.total : 0;
  const week = buckets("7d", localDay(), ov.week);
  const dots = week.map(x => `<span class="st-day${x.n ? " on" : ""}" title="${esc(dateText(x.key, { month: "long", day: "numeric" }))} · ${esc(t("unitQ", { n: x.n }))}">${esc(dateText(x.key, { weekday: "narrow" }))}</span>`).join("");
  const habit = `<section class="st-card"><h3>${esc(t("habitH"))}</h3><div class="st-stats st-small">
    ${card(t("habitDays"), esc(t("unitDays", { n: ov.days || 0 })))}
    ${card(t("habitAvg"), esc(t("unitQ", { n: ov.days ? Math.round(total / ov.days) : 0 })))}
    ${card(t("habitLast"), ov.lastDay ? esc(dateText(ov.lastDay, { month: "short", day: "numeric" })) : "–")}
    ${card(t("habitJoined"), ov.joined ? esc(new Date(ov.joined).toLocaleDateString(locale(), { year: "numeric", month: "numeric", day: "numeric" })) : "–")}
    ${card(t("habitTimer"), esc(t("unitTimes", { n: ov.sessions || 0 })), t("habitAbandoned", { n: ov.abandoned || 0 }))}
    </div><div class="st-week"><span>${esc(t("habitWeek"))}</span>${dots}</div></section>`;

  // 전체 통계 탭에서만 "연습 종류" 열 (두 연습이 섞여 있어서 — 2026-11-09 사용자 요청: 태그 대신 날짜와 코드 사이의 열로)
  const modeCol = mode === "all";
  const recentRows = (ov.recent || []).map(r => `<tr><td class="num st-dim">${esc(dateText(r.d, { month: "numeric", day: "numeric" }))}</td>
    ${modeCol ? `<td class="st-dim st-nowrap">${esc(t(r.mode === "name" ? "tagName" : "tagPlay"))}</td>` : ""}<td class="st-type">${chordHTML(r.symbol)}${r.review ? ` <span class="st-tag">${esc(t("reviewTag"))}</span>` : ""}${r.hint ? ` <span class="st-tag">${esc(t("hintBtn"))}</span>` : ""}</td><td class="st-dim">${chordHTML(typeName(r.q))}</td>
    <td><span class="st-res ${r.first ? "ok" : "no"}">${esc(t(r.first ? "sCorrect" : "sWrong"))}</span></td><td>${answerHTML(r)}</td>
    <td class="num st-dim">${r.ms != null ? esc(sec(r.ms)) : ""}</td></tr>`).join("");
  const recent = `<section class="st-card"><h3>${esc(t("recentH"))}</h3>${recentRows ? `<div class="st-scroll"><table class="st-table">
    <thead><tr><th class="num">${esc(t("colDate"))}</th>${modeCol ? `<th>${esc(t("colMode"))}</th>` : ""}<th>${esc(t("colChord"))}</th><th>${esc(t("colKind"))}</th><th>${esc(t("colResult"))}</th><th>${esc(t("colAnswer"))}</th><th class="num">${esc(t("colTook"))}</th></tr></thead>
    <tbody>${recentRows}</tbody></table></div>` : `<p class="st-empty">${esc(t("noData"))}</p>`}</section>`;

  const tables = tablesHTML(data);
  body.innerHTML = `${who}${modeTabsHTML(mode)}
    <div class="st-two st-top">${weak}${habit}</div>
    <section class="st-card st-line"><div class="st-stats">${totalsHTML(data)}</div></section>
    <section class="st-card"><div class="st-head"><h3>${esc(t("byDayH"))}</h3>${picker.html(data.firstDay, data.practiceDays)}</div>
      ${chartHTML(data)}${tables ? `<div class="st-two">${tables}</div>` : ""}</section>
    ${recent}${reviewHTML(data, false, mode)}`;
  body.classList.toggle("loading", loading);
}

// 성명 저장: 형식이 확실히 틀린 이름만 막음 (흔하지 않은 한글 이름은 선생님이 확인한 것이라 그대로 — DB도 같은 규칙)
async function saveName() {
  const r = checkName($("nameInput").value);
  if (r.level === "hard") { nameEdit = { value: $("nameInput").value, err: "errNameInvalid" }; render(); $("nameInput").focus(); return; }
  const { error } = await Account.setStudentName(uid, r.name);
  if (error) { nameEdit = { value: $("nameInput").value, err: errorKey(error) }; render(); return; }
  Object.assign(ov, { full_name: r.name, name_confirmed: false });
  nameEdit = null; render();
}

wireGate(body);
body.addEventListener("keydown", e => {
  if (e.target.id !== "nameInput") return;
  if (e.key === "Enter") { e.preventDefault(); saveName(); }
  if (e.key === "Escape") { e.stopPropagation(); nameEdit = null; render(); }
});
body.addEventListener("click", e => {
  const nb = e.target.closest("[data-name]");
  if (nb) {
    if (nb.dataset.name === "edit") { nameEdit = { value: ov.full_name, err: null }; render(); $("nameInput").select(); }
    else if (nb.dataset.name === "cancel") { nameEdit = null; render(); }
    else saveName();
    return;
  }
  const action = picker.click(e);
  if (action === "load") return load();
  if (action === "render") return render();
  if (sortClicked(e)) return render();   // 표 머리: 정렬 바꾸기
  // 표의 오답 숫자: 그 줄의 오답 목록 창 (표와 같은 기간·탭 — 2026-11-09)
  const w = wrongClicked(e);
  if (w && data) {
    const d = data;
    return wrongDialog(w, d.range === "custom" ? picker.label() : t("range" + d.range), mode, () => Account.wrongAnswers(uid, d.range, d.custom, mode, w.filter));
  }
  const m = modeClicked(e);
  if (m && m !== mode) { mode = m; setModeInUrl(m); load(); }   // 탭을 바꿈: 기간은 그대로, 그 연습의 기록을 새로
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && picker.escape()) render(); });
onLangChange(render);
Account.on("change", () => { if (!gateHTML("admin") && !data && !loading && uid) load(); else render(); });
leaveOnSignOut();   // 로그아웃하면 홈으로 (2026-11-09 사용자 요청)
render();
