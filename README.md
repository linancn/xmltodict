# xmltodict

Node.js port of Python [`xmltodict`](https://github.com/linancn/xmltodict), targeting Node 24+ and matching the Python API names:

- `parse()`
- `unparse()`
- `ParsingInterrupted`

The package is validated against a pinned upstream Python reference and ships with differential tests that compare Node output to Python `xmltodict`.

## Install

```sh
npm install xmltodict
```

## Usage

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

## API

### `parse(xmlInput, options?)`

Supported compatibility options:

- `encoding`
- `process_namespaces`
- `namespace_separator`
- `disable_entities`
- `process_comments`
- `xml_attribs`
- `attr_prefix`
- `cdata_key`
- `force_cdata`
- `cdata_separator`
- `postprocessor`
- `dict_constructor`
- `strip_whitespace`
- `namespaces`
- `force_list`
- `item_depth`
- `item_callback`
- `comment_key`
- `expat`

Accepted input shapes:

- `string`
- `Buffer` / `Uint8Array`
- file-like objects with `.read()`
- sync iterables of chunks

### `unparse(inputDict, options?)`

Supported compatibility options:

- `output`
- `encoding`
- `bytes_errors`
- `full_document`
- `short_empty_elements`
- `attr_prefix`
- `cdata_key`
- `pretty`
- `indent`
- `newl`
- `expand_iter`
- `comment_key`
- `namespaces`
- `namespace_separator`
- `preprocessor`

## CLI

The package ships with a small Node CLI:

```sh
xmltodict < input.xml
xmltodict parse < input.xml
xmltodict stream 2 < input.xml
cat input.json | xmltodict unparse
```

CLI modes:

- default / `parse`: reads XML from `stdin`, writes JSON to `stdout`
- `stream <depth>`: emits one NDJSON record per streamed item as `{"path": [...], "item": ...}`
- `unparse`: reads JSON from `stdin`, writes XML to `stdout`

Useful flags:

- `--pretty`
- `--compact`

## Compatibility Notes

- Core `parse()` and `unparse()` behavior is checked against pinned upstream Python `xmltodict` sources under `vendor/upstream`.
- Tests include exact-string cases plus Python oracle parity checks.
- The Node CLI is intentionally JSON/NDJSON-oriented. Python's `xmltodict.py` script writes Python `marshal` records; that binary CLI format is not replicated here.

## Development

```sh
npm install
npm run sync:upstream
npm test
npm run pack:check
```
