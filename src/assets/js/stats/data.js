// ===== 통계 — 계산만 하는 함수들 (화면 없음) =====
// DB(practice_summary 등)가 보내 준 숫자를 화면에 그리기 좋게 묶고 정리해요.
// 순수 함수만 있어서 Node에서 바로 테스트해요 (tests/account.test.js).

/** 기간 설정에서 이 일수를 넘으면 날짜별 대신 월별로 보여줌 (supabase/schema.sql의 practice_summary도 같은 기준) */
export const MONTHLY_AFTER = 62;
/** 약점으로 꼽으려면 그 코드 종류·베이스·텐션을 이만큼은 풀어야 함 (몇 문제로 판단하지 않게) */
export const WEAK_MIN = 5;

const pad = n => String(n).padStart(2, "0");
/** 기기의 오늘 날짜 "YYYY-MM-DD" (기록은 시각 없이 날짜만 남겨요) */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "YYYY-MM-DD" ↔ Date. 시간대 때문에 날짜가 하루 밀리지 않도록 UTC 자정으로 다룸
export const parseDay = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (s, n) => fmt(new Date(parseDay(s).getTime() + n * 864e5));
/** 그 달의 1일에서 n달 뒤의 1일 */
export const monthAdd = (m, n) => { const d = parseDay(m); return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))); };

/**
 * 기간이 어디부터 어디까지인지.
 * @param range   "7d" | "30d" | "1y" | "custom"
 * @param today   오늘 "YYYY-MM-DD"
 * @param custom  기간 설정에서 고른 { from, to } (순서가 거꾸로여도 됨, 오늘 이후는 잘림)
 * @returns { from, to, monthly } — monthly면 그래프를 월별로
 */
export function period(range, today, custom) {
  if (range === "custom" && custom) {
    const [a, b] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
    const to = b < today ? b : today;
    return { from: a, to, monthly: (parseDay(to) - parseDay(a)) / 864e5 > MONTHLY_AFTER };
  }
  if (range === "1y") return { from: monthAdd(today.slice(0, 8) + "01", -11), to: today, monthly: true };
  return { from: addDays(today, range === "7d" ? -6 : -29), to: today, monthly: false };
}

/** 그래프 막대: 기간 안의 날(또는 달)마다 하나, 오래된 것부터, 연습이 없는 날도 0으로 넣음 */
export function buckets(range, today, rows, custom) {
  const by = new Map((rows || []).map(r => [String(r.d).slice(0, 10), r]));
  const out = [];
  const p = period(range, today, custom);
  const slot = key => { const r = by.get(key); out.push({ key, n: r ? r.n : 0, ok: r ? r.ok || 0 : 0 }); };
  if (p.monthly) for (let m = p.from.slice(0, 8) + "01"; m <= p.to; m = monthAdd(m, 1)) slot(m);
  else for (let k = p.from; k <= p.to; k = addDays(k, 1)) slot(k);
  return out;
}

// 여러 줄을 하나로 합칠 때: 평균 시간은 시간이 기록된 문제 수(t)만큼 비중을 둠
function addRow(g, r) {
  const tc = r.t || 0;
  if (tc) { g.ms = ((g.ms || 0) * g.t + r.ms * tc) / (g.t + tc); g.t += tc; }
  g.n += r.n; g.ok += r.ok;
}

/** 코드 종류 표: 출제 설정 목록과 같은 순서, 7alt는 7 바로 다음 */
export function qualityRows(rows, types) {
  const order = [];
  for (const t of types) { order.push(t.id); if (t.id === "dom7") order.push("7alt"); }
  return (rows || []).slice().sort((a, b) => order.indexOf(a.q) - order.indexOf(b.q));
}

// 근음 이름 → pc
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 };
/** 코드 이름 앞의 근음(C♯, D♭, E♯, F𝄪 …) → pc. 베이스 통계는 건반 기준으로 묶어요(C♯와 D♭은 한 줄) */
export function rootPc(name) {
  const m = /^([A-G])(𝄫|𝄪|♭|♯)?/u.exec(name || "");
  return m ? (((NAT[m[1]] + (ACC[m[2]] || 0)) % 12) + 12) % 12 : null;
}
/** 베이스 표: 건반(pc)마다 한 줄, C부터 */
export function rootRows(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const pc = rootPc(r.r);
    if (pc == null) continue;
    if (!by.has(pc)) by.set(pc, { pc, n: 0, ok: 0, ms: null, t: 0 });
    addRow(by.get(pc), r);
  }
  return [...by.values()].sort((a, b) => a.pc - b.pc);
}

/** DB의 chord_tensions()가 쓰는 텐션 이름, 표에 놓는 순서 */
export const TENSIONS = ["♭9", "9", "♯9", "11", "♯11", "♭13", "13", "♭5", "♯5", "alt"];
/** 텐션 코드는 원래 7화음 아래에 집계 (CM9 = CM7(9), F13 = F7(13), G7alt = G7의 alt) — 사용자 결정 2026-11-06 */
export const TENSION_BASE = { M9: "M7", M13: "M7", m9: "m7", m11: "m7", dom9: "dom7", dom13: "dom7", "7alt": "dom7" };
/** 텐션 표: 코드 종류 + 텐션마다 한 줄 (M7의 9와 m7의 9는 따로), 출제 설정 순서 → 텐션 순서 */
export function tensionRows(rows, types) {
  const by = new Map();
  for (const r of rows || []) {
    const q = TENSION_BASE[r.q] || r.q;
    const key = q + "|" + r.x;
    if (!by.has(key)) by.set(key, { q, x: r.x, n: 0, ok: 0, ms: null, t: 0 });
    addRow(by.get(key), r);
  }
  const ti = q => { const i = types.findIndex(t => t.id === q); return i < 0 ? 99 : i; };
  const xi = x => TENSIONS.indexOf(x) + 1 || 99;
  return [...by.values()].sort((a, b) => ti(a.q) - ti(b.q) || xi(a.x) - xi(b.x));
}

/** 평균 시간 글자: 1분 미만은 "12.3초"(unit이 단위를 붙임), 1분부터는 "1:05". 시간이 없으면 "" */
export function timeText(ms, unit) {
  if (ms == null) return "";
  if (ms < 60000) return unit((ms / 1000).toFixed(1));
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** 약점: 정답률이 가장 낮은 n개 (같으면 더 많이 푼 것 먼저). 충분히 풀지 않았거나 다 맞힌 줄은 뺌 */
export const weakest = (rows, n = 3) => rows.filter(r => r.n >= WEAK_MIN && r.ok < r.n)
  .sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n).slice(0, n);

/** 퍼센트 (0으로 나누면 0) */
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
