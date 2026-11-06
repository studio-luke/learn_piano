// ===== Practice statistics pages =====
// One full-screen dialog with three screens:
//   마이페이지 — a student's own stats (and the retry button)
//   학생 목록 — the admin's student list
//   학생 기록 — the admin's view of one student: a teacher's layout (약점, 연습 습관, recent questions), not the 마이페이지
// Data comes from Account (practice_summary / student_overview / student_list in supabase/schema.sql).
// The pure helpers (localDay, period, buckets, qualityRows, rootPc, rootRows, weakest) are exported for tests/account.test.js.
const StatsPage = (() => {
  const RANGES = ["7d", "30d", "1y", "custom"];
  const MONTHLY_AFTER = 62;   // a custom range longer than this many days is shown per month (same rule in practice_summary)
  const WEAK_MIN = 5;   // a chord type / root needs this many questions before it can be called a weak spot
  const pad = n => String(n).padStart(2, "0");
  // the device's local date as YYYY-MM-DD (records are kept by date only)
  const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  const addDays = (s, n) => fmt(new Date(parse(s).getTime() + n * 864e5));
  // the dates a range covers: { from, to, monthly }. custom = { from, to } picked on the calendar
  function period(range, today, custom) {
    if (range === "custom" && custom) {
      const [a, b] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
      const to = b < today ? b : today;
      return { from: a, to, monthly: (parse(to) - parse(a)) / 864e5 > MONTHLY_AFTER };
    }
    if (range === "1y") { const e = parse(today); return { from: fmt(new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() - 11, 1))), to: today, monthly: true }; }
    return { from: addDays(today, range === "7d" ? -6 : -29), to: today, monthly: false };
  }
  // one slot per day, or per month for long ranges, oldest first, empty slots included
  function buckets(range, today, rows, custom) {
    const by = new Map((rows || []).map(r => [String(r.d).slice(0, 10), r]));
    const out = [];
    const p = period(range, today, custom);
    const slot = key => { const r = by.get(key); out.push({ key, n: r ? r.n : 0, ok: r ? r.ok || 0 : 0 }); };
    if (p.monthly) {
      const a = parse(p.from), b = parse(p.to);
      for (let d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1)); d <= b; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) slot(fmt(d));
    } else for (let k = p.from; k <= p.to; k = addDays(k, 1)) slot(k);
    return out;
  }
  // chord-type rows in the order of the settings list; 7alt right after 7
  function qualityRows(rows, types) {
    const order = [];
    for (const t of types) { order.push(t.id); if (t.id === "dom7") order.push("7alt"); }
    return (rows || []).slice().sort((a, b) => order.indexOf(a.q) - order.indexOf(b.q));
  }
  // root name as written (C♯, D♭, E♯, F𝄪 …) → pitch class; roots are grouped by key, as in the 출제 설정
  const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const ACC = { "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 };
  function rootPc(name) {
    const m = /^([A-G])(𝄫|𝄪|♭|♯)?/u.exec(name || "");
    return m ? (((NAT[m[1]] + (ACC[m[2]] || 0)) % 12) + 12) % 12 : null;
  }
  function rootRows(rows) {
    const by = new Map();
    for (const r of rows || []) {
      const pc = rootPc(r.r);
      if (pc == null) continue;
      const g = by.get(pc) || { pc, n: 0, ok: 0 };
      g.n += r.n; g.ok += r.ok; by.set(pc, g);
    }
    return [...by.values()].sort((a, b) => a.pc - b.pc);
  }
  // lowest first-try rate first (ties: the more practised one), only rows with enough questions
  const weakest = (rows, n = 3) => rows.filter(r => r.n >= WEAK_MIN && r.ok < r.n)
    .sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n).slice(0, n);

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const $ = id => document.getElementById(id);
  let ctx, view = null, range = "7d", custom = null, data = null, list = null, seq = 0;
  // 기간 설정 calendar popover: null when closed; month = first day of the month shown, from = start picked, waiting for the end
  let cal = null;

  // ctx: { t, lang, api: Account, startReview }
  function init(c) {
    ctx = c;
    $("statsBack").onclick = () => (view && view.teacher ? showList() : $("statsDlg").close());
    $("statsDlg").addEventListener("click", e => {
      const inCal = e.target.closest(".st-cal");
      const r = e.target.closest("[data-range]");
      // a click anywhere else closes the calendar
      if (cal && !inCal && !(r && r.dataset.range === "custom")) { cal = null; render(); }
      if (r) {
        if (r.dataset.range !== "custom") { range = r.dataset.range; custom = null; cal = null; return load(); }
        // 기간 설정 opens (or closes) the calendar; the range changes only once both dates are picked
        if (cal) cal = null;
        else {
          const shown = range === "custom" && custom ? custom.to : localDay();
          cal = { month: shown.slice(0, 8) + "01", from: null };
        }
        return render();
      }
      const nav = e.target.closest("[data-cal-nav]");
      if (nav) { cal.month = monthAdd(cal.month, +nav.dataset.calNav); return render(); }
      const day = e.target.closest("[data-cal-day]");
      if (day) {
        const k = day.dataset.calDay;
        if (!cal.from) { cal.from = k; return render(); }
        custom = cal.from <= k ? { from: cal.from, to: k } : { from: k, to: cal.from };
        range = "custom"; cal = null;
        return load();
      }
      const s = e.target.closest("[data-student]");
      if (s) return showStudent(list.find(x => x.id === s.dataset.student));
      if (e.target.closest("#statsReview")) ctx.startReview();
    });
    // Esc closes the calendar first, not the whole page
    $("statsDlg").addEventListener("cancel", e => { if (cal) { e.preventDefault(); cal = null; render(); } });
  }
  const monthAdd = (m, n) => { const d = parse(m); return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))); };
  const t = (k, v) => ctx.t(k, v);
  const tag = () => ({ ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" })[ctx.lang()] || "en-US";
  const typeName = q => (q === "7alt" ? "7alt" : Engine.BY_ID[q] ? Engine.BY_ID[q].name : q);
  const rootName = pc => Engine.PC_NAMES[pc];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const dateText = (d, opts) => parse(d).toLocaleDateString(tag(), { timeZone: "UTC", ...opts });

  function openDlg() { if (!$("statsDlg").open) $("statsDlg").showModal(); $("statsDlg").scrollTop = 0; }
  // own page
  function openMine(me) {
    view = { uid: me.id, name: me.nickname, self: true };
    data = null; cal = null;
    if (range === "custom") { range = "7d"; custom = null; }
    openDlg(); load();
  }
  // admin: student list
  function openStudents() { openDlg(); showList(); }
  async function showList() {
    view = { list: true }; data = null;
    render();
    const n = ++seq;
    const res = await ctx.api.students();
    if (n !== seq) return;
    list = res.error ? null : res.data;
    view.error = !!res.error;
    render();
  }
  function showStudent(s) {
    if (!s) return;
    view = { uid: s.id, name: s.nickname, fullName: s.full_name, teacher: true };
    data = null; custom = null; cal = null;
    if (range === "custom") range = "7d";
    $("statsDlg").scrollTop = 0;
    load();
  }
  async function load() {
    const keepOv = data && data.ov;   // the teacher's extra numbers do not depend on the range
    // the current numbers stay on screen (dimmed) until the new ones arrive, so the page does not jump
    view.error = false; view.loading = true;
    render();
    const n = ++seq;
    const [res, ov] = await Promise.all([
      ctx.api.summary(view.uid, range, localDay(), range === "custom" ? custom : null),
      view.teacher && !keepOv ? ctx.api.overview(view.uid, localDay()) : { data: keepOv },
    ]);
    if (n !== seq) return;   // a newer request (range or student changed) is on its way
    view.loading = false;
    if (res.error || ov.error) view.error = true;
    else data = { ...res.data, ov: ov.data, range, custom };
    render();
  }

  function render() {
    if (!view || !ctx) return;
    $("statsTitle").textContent = view.self ? t("menuMy") : t("menuStudents");
    $("statsBack").textContent = view.teacher ? t("backStudents") : t("backPractice");
    $("statsDlg").classList.toggle("teacher", !!view.teacher);
    const body = $("statsBody");
    const empty = key => `<p class="st-empty">${esc(t(key))}</p>`;
    if (view.error) body.innerHTML = empty("errLoad");
    else if (view.list) body.innerHTML = list ? studentsHTML() : empty("loading");
    else if (!data) body.innerHTML = (view.teacher ? whoHTML() : "") + empty("loading");
    else body.innerHTML = view.teacher ? teacherHTML() : mineHTML();
    body.classList.toggle("loading", !!view.loading && !!data);
  }

  // ---------- pieces ----------
  const card = (label, value, sub = "") => `<div class="st-stat"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  function totalsHTML() {
    const tot = data.totals || { total: 0, first: 0, streak: 0, best: 0 };
    return `${card(t("sTotal"), tot.total)}${card(t("sCorrect"), tot.first)}${card(t("sWrong"), tot.total - tot.first)}
      ${card(t("sRate"), pct(tot.first, tot.total) + "%")}${card(t("sBest"), tot.best, t("sStreak", { n: tot.streak }))}`;
  }
  // the 기간 설정 button shows the picked range once there is one
  function periodLabel() {
    if (range !== "custom" || !custom) return t("rangecustom");
    const thisYear = localDay().slice(0, 4);
    const opts = custom.from.slice(0, 4) !== thisYear || custom.to.slice(0, 4) !== thisYear ? { year: "2-digit", month: "numeric", day: "numeric" } : { month: "numeric", day: "numeric" };
    return custom.from === custom.to ? dateText(custom.from, opts) : `${dateText(custom.from, opts)} ~ ${dateText(custom.to, opts)}`;
  }
  const tabsHTML = () => `<div class="st-tabs" role="group">${RANGES.map(r => `<button type="button" class="chip-btn${r === "custom" ? " st-custom" : ""}" data-range="${r}" aria-pressed="${r === range}"${r === "custom" ? ` aria-expanded="${!!cal}" aria-haspopup="dialog"` : ""}>${esc(r === "custom" ? periodLabel() : t("range" + r))}</button>`).join("")}${calHTML()}</div>`;
  // small month calendar: first tap = start, second tap = end. Days before the first practice day or after today are off.
  function calHTML() {
    if (!cal) return "";
    const min = data && data.firstDay ? String(data.firstDay).slice(0, 10) : localDay(), max = localDay();
    const m = parse(cal.month);
    const days = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
    const sel = cal.from ? { from: cal.from, to: cal.from } : range === "custom" && custom ? custom : null;
    const practiced = new Set(((data && data.practiceDays) || []).map(d => String(d).slice(0, 10)));
    // weekday initials, Sunday first (2023-01-01 was a Sunday)
    const heads = Array.from({ length: 7 }, (_, i) => `<span>${esc(dateText(addDays("2023-01-01", i), { weekday: "narrow" }))}</span>`).join("");
    let cells = "<span></span>".repeat(m.getUTCDay());
    for (let d = 1; d <= days; d++) {
      const k = cal.month.slice(0, 8) + pad(d);
      const cls = [sel && k >= sel.from && k <= sel.to ? "in" : "", sel && (k === sel.from || k === sel.to) ? "end" : "", k === max ? "today" : "",
        practiced.has(k) ? "has" : ""].filter(Boolean).join(" ");
      // green dot = practised that day
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
  function chartHTML() {
    const p = period(data.range, localDay(), data.custom);
    const b = buckets(data.range, localDay(), data.byDay, data.custom);
    if (!b.some(x => x.n)) return `<p class="st-empty">${esc(t("noData"))}</p>`;
    const max = Math.max(1, ...b.map(x => x.n));
    // about 7 (days) or 12 (months) labels, counted back from the newest so the last bar is always labelled
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
    const dense = b.length > 14 ? " dense" : "";
    return `<div class="st-chart-wrap"><span class="st-max">${max}</span><div class="st-chart${dense}">${bars}</div><div class="st-x${dense}">${xs}</div></div>${legend}`;
  }
  // results table: one row per chord type or root
  function tableHTML(head, rows, name) {
    if (!rows.length) return "";
    return `<table class="st-table">
      <thead><tr><th>${esc(head)}</th><th class="num">${esc(t("colCount"))}</th><th class="num">${esc(t("sCorrect"))}</th><th class="num">${esc(t("sWrong"))}</th><th>${esc(t("sRate"))}</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="st-type">${esc(name(r))}</td><td class="num">${r.n}</td><td class="num">${r.ok}</td><td class="num">${r.n - r.ok}</td>
        <td><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span><span class="st-rate-n">${pct(r.ok, r.n)}%</span></td></tr>`).join("")}</tbody></table>`;
  }
  const typeTable = () => tableHTML(t("colType"), qualityRows(data.byQuality, Engine.TYPES), r => typeName(r.q));
  const rootTable = () => tableHTML(t("colRoot"), rootRows(data.byRoot), r => rootName(r.pc));
  function reviewHTML(withButton) {
    const rv = data.review || [];
    const chips = rv.map(r => `<span class="st-chip" title="${esc(typeName(r.q))}">${esc(r.symbol)}<i aria-hidden="true">${"●".repeat(r.hits)}${"○".repeat(Math.max(0, 2 - r.hits))}</i></span>`).join("");
    return `<section class="st-card"><div class="st-head"><h3>${esc(t("reviewH"))} <span class="st-count">${rv.length}</span></h3>
      ${withButton && rv.length ? `<button class="btn primary" type="button" id="statsReview">${esc(t("reviewStart"))}</button>` : ""}</div>
      ${rv.length ? `<p class="note">${esc(t("reviewNote"))}</p><div class="st-chips">${chips}</div>` : `<p class="st-empty">${esc(t("reviewEmpty"))}</p>`}</section>`;
  }

  // ---------- 마이페이지 ----------
  function mineHTML() {
    const type = typeTable(), root = rootTable();
    return `<section class="st-card"><h3>${esc(t("sAllTime"))}</h3><div class="st-stats">${totalsHTML()}</div><p class="note">${esc(t("sCorrectNote"))}</p></section>
      <section class="st-card"><div class="st-head"><h3>${esc(t("byDayH"))}</h3>${tabsHTML()}</div>${chartHTML()}
        ${type ? `<h3 class="st-sub">${esc(t("byTypeH"))}</h3>${type}` : ""}
        ${root ? `<h3 class="st-sub">${esc(t("byRootH"))}</h3>${root}` : ""}</section>
      ${reviewHTML(true)}`;
  }

  // ---------- 학생 목록 ----------
  function studentsHTML() {
    if (!list.length) return `<p class="st-empty">${esc(t("studentsEmpty"))}</p>`;
    const rows = list.map(s => `<tr>
      <td><button class="st-student" type="button" data-student="${esc(s.id)}"><b>${esc(s.nickname)}</b><span>${esc(s.full_name)}</span></button></td>
      <td class="num">${s.total}</td><td class="num">${pct(s.first_correct, s.total)}%</td>
      <td class="num">${s.last_day ? esc(dateText(s.last_day, { month: "short", day: "numeric" })) : "–"}</td></tr>`).join("");
    return `<div class="st-card"><table class="st-table">
      <thead><tr><th>${esc(t("colStudent"))}</th><th class="num">${esc(t("sTotal"))}</th><th class="num">${esc(t("sRate"))}</th><th class="num">${esc(t("colLast"))}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  // ---------- 학생 기록 (teacher's view) ----------
  const whoHTML = () => `<p class="st-who"><b>${esc(view.name)}</b>${view.fullName ? `<span>${esc(view.fullName)}</span>` : ""}</p>`;
  function teacherHTML() {
    const ov = data.ov || {};
    const tot = data.totals || { total: 0 };
    // 약점: all-time results, lowest first-try rate
    const weakList = (rows, name) => {
      const w = weakest(rows);
      if (!w.length) return `<p class="st-empty">${esc(t("weakNone"))}</p>`;
      return `<ol class="st-weak">${w.map(r => `<li><span class="st-weak-row"><b>${esc(name(r))}</b><span class="st-rate-n">${pct(r.ok, r.n)}% · ${esc(t("unitQ", { n: r.n }))}</span></span><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span></li>`).join("")}</ol>`;
    };
    const weak = `<section class="st-card"><h3>${esc(t("weakH"))}</h3>
      <div class="st-pair"><div><h4>${esc(t("weakTypes"))}</h4>${weakList(ov.byQuality || [], r => typeName(r.q))}</div>
      <div><h4>${esc(t("weakRoots"))}</h4>${weakList(rootRows(ov.byRoot), r => rootName(r.pc))}</div></div>
      <p class="note">${esc(t("weakNote", { n: WEAK_MIN }))}</p></section>`;
    // 연습 습관
    const week = buckets("7d", localDay(), ov.week);
    const dots = week.map(x => `<span class="st-day${x.n ? " on" : ""}" title="${esc(dateText(x.key, { month: "long", day: "numeric" }))} · ${esc(t("unitQ", { n: x.n }))}">${esc(dateText(x.key, { weekday: "narrow" }))}</span>`).join("");
    const habit = `<section class="st-card"><h3>${esc(t("habitH"))}</h3><div class="st-stats st-small">
      ${card(t("habitDays"), esc(t("unitDays", { n: ov.days || 0 })))}
      ${card(t("habitAvg"), esc(t("unitQ", { n: ov.days ? Math.round(tot.total / ov.days) : 0 })))}
      ${card(t("habitLast"), ov.lastDay ? esc(dateText(ov.lastDay, { month: "short", day: "numeric" })) : "–")}
      ${card(t("habitJoined"), ov.joined ? esc(new Date(ov.joined).toLocaleDateString(tag(), { year: "numeric", month: "numeric", day: "numeric" })) : "–")}
      </div><div class="st-week"><span>${esc(t("habitWeek"))}</span>${dots}</div></section>`;
    // 최근 푼 문제
    const recent = (ov.recent || []).map(r => `<tr><td class="num st-dim">${esc(dateText(r.d, { month: "numeric", day: "numeric" }))}</td>
      <td class="st-type">${esc(r.symbol)}${r.review ? ` <span class="st-tag">${esc(t("reviewTag"))}</span>` : ""}</td><td class="st-dim">${esc(typeName(r.q))}</td>
      <td><span class="st-res ${r.first ? "ok" : "no"}">${esc(t(r.first ? "sCorrect" : "sWrong"))}</span></td></tr>`).join("");
    const recentCard = `<section class="st-card"><h3>${esc(t("recentH"))}</h3>${recent ? `<div class="st-scroll"><table class="st-table">
      <thead><tr><th class="num">${esc(t("colDate"))}</th><th>${esc(t("colChord"))}</th><th>${esc(t("colKind"))}</th><th>${esc(t("colResult"))}</th></tr></thead>
      <tbody>${recent}</tbody></table></div>` : `<p class="st-empty">${esc(t("noData"))}</p>`}</section>`;
    const type = typeTable(), root = rootTable();
    const detail = `<section class="st-card"><div class="st-head"><h3>${esc(t("byDayH"))}</h3>${tabsHTML()}</div>${chartHTML()}
      ${type || root ? `<div class="st-two">${type ? `<div><h4>${esc(t("byTypeH"))}</h4>${type}</div>` : ""}${root ? `<div><h4>${esc(t("byRootH"))}</h4>${root}</div>` : ""}</div>` : ""}</section>`;
    return `${whoHTML()}<div class="st-two st-top">${weak}${habit}</div>
      <section class="st-card st-line"><div class="st-stats">${totalsHTML()}</div></section>
      ${detail}${recentCard}${reviewHTML(false)}`;
  }

  return { init, openMine, openStudents, refresh: render, close: () => $("statsDlg") && $("statsDlg").close(),
    localDay, period, buckets, qualityRows, rootPc, rootRows, weakest };
})();
if (typeof module !== "undefined") module.exports = StatsPage;
