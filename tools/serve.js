// ===== 로컬 확인용 웹 서버 =====
// 사이트가 JS 모듈(<script type="module">)을 쓰기 때문에, index.html을 파일로 바로 열면(file://) 브라우저가 모듈을 막아요.
// 이 서버로 열어서 확인하세요:   npm run dev   →   http://localhost:8766
// (폰에서 같은 와이파이로 보려면: HOST=0.0.0.0 npm run dev 후 http://<이 컴퓨터 IP>:8766 — 공유가 끝나면 꺼 주세요)
//
// 실제 사이트(Cloudflare)처럼 public/ 폴더의 파일을 그대로 보내요 (public/ 밖의 개발용 파일은 보내지 않음).
// 레이아웃 검사(tests/layout-audit.js)도 이 서버를 씁니다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");   // 사이트 = public/
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon",
};
// 숨김 파일(.DS_Store 등)은 보내지 않음
const PRIVATE = /\/\./;

export function serve(port = 8766, host = "127.0.0.1") {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (PRIVATE.test(p) || p.includes("..")) { res.writeHead(404); return res.end("not found"); }
    // 깔끔한 주소로 넘겨주기 (Cloudflare의 기본 동작과 같게):
    //   /about.html → /about,  /teacher/index.html → /teacher/,  /trainer/chords → /trainer/chords/
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
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}

// npm run dev 로 실행했을 때
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT || 8766), host = process.env.HOST || "127.0.0.1";
  serve(port, host).then(() => console.log(`http://${host === "0.0.0.0" ? "localhost" : host}:${port}  (끄려면 Ctrl+C)`));
}
