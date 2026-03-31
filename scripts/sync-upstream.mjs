import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PINNED_REF = "77b55aa159add632bafdf721f61d86f06210f235";
const UPSTREAM_REPO = "martinblech/xmltodict";
const BASE_URL = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${PINNED_REF}`;
const ROOT_DIR = process.cwd();
const FILES = [
  ["xmltodict.py", "vendor/upstream/xmltodict.py"],
  ["README.md", "vendor/upstream/README.python.md"],
  ["tests/test_xmltodict.py", "vendor/upstream/tests/test_xmltodict.py"],
  ["tests/test_dicttoxml.py", "vendor/upstream/tests/test_dicttoxml.py"],
];

async function downloadText(relativePath) {
  const response = await fetch(`${BASE_URL}/${relativePath}`);
  if (!response.ok) {
    throw new Error(`Failed to download ${relativePath}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const metadata = {
    repo: UPSTREAM_REPO,
    ref: PINNED_REF,
    fetchedAt: new Date().toISOString(),
  };

  for (const [remotePath, localPath] of FILES) {
    const text = await downloadText(remotePath);
    const targetPath = path.join(ROOT_DIR, localPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, text, "utf8");
    process.stdout.write(`synced ${localPath}\n`);
  }

  const metadataPath = path.join(ROOT_DIR, "vendor/upstream/metadata.json");
  await mkdir(path.dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  process.stdout.write(`pinned upstream ref ${PINNED_REF}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
