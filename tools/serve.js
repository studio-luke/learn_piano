// ===== 로컬 확인용 웹 서버 =====
// 사이트가 JS 모듈(<script type="module">)을 쓰기 때문에, index.html을 파일로 바로 열면(file://) 브라우저가 모듈을 막아요.
// 이 서버로 열어서 확인하세요:   npm run dev   →   http://localhost:8766
// (폰에서 같은 와이파이로 보려면: HOST=0.0.0.0 npm run dev 후 http://<이 컴퓨터 IP>:8766 — 공유가 끝나면 꺼 주세요)
//
// 실제 사이트(Cloudflare)처럼 저장소의 파일을 그대로 보내요. 다만 개인 문서·설정 파일은 보내지 않아요(아래 PRIVATE).
// 레이아웃 검사(tests/layout-audit.js)도 이 서버를 씁니다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon",
};
// 보내지 않는 것: 운영자 개인 문서, 설정, 테스트·도구, 숨김 파일
const PRIVATE = /^\/(docs|node_modules|tests|tools|supabase|\.[^/]*)(\/|$)|^\/(CLAUDE\.md|chordoven-spec\.md|package(-lock)?\.json|wrangler\.jsonc)$/;

export function serve(port = 8766, host = "127.0.0.1") {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (PRIVATE.test(p) || p.includes("..")) { res.writeHead(404); return res.end("not found"); }
    if (p.endsWith("/")) p += "index.html";                       // /teacher/ → teacher/index.html
    let file = path.join(ROOT, p);
    if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html";   // /mypage → mypage.html (Cloudflare와 같게)
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
