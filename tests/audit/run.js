// 폰 화면 레이아웃 검사 실행:  npm run audit -- <페이지>   (예: npm run audit -- ear)
// 페이지마다 검사가 따로 있어서, 고친 페이지만 돌려요 (tests/audit/common.js)
const PAGES = {
  chords: "./chords.js",   // 랜덤 코드 연습 (/trainer/chords/)
  ear: "./ear.js",         // 청음 연습 (/trainer/ear/)
};
const name = process.argv[2];
if (!PAGES[name]) {
  console.log(`검사할 페이지를 골라 주세요:  npm run audit -- <${Object.keys(PAGES).join(" | ")}>`);
  process.exitCode = 1;
} else await import(PAGES[name]);
