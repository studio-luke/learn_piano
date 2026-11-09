// supabase/schema.sql을 PGlite(WASM Postgres)에서 실제로 실행해 DB 함수·권한을 검사 (2026-11-09 저장소로 옮김).  실행: npm test
// tests/schema.test.js는 글자만 읽지만, 여기서는 진짜로 기록을 넣고 결과를 확인해요.
// 첫 번째 test: 랜덤 코드 연습 기준 — 누적 숫자, 다시 풀기, RLS(본인만), 익명 차단, 통계, 하루 상한, 탈퇴 유예·삭제,
//               근음별·텐션별 통계, 타이머 세션 규칙, fits_settings(설정 밖 기록의 시간 버림), 중단된 문제
// 두 번째 test: 연습 구분 mode('play' / 'name') — 연습별 누적·다시 풀기, 힌트 기록, 연습이 다른 세션의 시간 버림,
//               코드 추론의 C♯ 근음 허용, 연습별 통계·선생님 화면, name_settings 저장
// 새 DB 기능을 만들면 여기에 검사를 추가하세요. 실패 메시지의 JSON은 실제로 나온 값이에요.
// (예전 schema에서 업그레이드하는 경우는 검사하지 않음 — 큰 변경 때는 그때의 예전 schema.sql로 따로 확인)
import test from "node:test";
import assert from "node:assert";
import { bootDb, addUsers, asUser, A, S1, S2 } from "./db/harness.js";

const ok = (cond, msg) => assert.ok(cond, msg);
const spec = JSON.stringify({ l: 0, a: 0, type: "dom7", tens: [], alt: false, head: "7", items: [] });

test("db: practice records, permissions, stats, timer (play)", async () => {
  const db = await bootDb();
  await addUsers(db);
  const as = (uid, sql, params) => asUser(db, uid, sql, params);
  const rec = (uid, first, sym = "C7", review = false) => as(uid, "select public.record_attempt('dom7', $1, $2, current_date, $3, $4::jsonb)", [sym, first, review, spec]);
  await rec(S1, true); await rec(S1, true); await rec(S1, false); await rec(S1, true);
  let r = await as(S1, "select * from public.practice_stats");
  ok(r.rows.length === 1 && r.rows[0].total === 4 && r.rows[0].first_correct === 3 && r.rows[0].streak === 1 && r.rows[0].best_streak === 2, "counters " + JSON.stringify(r.rows));
  r = await as(S1, "select symbol, hits from public.review_queue"); ok(r.rows.length === 1, "wrong goes to review queue");
  await rec(S1, true, "C7", true); r = await as(S1, "select hits from public.review_queue"); ok(r.rows[0].hits === 1, "review hit 1");
  await rec(S1, false, "C7", true); r = await as(S1, "select hits from public.review_queue"); ok(r.rows[0].hits === 1, "wrong in review keeps it");
  await rec(S1, true, "C7", true); r = await as(S1, "select * from public.review_queue"); ok(r.rows.length === 0, "two hits removes it");
  // RLS
  await rec(S2, true);
  r = await as(S2, "select * from public.practice_log"); ok(r.rows.every(x => x.user_id === S2), "student sees only own log");
  r = await as(A, "select count(distinct user_id) n from public.practice_log"); ok(r.rows[0].n == 2, "admin sees all logs");
  for (const sql of ["insert into public.practice_stats (user_id, total) values ('" + S2 + "', 999)", "update public.practice_stats set total = 999", "delete from public.practice_log", "insert into public.review_queue (user_id, symbol, quality, spec) values ('" + S2 + "', 'x', 'x', '{}')"]) {
    let e = null; try { await as(S2, sql); } catch (x) { e = x; } ok(e, "blocked: " + sql.slice(0, 40));
  }
  await db.exec("set role anon; select set_config('app.uid', '', false);");
  for (const sql of ["select * from public.practice_log", "select public.record_attempt('dom7','C7',true,current_date)", "select public.student_list()"]) {
    let e = null; try { await db.query(sql); } catch (x) { e = x; } ok(e, "anon blocked: " + sql.slice(0, 40));
  }
  await db.exec("reset role;");
  // summary
  r = await as(S1, "select public.practice_summary($1, '7d', current_date) s", [S1]); const s = r.rows[0].s;
  ok(s.totals.total === 7 && s.byQuality[0].n === 7 && s.byDay.length === 1, "summary " + JSON.stringify(s));
  r = await as(S1, "select public.practice_summary($1, '1y', current_date) s", [S1]); ok(r.rows[0].s.byDay[0].d.endsWith("-01"), "1y by month");
  let e = null; try { await as(S1, "select public.practice_summary($1, '7d', current_date)", [S2]); } catch (x) { e = x; } ok(e, "student cannot read another's summary");
  r = await as(A, "select public.practice_summary($1, '30d', current_date) s", [S2]); ok(r.rows[0].s.totals.total === 1, "admin reads student summary");
  r = await as(A, "select * from public.student_list()"); ok(r.rows.length === 2 && r.rows[0].nickname === "s1", "student list " + JSON.stringify(r.rows));
  r = await as(S1, "select * from public.student_list()"); ok(r.rows.length === 0, "student list empty for students");
  // bad input, day check, cap
  e = null; try { await as(S1, "select public.record_attempt('dom7','C7',true, current_date - 5)"); } catch (x) { e = x; } ok(e, "old day rejected");
  e = null; try { await as(S1, "select public.record_attempt('bad quality!','C7',true, current_date)"); } catch (x) { e = x; } ok(e, "bad quality rejected");
  await db.query("insert into public.practice_log (user_id, day, quality, symbol, first_try) select $1, current_date, 'dom7', 'C7', true from generate_series(1, 1000)", [S2]);
  await rec(S2, true); r = await db.query("select total from public.practice_stats where user_id=$1", [S2]); ok(r.rows[0].total === 1, "daily cap");
  // deletion grace + purge cascade
  await as(S1, "select public.request_account_deletion()");
  await rec(S1, true); r = await db.query("select total from public.practice_stats where user_id=$1", [S1]); ok(r.rows[0].total === 7, "no records while leaving");
  await db.query("update public.profiles set deleted_at = now() - interval '8 days' where id=$1", [S1]);
  await db.query("select public.purge_deleted_accounts()");
  r = await db.query("select (select count(*) from public.practice_log where user_id=$1) a, (select count(*) from public.practice_stats where user_id=$1) b, (select count(*) from public.review_queue where user_id=$1) c", [S1]);
  ok(r.rows[0].a == 0 && r.rows[0].b == 0 && r.rows[0].c == 0, "purge removes practice data");
  // per root + teacher overview
  await db.query("insert into public.practice_log (user_id, day, quality, symbol, first_try) values ($1, current_date, 'm7b5', 'F♯m7(♭5)', false), ($1, current_date, 'maj', 'C𝄪', true), ($1, current_date, 'maj', 'B♭', true)", [S2]);
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]);
  ok(JSON.stringify(r.rows[0].s.byRoot.map(x => x.r).sort()) === JSON.stringify(["B♭", "C", "C𝄪", "F♯"]), "byRoot " + JSON.stringify(r.rows[0].s.byRoot));
  r = await as(A, "select public.student_overview($1, current_date) s", [S2]); const o = r.rows[0].s;
  ok(o.recent.length === 50 && o.recent[0].symbol === "B♭" && o.days === 1 && o.week.length === 1 && o.byRoot.length === 4 && o.joined, "overview " + JSON.stringify({ ...o, recent: o.recent.slice(0, 2) }));
  e = null; try { await as(S2, "select public.student_overview($1, current_date)", [S2]); } catch (x) { e = x; } ok(e, "overview is admin only");
  // custom range
  await db.query("insert into public.practice_log (user_id, day, quality, symbol, first_try) values ($1, current_date - 100, 'maj', 'C', true), ($1, current_date - 40, 'maj', 'D', false)", [S2]);
  r = await as(S2, "select public.practice_summary($1, 'custom', current_date, current_date - 45, current_date - 35) s", [S2]); let c = r.rows[0].s;
  ok(c.byDay.length === 1 && c.byDay[0].n === 1 && c.byQuality[0].n === 1 && c.firstDay, "custom short range is daily " + JSON.stringify(c.byDay));
  r = await as(S2, "select public.practice_summary($1, 'custom', current_date, current_date + 5, current_date - 120) s", [S2]); c = r.rows[0].s;
  ok(c.byDay.every(x => x.d.endsWith("-01")) && c.until.slice(0,10) === new Date().toISOString().slice(0,10) || c.byDay.every(x => x.d.endsWith("-01")), "custom long range is monthly, swapped and capped " + JSON.stringify(c.byDay.map(x=>x.d)) + " " + c.until);
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]); ok(r.rows[0].s.byDay.length >= 1, "old 3-arg call still works");
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]); const pd = r.rows[0].s.practiceDays;
  ok(pd.length === 3 && pd[0] < pd[1] && pd[1] < pd[2], "practiceDays " + JSON.stringify(pd));
  // tensions + time
  await db.query("delete from public.practice_log where user_id = $1", [S2]);
  r = await db.query(`select q, s, public.chord_tensions(q, s) as t from (values ('dom7','C7(♭9,13)'),('M9','CM9'),('M9','CM9(♯11)'),('dom13','F13(♭9)'),('m11','Dm11'),('7alt','G7alt'),
    ('m7b5','Bm7(♭5)'),('m7b5','Bm7(♭5,9)'),('augM7','CM7(♯5)'),('69','C6(9)'),('dom7','C7(♯5)'),('maj','C'),('M7','C△7(♯11)')) v(q, s)`);
  const tmap = Object.fromEntries(r.rows.map(x => [x.s, x.t.join(" ")]));
  ok(tmap["C7(♭9,13)"] === "♭9 13" && tmap["CM9"] === "9" && tmap["CM9(♯11)"] === "9 ♯11" && tmap["F13(♭9)"] === "13 ♭9" && tmap["Dm11"] === "11" && tmap["G7alt"] === "alt"
    && tmap["Bm7(♭5)"] === "" && tmap["Bm7(♭5,9)"] === "9" && tmap["CM7(♯5)"] === "" && tmap["C6(9)"] === "" && tmap["C7(♯5)"] === "♯5" && tmap["C"] === "" && tmap["C△7(♯11)"] === "♯11", "chord_tensions " + JSON.stringify(tmap));
  r = await as(S2, `select public.start_timer_session('{"types":["maj","min","M7","m7","dom7","M9"],"optC":true,"cMax":2}'::jsonb) id`); const sid0 = r.rows[0].id;
  await as(S2, "select public.record_attempt('dom7', 'C7(♭9,13)', true, current_date, false, null, 12000, $1)", [sid0]);
  await as(S2, "select public.record_attempt('dom7', 'D7(♭9)', false, current_date, false, '{}'::jsonb, 300000, $1)", [sid0]);
  e = null; try { await as(S2, "select public.record_attempt('dom7', 'D7', false, current_date, false, null, 300001)"); } catch (x) { e = x; } ok(e, "time over 5 min rejected");
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]); const ts = r.rows[0].s;
  const b9 = ts.byTension.find(x => x.x === "♭9"), dq = ts.byQuality.find(x => x.q === "dom7");
  ok(b9 && b9.n === 2 && b9.ms === 156000 && b9.t === 2 && ts.time.t === 2 && ts.time.ms === 156000 && dq.t === 2, "time averages " + JSON.stringify({ b9, time: ts.time, dq }));
  r = await as(A, "select public.student_overview($1, current_date) s", [S2]); ok(r.rows[0].s.byTension.length >= 2 && r.rows[0].s.recent[0].ms === 300000, "overview tensions + recent ms");
  await as(S2, "select public.record_attempt('M9', 'CM9', true, current_date, false, null, 5000, $1)", [sid0]);
  await as(S2, "select public.record_attempt('m7', 'Dm7(9)', true, current_date, false, null, 7000, $1)", [sid0]);
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]);
  const keys = r.rows[0].s.byTension.map(x => x.q + "·" + x.x).sort();
  ok(JSON.stringify(keys) === JSON.stringify(["M9·9", "dom7·13", "dom7·♭9", "m7·9"]), "byTension per chord type " + JSON.stringify(keys));
  // timer sessions
  const okSet = JSON.stringify({ types: ["maj", "min", "M7", "m7", "dom7"], optB: true, bases: [0, 2, 4, 5, 7, 9, 11, 1], optC: true, cMax: 1, optD: false, optE: false, review: false });
  r = await as(S2, "select public.start_timer_session($1::jsonb) id", [okSet]); const sid = r.rows[0].id;
  ok(sid, "session started");
  for (const bad of [{ types: ["maj", "min", "M7", "m7"] }, { types: ["maj", "min", "M7", "m7", "dom7"], optB: true, bases: [0, 2, 4] }]) {
    e = null; try { await as(S2, "select public.start_timer_session($1::jsonb)", [JSON.stringify(bad)]); } catch (x) { e = x; } ok(e, "rule enforced " + JSON.stringify(bad));
  }
  await as(S2, "select public.record_attempt('maj', 'C', true, current_date, false, null, 4000, $1)", [sid]);
  await as(S2, "select public.record_attempt('maj', 'D', true, current_date, false, null, 4000, null)");
  await as(S2, "select public.record_attempt('maj', 'E', true, current_date, false, null, 4000, 999999)");
  r = await db.query("select symbol, duration_ms, timer_session from public.practice_log where user_id = $1 and symbol in ('C','D','E') order by id desc limit 3", [S2]);
  const bySym = Object.fromEntries(r.rows.map(x => [x.symbol, [x.duration_ms, x.timer_session]]));
  ok(bySym.C[0] === 4000 && bySym.C[1] == sid && bySym.D[0] === null && bySym.E[0] === null, "time kept only with a valid session " + JSON.stringify(bySym));
  await as(S2, "select public.end_timer_session($1)", [sid]);
  r = await db.query("select ended_at from public.timer_sessions where id = $1", [sid]); ok(r.rows[0].ended_at, "session ended");
  await as(S2, "select public.record_attempt('maj', 'F', true, current_date, false, null, 4000, $1)", [sid]);
  r = await db.query("select duration_ms from public.practice_log where user_id = $1 and symbol = 'F'", [S2]); ok(r.rows[0].duration_ms === 4000, "late record within 2 minutes keeps its time");
  r = await as(A, "select count(*) n from public.timer_sessions"); ok(r.rows[0].n >= 1, "admin reads sessions");
  e = null; try { await as(S2, "insert into public.timer_sessions (user_id, settings) values ($1, '{}')", [S2]); } catch (x) { e = x; } ok(e, "no direct insert into sessions");

  // 2026-11-06 b: 7+ roots, settings check, abandoned, review excluded, overview fields
  e = null; try { await as(S2, "select public.start_timer_session($1::jsonb)", [JSON.stringify({ types: ["maj","min","M7","m7","dom7"], optB: true, bases: [1,3,6,8,10,0] })]); } catch (x) { e = x; } ok(e, "6 roots rejected");
  r = await as(S2, "select public.start_timer_session($1::jsonb) id", [JSON.stringify({ types: ["maj","min","M7","m7","dom7"], optB: true, bases: [1,3,6,8,10,0,2], optC: false, optE: false })]); const s7 = r.rows[0].id; ok(s7, "7 black-and-white roots accepted");
  const fit = async (q, sym, review = false) => { await as(S2, "select public.record_attempt($1, $2, true, current_date, $3, null, 3000, $4)", [q, sym, review, s7]);
    const x = await db.query("select duration_ms from public.practice_log where user_id = $1 order by id desc limit 1", [S2]); return x.rows[0].duration_ms; };
  ok(await fit("maj", "D♭") === 3000, "in range keeps time");
  ok(await fit("dim", "D♭dim") === null, "chord type outside settings drops time");
  ok(await fit("maj", "E") === null, "root outside settings drops time");
  ok(await fit("dom7", "C7(♭9)") === null, "tension without option C drops time");
  ok(await fit("maj", "C♯") === null, "C♯ root without option E drops time");
  ok(await fit("dim", "Edim", true) === 3000, "review keeps time whatever the settings");
  await as(S2, "select public.end_timer_session($1, 3)", [s7]);
  r = await db.query("select abandoned from public.timer_sessions where id = $1", [s7]); ok(r.rows[0].abandoned === 3, "abandoned saved");
  r = await as(S2, "select public.practice_summary($1, '7d', current_date) s", [S2]); const tm = r.rows[0].s.time;
  const all = await db.query("select round(avg(duration_ms)) a, round(avg(duration_ms) filter (where not review)) nr from public.practice_log where user_id = $1", [S2]);
  ok(String(tm.ms) === String(all.rows[0].nr) && all.rows[0].a !== all.rows[0].nr, "review times left out of averages " + JSON.stringify([tm, all.rows[0]]));
  r = await as(A, "select public.student_overview($1, current_date) s", [S2]); const o2 = r.rows[0].s;
  ok(o2.nickname === "s2" && o2.full_name && o2.sessions >= 2 && o2.abandoned === 3, "overview has name and timer use " + JSON.stringify({ n: o2.nickname, s: o2.sessions, a: o2.abandoned }));
});

test("db: two practices kept apart by mode (play / name)", async () => {
  const db = await bootDb();
  await addUsers(db, [[A, "admin"], [S1, "s1"]]);
  await db.query("update public.profiles set age14_confirmed=true, terms_version='x'");
  const as = (uid, sql, params) => asUser(db, uid, sql, params);
  const rec = (mode, sym, first, opts = {}) => as(S1, "select public.record_attempt($1, $2, $3, current_date, $4, $5::jsonb, $6, $7, $8, $9)",
    [opts.q || "min", sym, first, !!opts.review, opts.spec === undefined ? spec : opts.spec, opts.ms ?? null, opts.sid ?? null, mode, !!opts.hint]);
  await rec("play", "Cm", true); await rec("play", "Cm", false);
  await rec("name", "Cm", false); await rec("name", "Cm", true, { hint: true }); await rec("name", "Cm", true);
  let r = await db.query("select mode, total, first_correct, streak from public.practice_stats order by mode");
  ok(JSON.stringify(r.rows) === JSON.stringify([{ mode: "name", total: 3, first_correct: 2, streak: 2 }, { mode: "play", total: 2, first_correct: 1, streak: 0 }]), "누적 숫자 연습별 " + JSON.stringify(r.rows));
  r = await db.query("select mode, symbol from public.review_queue order by mode"); ok(r.rows.length === 2 && r.rows[0].mode === "name" && r.rows[1].mode === "play", "같은 코드 이름도 연습별로 틀린 문제 목록");
  r = await db.query("select count(*)::int n from public.practice_log where hinted"); ok(r.rows[0].n === 1, "힌트 사용 기록");
  await rec("name", "Cm", true, { review: true }); await rec("name", "Cm", true, { review: true });
  r = await db.query("select mode from public.review_queue"); ok(r.rows.length === 1 && r.rows[0].mode === "play", "코드 추론 다시 풀기 2번 → 그 연습 목록에서만 빠짐");
  let e = null; try { await rec("other", "Cm", true); } catch (x) { e = x; } ok(e, "모르는 연습 구분은 거절");
  // 타이머: 연습이 다른 세션이면 시간 버림, 코드 추론은 옵션 E 꺼져도 C♯ 근음 허용
  const st = JSON.stringify({ types: ["maj","min","dim","aug","M7"], optB: false, bases: [], optC: false, cMax: 1, optE: false, optInv: false });
  const sidName = (await as(S1, "select public.start_timer_session($1::jsonb, 'name') id", [st])).rows[0].id;
  await rec("name", "C♯m", true, { ms: 4000, sid: sidName });
  await rec("play", "Cm", true, { ms: 5000, sid: sidName });
  r = await db.query("select mode, symbol, duration_ms from public.practice_log where duration_ms is not null or symbol in ('C♯m') order by id");
  ok(r.rows.length === 1 && r.rows[0].symbol === "C♯m" && r.rows[0].duration_ms === 4000, "코드 추론 C♯m 시간 인정, 다른 연습 세션의 시간은 버림 " + JSON.stringify(r.rows));
  const sidPlay = (await as(S1, "select public.start_timer_session($1::jsonb, 'play') id", [st])).rows[0].id;
  await rec("play", "C♯m", true, { ms: 3000, sid: sidPlay });
  r = await db.query("select duration_ms from public.practice_log where mode='play' and symbol='C♯m'"); ok(r.rows[0].duration_ms === null, "랜덤 코드 연습은 옵션 E 없이 C♯ 근음이면 지금처럼 시간 버림");
  r = await db.query("select count(*)::int n from public.timer_sessions where ended_at is null"); ok(r.rows[0].n === 1, "새 타이머를 켜면 다른 연습의 열린 세션도 닫힘");
  // m6(9)의 9는 텐션이 아님
  r = await db.query("select public.chord_tensions('m69', 'Cm6(9)') t, public.chord_tensions('69', 'C6(9)') u, public.chord_tensions('dom7', 'C7(9)') v");
  ok(r.rows[0].t.length === 0 && r.rows[0].u.length === 0 && r.rows[0].v.length === 1, "chord_tensions: 6(9)·m6(9)의 9는 텐션 아님");
  // 통계 연습별
  r = await as(S1, "select public.practice_summary($1, '7d', current_date, null, null, 'name') s", [S1]); const s = r.rows[0].s;
  ok(s.totals.total === 6 && s.byQuality.reduce((a, x) => a + x.n, 0) === 6 && s.review.length === 0, "통계(코드 추론) " + JSON.stringify(s.totals));
  r = await as(S1, "select public.practice_summary($1, '7d', current_date) s", [S1]); ok(r.rows[0].s.totals.total === 4 && r.rows[0].s.review.length === 1, "통계(랜덤 코드, 기본값)");
  r = await as(A, "select public.student_overview($1, current_date, 'name') o", [S1]); const o = r.rows[0].o;
  ok(o.recent.length === 6 && o.recent.some(x => x.hint === true) && o.sessions === 1, "선생님 화면(코드 추론): 최근 문제에 힌트 표시, 세션 수 " + o.sessions);
  r = await as(A, "select * from public.student_list('name')"); ok(r.rows[0].total === 6, "학생 목록(코드 추론)");
  // 전체 통계 (2026-11-09): 두 연습을 합침, 연속은 기록 순서대로 다시 셈, 틀린 문제·최근 문제에 연습 구분
  r = await as(S1, "select public.practice_summary($1, '7d', current_date, null, null, 'all') s", [S1]); const al = r.rows[0].s;
  r = await db.query("select first_try from public.practice_log where user_id=$1 order by id", [S1]);
  let run = 0, best = 0; for (const x of r.rows) { run = x.first_try ? run + 1 : 0; best = Math.max(best, run); }
  const firsts = r.rows.filter(x => x.first_try).length;
  ok(al.totals.total === 10 && al.totals.first === firsts && al.totals.streak === run && al.totals.best === best, "전체 통계 합계·연속 " + JSON.stringify(al.totals));
  ok(al.byQuality.reduce((a, x) => a + x.n, 0) === 10 && al.review.length === 1 && al.review[0].mode === "play", "전체 통계 표·틀린 문제(연습 구분)");
  r = await as(A, "select public.student_overview($1, current_date, 'all') o", [S1]); const oa = r.rows[0].o;
  ok(oa.recent.length === 10 && oa.recent.some(x => x.mode === "play") && oa.recent.some(x => x.mode === "name") && oa.sessions === 2, "선생님 화면(전체) " + oa.sessions);
  r = await as(A, "select * from public.student_list('all')"); ok(r.rows[0].total === 10 && r.rows[0].first_correct === firsts, "학생 목록(전체) " + JSON.stringify(r.rows[0]));
  e = null; try { await as(S1, "select public.practice_summary($1, '7d', current_date, null, null, 'x')", [S1]); } catch (x) { e = x; } ok(e, "모르는 연습 구분은 통계에서도 거절");
  e = null; try { await as(S1, "select public.all_totals($1)", [S1]); } catch (x) { e = x; } ok(e, "all_totals는 브라우저에서 직접 못 부름");
  // 첫 오답 입력 (2026-11-09): 오답에만 저장, 형식이 이상하면 버리고 기록은 남김. 오답 목록(wrong_answers)
  const ans = (mode, q, sym, first, answer) => as(S1, "select public.record_attempt($1, $2, $3, current_date, false, null, null, null, $4, false, $5)", [q, sym, first, mode, answer]);
  await ans("play", "M7", "CM7", false, "48,52,55,58");
  await ans("play", "M7", "C♯M7", false, "");          // 제출 안 함
  await ans("play", "M7", "DM7", false, "48,99");       // 범위 밖 → 버림
  await ans("name", "dom7", "C7(9)", false, "Cm7(9)");
  await ans("name", "dom7", "D♭7(9)", true, "C7");      // 정답이면 저장 안 함
  r = await db.query("select symbol, answer from public.practice_log where symbol in ('CM7','C♯M7','DM7','C7(9)','D♭7(9)') order by id");
  ok(JSON.stringify(r.rows.map(x => x.answer)) === JSON.stringify(["48,52,55,58", "", null, "Cm7(9)", null]), "answer 저장 규칙 " + JSON.stringify(r.rows));
  const wa = async (mode, quals, root, ten, who = S1) => (await as(who, "select public.wrong_answers($1, '7d', current_date, null, null, $2, $3, $4, $5) w", [S1, mode, quals, root, ten])).rows[0].w;
  let w = await wa("play", ["M7"], null, null); ok(w.total === 3 && w.items[0].symbol === "DM7" && w.items[2].answer === "48,52,55,58", "코드 종류 줄의 오답 " + JSON.stringify(w));
  w = await wa("all", null, 1, null); ok(w.total === 1 && w.items[0].symbol === "C♯M7", "베이스 줄(C♯/D♭ = 1) — 정답인 D♭7(9)는 빠짐");
  w = await wa("all", ["dom7", "dom9", "dom13"], null, "9"); ok(w.total === 1 && w.items[0].answer === "Cm7(9)" && w.items[0].mode === "name", "텐션 줄의 오답");
  r = await as(A, "select public.student_overview($1, current_date, 'all') o", [S1]); ok(r.rows[0].o.recent[0].hasOwnProperty("answer"), "최근 문제에 answer");
  w = await wa("all", null, null, null, A); ok(w.total >= 4, "관리자는 학생 오답 목록을 봄");
  e = null; try { await as(S1, "select public.wrong_answers($1, '7d', current_date, null, null, 'all')", [A]); } catch (x) { e = x; } ok(e, "학생은 남의 오답 목록을 못 봄");
  r = await as(S1, "select mode, total from public.practice_stats where user_id=$1 and mode='name'", [S1]); ok(r.rows.length === 1, "학생은 자기 누적 숫자를 연습별로 읽음(RLS)");
  // name_settings는 본인만 고칠 수 있음
  await as(S1, "update public.profiles set name_settings = '{\"optInv\":true}' where id = $1", [S1]);
  r = await db.query("select name_settings from public.profiles where id=$1", [S1]); ok(r.rows[0].name_settings.optInv === true, "name_settings 저장");
});
