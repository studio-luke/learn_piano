// ===== 코드 초견 — 8마디 코드진행 만들기 (순수 함수, tests/improv.test.js) =====
// 실용음악 입시처럼 8마디 코드진행을 만들어요. 코드를 고르는 문법은 improv/grammar.js(6단계, 2026-11-11 — 지금 난이도 0~4),
// 여기서는 박자표·마디 나누기·기호 표기·긴 코드 자리 등 "악보 모양"을 정해요. 화면은 improv/sheet.js, 출제 설정은 improv/prog-settings.js.
//
// 사용자 결정 (chordoven-spec.md "코드 초견"):
//   - 텐션(옵션 A): 꺼짐 / 최대 1개 / 최대 2개 / HARD(텐션 코드 M9 M13 m9 m11 9 13도 — 텐션 코드는 추가 텐션 1개까지). 7alt는 텐션이 켜져 있고 난이도 4부터
//   - 분수코드(옵션 B): 베이스 진행을 잇는 전위형, V7sus4의 하이브리드 표기(IV/V · IIm7/V) — grammar.js
//   - 코드 개수(옵션 C): 최소(한 마디에 하나) / 적정(최대 2개) / 최대(최대 4개). 코드는 강박에서만 바뀜
//   - 박자표(옵션 E): 꺼지면 4/4, 켜면 6/8 · 3/4 · 2/4 · 12/8 · 9/8도 (빈도 순)
//   - 코드 진행 난이도 1~6 · 코드 개연성 1~4 (2026-11-11) — grammar.js
//   - 기호 표기: 진행마다 M·m·dim·aug를 글자/기호 중 하나로 정해 8마디 내내 같게. ø는 쓰지 않음, 텐션의 ♯·♭을 +·-로 쓰지 않음
//
// 박(펄스): 코드가 바뀔 수 있는 자리. 4/4는 4분음표 4개, 3/4는 3개, 2/4는 2개, 6/8은 점4분음표 2개, 9/8은 3개, 12/8은 4개.
// 메트로놈도 이 펄스마다 침 (6/8은 한 마디에 2번).
import { generateGrammar, generateRandom, strong } from "./grammar.js";

export const BARS = 8;

/** 박자표: 화면 글자(위·아래 숫자), 한 마디 펄스 수, 출제 비율(박자표 옵션을 켰을 때) */
export const METERS = [
  { id: "4/4", num: 4, den: 4, pulses: 4, w: 50 },
  { id: "6/8", num: 6, den: 8, pulses: 2, w: 18 },
  { id: "3/4", num: 3, den: 4, pulses: 3, w: 14 },
  { id: "2/4", num: 2, den: 4, pulses: 2, w: 8 },
  { id: "12/8", num: 12, den: 8, pulses: 4, w: 6 },
  { id: "9/8", num: 9, den: 8, pulses: 3, w: 4 },
];


/** 한 마디를 코드 몇 개로 나눌지: [펄스 수 배열, 가중치]. 코드 개수 옵션·한 마디 펄스 수별 */
const SPLITS = {
  low: { 2: [[[2], 1]], 3: [[[3], 1]], 4: [[[4], 1]] },
  // 적정: 최대 2개 — 마디의 약 40%를 반으로 (3박 마디는 2+1)
  mid: { 2: [[[2], 0.6], [[1, 1], 0.4]], 3: [[[3], 0.6], [[2, 1], 0.4]], 4: [[[4], 0.6], [[2, 2], 0.4]] },
  // 최대: 최대 4개 (사용자 결정 2026-11-10)
  //   4펄스 마디(4/4·12/8): 하나 25.8% · 코드 둘 58.2%(그 안에서 2+2 91% · 3+1 8% · 1+3 1%) · 2+1+1 10% · 1+1+2 4% · 1+1+1+1 2%
  //   3펄스 마디(3/4·9/8): 1+1+1은 1%, 나머지 99%는 예전 비율대로(하나 · 2+1 · 1+2)
  high: {
    2: [[[2], 0.4], [[1, 1], 0.6]],
    3: [[[3], 0.37125], [[2, 1], 0.495], [[1, 2], 0.12375], [[1, 1, 1], 0.01]],
    4: [[[4], 0.258], [[2, 2], 0.52962], [[3, 1], 0.04656], [[1, 3], 0.00582], [[2, 1, 1], 0.1], [[1, 1, 2], 0.04], [[1, 1, 1, 1], 0.02]],
  },
};


/** 가중치(w)대로 하나 고르기 */
function pickBy(list, w, rnd) {
  let x = rnd() * list.reduce((a, e) => a + w(e), 0);
  for (const e of list) { x -= w(e); if (x < 0) return e; }
  return list[list.length - 1];
}

/**
 * 진행 하나에 쓸 기호 표기 — M·m·dim·aug 각각 글자와 기호 중 하나 (ø는 쓰지 않음).
 * 기호가 될 확률(사용자 결정 2026-11-10): M → △ 10%, m → - 50%, dim → ° 60%, aug → + 60%.
 * 단 dim·aug 코드가 하나라도 1박짜리 자리에 오면 그 악보 전체에서 그 기호를 씀(generateProgression — 1박 자리는 좁아서)
 */
export const SYMBOL_ODDS = { M: 0.1, m: 0.5, dim: 0.6, aug: 0.6 };
export const randomStyle = rnd => ({
  M: rnd() < SYMBOL_ODDS.M ? "△" : "M", m: rnd() < SYMBOL_ODDS.m ? "-" : "m",
  dim: rnd() < SYMBOL_ODDS.dim ? "°" : "dim", aug: rnd() < SYMBOL_ODDS.aug ? "+" : "aug",
});

/**
 * 엔진이 만든 코드 이름(표준 표기)을 진행의 기호 표기로 바꿈. 바꾸는 것은 코드 종류 부분(head)만 — 텐션 괄호는 그대로
 *   m7 → -7, m(add9) → -(add9), mM7 → -△7, M7 → △7, dim7 → °7, aug7 → +7, augM7 → +△7
 */
export function restyle(q, style) {
  let h = q.head;
  if (style.m === "-") h = h.replace(/^m/, "-");
  if (style.M === "△") h = h.replace(/M/g, "△");
  if (style.dim === "°") h = h.replace("dim", "°");
  if (style.aug === "+") h = h.replace("aug", "+");
  const label = h + (q.items.length ? "(" + q.items.join(",") + ")" : "");
  return { ...q, head: h, label, symbol: q.rootName + label + (q.bass ? "/" + q.bass : "") };
}

/**
 * 코드 기호가 화면에서 차지하는 길이(어림, 글자 수 단위) — 긴 코드는 1박짜리 자리에 두지 않으려고 (사용자 결정 2026-11-10).
 * 근음·코드 종류·베이스 글자는 1씩, 괄호 부분은 작게 위로 올라가서 0.6씩. 텐션이 2개 이상이면 세로로 쌓이니 긴 쪽 한 줄만.
 * 예: Cm7 3 · Gm7(♭5) 5.4 · C7sus4 6 · B♭M7/C 6 · F♯m7(♭5) 6.4 · A♭m7/G♭ 7 · D♭7sus4(9) 8.8
 */
export function displayLength(q) {
  const len = x => [...x].length;
  const big = len(q.rootName + q.head) + (q.bass ? 1 + len(q.bass) : 0);
  const small = q.items.length >= 2 ? Math.max(...q.items.map(len)) + 1 : q.items.length ? len(q.items[0]) + 2 : 0;
  return big + 0.6 * small;
}
/** 긴 코드 기준: displayLength가 이 값 이상 (사용자 결정 2026-11-10 — 1박은 짧게 치고 넘어가서 길고 어려운 코드가 적게 나오는 게 좋음) */
export const LONG = 6;
export const isLong = q => !q.error && displayLength(q) >= LONG;

/**
 * 8마디 코드진행 하나.
 * @param o    출제 설정 { tension: "off"|"1"|"2"|"hard", slash, count: "low"|"mid"|"high", level: 0~6, chance: 1~4, meters }
 *             level = 코드 진행 난이도(0은 2026-11-12 추가 — 분수코드 없음), chance = 코드 개연성 (2026-11-11). 코드 재료는 난이도 0~4까지 — 5~6은 4와 같은 재료에 분수코드·텐션 비율만 다름(improv/grammar.js)
 * @param rnd  난수 함수 (테스트에서 고정값)
 * @returns { meter, style, key, bars: [[{ q, start, len, short }] × 8] }
 *   start·len은 펄스 단위, short는 "/B♭"처럼 베이스만 쓸지(같은 마디에서 바로 앞과 위 코드가 같고 베이스만 다름)
 */
export function generateProgression(o, rnd = Math.random) {
  const meter = o.meters ? pickBy(METERS, m => m.w, rnd) : METERS[0];
  const style = randomStyle(rnd);
  const splits = SPLITS[o.count] || SPLITS.mid;
  const chance = o.chance || 2, level = Math.min(o.level ?? 2, 6);   // 코드 재료는 난이도 4까지(grammar.js) — 5~6은 하이브리드·낯선 전위·텐션 비율만 다름
  // 마디 나누기 먼저. 화성 리듬 가속(사용자 결정 2026-11-11): 4·8마디는 코드 여러 개로 나누는 쪽에 개연성 1 ×1.6 · 2 ×1.2 · 3·4 없음
  const accel = { 1: 1.6, 2: 1.2 }[chance] || 1;
  const slots = Array.from({ length: BARS }, (_, b) => {
    const lens = pickBy(splits[meter.pulses], x => x[1] * ((b === 3 || b === 7) && x[0].length > 1 ? accel : 1), rnd)[0];
    let start = 0;
    return lens.map((len, i) => { const sl = { len, start, strong: strong(lens, i, b) }; start += len; return sl; });
  });
  // 긴 코드(isLong)는 마디의 반 이상인 자리에만, 한 마디에 하나까지 (2+2에 둘 다 긴 코드 X, 1박 자리 X — 사용자 결정 2026-11-10).
  // 4박: 한 마디 전체 · 2+2의 한쪽 · 3+1의 "3" · 2+1+1의 "2" / 3박: 2+1·1+2의 "2" / 2박(2/4·6/8): 1+1의 한쪽
  // 생성기가 코드를 고를 때 이 검사로 거름 (기호 표기를 바꾼 뒤의 길이로 판단 — dim7보다 °7이 짧음)
  const longIn = q => isLong(restyle(q, style));
  const fits = (q, slot, barChords) => !longIn(q) || (slot.len * 2 >= meter.pulses && !barChords.some(longIn));
  const g = (chance === 4 ? generateRandom : generateGrammar)({ tension: o.tension, slash: !!o.slash && level > 0, level, chance }, slots, rnd, fits);
  const bars = slots.map((bar, b) => bar.map((sl, i) => ({ raw: g.chords[b][i], start: sl.start, len: sl.len })));
  // dim·aug가 하나라도 1박짜리 자리에 오면 이 악보에서는 반드시 기호(°·+)로 (사용자 결정 2026-11-10 — 1박 자리는 좁아서).
  // 기호로 바꾸면 이름이 짧아지기만 하므로 위의 긴 코드 자리 규칙은 그대로 지켜짐
  const oneBeat = bars.flat().filter(x => x.len === 1);
  const restyled = { ...style };
  if (oneBeat.some(x => x.raw.head.includes("dim"))) restyled.dim = "°";
  if (oneBeat.some(x => x.raw.head.includes("aug"))) restyled.aug = "+";
  const upper = x => x.rootName + x.label;
  for (const bar of bars) {
    bar.forEach((x, i) => {
      x.q = restyle(x.raw, restyled);
      const before = bar[i - 1];
      // "/B♭" 줄임: 같은 마디에서 바로 앞과 위 코드가 같고 베이스만 다름
      x.short = !!(before && x.q.bass && upper(before.q) === upper(x.q));
      delete x.raw;
    });
  }
  return { meter, style: restyled, key: g.key, bars };
}
