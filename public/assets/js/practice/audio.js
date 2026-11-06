// ===== 연습 — 피아노 소리 =====
// 소리 파일 없이 Web Audio API로 직접 만든 피아노 비슷한 소리. 배음 5개를 섞고 시간이 지나며 작아지게 해요.
// 브라우저 정책상 사용자가 처음 화면을 누르기 전에는 소리가 나지 않아요.

let ctx, out;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  // 여러 음을 동시에 쳐도 소리가 깨지지 않게 압축기를 거침
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  out = ctx.createGain(); out.gain.value = 0.55;
  out.connect(comp); comp.connect(ctx.destination);
  return ctx;
}

/**
 * 음 하나.
 * @param m     MIDI 번호 (60 = C4)
 * @param when  몇 초 뒤에 칠지
 * @param dur   길이(초)
 * @param vel   세기(0~1)
 */
function note(m, when = 0, dur = 1.8, vel = 0.5) {
  if (!init()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t0 = ctx.currentTime + when + 0.005;
  const f = 440 * Math.pow(2, (m - 69) / 12);   // MIDI → 주파수 (A4 = 440Hz)
  // 고음일수록 밝게 시작해서 점점 어두워지는 필터
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f * 9), t0); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t0 + dur);
  lp.connect(out);
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
  }
}

/** 화음. arp=true면 아래부터 하나씩 친 다음 한꺼번에 (정답 확인), false면 한꺼번에 */
function chord(midis, arp = true) {
  const ms = [...midis].sort((a, b) => a - b);
  if (arp) {
    ms.forEach((m, i) => note(m, i * 0.16, 1.2, 0.45));
    ms.forEach(m => note(m, ms.length * 0.16 + 0.15, 2.2, 0.38));
  } else ms.forEach(m => note(m, 0, 2.2, 0.4));
}

export const Sound = { note, chord };
