// Phone layout check: npm run audit
// Needs once: npm i  &&  npx playwright install chromium
// Opens index.html at 16 phone sizes, portrait/landscape, with and without browser bars,
// in the two heaviest states (long stacked chord, 7alt answer) and reports clipped buttons/keyboard.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL = "file://" + path.resolve(__dirname, "../index.html");
const OUT = path.join(__dirname, "audit-output");
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
  await page.waitForTimeout(200);
  // the log-in button is hidden until Supabase is configured; check the header with it shown (long nickname)
  await page.evaluate(() => {
    const b = document.getElementById("accountBtn");
    b.hidden = false; b.classList.add("signed-in");
    document.getElementById("accountLogin").hidden = true;
    const n = document.getElementById("accountName"); n.hidden = false; n.textContent = "가나다라마바사아자차카타파하";
  });
  if (state === "long") {
    for (const g of ["sus", "seventh", "sixth", "add", "tension"]) await page.click(`[data-group="${g}"]`);
    await page.click("#optC"); await page.click("#cMax2"); await page.click("#advToggle"); await page.click("#optD");
    await page.waitForTimeout(400);
    for (let i = 0; i < 3000; i++) {
      const l = await page.getAttribute("#symbol", "aria-label");
      if (l && l.length >= 13 && (await page.$(".stack"))) break;
      await page.evaluate(() => document.getElementById("btnNext").click());
    }
  } else {
    for (const t of ["maj", "min", "dim", "aug"]) await page.click("#type-" + t);
    await page.click("#type-dom7"); await page.click("#optC"); await page.waitForTimeout(400);
    for (let i = 0; i < 500; i++) {
      const l = await page.getAttribute("#symbol", "aria-label");
      if (l && l.endsWith("alt")) break;
      await page.evaluate(() => document.getElementById("btnNext").click());
    }
    await page.evaluate(() => document.getElementById("btnReveal").click());
  }
}

(async () => {
  const browser = await chromium.launch();
  let problems = 0;
  for (const state of ["long", "alt"]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, locale: "ko-KR" });
    const page = await ctx.newPage();
    await setup(page, state);
    for (const [name, orient, w, h, mode] of CASES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(100);
      await page.evaluate(() => window.scrollTo(0, 0));
      const m = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const stack = document.querySelector(".stack");
        return {
          overflowX: document.documentElement.scrollWidth - innerWidth, vh: innerHeight,
          symTop: r("#symbol").top, stackOverHint: stack ? stack.getBoundingClientRect().bottom - r("#hint").top : -1,
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
  process.exitCode = problems ? 1 : 0;
})();
