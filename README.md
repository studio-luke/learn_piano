# ChordOven — 코드 트레이너

도메인: https://chordoven.com (Cloudflare 연결 완료, 2026-11-07). 예전에 공유한 `learn-piano.jjtmddlf0505.workers.dev` 주소로 들어오면 모든 페이지가 chordoven.com의 같은 페이지로 넘겨줘요(`tools/build.js` `OLD_HOST`).

레슨생이 수업에서 배운 코드를 2옥타브 피아노 건반(C3–C5)으로 복습하는 웹앱입니다.
HTML·CSS·JS(ES 모듈) 파일에 작은 빌드 스크립트 하나(`tools/build.js`, 언어별 페이지 만들기)만 거쳐 배포합니다. 회원 기능(선택)은 Supabase를 쓰고, `src/assets/js/config.js`에 키를 넣었을 때만 켜집니다.

## 바로 시작하기

```bash
npm run dev        # 사이트를 만들고 로컬 서버 → http://localhost:8766 (src/를 고치면 자동으로 다시 만듦 → 새로고침). 연습은 /ko/trainer/chords/
npm run build      # 사이트 만들기만: src/ → dist/ (Cloudflare도 배포 때 이걸 실행)
npm test           # 엔진 규칙·번역 키·설정 안전 검사 (설치할 것 없음, Node 18 이상)
npm run audit      # 폰 화면 레이아웃 검사 (처음 한 번: npm i && npx playwright install chromium)
```

직접 고치는 건 항상 `src/`예요. `dist/`는 빌드가 매번 새로 만드는 결과물이라 고치지 않고, git에도 올리지 않아요(main에 push하면 Cloudflare가 직접 만들어 배포).

## 페이지

| 주소 | 파일 | 내용 |
|---|---|---|
| `/ko/`, `/en/`, `/ja/`, `/zh/` | `index.html` | 홈 — 소개와 학습 메뉴 카드 (언어별) |
| `/ko/about` … | `about.html` | About Us — 서비스 소개와 문의 연락처 (언어별) |
| `/ko/trainer/chords/` … | `trainer/chords/index.html` | 랜덤 코드 연습(코드 트레이너). 누구나 사용, 로그인하면 기록 저장 (언어별) |
| `/`, `/about`, `/trainer/chords/` | (빌드가 만듦) | 언어 고르는 입구 — 저장된 언어 → 브라우저 언어 → 영어 순으로 위 언어별 주소로 넘겨줌 (예전에 공유한 링크도 계속 동작) |
| `/mypage` | `mypage.html` | 마이페이지 — 내 연습 통계, 틀린 문제 다시 풀기 (로그인한 회원) |
| `/teacher/` | `teacher/index.html` | 선생님 — 학생 목록 (관리자만) |
| `/teacher/student?id=…` | `teacher/student.html` | 선생님 — 학생 한 명의 기록 (관리자만) |
| `/terms`, `/privacy` | `terms.html`, `privacy.html` | 이용약관·개인정보처리방침 (초안, 한국어만) |

**언어별 주소 (검색 노출용)**: 홈·About Us·코드 연습은 빌드가 언어마다 따로 만들어요(`/ko/…`, `/en/…`). 각 페이지에는 그 언어 문구, 검색 제목·설명(`seo…` 문구 키), 다른 언어판 주소(hreflang)가 HTML에 들어가고 `sitemap.xml`·`robots.txt`도 함께 만들어져요. 이 페이지들에서 언어를 바꾸면 그 언어 주소로 이동해요. 마이페이지·선생님·약관 페이지는 주소가 하나이고 JS가 글자를 바꿔요(로그인 화면이라 검색에 나올 필요가 없음).

주소에는 `.html`을 쓰지 않아요. 실제 사이트(Cloudflare)와 로컬 서버(`npm run dev`)가 `/about` → `about.html`로 연결하고, `/about.html`로 들어오면 `/about`으로 넘겨줘요. 다른 서버로 열어도 페이지 JS가 주소창의 `.html`을 지워요(`common/layout.js` `cleanAddressBar`). 링크를 새로 만들 때도 `.html` 없이 쓰세요.

## 폴더 구조

사이트 원본은 모두 **`src/`** 에 있고, `npm run build`가 이걸로 **`dist/`**(실제 사이트)를 만들어요 (원본 `src/` → 결과 `dist/`는 보편적인 구조).
Cloudflare는 `dist/` 폴더만 배포하므로 `src/`, `tests/`, `supabase/`, `README.md` 같은 파일은 사이트 주소로 열리지 않아요.

```
src/                        ← 사이트 원본 (직접 고치는 곳. 페이지의 파일 경로는 /assets/…처럼 사이트 맨 위 기준)
  index.html                홈            ┐ 빌드가 언어별로 만듦 (dist/ko/, dist/en/ …)
  about.html                About Us      │ 원래 자리에는 언어 고르는 입구
  trainer/chords/index.html 랜덤 코드 연습 ┘
  mypage.html               마이페이지
  teacher/index.html, student.html   선생님 — 학생 목록·학생 기록
  terms.html  privacy.html  이용약관·개인정보처리방침
  favicon.svg  favicon-32.png  apple-touch-icon.png   파비콘 (오븐 창 속 8분음표. svg가 원본)
  assets/sounds/piano/   피아노 녹음 30개 (C·D♯·F♯·A, A0~C8 — practice/audio.js가 재생. C3~D♯6 14개는 바로, 나머지 16개는 MIDI 건반을 쓸 때만 받음)
  assets/css/
    base.css        공통: 색·글꼴 토큰(테마, 다크 모드), 머리글·바닥글, ☰ 왼쪽 메뉴, 도움말(?), 버튼·체크박스·알림
    home.css        홈: 소개, 학습 메뉴 카드
    about.css       About Us
    practice.css    연습 페이지: 연습 카드, 건반, 타이머 버튼, 출제 설정, 폰 세로·가로 레이아웃
    stats.css       통계 페이지: 카드, 그래프, 표, 기간 달력, 선생님 화면
    account.css     로그인 창과 계정 사이드바
    legal.css       약관 페이지

  assets/js/
    config.js               Supabase 주소와 공개 키 (비우면 회원 기능 꺼짐)
    core/engine.js          코드 엔진: 출제·채점·철자·보이싱 (화면 없는 순수 함수 → Node에서 테스트)
    core/naming.js          코드 추론하기 엔진: 보이싱(자리바꿈)·코드 이름 읽기·복수 정답 (순수 함수)
    naming/settings.js keys.js keypad.js staff.js quiz.js   코드 추론하기의 출제 설정·건반(보기만)·코드 입력 키패드·오선지 악보(SVG)·문제 흐름(기록·타이머·다시 풀기)
    pages/naming.js         코드 추론하기 페이지 (trainer/chords-name/)
    i18n/index.js           언어 고르기, t("키") 문구 함수, data-i18n 속성 채우기
    i18n/ko.js en.js ja.js zh.js   화면 문구 (ko가 원문, 네 파일의 키가 같아야 함)
    common/layout.js        모든 페이지의 머리글·바닥글·☰ 왼쪽 메뉴·도움말(?)과 페이지 시작(startPage)
    common/sitemap.js       사이트 지도: 메뉴와 홈 카드에 나오는 페이지 목록 (새 기능은 여기에 추가), 링크 주소 만들기 pageUrl()
    common/dom.js           $("id"), esc()(HTML 안전하게), toast()(아래 알림)
    common/storage.js       localStorage 읽기·쓰기 (chordoven.* 키)
    account/account.js      로그인 상태와 DB 연결 (Supabase를 부르는 곳은 여기뿐)
    account/auth-dialog.js  로그인 창·회원가입·계정 사이드바 화면
    account/helpers.js      회원 기능의 작은 규칙 (오류 문구, 공개 키 확인 등 — 테스트용으로 분리)
    practice/settings.js    출제 설정 상태와 카드, 설정 잠금
    practice/keyboard.js    건반 그리기와 마우스·터치·키보드 입력
    practice/audio.js       피아노 소리 (녹음 파일 재생, 받기 전에는 합성음, MIDI 건반의 누름·뗌·서스테인 페달)
    input/midi.js           MIDI 건반 입력 (Web MIDI 연결·권한, 누름·뗌·페달 이벤트, 선택 규칙 latch/hold) — 건반 입력이 필요한 모든 페이지가 함께 씀
    practice/timer.js       타이머 (시계, 버튼, 도움말, 5분 규칙)
    practice/quiz.js        문제 흐름: 출제 → 채점 → 기록, 틀린 문제 다시 풀기
    stats/data.js           통계 계산 (기간, 그래프 칸, 표 묶기 — 순수 함수)
    stats/view.js           통계 화면 조각 (숫자 카드, 그래프, 표, 기간 달력)
    stats/gate.js           통계 페이지 입장 확인 (로그인·관리자)
    pages/home.js           홈 (학습 메뉴 카드)
    pages/about.js          About Us (이메일 복사)
    pages/practice.js       연습 페이지 시작점 (위 practice/* 를 연결, 단축키)
    pages/mypage.js  teacher-list.js  teacher-student.js   각 통계 페이지

supabase/schema.sql   DB 표·권한(RLS)·함수. Supabase SQL Editor에서 실행 (다시 실행해도 안전)
dist/                 빌드 결과 = 실제 사이트 (자동 생성, git에 안 올림)
tests/                engine.test.js, naming.test.js, schema.test.js, account.test.js, build.test.js (npm test), layout-audit.js (npm run audit)
tools/build.js        사이트 만들기: 언어별 페이지·입구·sitemap.xml (언어별 페이지 목록 PAGES, 사이트 주소 SITE)
tools/serve.js        로컬 서버 (npm run dev — 빌드 후 dist/를 사이트처럼 보여주고 src/ 변경을 지켜봄, 레이아웃 검사도 사용)
package.json          npm 명령 (dev, build, test, audit)
wrangler.jsonc        Cloudflare 배포 설정 (dist/ 폴더를 사이트로)
```

HTML은 틀만 있고 내용은 JS가 채워요.

운영자 개인 문서(작업 안내서, 사양 메모, 설정 가이드)는 저장소에 올리지 않습니다(`.gitignore`).

### 코드를 읽는 순서 (처음 볼 때)

1. `src/assets/js/core/engine.js` — 문제가 어떻게 만들어지고 채점되는지
2. `src/assets/js/pages/practice.js` → `practice/quiz.js` — 연습 화면이 어떻게 돌아가는지
3. `src/assets/js/account/account.js` + `supabase/schema.sql` — 로그인과 기록이 DB에 어떻게 들어가는지
4. `src/assets/js/stats/` + `pages/mypage.js` — 통계 화면

### 자주 하는 수정

- **화면 문구 바꾸기·추가**: `src/assets/js/i18n/` 네 파일 모두. HTML에는 `data-i18n="키"`, JS에서는 `t("키")`. `npm test`가 빠진 키를 잡아요.
- **새 학습 기능(페이지) 추가**: 폴더와 HTML을 만들고(예: `src/trainer/voice-leading/index.html`, 파일 경로는 `/assets/…`), `src/assets/js/pages/`에 시작 JS를 두고 `startPage()`를 부른 뒤, `common/sitemap.js` 항목에 `path`를 넣고 `soon`을 지우면 ☰ 메뉴와 홈 카드에 함께 나타나요. 검색에 나올 페이지면 `tools/build.js`의 `PAGES`와 `sitemap.js`의 `LOCALIZED`에도 주소를 넣고, 검색 제목·설명 문구(`seo…`)를 네 언어로 추가하세요. 링크는 항상 `pageUrl(ROUTES.…)`로 만들어요(언어 주소가 자동으로 붙음).
- **코드 종류 추가**: `core/engine.js`의 `TYPES`에 한 줄 (id는 DB 기록에도 쓰이니 한번 정하면 바꾸지 말 것) + `i18n`의 묶음 이름.
- **색 바꾸기**: `src/assets/css/base.css` 맨 위 `:root` 토큰과 다크 모드 두 블록. 화면 곳곳에 색 값을 직접 쓰지 말 것.
- **DB 바꾸기**: `supabase/schema.sql`을 고친 뒤 Supabase SQL Editor에서 파일 전체를 다시 실행 (이미 회원이 있으면 새 열은 비어도 되게 추가). 사이트보다 DB를 먼저.

## 기술 메모

- 빌드는 언어별 HTML만 만들고 JS는 그대로: 브라우저가 `<script type="module">`로 JS 파일을 직접 불러와요. 외부 라이브러리는 회원 기능용 supabase-js 하나(CDN, 버전 고정 + SRI 지문)
- 소리: 실제 피아노 녹음(Salamander Grand Piano, `src/assets/sounds/piano/`)을 Web Audio API로 재생. 녹음은 단3도마다 하나라 사이 음은 재생 속도로 맞추고, 파일은 페이지를 열 때 받기 시작하고, 첫 소리는 녹음이 준비될 때까지 잠깐 기다림(최대 3초, 못 받으면 합성음). 브라우저 정책상 첫 터치 뒤부터 소리가 남
- 폰트: Google Fonts(DM Serif Display, IBM Plex Sans KR, Noto Music). 불러오지 못하면 시스템 폰트
- 저장: 이 기기에는 localStorage(`chordoven.settings.v2`, `chordoven.lang`, `chordoven.rotateTip`), 로그인하면 출제 설정·연습 기록이 계정(Supabase)에도. "키보드로 건반 입력"은 기기별
- 권한: DB가 지켜요(행 수준 보안 RLS). 브라우저는 자기 기록만 읽고, 쓰기는 정해진 DB 함수로만. 화면의 검사는 편의용
- 언어: 언어별 페이지는 주소의 언어, 그 밖에는 저장된 선택 → 브라우저 언어 → 영어. 로그인하면 계정의 사용 언어로 맞춤(언어별 페이지면 그 언어 주소로 이동). 음이름(C D E…)과 코드 기호는 모든 언어에서 동일. en/ja/zh는 AI 번역 — 현지 음악인 검수 권장
- 디자인: "크림 & 코코아" 테마. 다크 모드는 기기 설정을 따름
- 반응형: 데스크톱 2단, 폰 세로(하단 고정 버튼 줄), 폰 가로(높이 520px 이하, 좌우 분할)
- MIDI 건반(Web MIDI): https 또는 localhost에서만 동작, Safari는 미지원. 처음 한 번은 "MIDI 입력 모드"를 켤 때 권한을 묻고, 허용한 뒤로는 페이지를 열면 자동 연결(모드를 꺼도 MIDI 입력은 됨). 모드를 켜면 88건반·모든 음 입력, 끄면 C3~C5 밖의 음은 소리만 나고 옥타브 이동 안내
- 단축키(데스크톱): Enter 제출(끝난 문제면 다음 문제), G 정답 확인, Space 재생, Esc 지우기, N 다음 문제(풀던 문제에 건반이 눌려 있으면 막힘 — 먼저 지우기). 키보드로 건반 입력: C3부터 q2w3er5t6y7ui9o0p[=]k,l./ (물리 키 기준이라 한글 입력 상태에서도 동작)

## 아직 없는 것

- Open Graph(링크 공유 미리보기 이미지·제목) 없음
- 홈의 학습 메뉴 카드·머리글은 JS가 그려서 HTML에는 없음 (구글은 JS를 실행해 읽지만, 중요한 글은 HTML에 직접 두는 게 확실)
- 소셜 로그인은 코드만 준비됨: 구글·카카오(·애플)는 Supabase에서 켠 뒤 `config.js`의 `oauthProviders`에 넣으면 버튼이 나타나요. 네이버는 Supabase가 지원하지 않아 없음
- 이용약관·개인정보처리방침 번역본 없음
- 오프라인 동작(PWA) 없음

## 앞으로 구현할 기능

- [x] 시간 측정 기능 (타이머 — 맞히기까지 걸린 시간 기록, 통계에 평균 시간)
- [x] 회원가입·로그인 (이메일, 모두 학생으로 가입, 관리자는 운영자 1명) — Supabase 연결됨
- [x] 구글·카카오 로그인 (코드 완료 — 대시보드 설정 후 `oauthProviders`로 켜기)
- [x] 개인 학습 통계 기능 (마이페이지: 정답·오답, 코드 종류·베이스·텐션별, 날짜별, 틀린 문제 다시 풀기)
- [x] 선생님이 학생의 학습 상태를 조회할 수 있는 페이지 (학생 기록)
- [ ] 선생님으로 가입 (필요해지면)
- [x] 미디 입력 인식 구현 (랜덤 코드 연습 — 컴퓨터의 Chrome·Edge, MIDI 입력 모드에서는 88건반)
- [ ] 건반(&악보)을 보고 코드 맞추기
- [ ] BPM 설정 후 랜덤 코드가 자동으로 넘어가는 '랜덤 코드 초견' 페이지 만들기 (완전 무작위 순서 / 조표 설정 기능)
- [ ] 보이스리딩 학습 페이지
- [ ] 각 코드별 설명 페이지
- [ ] 화성학 이론 학습 페이지
- [ ] 코드 진행 만들기 실습 페이지 (키를 선택하면 쓸 수 있는 코드 목록 보여주고(다이아토닉, 세컨더리 도미넌트 등 분리) 고르기, 코드 당 1~4박 여부에 따라 조정 가능하게 해야함)
- [ ] '내 음악 실력 테스트' 페이지

## 사용한 자료

- 피아노 소리: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) — Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). 단3도마다 30개 음(A0~C8)을 mp3로 사용(Tone.js가 배포하는 변환본)

## 문의

- E-mail: kim_8417@naver.com
- Instagram: @thrill_kim
