// ===== 폰 화면 레이아웃 검사 — 페이지마다 같이 쓰는 부분 (기기 목록·서버·브라우저·스크린샷) =====
// 페이지별 검사는 tests/audit/<페이지>.js, 실행은 npm run audit -- <페이지> (tests/audit/run.js).
// 페이지를 고칠 때 그 페이지만 검사해요 — 다른 페이지까지 돌리면 시간만 들어서 (2026-11-25 사용자 요청으로 나눔)
// 처음 한 번 필요:  npm i  &&  npx playwright install chromium
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../tools/serve.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORT = 8799;   // 검사용 서버 (npm run dev의 8766과 겹치지 않게)
export const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(HERE, "..", "audit-output");   // 문제가 있는 화면의 스크린샷 (gitignore)

// CSS viewport sizes (portrait). Source: yesviz.com/viewport, Oct 2026
export const DEVICES = [
  ["Galaxy S23-S26", 360, 780], ["Pixel 9", 360, 808], ["Z Flip 7", 360, 840], ["iPhone SE 3", 375, 667],
  ["iPhone 13 mini", 375, 812], ["iPhone 14-17e", 390, 844], ["iPhone 15-16", 393, 852], ["iPhone 17 Pro", 402, 874],
  ["Galaxy S25+ Ultra", 412, 891], ["Pixel 8 A-series", 412, 915], ["iPhone Air", 420, 912], ["Pixel 9 Pro", 427, 952],
  ["iPhone 16 Plus", 430, 932], ["iPhone 17 Pro Max", 440, 956], ["Pixel 9 Pro XL", 448, 997], ["Z Fold 7 inner", 984, 1092],
];
// browser bars estimate: portrait loses ~150px, landscape ~80px
export const CASES = DEVICES.flatMap(([n, w, h]) => [
  [n, "portrait", w, h, "full"], [n, "portrait", w, h - 150, "bars"],
  [n, "landscape", h, w, "full"], [n, "landscape", h, w - 80, "bars"],
]);

/**
 * 검사 실행.
 * @param page    페이지 이름 (스크린샷 파일 앞에 붙음)
 * @param states  검사할 상태 이름들 — 상태마다 새 브라우저 창에서 setup 한 번, 그 뒤 기기 크기만 바꿔 가며 check
 * @param setup   async (page, state) → 그 상태를 만들었으면 true (못 만들면 그 상태는 실패로 셈)
 * @param check   async (page, { state, orient, w, h, mode }) → 문제 문장 목록 (없으면 [])
 */
export async function runAudit({ page: pageName, states, setup, check }) {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(PORT);
  const browser = await chromium.launch();
  let problems = 0;
  for (const state of states) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, locale: "ko-KR" });
    const page = await ctx.newPage();
    if (!(await setup(page, state))) {
      problems++;
      console.log("✗", state, "| 검사할 상태를 만들지 못함 (setup)");
      await ctx.close();
      continue;
    }
    for (const [name, orient, w, h, mode] of CASES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(100);
      const issues = await check(page, { state, orient, w, h, mode });
      if (issues.length) {
        problems++;
        console.log("✗", `${state} | ${name} ${orient} ${w}x${h} ${mode}`, "|", issues.join(" / "));
        await page.screenshot({ path: path.join(OUT, `${pageName}_${state}_${name.replace(/\W+/g, "_")}_${orient}_${mode}.png`) });
      }
    }
    await ctx.close();
  }
  console.log(problems ? `${problems} layouts with problems (screenshots in tests/audit-output)` : "All layouts OK");
  await browser.close();
  server.close();
  process.exitCode = problems ? 1 : 0;
}
