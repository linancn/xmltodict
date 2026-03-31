"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const PYTHON_ORACLE = path.join(__dirname, "python_oracle.py");

function encodeValue(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      __type: "bytes",
      base64: Buffer.from(value).toString("base64"),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeValue(item));
  }

  if (value && typeof value === "object") {
    if (value.__type === "generator" && Array.isArray(value.items)) {
      return {
        __type: "generator",
        items: value.items.map((item) => encodeValue(item)),
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
    );
  }

  return value;
}

function decodeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => decodeValue(item));
  }

  if (value && typeof value === "object") {
    if (value.__type === "bytes") {
      return Buffer.from(value.base64, "base64");
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decodeValue(item)]),
    );
  }

  return value;
}

function callPythonOracle(payload) {
  const result = spawnSync("python3", [PYTHON_ORACLE], {
    input: JSON.stringify(encodeValue(payload)),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !result.stdout) {
    throw new Error(result.stderr || `python oracle exited with status ${result.status}`);
  }

  const response = JSON.parse(result.stdout);
  if (!response.ok) {
    const error = new Error(response.error.message);
    error.name = response.error.type;
    throw error;
  }
  return decodeValue(response.result);
}

module.exports = {
  callPythonOracle,
};

