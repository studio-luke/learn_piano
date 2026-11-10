// ===== 코드 초견 — 8마디 코드진행 악보 그리기 =====
// 4마디 × 2줄 (폰 세로도 같음 — 대신 가로로 돌리라는 안내, 사용자 결정 2026-11-10).
// 한 줄 = 코드 기호 줄(HTML) + 오선(SVG). 오선에는 높은음자리표, 첫 줄에만 박자표, 마디마다 온쉼표, 조표 없음,
// 1마디 앞·8마디 뒤에 도돌이표. 코드 기호는 그 코드가 시작하는 박 위치에(마디 안에서 펄스 비율대로).
// 코드 기호는 HTML로 그림 — 텐션을 작게 위로 올리거나 세로로 쌓는 모양(practice.css .symbol .sup / .stack)을 그대로 쓰려고.
// 오선의 x 좌표(그림 단위 0~1000)를 %로 바꿔 코드 기호 위치를 맞추므로 화면 폭이 바뀌어도 같이 늘고 줄어요.
import { $, esc, symbolHTML } from "../common/dom.js";
import { BARS } from "./progression.js";

const W = 1000, H = 84;                  // 오선 한 줄 그림 크기 (viewBox)
const TOP = 22, SP = 10;                 // 맨 윗줄 y, 줄 간격
const line = i => TOP + i * SP;          // i번째 줄(0 = 맨 위)의 y
const PER_LINE = BARS / 2;               // 한 줄 마디 수 (4)
const CLEF_END = 46;                     // 음자리표 다음 x
const METER_END = 82;                    // 박자표 다음 x (첫 줄만)
const REPEAT = 18;                       // 도돌이표(굵은 줄 + 얇은 줄 + 점 두 개)가 차지하는 폭

/** 한 줄의 마디 시작·끝 x: [[x1, x2] × 4] */
export function barXs(row) {
  const left = row === 0 ? METER_END + REPEAT : CLEF_END + 6;
  const right = row === 1 ? W - REPEAT : W;
  const w = (right - left) / PER_LINE;
  return Array.from({ length: PER_LINE }, (_, i) => [left + i * w, left + (i + 1) * w]);
}

/** 오선 한 줄 SVG */
function staffSVG(row, meter) {
  const xs = barXs(row);
  let s = `<svg class="pg-staff" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
  for (let i = 0; i < 5; i++) s += `<line class="pg-line" x1="0" x2="${W}" y1="${line(i)}" y2="${line(i)}"/>`;
  // 높은음자리표: 악보 글꼴의 𝄞 (글자 기준선을 G4 줄 = 아래에서 둘째 줄에)
  s += `<text class="pg-clef" x="4" y="${line(3)}">𝄞</text>`;
  if (row === 0) {   // 박자표: 위·아래 숫자를 두 칸씩 차지하게
    const cx = (CLEF_END + METER_END) / 2;
    s += `<text class="pg-meter" x="${cx}" y="${line(2) - 1}">${meter.num}</text><text class="pg-meter" x="${cx}" y="${line(4) - 1}">${meter.den}</text>`;
  }
  const dots = x => `<circle class="pg-fill" cx="${x}" cy="${line(1) + SP / 2}" r="2.2"/><circle class="pg-fill" cx="${x}" cy="${line(2) + SP / 2}" r="2.2"/>`;
  const bar = (x, cls = "pg-bar") => `<line class="${cls}" x1="${x}" x2="${x}" y1="${line(0)}" y2="${line(4)}"/>`;
  if (row === 0) {   // 1마디 앞 도돌이표: 굵은 줄 · 얇은 줄 · 점
    const x0 = METER_END + 2;
    s += bar(x0, "pg-thick") + bar(x0 + 7) + dots(x0 + 13);
  }
  xs.forEach(([x1, x2], i) => {
    // 온쉼표: 위에서 둘째 줄에 매달린 직사각형, 마디 가운데
    s += `<rect class="pg-fill" x="${(x1 + x2) / 2 - 7}" y="${line(1)}" width="14" height="${SP / 2}"/>`;
    if (i < PER_LINE - 1 || row === 0) s += bar(i === PER_LINE - 1 ? x2 - 0.75 : x2);
  });
  if (row === 1) {   // 8마디 뒤 도돌이표: 점 · 얇은 줄 · 굵은 줄
    s += dots(W - 15) + bar(W - 9) + bar(W - 3, "pg-thick");
  }
  return s + "</svg>";
}

/**
 * 진행 하나를 #progSheet에 그림.
 * @param p  improv/progression.js generateProgression의 결과
 */
export function drawSheet(p) {
  const box = $("progSheet");
  let html = "";
  for (let row = 0; row < 2; row++) {
    const xs = barXs(row);
    let chords = "";
    for (let i = 0; i < PER_LINE; i++) {
      const bar = p.bars[row * PER_LINE + i], [x1, x2] = xs[i];
      for (const c of bar) {
        const x = x1 + 6 + (x2 - x1) * (c.start / p.meter.pulses);   // 마디 안에서 그 코드가 시작하는 박 위치 (마디선에서 조금 띄움)
        const inner = c.short ? `<span class="slash-bass">/${esc(c.q.bass)}</span>` : symbolHTML(c.q);
        chords += `<span class="symbol pg-chord" style="left:${(x / W * 100).toFixed(2)}%" aria-label="${esc(c.q.symbol)}">${inner}</span>`;
      }
    }
    html += `<div class="pg-row"><div class="pg-chords">${chords}</div>${staffSVG(row, p.meter)}</div>`;
  }
  box.innerHTML = html;
  box.setAttribute("aria-label", p.meter.id + " — " + p.bars.map(b => b.map(c => c.q.symbol).join(" ")).join(" | "));
  fitLabels();
}

/**
 * 긴 코드 기호가 다음 코드 기호를 덮지 않게: 기호마다 "다음 기호가 시작하는 곳(줄 끝)까지"의 폭에 맞춰 글씨를 줄임.
 * 화면 폭이 바뀌면 다시 (아래 resize). 줄이지 않아도 되면 CSS 크기 그대로
 */
export function fitLabels() {
  for (const row of document.querySelectorAll("#progSheet .pg-chords")) {
    const labels = [...row.children];
    const W0 = row.clientWidth;
    labels.forEach((el, i) => {
      el.style.fontSize = "";
      const left = el.offsetLeft, next = labels[i + 1] ? labels[i + 1].offsetLeft : W0;
      const room = next - left - 6, need = el.scrollWidth;
      if (need > room && room > 0) el.style.fontSize = (room / need).toFixed(3) + "em";
    });
  }
}
let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitLabels, 100); });
