// ===== 청음 연습 — 연주 악기 (음색 고르기) =====
// 문제 음·스케일·건반 소리를 고른 악기로 내요. 청음 연습의 모든 단계가 이 파일 하나로 소리를 냄 —
// 나중에 아르페지오·밴드 합주 같은 "연주 방식"도 여기 위에 붙이면 돼요 (chordoven-spec.md "청음 연습").
//   - 피아노: 다른 연습과 같은 Salamander 녹음 (practice/audio.js Sound를 그대로 씀)
//   - 그 밖: FluidR3 GM (CC BY 3.0, gleitz/midi-js-soundfonts가 음마다 mp3로 바꾼 것 — 2026-11-24 사용자 선택).
//     assets/sounds/<폴더>/ 에 단3도마다(C·E♭·G♭·A) A1~C7 22개. 사이 음은 재생 속도로 맞춤(피아노와 같은 방식).
//     그 악기를 처음 고를 때만 받음 (피아노만 쓰는 사람은 받지 않음)
//   - 출처 표기는 About Us 아래(i18n aboutCredits)와 README — CC BY 조건이라 지우지 말 것
// 소리 장치는 피아노와 같은 것(Sound.context())을 써서 iPhone 무음 스위치 처리 등을 함께 받아요.
import { Sound } from "../practice/audio.js";

/**
 * 악기 목록 (화면의 순서). key = 문구 키(i18n), dir = assets/sounds/ 아래 폴더(피아노는 없음),
 * sustain = 누르는 동안 소리가 이어지는 악기(목소리·현악기) — 시작을 살짝 부드럽게, gain = 녹음마다 다른 크기를 맞추는 값
 */
export const INSTRUMENTS = [
  { id: "piano", key: "earInstPiano" },
  { id: "choir", key: "earInstChoir", dir: "choir", sustain: true, gain: 0.55 },
  { id: "epiano", key: "earInstEpiano", dir: "epiano", gain: 0.7 },
  { id: "guitar", key: "earInstGuitar", dir: "guitar", gain: 0.75 },
  { id: "strings", key: "earInstStrings", dir: "strings", sustain: true, gain: 0.5 },
];
const byId = id => INSTRUMENTS.find(x => x.id === id) || INSTRUMENTS[0];

// 녹음 파일: [MIDI 번호, 파일 이름] — 원본 이름 그대로(플랫: Eb, Gb)
const FILES = [[33, "A1"]];
for (let o = 2; o <= 6; o++) FILES.push([(o + 1) * 12, "C" + o], [(o + 1) * 12 + 3, "Eb" + o], [(o + 1) * 12 + 6, "Gb" + o], [(o + 1) * 12 + 9, "A" + o]);
FILES.push([96, "C7"]);

const raw = new Map();       // "악기/MIDI" → Promise<ArrayBuffer | null> (받은 파일 — 소리 장치 없이도 받을 수 있음)
const buffers = new Map();   // "악기/MIDI" → AudioBuffer (소리로 푼 것)
const decoding = new Map();  // "악기/MIDI" → 풀기가 끝나면(실패 포함) 끝나는 Promise
const voices = new Set();    // 울리는 중인 소리 { g: 볼륨 노드, src } — stopAll이 멈춤
let out = null;              // 이 파일의 전체 볼륨 → 스피커

/** 악기 녹음 받기 시작 (여러 번 불러도 한 번만). 피아노는 Sound.preload */
export function load(id) {
  const ins = byId(id);
  if (!ins.dir) { Sound.preload(); return; }
  for (const [m, name] of FILES) {
    const k = ins.id + "/" + m;
    if (raw.has(k)) continue;
    raw.set(k, fetch(new URL(`../../sounds/${ins.dir}/${name}.mp3`, import.meta.url))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .catch(() => null));   // 못 받으면 그 음역은 피아노로
  }
}

/** 소리 장치가 있으면 그 악기의 받은 파일을 모두 소리로 풀고, 다 풀리면(최대 3초) 끝나는 Promise */
function ready(ins) {
  const ctx = Sound.context();
  if (!ctx) return Promise.resolve(null);
  ensureOut(ctx);
  const jobs = [];
  for (const [m] of FILES) {
    const k = ins.id + "/" + m;
    if (!decoding.has(k)) {
      decoding.set(k, raw.get(k).then(ab => ab && new Promise(done => {
        // 옛 Safari는 Promise 방식이 없어서 콜백 방식으로 부름
        ctx.decodeAudioData(ab, buf => { buffers.set(k, buf); done(); }, () => done());
      })));
    }
    jobs.push(decoding.get(k));
  }
  return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 3000))]).then(() => ctx);
}

/**
 * 음들을 예약해서 냄 — 스케일·멜로디·화음 모두 이것 하나로.
 * @param id     악기 id
 * @param notes  [{ m: MIDI 번호, at: 몇 초 뒤, dur: 길이(초), vel: 세기 0~1 }] — 메트로놈 클릭은 { click: true, accent, at }
 *               (단음 ③ — 음과 같은 시계로 예약해야 박이 맞아서 여기서 함께)
 * 녹음이 아직 안 풀렸으면 풀릴 때까지 기다렸다가 모두 함께 시작(음 사이 간격은 그대로)
 * @returns Promise — 소리를 예약한 순간(= at 0이 들리기 시작하는 때) 끝남. 페이지가 소리에 맞춰 화면을 바꿀 때 씀
 *   (피아노는 Sound가 따로 기다리므로 바로 끝남 — 첫 소리만 녹음이 풀리는 만큼 조금 늦을 수 있음)
 */
export function play(id, notes) {
  const ins = byId(id);
  const clicks = notes.filter(n => n.click);
  notes = notes.filter(n => !n.click);
  if (!ins.dir) {
    for (const n of notes) Sound.note(n.m, n.at, n.dur, n.vel ?? 0.5);
    const ctx = clicks.length && Sound.context();
    if (ctx) { ensureOut(ctx); const t0 = ctx.currentTime + 0.005; for (const c of clicks) click(ctx, t0 + c.at, c.accent); }
    return Promise.resolve();
  }
  load(ins.id);
  return ready(ins).then(ctx => {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    for (const c of clicks) click(ctx, t0 + c.at, c.accent);
    for (const n of notes) {
      const sm = FILES.reduce((a, [f]) => Math.abs(f - n.m) < Math.abs(a - n.m) ? f : a, FILES[0][0]);
      const buf = buffers.get(ins.id + "/" + sm);
      if (!buf) { Sound.note(n.m, n.at, n.dur, n.vel ?? 0.5); continue; }   // 그 녹음을 못 받았으면 피아노로
      voice(ctx, ins, buf, n.m - sm, t0 + n.at, n.dur, n.vel ?? 0.5);
    }
  });
}

// ---------- 건반으로 고른 음 (2026-11-25 사용자 요청) ----------
// 빠르게 여러 음을 누르면 앞 음이 겹쳐 들려서, 새 음을 누르면 앞에 누른 음을 PICK_FADE초 동안 줄여 끔.
// 문제·스케일·기준음 소리는 건드리지 않음 (피아노는 Sound의 held 소리, 다른 악기는 picked로 따로 기록)
const PICK_FADE = 0.1;
const picked = new Set();    // 건반으로 고른 음의 목소리 (피아노 말고 다른 악기)

/** 건반으로 고른 음 하나 — 앞에 고른 음을 짧게 사라지게 하고 냄 */
export function pick(id, m, dur = 0.9, vel = 0.5) {
  const ins = byId(id);
  Sound.releaseHeld(PICK_FADE);
  fadeOut([...picked], PICK_FADE);
  picked.clear();
  if (!ins.dir) { Sound.note(m, 0, dur, vel, true); return; }
  load(ins.id);
  ready(ins).then(ctx => {
    if (!ctx) return;
    const sm = FILES.reduce((a, [f]) => Math.abs(f - m) < Math.abs(a - m) ? f : a, FILES[0][0]);
    const buf = buffers.get(ins.id + "/" + sm);
    if (!buf) { Sound.note(m, 0, dur, vel, true); return; }   // 그 녹음을 못 받았으면 피아노로
    // 녹음이 풀리기를 기다리는 사이 다른 음을 또 눌렀으면 그 음이 먼저 picked에 들어가 있을 수 있음 → 이것도 앞 음으로 침
    fadeOut([...picked], PICK_FADE);
    picked.clear();
    const v = voice(ctx, ins, buf, m - sm, ctx.currentTime + 0.02, dur, vel);
    picked.add(v);
    v.src.addEventListener("ended", () => picked.delete(v));
  });
}

/** 목소리들을 fade초 동안 줄이고 끔 */
function fadeOut(list, fade) {
  const ctx = Sound.context();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const v of list) {
    v.g.gain.cancelScheduledValues(now);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), now);
    v.g.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    try { v.src.stop(now + fade + 0.02); } catch (e) { /* 옛 Safari는 stop을 두 번 부르면 오류 — 볼륨은 이미 줄였으니 무시 */ }
    voices.delete(v);
  }
}

/** 이 파일의 전체 볼륨 노드 (처음 한 번 만듦) */
function ensureOut(ctx) { if (!out) { out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination); } }

/**
 * 메트로놈 클릭 하나 (합성음 — 코드 초견 메트로놈과 같은 높이: 마디 첫 박 1760Hz, 나머지 1100Hz).
 * 짧게(0.05초) 울리고 사라짐. stopAll이 멈출 수 있게 voices에 넣음
 */
function click(ctx, t, accent) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "square"; o.frequency.value = accent ? 1760 : 1100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.15, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + 0.06);
  const v = { g, src: o };
  voices.add(v);
  o.onended = () => voices.delete(v);
}

/** 녹음 하나를 반음 shift만큼 높이를 바꿔 t(소리 장치 시계)에 dur초 동안 냄 */
function voice(ctx, ins, buf, shift, t, dur, vel) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, shift / 12);
  const g = ctx.createGain(), peak = vel * ins.gain;
  // 목소리·현악기는 시작을 0.04초 동안 부드럽게(뚝 하는 소리 방지), 끝은 모두 0.25초 동안 줄임
  g.gain.setValueAtTime(ins.sustain ? 0.0001 : peak, t);
  if (ins.sustain) g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
  g.gain.setValueAtTime(peak, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  src.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.3);
  const v = { g, src };
  voices.add(v);
  src.onended = () => voices.delete(v);
  return v;
}

/** 모든 소리 멈추기 (다음 문제로 넘어갈 때, 다시 듣기 전에) — 0.08초 동안 줄여서 끔 */
export function stopAll() {
  Sound.stopAll();
  fadeOut([...voices], 0.08);
  picked.clear();
}
