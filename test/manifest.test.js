"use strict";

// Validates the content_scripts match patterns in manifest.json against
// sample URLs, since Chrome's own pattern matching can't be exercised
// without loading the unpacked extension in a real browser.
const assert = require("assert");
const path = require("path");

const manifest = require(path.join(__dirname, "../manifest.json"));

// Minimal implementation of Chrome's match pattern spec, restricted to the
// pattern shapes used in this manifest (scheme "*", host "*" or "*.domain",
// path "/*").
function patternToRegex(pattern) {
  const m = /^(\*|https?):\/\/(\*|\*\.[^/*]+)\/(.*)$/.exec(pattern);
  if (!m) throw new Error(`unsupported match pattern: ${pattern}`);
  const [, scheme, host, path_] = m;
  const schemeRe = scheme === "*" ? "https?" : scheme;
  const hostRe =
    host === "*" ? "[^/]+" : "(?:[^./]+\\.)*" + host.slice(2).replace(/\./g, "\\.");
  const pathRe = path_.replace(/\*/g, ".*");
  return new RegExp(`^${schemeRe}://${hostRe}/${pathRe}$`);
}

function isActive(url) {
  const { matches, exclude_matches: excludes = [] } = manifest.content_scripts[0];
  const matched = matches.some((p) => patternToRegex(p).test(url));
  if (!matched) return false;
  const excluded = excludes.some((p) => patternToRegex(p).test(url));
  return !excluded;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    failures++;
    console.error(`not ok - ${name}`);
    console.error(`    ${e.message}`);
  }
}

test("known non-article domains are excluded", () => {
  for (const url of [
    "https://www.google.com/search?q=x",
    "https://github.com/some/repo",
    "https://twitter.com/someone",
    "https://x.com/someone",
    "https://www.facebook.com/",
    "https://www.instagram.com/",
    "https://www.youtube.com/watch?v=1",
    "https://www.reddit.com/r/test",
    "https://www.linkedin.com/in/x",
    "https://www.amazon.com/dp/1",
  ]) {
    assert.strictEqual(isActive(url), false, `${url} should be excluded`);
  }
});

test("known article sources match explicitly", () => {
  for (const url of [
    "https://en.wikipedia.org/wiki/Example",
    "https://medium.com/@user/post",
    "https://example.substack.com/p/post",
    "https://www.nytimes.com/2026/01/01/us/example.html",
    "https://www.bbc.com/news/example",
    "https://www.theguardian.com/world/example",
  ]) {
    assert.strictEqual(isActive(url), true, `${url} should be active`);
  }
});

test("arbitrary blogs still match via the generic fallback", () => {
  assert.strictEqual(isActive("https://someones-personal-blog.example/post"), true);
});

test("non-http(s) schemes never match", () => {
  for (const url of [
    "file:///tmp/index.html",
    "chrome-extension://abcdefg/page.html",
    "ftp://example.com/file",
  ]) {
    assert.strictEqual(isActive(url), false, `${url} should not match`);
  }
});

if (failures > 0) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log("all tests passed");
}
