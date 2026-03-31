#!/usr/bin/env node
"use strict";

const { parse, unparse } = require("../src");

function printUsage() {
  process.stderr.write(`Usage:
  xmltodict
    Read XML from stdin and write parsed JSON to stdout.

  xmltodict <itemDepth>
    Read XML from stdin and stream one JSON record per matched item.

  xmltodict parse
    Same as the default mode.

  xmltodict stream <itemDepth>
    Explicit streaming mode. Outputs NDJSON records with "path" and "item".

  xmltodict unparse
    Read JSON from stdin and write XML to stdout.

Options:
  --compact     Emit compact JSON in parse/stream mode.
  --pretty      Emit pretty JSON in parse/stream mode.
`);
}

function parseArgs(argv) {
  let compact = false;
  let pretty = false;
  const positional = [];

  for (const arg of argv) {
    if (arg === "--compact") {
      compact = true;
      continue;
    }
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }
    positional.push(arg);
  }

  return {
    compact,
    help: false,
    positional,
    pretty,
  };
}

function detectMode(positional) {
  if (positional.length === 0) {
    return { mode: "parse", itemDepth: null };
  }

  if (/^\d+$/.test(positional[0])) {
    return { mode: "stream", itemDepth: Number.parseInt(positional[0], 10) };
  }

  if (positional[0] === "parse") {
    return { mode: "parse", itemDepth: null };
  }

  if (positional[0] === "unparse") {
    return { mode: "unparse", itemDepth: null };
  }

  if (positional[0] === "stream") {
    if (positional.length < 2 || !/^\d+$/.test(positional[1])) {
      throw new Error("stream mode requires an integer <itemDepth>");
    }
    return { mode: "stream", itemDepth: Number.parseInt(positional[1], 10) };
  }

  throw new Error(`Unknown command: ${positional[0]}`);
}

function readStdinBuffer() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

function writeJson(value, { compact, pretty }) {
  const indent = compact ? 0 : pretty ? 2 : 0;
  const trailing = "\n";
  process.stdout.write(`${JSON.stringify(value, null, indent)}${trailing}`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    process.exitCode = 0;
    return;
  }

  const { compact, pretty, positional } = parsed;
  const { itemDepth, mode } = detectMode(positional);
  const stdinBuffer = await readStdinBuffer();

  if (mode === "unparse") {
    const input = stdinBuffer.length === 0 ? {} : JSON.parse(stdinBuffer.toString("utf8"));
    const xml = unparse(input);
    process.stdout.write(xml);
    if (!xml.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  if (mode === "stream") {
    if (itemDepth === 0) {
      const result = parse(stdinBuffer);
      writeJson({ item: result, path: [] }, { compact, pretty });
      return;
    }

    parse(stdinBuffer, {
      item_depth: itemDepth,
      item_callback(path, item) {
        writeJson({ item, path }, { compact, pretty });
        return true;
      },
    });
    return;
  }

  const result = parse(stdinBuffer);
  writeJson(result, { compact, pretty });
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
