# xmltodict

## English

`xmltodict` for Node.js is a compatibility port of the Python package [`xmltodict`](https://github.com/linancn/xmltodict).

Its goal is straightforward:

- keep the same core public API names as the Python package
- keep the same `parse()` / `unparse()` behavior as closely as possible
- let Python `xmltodict` users move to Node.js with minimal mental overhead

It is a bidirectional package:

- XML -> JSON-style JavaScript object via `parse()`
- JSON-style JavaScript object -> XML via `unparse()`

The current Node package keeps these Python-facing names unchanged:

- `parse()`
- `unparse()`
- `ParsingInterrupted`

It also keeps the Python option names for the core methods, including options such as `attr_prefix`, `cdata_key`, `force_list`, `force_cdata`, `process_namespaces`, `process_comments`, `disable_entities`, `pretty`, `short_empty_elements`, `expand_iter`, and `bytes_errors`.

### Compatibility

This package is intended to be behavior-compatible with the corresponding Python package, not just “similar in spirit”.

- The compatibility target is the pinned upstream Python implementation vendored in `vendor/upstream`.
- The Node implementation is verified with exact-output tests and Python oracle differential tests.
- The focus is on API and runtime behavior compatibility for `parse()` and `unparse()`.

One deliberate difference remains in the CLI layer:

- Python `xmltodict.py` streams `marshal` records.
- Node `xmltodict` streams JSON / NDJSON, which is more natural for Node.js tooling.

### Install

```sh
npm install xmltodict
```

### Usage

```js
const xmltodict = require("xmltodict");

const doc = xmltodict.parse(`
  <mydocument has="an attribute">
    <and>
      <many>elements</many>
      <many>more elements</many>
    </and>
    <plus a="complex">
      element as well
    </plus>
  </mydocument>
`);

console.log(JSON.stringify(doc, null, 2));
```

```js
const { unparse } = require("xmltodict");

const xml = unparse(
  {
    response: {
      status: "good",
      last_updated: "2014-02-16T23:10:12Z",
    },
  },
  { pretty: true },
);

console.log(xml);
```

### CLI

```sh
xmltodict < input.xml
xmltodict parse < input.xml
xmltodict stream 2 < input.xml
cat input.json | xmltodict unparse
```

CLI modes:

- default / `parse`: read XML from `stdin`, write JSON to `stdout`
- `stream <depth>`: emit NDJSON records as `{"path": [...], "item": ...}`
- `unparse`: read JSON from `stdin`, write XML to `stdout`

Useful flags:

- `--pretty`
- `--compact`

### Development

```sh
npm install
npm run sync:upstream
npm test
npm run pack:check
```

Repository-only development tooling can also run external real-world sample verification against a Python oracle. That verification path is intentionally excluded from the published npm tarball.

### Acknowledgements

This package is built on top of the design and behavior of the Python `xmltodict` project.

Thanks to:

- Martin Blech, the original author of `xmltodict`

This Node.js package exists because that Python project is useful, stable, and worth carrying over to the Node.js ecosystem with compatible behavior.

---

## 中文

Node.js 版本的 `xmltodict` 是对 Python 包 [`xmltodict`](https://github.com/linancn/xmltodict) 的兼容性移植。

目标很明确：

- 保持与 Python 包一致的核心公开 API 名称
- 尽量保持 `parse()` / `unparse()` 的行为一致
- 让已经在使用 Python `xmltodict` 的用户可以低成本切换到 Node.js

它是一个双向转换包：

- 通过 `parse()` 实现 XML -> JSON 风格的 JavaScript 对象
- 通过 `unparse()` 实现 JSON 风格的 JavaScript 对象 -> XML

当前这个 Node 包保留了和 Python 一样的核心名称：

- `parse()`
- `unparse()`
- `ParsingInterrupted`

核心参数名也保持与 Python 包一致，包括 `attr_prefix`、`cdata_key`、`force_list`、`force_cdata`、`process_namespaces`、`process_comments`、`disable_entities`、`pretty`、`short_empty_elements`、`expand_iter`、`bytes_errors` 等。

### 兼容性说明

这个包追求的是“与对应 Python 包行为兼容”，而不只是“理念相似”。

- 兼容目标是仓库中 `vendor/upstream` 里固定版本的 Python `xmltodict` 实现。
- Node 实现通过了精确输出测试，以及与 Python 参考实现的对拍测试。
- 当前重点是 `parse()` 和 `unparse()` 这两个核心方法的 API 与行为一致性。

CLI 层面保留了一个有意的差异：

- Python `xmltodict.py` 输出的是 `marshal` 二进制记录
- Node 版本的 `xmltodict` 输出的是 JSON / NDJSON，这更适合 Node.js 生态

### 安装

```sh
npm install xmltodict
```

### 使用示例

```js
const xmltodict = require("xmltodict");

const doc = xmltodict.parse(`
  <mydocument has="an attribute">
    <and>
      <many>elements</many>
      <many>more elements</many>
    </and>
    <plus a="complex">
      element as well
    </plus>
  </mydocument>
`);

console.log(JSON.stringify(doc, null, 2));
```

```js
const { unparse } = require("xmltodict");

const xml = unparse(
  {
    response: {
      status: "good",
      last_updated: "2014-02-16T23:10:12Z",
    },
  },
  { pretty: true },
);

console.log(xml);
```

### CLI

```sh
xmltodict < input.xml
xmltodict parse < input.xml
xmltodict stream 2 < input.xml
cat input.json | xmltodict unparse
```

命令行模式：

- 默认 / `parse`：从 `stdin` 读取 XML，向 `stdout` 输出 JSON
- `stream <depth>`：输出 NDJSON，每条记录结构为 `{"path": [...], "item": ...}`
- `unparse`：从 `stdin` 读取 JSON，向 `stdout` 输出 XML

常用参数：

- `--pretty`
- `--compact`

### 开发

```sh
npm install
npm run sync:upstream
npm test
npm run pack:check
```

仓库内还提供了额外的真实世界样本对拍工具，用来和 Python 参考实现做外部数据校验；这部分能力明确只用于开发环境，不会进入最终发布的 npm tarball。

### 致谢

这个包的设计和行为直接建立在 Python `xmltodict` 项目之上。

感谢：

- `xmltodict` 的原作者 Martin Blech

这个 Node.js 版本存在的前提，就是那个 Python 项目本身足够好用、足够稳定，也值得以兼容方式带到 Node.js 生态里。
