"use strict";

const {
  createValueError,
  getMappingValue,
  hasOwn,
  isBinaryLike,
  isObjectLike,
  isSyncIterable,
} = require("./internal/common");
const { convertValueToString, normalizeEncodingLabel, validateBytesErrors } = require("./internal/encoding");

function isPlainObject(value) {
  if (!isObjectLike(value) || Array.isArray(value) || isBinaryLike(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value) {
  return escapeXmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;")
    .replace(/\t/g, "&#9;");
}

function repeatIndent(depth, indent) {
  return indent.repeat(depth);
}

function validateName(value, kind) {
  if (typeof value !== "string") {
    throw createValueError(`${kind} name must be a string`);
  }
  if (value.startsWith("?") || value.startsWith("!")) {
    throw createValueError(`Invalid ${kind} name: cannot start with "?" or "!"`);
  }
  if (value.includes("<") || value.includes(">")) {
    throw createValueError(`Invalid ${kind} name: "<" or ">" not allowed`);
  }
  if (value.includes("/")) {
    throw createValueError(`Invalid ${kind} name: "/" not allowed`);
  }
  if (value.includes("\"") || value.includes("'")) {
    throw createValueError(`Invalid ${kind} name: quotes not allowed`);
  }
  if (value.includes("=")) {
    throw createValueError(`Invalid ${kind} name: "=" not allowed`);
  }
  if (/\s/.test(value)) {
    throw createValueError(`Invalid ${kind} name: whitespace not allowed`);
  }
}

function validateComment(value) {
  if (typeof value !== "string") {
    throw createValueError("Comment text must be a string");
  }
  if (value.includes("--")) {
    throw createValueError("Comment text cannot contain '--'");
  }
  if (value.endsWith("-")) {
    throw createValueError("Comment text cannot end with '-'");
  }
  return value;
}

function processNamespace(name, namespaces, namespaceSeparator = ":", attrPrefix = "@") {
  if (typeof name !== "string" || !namespaces) {
    return name;
  }

  const index = name.lastIndexOf(namespaceSeparator);
  if (index === -1) {
    return name;
  }

  const ns = name.slice(0, index);
  const localName = name.slice(index + namespaceSeparator.length);
  const strippedNs = ns.startsWith(attrPrefix) ? ns.slice(attrPrefix.length) : ns;
  const namespaceResult = getMappingValue(namespaces, strippedNs);

  if (namespaceResult) {
    const prefix = ns.startsWith(attrPrefix) ? attrPrefix : "";
    return `${prefix}${namespaceResult}${namespaceSeparator}${localName}`;
  }
  return localName;
}

function toSequence(value) {
  if (!isSyncIterable(value) || typeof value === "string" || isBinaryLike(value) || isPlainObject(value)) {
    return [value];
  }
  return Array.from(value);
}

function toAttributeEntries(xmlnsValue, encoding, bytesErrors) {
  const attrs = [];
  for (const [key, value] of Object.entries(xmlnsValue)) {
    validateName(key, "attribute");
    const attrName = `xmlns${key ? `:${key}` : ""}`;
    attrs.push([
      attrName,
      value == null ? "" : convertValueToString(value, encoding, bytesErrors),
    ]);
  }
  return attrs;
}

function collectNodeParts(node, options) {
  const {
    attr_prefix,
    bytes_errors,
    cdata_key,
    comment_key,
    encoding,
    namespace_separator,
    namespaces,
  } = options;

  let cdata = null;
  const attrs = [];
  const children = [];

  for (const [rawKey, rawValue] of Object.entries(node)) {
    if (rawKey === cdata_key) {
      cdata = rawValue == null ? null : convertValueToString(rawValue, encoding, bytes_errors);
      continue;
    }

    if (typeof rawKey === "string" && rawKey.startsWith(attr_prefix)) {
      const processedKey = processNamespace(rawKey, namespaces, namespace_separator, attr_prefix);
      if (processedKey === `${attr_prefix}xmlns` && isPlainObject(rawValue)) {
        attrs.push(...toAttributeEntries(rawValue, encoding, bytes_errors));
        continue;
      }

      const attrName = processedKey.slice(attr_prefix.length);
      validateName(attrName, "attribute");
      const attrValue = rawValue == null
        ? ""
        : typeof rawValue === "string"
          ? rawValue
          : convertValueToString(rawValue, encoding, bytes_errors);
      attrs.push([attrName, attrValue]);
      continue;
    }

    if (Array.isArray(rawValue) && rawValue.length === 0) {
      continue;
    }

    if (rawKey === comment_key) {
      children.push([rawKey, rawValue]);
      continue;
    }

    children.push([rawKey, rawValue]);
  }

  return {
    attrs,
    cdata,
    children,
  };
}

function emitCommentNode(value, context) {
  const { bytes_errors, depth, encoding, indent, newl, output, pretty } = context;
  const comments = Array.isArray(value) ? value : [value];

  for (const entry of comments) {
    if (entry == null) {
      continue;
    }
    const text = convertValueToString(entry, encoding, bytes_errors);
    if (!text) {
      continue;
    }
    if (pretty) {
      output.push(repeatIndent(depth, indent));
    }
    output.push(`<!--${escapeXmlText(validateComment(text))}-->`);
    if (pretty) {
      output.push(newl);
    }
  }
}

function emitNode(key, value, context) {
  const {
    attr_prefix,
    bytes_errors,
    cdata_key,
    comment_key,
    depth,
    encoding,
    expand_iter,
    full_document,
    indent,
    namespace_separator,
    namespaces,
    output,
    preprocessor,
    pretty,
    short_empty_elements,
  } = context;

  if (typeof key === "string" && key === comment_key) {
    emitCommentNode(value, context);
    return;
  }

  let currentKey = processNamespace(key, namespaces, namespace_separator, attr_prefix);
  let currentValue = value;

  if (preprocessor) {
    const result = preprocessor(currentKey, currentValue);
    if (result == null) {
      return;
    }
    [currentKey, currentValue] = result;
  }

  validateName(currentKey, "element");

  const values = toSequence(currentValue);
  for (let index = 0; index < values.length; index += 1) {
    if (full_document && depth === 0 && index > 0) {
      throw createValueError("document with multiple roots");
    }

    let item = values[index];
    if (item == null) {
      item = {};
    } else if (!isPlainObject(item) && typeof item !== "string") {
      if (expand_iter && isSyncIterable(item) && !isBinaryLike(item)) {
        item = { [expand_iter]: Array.from(item) };
      } else {
        item = convertValueToString(item, encoding, bytes_errors);
      }
    }

    if (typeof item === "string") {
      item = { [cdata_key]: item };
    }

    const { attrs, cdata, children } = collectNodeParts(item, {
      attr_prefix,
      bytes_errors,
      cdata_key,
      comment_key,
      encoding,
      namespace_separator,
      namespaces,
    });

    if (pretty) {
      output.push(repeatIndent(depth, indent));
    }

    const attrsText = attrs
      .map(([name, attrValue]) => ` ${name}="${escapeXmlAttribute(attrValue)}"`)
      .join("");

    if (children.length === 0 && cdata === null) {
      if (short_empty_elements) {
        output.push(`<${currentKey}${attrsText}/>`);
      } else {
        output.push(`<${currentKey}${attrsText}></${currentKey}>`);
      }
      if (pretty && depth > 0) {
        output.push(context.newl);
      }
      continue;
    }

    output.push(`<${currentKey}${attrsText}>`);
    if (pretty && children.length > 0) {
      output.push(context.newl);
    }

    for (const [childKey, childValue] of children) {
      emitNode(childKey, childValue, {
        ...context,
        depth: depth + 1,
      });
    }

    if (cdata !== null) {
      output.push(escapeXmlText(cdata));
    }

    if (pretty && children.length > 0) {
      output.push(repeatIndent(depth, indent));
    }

    output.push(`</${currentKey}>`);
    if (pretty && depth > 0) {
      output.push(context.newl);
    }
  }
}

function unparse(input_dict, options = {}) {
  const {
    attr_prefix = "@",
    bytes_errors = "replace",
    cdata_key = "#text",
    comment_key = "#comment",
    encoding = "utf-8",
    expand_iter = null,
    full_document = true,
    indent: rawIndent = "\t",
    namespaces = null,
    namespace_separator = ":",
    newl = "\n",
    output = null,
    preprocessor = null,
    pretty = false,
    short_empty_elements = false,
  } = options;

  validateBytesErrors(bytes_errors);

  const indent = typeof rawIndent === "number" ? " ".repeat(rawIndent) : rawIndent;
  const buffer = [];
  if (full_document) {
    buffer.push(`<?xml version="1.0" encoding="${normalizeEncodingLabel(encoding)}"?>`);
    buffer.push(newl);
  }

  let seenRoot = false;
  for (const [key, value] of Object.entries(input_dict)) {
    if (key !== comment_key && full_document && seenRoot) {
      throw createValueError("Document must have exactly one root.");
    }

    emitNode(key, value, {
      attr_prefix,
      bytes_errors,
      cdata_key,
      comment_key,
      depth: 0,
      encoding,
      expand_iter,
      full_document,
      indent,
      namespace_separator,
      namespaces,
      newl,
      output: buffer,
      preprocessor,
      pretty,
      short_empty_elements,
    });

    if (key !== comment_key) {
      seenRoot = true;
    }
  }

  if (full_document && !seenRoot) {
    throw createValueError("Document must have exactly one root.");
  }

  const xml = buffer.join("");
  if (output && typeof output.write === "function") {
    output.write(xml);
    return undefined;
  }
  return xml;
}

module.exports = {
  collectNodeParts,
  convertValueToString,
  emitNode,
  processNamespace,
  unparse,
  validateComment,
  validateName,
};
