// ===== 로컬 확인용 웹 서버 =====
// 사이트가 JS 모듈(<script type="module">)을 쓰기 때문에, index.html을 파일로 바로 열면(file://) 브라우저가 모듈을 막아요.
// 이 서버로 열어서 확인하세요:   npm run dev   →   http://localhost:8766
// (폰에서 같은 와이파이로 보려면: HOST=0.0.0.0 npm run dev 후 http://<이 컴퓨터 IP>:8766 — 공유가 끝나면 꺼 주세요)
//
// 실제 사이트(Cloudflare)처럼 빌드 결과인 dist/ 폴더의 파일을 보내요 (그 밖의 개발용 파일은 보내지 않음).
// npm run dev로 켜면 먼저 사이트를 만들고(tools/build.js), src/의 파일을 고칠 때마다 자동으로 다시 만들어요 → 브라우저 새로고침만 하면 됨.
// 레이아웃 검사(tests/layout-audit.js)도 이 서버를 씁니다.
//
// npm run dev:stub (포트 8769): 같은 서버인데 모든 html에 가짜 Supabase(tools/stub/supabase-stub.js)를 끼워 넣어
// 진짜 계정 없이 로그인한 상태의 화면을 확인 (2026-11-09). dist/ 파일은 건드리지 않고 보낼 때만 바꿔요.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, SRC, DIST } from "./build.js";

const ROOT = DIST;   // 사이트 = dist/ (빌드 결과)
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon",
};
// 숨김 파일(.DS_Store 등)은 보내지 않음
const PRIVATE = /\/\./;

// 가짜 Supabase를 끼울 때 html의 첫 모듈 스크립트 앞에 넣는 것:
//   시계 조절(window.__off ms만큼 Date.now를 앞으로 — 타이머 5분 무입력 같은 시험용) + 가짜 supabase-js
const STUB_FILE = fileURLToPath(new URL("./stub/supabase-stub.js", import.meta.url));
const STUB_TAGS = '<script>window.__off=0;(()=>{const r=Date.now.bind(Date);Date.now=()=>r()+window.__off;})();</script><script src="/__stub/supabase.js"></script>\n';

/**
 * 사이트 서버 켜기.
 * @param opt.stub  true면 가짜 Supabase를 끼워 넣음 (npm run dev:stub)
 */
export function serve(port = 8766, host = "127.0.0.1", opt = {}) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (opt.stub && p === "/__stub/supabase.js") {
      res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
      return res.end(fs.readFileSync(STUB_FILE));
    }
    if (PRIVATE.test(p) || p.includes("..")) { res.writeHead(404); return res.end("not found"); }
    // 깔끔한 주소로 넘겨주기 (Cloudflare의 기본 동작과 같게):
    //   /ko/about.html → /ko/about,  /teacher/index.html → /teacher/,  /ko/trainer/chords → /ko/trainer/chords/
    const query = new URL(req.url, "http://x").search;
    const go = to => { res.writeHead(307, { Location: to + query }); res.end(); };
    if (p.endsWith("/index.html")) return go(p.slice(0, -"index.html".length));
    if (p.endsWith(".html") && fs.existsSync(path.join(ROOT, p))) return go(p.slice(0, -".html".length));
    if (!p.endsWith("/") && fs.existsSync(path.join(ROOT, p, "index.html"))) return go(p + "/");
    if (p.endsWith("/")) p += "index.html";                       // /teacher/ → teacher/index.html
    let file = path.join(ROOT, p);
    if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html";   // /mypage → mypage.html
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      if (opt.stub && file.endsWith(".html")) data = String(data).replace('<script type="module"', STUB_TAGS + '<script type="module"');
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}

// npm run dev (또는 npm run dev:stub = --stub) 로 실행했을 때
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stub = process.argv.includes("--stub");
  const port = +(process.env.PORT || (stub ? 8769 : 8766)), host = process.env.HOST || "127.0.0.1";
  await build();
  // src/를 고치면 0.2초 뒤 다시 만들기 (여러 파일을 한꺼번에 저장해도 한 번만)
  let timer = null;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().then(() => console.log("다시 만듦", new Date().toLocaleTimeString()), e => console.error("빌드 실패:", e.message)), 200);
  });
  serve(port, host, { stub }).then(() => console.log(`http://${host === "0.0.0.0" ? "localhost" : host}:${port}${stub ? "  [가짜 Supabase — 관리자로 로그인된 상태]" : ""}  (끄려면 Ctrl+C)`));
}
