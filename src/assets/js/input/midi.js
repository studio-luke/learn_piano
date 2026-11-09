// ===== MIDI 건반 입력 (Web MIDI) — 페이지와 상관없이 쓰는 공통 부분 =====
// 연결된 MIDI 건반에서 "누름 / 뗌 / 서스테인 페달"을 받아 이벤트로 알려줘요. (2026-11-09 사용자 요청)
// 지금은 랜덤 코드 연습만 쓰지만, 앞으로 청음 연습·초견 연주처럼 피아노 건반 입력이 필요한 페이지가 모두 함께 쓸 수 있게
// 화면·채점과 관계없는 일만 여기서 해요. 건반을 어떻게 고를지(선택 규칙)는 아래 midiSelection으로 페이지가 골라요.
//
// 권한과 연결
//   - Web MIDI는 https 또는 localhost에서만 동작해요(보안 컨텍스트). 폰 LAN 주소(http://192.168…)로는 안 됨
//   - Chrome·Edge 등은 처음 연결할 때 권한 창을 띄워요. 권한을 받기 전에는 기기가 꽂혀 있는지도 알 수 없어서,
//     처음 한 번은 사용자가 "MIDI 입력 모드"를 켤 때 권한을 요청해요(connect). 한 번 허용하면 그 뒤로는 페이지를 열 때
//     권한 창 없이 자동으로 연결해요(autoConnect) — MIDI 입력 모드를 켜지 않아도 MIDI 입력이 동작
//   - Safari(맥·iPhone 모두)는 Web MIDI를 지원하지 않아요 → supported = false
//   - 연결된 뒤 건반을 꽂거나 빼면 바로 알아차림(statechange)
//
// 이벤트 (Midi.on(이름, 함수))
//   noteon(m, vel)   건반을 누름 — m: MIDI 번호(60 = C4), vel: 세기 1~127
//   noteoff(m)       건반을 뗌 (세기 0인 noteon도 뗌으로 침 — 그렇게 보내는 건반이 많음)
//   pedal(on)        서스테인 페달(CC 64)을 밟음/뗌 (64 이상 = 밟음)
//   state()          연결 상태나 기기 목록이 바뀜 → Midi.state, Midi.devices를 다시 읽으면 됨
//   채널은 구분하지 않아요(어느 채널이든 같은 건반으로 봄).

/** 이 브라우저가 Web MIDI를 지원하는지 (Safari·옛 브라우저는 false) */
const supported = typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";

const listeners = { noteon: [], noteoff: [], pedal: [], state: [] };
const emit = (type, ...args) => listeners[type].forEach(fn => fn(...args));

let access = null;      // MIDIAccess (연결된 뒤)
let asking = null;      // 권한을 묻는 중인 Promise (여러 번 불러도 한 번만 물음)

export const Midi = {
  supported,
  /** "off"(아직 연결 안 함) | "ready"(연결됨 — 기기는 devices) | "denied"(권한 거부) | "unsupported" */
  state: supported ? "off" : "unsupported",
  /** 연결된 입력 기기 이름들 */
  devices: [],

  /** 이벤트 받기. 이름은 위 목록 */
  on(type, fn) { listeners[type].push(fn); },

  /**
   * 연결하기 — 아직 권한이 없으면 브라우저가 권한 창을 띄움.
   * @returns 연결됐으면 true, 거부·미지원이면 false
   */
  connect() {
    if (!supported) return Promise.resolve(false);
    if (access) return Promise.resolve(true);
    asking ||= navigator.requestMIDIAccess({ sysex: false }).then(a => {
      access = a;
      access.onstatechange = bindInputs;   // 건반을 꽂거나 뺄 때
      bindInputs();
      return true;
    }, () => {
      Midi.state = "denied"; asking = null;
      emit("state");
      return false;
    });
    return asking;
  },

  /**
   * 페이지를 열 때: 전에 권한을 허용한 브라우저면 권한 창 없이 연결. 아직 묻지 않았거나 거부했으면 아무것도 안 함
   * (모든 방문자에게 권한 창을 띄우지 않으려고 — MIDI 건반이 없는 사람이 대부분이라서)
   */
  async autoConnect() {
    if (!supported || !navigator.permissions) return false;
    try {
      const p = await navigator.permissions.query({ name: "midi" });
      if (p.state === "granted") return Midi.connect();
      if (p.state === "denied") { Midi.state = "denied"; emit("state"); }
    } catch (e) { /* 권한 조회를 지원하지 않는 브라우저(Firefox 등) — 자동 연결은 안 하고, 사용자가 켤 때 연결 */ }
    return false;
  },
};

/** 지금 연결된 입력 기기마다 메시지 받는 함수를 걸고, 상태를 알림 */
function bindInputs() {
  const names = [];
  access.inputs.forEach(input => {
    input.onmidimessage = onMessage;
    if (input.state !== "disconnected") names.push(input.name || "MIDI");
  });
  Midi.devices = names;
  Midi.state = "ready";
  emit("state");
}

/** MIDI 메시지 한 개 → 이벤트. 첫 바이트의 위 4비트가 종류, 아래 4비트가 채널(무시) */
function onMessage(e) {
  const [status, d1, d2] = e.data;
  const kind = status & 0xf0;
  if (kind === 0x90 && d2 > 0) emit("noteon", d1, d2);
  else if (kind === 0x80 || kind === 0x90) emit("noteoff", d1);
  else if (kind === 0xb0 && d1 === 64) emit("pedal", d2 >= 64);
  // 그 밖(클럭·액티브 센싱·다른 컨트롤러 등)은 무시
}

/**
 * 선택 규칙 — MIDI의 누름·뗌을 "고른 건반"의 변화로 바꿔 줌. 페이지마다 규칙을 고를 수 있게 따로 둠.
 *   "latch"  누르면 선택, 떼도 그대로. 모든 건반을 뗀 뒤 다시 누르면 앞의 선택을 지우고 새로 시작 (랜덤 코드 연습 —
 *            화음을 잡았다 떼고 [제출]을 누르는 흐름, 2026-11-09 사용자 결정)
 *   "hold"   누르고 있는 동안만 선택, 떼면 해제 (앞으로 만들 페이지에서 쓸 수 있게)
 * @param mode   "latch" | "hold"
 * @param apply  { add(m), remove(m), clear() } — 페이지의 선택 집합을 바꾸는 함수들
 * @returns { down(m), up(m) } — 누름·뗌 때 부를 것. 선택 대상이 아닌 건반(예: 범위 밖)은 부르지 말 것
 */
export function midiSelection(mode, apply) {
  const held = new Set();   // 지금 손가락으로 누르고 있는 건반
  return {
    down(m) {
      if (mode === "latch" && held.size === 0) apply.clear();   // 새 화음의 시작
      held.add(m);
      apply.add(m);
    },
    up(m) {
      if (!held.delete(m)) return;
      if (mode === "hold") apply.remove(m);
    },
  };
}
