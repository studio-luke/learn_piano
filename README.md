# Chord Lab — 코드 트레이너

레슨생이 수업에서 배운 코드를 2옥타브 피아노 건반(C3–C5)으로 복습하는 웹앱입니다.
서버, 빌드 도구, 외부 라이브러리 없이 HTML 파일 하나로 동작합니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 바로 배포할 수 있는 완성본. 이 파일 하나만 올리면 동작함 |
| `src/engine.js` | 코드 엔진. 코드 정의, 출제 가중치, 텐션 규칙, 음 철자, 채점, 정답 보이싱. DOM 없이 순수 함수라 Node에서도 테스트 가능 (`require("./src/engine.js")`) |
| `src/ui.html` | 화면(HTML·CSS·UI 스크립트). `/*ENGINE*/`, `/*I18N*/` 자리에 engine.js, i18n.js가 들어감 |
| `src/i18n.js` | 화면 문구 번역(한국어·영어·일본어·중국어 간체). 문구를 바꾸거나 언어를 추가할 때 이 파일만 고치면 됨 |
| `build.js` | `node build.js` 로 src 세 파일을 합쳐 `index.html`을 다시 만듦 |
| `chord-lab-spec.md` | 지금까지 정한 출제·채점·표기·UI 규칙 전체 |
| `CLAUDE.md` | Claude Code용 안내서: 작업 규칙, 명령어, 코드만 봐서는 안 보이는 설계 결정 |
| `tests/engine.test.js` | 엔진 규칙·번역 키 자동 검사 (`npm test`) |
| `tests/layout-audit.js` | 16개 폰 화면 크기에서 버튼·건반 잘림 검사 (`npm run audit`) |
| `package.json` | `npm run build` / `npm test` / `npm run audit` 명령 정의 |
| `wrangler.jsonc`, `.assetsignore` | Cloudflare 배포 설정. 저장소 루트를 사이트로 올리되 `node_modules` 등은 제외 |

수정할 때는 `src/` 파일을 고친 뒤 `npm run build`(= `node build.js`)와 `npm test`를 실행하면 됩니다. `index.html`을 직접 고쳐도 동작은 하지만, 다음 빌드 때 덮어써집니다.

## 기술 메모

- 소리: Web Audio API로 직접 합성(샘플 파일 없음). 브라우저 정책상 첫 터치 뒤부터 소리가 남
- 폰트: Google Fonts(DM Serif Display, IBM Plex Sans KR, Noto Music). 불러오지 못하면 시스템 폰트로 대체
- 저장: 설정은 브라우저 localStorage에만 저장 (`chordlab.settings.v2`, `chordlab.rotateTip`, `chordlab.lang`). 서버나 계정 없음, 기기마다 따로 저장됨
- 학습 기록(정답/시도 = 첫 채점에 맞힌 수 / 푼 문제 수, 연속)은 페이지를 새로 열면 초기화됨
- 언어: 저장된 선택 → 브라우저 언어(navigator.languages) → 영어 순으로 결정. 오른쪽 위 드롭다운으로 바꾸면 `chordlab.lang`에 저장. 음이름(C D E…)과 코드 기호는 모든 언어에서 동일
- 번역: ko 원문, en/ja/zh는 AI 번역 — 현지 음악인 검수 권장
- 다크 모드: 기기 설정(prefers-color-scheme)을 따름
- 반응형: 데스크톱 2단, 폰 세로(하단 고정 버튼 줄), 폰 가로(높이 520px 이하, 좌우 분할) 레이아웃
- 키보드 단축키(데스크톱): Enter 채점(채점이 끝난 뒤에는 다음 문제), L 정답 확인(포기), Space 재생, Esc 지우기, N 다음 문제. 물리 키(e.code) 기준이라 한글 입력 상태에서도 동작
- 키보드로 건반 입력(마우스·트랙패드가 있는 기기에서만 보이는 옵션, 그런 기기에서는 기본으로 켜짐): C3부터 q2w3er5t6y7ui9o0p[=]azsxc. 키를 누르고 있어도 한 번만 입력

## 아직 없는 것

- 언어 전환이 한 주소 안에서 화면만 바뀌는 방식이라, 검색엔진에는 한국어 페이지만 노출됨. 언어별 검색 노출이 필요하면 언어별 주소(/en/, /ja/ 등)와 hreflang 설정이 필요
- 검색엔진용 메타 정보는 `description` 한 줄만 있음 (Open Graph 이미지, canonical URL, 파비콘, sitemap 없음)
- 로그인, 구독, 서버 측 학습 기록 없음
- 오프라인 동작(PWA) 없음

## 앞으로 구현할 기능

- [ ] 시간 측정 기능 ('TEST' 기능)
- [ ] 미디 입력 인식 구현
- [ ] 로그인 기능 (학생/선생님)
- [ ] 개인 학습 통계 기능
- [ ] 선생님이 학생의 학습 상태를 조회할 수 있는 페이지
- [ ] '내 음악 실력 테스트' 페이지
- [ ] 각 코드별 설명 페이지
- [ ] 보이스리딩 학습 페이지
- [ ] 화성학 이론 학습 페이지

## 문의

- E-mail: kim_8417@naver.com
- Instagram: @thrill_kim
