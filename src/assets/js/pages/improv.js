// ===== 코드 초견 (trainer/chord-improv/index.html) — 시작점 =====
// 메트로놈에 맞춰 나오는 코드를 보고 바로 연주하는 연습. 한 페이지에 모드 탭 두 개:
//   "random"  무작위 코드 — 마디마다 무작위 코드 (주소에 mode 없음)
//   "prog"    8마디 코드진행 — 입시형 코드진행 악보 (주소 ?mode=prog)
// 지금(1단계)은 탭 전환만. 메트로놈·건반·출제는 다음 단계에서 여기에 연결해요. 규칙은 chordoven-spec.md "코드 초견".
import { startPage } from "../common/layout.js";
import { $ } from "../common/dom.js";

startPage({ title: "navImprov" });

// ---------- 모드 탭 ----------
const MODES = ["random", "prog"];
const TABS = { random: $("tabRandom"), prog: $("tabProg") };
const PANELS = { random: $("panelRandom"), prog: $("panelProg") };

/** 주소의 ?mode → 지금 모드. 모르는 값이나 없으면 무작위 코드 */
const modeFromUrl = () => (new URLSearchParams(location.search).get("mode") === "prog" ? "prog" : "random");

/**
 * 고른 모드를 주소에 남김. 방문 기록을 새로 쌓지 않고 지금 주소만 바꿔요(replaceState) —
 * 탭을 여러 번 눌러도 뒤로 가기 한 번이면 이전 페이지로 (통계 화면 탭과 같은 방식, stats/view.js setModeInUrl)
 */
function setModeInUrl(mode) {
  const u = new URL(location.href);
  if (mode === "random") u.searchParams.delete("mode"); else u.searchParams.set("mode", mode);
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** 모드 화면 바꾸기: 고른 탭만 선택 표시, 그 모드의 카드만 보임 */
function showMode(mode) {
  for (const m of MODES) {
    TABS[m].setAttribute("aria-selected", String(m === mode));
    TABS[m].tabIndex = m === mode ? 0 : -1;   // 탭 줄 안에서는 ← → 로 옮겨 다님 (아래 keydown)
    PANELS[m].hidden = m !== mode;
  }
}

for (const m of MODES) TABS[m].onclick = () => { showMode(m); setModeInUrl(m); };

// 키보드: 탭에 초점이 있을 때 ← → 로 다른 탭으로 (탭 목록의 일반적인 키 동작)
$("tabRandom").parentElement.addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const i = MODES.indexOf(e.target.dataset.mode);
  if (i < 0) return;
  const next = MODES[(i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length];
  e.preventDefault();
  TABS[next].focus();
  TABS[next].click();
});

showMode(modeFromUrl());
