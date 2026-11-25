// 폰 화면 레이아웃 검사 — 청음 연습 (/trainer/ear/):  npm run audit -- ear
// 단계마다 [▶ 시작]을 누른 문제 화면에서, 폰처럼 카드 위를 화면 맨 위에 맞춘 뒤(pages/ear.js cardTopIntoView) 확인해요:
//   - 가로 스크롤 없음
//   - 가로: 건반과 [다음 문제]가 한 화면에
//   - 세로: [정답 확인]·[다음 문제] 줄은 화면 아래에 붙어 있으니(sticky) 건반이 그 줄에 가리지 않는지
// 상태: ① · ② · ③ 1마디 · ③ 2마디(악보 두 줄 — 가장 긺), ③은 최소 16분 · 코드 ① 문제 화면 · 코드 ① 정답 확인 뒤(큰보표에 음표).
// 폰 세로 안내(알약·가로 권유)는 닫은 상태 — 처음 한 번만 나오는 안내라서. 기기 목록·실행 틀은 tests/audit/common.js
import { runAudit, BASE } from "./common.js";

const STATES = {
  note1: ["note1"], note2: ["note2"], "note3-1bar": ["note3", 1], "note3-2bar": ["note3", 2],
  chord1: ["chord1"], "chord1-revealed": ["chord1", 0, true],
};
// 단계마다 건반·[다음 문제]·아래 버튼 줄
const SEL = {
  note: { kb: "#keyboard", next: "#btnNext", bar: "#panelNote .ear-actions" },
  chord: { kb: "#earCKeyboard", next: "#btnCNext", bar: "#panelChord .ear-actions" },
};

async function setup(page, state) {
  const [mode, bars, reveal] = STATES[state];
  await page.goto(`${BASE}/ko/trainer/ear/?mode=${mode}`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("chordoven.earScrollTip", "seen");
    localStorage.setItem("chordoven.earRotateTip", "closed");
  });
  await page.reload();
  await page.waitForSelector(".key", { state: "attached" });
  if (mode.startsWith("chord")) {
    await page.evaluate(() => document.getElementById("btnCStart").click());
    await page.waitForTimeout(400);
    if (reveal) { await page.evaluate(() => document.getElementById("btnCReveal").click()); await page.waitForTimeout(300); }
    return page.evaluate(() => !document.getElementById("btnCReplay").hidden);
  }
  if (bars) await page.evaluate(b => { document.getElementById("earBars" + b).click(); document.getElementById("earMin").value = 2; document.getElementById("earMin").dispatchEvent(new Event("input")); }, bars);
  await page.evaluate(() => document.getElementById("btnStart").click());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.getElementById("btnSkip"); if (!b.hidden) b.click(); });   // 스케일 재생 건너뛰기
  await page.waitForTimeout(700);
  return page.evaluate(() => !document.getElementById("btnReplay").hidden);   // 문제 화면이 됐는지
}

runAudit({
  page: "ear",
  states: Object.keys(STATES),
  setup,
  async check(page, { state, orient }) {
    await page.evaluate(() => window.scrollTo(0, document.querySelector(".ear-card").getBoundingClientRect().top + scrollY));
    await page.waitForTimeout(50);
    const s = SEL[state.startsWith("chord") ? "chord" : "note"];
    const m = await page.evaluate(s => {
      const r = q => document.querySelector(q).getBoundingClientRect();
      return {
        overflowX: document.documentElement.scrollWidth - innerWidth, vh: innerHeight, vw: innerWidth,
        kb: r(s.kb).bottom, next: r(s.next).bottom, nextRight: r(s.next).right, barTop: r(s.bar).top,
      };
    }, s);
    const issues = [];
    if (m.overflowX > 0) issues.push(`horizontal scroll ${m.overflowX}px`);
    if (m.nextRight > m.vw) issues.push("next button cut on the right");
    if (orient === "landscape") {
      if (m.kb > m.vh) issues.push(`keyboard cut off (${Math.round(m.kb - m.vh)}px)`);
      if (m.next > m.vh) issues.push(`next button below first screen (${Math.round(m.next - m.vh)}px)`);
    } else {
      if (m.next > m.vh + 1) issues.push(`next button below first screen (${Math.round(m.next - m.vh)}px)`);
      if (m.kb > m.barTop + 1) issues.push(`bottom bar covers keyboard (${Math.round(m.kb - m.barTop)}px)`);
    }
    return issues;
  },
});
