// ===== 사이트 지도 =====
// 왼쪽 메뉴(☰)와 홈 화면의 학습 카드가 이 목록을 그대로 써요.
// 새 학습 기능을 만들면: 페이지를 만들고 → 여기 항목에 path를 넣고 soon을 지우면 메뉴와 홈에 함께 나타나요.
//
//   key    화면 문구 키 (assets/js/i18n/*.js) — 이름은 key, 홈 카드 설명은 key + "Desc"
//   path   사이트 맨 위 기준 주소 (폴더면 끝에 /)
//   soon   true면 "준비 중"으로 보이고 누를 수 없음
//   need   "member"(로그인한 회원에게만 보임) | "admin"(관리자에게만 보임)
//   icon   홈 카드의 작은 그림 (글자 이모지)

export const ROUTES = {
  home: "",
  trainer: "trainer/chords/",
  mypage: "mypage.html",
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
    group: "navMine",
    items: [
      { key: "menuMy", path: ROUTES.mypage, need: "member" },
      { key: "menuStudents", path: ROUTES.teacher, need: "admin" },
    ],
  },
];
