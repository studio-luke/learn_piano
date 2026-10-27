// Rebuilds index.html from src/ui.html + engine.js + i18n.js + config.js + account.js:  node build.js
const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/src/ui.html", "utf8");
const engine = fs.readFileSync(__dirname + "/src/engine.js", "utf8");
const i18n = fs.readFileSync(__dirname + "/src/i18n.js", "utf8");
const config = fs.readFileSync(__dirname + "/src/config.js", "utf8");
const account = fs.readFileSync(__dirname + "/src/account.js", "utf8");
const page = ui.replace("/*ENGINE*/", () => engine).replace("/*I18N*/", () => i18n)
  .replace("/*CONFIG*/", () => config).replace("/*ACCOUNT*/", () => account);
const cut = page.indexOf("</style>") + "</style>".length;
const head = page.slice(0, cut).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "");
const body = page.slice(cut);
const reset = `<style>
/* base reset (the artifact host added this before; needed when the file is served on its own) */
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
`;
const out = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="수업에서 배운 코드를 2옥타브 건반으로 복습하는 화성학 코드 트레이너. 3화음, 7화음, 텐션 코드, 7alt까지 랜덤 출제와 자리바꿈 허용 채점.">
${reset}${head}
</head>
<body>${body}
</body>
</html>
`;
fs.writeFileSync(__dirname + "/index.html", out);
console.log("index.html written");
