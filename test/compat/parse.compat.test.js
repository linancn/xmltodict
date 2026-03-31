"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parse } = require("../../src");
const { callPythonOracle } = require("../helpers/oracle");

const STATIC_CASES = [
  {
    name: "minimal",
    xmlInput: "<a/>",
    options: {},
  },
  {
    name: "minimal with force_cdata",
    xmlInput: "<a/>",
    options: { force_cdata: true },
  },
  {
    name: "simple",
    xmlInput: "<a>data</a>",
    options: {},
  },
  {
    name: "force_cdata true",
    xmlInput: "<a>data</a>",
    options: { force_cdata: true },
  },
  {
    name: "selective force_cdata tuple equivalent",
    xmlInput: "<a><b>data1</b><c>data2</c><d>data3</d></a>",
    options: { force_cdata: ["b", "d"] },
  },
  {
    name: "custom cdata key",
    xmlInput: "<a>data</a>",
    options: { force_cdata: true, cdata_key: "_CDATA_" },
  },
  {
    name: "list",
    xmlInput: "<a><b>1</b><b>2</b><b>3</b></a>",
    options: {},
  },
  {
    name: "attribute",
    xmlInput: '<a href="xyz"/>',
    options: {},
  },
  {
    name: "skip attributes",
    xmlInput: '<a href="xyz"/>',
    options: { xml_attribs: false },
  },
  {
    name: "custom attribute prefix",
    xmlInput: '<a href="xyz"/>',
    options: { attr_prefix: "!" },
  },
  {
    name: "attributes and cdata",
    xmlInput: '<a href="xyz">123</a>',
    options: {},
  },
  {
    name: "semi structured",
    xmlInput: "<a>abc<b/>def</a>",
    options: {},
  },
  {
    name: "semi structured with separator",
    xmlInput: "<a>abc<b/>def</a>",
    options: { cdata_separator: "\n" },
  },
  {
    name: "nested semi structured",
    xmlInput: "<a>abc<b>123<c/>456</b>def</a>",
    options: {},
  },
  {
    name: "skip whitespace",
    xmlInput: `
    <root>
      <emptya>           </emptya>
      <emptyb attr="attrvalue">
      </emptyb>
      <value>hello</value>
    </root>
    `,
    options: {},
  },
  {
    name: "keep whitespace",
    xmlInput: "<root> </root>",
    options: { strip_whitespace: false },
  },
  {
    name: "unicode",
    xmlInput: "<a>香</a>",
    options: {},
  },
  {
    name: "encoded utf8 bytes",
    xmlInput: Buffer.from("<a>香</a>", "utf8"),
    options: {},
  },
  {
    name: "namespace support",
    xmlInput: `
    <root xmlns="http://defaultns.com/"
          xmlns:a="http://a.com/"
          xmlns:b="http://b.com/"
          version="1.00">
      <x a:attr="val">1</x>
      <a:y>2</a:y>
      <b:z>3</b:z>
    </root>
    `,
    options: { process_namespaces: true },
  },
  {
    name: "namespace collapse",
    xmlInput: `
    <root xmlns="http://defaultns.com/"
          xmlns:a="http://a.com/"
          xmlns:b="http://b.com/"
          version="1.00">
      <x a:attr="val">1</x>
      <a:y>2</a:y>
      <b:z>3</b:z>
    </root>
    `,
    options: {
      process_namespaces: true,
      namespaces: {
        "http://defaultns.com/": "",
        "http://a.com/": "ns_a",
      },
    },
  },
  {
    name: "namespace ignore default mode",
    xmlInput: `
    <root xmlns="http://defaultns.com/"
          xmlns:a="http://a.com/"
          xmlns:b="http://b.com/"
          version="1.00">
      <x>1</x>
      <a:y>2</a:y>
      <b:z>3</b:z>
    </root>
    `,
    options: {},
  },
  {
    name: "force list basic",
    xmlInput: `
    <servers>
      <server>
        <name>server1</name>
        <os>os1</os>
      </server>
    </servers>
    `,
    options: { force_list: ["server"] },
  },
  {
    name: "disable entities false with internal entity expansion",
    xmlInput: `
    <!DOCTYPE xmlbomb [
      <!ENTITY a "1234567890" >
      <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">
      <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;">
    ]>
    <bomb>&c;</bomb>
    `,
    options: { disable_entities: false },
  },
  {
    name: "disable entities false with external entity",
    xmlInput: `
    <!DOCTYPE external [
      <!ENTITY ee SYSTEM "http://www.python.org/">
    ]>
    <root>&ee;</root>
    `,
    options: { disable_entities: false },
  },
  {
    name: "doctype without entities still allowed",
    xmlInput: `<?xml version='1.0' encoding='UTF-8'?>
    <!DOCTYPE data SYSTEM "diagram.dtd">
    <foo>bar</foo>`,
    options: { disable_entities: true },
  },
  {
    name: "comments preserved",
    xmlInput: `
    <a>
      <b>
        <!-- b comment -->
        <c>
            <!-- c comment -->
            1
        </c>
        <d>2</d>
      </b>
    </a>
    `,
    options: { process_comments: true },
  },
];

for (const { name, xmlInput, options } of STATIC_CASES) {
  test(`parse parity: ${name}`, () => {
    const actual = parse(xmlInput, options);
    const expected = callPythonOracle({
      op: "parse",
      xml_input: xmlInput,
      kwargs: options,
    });
    assert.deepEqual(actual, expected);
  });
}

test("parse parity: generator input", () => {
  const items = [...'<a x="y"><b>1</b><b>2</b><b>3</b></a>'];
  const actual = parse(items);
  const expected = callPythonOracle({
    op: "parse",
    xml_input: {
      __type: "generator",
      items,
    },
    kwargs: {},
  });
  assert.deepEqual(actual, expected);
});

test("parse parity: file-like input", () => {
  const xmlInput = "<a>data</a>";
  const actual = parse({
    read() {
      return Buffer.from(xmlInput, "ascii");
    },
  });
  const expected = callPythonOracle({
    op: "parse",
    xml_input: xmlInput,
    kwargs: {},
  });
  assert.deepEqual(actual, expected);
});

test("parse parity: disable_entities true rejects entity declarations", () => {
  const xmlInput = `
  <!DOCTYPE xmlbomb [
    <!ENTITY a "1234567890" >
    <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">
    <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;">
  ]>
  <bomb>&c;</bomb>
  `;

  assert.throws(
    () => parse(xmlInput, { disable_entities: true }),
    (error) => error && error.name === "ValueError" && error.message === "entities are disabled",
  );

  assert.throws(
    () =>
      callPythonOracle({
        op: "parse",
        xml_input: xmlInput,
        kwargs: { disable_entities: true },
      }),
    (error) => error && error.name === "ValueError" && error.message === "entities are disabled",
  );
});
