// ===== 코드 초견 — 무작위 코드 모드 (이전 · 현재 · 다음 코드) =====
// 메트로놈(improv/metronome.js)이 박마다 beat(info)를 불러 주면, 정해진 박 수마다 코드를 한 칸씩 넘겨요.
//   이전 ← 현재 ← 다음 ← 새로 출제 (core/engine.js generate — 랜덤 코드 연습과 같은 엔진, 바로 앞 코드와 같은 베이스는 피함)
// 연주하는 사람이 미리 준비할 수 있게 "다음 코드"를 늘 보여줘요. 카운트인 동안에는 현재 자리에 3·2·1·GO, 다음 자리에 첫 코드.
// 설정을 바꾸면 이미 보이는 다음 코드는 그대로, 그다음에 새로 뽑는 코드부터 적용 (사용자 결정 2026-11-10).
// "한 코드당 마디수"도 마찬가지로 코드가 현재 자리에 올 때의 값으로 그 코드의 길이를 정함.
import { Engine } from "../core/engine.js";
import { t } from "../i18n/index.js";
import { $, symbolHTML } from "../common/dom.js";
import { S, WEIGHTS } from "./settings.js";
import { BEATS, spanBeats } from "./timing.js";

let prev = null, cur = null, next = null;   // 엔진이 만든 코드(q) 또는 { error: 문구 키 } 또는 null(빈칸)
let countLabel = null;                      // 카운트인 중이면 "3" "2" "1" "GO"
let playing = false;
let n = 0, chordStart = 0, span = BEATS;    // 본 연주의 박 번호, 지금 코드가 시작된 박, 지금 코드의 길이(박)

/** 새 코드 하나 — 앞 코드(현재 자리에 올 코드)와 같은 베이스는 피함. 가중치는 코드 초견 전용(settings.js WEIGHTS) */
const draw = after => Engine.generate({ ...S, weights: WEIGHTS }, Math.random, after && !after.error ? after : null);

/**
 * 시작: 첫 코드를 미리 뽑아 "다음" 자리에 둠 (카운트인 동안 보고 준비하게).
 * @returns 출제할 수 없으면 그 이유(문구 키), 아니면 null
 */
export function start() {
  const first = draw(null);
  if (first.error) return first.error;
  prev = cur = null; next = first;
  playing = true; countLabel = null;
  render();
  return null;
}

/**
 * 멈춤: 멈추기 직전의 이전·현재·다음 코드를 그대로 둠 (사용자 요청 2026-11-10 — 예전엔 처음 상태로 돌아갔음).
 * 카운트인 도중에 멈춰 아직 현재 코드가 없으면 처음 안내 화면. 다시 시작하면 새 코드로 처음부터
 */
export function stop() {
  playing = false; countLabel = null;
  render();
}

/**
 * 박마다 (metronome.js beatInfo의 결과).
 * @returns 박 점 표시 { count: 점 개수, on: 켤 점, accent: 마디 첫 박인 점들 }
 */
export function beat(info) {
  if (info.countIn) {
    countLabel = info.label;
    render(true);
    return { count: BEATS, on: info.beat, accent: [0] };
  }
  n = info.bar * BEATS + info.beat;
  if (n === 0 || n - chordStart >= span) {   // 새 코드 차례: 한 칸씩 넘기고 새로 뽑음
    countLabel = null;
    prev = cur; cur = next; next = draw(cur);
    // 마디 중간(½마디 코드의 뒤쪽)에서 시작한 코드는 그 마디 끝까지만 — ½마디에서 1·2마디로 바꿔도 다음 코드가 마디 첫 박에 오게
    chordStart = n; span = n % BEATS ? BEATS - (n % BEATS) : spanBeats(S.bars);
    render();
  }
  const accent = [];
  for (let i = 0; i < span; i++) if ((chordStart + i) % BEATS === 0) accent.push(i);
  return { count: span, on: n - chordStart, accent };
}

/** 칸 하나 그리기: 코드 기호, 출제할 수 없는 이유, 또는 빈칸 */
function fill(el, q) {
  el.classList.toggle("msg", !!(q && q.error));
  el.style.fontSize = "";
  if (!q) { el.innerHTML = ""; el.removeAttribute("aria-label"); return; }
  if (q.error) { el.textContent = t(q.error); el.removeAttribute("aria-label"); return; }
  el.innerHTML = symbolHTML(q);
  el.setAttribute("aria-label", q.symbol);
  fit(el);
}

/**
 * 칸보다 긴 코드 이름은 글씨를 줄여 칸 안에 맞춤 (B♯7sus4(♭9/13)처럼 긴 이름이 옆 칸을 덮지 않게).
 * CSS의 글씨 크기로 먼저 그려 보고, 넘치면 그 비율만큼 줄임. 다음 코드를 그릴 때는 CSS 크기로 돌아감
 */
function fit(el) {
  el.style.fontSize = "";
  const room = el.parentElement.clientWidth, need = el.scrollWidth;
  if (need > room && room > 0) el.style.fontSize = Math.floor(parseFloat(getComputedStyle(el).fontSize) * room / need * 0.97) + "px";
}

/** 세 칸 다시 그리기 (언어를 바꿀 때도). pop = 카운트인 숫자가 톡 튀어나오게 */
export function render(pop = false) {
  const idle = !playing && !cur;   // 아직 한 번도 코드가 나오지 않음 → 안내 문구만 (이전·다음 칸 숨김)
  $("chCur").closest(".im-row").classList.toggle("idle", idle);
  fill($("chPrev"), prev);
  fill($("chNext"), next);
  const c = $("chCur");
  c.classList.remove("count", "go", "pop", "idle");
  c.style.fontSize = "";   // 앞 코드에서 줄였던 글씨 크기를 되돌림 (fit)
  if (countLabel) {
    c.textContent = countLabel;
    c.removeAttribute("aria-label");
    c.classList.add("count");
    c.classList.toggle("go", countLabel === "GO");
    if (pop) { void c.offsetWidth; c.classList.add("pop"); }   // 애니메이션 다시 시작
  } else if (idle) {
    c.textContent = t("improvReady");
    c.removeAttribute("aria-label");
    c.classList.add("idle");
    c.classList.remove("msg");
  } else fill(c, cur);
}
