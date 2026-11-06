// 빌드(tools/build.js) 검사: 언어별 페이지·입구 페이지·검색엔진용 파일이 제대로 만들어지는지.  실행: npm test
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build, localize, PAGES, LANGS, SITE, SRC } from "../tools/build.js";
import { LOCALIZED } from "../src/assets/js/common/sitemap.js";
import ko from "../src/assets/js/i18n/ko.js";
import en from "../src/assets/js/i18n/en.js";

// 임시 폴더에 한 번 만들어 두고 여러 검사에서 씀
const out = await build(fs.mkdtempSync(path.join(os.tmpdir(), "chordoven-build-")));
const read = p => fs.readFileSync(path.join(out, p), "utf8");

test("build: every localized page exists in every language, with its own text", () => {
  for (const l of LANGS) {
    const about = read(`${l}/about.html`);
    assert.match(about, new RegExp(`<html lang="${l === "zh" ? "zh-Hans" : l}" data-page-lang="${l}"`));
    assert.ok(fs.existsSync(path.join(out, l, "index.html")), `${l}/index.html`);
    assert.ok(fs.existsSync(path.join(out, l, "trainer/chords/index.html")), `${l}/trainer/chords/`);
  }
  assert.ok(read("ko/about.html").includes(ko.aboutName));
  assert.ok(read("en/about.html").includes(en.aboutName));
  assert.ok(!read("en/about.html").includes(ko.aboutName));
  assert.ok(read("en/trainer/chords/index.html").includes(`<title>${en.seoTrainerTitle}</title>`));
});

test("build: canonical and hreflang point at every language and the entry page", () => {
  const html = read("ja/trainer/chords/index.html");
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}/ja/trainer/chords/">`));
  for (const l of LANGS) assert.ok(html.includes(`href="${SITE}/${l}/trainer/chords/"`), l);
  assert.ok(html.includes(`hreflang="x-default" href="${SITE}/trainer/chords/"`));
  assert.strictEqual((html.match(/<meta name="description"/g) || []).length, 1);   // 원본 설명은 빠지고 언어별 설명 하나만
});

test("build: old addresses become language entry pages (old shared links keep working)", () => {
  for (const f of ["index.html", "about.html", "trainer/chords/index.html"]) {
    const html = read(f);
    assert.match(html, /location\.replace\("\/" \+ l \+ "\//, f);
    assert.ok(!html.includes("data-page-lang"), f);
  }
  assert.ok(read("trainer/chords/index.html").includes('"/trainer/chords/" + location.search'));   // ?review=1도 그대로 넘김
});

test("build: pages that are not per language are copied as they are", () => {
  for (const f of ["mypage.html", "teacher/index.html", "teacher/student.html", "terms.html", "privacy.html", "assets/js/config.js", "favicon.svg"])
    assert.strictEqual(read(f), fs.readFileSync(path.join(SRC, f), "utf8"), f);
});

test("build: sitemap.xml lists every localized page, robots.txt points to it", () => {
  const xml = read("sitemap.xml");
  assert.strictEqual((xml.match(/<loc>/g) || []).length, PAGES.length * LANGS.length);
  assert.ok(read("robots.txt").includes(`Sitemap: ${SITE}/sitemap.xml`));
});

test("build: the localized page list matches the menu's (sitemap.js LOCALIZED)", () => {
  assert.deepStrictEqual(PAGES.map(p => p.route).sort(), [...LOCALIZED].sort());
});

test("build: every data-i18n element in the source pages gets filled (no nested same tag)", () => {
  for (const page of PAGES) {
    const src = fs.readFileSync(path.join(SRC, page.src), "utf8");
    const html = localize(src, page, "en", { ko, en, ja: en, zh: en });
    for (const [, key] of src.matchAll(/\sdata-i18n="(\w+)"/g)) {
      const filled = new RegExp(`data-i18n="${key}"[^>]*>${en[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`);
      assert.match(html, filled, `${page.src}: ${key}`);
    }
  }
});
