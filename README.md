# Chord Lab — 코드 트레이너

레슨생이 수업에서 배운 코드를 2옥타브 피아노 건반(C3–C5)으로 복습하는 웹앱입니다.
서버, 빌드 도구, 외부 라이브러리 없이 HTML 파일 하나로 동작합니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 바로 배포할 수 있는 완성본. 이 파일 하나만 올리면 동작함 |
| `src/engine.js` | 코드 엔진. 코드 정의, 출제 가중치, 텐션 규칙, 음 철자, 채점, 정답 보이싱. DOM 없이 순수 함수라 Node에서도 테스트 가능 (`require("./src/engine.js")`) |
| `src/ui.html` | 화면(HTML·CSS·UI 스크립트). `/*ENGINE*/` 자리에 engine.js가 들어감 |
| `build.js` | `node build.js` 로 src 두 파일을 합쳐 `index.html`을 다시 만듦 |
| `chord-lab-spec.md` | 지금까지 정한 출제·채점·표기·UI 규칙 전체 |

수정할 때는 `src/` 파일을 고친 뒤 `node build.js`를 실행하면 됩니다. `index.html`을 직접 고쳐도 동작은 하지만, 다음 빌드 때 덮어써집니다.

## 기술 메모

- 소리: Web Audio API로 직접 합성(샘플 파일 없음). 브라우저 정책상 첫 터치 뒤부터 소리가 남
- 폰트: Google Fonts(DM Serif Display, IBM Plex Sans KR, Noto Music). 불러오지 못하면 시스템 폰트로 대체
- 저장: 설정은 브라우저 localStorage에만 저장 (`chordlab.settings.v2`, `chordlab.rotateTip`). 서버나 계정 없음, 기기마다 따로 저장됨
- 학습 기록(첫 시도 정답, 연속)은 페이지를 새로 열면 초기화됨
- 다크 모드: 기기 설정(prefers-color-scheme)을 따름
- 반응형: 데스크톱 2단, 폰 세로(하단 고정 버튼 줄), 폰 가로(높이 520px 이하, 좌우 분할) 레이아웃
- 키보드 단축키(데스크톱): Enter 채점, Space 재생, Esc 지우기, N 다음 문제

## 아직 없는 것

- 검색엔진용 메타 정보는 `description` 한 줄만 있음 (Open Graph 이미지, canonical URL, 파비콘, sitemap 없음)
- 로그인, 구독, 서버 측 학습 기록 없음
- 오프라인 동작(PWA) 없음
