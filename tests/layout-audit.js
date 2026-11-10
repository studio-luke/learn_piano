// 폰 화면 레이아웃 검사:  npm run audit
// 처음 한 번 필요:  npm i  &&  npx playwright install chromium
// 연습 페이지를 폰 16종 크기 × 세로/가로 × 주소창 있음/없음으로 열어, 가장 무거운 두 상태
// (괄호가 세로로 쌓인 긴 코드, 7alt 정답 확인)에서 버튼·건반이 잘리는지 확인해요. 그 문제를 만들지 못하면 실패로 셈. 문제가 있는 화면은 tests/audit-output/에 스크린샷.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../tools/serve.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8799;   // 검사용 서버 (npm run dev의 8766과 겹치지 않게)
const URL = `http://127.0.0.1:${PORT}/ko/trainer/chords/`;   // 랜덤 코드 연습 페이지 (한국어판, npm run audit가 먼저 빌드함)
const OUT = path.join(HERE, "audit-output");
fs.mkdirSync(OUT, { recursive: true });

// CSS viewport sizes (portrait). Source: yesviz.com/viewport, Oct 2026
const DEVICES = [
  ["Galaxy S23-S26", 360, 780], ["Pixel 9", 360, 808], ["Z Flip 7", 360, 840], ["iPhone SE 3", 375, 667],
  ["iPhone 13 mini", 375, 812], ["iPhone 14-17e", 390, 844], ["iPhone 15-16", 393, 852], ["iPhone 17 Pro", 402, 874],
  ["Galaxy S25+ Ultra", 412, 891], ["Pixel 8 A-series", 412, 915], ["iPhone Air", 420, 912], ["Pixel 9 Pro", 427, 952],
  ["iPhone 16 Plus", 430, 932], ["iPhone 17 Pro Max", 440, 956], ["Pixel 9 Pro XL", 448, 997], ["Z Fold 7 inner", 984, 1092],
];
// browser bars estimate: portrait loses ~150px, landscape ~80px
const CASES = DEVICES.flatMap(([n, w, h]) => [
  [n, "portrait", w, h, "full"], [n, "portrait", w, h - 150, "bars"],
  [n, "landscape", h, w, "full"], [n, "landscape", h, w - 80, "bars"],
]);

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

(async () => {
  const server = await serve(PORT);
  const browser = await chromium.launch();
  let problems = 0;
  for (const state of ["long", "alt"]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, locale: "ko-KR" });
    const page = await ctx.newPage();
    if (!(await setup(page, state))) {
      problems++;
      console.log("✗", state, "| 검사할 문제를 만들지 못함 (출제 설정 확인 — setup)");
      await ctx.close();
      continue;
    }
    for (const [name, orient, w, h, mode] of CASES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(100);
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
      const label = `${state} | ${name} ${orient} ${w}x${h} ${mode} | white key ${m.whiteKey.toFixed(1)}px`;
      if (issues.length) {
        problems++;
        console.log("✗", label, "|", issues.join(" / "));
        await page.screenshot({ path: path.join(OUT, `${state}_${name.replace(/\W+/g, "_")}_${orient}_${mode}.png`) });
      }
    }
    await ctx.close();
  }
  console.log(problems ? `${problems} layouts with problems (screenshots in tests/audit-output)` : "All layouts OK");
  await browser.close();
  server.close();
  process.exitCode = problems ? 1 : 0;
})();
