// ===== Practice statistics page (마이페이지 / 학생 통계) =====
// A full-screen dialog: a student's own stats, or for the admin the student list and any student's stats.
// Data comes from Account (practice_summary / student_list in supabase/schema.sql).
// The pure helpers (localDay, buckets, qualityRows) are exported for tests/account.test.js.
const StatsPage = (() => {
  const RANGES = ["7d", "30d", "1y"];
  const pad = n => String(n).padStart(2, "0");
  // the device's local date as YYYY-MM-DD (records are kept by date only)
  const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  // one slot per day (7d / 30d) or per month (1y), oldest first, empty slots included
  function buckets(range, today, rows) {
    const by = new Map((rows || []).map(r => [String(r.d).slice(0, 10), r]));
    const out = [];
    const end = parse(today);
    if (range === "1y") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
        const r = by.get(fmt(d));
        out.push({ key: fmt(d), n: r ? r.n : 0, ok: r ? r.ok : 0 });
      }
    } else {
      const days = range === "7d" ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end.getTime() - i * 864e5);
        const r = by.get(fmt(d));
        out.push({ key: fmt(d), n: r ? r.n : 0, ok: r ? r.ok : 0 });
      }
    }
    return out;
  }
  // chord-type rows in the order of the settings list; 7alt right after 7
  function qualityRows(rows, types) {
    const order = [];
    for (const t of types) { order.push(t.id); if (t.id === "dom7") order.push("7alt"); }
    return (rows || []).slice().sort((a, b) => order.indexOf(a.q) - order.indexOf(b.q));
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const $ = id => document.getElementById(id);
  let ctx, view = null, range = "7d", data = null, list = null, seq = 0;

  // ctx: { t, lang, api: Account, startReview }
  function init(c) {
    ctx = c;
    $("statsBack").onclick = () => (view && view.uid && view.fromList ? showList() : $("statsDlg").close());
    $("statsBody").addEventListener("click", e => {
      const r = e.target.closest("[data-range]");
      if (r) { range = r.dataset.range; return load(); }
      const s = e.target.closest("[data-student]");
      if (s) return showStudent(list.find(x => x.id === s.dataset.student), true);
      if (e.target.closest("#statsReview")) ctx.startReview();
    });
  }
  const tag = () => ({ ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" })[ctx.lang()] || "en-US";
  const typeName = q => (q === "7alt" ? "7alt" : Engine.BY_ID[q] ? Engine.BY_ID[q].name : q);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  function openDlg() { if (!$("statsDlg").open) $("statsDlg").showModal(); $("statsDlg").scrollTop = 0; }
  // own page
  function openMine(me) { view = { uid: me.id, name: me.nickname, self: true }; openDlg(); load(); }
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
  function showStudent(s, fromList) {
    if (!s) return;
    view = { uid: s.id, name: s.nickname, fullName: s.full_name, fromList };
    $("statsDlg").scrollTop = 0;
    load();
  }
  async function load() {
    data = null; view.error = false;
    render();
    const n = ++seq;
    const res = await ctx.api.summary(view.uid, range, localDay());
    if (n !== seq) return;   // a newer request (range or student changed) is on its way
    if (res.error) view.error = true; else data = res.data;
    render();
  }

  function render() {
    if (!view || !ctx) return;
    const t = ctx.t;
    $("statsTitle").textContent = view.list || view.fromList ? t("menuStudents") : t("menuMy");
    $("statsBack").textContent = view.fromList ? t("backStudents") : t("backPractice");
    const body = $("statsBody");
    if (view.error) { body.innerHTML = `<p class="st-empty">${esc(t("errLoad"))}</p>`; return; }
    if (view.list) { body.innerHTML = list ? studentsHTML() : `<p class="st-empty">${esc(t("loading"))}</p>`; return; }
    body.innerHTML = summaryHTML();
  }

  function studentsHTML() {
    const t = ctx.t;
    if (!list.length) return `<p class="st-empty">${esc(t("studentsEmpty"))}</p>`;
    const rows = list.map(s => `<tr>
      <td><button class="st-student" type="button" data-student="${esc(s.id)}"><b>${esc(s.nickname)}</b><span>${esc(s.full_name)}</span></button></td>
      <td class="num">${s.total}</td><td class="num">${pct(s.first_correct, s.total)}%</td>
      <td class="num">${s.last_day ? esc(new Date(parse(String(s.last_day))).toLocaleDateString(tag(), { timeZone: "UTC", month: "short", day: "numeric" })) : "–"}</td></tr>`).join("");
    return `<div class="st-card"><table class="st-table">
      <thead><tr><th>${esc(t("colStudent"))}</th><th class="num">${esc(t("sTotal"))}</th><th class="num">${esc(t("sRate"))}</th><th class="num">${esc(t("colLast"))}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function summaryHTML() {
    const t = ctx.t;
    const who = view.self ? "" : `<p class="st-who"><b>${esc(view.name)}</b>${view.fullName ? `<span>${esc(view.fullName)}</span>` : ""}</p>`;
    if (!data) return who + `<p class="st-empty">${esc(t("loading"))}</p>`;
    const tot = data.totals || { total: 0, first: 0, streak: 0, best: 0 };
    const card = (label, value, sub = "") => `<div class="st-stat"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
    const cards = `<section class="st-card"><h3>${esc(t("sAllTime"))}</h3><div class="st-stats">
      ${card(t("sTotal"), tot.total)}${card(t("sCorrect"), tot.first)}${card(t("sWrong"), tot.total - tot.first)}
      ${card(t("sRate"), pct(tot.first, tot.total) + "%")}${card(t("sBest"), tot.best, t("sStreak", { n: tot.streak }))}
      </div><p class="note">${esc(t("sCorrectNote"))}</p></section>`;

    const tabs = `<div class="st-tabs" role="group">${RANGES.map(r => `<button type="button" class="chip-btn" data-range="${r}" aria-pressed="${r === range}">${esc(t("range" + r))}</button>`).join("")}</div>`;
    const b = buckets(range, localDay(), data.byDay);
    const max = Math.max(1, ...b.map(x => x.n));
    const label = (x, i) => {
      const d = parse(x.key);
      if (range === "1y") return d.toLocaleDateString(tag(), { timeZone: "UTC", month: "short" });
      if (range === "30d" && (b.length - 1 - i) % 5) return "";
      return d.toLocaleDateString(tag(), { timeZone: "UTC", month: "numeric", day: "numeric" });
    };
    const tipDate = x => parse(x.key).toLocaleDateString(tag(), range === "1y" ? { timeZone: "UTC", year: "numeric", month: "long" } : { timeZone: "UTC", month: "long", day: "numeric" });
    const bars = b.map(x => `<div class="st-bar" title="${esc(t("chartTip", { date: tipDate(x), ok: x.ok, no: x.n - x.ok }))}">
      <i class="no" style="height:${((x.n - x.ok) / max) * 100}%"></i><i class="ok" style="height:${(x.ok / max) * 100}%"></i></div>`).join("");
    const xs = b.map((x, i) => `<span>${esc(label(x, i))}</span>`).join("");
    const legend = `<div class="legend"><span><i class="dot" style="background: var(--ok)"></i>${esc(t("sCorrect"))}</span><span><i class="dot" style="background: var(--warn)"></i>${esc(t("sWrong"))}</span></div>`;
    const chart = b.some(x => x.n)
      ? `<div class="st-chart-wrap"><span class="st-max">${max}</span><div class="st-chart r${range}">${bars}</div><div class="st-x r${range}">${xs}</div></div>${legend}`
      : `<p class="st-empty">${esc(t("noData"))}</p>`;

    const qs = qualityRows(data.byQuality, Engine.TYPES);
    const qtable = qs.length ? `<table class="st-table">
      <thead><tr><th>${esc(t("colType"))}</th><th class="num">${esc(t("colCount"))}</th><th class="num">${esc(t("sCorrect"))}</th><th class="num">${esc(t("sWrong"))}</th><th>${esc(t("sRate"))}</th></tr></thead>
      <tbody>${qs.map(r => `<tr><td class="st-type">${esc(typeName(r.q))}</td><td class="num">${r.n}</td><td class="num">${r.ok}</td><td class="num">${r.n - r.ok}</td>
        <td><span class="st-rate"><i style="width:${pct(r.ok, r.n)}%"></i></span><span class="st-rate-n">${pct(r.ok, r.n)}%</span></td></tr>`).join("")}</tbody></table>` : "";
    const period = `<section class="st-card"><div class="st-head"><h3>${esc(t("byDayH"))}</h3>${tabs}</div>${chart}
      ${qtable ? `<h3 class="st-sub">${esc(t("byTypeH"))}</h3>${qtable}` : ""}</section>`;

    const rv = data.review || [];
    const chips = rv.map(r => `<span class="st-chip" title="${esc(typeName(r.q))}">${esc(r.symbol)}<i aria-hidden="true">${"●".repeat(r.hits)}${"○".repeat(Math.max(0, 2 - r.hits))}</i></span>`).join("");
    const review = `<section class="st-card"><div class="st-head"><h3>${esc(t("reviewH"))} <span class="st-count">${rv.length}</span></h3>
      ${view.self && rv.length ? `<button class="btn primary" type="button" id="statsReview">${esc(t("reviewStart"))}</button>` : ""}</div>
      ${rv.length ? `<p class="note">${esc(t("reviewNote"))}</p><div class="st-chips">${chips}</div>` : `<p class="st-empty">${esc(t("reviewEmpty"))}</p>`}</section>`;
    return who + cards + period + review;
  }

  return { init, openMine, openStudents, refresh: render, close: () => $("statsDlg") && $("statsDlg").close(), localDay, buckets, qualityRows };
})();
if (typeof module !== "undefined") module.exports = StatsPage;
