// ===== 통계 — 화면 조각 (마이페이지와 선생님 화면이 같이 씀) =====
// 각 함수는 HTML 문자열을 돌려주고, 페이지 JS가 그것을 이어 붙여 그려요.
// 사용자·DB에서 온 글자(닉네임, 코드 이름 등)는 모두 esc()를 거쳐요.
import { Engine } from "../core/engine.js";
import { t, locale } from "../i18n/index.js";
import { esc, chordHTML } from "../common/dom.js";
import { localDay, parseDay, addDays, monthAdd, period, buckets, qualityRows, rootRows, tensionRows, timeText, pct } from "./data.js";

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

// 결과 표 하나 (코드 종류 / 베이스 / 텐션). 평균 시간이 없는 줄은 빈칸
function tableHTML(head, rows, name) {
  if (!rows.length) return "";
  return `<div class="st-scroll-x"><table class="st-table">
    <thead><tr><th>${esc(head)}</th><th class="num">${esc(t("colCount"))}</th><th class="num">${esc(t("sCorrect"))}</th><th class="num">${esc(t("sWrong"))}</th><th>${esc(t("sRate"))}</th><th class="num">${esc(t("colTime"))}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td class="st-type">${chordHTML(name(r))}</td><td class="num">${r.n}</td><td class="num">${r.ok}</td><td class="num">${r.n - r.ok}</td>
      <td><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span><span class="st-rate-n">${pct(r.ok, r.n)}%</span></td>
      <td class="num">${r.t ? esc(sec(r.ms)) : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

/** 도움말(?) 버튼 — 마우스를 올리거나 누르면 설명 (동작은 common/layout.js) */
export const helpHTML = (labelKey, textKey) =>
  `<span class="help"><button class="help-btn" type="button" aria-expanded="false" aria-label="${esc(t(labelKey))}">?</button><span class="help-pop left" role="tooltip">${esc(t(textKey))}</span></span>`;

/** 세 가지 표: 코드 종류(텐션 제외), 베이스, 텐션 (선택한 기간) */
export function tablesHTML(data) {
  const parts = [
    ["byTypeH", tableHTML(t("colType"), qualityRows(data.byQuality, Engine.TYPES), r => typeName(r.q)), `<small>${esc(t("byTypeNote"))}</small>`],
    ["byRootH", tableHTML(t("colRoot"), rootRows(data.byRoot), r => rootName(r.pc)), ""],
    // 텐션을 어떻게 세는지는 ? 버튼 설명으로
    ["byTensionH", tableHTML(t("colTension"), tensionRows(data.byTension, Engine.TYPES), tensionName), helpHTML("tensionHelpLabel", "byTensionNote")],
  ].filter(p => p[1]);
  return parts.map(([h, table, extra]) => `<div class="st-part"><h4>${esc(t(h))} ${extra}</h4>${table}</div>`).join("");
}

/** 틀린 문제 목록 (●는 다시 풀기에서 처음 채점에 맞힌 횟수, 2번이면 목록에서 빠짐). withButton: 다시 풀기 버튼 */
export function reviewHTML(data, withButton) {
  const rv = data.review || [];
  const chips = rv.map(r => `<span class="st-chip" title="${esc(typeName(r.q))}">${chordHTML(r.symbol)}<i aria-hidden="true">${"●".repeat(r.hits)}${"○".repeat(Math.max(0, 2 - r.hits))}</i></span>`).join("");
  return `<section class="st-card"><div class="st-head"><h3>${esc(t("reviewH"))} <span class="st-count">${rv.length}</span></h3>
    ${withButton && rv.length ? `<button class="btn primary" type="button" id="statsReview">${esc(t("reviewStart"))}</button>` : ""}</div>
    ${rv.length ? `<p class="note">${esc(t("reviewNote"))}</p><div class="st-chips">${chips}</div>` : `<p class="st-empty">${esc(t("reviewEmpty"))}</p>`}</section>`;
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
