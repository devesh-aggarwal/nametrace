"use strict";

// Minimal DOM shim so src/detect.js (a browser content script) can run
// under plain Node for testing, without pulling in a browser or test
// framework dependency.
const assert = require("assert");
const path = require("path");

global.window = global;
global.location = { hostname: "" };
global.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

class FakeTextNode {
  constructor(text) {
    this.nodeValue = text;
    this.parentElement = null;
  }
}

class FakeTreeWalker {
  constructor(nodes, acceptNode) {
    this.nodes = nodes.filter(
      (n) => acceptNode(n) === global.NodeFilter.FILTER_ACCEPT
    );
    this.i = -1;
  }
  nextNode() {
    this.i++;
    return this.i < this.nodes.length ? this.nodes[this.i] : null;
  }
}

global.document = {
  createTreeWalker(root, _showType, opts) {
    return new FakeTreeWalker(root.textNodes, opts.acceptNode);
  },
};

require(path.join(__dirname, "../src/constants.js"));
require(path.join(__dirname, "../src/site.js"));
require(path.join(__dirname, "../src/detect.js"));

function harvest(paragraphs) {
  const root = { textNodes: paragraphs.map((p) => new FakeTextNode(p)) };
  return global.NT.detect.harvestNgrams(root).counts;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures++;
    console.error(`not ok - ${name}`);
    console.error(err);
  }
}

test("middle initial: 'Samuel L. Jackson' forms a single 3-gram", () => {
  const counts = harvest([
    "Samuel L. Jackson starred in the film.",
    "Later, Samuel L. Jackson returned for a sequel.",
    "Critics loved Samuel L. Jackson in the role.",
  ]);
  assert.strictEqual(counts.get("Samuel L Jackson"), 3);
});

test("middle initial: 'George W. Bush' forms a single 3-gram", () => {
  const counts = harvest([
    "George W. Bush spoke at the event.",
    "George W. Bush later signed the bill.",
    "Reporters quoted George W. Bush twice.",
  ]);
  assert.strictEqual(counts.get("George W Bush"), 3);
});

test("sentence-final capitalized word still flushes the run", () => {
  const counts = harvest([
    "He met Bush. Bush later denied the claim, and Bush went on vacation.",
  ]);
  assert.strictEqual(counts.get("Bush"), 3);
  assert.strictEqual(counts.has("Bush Bush"), false);
});

if (failures > 0) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log("all tests passed");
}
