// ===== 코드 추론하기 — 오선지 악보 (SVG로 직접 그림) =====
// 코드 하나를 높은음자리표 한 줄에 온음표로 그려요 (3단계, 2026-11-08). 박자·마디·조표·기둥은 없음.
//   음 범위 F3~D6 → 아래 덧줄 최대 3개(C4 A3 F3), 위 덧줄 최대 2개(A5 C6)
//   2도로 붙은 음은 위쪽 음표 머리를 오른쪽으로 비켜 놓음 (♭9와 ♯9처럼 같은 줄에 놓이는 두 음도)
//   임시표(♯ ♭ 𝄪 𝄫)가 여럿이면 위아래로 겹치지 않게 왼쪽으로 열을 나눠 놓음. 임시표는 기기 글꼴에 따라 크기가 들쭉날쭉해서
//   도형으로 직접 그림 (음자리표 𝄞만 악보 글꼴 Noto Music)
//   색: 평소 글자색, 정답이면 모두 초록, 오답이면 "빠진 음"(건반의 주황)을 악보에서도 주황 (사용자 결정 2026-11-08)
// 오선 간격은 아래 SP(그림 단위) 하나로 정하고, 화면에서의 크기는 naming.css의 --staff-h(악보 높이)로 정해요.
// → 악보를 키우거나 줄이려면 --staff-h만 바꾸면 됨.
// 위치 계산(layout)은 화면 없이 테스트할 수 있게 따로 내보내요 (tests/naming.test.js).
import { $ } from "../common/dom.js";

const SP = 10;                 // 오선 간격 (그림 단위)
const HALF = SP / 2;           // 줄과 칸 한 칸 차이
const W = 130, H = 120;        // 그림 크기 (viewBox)
const TOP = 37;                // 맨 윗줄(F5)의 y
const NOTE_X = 92;             // 음표 머리 왼쪽 열의 가운데 x
const HEAD_W = 13;             // 음표 머리 폭 (오른쪽 열은 이만큼 옆)
const HEAD_RX = 6.3;           // 음표 머리 반폭
const ACC_PAD = 2;             // 음표 머리와 임시표 사이, 임시표 열 사이 틈

// 임시표 모양: 폭(그림 단위)과 위아래로 차지하는 줄·칸 수(음 높이 기준 [아래, 위]) — 겹침 판단에 씀.
// 플랫은 위로 길고 아래로 짧음 → 3도로 쌓인 플랫들은 두 열을 번갈아 씀 (실제 악보 조판 방식)
const SHAPE = {
  "1":  { w: 9,   lo: 3,   hi: 3 },     // ♯
  "-1": { w: 7.5, lo: 1,   hi: 4 },     // ♭
  "2":  { w: 7.5, lo: 1.5, hi: 1.5 },   // 𝄪
  "-2": { w: 14.5, lo: 1,  hi: 4 },     // 𝄫 (플랫 두 개를 붙여서)
};

// 줄·칸 번호: C4 = 28, D4 = 29 … (옥타브 × 7 + 글자). 오선은 E4(30)부터 F5(38)까지 짝수 번호가 줄
const stepOf = n => n.oct * 7 + n.l;
const yOf = step => TOP + (38 - step) * HALF;

/**
 * 음표 머리·임시표·덧줄 위치 계산 (화면 없음).
 * @param notes  [{ midi, name, l, a, oct }] — core/naming.js의 문제 음
 * @returns { heads: [{ note, step, right, x, y }], accs: [{ note, a, col, x, y }], ledgers: [{ y, x1, x2 }] }
 */
export function layout(notes) {
  const sorted = notes.slice().sort((p, q) => stepOf(p) - stepOf(q) || p.a - q.a);
  // 음표 머리: 아래에서부터. 바로 아래 음과 2도(또는 같은 줄)이고 그 음이 왼쪽 열이면 오른쪽 열로
  const heads = [];
  for (const n of sorted) {
    const step = stepOf(n);
    const prev = heads[heads.length - 1];
    const right = !!prev && step - prev.step <= 1 && !prev.right;
    heads.push({ note: n, step, right, x: NOTE_X + (right ? HEAD_W : 0), y: yOf(step) });
  }
  // 임시표: 위에서부터, 위아래로 차지하는 자리가 겹치지 않는 가장 가까운(오른쪽) 열에
  const cols = [];   // 열마다 [이미 차지한 [아래, 위] 범위들]
  const accs = [];
  for (const h of heads.slice().reverse()) {
    if (!h.note.a) continue;
    const sh = SHAPE[String(h.note.a)], lo = h.step - sh.lo, hi = h.step + sh.hi;
    let c = 0;
    while (cols[c] && cols[c].some(([a, b]) => lo < b && a < hi)) c++;
    (cols[c] = cols[c] || []).push([lo, hi]);
    accs.push({ note: h.note, a: h.note.a, col: c, y: h.y });
  }
  // 열의 x: 음표 머리 왼쪽에서부터 왼쪽으로, 열 폭 = 그 열에서 가장 넓은 임시표
  const colW = cols.map((_, c) => Math.max(...accs.filter(x => x.col === c).map(x => SHAPE[String(x.a)].w)));
  let right = NOTE_X - HEAD_RX - ACC_PAD;
  const colRight = colW.map(w => { const r = right; right -= w + ACC_PAD; return r; });
  for (const x of accs) x.x = colRight[x.col] - SHAPE[String(x.a)].w / 2;   // 임시표 가운데
  // 덧줄: 오선 밖의 음까지 짝수 번호(줄) 자리마다. 오른쪽 열 음표가 있는 높이까지는 오른쪽으로 길게
  const ledgers = [];
  const lo = Math.min(...heads.map(h => h.step), 30), hi = Math.max(...heads.map(h => h.step), 38);
  const wide = s => heads.some(h => h.right && (s < 30 ? h.step <= s + 1 : h.step >= s - 1));
  for (let s = 28; s >= lo; s -= 2) ledgers.push({ y: yOf(s), x1: NOTE_X - 9, x2: NOTE_X + 9 + (wide(s) ? HEAD_W : 0) });
  for (let s = 40; s <= hi; s += 2) ledgers.push({ y: yOf(s), x1: NOTE_X - 9, x2: NOTE_X + 9 + (wide(s) ? HEAD_W : 0) });
  return { heads, accs, ledgers };
}

// ---------- 임시표 도형 (가운데가 음 높이, 오선 간격 10 기준) ----------
const poly = pts => "M" + pts.map(p => p.join(",")).join("L") + "Z";
const at = (d, dx) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(+x + dx).toFixed(2)},${y}`);
const SHARP = poly([[-2.4, -12], [-1.3, -12], [-1.3, 11], [-2.4, 11]]) + poly([[1.3, -13], [2.4, -13], [2.4, 10], [1.3, 10]])
  + poly([[-4.5, -2.8], [4.5, -6], [4.5, -3.4], [-4.5, -0.2]]) + poly([[-4.5, 4.4], [4.5, 1.2], [4.5, 3.8], [-4.5, 7]]);
const FLAT = poly([[-3.4, -14], [-2.3, -14], [-2.3, 5], [-3.4, 5]])
  + "M-2.3,-0.6C-0.4,-4.6 5.4,-4.4 3.9,0C3,2.5 0.4,3.9 -2.3,5.2L-2.3,3.4C-0.4,2.3 2,0.6 2.1,-0.9C2.3,-2.6 -0.5,-2.3 -2.3,0.6Z";
const DSHARP = poly([[-3.6, -3.6], [-1, -3.6], [0, -1.4], [1, -3.6], [3.6, -3.6], [3.6, -1], [1.4, 0], [3.6, 1], [3.6, 3.6], [1, 3.6], [0, 1.4], [-1, 3.6], [-3.6, 3.6], [-3.6, 1], [-1.4, 0], [-3.6, -1]]);
const ACC_PATH = { "1": SHARP, "-1": FLAT, "2": DSHARP, "-2": at(FLAT, -3.85) + at(FLAT, 3.35) };   // 𝄫: 첫 플랫의 오른쪽 끝에 둘째 플랫의 기둥이 닿게

// 온음표 머리: 비스듬한 타원 안에 반대로 기운 빈 타원 (fill-rule evenodd로 가운데를 비움)
function ellipse(cx, cy, rx, ry, deg, steps = 28) {
  const r = deg * Math.PI / 180, pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push(`${(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(2)},${(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(2)}`);
  }
  return "M" + pts.join("L") + "Z";
}
const headPath = (x, y) => ellipse(x, y, HEAD_RX, 4.6, -12) + ellipse(x, y, 3.5, 2.4, 55);

/**
 * 악보 그리기.
 * @param notes  문제의 음 (없으면 [] — 오선과 음자리표만)
 * @param bad    주황으로 표시할 MIDI 번호들 (오답일 때 "빠진 음")
 * @param good   정답을 맞혔는지 (모두 초록)
 */
export function drawStaff(notes, bad = new Set(), good = false) {
  const { heads, accs, ledgers } = layout(notes);
  const cls = n => (good ? "good" : bad.has(n.midi) ? "bad" : "");
  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  for (let i = 0; i < 5; i++) svg += `<line class="st-line" x1="0" x2="${W}" y1="${TOP + i * SP}" y2="${TOP + i * SP}"/>`;
  // 높은음자리표: 악보 글꼴의 𝄞 (글자 기준선을 G4 줄에 맞춤)
  svg += `<text class="st-clef" x="3" y="${yOf(32)}">𝄞</text>`;
  for (const g of ledgers) svg += `<line class="st-ledger" x1="${g.x1}" x2="${g.x2}" y1="${g.y}" y2="${g.y}"/>`;
  for (const a of accs) svg += `<path class="st-acc ${cls(a.note)}" transform="translate(${a.x.toFixed(2)},${a.y})" d="${ACC_PATH[String(a.a)]}"/>`;
  for (const h of heads) svg += `<path class="st-head ${cls(h.note)}" fill-rule="evenodd" d="${headPath(h.x, h.y)}"/>`;
  svg += `</svg>`;
  $("staff").innerHTML = svg;
}
