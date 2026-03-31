"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { unparse } = require("../../src");
const { callPythonOracle } = require("../helpers/oracle");

const HEADER_RE = /^[^\n]*\n/;

function stripHeader(xml) {
  return xml.replace(HEADER_RE, "");
}

function expectUnparseEquals(inputDict, options, expectedXml, withHeaderStrip = false) {
  const actual = unparse(inputDict, options);
  const actualNormalized = withHeaderStrip ? stripHeader(actual) : actual;
  assert.equal(actualNormalized, expectedXml);
}

function expectOracleParity(inputDict, options) {
  const actual = unparse(inputDict, options);
  const expected = callPythonOracle({
    op: "unparse",
    input_dict: inputDict,
    kwargs: options || {},
  });
  assert.equal(actual, expected);
}

const STRING_CASES = [
  {
    name: "multiple roots when full_document is false",
    inputDict: { a: 1, b: 2 },
    options: { full_document: false },
    expectedXml: "<a>1</a><b>2</b>",
  },
  {
    name: "multiple roots from list when full_document is false",
    inputDict: { a: [1, 2] },
    options: { full_document: false },
    expectedXml: "<a>1</a><a>2</a>",
  },
  {
    name: "list expand_iter",
    inputDict: { a: { b: [["1", "2"], ["3"]] } },
    options: { expand_iter: "item" },
    expectedXml:
      '<?xml version="1.0" encoding="utf-8"?>\n<a><b><item>1</item><item>2</item></b><b><item>3</item></b></a>',
  },
  {
    name: "preprocessor skip key",
    inputDict: { a: { b: 1, c: 2 } },
    options: {
      preprocessor(key, value) {
        if (key === "b") {
          return null;
        }
        return [key, value];
      },
    },
    expectedXml: "<a><c>2</c></a>",
    withHeaderStrip: true,
    skipOracle: true,
  },
  {
    name: "pretty print with custom indent",
    inputDict: {
      a: {
        b: [{ c: [1, 2] }, 3],
        x: "y",
      },
    },
    options: { pretty: true, newl: "\n", indent: "...." },
    expectedXml:
      '<?xml version="1.0" encoding="utf-8"?>\n<a>\n....<b>\n........<c>1</c>\n........<c>2</c>\n....</b>\n....<b>3</b>\n....<x>y</x>\n</a>',
  },
  {
    name: "pretty print with numeric indent",
    inputDict: {
      a: {
        b: [{ c: [1, 2] }, 3],
        x: "y",
      },
    },
    options: { pretty: true, newl: "\n", indent: 2 },
    expectedXml:
      '<?xml version="1.0" encoding="utf-8"?>\n<a>\n  <b>\n    <c>1</c>\n    <c>2</c>\n  </b>\n  <b>3</b>\n  <x>y</x>\n</a>',
  },
  {
    name: "element comment",
    inputDict: { a: { "#comment": "note", b: "1" } },
    options: { full_document: true },
    expectedXml: "<a><!--note--><b>1</b></a>",
    withHeaderStrip: true,
  },
  {
    name: "multiple element comments",
    inputDict: { a: { "#comment": ["n1", "n2"], b: "1" } },
    options: { full_document: true },
    expectedXml: "<a><!--n1--><!--n2--><b>1</b></a>",
    withHeaderStrip: true,
  },
  {
    name: "top-level comments",
    inputDict: { "#comment": ["t1", "t2"], a: "1" },
    options: { full_document: true },
    expectedXml: "<!--t1--><!--t2--><a>1</a>",
    withHeaderStrip: true,
  },
  {
    name: "bytes comment with encoding",
    inputDict: { "#comment": Buffer.from("caf\xe9", "latin1"), a: "1" },
    options: { full_document: true, encoding: "iso-8859-1" },
    expectedXml: "<!--caf\xe9--><a>1</a>",
    withHeaderStrip: true,
  },
  {
    name: "invalid bytes comment replaced by default",
    inputDict: { "#comment": Buffer.from([0xff]), a: "1" },
    options: { full_document: true, encoding: "utf-8" },
    expectedXml: "<!--\ufffd--><a>1</a>",
    withHeaderStrip: true,
  },
  {
    name: "short empty element",
    inputDict: { a: null },
    options: { short_empty_elements: true },
    expectedXml: "<a/>",
    withHeaderStrip: true,
  },
  {
    name: "namespace support",
    inputDict: {
      "http://defaultns.com/:root": {
        "@xmlns": {
          "": "http://defaultns.com/",
          a: "http://a.com/",
          b: "http://b.com/",
        },
        "http://defaultns.com/:x": {
          "@http://a.com/:attr": "val",
          "#text": "1",
        },
        "http://a.com/:y": "2",
        "http://b.com/:z": "3",
      },
    },
    options: {
      namespaces: {
        "http://defaultns.com/": "",
        "http://a.com/": "a",
        "http://b.com/": "b",
      },
    },
    expectedXml:
      '<?xml version="1.0" encoding="utf-8"?>\n<root xmlns="http://defaultns.com/" xmlns:a="http://a.com/" xmlns:b="http://b.com/"><x a:attr="val">1</x><a:y>2</a:y><b:z>3</b:z></root>',
  },
  {
    name: "boolean unparse",
    inputDict: { x: true },
    options: {},
    expectedXml: '<?xml version="1.0" encoding="utf-8"?>\n<x>true</x>',
  },
  {
    name: "boolean attribute unparse",
    inputDict: { x: { "@attr": false } },
    options: {},
    expectedXml: '<?xml version="1.0" encoding="utf-8"?>\n<x attr="false"></x>',
  },
  {
    name: "bytes in attributes and cdata use output encoding",
    inputDict: { x: { "@attr": Buffer.from("caf\xe9", "latin1"), "#text": Buffer.from("caf\xe9", "latin1") } },
    options: { full_document: false, encoding: "iso-8859-1" },
    expectedXml: "<x attr=\"caf\xe9\">caf\xe9</x>",
  },
  {
    name: "invalid bytes in text replaced by default",
    inputDict: { x: Buffer.from([0xff]) },
    options: { full_document: false, encoding: "utf-8" },
    expectedXml: "<x>\ufffd</x>",
  },
  {
    name: "pretty and short_empty_elements consistency compact result",
    inputDict: { Foos: { Foo: [] } },
    options: { pretty: false, short_empty_elements: true, full_document: false },
    expectedXml: "<Foos/>",
  },
  {
    name: "empty list filtering with short_empty_elements false",
    inputDict: { Foos: { Foo: [] } },
    options: { pretty: false, short_empty_elements: false, full_document: false },
    expectedXml: "<Foos></Foos>",
  },
  {
    name: "non-empty lists are not filtered",
    inputDict: { Foos: { Foo: ["item1", "item2"] } },
    options: { pretty: false, short_empty_elements: true, full_document: false },
    expectedXml: "<Foos><Foo>item1</Foo><Foo>item2</Foo></Foos>",
  },
  {
    name: "none attribute serializes as empty string",
    inputDict: { x: { "@pro": null } },
    options: { full_document: false },
    expectedXml: '<x pro=""></x>',
  },
  {
    name: "none text and attributes with short empty elements",
    inputDict: { x: { "#text": null, "@pro": null }, y: null },
    options: { short_empty_elements: true, full_document: false },
    expectedXml: '<x pro=""/><y/>',
  },
];

for (const testCase of STRING_CASES) {
  test(`unparse string parity: ${testCase.name}`, () => {
    expectUnparseEquals(
      testCase.inputDict,
      testCase.options,
      testCase.expectedXml,
      Boolean(testCase.withHeaderStrip),
    );

    if (!testCase.skipOracle) {
      expectOracleParity(testCase.inputDict, testCase.options);
    }
  });
}

test("unparse: no root with full_document true raises ValueError", () => {
  assert.throws(() => unparse({}), (error) => error && error.name === "ValueError");
});

test("unparse: multiple roots with full_document true raises ValueError", () => {
  assert.throws(() => unparse({ a: "1", b: "2" }), (error) => error && error.name === "ValueError");
  assert.throws(() => unparse({ a: ["1", "2", "3"] }), (error) => error && error.name === "ValueError");
});

test("unparse: invalid bytes comment with strict raises UnicodeDecodeError (oracle parity)", () => {
  const inputDict = { "#comment": Buffer.from([0xff]), a: "1" };
  const options = { full_document: true, encoding: "utf-8", bytes_errors: "strict" };

  let oracleError;
  try {
    callPythonOracle({ op: "unparse", input_dict: inputDict, kwargs: options });
  } catch (error) {
    oracleError = error;
  }
  assert.ok(oracleError);

  assert.throws(
    () => unparse(inputDict, options),
    (error) => error && error.name === oracleError.name && error.message === oracleError.message,
  );
});

test("unparse: invalid bytes_errors handler raises ValueError", () => {
  assert.throws(
    () => unparse({ x: { "@attr": Buffer.from([0xff]) } }, { full_document: false, bytes_errors: "nope" }),
    (error) => error && error.name === "ValueError" && error.message === "Invalid bytes_errors handler: nope",
  );
});

test("unparse: invalid comment content is rejected", () => {
  assert.throws(
    () => unparse({ "#comment": "bad--comment", a: "1" }, { full_document: true }),
    (error) => error && error.name === "ValueError" && /cannot contain '--'/.test(error.message),
  );
  assert.throws(
    () => unparse({ "#comment": "trailing-", a: "1" }, { full_document: true }),
    (error) => error && error.name === "ValueError" && /cannot end with '-'/.test(error.message),
  );
});

test("unparse: invalid names are rejected", () => {
  assert.throws(
    () => unparse({ "m><tag>content</tag": "unsafe" }, { full_document: false }),
    (error) => error && error.name === "ValueError",
  );
  assert.throws(
    () => unparse({ a: { "@m><tag>content</tag": "unsafe", "#text": "x" } }, { full_document: false }),
    (error) => error && error.name === "ValueError",
  );
  assert.throws(
    () => unparse({ "?pi": "data" }, { full_document: false }),
    (error) => error && error.name === "ValueError",
  );
  assert.throws(
    () => unparse({ "!decl": "data" }, { full_document: false }),
    (error) => error && error.name === "ValueError",
  );
  assert.throws(
    () => unparse({ "bad/name": "x" }, { full_document: false }),
    (error) => error && error.name === "ValueError",
  );
});

