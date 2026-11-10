// ===== 브라우저 저장소(localStorage) =====
// 이 기기에만 남는 값(언어, 출제 설정, 안내 닫음 여부)을 저장해요. 키 앞에는 "chordoven."이 붙어요.
//   chordoven.lang          화면 언어
//   chordoven.settings.v2   출제 설정 (구조를 크게 바꾸면 v3로 올리고 옮기는 코드를 둘 것)
//   chordoven.rotateTip     "폰을 가로로 돌리면…" 안내를 닫았는지
//   chordoven.scrollTip     "아래로 내리면 출제할 코드를…" 안내를 볼 필요가 없어졌는지 (출제 설정을 한 번 봤으면 "seen")
//   chordoven.nameSettings.v1  코드 추론하기의 출제 설정 (랜덤 코드 연습과 옵션이 달라서 따로)
//   chordoven.nameScrollTip     코드 추론하기의 "아래로 내리면…" 안내 (scrollTip과 따로)
//   chordoven.improvBpm         코드 초견의 템포 (두 모드 공통, 30~240)
//   chordoven.improvMidiSound   코드 초견의 "MIDI 건반 입력 시 소리 재생" ("off"면 끔)
//   chordoven.improvRandom.v1   코드 초견 무작위 코드 모드의 출제 설정 (improv/settings.js)
//   chordoven.improvScrollTip   코드 초견의 "아래로 내리면…" 안내 (출제 설정을 한 번 봤으면 "seen")
//   chordoven.improvProg.v1     코드 초견 8마디 코드진행 모드의 출제 설정 (improv/prog-settings.js)
// 사생활 보호 모드 등에서는 localStorage가 막힐 수 있어서 모든 읽기·쓰기를 try로 감싸요.

const PREFIX = "chordoven.";

export const store = {
  get(key) { try { return localStorage.getItem(PREFIX + key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(PREFIX + key, value); } catch (e) { /* 저장 못 해도 동작은 계속 */ } },
  getJSON(key) { try { return JSON.parse(this.get(key) || "null"); } catch (e) { return null; } },
  setJSON(key, value) { this.set(key, JSON.stringify(value)); },
};

// 처음 이름이 "Chord Lab"이던 시절의 키(chordlab.*)를 한 번만 새 키로 옮기고 지움 (2026-10-27 브랜드 변경)
for (const k of ["lang", "settings.v2", "rotateTip"]) {
  try {
    const old = localStorage.getItem("chordlab." + k);
    if (old !== null) {
      if (localStorage.getItem(PREFIX + k) === null) localStorage.setItem(PREFIX + k, old);
      localStorage.removeItem("chordlab." + k);
    }
  } catch (e) { /* 저장소를 못 쓰면 옮길 것도 없음 */ }
}
