// ===== 가짜 supabase-js (화면 확인용) — npm run dev:stub 이 모든 페이지에 끼워 넣음 =====
// 진짜 Supabase 없이 "로그인한 상태"의 화면(마이페이지·선생님 화면·타이머 기록·다시 풀기)을 확인하려고 만든 흉내예요 (2026-11-09 저장소로 옮김).
// account/account.js는 window.supabase가 이미 있으면 CDN의 SDK를 불러오지 않으므로, 이 파일이 먼저 실행되면 사이트 전체가 이 가짜를 써요.
//   - 로그인한 사람: 관리자(선생님) "u-admin". 학생 "u-s1"에는 랜덤 코드 연습 기록 300개 + 코드 추론 기록 몇 개를 만들어 둠
//   - 표(profiles, practice_log, practice_stats, review_queue)는 브라우저 메모리에만 — 새로고침하면 처음으로
//   - rpcs: schema.sql의 함수를 JS로 간단히 흉내 (규칙을 완전히 똑같이 따르진 않음. DB 규칙 검사는 tests/db.test.js)
//   - 주소 옵션: ?social=1 → 정보 추가 입력이 필요한 소셜 가입자, ?social=2 → 정보가 다 있는 소셜 가입자
//   - 개발자 도구에서: window.__db (표 내용), window.__calls (사이트가 부른 함수 기록), window.__off (시계를 ms만큼 앞으로 — 타이머 5분 시험 등),
//     로그아웃 버튼은 동작하지만 새로고침하면 다시 로그인 상태
// 사이트 코드에서 supabase를 새로 쓰는 곳이 생기면(새 rpc, 새 표) 여기에도 흉내를 추가해야 화면 확인이 됨.
(() => {
  const me = { id: "u-admin", email: "teacher@example.test", app_metadata: /social=/.test(location.search) ? { provider: "kakao", providers: ["kakao"] } : { provider: "email", providers: ["email"] } };
  const db = {
    profiles: [{ id: me.id, nickname: "선생님", full_name: "김선생", preferred_lang: "ko", role: "admin", settings: null, deleted_at: null, age14_confirmed: !/social=1\b/.test(location.search), terms_version: /social=1\b/.test(location.search) ? null : "2026-11-05" },
               { id: "u-s1", nickname: "학생<b>1</b>", full_name: "이학생", preferred_lang: "ko", role: "student", settings: null, deleted_at: null, age14_confirmed: true, terms_version: "2026-11-05" }],
    practice_stats: [], practice_log: [], review_queue: [],
  };
  const day = (off = 0) => { const d = new Date(Date.now() - off * 864e5); return d.toISOString().slice(0, 10); };
  // sample history for the student
  const qs = ["maj", "dom7", "M7", "m7b5", "7alt", "min"];
  const roots = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"], heads = { maj: "", dom7: ["7", "7(♭9)", "7(♯11)", "7(9,13)"], M7: ["M7", "M7(♯11)", "M7(9)"], m7b5: "m7(♭5)", "7alt": "7alt", min: "m" };
  for (let i = 0; i < 300; i++) { const q = qs[i % 6], r = roots[Math.floor(Math.random() * 12)]; db.practice_log.push({ id: i, user_id: "u-s1", day: day(Math.floor(Math.random() * 200)), quality: q, symbol: r + [].concat(heads[q])[i % [].concat(heads[q]).length], duration_ms: i % 3 ? Math.round(3000 + Math.random() * 40000) : null, first_try: Math.random() < (r === "F♯" ? 0.4 : q === "7alt" ? 0.5 : 0.85), review: Math.random() < 0.05 }); }
  // 오답의 입력한 답 (2026-11-09): 대부분 누른 건반, 가끔 ""(제출 안 함)·null(예전 기록)
  for (const r of db.practice_log) if (!r.first_try) r.answer = r.id % 7 === 0 ? "" : r.id % 11 === 0 ? null : ["48,52,55,58", "50,53,57,60", "54,58,61,64,67"][r.id % 3];
  db.practice_log.sort((a, b) => (a.day < b.day ? -1 : 1));
  db.review_queue.push({ user_id: "u-s1", symbol: "F♯7alt", quality: "7alt", spec: {}, hits: 1, added_at: 1 });
  db.review_queue.push({ user_id: "u-admin", symbol: "C7", quality: "dom7", spec: { l: 0, a: 0, type: "dom7", tens: [], alt: false, head: "7", items: [] }, hits: 0, added_at: 2 });
  db.review_queue.push({ user_id: "u-admin", symbol: "Dm", quality: "min", spec: { l: 1, a: 0, type: "min", tens: [], alt: false, head: "m", items: [] }, hits: 1, added_at: 3 });
  db.review_queue.push({ user_id: "u-admin", symbol: "Em", quality: "min", spec: { l: 2, a: 0, type: "min", tens: [], alt: false, head: "m", items: [] }, hits: 0, added_at: 4 });
  for (const [uid, sym, q, ok, h] of [["u-s1","Dm7(♭5)","m7b5",true,true],["u-s1","CM7","M7",false,false],["u-s1","F♯m","min",true,false],["u-admin","E♭7(♭9)","dom7",true,true],["u-admin","Gsus4","sus4",false,false]])
    db.practice_log.push({ user_id: uid, mode: "name", day: day(1), quality: q, symbol: sym, first_try: ok, review: false, duration_ms: ok ? 7000 : null, hinted: h, answer: ok ? null : { CM7: "Cm7", Gsus4: "Gsus2" }[sym] });
  db.review_queue.push({ user_id: "u-admin", mode: "name", symbol: "Dm7(♭5)", quality: "m7b5", spec: { l: 1, a: 0, type: "m7b5", tens: [], alt: false, head: "m7", items: ["♭5"], inv: true, notes: [[56, "A♭"], [60, "C"], [62, "D"], [65, "F"]] }, hits: 0, added_at: 6 });
  db.review_queue.push({ user_id: "u-admin", symbol: "FM7", quality: "M7", spec: { l: 3, a: 0, type: "M7", tens: [], alt: false, head: "M7", items: [] }, hits: 0, added_at: 5 });
  db.practice_stats.push({ user_id: "u-s1", total: 300, first_correct: 210, streak: 3, best_streak: 14 });
  window.__db = db; window.__calls = [];
  const rec = { question: "default", custom_text: null, answer: "1234" };
  const presets = ["teacher6", "friend", "pet", "town", "concert", "academy", "default"];
  const rpcs = {
    my_recovery() { return { question: rec.question, custom_text: rec.custom_text }; },
    set_recovery({ p_question, p_custom, p_answer }) { Object.assign(rec, { question: p_question, custom_text: p_custom, answer: p_answer.replace(/\s/g, "").toLowerCase() }); return null; },
    reset_question({ p_email }) { if (p_email === me.email) return { question: rec.question, custom_text: rec.custom_text }; let h = 0; for (const c of p_email.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { question: presets[h % 7], custom_text: null }; },
    check_reset_answer({ p_email, p_answer }) { window.__wrong = window.__wrong || 0; if (window.__wrong >= 5) throw { message: "too_many" }; const ok = p_email === me.email && p_answer.replace(/\s/g, "").toLowerCase() === rec.answer; if (!ok) window.__wrong++; return { ok, wrong: window.__wrong }; },
    complete_signup({ p_full_name, p_nickname, p_lang }) { Object.assign(db.profiles[0], { full_name: p_full_name, nickname: p_nickname, preferred_lang: p_lang, age14_confirmed: true, terms_version: "2026-11-05" }); return null; },
    record_attempt(a) {
      const uid = me.id;
      db.practice_log.push({ user_id: uid, day: a.p_day, quality: a.p_quality, symbol: a.p_symbol, first_try: a.p_first, review: a.p_review, duration_ms: a.p_ms, mode: a.p_mode || "play", hinted: !!a.p_hint, answer: a.p_first ? null : (a.p_answer ?? null) });
      let s = db.practice_stats.find(x => x.user_id === uid);
      if (!s) db.practice_stats.push(s = { user_id: uid, total: 0, first_correct: 0, streak: 0, best_streak: 0 });
      s.total++; s.first_correct += a.p_first ? 1 : 0; s.streak = a.p_first ? s.streak + 1 : 0; s.best_streak = Math.max(s.best_streak, s.streak);
      if (a.p_review) {
        const q = db.review_queue.find(x => x.user_id === uid && x.symbol === a.p_symbol);
        if (q && a.p_first) { q.hits++; if (q.hits >= 2) db.review_queue.splice(db.review_queue.indexOf(q), 1); }
      } else if (!a.p_first && a.p_spec) {
        const q = db.review_queue.find(x => x.user_id === uid && x.symbol === a.p_symbol);
        if (q) { q.hits = 0; q.spec = a.p_spec; } else db.review_queue.push({ user_id: uid, symbol: a.p_symbol, quality: a.p_quality, spec: a.p_spec, hits: 0, added_at: Date.now() });
      }
      return null;
    },
    practice_summary({ p_user, p_range, p_today, p_from, p_to, p_mode }) {
      const M = p_mode || "play", inM = r => M === "all" || (r.mode || "play") === M;   // "all" = 두 연습 합산 (2026-11-09)
      const t = new Date(p_today + "T00:00:00Z");
      const since = p_range === "custom" ? new Date(p_from + "T00:00:00Z") : p_range === "7d" ? new Date(t - 6 * 864e5) : p_range === "30d" ? new Date(t - 29 * 864e5) : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 11, 1));
      const s0 = since.toISOString().slice(0, 10), until = p_range === "custom" ? p_to : p_today;
      const monthly = p_range === "1y" || (p_range === "custom" && (new Date(until) - since) / 864e5 > 62);
      const rows = db.practice_log.filter(r => inM(r) && r.user_id === p_user && r.day >= s0 && r.day <= until);
      const all = db.practice_log.filter(r => inM(r) && r.user_id === p_user).map(r => r.day).sort();
      const group = (key) => { const m = new Map(); for (const r of rows) for (const k of [].concat(key(r))) { const g = m.get(k) || { n: 0, ok: 0, sum: 0, t: 0 }; g.n++; g.ok += r.first_try ? 1 : 0; if (r.duration_ms != null) { g.sum += r.duration_ms; g.t++; } g.ms = g.t ? Math.round(g.sum / g.t) : null; m.set(k, g); } return m; };
      const tens = r => { const imp = { "7alt": ["alt"], M9: ["9"], m9: ["9"], dom9: ["9"], M13: ["13"], dom13: ["13"], m11: ["11"] }[r.quality] || []; const m = r.symbol.match(/\(([^)]*)\)$/); return imp.concat(m ? m[1].split(",").filter(x => !(r.quality === "m7b5" && x === "♭5")) : []); };
      const timed = db.practice_log.filter(r => inM(r) && r.user_id === p_user && r.duration_ms != null);
      const st = M === "play" ? db.practice_stats.find(x => x.user_id === p_user) : M === "all" ? (() => { const l = db.practice_log.filter(r => r.user_id === p_user); let run = 0, best = 0; for (const r of l) { run = r.first_try ? run + 1 : 0; best = Math.max(best, run); } return l.length ? { total: l.length, first_correct: l.filter(r => r.first_try).length, streak: run, best_streak: best } : null; })() : (n => n ? { total: n, first_correct: rows.filter(r => r.first_try).length, streak: 1, best_streak: 2 } : null)(db.practice_log.filter(r => inM(r) && r.user_id === p_user).length);
      return {
        since: s0, firstDay: all[0] || null, practiceDays: [...new Set(all)],
        totals: st ? { total: st.total, first: st.first_correct, streak: st.streak, best: st.best_streak } : null,
        time: { ms: timed.length ? Math.round(timed.reduce((a, r) => a + r.duration_ms, 0) / timed.length) : null, t: timed.length },
        byTension: [...group(r => tens(r).map(x => r.quality + "|" + x))].map(([k, g]) => ({ q: k.split("|")[0], x: k.split("|")[1], ...g })),
        byQuality: [...group(r => r.quality)].map(([q, g]) => ({ q, ...g })),
        byRoot: [...group(r => r.symbol.match(/^[A-G][♯♭]?/)[0])].map(([r, g]) => ({ r, ...g })),
        byDay: [...group(r => monthly ? r.day.slice(0, 8) + "01" : r.day)].map(([d, g]) => ({ d, ...g })).sort((a, b) => a.d < b.d ? -1 : 1),
        review: db.review_queue.filter(x => x.user_id === p_user && (M === "all" || (x.mode || "play") === M)).map(x => ({ symbol: x.symbol, q: x.quality, hits: x.hits, mode: x.mode || "play" })),
      };
    },
    student_overview({ p_user, p_today, p_mode }) {
      const M = p_mode || "play";
      const rows = db.practice_log.filter(r => r.user_id === p_user && (M === "all" || (r.mode || "play") === M));
      const g = key => { const m = new Map(); for (const r of rows) { const k = key(r); const x = m.get(k) || { n: 0, ok: 0 }; x.n++; x.ok += r.first_try ? 1 : 0; m.set(k, x); } return m; };
      const wk = new Map(); for (const r of rows) if (r.day > day(7)) wk.set(r.day, (wk.get(r.day) || 0) + 1);
      const pr = db.profiles.find(p => p.id === p_user);
      return { nickname: pr.nickname, full_name: pr.full_name, sessions: 4, abandoned: 2, joined: "2026-03-02T09:00:00Z", byQuality: [...g(r => r.quality)].map(([q, x]) => ({ q, ...x })),
        byRoot: [...g(r => r.symbol.match(/^[A-G][♯♭]?/)[0])].map(([r, x]) => ({ r, ...x })),
        days: new Set(rows.map(r => r.day)).size, lastDay: rows.length ? rows[rows.length - 1].day : null,
        week: [...wk].map(([d, n]) => ({ d, n })), recent: rows.slice(-50).reverse().map(r => ({ d: r.day, symbol: r.symbol, q: r.quality, first: r.first_try, review: !!r.review, ms: r.duration_ms ?? null, hint: !!r.hinted, mode: r.mode || "play", answer: r.answer ?? null })), byTension: [] };
    },
    // 오답 목록 (2026-11-09): 기간은 단순하게(최근 기록 전체), 조건은 DB와 같게
    wrong_answers({ p_user, p_mode, p_quals, p_root, p_tension }) {
      const M = p_mode || "play", NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const pc = s => (NAT[s[0]] + (s[1] === "♯" ? 1 : s[1] === "♭" ? -1 : 0) + 12) % 12;
      const w = db.practice_log.filter(r => r.user_id === p_user && !r.first_try && (M === "all" || (r.mode || "play") === M)
        && (!p_quals || p_quals.includes(r.quality)) && (p_root == null || pc(r.symbol) === p_root)
        && (!p_tension || (r.symbol.match(/\(([^)]*)\)$/) || ["", ""])[1].split(",").includes(p_tension)));
      return { total: w.length, items: w.slice(-50).reverse().map(r => ({ d: r.day, symbol: r.symbol, q: r.quality, review: !!r.review, hint: !!r.hinted, mode: r.mode || "play", answer: r.answer ?? null })) };
    },
    student_list({ p_mode } = {}) {
      const M = p_mode || "play";
      return db.profiles.filter(p => p.role === "student").map(p => { const mine = db.practice_log.filter(l => l.user_id === p.id && (M === "all" || (l.mode || "play") === M)); const s = M === "play" ? (db.practice_stats.find(x => x.user_id === p.id) || {}) : { total: mine.length, first_correct: mine.filter(l => l.first_try).length }; const days = mine.map(l => l.day).sort(); return { id: p.id, nickname: p.nickname, full_name: p.full_name, total: s.total || 0, first_correct: s.first_correct || 0, last_day: days[days.length - 1] || null }; });
    },
    start_timer_session({ p_settings }) { window.__sessions = (window.__sessions || []).concat([{ id: (window.__sessions || []).length + 1, settings: p_settings, ended: false }]); return window.__sessions.length; },
    end_timer_session({ p_session, p_abandoned }) { const x = window.__sessions[p_session - 1]; x.ended = true; x.abandoned = (x.abandoned || 0) + (p_abandoned || 0); return null; },
    request_account_deletion() { return new Date(Date.now() + 7 * 864e5).toISOString(); },
    restore_account() { return null; },
  };
  function from(table) {
    let rows = () => db[table], filters = [], mode = "select", fields = null, opts = {}, single = false, maybe = false;
    const b = {
      select(c, o) { opts = o || {}; return b; }, eq(k, v) { filters.push([k, v]); return b; }, order() { return b; },
      update(f) { mode = "update"; fields = f; return b; },
      single() { single = true; return b; }, maybeSingle() { maybe = true; return b; },
      then(res, rej) {
        const hit = rows().filter(r => filters.every(([k, v]) => (k === "id" || k === "user_id" ? (r.id ?? r.user_id) === v || r.user_id === v : (k === "mode" ? (r.mode || "play") : r[k]) === v)));
        window.__calls.push([table, mode, filters]);
        let out;
        if (mode === "update") { hit.forEach(r => Object.assign(r, fields)); out = { data: null, error: null }; }
        else if (opts.head) out = { count: hit.length, error: null };
        else if (single) out = { data: hit[0] ? { ...hit[0] } : null, error: hit[0] ? null : { message: "none" } };
        else if (maybe) out = { data: hit[0] ? { ...hit[0] } : null, error: null };
        else out = { data: JSON.parse(JSON.stringify(hit)), error: null };
        return Promise.resolve(out).then(res, rej);
      },
    };
    return b;
  }
  let cb;
  window.supabase = { createClient: () => ({
    auth: {
      onAuthStateChange(f) { cb = f; setTimeout(() => cb("INITIAL_SESSION", window.__loggedOut ? null : { user: me, access_token: "tok" }), 50); },
      signOut: async () => { window.__loggedOut = true; cb("SIGNED_OUT", null); return {}; },
      signInWithPassword: async ({ password, options }) => { window.__calls.push(["signIn", options && options.captchaToken ? "token" : "no-token"]); if (password === "unconfirmed") return { error: { code: "email_not_confirmed", status: 400 } }; if (password === "wrong") return { error: { code: "invalid_credentials", status: 400 } }; cb("SIGNED_IN", { user: me }); return { error: null }; },
      updateUser: async () => ({ error: null }),
      signUp: async a => { window.__calls.push(["signUp", a]); return { data: { session: null }, error: null }; },
      resetPasswordForEmail: async (email, o) => { window.__calls.push(["resetMail", email, o && o.captchaToken ? "token" : "no-token"]); return { error: null }; },
      resend: async a => { window.__calls.push(["resend", a]); return { error: null }; },
      signInWithIdToken: async a => { window.__calls.push(["idToken", a.provider, a.token, a.nonce]); cb("SIGNED_IN", { user: me }); return { data: {}, error: null }; },
      signInWithOAuth: async a => { window.__calls.push(["oauth", a]); return { error: null }; },
    },
    from,
    storage: { from: () => ({ upload: async (name, blob) => { window.__calls.push(["upload", name, blob.type, blob.size]); return { error: null }; },
                              remove: async names => { window.__calls.push(["remove", names]); return { error: null }; } }) },
    rpc: async (name, args) => { window.__calls.push(["rpc", name, args]); try { return { data: rpcs[name](args || {}), error: null }; } catch (e) { return { data: null, error: e }; } },
  }) };
})();
