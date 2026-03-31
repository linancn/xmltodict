"use strict";

const { isUtf8 } = require("node:buffer");

const { createNamedError, createValueError, isBinaryLike } = require("./common");

const VALID_BYTES_ERROR_HANDLERS = new Set(["replace", "strict", "ignore"]);

function normalizeEncodingLabel(encoding = "utf-8") {
  const normalized = String(encoding).toLowerCase();
  switch (normalized) {
    case "utf8":
      return "utf-8";
    case "latin1":
      return "iso-8859-1";
    case "utf16le":
    case "ucs2":
      return "utf-16le";
    case "ucs-2":
      return "utf-16le";
    default:
      return normalized;
  }
}

function formatByte(value) {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

function findUtf8DecodeError(input) {
  const bytes = Buffer.from(input);
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index];
    if (first <= 0x7f) {
      index += 1;
      continue;
    }

    let needed = 0;
    if (first >= 0xc2 && first <= 0xdf) {
      needed = 1;
    } else if (first >= 0xe0 && first <= 0xef) {
      needed = 2;
    } else if (first >= 0xf0 && first <= 0xf4) {
      needed = 3;
    } else {
      return {
        byte: first,
        index,
        reason: "invalid start byte",
      };
    }

    if (index + needed >= bytes.length) {
      return {
        byte: first,
        index,
        reason: "unexpected end of data",
      };
    }

    const second = bytes[index + 1];
    if (needed >= 1) {
      const secondValid =
        second >= 0x80 &&
        second <= 0xbf &&
        !((first === 0xe0 && second < 0xa0) ||
          (first === 0xed && second > 0x9f) ||
          (first === 0xf0 && second < 0x90) ||
          (first === 0xf4 && second > 0x8f));
      if (!secondValid) {
        return {
          byte: second,
          index: index + 1,
          reason: "invalid continuation byte",
        };
      }
    }

    for (let offset = 2; offset <= needed; offset += 1) {
      const next = bytes[index + offset];
      if (next < 0x80 || next > 0xbf) {
        return {
          byte: next,
          index: index + offset,
          reason: "invalid continuation byte",
        };
      }
    }

    index += needed + 1;
  }

  return null;
}

function createUnicodeDecodeError(encoding, bytes) {
  const detail = normalizeEncodingLabel(encoding) === "utf-8"
    ? findUtf8DecodeError(bytes)
    : null;

  const message = detail
    ? `'${normalizeEncodingLabel(encoding)}' codec can't decode byte ${formatByte(detail.byte)} in position ${detail.index}: ${detail.reason}`
    : `The encoded data was not valid for encoding ${normalizeEncodingLabel(encoding)}`;
  return createNamedError("UnicodeDecodeError", message);
}

function validateBytesErrors(bytesErrors) {
  if (!VALID_BYTES_ERROR_HANDLERS.has(bytesErrors)) {
    throw createValueError(`Invalid bytes_errors handler: ${bytesErrors}`);
  }
}

function decodeBinary(value, encoding = "utf-8", bytesErrors = "replace") {
  validateBytesErrors(bytesErrors);
  const bytes = Buffer.from(value);
  const normalizedEncoding = normalizeEncodingLabel(encoding);

  if (normalizedEncoding === "iso-8859-1") {
    return bytes.toString("latin1");
  }

  if (normalizedEncoding === "utf-8") {
    if (bytesErrors === "strict" && !isUtf8(bytes)) {
      throw createUnicodeDecodeError(normalizedEncoding, bytes);
    }

    const decoded = bytes.toString("utf8");
    if (bytesErrors === "ignore") {
      return decoded.replace(/\uFFFD/g, "");
    }
    return decoded;
  }

  try {
    const decoder = new TextDecoder(normalizedEncoding, {
      fatal: bytesErrors === "strict",
    });
    const decoded = decoder.decode(Uint8Array.from(bytes));
    return bytesErrors === "ignore" ? decoded.replace(/\uFFFD/g, "") : decoded;
  } catch (_error) {
    if (bytesErrors === "strict") {
      throw createUnicodeDecodeError(normalizedEncoding, bytes);
    }
    const decoder = new TextDecoder(normalizedEncoding);
    const decoded = decoder.decode(Uint8Array.from(bytes));
    return bytesErrors === "ignore" ? decoded.replace(/\uFFFD/g, "") : decoded;
  }
}

function convertValueToString(value, encoding = "utf-8", bytesErrors = "replace") {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (isBinaryLike(value)) {
    return decodeBinary(value, encoding, bytesErrors);
  }
  return String(value);
}

module.exports = {
  convertValueToString,
  createUnicodeDecodeError,
  decodeBinary,
  normalizeEncodingLabel,
  validateBytesErrors,
};
