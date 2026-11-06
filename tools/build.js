// ===== 사이트 만들기 (빌드):  src/ → dist/ =====
// 실행: npm run build   (npm run dev·npm run audit는 알아서 먼저 실행해요)
//
// 왜 필요한가: 검색엔진(구글 등)이 언어마다 따로 페이지를 찾을 수 있게, 글 페이지를 언어별 주소로 만들어 둬요.
//   src/about.html  →  dist/ko/about.html, dist/en/about.html, dist/ja/about.html, dist/zh/about.html
// 각 페이지에는 그 언어 문구(i18n/*.js)를 HTML에 직접 채워 넣고, 제목·검색 설명, 다른 언어판 주소(hreflang)를 넣어요.
// 원래 주소(/, /about, /trainer/chords/)에는 "언어 고르는 입구"를 둬요: 저장된 언어 → 브라우저 언어 → 영어 순으로 골라 넘겨줌.
// (예전에 공유한 /trainer/chords/ 링크도 이 입구 덕분에 계속 동작해요)
//
// 언어별로 만들지 않는 페이지(마이페이지·선생님 페이지·약관)는 src/ 그대로 복사해요. 이 페이지들은 지금처럼 JS가 문구를 바꿔요.
//
// 직접 고치는 건 항상 src/ 쪽. dist/는 매번 지우고 새로 만들어지므로 고치지 말 것 (git에도 안 올라감).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.join(HERE, "..", "src");
export const DIST = path.join(HERE, "..", "dist");

// 사이트 주소 (검색엔진에 알려주는 정식 주소). 도메인을 바꾸면 여기만 고치면 돼요.
export const SITE = "https://chordoven.com";

export const LANGS = ["ko", "en", "ja", "zh"];
// <html lang>과 hreflang에 쓰는 이름 (중국어는 간체라고 밝힘)
const HTML_LANG = { ko: "ko", en: "en", ja: "ja", zh: "zh-Hans" };

/**
 * 언어별로 만드는 페이지 목록.
 *   src    원본 파일 (src/ 기준)
 *   route  주소 (사이트 맨 위 기준, 언어 표시 뒤에 붙음 — "about" → /ko/about). sitemap.js의 LOCALIZED와 같게.
 *   title / desc  탭 제목·검색 설명 문구 키 (i18n/*.js)
 * 새 글 페이지(웹북 등)를 만들면 여기에 한 줄 추가하고, sitemap.js의 LOCALIZED에도 주소를 넣으세요.
 */
export const PAGES = [
  { src: "index.html", route: "", title: "seoHomeTitle", desc: "seoHomeDesc" },
  { src: "trainer/chords/index.html", route: "trainer/chords/", title: "seoTrainerTitle", desc: "seoTrainerDesc" },
  { src: "about.html", route: "about", title: "seoAboutTitle", desc: "seoAboutDesc" },
];

// 주소(route) → 파일 위치: "" → index.html, "trainer/chords/" → trainer/chords/index.html, "about" → about.html
const fileFor = route => (route === "" || route.endsWith("/") ? route + "index.html" : route + ".html");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 문구 파일 4개 읽기 (사이트의 JS 파일을 그대로 import) */
async function loadStrings() {
  const out = {};
  for (const l of LANGS) out[l] = (await import(pathToFileURL(path.join(SRC, "assets/js/i18n", l + ".js")).href + "?t=" + Date.now())).default;
  return out;
}

/** 다른 언어판 주소 목록 (<head>에 넣음). x-default = 언어 고르는 입구 */
function alternates(route) {
  return LANGS.map(l => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${SITE}/${l}/${route}">`).join("\n")
    + `\n<link rel="alternate" hreflang="x-default" href="${SITE}/${route}">`;
}

/**
 * 원본 HTML 하나를 한 언어로 채우기.
 * data-i18n="키" 요소의 내용, data-i18n-aria / data-i18n-title 속성, <html lang>, <title>, 검색 설명, 주소 정보를 바꿔요.
 * (화면에 뜬 뒤에도 JS의 applyI18n이 같은 문구를 다시 넣으므로, 여기서 못 채운 곳이 있어도 화면은 맞게 나와요)
 */
export function localize(html, page, l, S) {
  const t = k => S[l][k] ?? S.en[k] ?? S.ko[k] ?? k;
  // data-i18n이 붙은 요소의 내용. 이 요소들 안에는 같은 태그가 겹쳐 들어가지 않는다는 전제 (지금 페이지들은 모두 그렇고, 테스트가 확인)
  html = html.replace(/(<(\w+)\b[^>]*?\sdata-i18n="(\w+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (_, open, tag, key, inner, close) => open + t(key) + close);
  html = html.replace(/(<[^>]*?\sdata-i18n-(aria|title)="(\w+)"[^>]*>)/g, (tagText, _o, kind, key) => {
    const attr = kind === "aria" ? "aria-label" : "title";
    const value = esc(t(key).replace(/<[^>]+>/g, ""));
    return new RegExp(`\\s${attr}="[^"]*"`).test(tagText)
      ? tagText.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), `$1${value}$2`)
      : tagText.replace(/\s*\/?>$/, m => ` ${attr}="${value}"${m}`);
  });
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${HTML_LANG[l]}" data-page-lang="${l}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t(page.title))}</title>`);
  const head = [
    `<meta name="description" content="${esc(t(page.desc))}">`,
    `<link rel="canonical" href="${SITE}/${l}/${page.route}">`,
    alternates(page.route),
  ].join("\n");
  html = html.replace(/<meta name="description"[^>]*>\n?/, "");
  return html.replace(/<\/title>\n?/, m => m + head + "\n");
}

/**
 * 언어 고르는 입구 페이지 (/, /about, /trainer/chords/ 같은 언어 표시 없는 주소).
 * 저장된 언어 → 브라우저 언어 → 영어 순으로 골라 /ko/… 같은 주소로 바로 넘겨요. ?review=1 같은 뒷부분도 그대로 넘김.
 * JS가 꺼진 경우(검색봇 일부)를 위해 언어별 링크도 보여줘요.
 * 언어 고르는 규칙은 assets/js/i18n/index.js의 detect()와 같게 유지할 것.
 */
function entryPage(route, S) {
  const links = LANGS.map(l => `<a href="/${l}/${route}" hreflang="${HTML_LANG[l]}" lang="${HTML_LANG[l]}">${esc(S[l].langName)}</a>`).join("\n    ");
  return `<!doctype html>
<!-- 자동 생성 파일 (tools/build.js) — 언어 고르는 입구. 직접 고치지 마세요. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChordOven</title>
${alternates(route)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>
(function () {
  var L = ${JSON.stringify(LANGS)}, l = null;
  try { l = localStorage.getItem("chordoven.lang") || localStorage.getItem("chordlab.lang"); } catch (e) {}
  if (L.indexOf(l) < 0) {
    l = "en";
    var p = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < p.length; i++) { var c = String(p[i]).toLowerCase().slice(0, 2); if (L.indexOf(c) >= 0) { l = c; break; } }
  }
  location.replace("/" + l + "/${route}" + location.search + location.hash);
})();
</script>
<style>body{font-family:system-ui,sans-serif;background:#F5ECDD;color:#3A2A20;display:grid;place-items:center;min-height:100vh;margin:0}nav{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}a{color:#B5532C}</style>
</head>
<body>
  <nav aria-label="Language">
    ${links}
  </nav>
</body>
</html>
`;
}

/** 검색엔진용 페이지 목록 (sitemap.xml) */
function sitemapXml() {
  const urls = PAGES.flatMap(p => LANGS.map(l => `  <url><loc>${SITE}/${l}/${p.route}</loc></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** src/ → out 폴더로 사이트 만들기 */
export async function build(out = DIST) {
  const S = await loadStrings();
  fs.rmSync(out, { recursive: true, force: true });
  // 1) 모든 파일 복사 (숨김 파일 제외). 언어별 페이지의 원본 자리는 아래에서 입구 페이지로 덮어씀
  fs.cpSync(SRC, out, { recursive: true, filter: f => !path.basename(f).startsWith(".") });
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(SRC, page.src), "utf8");
    // 2) 언어별 페이지
    for (const l of LANGS) {
      const dest = path.join(out, l, fileFor(page.route));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, localize(html, page, l, S));
    }
    // 3) 원래 주소 = 언어 고르는 입구
    fs.writeFileSync(path.join(out, fileFor(page.route)), entryPage(page.route, S));
  }
  fs.writeFileSync(path.join(out, "sitemap.xml"), sitemapXml());
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  return out;
}

// npm run build 로 실행했을 때
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  await build();
  console.log(`dist/ 만들기 완료 (${Date.now() - t0}ms)`);
}
