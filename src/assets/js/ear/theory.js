// ===== 청음 연습 — 음 이론 (순수 함수, 화면 없음 → tests/ear.test.js) =====
// 조성(으뜸음 + 장조/단조)에서 스케일·다이아토닉 음·조 밖의 음을 만들고, 문제 음을 고르고, 답을 채점해요.
// 음은 { l: 글자 0~6(C D E F G A B), a: 변화표(-2~2), oct: 옥타브 } 로 나타내요 (코드 추론하기 core/naming.js와 같은 모양).
// 규칙은 chordoven-spec.md "청음 연습".
//   - 단조의 다이아토닉 음 = 자연단음계 + 이끔음(♯7) (2026-11-24 사용자 결정). 스케일 재생은 자연단음계
//   - 조 밖의 음 철자: 장조 ♭2 ♭3 ♯4 ♭6 ♭7, 단조 ♭2 ♮3 ♯4 ♮6 (실제 악보에서 흔한 쪽)
//   - 단음 ① 채점: 옥타브까지 맞아야 정답, 음이름만 맞으면 오답 + 옥타브 힌트 (2026-11-24 사용자 결정)

export const LETTERS = "CDEFGAB";
const NATURAL = [0, 2, 4, 5, 7, 9, 11];   // 글자별 피치클래스 (C=0)
const MAJOR = [0, 2, 4, 5, 7, 9, 11];     // 장음계 도수별 반음 수
const MINOR = [0, 2, 3, 5, 7, 8, 10];     // 자연단음계

// 조 이름 (코드 초견 grammar.js KEY_NAMES와 같은 철자 — 드롭다운은 C부터 반음씩)
export const KEY_ROOTS = {
  major: ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
  minor: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"],
};

/** 단음 ①의 건반·출제 범위 F3~F5 (MIDI 번호) — G3부터 보이면 첫 건반이 도처럼 보여서 F부터 (2026-11-24 사용자 요청) */
export const LOW = 53, HIGH = 77;

const ACC = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" };

/** 음 이름 글자 → { l, a } ("F♯" → { l: 3, a: 1 }) */
export function parseName(n) {
  const a = [...n.slice(1)].reduce((s, c) => s + (c === "♯" ? 1 : c === "♭" ? -1 : c === "𝄪" ? 2 : c === "𝄫" ? -2 : 0), 0);
  return { l: LETTERS.indexOf(n[0]), a };
}
/** { l, a } → "F♯" */
export const nameOf = n => LETTERS[n.l] + ACC[String(n.a)];
/** { l, a, oct } → "F♯4" */
export const fullName = n => nameOf(n) + n.oct;
/** { l, a, oct } → MIDI 번호 (C4 = 60). B♯·C♭처럼 옥타브 경계를 넘는 철자도 실제 높이로 */
export const midiOf = n => (n.oct + 1) * 12 + NATURAL[n.l] + n.a;
/** { l, a } → 피치클래스 0~11 */
export const pcOf = n => (((NATURAL[n.l] + n.a) % 12) + 12) % 12;

/**
 * 조의 음 철자 만들기.
 * @param key  { root: "E♭", minor: false }
 * @returns { tonic: {l,a}, scale: [{l,a} × 7] (자연음계, 도수 순), diatonic: [{l,a, deg}], chromatic: [{l,a, deg}] }
 *   diatonic·chromatic의 deg = 몇 도인지(0 = 1도) — 문제 화면에서는 쓰지 않지만 테스트·나중의 힌트용
 */
export function keyNotes(key) {
  const tonic = parseName(key.root);
  const steps = key.minor ? MINOR : MAJOR;
  const deg = (i, alt = 0) => {
    const l = (tonic.l + i) % 7;
    const want = (pcOf(tonic) + steps[i] + alt + 24) % 12;
    let a = want - NATURAL[l];
    if (a > 6) a -= 12;
    if (a < -6) a += 12;
    return { l, a, deg: i };
  };
  const scale = steps.map((_, i) => deg(i));
  const diatonic = scale.slice();
  // 단조: 이끔음(♯7) 추가
  if (key.minor) diatonic.push(deg(6, 1));
  // 조 밖의 음: [도수, 변화]
  const out = key.minor ? [[1, -1], [2, 1], [3, 1], [5, 1]] : [[1, -1], [2, -1], [3, 1], [5, -1], [6, -1]];
  const chromatic = out.map(([i, alt]) => simplify(deg(i, alt)));
  return { tonic, scale, diatonic, chromatic };
}

/** 겹변화표가 생기면 같은 건반의 쉬운 이름으로 (G♭장조의 ♭2 A𝄫 → G). 조 안의 C♭·F♭ 등은 그대로 */
function simplify(n) {
  if (Math.abs(n.a) < 2) return n;
  const l = (n.l + (n.a > 0 ? 1 : 6)) % 7;
  const a = ((pcOf(n) - NATURAL[l] + 18) % 12) - 6;
  return { ...n, l, a };
}

/**
 * 조표: 조표에 붙는 변화표 수와 방향. 자연음계 7음의 ♯·♭을 셈 (단조는 자연단음계 = 나란한조와 같은 조표)
 * @returns { a: 1(♯) | -1(♭) | 0, count: 0~7, letters: Set(조표가 붙는 글자 번호) }
 */
export function signature(key) {
  const { scale } = keyNotes(key);
  const alt = scale.filter(n => n.a !== 0);
  return { a: alt.length ? Math.sign(alt[0].a) : 0, count: alt.length, letters: new Set(alt.map(n => n.l)) };
}

/** 오선 위 글자 l에 조표가 주는 변화표 (조표대로 고를 때) */
export function sigAcc(sig, l) { return sig.letters.has(l) ? sig.a : 0; }

/**
 * 스케일 재생용 음 (MIDI 번호, 으뜸음부터 한 옥타브 위 으뜸음까지 8개). 자연음계.
 * 으뜸음은 F3~E4 안에서 — 스케일이 출제 범위(F3~F5) 가운데쯤에 오게
 */
export function scaleMidis(key) {
  const { tonic, scale } = keyNotes(key);
  let t = 48 + pcOf(tonic);   // C3 옥타브의 으뜸음
  while (t < LOW) t += 12;
  const steps = key.minor ? MINOR : MAJOR;
  return [...steps.map(s => t + s), t + 12];
}

/**
 * 출제할 수 있는 음 목록 (범위 안의 모든 옥타브, 조에 맞는 철자).
 * @param opt { chromatic: 조 밖의 음 포함 }
 * @returns [{ l, a, oct, midi }]
 */
export function candidates(key, opt = {}, low = LOW, high = HIGH) {
  const { diatonic, chromatic } = keyNotes(key);
  const names = opt.chromatic ? [...diatonic, ...chromatic] : diatonic;
  const out = [];
  for (const n of names) {
    for (let oct = 1; oct <= 7; oct++) {
      const note = { l: n.l, a: n.a, oct };
      const m = midiOf(note);
      if (m >= low && m <= high) out.push({ ...note, midi: m });
    }
  }
  return out.sort((p, q) => p.midi - q.midi);
}

/** 단음 ①: 바로 앞 문제와의 거리 상한 — 장10도(반음 16개). F3 다음 E5처럼 멀리 뛰면 이질적이라서 (2026-11-24 사용자 요청) */
export const MAX_JUMP = 16;

/**
 * 문제 음 하나 고르기 — 바로 앞 문제와 같은 음(같은 건반)은 피하고, 앞 문제와 장10도(MAX_JUMP)보다 멀리 떨어진 음도 피함
 * (그렇게 거르면 후보가 없을 때는 거르지 않음). 조 밖의 음도 다른 음과 똑같이 고름 (따로 비율을 정하지 않음)
 * @param rnd  0~1 난수 함수 (테스트에서 고정값을 넣으려고)
 */
export function pickNote(key, opt = {}, prevMidi = null, rnd = Math.random) {
  const all = candidates(key, opt);
  const near = prevMidi === null ? all : all.filter(n => n.midi !== prevMidi && Math.abs(n.midi - prevMidi) <= MAX_JUMP);
  const pool = near.length ? near : all.length > 1 ? all.filter(n => n.midi !== prevMidi) : all;
  return pool[Math.floor(rnd() * pool.length)];
}

/** 가중치 목록에서 하나 고르기: items[i]를 weights[i]에 비례해서 (rnd = 0~1 난수) */
function weighted(items, weights, rnd) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

// 단음 ② 멜로디: 이웃한 두 음 사이 음정(반음 수)별 가중치. 옥타브(12)까지만, 넘으면 0 (2026-11-24 사용자 결정 —
// 도약이 너무 많지 않게 하되 순차 위주일 필요는 없음). 같은 음 반복은 드물게, 옥타브(12)는 6~7도보다 더 드물게(0.3 → 0.1, 같은 날 사용자 요청)
const STEP_WEIGHT = s => s === 0 ? 0.15 : s <= 2 ? 1 : s <= 4 ? 1 : s <= 7 ? 0.6 : s < 12 ? 0.3 : s === 12 ? 0.1 : 0;

/**
 * 단음 ② 마지막 음 — 멜로디 만들기. 앞 3음은 보여 주고 그 뒤가 문제: 맞힐 음 1개면 4음, 2개면 5음 (len).
 *   첫 음: 옵션과 상관없이 다이아토닉. 으뜸화음 음(1·3·5도 — 옥타브 위 1도, 1도 아래 5도 포함)을 3배로, 다른 다이아토닉 음도 가끔.
 *          자리는 스케일 재생의 으뜸음(scaleMidis[0]) 기준 아래 5도 ~ 옥타브 위 1도 사이
 *   둘째 음부터: "조 밖의 음 포함"(opt.chromatic)을 따름, 앞 음과의 음정은 STEP_WEIGHT
 *   모든 음 F3~F5 안
 * @returns [{ l, a, oct, midi } × len]
 */
export function pickMelody(key, opt = {}, rnd = Math.random, len = 4) {
  const t0 = scaleMidis(key)[0];
  const { scale } = keyNotes(key);
  const triad = new Set([0, 2, 4].map(i => pcOf(scale[i])));
  const firstPool = candidates(key).filter(n => n.midi >= t0 - 5 && n.midi <= t0 + 12);
  const melody = [weighted(firstPool, firstPool.map(n => triad.has(pcOf(n)) ? 3 : 1), rnd)];
  const pool = candidates(key, opt);
  while (melody.length < len) {
    const prev = melody[melody.length - 1].midi;
    const ws = pool.map(n => STEP_WEIGHT(Math.abs(n.midi - prev)));
    melody.push(weighted(pool, ws, rnd));
  }
  return melody;
}

/**
 * 단음 채점 (옥타브까지 맞아야 정답).
 * @returns "ok" | "octUp"(정답이 한 옥타브 이상 위 — 음이름만 맞음) | "octDown" | "no"
 *   같은 건반이면 철자가 달라도 정답(G♭을 골랐는데 문제가 F♯) — 소리로는 구별할 수 없어서
 */
export function judgeNote(answerMidi, pickedMidi) {
  if (answerMidi === pickedMidi) return "ok";
  if ((answerMidi - pickedMidi) % 12 === 0) return answerMidi > pickedMidi ? "octUp" : "octDown";
  return "no";
}

/**
 * 건반 하나(MIDI 번호)를 조에 맞는 철자로 — 다이아토닉이면 그 철자, 조 밖의 음이면 위 chromatic 철자.
 * (화면 건반을 눌렀을 때 악보에 어떤 이름으로 그릴지)
 */
export function spellMidi(key, m) {
  const { diatonic, chromatic } = keyNotes(key);
  const pc = ((m % 12) + 12) % 12;
  const n = [...diatonic, ...chromatic].find(x => pcOf(x) === pc) || { l: 0, a: 0 };
  // 옥타브: 철자의 자연음 높이로 거꾸로 계산 (B♯·C♭ 경계 포함)
  const oct = Math.round((m - NATURAL[n.l] - n.a) / 12) - 1;
  return { l: n.l, a: n.a, oct };
}

/** 무작위로 다른 조 (같은 장조/단조 안에서, 지금 으뜸음은 빼고) */
export function otherKey(key, rnd = Math.random) {
  const list = KEY_ROOTS[key.minor ? "minor" : "major"].filter(r => r !== key.root);
  return { root: list[Math.floor(rnd() * list.length)], minor: key.minor };
}

/** 장조 ↔ 단조를 바꿀 때 같은 으뜸음(피치클래스)의 그 조 철자 (D♭ → C♯) */
export function sameRoot(root, minor) {
  const pc = pcOf(parseName(root));
  return KEY_ROOTS[minor ? "minor" : "major"].find(r => pcOf(parseName(r)) === pc) || "C";
}
