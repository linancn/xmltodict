import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const { parse, unparse } = require("../src");
const { callPythonOracle } = require("../test/helpers/oracle");

const DEFAULT_COUNT = 4;
const DEFAULT_REF = "main";
const DEFAULT_REPORT_NAME = "real-world-sample-verification.json";
const RANDOM_SEED = 20260331;

function usage() {
  return [
    "Usage:",
    "  npm run dev:verify:real-world-samples -- --repo <owner/name> --root <xml/root/path> [--count 4] [--seed 20260331]",
    "  npm run dev:verify:real-world-samples -- --repo <owner/name> --root <xml/root/path> --samples <file1.xml,file2.xml>",
    "",
    "Examples:",
    "  npm run dev:verify:real-world-samples -- --repo owner/repo --root data/xml --count 4",
    "  npm run dev:verify:real-world-samples -- --repo owner/repo --root data/xml --samples a.xml,b/c.xml",
  ].join("\n");
}

function parseCli() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      repo: { type: "string" },
      ref: { type: "string" },
      root: { type: "string" },
      count: { type: "string" },
      seed: { type: "string" },
      samples: { type: "string" },
      "report-name": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }

  if (!values.repo || !values.root) {
    throw new Error(`Both --repo and --root are required.\n\n${usage()}`);
  }

  const count =
    values.count == null ? DEFAULT_COUNT : Number.parseInt(values.count, 10);
  const seed = values.seed == null ? RANDOM_SEED : Number.parseInt(values.seed, 10);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`--count must be a positive integer.\n\n${usage()}`);
  }
  if (!Number.isInteger(seed)) {
    throw new Error(`--seed must be an integer.\n\n${usage()}`);
  }

  return {
    count,
    ref: values.ref || DEFAULT_REF,
    reportName: values["report-name"] || DEFAULT_REPORT_NAME,
    repo: values.repo,
    root: values.root.replace(/^\/+|\/+$/g, ""),
    samples: values.samples
      ? values.samples
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : null,
    seed,
  };
}

function encodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeFilePath(filePath, root) {
  if (!filePath) {
    throw new Error("Empty file path is not allowed.");
  }

  const trimmed = filePath.replace(/^\/+/, "");
  if (trimmed.startsWith(`${root}/`) || trimmed === root) {
    return trimmed;
  }
  return `${root}/${trimmed}`;
}

function groupFromPath(filePath, root) {
  const relativePath = filePath.startsWith(`${root}/`)
    ? filePath.slice(root.length + 1)
    : filePath;
  const parts = relativePath.split("/");
  return parts.length > 1 ? parts[0] : "(root)";
}

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle(items, prng) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(prng() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "xmltodict-dev-verifier",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function listXmlFiles(treeItems, root) {
  return treeItems
    .map((item) => item.path || "")
    .filter(
      (filePath, index) =>
        treeItems[index].type === "blob" &&
        (filePath === root || filePath.startsWith(`${root}/`)) &&
        filePath.toLowerCase().endsWith(".xml"),
    );
}

function buildGroupStats(xmlFiles, root) {
  const counts = {};

  for (const filePath of xmlFiles) {
    const group = groupFromPath(filePath, root);
    counts[group] = (counts[group] || 0) + 1;
  }

  return counts;
}

function pickSamples(xmlFiles, root, count, seed) {
  if (count > xmlFiles.length) {
    throw new Error(`Requested ${count} samples but only found ${xmlFiles.length} XML files.`);
  }

  const byGroup = new Map();
  for (const filePath of xmlFiles) {
    const group = groupFromPath(filePath, root);
    const items = byGroup.get(group) || [];
    items.push(filePath);
    byGroup.set(group, items);
  }

  const prng = createPrng(seed);
  const grouped = shuffle(
    [...byGroup.entries()].map(([group, items]) => ({
      group,
      items: shuffle(items.sort((left, right) => left.localeCompare(right)), prng),
    })),
    prng,
  );

  const selected = [];
  while (selected.length < count) {
    let pickedInRound = false;
    for (const entry of grouped) {
      if (selected.length >= count) {
        break;
      }
      if (entry.items.length === 0) {
        continue;
      }
      selected.push(entry.items.shift());
      pickedInRound = true;
    }
    if (!pickedInRound) {
      break;
    }
  }

  return selected;
}

async function verifySample(filePath, config) {
  const rawBaseUrl = `https://raw.githubusercontent.com/${config.repo}/${config.ref}`;
  const xml = await fetchText(`${rawBaseUrl}/${encodePathSegments(filePath)}`);

  const nodeParsed = parse(xml);
  const pythonParsed = callPythonOracle({
    op: "parse",
    xml_input: xml,
    kwargs: {},
  });
  assert.deepStrictEqual(nodeParsed, pythonParsed);

  const nodeParsedNamespaces = parse(xml, { process_namespaces: true });
  const pythonParsedNamespaces = callPythonOracle({
    op: "parse",
    xml_input: xml,
    kwargs: { process_namespaces: true },
  });
  assert.deepStrictEqual(nodeParsedNamespaces, pythonParsedNamespaces);

  const nodeParsedNoAttribs = parse(xml, { xml_attribs: false });
  const pythonParsedNoAttribs = callPythonOracle({
    op: "parse",
    xml_input: xml,
    kwargs: { xml_attribs: false },
  });
  assert.deepStrictEqual(nodeParsedNoAttribs, pythonParsedNoAttribs);

  const nodeXml = unparse(nodeParsed);
  const pythonXml = callPythonOracle({
    op: "unparse",
    input_dict: pythonParsed,
    kwargs: {},
  });
  assert.strictEqual(nodeXml, pythonXml);

  const nodeRoundtrip = parse(nodeXml);
  const pythonRoundtrip = callPythonOracle({
    op: "parse",
    xml_input: pythonXml,
    kwargs: {},
  });
  assert.deepStrictEqual(nodeRoundtrip, nodeParsed);
  assert.deepStrictEqual(pythonRoundtrip, pythonParsed);
  assert.deepStrictEqual(nodeRoundtrip, pythonRoundtrip);

  return {
    bytes: Buffer.byteLength(xml, "utf8"),
    checks: {
      parse_default_equal: true,
      parse_process_namespaces_equal: true,
      parse_xml_attribs_false_equal: true,
      unparse_from_default_parse_equal: true,
      roundtrip_parse_unparse_parse_equal: true,
    },
    group: groupFromPath(filePath, config.root),
    path: filePath,
    status: "pass",
  };
}

async function main() {
  const config = parseCli();
  const startedAt = new Date().toISOString();
  const treeUrl = `https://api.github.com/repos/${config.repo}/git/trees/${encodeURIComponent(
    config.ref,
  )}?recursive=1`;
  const tree = await fetchJson(treeUrl);
  const xmlFiles = listXmlFiles(tree.tree || [], config.root);
  const groupCounts = buildGroupStats(xmlFiles, config.root);
  const selectedSamples = (config.samples || pickSamples(xmlFiles, config.root, config.count, config.seed))
    .map((filePath) => normalizeFilePath(filePath, config.root));
  const sampleResults = [];

  for (const sample of selectedSamples) {
    sampleResults.push(await verifySample(sample, config));
  }

  const report = {
    checkedAt: startedAt,
    dataSource: {
      randomSeed: config.seed,
      ref: config.ref,
      repository: config.repo,
      root: config.root,
      sampleStrategy: config.samples
        ? "Explicit sample list provided via --samples."
        : "Seeded stratified sample across the available XML groups under the configured root.",
      selectedSamples,
      xmlGroupCounts: groupCounts,
    },
    result: {
      allSamplesPass: sampleResults.every((item) => item.status === "pass"),
      comparedAgainst: "Pinned upstream Python xmltodict reference via test/helpers/python_oracle.py",
      sampleCount: sampleResults.length,
    },
    sampleResults,
  };

  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, config.reportName);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
