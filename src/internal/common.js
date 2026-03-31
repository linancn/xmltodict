"use strict";

function objectFromEntries(entries) {
  const output = {};
  if (!entries) {
    return output;
  }

  for (const [key, value] of entries) {
    output[key] = value;
  }
  return output;
}

function constructDict(dictConstructor, entries) {
  if (typeof dictConstructor !== "function") {
    return objectFromEntries(entries);
  }
  if (entries === undefined) {
    return dictConstructor();
  }
  return dictConstructor(entries);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function isEmptyObject(value) {
  return !value || Object.keys(value).length === 0;
}

function getMappingValue(mapping, key) {
  if (mapping == null) {
    return undefined;
  }
  if (mapping instanceof Map) {
    return mapping.get(key);
  }
  if (typeof mapping === "function") {
    return mapping(key);
  }
  return mapping[key];
}

function createNamedError(name, message, cause) {
  const error = new Error(message);
  error.name = name;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

function createValueError(message, cause) {
  return createNamedError("ValueError", message, cause);
}

function isBinaryLike(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

function normalizeChunkToString(chunk, encoding = "utf8") {
  if (chunk == null) {
    return "";
  }
  if (typeof chunk === "string") {
    return chunk;
  }
  if (isBinaryLike(chunk)) {
    return Buffer.from(chunk).toString(encoding);
  }
  return String(chunk);
}

function isSyncIterable(value) {
  return (
    value != null &&
    typeof value !== "string" &&
    !isBinaryLike(value) &&
    typeof value[Symbol.iterator] === "function"
  );
}

function isAsyncIterable(value) {
  return value != null && typeof value[Symbol.asyncIterator] === "function";
}

module.exports = {
  constructDict,
  createNamedError,
  createValueError,
  getMappingValue,
  hasOwn,
  isAsyncIterable,
  isBinaryLike,
  isEmptyObject,
  isObjectLike,
  isSyncIterable,
  normalizeChunkToString,
  objectFromEntries,
};

