"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const CLI_PATH = path.join(__dirname, "../../bin/xmltodict.js");

function runCli(args, input) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    input,
  });
}

test("CLI parse mode outputs JSON", () => {
  const result = runCli([], "<a><b>1</b><b>2</b></a>");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim(), '{"a":{"b":["1","2"]}}');
});

test("CLI parse mode supports --pretty", () => {
  const result = runCli(["--pretty"], "<a>1</a>");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /{\n  "a": "1"\n}/);
});

test("CLI stream mode emits one NDJSON line per item", () => {
  const result = runCli(["stream", "2"], '<a x="y"><b>1</b><b>2</b></a>');
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), {
    item: "1",
    path: [["a", { x: "y" }], ["b", null]],
  });
  assert.deepEqual(JSON.parse(lines[1]), {
    item: "2",
    path: [["a", { x: "y" }], ["b", null]],
  });
});

test("CLI numeric shorthand enters stream mode", () => {
  const result = runCli(["2"], "<a><b>1</b></a>");
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    item: "1",
    path: [["a", null], ["b", null]],
  });
});

test("CLI unparse mode outputs XML", () => {
  const result = runCli(["unparse"], JSON.stringify({ a: { "@x": "1", "#text": "y" } }));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, '<?xml version="1.0" encoding="utf-8"?>\n<a x="1">y</a>\n');
});

