"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const xmltodict = require("../../src");
const { callPythonOracle } = require("../helpers/oracle");

test("exports the expected public API names", () => {
  assert.equal(typeof xmltodict.parse, "function");
  assert.equal(typeof xmltodict.unparse, "function");
  assert.equal(typeof xmltodict.ParsingInterrupted, "function");
});

test("python oracle is reachable", () => {
  const response = callPythonOracle({ op: "smoke" });
  assert.equal(response.available, true);
});

