// ===== 사이트 설정 =====
// Supabase 프로젝트 주소와 공개 키 (Supabase 대시보드 → Project Settings → API).
// 둘 다 비워 두면 회원 기능 전체가 꺼지고(로그인 버튼·약관 링크 숨김) 코드 트레이너만 동작해요.
//
// supabaseKey에는 반드시 "공개 키"(publishable / anon)만 넣을 것.
// 이 파일은 사이트와 함께 누구나 볼 수 있게 공개돼요. secret / service_role 키를 넣으면 DB 전체가 뚫려요.
// (npm test가 이 파일에 비밀 키가 들어 있으면 실패하도록 검사해요.)
export const CONFIG = {
  supabaseUrl: "https://joxtekvxbivcvreyjhrv.supabase.co",
  supabaseKey: "sb_publishable_R-IxJhURzrREQIdFC7hvhg_NHCritIT",
  // 로그인 창에 보여줄 소셜 로그인 버튼 (순서대로). 쓸 수 있는 값: "google", "kakao", "apple"
  // Supabase 대시보드(Authentication → Sign In / Providers)에서 그 회사를 켠 뒤에만 넣을 것 — 켜기 전에 넣으면 눌렀을 때 오류
  oauthProviders: ["google"],
  // 자동 가입·로그인 방지 Cloudflare Turnstile의 "사이트 키"(공개용, 비밀 키 아님). 비워 두면 꺼짐.
  // 순서: 여기에 넣고 배포 → 그다음 Supabase(Attack Protection)에서 켜기. 반대로 하면 그 사이 로그인이 모두 거부돼요
  turnstileSiteKey: "0x4AAAAAAF3OeKiV_zKEHhsk",
};
