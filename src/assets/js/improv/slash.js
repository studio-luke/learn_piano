// ===== 코드 초견 — 분수코드 출제 (순수 함수, tests/improv.test.js) =====
// 무작위 코드 모드에서 "분수코드 허용"을 켜면 약 25%를 분수코드로 내요 (2026-11-10 사용자 결정, 코드 초견에만 — 랜덤 코드 연습은 그대로).
// 분수코드 안에서 전위형 60% : 하이브리드 코드 40%.
//
// 전위형: 베이스가 코드 구성음(또는 3화음의 7음) — 위 코드는 출제 설정에서 고른 코드 종류 중에서 (텐션 없이)
//   Major /3 /5 /♭7 (C/E C/G C/B♭)      minor /♭3 /5 /♭7 (Cm/E♭ Cm/G Cm/B♭)
//   M7 /3 /5 (CM7/E CM7/G — CM7/B는 맨 아래 B와 위의 C가 부딪혀 뺌)
//   m7·7 /3 /5 /♭7 (Cm7/B♭ C7/E)       6·m6 /3 (F6/A Fm6/A♭ — F/A – Fm6/A♭ 같은 진행)
//   add9·madd9 /3 /5 (C(add9)/E Cm(add9)/G)
//   8마디 코드진행에서만 쓸 것(여기서는 안 냄): C 다음의 C/B, 라인 클리셰 CmM7/B, 종지 페달 Dm7(♭5)/C
// 하이브리드 코드: 베이스가 위 코드의 구성음이 아님 — 출제 설정의 코드 종류 칩과 상관없이 나옴 (모양 10가지, 같은 비율)
//   서스 도미넌트  B♭/C  B♭M7/C  Gm7/C  Am/D        서스 도미넌트 ♭9  B♭m/C  Gm7(♭5)/C
//   리디안  D/C        G/C        dim7  Ddim7/C  Bdim7/C
// "특정 베이스" 옵션은 슬래시 앞 코드(위 코드)의 근음으로 거름 (사용자 결정). 바로 앞 코드와 같은 맨 아래 음은 피함.
// 베이스 철자는 음정에 맞는 글자(B♭/C, F♯/E, Cm/E♭). 복잡한 음 표현이 꺼져 있으면 겹변화표·C♭ F♭ E♯ B♯를 쉬운 이름으로 (구성음과 같은 규칙).
//
// 돌려주는 코드는 엔진 generate의 결과(q)에 더해:
//   bass      슬래시 뒤 베이스 이름 ("E♭") — 분수코드가 아니면 없음
//   bassPc    맨 아래 음의 pc (분수코드가 아니면 근음) — 나중에 연주 채점을 붙일 때 "맨 아래 음"으로 씀
//   slash     "inv"(전위형) | "hybrid"(하이브리드) | 없음
//   symbol    "Cm7/B♭"처럼 베이스까지 붙인 이름
import { Engine } from "../core/engine.js";

export const SLASH_RATE = 0.25, INV_SHARE = 0.6;   // 분수코드 비율, 그 안에서 전위형 비율 (사용자 결정 2026-11-10)

// 음정: [반음, 도수] — 근음에서 위로 (C에서 [3, 3] = E♭)
const IV = { "3": [4, 3], b3: [3, 3], "5": [7, 5], b7: [10, 7] };

/** 전위형: 코드 종류 id → 베이스로 쓸 음 */
export const INVERSIONS = {
  maj: ["3", "5", "b7"], min: ["b3", "5", "b7"],
  M7: ["3", "5"], m7: ["b3", "5", "b7"], dom7: ["3", "5", "b7"],
  "6": ["3"], m6: ["b3"],
  add9: ["3", "5"], madd9: ["b3", "5"],
};

/**
 * 하이브리드 코드: [위 코드 종류 id, 위 코드 근음에서 베이스까지(반음, 도수 — 위로 잼)].
 * 베이스가 위 코드 근음보다 아래인 것도 같은 음이름이면 되므로 위로 잰 음정으로 씀 (완전5도 아래 = 완전4도 위, 온음 아래 = 단7도 위)
 */
export const HYBRIDS = [
  ["maj", [2, 2]],    // B♭/C   장3화음 / 온음 위       서스 도미넌트 (C9sus4)
  ["M7", [2, 2]],     // B♭M7/C M7 / 온음 위            서스 도미넌트 (C13sus4)
  ["m7", [5, 4]],     // Gm7/C  m7 / 완전5도 아래        서스 도미넌트
  ["min", [5, 4]],    // Am/D   단3화음 / 완전5도 아래
  ["min", [2, 2]],    // B♭m/C  단3화음 / 온음 위        서스 도미넌트 ♭9
  ["m7b5", [5, 4]],   // Gm7(♭5)/C                      서스 도미넌트 ♭9
  ["maj", [10, 7]],   // D/C    장3화음 / 온음 아래       리디안
  ["maj", [5, 4]],    // G/C    장3화음 / 완전5도 아래
  ["dim7", [10, 7]],  // Ddim7/C dim7 / 온음 아래
  ["dim7", [1, 2]],   // Bdim7/C dim7 / 반음 위
];

/**
 * 베이스 이름. 3중 변화표면 null(다시 뽑기), 복잡한 음 표현이 꺼져 있으면 겹변화표와 C♭ F♭ E♯ B♯를 쉬운 이름으로
 * (engine.js buildTones의 구성음 이름과 같은 규칙)
 */
function bassName(root, [semi, deg], optE) {
  const t = Engine.spellTone(root, semi, deg);
  if (Math.abs(t.a) > 2) return null;
  const odd = ((t.l === 0 || t.l === 3) && t.a === -1) || ((t.l === 2 || t.l === 6) && t.a === 1);
  return { pc: t.pc, name: !optE && (Math.abs(t.a) === 2 || odd) ? Engine.simpleName(t.pc, t.a) : t.name };
}

/** 위 코드(q)에 베이스를 붙임 */
const withBass = (q, b, kind) => ({ ...q, bass: b.name, bassPc: b.pc, slash: kind, symbol: q.symbol + "/" + b.name });

/** 출제 설정 s를 위 코드용으로: 텐션 없이, 코드 종류는 types만 */
const upper = (s, types) => ({ ...s, types, optC: false });

/** 전위형 하나. 고른 코드 종류 중 전위형이 되는 것이 없으면 null */
function inversion(s, rnd) {
  const ids = Object.keys(INVERSIONS).filter(id => s.types[id]);
  if (!ids.length) return null;
  const q = Engine.generate(upper(s, Object.fromEntries(ids.map(id => [id, true]))), rnd);
  if (q.error) return null;
  const list = INVERSIONS[q.type];
  const b = bassName(q.root, IV[list[Math.floor(rnd() * list.length)]], s.optE);
  return b && withBass(q, b, "inv");
}

/** 하이브리드 코드 하나 (10가지 모양 중 같은 비율로). 만들 수 없으면 null */
function hybrid(s, rnd) {
  const [id, iv] = HYBRIDS[Math.floor(rnd() * HYBRIDS.length)];
  const q = Engine.generate({ ...upper(s, { [id]: true }), weights: null }, rnd);
  if (q.error) return null;
  const b = bassName(q.root, iv, s.optE);
  return b && withBass(q, b, "hybrid");
}

/**
 * 코드 하나 출제 (무작위 코드 모드). s.slash가 꺼져 있으면 엔진 generate 그대로.
 * @param s     출제 설정 (improv/settings.js S + weights)
 * @param rnd   난수 함수 (테스트에서 고정값)
 * @param prev  바로 앞 코드 — 맨 아래 음(bassPc)이 같은 코드가 연달아 나오지 않게
 * @returns 코드(q), 또는 { error } (출제할 수 없는 설정)
 */
export function generate(s, rnd = Math.random, prev = null) {
  const prevBass = prev && !prev.error ? prev.bassPc ?? prev.rootPc : null;
  // 분수코드가 아니면: 엔진이 "앞 코드의 근음"을 피하게 되어 있으므로 앞 코드의 맨 아래 음을 근음인 것처럼 넘김
  const plain = () => {
    const q = Engine.generate(s, rnd, prevBass === null ? null : { rootPc: prevBass });
    return q.error ? q : { ...q, bassPc: q.rootPc };
  };
  if (!s.slash || rnd() >= SLASH_RATE) return plain();
  for (let tries = 0; tries < 20; tries++) {
    const q = rnd() < INV_SHARE ? inversion(s, rnd) || hybrid(s, rnd) : hybrid(s, rnd);
    if (q && q.bassPc !== prevBass) return q;
  }
  return plain();   // 분수코드를 만들 수 없음(아주 드묾) → 보통 코드
}
