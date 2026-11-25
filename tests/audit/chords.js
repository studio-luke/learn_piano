// 폰 화면 레이아웃 검사 — 랜덤 코드 연습 (/trainer/chords/):  npm run audit -- chords
// 가장 무거운 두 상태(괄호가 세로로 쌓인 긴 코드, 7alt 정답 확인)에서 버튼·건반이 잘리는지 확인해요.
// 그 문제를 만들지 못하면 실패로 셈. 기기 목록·실행 틀은 tests/audit/common.js
import { runAudit, BASE } from "./common.js";

const URL = `${BASE}/ko/trainer/chords/`;   // 한국어판 (npm run audit가 먼저 빌드함)

async function setup(page, state) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".key");   // 모듈 스크립트가 건반을 그릴 때까지
  await page.waitForTimeout(200);
  // the log-in button is hidden until Supabase is configured; check the header with it shown (long nickname)
  await page.evaluate(() => {
    const b = document.getElementById("accountBtn");
    b.hidden = false; b.classList.add("signed-in");
    document.getElementById("accountLogin").hidden = true;
    const n = document.getElementById("accountName"); n.hidden = false; n.textContent = "가나다라마바사아자차카타파하";
  });
  // 출제 설정은 칩을 '누르지' 않고 원하는 상태로 '맞춤' — 누르기만 하면 처음 설정(practice/settings.js DEFAULTS)이 바뀔 때
  // 켜려던 것이 꺼짐(2026-11-07 기본값 변경 뒤 7이 꺼져 7alt가 안 나왔음, 2026-11-10 고침)
  if (state === "long") {
    await setChecks(page, Object.fromEntries((await typeIds(page)).map(id => ["type-" + id, true])));   // 코드 종류 전부
    await setChecks(page, { optC: true, cMax2: true, optD: true });
    if (await page.getAttribute("#advToggle", "aria-expanded") !== "true") await page.click("#advToggle");   // [심화] 펼친 화면으로
    await page.waitForTimeout(400);
    for (let i = 0; i < 3000; i++) {
      const l = await page.getAttribute("#symbol", "aria-label");
      if (l && l.length >= 13 && (await page.$(".stack"))) return true;
      await page.evaluate(() => document.getElementById("btnNext").click());
    }
  } else {
    // 7만 켜고 텐션 허용 → 약 10%가 7alt
    await setChecks(page, Object.fromEntries((await typeIds(page)).map(id => ["type-" + id, id === "dom7"])));
    await setChecks(page, { optC: true });
    await page.waitForTimeout(400);
    for (let i = 0; i < 500; i++) {
      const l = await page.getAttribute("#symbol", "aria-label");
      if (l && l.endsWith("alt")) { await page.evaluate(() => document.getElementById("btnReveal").click()); return true; }
      await page.evaluate(() => document.getElementById("btnNext").click());
    }
  }
  return false;   // 검사하려던 문제를 못 만듦 → 이 상태의 결과는 믿을 수 없음
}

/** 출제 설정 카드의 코드 종류 id 목록 (칩의 data-type) */
const typeIds = page => page.$$eval("[data-type]", els => els.map(e => e.dataset.type));

/** 체크 상자들을 원하는 상태로: 지금과 다를 때만 눌러서(change 이벤트로 설정에 반영) 맞춤. { 요소 id: 켜짐 여부 } */
async function setChecks(page, want) {
  await page.evaluate(want => {
    for (const [id, on] of Object.entries(want)) {
      const el = document.getElementById(id);
      if (!el) throw new Error("no #" + id);
      if (el.checked !== on) el.click();
    }
  }, want);
}

runAudit({
  page: "chords",
  states: ["long", "alt"],
  setup,
  async check(page, { orient }) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const stack = document.querySelector(".stack");
      return {
        overflowX: document.documentElement.scrollWidth - innerWidth, vh: innerHeight,
        symTop: r("#symbol").top,
        // 쌓인 괄호가 그 아래 '보이는' 첫 요소(안내 문구, 정답·오답 상자)를 덮는지. 정답 확인 뒤에는 안내 문구가
        // display:none이라 위치가 0으로 잡혀서(늘 겹침으로 나왔음, 2026-11-10 고침) 보이는 것만 비교
        stackOverHint: stack ? stack.getBoundingClientRect().bottom - Math.min(...["#hint", "#feedback"].map(r).filter(b => b.height > 0).map(b => b.top), Infinity) : -1,
        check: r("#btnCheck").bottom, next: r("#btnNext").bottom, kbBottom: r("#keyboard").bottom,
        barTop: r(".actions").top, whiteKey: r(".key.white").width,
      };
    });
    const issues = [];
    if (m.overflowX > 0) issues.push(`horizontal scroll ${m.overflowX}px`);
    if (m.symTop < 0) issues.push("chord cut off at top");
    if (m.stackOverHint > 2) issues.push("stacked tensions overlap hint");
    if (m.check > m.vh) issues.push(`check button below first screen (${Math.round(m.check - m.vh)}px)`);
    else if (m.next > m.vh) issues.push(`next button below first screen (${Math.round(m.next - m.vh)}px)`);
    if (m.kbBottom > m.vh) issues.push(`keyboard cut off (${Math.round(m.kbBottom - m.vh)}px)`);
    if (orient === "portrait" && m.kbBottom > m.barTop + 1) issues.push("bottom bar covers keyboard");
    return issues;
  },
});
