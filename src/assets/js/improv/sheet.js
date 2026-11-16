// ===== 코드 초견 — 8마디 코드진행 악보 그리기 =====
// 4마디 × 2줄, 폰 세로는 2마디 × 4줄 (사용자 결정 2026-11-10 — 한 줄 마디 수는 pages/improv.js가 setPerLine으로 정함)
// 한 줄 = 코드 기호 줄(HTML) + 오선(SVG). 오선에는 높은음자리표, 조표(난이도 0만, 매 줄), 첫 줄에만 박자표, 마디마다 온쉼표,
// 1마디 앞·8마디 뒤에 도돌이표. 코드 기호는 그 코드가 시작하는 박 위치에(마디 안에서 펄스 비율대로).
// 코드 기호는 HTML로 그림 — 텐션을 작게 위로 올리거나 세로로 쌓는 모양(practice.css .symbol .sup / .stack)을 그대로 쓰려고.
// 오선의 x 좌표(그림 단위 0~1000)를 %로 바꿔 코드 기호 위치를 맞추므로 화면 폭이 바뀌어도 같이 늘고 줄어요.
import { $, esc, symbolHTML } from "../common/dom.js";
import { BARS } from "./progression.js";

const H = 84;                            // 오선 한 줄 그림 높이 (viewBox)
let W = 1000;                            // 오선 한 줄 그림 폭 — 한 줄 2마디면 560으로 좁혀서, 화면에 그릴 때 오선이 그만큼 크게 보이게
const TOP = 22, SP = 10;                 // 맨 윗줄 y, 줄 간격
const line = i => TOP + i * SP;          // i번째 줄(0 = 맨 위)의 y
let perLine = 4;                         // 한 줄 마디 수 (4 → 2줄, 2 → 4줄)
let last = null;                         // 마지막으로 그린 진행 (한 줄 마디 수를 바꾸면 다시 그리려고)
const CLEF_END = 46;                     // 음자리표 다음 x
const METER_END = 82;                    // 박자표 다음 x (첫 줄만)
const REPEAT = 18;                       // 도돌이표(굵은 줄 + 얇은 줄 + 점 두 개)가 차지하는 폭
const ACC_W = 8;                         // 조표 ♯·♭ 하나의 폭
let sig = { n: 0, sharp: true };         // 지금 그리는 악보의 조표 (n = ♯·♭ 개수)
const sigW = () => sig.n ? sig.n * ACC_W + 4 : 0;   // 음자리표 뒤에 조표가 차지하는 폭

// 장조 조표 (8마디 초견 난이도 0은 장조만 — grammar.js MAJOR_KEYS의 철자)
const SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1, "B♭": -2, "E♭": -3, "A♭": -4, "D♭": -5, "G♭": -6 };
// 높은음자리표의 ♯·♭ 자리: 맨 윗줄(F5)에서 반 칸씩 아래로 몇 칸인지 — ♯ F C G D A E B, ♭ B E A D G C F
const SHARP_AT = [0, 3, -1, 2, 5, 1, 4], FLAT_AT = [4, 1, 5, 2, 6, 3, 7];

const rowCount = () => BARS / perLine;
const isLast = row => row === rowCount() - 1;

/** 한 줄의 마디 시작·끝 x: [[x1, x2] × 한 줄 마디 수] — 첫 줄은 박자표·시작 도돌이표 뒤부터, 마지막 줄은 끝 도돌이표 앞까지 */
export function barXs(row) {
  const left = (row === 0 ? METER_END + REPEAT : CLEF_END + 6) + sigW();
  const right = isLast(row) ? W - REPEAT : W;
  const w = (right - left) / perLine;
  return Array.from({ length: perLine }, (_, i) => [left + i * w, left + (i + 1) * w]);
}

/** 한 줄 마디 수 바꾸기 (4 또는 2) — 이미 그린 악보가 있으면 다시 그림 */
export function setPerLine(n) {
  if (n === perLine) return;
  perLine = n;
  W = n === 2 ? 560 : 1000;
  if (last) drawSheet(last);
}

/** 오선 한 줄 SVG */
function staffSVG(row, meter) {
  const xs = barXs(row);
  let s = `<svg class="pg-staff" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
  for (let i = 0; i < 5; i++) s += `<line class="pg-line" x1="0" x2="${W}" y1="${line(i)}" y2="${line(i)}"/>`;
  // 높은음자리표: 악보 글꼴의 𝄞 (글자 기준선을 G4 줄 = 아래에서 둘째 줄에)
  s += `<text class="pg-clef" x="4" y="${line(3)}">𝄞</text>`;
  s += keySigSVG();
  const off = sigW();   // 조표가 있으면 박자표·도돌이표를 그만큼 뒤로
  if (row === 0) {   // 박자표: 위·아래 숫자를 두 칸씩 차지하게
    const cx = (CLEF_END + METER_END) / 2 + off;
    s += `<text class="pg-meter" x="${cx}" y="${line(2) - 1}">${meter.num}</text><text class="pg-meter" x="${cx}" y="${line(4) - 1}">${meter.den}</text>`;
  }
  const dots = x => `<circle class="pg-fill" cx="${x}" cy="${line(1) + SP / 2}" r="2.2"/><circle class="pg-fill" cx="${x}" cy="${line(2) + SP / 2}" r="2.2"/>`;
  const bar = (x, cls = "pg-bar") => `<line class="${cls}" x1="${x}" x2="${x}" y1="${line(0)}" y2="${line(4)}"/>`;
  if (row === 0) {   // 1마디 앞 도돌이표: 굵은 줄 · 얇은 줄 · 점
    const x0 = METER_END + 2 + off;
    s += bar(x0, "pg-thick") + bar(x0 + 7) + dots(x0 + 13);
  }
  xs.forEach(([x1, x2], i) => {
    // 온쉼표: 위에서 둘째 줄에 매달린 직사각형, 마디 가운데
    s += `<rect class="pg-fill" x="${(x1 + x2) / 2 - 7}" y="${line(1)}" width="14" height="${SP / 2}"/>`;
    if (i < perLine - 1 || !isLast(row)) s += bar(i === perLine - 1 ? x2 - 0.75 : x2);   // 줄 끝 마디선은 오선 끝에 붙여서
  });
  if (isLast(row)) {   // 8마디 뒤 도돌이표: 점 · 얇은 줄 · 굵은 줄
    s += dots(W - 15) + bar(W - 9) + bar(W - 3, "pg-thick");
  }
  return s + "</svg>";
}

/** 조표 SVG — ♯·♭를 글꼴 대신 선으로 그림(글꼴마다 기준선이 달라 줄에 안 맞아서) */
function keySigSVG() {
  let s = "";
  for (let i = 0; i < sig.n; i++) {
    const x = CLEF_END + 6 + i * ACC_W, y = line(0) + (sig.sharp ? SHARP_AT : FLAT_AT)[i] * SP / 2;
    if (sig.sharp) {   // ♯: 세로줄 둘 + 오른쪽 위로 기운 굵은 가로줄 둘
      s += `<path class="pg-acc" d="M${x - 1.8} ${y - 10}V${y + 11}M${x + 1.8} ${y - 11}V${y + 10}"/>`
        + `<path class="pg-acc-bar" d="M${x - 4} ${y - 1.5}L${x + 4} ${y - 4.5}M${x - 4} ${y + 4.5}L${x + 4} ${y + 1.5}"/>`;
    } else {           // ♭: 위로 긴 세로줄 + 아래쪽 둥근 배
      s += `<path class="pg-acc" d="M${x - 3} ${y - 14}V${y + 5}"/>`
        + `<path class="pg-acc-bar" d="M${x - 3} ${y + 5}C${x + 6} ${y} ${x + 5} ${y - 5} ${x - 3} ${y - 1}"/>`;
    }
  }
  return s;
}

/**
 * 진행 하나를 #progSheet에 그림.
 * @param p  improv/progression.js generateProgression의 결과
 */
export function drawSheet(p) {
  last = p;
  const k = p.sig ? SIG[p.sig] || 0 : 0;
  sig = { n: Math.abs(k), sharp: k > 0 };
  const box = $("progSheet");
  box.classList.toggle("two-per-line", perLine === 2);   // 한 줄 2마디면 코드 기호를 크게 (improv.css)
  let html = "";
  for (let row = 0; row < rowCount(); row++) {
    const xs = barXs(row);
    let chords = "";
    for (let i = 0; i < perLine; i++) {
      const bar = p.bars[row * perLine + i], [x1, x2] = xs[i];
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
