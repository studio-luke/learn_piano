// ===== 통계 — 화면 조각 (마이페이지와 선생님 화면이 같이 씀) =====
// 각 함수는 HTML 문자열을 돌려주고, 페이지 JS가 그것을 이어 붙여 그려요.
// 사용자·DB에서 온 글자(닉네임, 코드 이름 등)는 모두 esc()를 거쳐요.
import { Engine } from "../core/engine.js";
import { t, locale } from "../i18n/index.js";
import { esc, chordHTML } from "../common/dom.js";
import { localDay, parseDay, addDays, monthAdd, period, buckets, qualityRows, rootRows, tensionRows, timeText, pct, sortRows } from "./data.js";

/** "2026-11-05" → 현재 언어의 날짜 글자 (opts: toLocaleDateString 옵션) */
export const dateText = (d, opts) => parseDay(d).toLocaleDateString(locale(), { timeZone: "UTC", ...opts });
/** 평균 시간 글자 ("12.3초", "1:05") */
export const sec = ms => timeText(ms, n => t("unitSec", { n }));
/** 코드 종류 id → 보이는 이름 ("dom7" → "7") */
export const typeName = q => (q === "7alt" ? "7alt" : Engine.BY_ID[q] ? Engine.BY_ID[q].name : q);
/** 베이스 pc → 보이는 이름 (1 → "C♯/D♭") */
export const rootName = pc => Engine.PC_NAMES[pc];
/** 텐션 줄 이름: "M7(9)", "m7(♭5,9)", "7alt" */
export function tensionName(r) {
  const n = typeName(r.q);
  if (r.x === "alt") return n + "alt";
  return n.endsWith(")") ? `${n.slice(0, -1)},${r.x})` : `${n}(${r.x})`;
}

/** 숫자 카드 하나 */
export const card = (label, value, sub = "") =>
  `<div class="st-stat"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;

/** 전체 기간 숫자 카드들: 연습한 코드, 정답, 오답, 정답률, 최고 연속, 문제당 평균 시간 */
export function totalsHTML(data) {
  const tot = data.totals || { total: 0, first: 0, streak: 0, best: 0 };
  const tm = data.time || { ms: null, t: 0 };
  return `${card(t("sTotal"), tot.total)}${card(t("sCorrect"), tot.first)}${card(t("sWrong"), tot.total - tot.first)}
    ${card(t("sRate"), pct(tot.first, tot.total) + "%")}${card(t("sBest"), tot.best, t("sStreak", { n: tot.streak }))}
    ${card(t("sAvgTime"), tm.t ? esc(sec(tm.ms)) : "–", t("sTimed", { n: tm.t || 0 }))}`;
}

/** 연습량 막대그래프 (정답은 초록, 오답은 주황으로 쌓음). data.range / data.custom = 이 데이터를 불러온 기간 */
export function chartHTML(data) {
  const p = period(data.range, localDay(), data.custom);
  const b = buckets(data.range, localDay(), data.byDay, data.custom);
  if (!b.some(x => x.n)) return `<p class="st-empty">${esc(t("noData"))}</p>`;
  const max = Math.max(1, ...b.map(x => x.n));
  // 아래 날짜 글자는 7개(날짜별) 또는 12개(월별) 정도만, 가장 최근 막대부터 거꾸로 세어 붙임
  const every = Math.max(1, Math.ceil(b.length / (p.monthly ? 12 : 7)));
  const years = p.from.slice(0, 4) !== p.to.slice(0, 4);
  const label = (x, i) => {
    if ((b.length - 1 - i) % every) return "";
    if (p.monthly) return dateText(x.key, years && (i === 0 || x.key.slice(5, 7) === "01") ? { year: "2-digit", month: "short" } : { month: "short" });
    return dateText(x.key, { month: "numeric", day: "numeric" });
  };
  const tipDate = x => dateText(x.key, p.monthly ? { year: "numeric", month: "long" } : { year: years ? "numeric" : undefined, month: "long", day: "numeric" });
  const bars = b.map(x => `<div class="st-bar" title="${esc(t("chartTip", { date: tipDate(x), ok: x.ok, no: x.n - x.ok }))}">
    <i class="no" style="height:${((x.n - x.ok) / max) * 100}%"></i><i class="ok" style="height:${(x.ok / max) * 100}%"></i></div>`).join("");
  const xs = b.map((x, i) => `<span>${esc(label(x, i))}</span>`).join("");
  const legend = `<div class="legend"><span><i class="dot" style="background: var(--ok)"></i>${esc(t("sCorrect"))}</span><span><i class="dot" style="background: var(--warn)"></i>${esc(t("sWrong"))}</span></div>`;
  const dense = b.length > 14 ? " dense" : "";   // 막대가 많으면 간격을 좁힘
  return `<div class="st-chart-wrap"><span class="st-max">${max}</span><div class="st-chart${dense}">${bars}</div><div class="st-x${dense}">${xs}</div></div>${legend}`;
}

// ---------- 표 정렬 상태 (2026-11-09 사용자 요청, 계산은 data.js sortRows) ----------
// 표마다(type·root·tension) 따로 기억. 페이지에 있는 동안 기간·탭을 바꿔도 유지, 새로고침하면 기본으로.
// 같은 열을 누를 때마다: 숫자 열은 내림차순 → 오름차순 → 기본(정답률 낮은 순),
// 이름 열은 원래 순서(음악 순서) → 거꾸로 → 기본. 다른 열을 누르면 그 열의 첫 단계부터.
const sorts = {};   // 표 id → { key, dir } (없으면 기본)
function nextSort(cur, key) {
  const first = key === "name" ? "asc" : "desc";
  if (!cur || cur.key !== key) return { key, dir: first };
  if (cur.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}
/** 표 머리를 눌렀으면 정렬을 바꾸고 true (페이지가 다시 그림) */
export function sortClicked(e) {
  const b = e.target.closest("[data-sort]");
  if (!b) return false;
  const [id, key] = b.dataset.sort.split(":");
  const s = nextSort(sorts[id], key);
  if (s) sorts[id] = s; else delete sorts[id];
  return true;
}

// 지금 그려진 표의 줄 (표 id → { rows, name }) — 오답 숫자를 누르면 몇 번째 줄인지로 찾음
const shown = {};

// 결과 표 하나 (코드 종류 / 베이스 / 텐션). 평균 시간이 없는 줄은 빈칸. id = 정렬 상태를 기억할 이름
// 오답 숫자는 버튼: 누르면 그 줄의 오답 목록 창 (2026-11-09, wrongClicked·wrongDialog)
function tableHTML(id, head, rows, name) {
  if (!rows.length) return "";
  const s = sorts[id];
  rows = sortRows(rows, s);
  shown[id] = { rows, name };
  const wrongCell = (r, i) => r.n - r.ok
    ? `<button type="button" class="st-wrong-btn" data-wrong="${id}:${i}" title="${esc(t("wrongListTip"))}">${r.n - r.ok}</button>` : "0";
  // 열 머리 = 정렬 버튼. 지금 정렬한 열에 ▼(내림)·▲(오름), aria-sort로 화면 낭독기에도 알림
  const th = (key, label, cls = "") => {
    const on = s && s.key === key;
    const aria = on ? ` aria-sort="${s.dir === "asc" ? "ascending" : "descending"}"` : "";
    return `<th${cls ? ` class="${cls}"` : ""}${aria}><button type="button" class="st-sort${on ? " on" : ""}" data-sort="${id}:${key}">${esc(label)}<i aria-hidden="true">${on ? (s.dir === "asc" ? "▲" : "▼") : ""}</i></button></th>`;
  };
  return `<div class="st-scroll-x"><table class="st-table">
    <thead><tr>${th("name", head)}${th("n", t("colCount"), "num")}${th("ok", t("sCorrect"), "num")}${th("no", t("sWrong"), "num")}${th("rate", t("sRate"))}${th("time", t("colTime"), "num")}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="st-type">${chordHTML(name(r))}</td><td class="num">${r.n}</td><td class="num">${r.ok}</td><td class="num">${wrongCell(r, i)}</td>
      <td><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span><span class="st-rate-n">${pct(r.ok, r.n)}%</span></td>
      <td class="num">${r.t ? esc(sec(r.ms)) : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

// ---------- 입력한 답·오답 목록 (2026-11-09 사용자 요청) ----------
// DB practice_log.answer: null = 정답이거나 이 기능 전의 기록, "" = 제출하지 않은 오답(정답 확인·넘김·5분 무입력),
// 랜덤 코드 연습 = 누른 건반 MIDI 번호("48,52,55"), 코드 추론하기 = 입력한 글자.
const KEY_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];   // 건반 이름 (검은 건반은 흔한 쪽)
/** 입력한 답 칸 (학생이 친 글자라 반드시 esc) */
export function answerHTML(r) {
  if (r.answer == null) return r.first === false || r.first === undefined ? `<span class="st-dim" title="${esc(t("answerOld"))}">–</span>` : "";
  if (r.answer === "") return `<span class="st-dim">${esc(t("notSubmitted"))}</span>`;
  if (r.mode === "name") return `<span class="st-answer">${esc(r.answer)}</span>`;
  return `<span class="st-answer">${esc(r.answer.split(",").map(m => KEY_NAMES[+m % 12]).join(" "))}</span>`;
}

/** 오답 숫자를 눌렀으면 { title(줄 이름), filter(DB 조건) }, 아니면 null */
export function wrongClicked(e) {
  const b = e.target.closest("[data-wrong]");
  if (!b) return null;
  const [id, i] = b.dataset.wrong.split(":");
  const tb = shown[id], r = tb && tb.rows[+i];
  if (!r) return null;
  const filter = id === "type" ? { quals: [r.q] } : id === "root" ? { root: r.pc } : { quals: r.qs, tension: r.x };
  return { title: tb.name(r), filter };
}

/**
 * 오답 목록 창 (가운데 팝업 — 사용자 결정 2026-11-09). 열자마자 "불러오는 중", load()가 끝나면 목록.
 * 열: 날짜 | (전체 통계 탭이면) 연습 종류 | 문제 | 입력한 답. 다시 풀기·힌트 문제는 문제 옆 작은 표. 최근 50개까지.
 * @param w      wrongClicked의 결과
 * @param sub    제목 아래 작은 글자 (기간)
 * @param mode   지금 탭 "all" | "play" | "name"
 * @param load   () => Promise<{ data, error }> (Account.wrongAnswers)
 */
let wrongSeq = 0;
export async function wrongDialog(w, sub, mode, load) {
  let dlg = document.getElementById("wrongDlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "wrongDlg"; dlg.className = "st-dlg";
    document.body.appendChild(dlg);
    // 닫기 버튼 또는 창 바깥(뒤 배경)을 누르면 닫힘. Esc는 브라우저가 닫아 줌
    dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
  }
  const head = `<div class="st-dlg-head"><div><h3>${esc(t("wrongListH"))} · <span class="st-type">${chordHTML(w.title)}</span></h3><small>${esc(sub)}</small></div>
    <button type="button" class="icon-btn" data-close aria-label="${esc(t("close"))}">✕</button></div>`;
  dlg.innerHTML = `${head}<div class="st-dlg-body"><p class="st-empty">${esc(t("loading"))}</p></div>`;
  if (!dlg.open) dlg.showModal();
  const n = ++wrongSeq;
  const res = await load();
  if (n !== wrongSeq) return;   // 그사이 다른 줄을 눌렀음
  const body = dlg.querySelector(".st-dlg-body");
  if (res.error || !res.data) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
  const { total, items } = res.data;
  if (!items.length) { body.innerHTML = `<p class="st-empty">${esc(t("noData"))}</p>`; return; }
  const all = mode === "all";
  const rows = items.map(r => `<tr><td class="num st-dim">${esc(dateText(r.d, { month: "numeric", day: "numeric" }))}</td>
    ${all ? `<td class="st-dim st-nowrap">${esc(t(r.mode === "name" ? "tagName" : "tagPlay"))}</td>` : ""}
    <td class="st-type">${chordHTML(r.symbol)}${r.review ? ` <span class="st-tag">${esc(t("reviewTag"))}</span>` : ""}${r.hint ? ` <span class="st-tag">${esc(t("hintBtn"))}</span>` : ""}</td>
    <td>${answerHTML({ ...r, first: false })}</td></tr>`).join("");
  body.innerHTML = `${total > items.length ? `<p class="note">${esc(t("wrongListMore", { n: items.length, total }))}</p>` : ""}
    <div class="st-scroll"><table class="st-table"><thead><tr><th class="num">${esc(t("colDate"))}</th>${all ? `<th>${esc(t("colMode"))}</th>` : ""}<th>${esc(t("colQuestion"))}</th><th>${esc(t("colAnswer"))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/** 도움말(?) 버튼 — 마우스를 올리거나 누르면 설명 (동작은 common/layout.js) */
export const helpHTML = (labelKey, textKey) =>
  `<span class="help"><button class="help-btn" type="button" aria-expanded="false" aria-label="${esc(t(labelKey))}">?</button><span class="help-pop left" role="tooltip">${esc(t(textKey))}</span></span>`;

/** 세 가지 표: 코드 종류(텐션 제외), 베이스, 텐션 (선택한 기간) */
export function tablesHTML(data) {
  const parts = [
    ["byTypeH", tableHTML("type", t("colType"), qualityRows(data.byQuality, Engine.TYPES), r => typeName(r.q)), `<small>${esc(t("byTypeNote"))}</small>`],
    ["byRootH", tableHTML("root", t("colRoot"), rootRows(data.byRoot), r => rootName(r.pc)), ""],
    // 텐션을 어떻게 세는지는 ? 버튼 설명으로
    ["byTensionH", tableHTML("tension", t("colTension"), tensionRows(data.byTension, Engine.TYPES), tensionName), helpHTML("tensionHelpLabel", "byTensionNote")],
  ].filter(p => p[1]);
  return parts.map(([h, table, extra]) => `<div class="st-part"><h4>${esc(t(h))} ${extra}</h4>${table}</div>`).join("");
}

// ---------- 연습 탭 [전체 통계 | 랜덤 코드 연습 | 코드 추론하기] (4-3 2026-11-08, 전체 통계 2026-11-09) ----------
// 마이페이지·학생 목록·학생 기록이 함께 써요. 고른 탭은 주소 ?mode=play / ?mode=name에 남겨서 새로고침·뒤로 가기·링크 공유 때 그대로.
// 메뉴로 들어오면(주소에 mode가 없으면) 전체 통계부터. "play"·"name"은 DB practice_log.mode와 같은 값, "all"은 둘을 합친 것
export const MODES = ["all", "play", "name"];
/** 연습 이름 (탭 글자·틀린 문제 묶음 제목) */
export const modeName = m => t(m === "all" ? "statsAll" : m === "name" ? "navNameTrainer" : "navTrainer");
/** 주소의 ?mode → 지금 고른 연습 */
export const currentMode = () => { const m = new URLSearchParams(location.search).get("mode"); return m === "play" || m === "name" ? m : "all"; };
/** 고른 연습을 주소에 남김 (기록을 새로 쌓지 않고 지금 주소만 바꿈) */
export function setModeInUrl(mode) {
  const u = new URL(location.href);
  if (mode === "all") u.searchParams.delete("mode"); else u.searchParams.set("mode", mode);
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}
/** 탭 버튼 줄 */
export const modeTabsHTML = mode => `<div class="st-modes" role="tablist" aria-label="${esc(t("modeTabsAria"))}">${MODES.map(m =>
  `<button type="button" role="tab" class="st-mode" data-mode="${m}" aria-selected="${m === mode}">${esc(modeName(m))}</button>`).join("")}</div>`;
/** 탭을 눌렀으면 그 연습("all" | "play" | "name"), 아니면 null */
export const modeClicked = e => { const b = e.target.closest(".st-mode"); return b ? b.dataset.mode : null; };

/**
 * 틀린 문제 카드 (●는 다시 풀기에서 처음 채점에 맞힌 횟수, 2번이면 목록에서 빠짐).
 * 전체 통계 탭(mode "all")은 연습별로 나눠 보여주고 연습마다 [다시 풀기] (2026-11-09 사용자 결정).
 * withButton: [다시 풀기] 버튼 (마이페이지만) — 버튼의 data-review-mode = 이동할 연습
 */
export function reviewHTML(data, withButton, mode) {
  const rv = data.review || [];
  const chips = list => list.map(r => `<span class="st-chip" title="${esc(typeName(r.q))}">${chordHTML(r.symbol)}<i aria-hidden="true">${"●".repeat(r.hits)}${"○".repeat(Math.max(0, 2 - r.hits))}</i></span>`).join("");
  const button = m => `<button class="btn primary" type="button" data-review-mode="${m}">${esc(t("reviewStart"))}</button>`;
  let inner;
  if (!rv.length) inner = `<p class="st-empty">${esc(t("reviewEmpty"))}</p>`;
  else if (mode === "all") {
    inner = `<p class="note">${esc(t("reviewNote"))}</p>` + ["play", "name"].map(m => {
      const list = rv.filter(r => (r.mode || "play") === m);
      if (!list.length) return "";
      return `<div class="st-review-group"><div class="st-head"><h4>${esc(modeName(m))} <span class="st-count">${list.length}</span></h4>${withButton ? button(m) : ""}</div><div class="st-chips">${chips(list)}</div></div>`;
    }).join("");
  } else inner = `<p class="note">${esc(t("reviewNote"))}</p><div class="st-chips">${chips(rv)}</div>`;
  const headBtn = withButton && rv.length && mode !== "all" ? button(mode) : "";
  return `<section class="st-card"><div class="st-head"><h3>${esc(t("reviewH"))} <span class="st-count">${rv.length}</span></h3>${headBtn}</div>${inner}</section>`;
}

/**
 * 기간 고르기: [7일] [30일] [1년] [기간 설정] 버튼과, [기간 설정] 아래에 뜨는 작은 달력.
 * 달력에서 첫 번째로 누른 날 = 시작일, 두 번째 = 종료일. 첫 연습일 이전·오늘 이후는 고를 수 없음.
 * 날짜를 고르면 버튼 글자가 "10. 20. ~ 11. 3."처럼 그 기간으로 바뀌고, 7일·30일·1년을 누르면 "기간 설정"으로 돌아감.
 *
 * 쓰는 법: html(firstDay, practiceDays)로 그리고, 페이지의 click 이벤트를 click(e)에 넘겨요.
 *   click(e)의 결과: "load"(기간이 바뀜 → 다시 불러오기), "render"(달력만 바뀜 → 다시 그리기), null(상관없는 클릭)
 */
export class PeriodPicker {
  constructor() {
    this.range = "7d";      // "7d" | "30d" | "1y" | "custom"
    this.custom = null;     // { from, to } — range가 custom일 때
    this.cal = null;        // 달력이 열려 있으면 { month: 보이는 달의 1일, from: 고른 시작일(종료일을 기다리는 중) }
  }
  reset() { this.range = "7d"; this.custom = null; this.cal = null; }

  // [기간 설정] 버튼 글자
  label() {
    if (this.range !== "custom" || !this.custom) return t("rangecustom");
    const thisYear = localDay().slice(0, 4);
    const { from, to } = this.custom;
    const opts = from.slice(0, 4) !== thisYear || to.slice(0, 4) !== thisYear ? { year: "2-digit", month: "numeric", day: "numeric" } : { month: "numeric", day: "numeric" };
    return from === to ? dateText(from, opts) : `${dateText(from, opts)} ~ ${dateText(to, opts)}`;
  }

  /** 버튼들 + (열려 있으면) 달력. firstDay = 첫 연습일, practiceDays = 연습한 날 목록 (달력의 초록 점) */
  html(firstDay, practiceDays) {
    const btn = r => `<button type="button" class="chip-btn${r === "custom" ? " st-custom" : ""}" data-range="${r}" aria-pressed="${r === this.range}"${r === "custom" ? ` aria-expanded="${!!this.cal}" aria-haspopup="dialog"` : ""}>${esc(r === "custom" ? this.label() : t("range" + r))}</button>`;
    return `<div class="st-tabs" role="group">${["7d", "30d", "1y", "custom"].map(btn).join("")}${this.calHTML(firstDay, practiceDays)}</div>`;
  }

  calHTML(firstDay, practiceDays) {
    const cal = this.cal;
    if (!cal) return "";
    const min = firstDay ? String(firstDay).slice(0, 10) : localDay(), max = localDay();
    const m = parseDay(cal.month);
    const days = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
    // 강조할 범위: 시작일만 고른 상태면 그날, 아니면 지금 설정된 기간
    const sel = cal.from ? { from: cal.from, to: cal.from } : this.range === "custom" && this.custom ? this.custom : null;
    const practiced = new Set((practiceDays || []).map(d => String(d).slice(0, 10)));
    // 요일 머리글, 일요일부터 (2023-01-01이 일요일)
    const heads = Array.from({ length: 7 }, (_, i) => `<span>${esc(dateText(addDays("2023-01-01", i), { weekday: "narrow" }))}</span>`).join("");
    let cells = "<span></span>".repeat(m.getUTCDay());   // 1일 앞의 빈칸
    for (let d = 1; d <= days; d++) {
      const k = cal.month.slice(0, 8) + String(d).padStart(2, "0");
      const cls = [sel && k >= sel.from && k <= sel.to ? "in" : "", sel && (k === sel.from || k === sel.to) ? "end" : "",
        k === max ? "today" : "", practiced.has(k) ? "has" : ""].filter(Boolean).join(" ");
      const tip = practiced.has(k) ? ` title="${esc(t("calPracticed"))}"` : "";
      cells += `<button type="button" data-cal-day="${k}" class="${cls}"${tip}${k < min || k > max ? " disabled" : ""}>${d}</button>`;
    }
    const canPrev = cal.month > min.slice(0, 8) + "01", canNext = cal.month < max.slice(0, 8) + "01";
    return `<div class="st-cal" role="dialog" aria-label="${esc(t("rangecustom"))}">
      <div class="st-cal-head"><button type="button" class="icon-btn" data-cal-nav="-1" aria-label="${esc(t("calPrev"))}"${canPrev ? "" : " disabled"}>‹</button>
        <b>${esc(dateText(cal.month, { year: "numeric", month: "long" }))}</b>
        <button type="button" class="icon-btn" data-cal-nav="1" aria-label="${esc(t("calNext"))}"${canNext ? "" : " disabled"}>›</button></div>
      <div class="st-cal-grid st-cal-week">${heads}</div><div class="st-cal-grid">${cells}</div>
      <p class="st-cal-hint">${esc(t(cal.from ? "calPickEnd" : "calPickStart"))}</p>
      <p class="st-cal-legend"><i aria-hidden="true"></i>${esc(t("calPracticed"))}</p>
      <p class="note">${esc(t("periodNote", { date: dateText(min, { year: "numeric", month: "long", day: "numeric" }) }))}</p></div>`;
  }

  click(e) {
    const inCal = e.target.closest(".st-cal");
    const r = e.target.closest("[data-range]");
    let result = null;
    // 달력 밖을 누르면 달력을 닫음
    if (this.cal && !inCal && !(r && r.dataset.range === "custom")) { this.cal = null; result = "render"; }
    if (r) {
      if (r.dataset.range !== "custom") { this.range = r.dataset.range; this.custom = null; this.cal = null; return "load"; }
      // [기간 설정]: 달력을 열거나 닫음. 기간은 두 날짜를 다 고른 뒤에 바뀜
      if (this.cal) this.cal = null;
      else this.cal = { month: (this.range === "custom" && this.custom ? this.custom.to : localDay()).slice(0, 8) + "01", from: null };
      return "render";
    }
    const nav = e.target.closest("[data-cal-nav]");
    if (nav && this.cal) { this.cal.month = monthAdd(this.cal.month, +nav.dataset.calNav); return "render"; }
    const day = e.target.closest("[data-cal-day]");
    if (day && this.cal) {
      const k = day.dataset.calDay;
      if (!this.cal.from) { this.cal.from = k; return "render"; }
      this.custom = this.cal.from <= k ? { from: this.cal.from, to: k } : { from: k, to: this.cal.from };
      this.range = "custom"; this.cal = null;
      return "load";
    }
    return result;
  }
  /** Esc: 달력이 열려 있으면 달력만 닫고 true */
  escape() { if (!this.cal) return false; this.cal = null; return true; }
}
