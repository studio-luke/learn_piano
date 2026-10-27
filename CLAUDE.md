# CLAUDE.md — ChordOven

이 파일은 Claude Code가 작업을 시작할 때 자동으로 읽는 프로젝트 안내서입니다.
claude.ai(Cowork)에서 진행한 개발 내용을 이어받기 위해 작성했습니다.

## 프로젝트

- 작곡가·작편곡/피아노/화성학 레슨 강사가 레슨생 복습용으로 만드는 코드(화음) 학습 웹앱 "ChordOven" (처음엔 임시 이름 "Chord Lab"이었음).
- 도메인 chordoven.com 구매 완료, 아직 연결 안 함. 플랫폼이 어느 정도 갖춰지면 연결 후 홍보 예정 — 사용자가 요청하기 전엔 연결 작업 하지 말 것.
- 브랜드 콘셉트: "연습을 통해 음악을 완성한다" — 음 = 재료, 연습 = 굽는 과정. 베이커리 테마는 로고·삽화·보상에 집중하고, 학습 화면과 기능 이름(채점, 학습 기록 등)은 명료하게 유지. 성인 학습자·강사도 쓰므로 귀여움은 절제.
- 지금은 코드 트레이너 한 화면: 출제된 코드를 2옥타브 건반(C3–C5)에서 눌러 채점.
- 장기 목표: 커리큘럼 웹북, 로그인·구독, 학생/선생님 기능, 해외 사용자(다국어).

## 작업 규칙 (사용자 지정 — 반드시 지킬 것)

1. **작업 전에 결과가 달라질 수 있는 결정 사항이 있으면 먼저 질문하고, 답을 받은 뒤 시작한다.** 질문은 꼭 필요한 것만, 추천안과 함께. 질문할 게 없으면 그렇다고 말하고 진행.
2. 규칙·사양이 바뀌면 `chordoven-spec.md`를 함께 고친다. 구현 예정 목록은 `README.md`.
3. 화면 문구를 바꾸거나 추가하면 `src/i18n.js`의 ko·en·ja·zh 네 언어를 모두 고친다 (`npm test`가 키 누락을 잡음).
4. 수정 후 `npm run build` → `npm test`. 레이아웃을 건드렸으면 `npm run audit`로 폰 화면 잘림 확인.
5. 사용자는 한국어로 소통. 설명은 간결하게, 바뀐 점 위주로.

## 구조와 명령

```
src/engine.js   코드 엔진 (순수 함수, DOM 없음): 코드 정의·가중치·텐션·철자·채점·보이싱
src/i18n.js     UI 문구 사전 (ko 원문, en/ja/zh 번역)
src/ui.html     화면(HTML·CSS·UI 스크립트). /*ENGINE*/, /*I18N*/ 자리에 위 두 파일이 들어감
build.js        src → index.html (단일 파일, 외부 의존성 없음)
index.html      배포본 — 직접 고치지 말 것 (빌드 때 덮어씀)
tests/          engine.test.js (node:test), layout-audit.js (Playwright)
```

- `npm run build` — index.html 생성
- `npm test` — 엔진 규칙 + 번역 키 검사 (의존성 없음, Node 18+)
- `npm run audit` — 16개 폰 화면 크기 × 세로/가로 × 주소창 유무로 버튼·건반 잘림 검사, 문제 화면은 `tests/audit-output/`에 스크린샷 (최초 1회 `npm i` + `npx playwright install chromium`)

## 배포 (중요)

- GitHub 저장소 `studio-luke/learn_piano`의 `main` 브랜치가 Cloudflare에 연결되어 있고, push하면 바로 사이트가 갱신된다.
- **Cloudflare는 빌드를 하지 않는다.** 저장소에 커밋된 `index.html`을 그대로 서비스한다. 그러므로 `src/`를 고쳤으면 반드시 `npm run build`로 만든 `index.html`까지 같은 커밋에 포함할 것. (src만 커밋하면 사이트가 안 바뀜)
- 저장소 루트 전체가 공개 사이트에 올라간다 (README.md, CLAUDE.md, src/, tests/도 주소로 열람 가능). 비밀 정보(API 키, 비밀번호, 학생 개인정보)는 절대 커밋하지 말 것.
- push 순서: 수정 → `npm run build` → `npm test` → 사용자에게 바뀐 점 요약 → 사용자 확인 후 commit & push. 큰 변경은 별도 브랜치로 push하면 Cloudflare 미리보기 주소에서 먼저 확인 가능.
- Cloudflare는 `package.json`이 있으면 의존성을 설치한 뒤 `npx wrangler deploy`를 실행하고, 루트(`.`) 전체를 사이트 파일로 올린다. `wrangler.jsonc`가 그 설정이고, `.assetsignore`로 `node_modules` 등을 제외한다 — 빠지면 `node_modules`의 137MB 파일 때문에 "Asset too large"(25MiB 제한)로 배포 실패. 새 대용량·비공개 폴더가 생기면 `.assetsignore`에 추가할 것.
- 배포가 비정상적으로 느리거나 실패하면 Cloudflare 배포 로그를 확인 (devDependency 설치 때문이면 Cloudflare 환경변수 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).

## 꼭 알아야 할 설계 결정

출제·채점·표기 규칙 전체는 `chordoven-spec.md`. 코드만 봐서는 이유가 안 보이는 것들:

- **채점은 피치클래스 집합 비교** → 자리바꿈·옥타브·중복음 허용. `required`(필수) / `optional`(생략 가능, 정답 문장에서 괄호 표시) / `anyOf`(7alt: 1개 이상).
- **괄호 친 음 = 생략 가능한 음** (예: C7(9,13) = C E (G) B♭ D A). 사용자가 오류로 오해한 적이 있으나 "현재 표기 유지"로 결정됨.
- **♯5/♭5 표기**는 도미넌트 계열(7, 9, 13)에만, 이때 완전5도를 누르면 오답. M7(♭5)는 쓰지 않음.
- **텐션 제한**: dim7·augM7·m11은 텐션 없음, m7(♭5)·mM7은 최대 1개, M9에 (9) 불가, CM13(9)·Cm11(9)는 중복 표기라 출제 안 함.
- **철자**: 근음 기준 도수 철자법. 옵션 E 꺼짐 → 겹변화표·C♭ F♭ E♯ B♯를 쉬운 이름으로. 옵션 E 켜짐 → 원래 철자(겹변화표 포함). 선택한 음 목록·건반 라벨은 옵션과 무관하게 겹변화표를 쓰지 않음.
- **음이름(C D E…)과 코드 기호는 모든 언어 동일** — 번역 대상 아님 (사용자 결정).
- **단축키는 `e.code`(물리 키) 기준** → 한글 입력 상태에서도 동작. 키보드 건반 배열 C3부터 `q2w3er5t6y7ui9o0p[=]azsxc`.
- **Enter**: 문제가 열려 있으면 채점, 정답 채점·정답 확인 뒤에는 다음 문제. 버튼에 자동 포커스를 주면 Enter를 가로채는 버그가 있었으므로 금지.
- **PC 판별** = `(hover: hover) and (pointer: fine)`. PC에서는 "키보드로 건반 입력"이 기본 켜짐, 사용자가 끄면 `kbdTouched`로 기억.
- **터치**: 손을 뗄 때 입력, 10px 넘게 움직이면 스크롤로 간주(스크롤하다 건반이 눌리는 문제 해결).
- **폰 세로**: 채점 버튼 줄 하단 고정(sticky), 건반 카드 폭 전체. **폰 가로**(높이 ≤520px): 왼쪽 코드·버튼, 오른쪽 건반. 이 두 레이아웃은 실제 기기 크기로 검사해서 맞춘 것이므로 바꿀 땐 `npm run audit`.
- **localStorage 키**: `chordoven.settings.v2`, `chordoven.lang`, `chordoven.rotateTip`. 예전 `chordlab.*` 키는 UI 스크립트 맨 앞에서 한 번 옮기고 지움. 설정 구조를 크게 바꾸면 키 버전을 올릴 것.
- **테마 "크림 & 코코아"**: 색은 모두 `src/ui.html` 맨 위 `:root` 토큰(라이트) + 다크 두 블록. 색을 직접 쓰지 말고 토큰을 쓸 것. 바탕 종이 질감은 body의 인라인 SVG 노이즈.
- **파비콘**: `favicon.svg`(원본), `favicon-32.png`, `apple-touch-icon.png`(크림 바탕을 깐 180px). svg를 고치면 png도 다시 만들 것 (macOS: `qlmanage -t -s 180 -o <폴더> <svg>`).
- **Cloudflare Worker 이름은 아직 `learn-piano`** (wrangler.jsonc). 바꾸면 새 Worker·새 주소가 생기므로 도메인 연결 때 함께 정리하기로 함.
- 처음에는 claude.ai 아티팩트로 배포해서 `src/ui.html`에 `<meta name="claude:viewport-fit-sides">`가 있음. build.js가 이를 지우고 doctype·리셋 CSS를 붙여 단독 실행 가능한 index.html을 만듦.

## 다음 할 일 (README "앞으로 구현할 기능")

시간 측정('TEST'), 미디 입력(Web MIDI — https 또는 localhost에서만 동작), 로그인(학생/선생님), 개인 학습 통계, 선생님용 학생 학습 상태 페이지, '내 음악 실력 테스트', 코드별 설명 페이지, 보이스리딩 학습, 화성학 이론 학습.
로그인·통계부터는 서버/DB가 필요해 단일 HTML 구조를 벗어나야 함 — 구조 변경 전에 사용자와 방향(프레임워크, 호스팅, 인증·DB 서비스, 비용)을 먼저 상의할 것.
