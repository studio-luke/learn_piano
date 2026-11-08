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

import { lang } from "../i18n/index.js";

/** 사이트 맨 위 주소 (예: https://chordoven.com/). 이 파일 위치(assets/js/common/)에서 세 칸 위 */
export const ROOT = new URL("../../../", import.meta.url).href;

/** 페이지 주소 (사이트 맨 위 기준, 언어 표시 없이). 링크는 꼭 아래 pageUrl()로 만들어요.
 *  주소에는 .html을 붙이지 않아요 — 실제 사이트(Cloudflare)와 로컬 서버(tools/serve.js)가 /about → about.html로 연결해 줘요. */
export const ROUTES = {
  home: "",
  trainer: "trainer/chords/",
  nameTrainer: "trainer/chords-name/",   // 코드 추론하기 (2026-11-08)
  about: "about",
  mypage: "mypage",
  teacher: "teacher/",
};

/** 언어별로 따로 만드는 페이지 (/ko/about, /en/about …). tools/build.js의 PAGES와 같게 유지할 것 */
export const LOCALIZED = [ROUTES.home, ROUTES.trainer, ROUTES.nameTrainer, ROUTES.about];

/**
 * 페이지 링크 주소. 언어별 페이지면 언어 표시를 붙임:
 *   pageUrl(ROUTES.about) → ".../ko/about",  pageUrl(ROUTES.mypage) → ".../mypage"
 */
export const pageUrl = (route, l = lang()) => ROOT + (LOCALIZED.includes(route) ? l + "/" : "") + route;

export const SITEMAP = [
  {
    group: "navLearn",
    items: [
      { key: "navTrainer", path: ROUTES.trainer, icon: "🎹" },
      { key: "navNameTrainer", path: ROUTES.nameTrainer, icon: "🔍" },
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
