// ===== 코드 초견 — 메트로놈 =====
// 합성 클릭음(녹음 파일 없음, 음량 조절 없음). 마디 첫 박은 높은 소리, 나머지 박은 낮은 소리 (2026-11-10 사용자 결정).
// 시작하면 먼저 카운트인 한 마디(4/4면 4번 — 화면에 "3, 2, 1, GO")를 울린 뒤 본 연주의 1마디 1박부터 셈.
//
// 박이 밀리지 않게 하는 방법 ("미리 예약"):
//   setTimeout만으로 소리를 내면 브라우저가 바쁠 때 수십 ms씩 늦어져 박이 흔들려요. 그래서 25ms마다 깨어나
//   "지금부터 0.12초 안에 올 박"을 소리 장치 시계(AudioContext.currentTime)에 미리 예약해 둬요. 소리는 장치가 정확한 순간에 냄.
//   화면(카운트인 글자, 박 점, 나중에 코드 바꾸기)은 예약한 박을 목록에 넣어 두고 requestAnimationFrame마다
//   "시계가 그 박의 시각을 지났는지" 보고 알려줘요(onBeat) — 소리와 화면이 같은 시각을 기준으로 맞음.
//   깨우는 타이머는 Worker 안에서 돌려요: 탭이 뒤로 가면 브라우저가 보통 setInterval을 1초에 한 번으로 늦추는데
//   Worker의 타이머는 덜 늦춰져서 소리가 끊기지 않음. Worker를 못 만들면 그냥 setInterval.
//
// 박 번호 계산은 화면·소리와 상관없는 순수 함수(beatInfo, clampBpm)로 따로 두어 Node에서 테스트해요 (tests/improv.test.js).

export const BPM_MIN = 30, BPM_MAX = 240, BPM_DEFAULT = 60;   // 사용자 결정 2026-11-10

/** 입력한 BPM을 쓸 수 있는 값으로: 숫자가 아니면 기본값, 범위 밖이면 끝 값, 소수는 반올림 */
export function clampBpm(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return BPM_DEFAULT;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, n));
}

/**
 * 시작부터 i번째(0부터) 박이 무엇인지.
 *   카운트인 박: { countIn: true, beat, label } — label은 남은 박 수(4/4면 "3" "2" "1"), 마지막 박은 "GO"
 *   본 연주 박:  { countIn: false, bar, beat } — bar는 1마디부터 0, 1, 2…, beat는 마디 안에서 0부터
 * @param i      시작부터 센 박 번호
 * @param beats  한 마디 박 수 (4/4면 4)
 * @param count  카운트인 박 수 (0이면 카운트인 없음)
 */
export function beatInfo(i, beats, count = beats) {
  if (i < count) return { countIn: true, beat: i, label: i === count - 1 ? "GO" : String(count - 1 - i) };
  const j = i - count;
  return { countIn: false, bar: Math.floor(j / beats), beat: j % beats };
}

const LOOKAHEAD = 0.12;   // 이만큼(초) 앞의 박까지 미리 예약
const TICK_MS = 25;       // 깨어나는 간격

/** 25ms마다 fn을 부르는 타이머. 가능하면 Worker 안에서 (탭이 뒤에 있어도 덜 늦춰짐). 돌려주는 함수를 부르면 멈춤 */
function startTicker(fn) {
  try {
    const src = `let id; onmessage = e => { clearInterval(id); if (e.data) id = setInterval(() => postMessage(0), ${TICK_MS}); };`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    w.postMessage(1);
    return () => { w.postMessage(0); w.terminate(); };
  } catch (e) {
    const id = setInterval(fn, TICK_MS);
    return () => clearInterval(id);
  }
}

/**
 * 클릭 한 번을 시각 t(소리 장치 시계)에 예약. 짧은 사인파에 빠르게 줄어드는 볼륨 → "틱" 소리.
 * accent(마디 첫 박)는 높고 조금 크게, 나머지는 낮게 — 두 소리가 확실히 구분되게 (사용자 요청)
 */
function click(ctx, t, accent, live) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = accent ? 1760 : 1100;
  const peak = accent ? 0.9 : 0.6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.06);
  live.add(g);                              // 멈출 때 아직 안 울린 클릭을 끊으려고 기록
  osc.onended = () => live.delete(g);
}

/**
 * 메트로놈 만들기.
 * @param getContext  소리 장치를 돌려주는 함수 (practice/audio.js Sound.context — 피아노 소리와 같은 장치를 써서 iPhone 처리를 함께 받음)
 * @param onBeat      박이 울리는 순간 화면에서 할 일 (beatInfo의 결과를 받음)
 * @param onStop      멈췄을 때 (stop을 불렀을 때)
 */
export function createMetronome({ getContext, onBeat = () => {}, onStop = () => {} }) {
  let ctx = null, stopTicker = null, raf = 0;
  let bpm = BPM_DEFAULT, beats = 4, count = 4;
  let nextIndex = 0, nextTime = 0;   // 다음에 예약할 박의 번호와 시각
  const queue = [];                  // 예약했지만 화면에 아직 알리지 않은 박 [{ time, info }]
  const live = new Set();            // 예약했거나 울리는 중인 클릭의 볼륨 노드

  /** 앞으로 LOOKAHEAD초 안의 박을 모두 예약. BPM은 예약하는 순간의 값을 씀 → 연주 중에 바꾸면 다음 박부터 적용 */
  function schedule() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const info = beatInfo(nextIndex, beats, count);
      click(ctx, nextTime, info.beat === 0, live);
      queue.push({ time: nextTime, info });
      nextTime += 60 / bpm;
      nextIndex++;
    }
  }

  /** 화면 알림: 시각이 지난 박을 차례로 onBeat (여러 개가 밀렸으면 마지막 것까지 모두) */
  function draw() {
    while (queue.length && queue[0].time <= ctx.currentTime) onBeat(queue.shift().info);
    raf = requestAnimationFrame(draw);
  }

  return {
    get running() { return !!stopTicker; },
    get bpm() { return bpm; },

    /**
     * 시작 (이미 돌고 있으면 처음부터 다시). 사용자가 버튼을 누른 순간에 불러야 소리 장치가 켜짐.
     * @param opts.bpm      템포
     * @param opts.beats    한 마디 박 수 (기본 4)
     * @param opts.countIn  카운트인을 할지 (기본 true — 한 마디)
     * @returns 소리 장치를 못 만들었으면 false
     */
    start({ bpm: b = bpm, beats: n = 4, countIn = true } = {}) {
      this.stop(true);
      ctx = getContext();
      if (!ctx) return false;
      bpm = clampBpm(b); beats = n; count = countIn ? n : 0;
      nextIndex = 0;
      nextTime = ctx.currentTime + 0.1;   // 버튼을 누르고 아주 조금 뒤에 첫 박 (예약할 여유)
      queue.length = 0;
      schedule();
      stopTicker = startTicker(schedule);
      raf = requestAnimationFrame(draw);
      return true;
    },

    /** 멈춤. 미리 예약해 둔 클릭(최대 0.12초 앞)도 스피커 연결을 끊어 울리지 않게 함 */
    stop(quiet = false) {
      if (!stopTicker) return;
      stopTicker(); stopTicker = null;
      cancelAnimationFrame(raf);
      queue.length = 0;
      for (const g of live) g.disconnect();
      live.clear();
      if (!quiet) onStop();
    },

    /** 템포 바꾸기 — 돌고 있으면 다음에 예약하는 박부터 */
    setBpm(b) { bpm = clampBpm(b); },
  };
}
