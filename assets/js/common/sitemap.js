// ===== 사이트 지도 =====
// 왼쪽 메뉴(☰)와 홈 화면의 학습 카드가 이 목록을 그대로 써요.
// 왼쪽 메뉴는 회원/비회원과 상관없는 사이트 지도만 보여줘요. 마이페이지·학생 통계는 오른쪽 계정 사이드바에 있어요
// (사용자 결정 2026-11-06).
// 새 학습 기능을 만들면: 페이지를 만들고 → 여기 항목에 path를 넣고 soon을 지우면 메뉴와 홈에 함께 나타나요.
//
//   group  묶음 제목 문구 키 (null이면 제목 없이 구분선만)
//   key    화면 문구 키 (assets/js/i18n/*.js) — 이름은 key, 홈 카드 설명은 key + "Desc"
//   path   사이트 맨 위 기준 주소 (폴더면 끝에 /)
//   soon   true면 "준비 중"으로 보이고 누를 수 없음
//   icon   홈 카드의 작은 그림 (글자 이모지)

/** 페이지 주소 (사이트 맨 위 기준). 링크는 ROOT(auth-dialog.js) + 이 값으로 만들어요.
 *  주소에는 .html을 붙이지 않아요 — 실제 사이트(Cloudflare)와 로컬 서버(tools/serve.js)가 /about → about.html로 연결해 줘요. */
export const ROUTES = {
  home: "",
  trainer: "trainer/chords/",
  about: "about",
  mypage: "mypage",
  teacher: "teacher/",
};

export const SITEMAP = [
  {
    group: "navLearn",
    items: [
      { key: "navTrainer", path: ROUTES.trainer, icon: "🎹" },
      { key: "navChordGuide", soon: true, icon: "📖" },
      { key: "navVoiceLeading", soon: true, icon: "🎼" },
      { key: "navTheory", soon: true, icon: "🎵" },
      { key: "navSkillTest", soon: true, icon: "🏅" },
    ],
  },
  {
    group: null,
    items: [
      { key: "navAbout", path: ROUTES.about },
    ],
  },
];
