// ===== 연습 — 피아노 소리 =====
// 실제 그랜드 피아노 녹음(Salamander Grand Piano — 야마하 C5, Alexander Holm, CC BY 3.0)을 재생해요. (2026-11-09 사용자 선택)
//   - 녹음 파일은 단3도마다 하나(C, D♯, F♯, A — C3~D♯6, 14개, assets/sounds/piano/). 그 사이 음은 가까운 파일의 재생 속도를 바꿔 음높이를 맞춤
//   - 파일은 페이지를 열 때 바로 받기 시작해요(이 파일은 두 연습 페이지만 불러옴). 소리로 푸는 것은 소리 장치가 생긴 뒤(첫 터치).
//     아직 다 못 풀었을 때 치는 음은 풀릴 때까지 잠깐(최대 WAIT_MAX) 기다렸다가 녹음으로 냄 — 그래도 안 되면 예전 합성음(synthNote)
//     (2026-11-09: 처음엔 첫 터치 때 받기 시작했는데, 첫 건반·첫 문제 소리가 늘 합성음으로 나서 바꿈)
//   - 출처 표기는 About Us 페이지 아래(i18n aboutCredits)와 README — CC BY 조건이라 지우지 말 것
// 브라우저 정책상 사용자가 처음 화면을 누르기 전에는 소리가 나지 않아요.

let ctx, out;

// 녹음 파일: [MIDI 번호, 파일 이름]. 범위를 넓히려면 같은 이름 규칙(Salamander 원본)으로 파일을 더 넣고 여기에 추가
const SAMPLES = [[48, "C3"], [51, "Ds3"], [54, "Fs3"], [57, "A3"], [60, "C4"], [63, "Ds4"], [66, "Fs4"], [69, "A4"],
  [72, "C5"], [75, "Ds5"], [78, "Fs5"], [81, "A5"], [84, "C6"], [87, "Ds6"]];
const SAMPLE_GAIN = 0.75;   // 녹음 소리 크기 (합성음과 비슷한 크기로 맞춘 값)
const WAIT_MAX = 3000;      // 녹음이 아직 안 풀렸을 때 기다리는 최대 시간(ms). 넘으면 있는 것만 녹음, 나머지는 합성음
const buffers = new Map();  // MIDI 번호 → 소리로 풀어 둔 것 (AudioBuffer) — 소리 장치가 생긴 뒤에 풀 수 있음
let ready = null;           // 모든 녹음을 다 풀었을 때(실패 포함) 끝나는 Promise — 소리 장치가 생길 때 만듦

// 녹음 파일 받기: 페이지를 열자마자 시작 (MIDI 번호 → Promise<ArrayBuffer | null>). 소리 장치 없이도 받을 수 있음
const raw = new Map(SAMPLES.map(([m, name]) => [m,
  fetch(new URL(`../../sounds/piano/${name}.mp3`, import.meta.url))
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .catch(() => null)]));   // 못 받으면 그 음역은 합성음으로

/** 받은 파일을 소리로 풀기 (소리 장치가 생긴 뒤 한 번). 다 풀리면(실패 포함) 끝나는 Promise를 돌려줌 */
function decodeSamples() {
  return Promise.all([...raw].map(([m, p]) => p.then(ab => ab && new Promise(done => {
    // 옛 Safari는 Promise 방식이 없어서 콜백 방식으로 부름
    ctx.decodeAudioData(ab, buf => { buffers.set(m, buf); done(); }, () => done());
  }))));
}

// ---------- iPhone 소리 문제 (2026-11-09, iPhone 16 Pro · iOS 26~27 · Chrome에서 진단 페이지로 확인) ----------
// 확인한 것:
//   - 소리 장치는 running인데도 "볼륨 노드 → 압축기(DynamicsCompressor) → 스피커" 경로의 소리는 무음 스위치와 상관없이 전혀 안 들렸음
//     (navigator.audioSession.type = "playback"을 줘도, 안 줘도 마찬가지)
//   - 압축기 없이 스피커로 바로 보내면 들림 — 단 무음 스위치가 켜져 있으면 안 들림
//   - 소리 없는 <audio>를 반복 재생해 두고 Web Audio를 쓰면 무음 스위치와 상관없이 들림
//   - Web Audio 소리를 <audio>로 흘려 내보내는 방법은 들리지만 끝난 뒤 "뚜두두두" 잡음이 계속 나서 쓰지 않음
// 그래서: 압축기를 없애고(녹음 크기로는 7음 화음도 1을 넘지 않음 — 녹음 최대 0.4 × 세기 0.4 × 0.75 × 0.55 ≈ 0.07/음),
// iPhone·iPad에서는 사용자가 누를 때마다 소리 없는 <audio>가 반복 재생 중인지 확인하고 아니면 다시 틂.
// 예전의 audioSession.type = "playback" 설정은 뺌(확인된 조합만 씀). 잠금 화면에 "재생 중" 표시가 뜨는 건 이 <audio> 때문
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let keepAlive = null;   // 소리 없는 <audio> (iPhone·iPad만)

/** 0.1초짜리 무음 wav 파일을 메모리에서 만들어 주소로 돌려줌 (파일을 따로 두지 않으려고) */
function silentWavUrl() {
  const n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);   // 44100Hz, 16비트, 1채널, 값은 모두 0
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}

/** 사용자가 누르는 순간마다(브라우저가 소리를 허락하는 순간): 소리 장치를 깨우고, iPhone이면 무음 <audio>를 틀어 둠 */
function unlock() {
  if (IOS) {
    if (!keepAlive) { keepAlive = new Audio(silentWavUrl()); keepAlive.loop = true; keepAlive.setAttribute("playsinline", ""); }
    if (keepAlive.paused) keepAlive.play().catch(() => {});   // 다른 앱 소리 등으로 멈췄으면 다시
  }
  if (ctx && ctx.state !== "running") ctx.resume();
}
// 브라우저가 "사용자가 눌렀다"고 인정하는 이벤트들 (터치는 pointerdown이 아니라 손을 뗄 때가 인정됨)
for (const ev of ["pointerup", "touchend", "click", "keydown"]) document.addEventListener(ev, unlock, true);

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  // 전체 볼륨 → 스피커 (압축기는 위 iPhone 문제 때문에 쓰지 않음)
  out = ctx.createGain(); out.gain.value = 0.55;
  out.connect(ctx.destination);
  ready = decodeSamples();
  return ctx;
}

// 녹음이 다 풀릴 때까지 (최대 WAIT_MAX) 기다린 다음 끝나는 Promise
let waiting = null;
function whenReady() {
  return waiting ||= Promise.race([ready, new Promise(r => setTimeout(r, WAIT_MAX))]);
}

/**
 * 음 하나.
 * @param m     MIDI 번호 (60 = C4)
 * @param when  몇 초 뒤에 칠지
 * @param dur   길이(초) — 이 시간 뒤에 건반에서 손을 떼듯 소리를 줄임
 * @param vel   세기(0~1)
 */
function note(m, when = 0, dur = 1.8, vel = 0.5) {
  if (!init()) return;
  // 멈춰 있으면 다시 켬. iPhone(Safari·Chrome 모두 WebKit)은 "suspended" 말고 "interrupted"가 되기도 해서
  // running이 아니면 모두 다시 켬 (2026-11-08: 코드 추론하기의 [들어보기]가 iPhone에서 안 들렸음)
  if (ctx.state !== "running") ctx.resume();
  const sm = SAMPLES.reduce((a, [s]) => Math.abs(s - m) < Math.abs(a - m) ? s : a, SAMPLES[0][0]);   // 가장 가까운 녹음
  if (buffers.has(sm)) return play(m, sm, ctx.currentTime + when + 0.005, dur, vel);
  // 아직 안 풀렸으면 기다렸다가 냄. 한꺼번에 부른 음들(화음·펼침)은 같은 순간에 풀려나므로
  // 모두 똑같이 늦게 시작해서 음 사이 간격(when)은 그대로 유지됨. 기다리는 동안 stop이 불리면 내지 않음
  const wait = { m };
  pending.add(wait);
  whenReady().then(() => {
    if (!pending.delete(wait)) return;   // 기다리는 사이 멈춤
    const t0 = ctx.currentTime + when + 0.005;
    if (buffers.has(sm)) play(m, sm, t0, dur, vel); else synthNote(m, t0, dur, vel);
  });
}

// ---------- 울리고 있는 소리 멈추기 (2026-11-09 사용자 요청) ----------
// 랜덤 코드 연습: 건반 선택을 풀면 그 음, 다음 문제로 넘어가면 모두. 코드 추론하기: 다음 문제로 넘어가면 모두.
// 음마다 "목소리"(voice: 그 음 전용 볼륨 노드 + 소리 노드들)를 기록해 두고, 멈출 때는 FADE초 동안 줄인 뒤 끔(뚝 끊기는 잡음 방지)
const FADE = 0.08;
const voices = new Set();    // 울리는 중이거나 곧 울릴 목소리 { m, g: 볼륨 노드, nodes: 소리 노드들 }
const pending = new Set();   // 녹음이 풀리기를 기다리는 음 { m }

/** 목소리 기록. 마지막 소리 노드가 끝나면 기록에서 지움 */
function addVoice(m, g, nodes) {
  const v = { m, g, nodes };
  voices.add(v);
  nodes[nodes.length - 1].onended = () => voices.delete(v);
}

/** 목소리 하나를 빠르게 줄이고 끔 (아직 시작 전인 것도 — 시작 시각 전에 꺼지면 아예 안 남) */
function silence(v) {
  const now = ctx.currentTime;
  v.g.gain.cancelScheduledValues(now);
  v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), now);
  v.g.gain.exponentialRampToValueAtTime(0.0001, now + FADE);
  for (const n of v.nodes) { try { n.stop(now + FADE + 0.02); } catch (e) { /* 옛 Safari는 stop을 두 번 부르면 오류 — 볼륨은 이미 줄였으니 무시 */ } }
  voices.delete(v);
}

/** 음 m(MIDI 번호)의 소리를 모두 멈춤 — 건반 하나를 눌러 낸 소리든 화음 속 그 음이든 */
function stop(m) {
  for (const w of pending) if (w.m === m) pending.delete(w);
  if (ctx) for (const v of [...voices]) if (v.m === m) silence(v);
}

/** 모든 소리를 멈춤 */
function stopAll() {
  pending.clear();
  if (ctx) for (const v of [...voices]) silence(v);
}

/** 녹음 sm을 재생 속도로 음높이 m에 맞춰 t0(소리 장치 시계)에 냄 */
function play(m, sm, t0, dur, vel) {
  const buf = buffers.get(sm);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (m - sm) / 12);   // 반음 차이만큼 빠르게/느리게 → 음높이 맞춤
  const g = ctx.createGain(), peak = vel * SAMPLE_GAIN;
  g.gain.setValueAtTime(peak, t0);
  g.gain.setValueAtTime(peak, t0 + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.35);   // 손 뗌
  src.connect(g); g.connect(out);
  src.start(t0); src.stop(t0 + dur + 0.4);
  addVoice(m, g, [src]);
}

/** 녹음을 아직 못 받았을 때 쓰는 합성음 (예전 소리: 사인파 배음 5개, 시간이 지나며 작아짐). t0 = 시작 시각(소리 장치 시계) */
function synthNote(m, t0, dur, vel) {
  const f = 440 * Math.pow(2, (m - 69) / 12);   // MIDI → 주파수 (A4 = 440Hz)
  // 고음일수록 밝게 시작해서 점점 어두워지는 필터 → 이 음 전용 볼륨(멈출 때 씀) → 전체 볼륨
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f * 9), t0); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t0 + dur);
  const vg = ctx.createGain();
  lp.connect(vg); vg.connect(out);
  const oscs = [];
  // [배음 번호, 크기, 사라지는 속도]
  const partials = [[1, 1, 1], [2, 0.42, 0.7], [3, 0.18, 0.5], [4, 0.09, 0.35], [5, 0.05, 0.25]];
  for (const [h, g, decayK] of partials) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * h * (1 + (h - 1) * 0.0007);   // 피아노 현처럼 배음을 살짝 높게
    const gn = ctx.createGain();
    const peak = vel * g * 0.35;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    gn.gain.exponentialRampToValueAtTime(peak * 0.35, t0 + 0.25 * decayK + 0.1);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * decayK + 0.2);
    o.connect(gn); gn.connect(lp);
    o.start(t0); o.stop(t0 + dur + 0.3);
    oscs.push(o);
  }
  addVoice(m, vg, oscs);
}

/** 화음. arp=true면 아래부터 하나씩 친 다음 한꺼번에 (정답 확인), false면 한꺼번에 */
function chord(midis, arp = true) {
  const ms = [...midis].sort((a, b) => a - b);
  if (arp) {
    ms.forEach((m, i) => note(m, i * 0.16, 1.2, 0.45));
    ms.forEach(m => note(m, ms.length * 0.16 + 0.15, 2.2, 0.38));
  } else ms.forEach(m => note(m, 0, 2.2, 0.4));
}

export const Sound = { note, chord, stop, stopAll };
