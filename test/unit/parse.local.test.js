"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { ParsingInterrupted, parse } = require("../../src");

test("parse accepts file-like input with read()", () => {
  const xml = "<a>data</a>";
  const result = parse({
    read() {
      return Buffer.from(xml, "ascii");
    },
  });
  assert.deepEqual(result, { a: "data" });
});

test("parse streaming invokes item_callback with expected items", () => {
  const items = [];

  const result = parse('<a x="y"><b>1</b><b>2</b><b>3</b></a>', {
    item_depth: 2,
    item_callback(path, item) {
      items.push({
        item,
        path: path.map(([name, attrs]) => [name, attrs]),
      });
      return true;
    },
  });

  assert.equal(result, null);
  assert.deepEqual(items, [
    { path: [["a", { x: "y" }], ["b", null]], item: "1" },
    { path: [["a", { x: "y" }], ["b", null]], item: "2" },
    { path: [["a", { x: "y" }], ["b", null]], item: "3" },
  ]);
});

test("parse streaming interrupt raises ParsingInterrupted", () => {
  assert.throws(
    () =>
      parse("<a>x</a>", {
        item_depth: 1,
        item_callback() {
          return false;
        },
      }),
    (error) => error instanceof ParsingInterrupted,
  );
});

test("parse returns null in streaming mode", () => {
  const result = parse("<a><b>1</b><b>2</b></a>", {
    item_depth: 2,
    item_callback() {
      return true;
    },
  });
  assert.equal(result, null);
});

test("parse supports force_cdata callable", () => {
  const xml = "<a><b>data1</b><c>data2</c><d>data3</d></a>";
  const result = parse(xml, {
    force_cdata(path, key) {
      return key === "b" || key === "d";
    },
  });

  assert.deepEqual(result, {
    a: {
      b: { "#text": "data1" },
      c: "data2",
      d: { "#text": "data3" },
    },
  });
});

test("parse supports force_list callable", () => {
  const xml = `
  <config>
      <servers>
        <server>
          <name>server1</name>
          <os>os1</os>
        </server>
      </servers>
      <skip>
          <server></server>
      </skip>
  </config>
  `;

  const result = parse(xml, {
    force_list(path, key) {
      if (key !== "server") {
        return false;
      }
      return path.length > 0 && path[path.length - 1][0] === "servers";
    },
  });

  assert.deepEqual(result, {
    config: {
      servers: {
        server: [
          {
            name: "server1",
            os: "os1",
          },
        ],
      },
      skip: {
        server: null,
      },
    },
  });
});

test("parse supports postprocessor for element values and attributes", () => {
  const result = parse('<a b="1"><c>2</c><c>x</c></a>', {
    postprocessor(_path, key, value) {
      if (typeof value !== "string") {
        return [key, value];
      }
      if (!/^-?\d+$/.test(value)) {
        return [key, value];
      }
      return [`${key}:int`, Number.parseInt(value, 10)];
    },
  });

  assert.deepEqual(result, {
    a: {
      "@b:int": 1,
      "c:int": 2,
      c: "x",
    },
  });
});
