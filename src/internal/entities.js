"use strict";

const ENTITY_DECLARATION_RE =
  /<!ENTITY\s+([^\s]+)\s+(?:(["'])([\s\S]*?)\2|SYSTEM\s+(["'])([\s\S]*?)\4|PUBLIC\s+(["'])([\s\S]*?)\6\s+(["'])([\s\S]*?)\8)\s*>/gi;

const XML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\"",
};

function extractEntityDeclarations(doctype) {
  const declarations = [];
  if (typeof doctype !== "string" || !doctype.includes("<!ENTITY")) {
    return declarations;
  }

  for (const match of doctype.matchAll(ENTITY_DECLARATION_RE)) {
    const name = match[1];
    const internalValue = match[3];
    const systemId = match[5] ?? match[9];
    const publicId = match[7];

    declarations.push({
      external: internalValue === undefined,
      name,
      publicId: publicId ?? null,
      systemId: systemId ?? null,
      value: internalValue ?? null,
    });
  }

  return declarations;
}

function decodeCharacterEntity(entity) {
  if (!entity.startsWith("#")) {
    return null;
  }

  if (entity[1] === "x" || entity[1] === "X") {
    if (!/^#x[0-9a-f]+$/i.test(entity)) {
      return null;
    }
    return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
  }

  if (!/^#[0-9]+$/.test(entity)) {
    return null;
  }
  return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
}

function buildExpandedEntityMap(declarations) {
  const rawValues = new Map();
  const externalNames = new Set();

  for (const declaration of declarations) {
    if (declaration.external) {
      externalNames.add(declaration.name);
      continue;
    }
    rawValues.set(declaration.name, declaration.value ?? "");
  }

  const cache = new Map();
  const resolving = new Set();

  function resolveReference(reference) {
    if (Object.prototype.hasOwnProperty.call(XML_ENTITIES, reference)) {
      return XML_ENTITIES[reference];
    }

    const charEntity = decodeCharacterEntity(reference);
    if (charEntity !== null) {
      return charEntity;
    }

    if (externalNames.has(reference)) {
      return "";
    }

    if (!rawValues.has(reference)) {
      return `&${reference};`;
    }

    return expandEntity(reference);
  }

  function expandEntity(name) {
    if (cache.has(name)) {
      return cache.get(name);
    }
    if (resolving.has(name)) {
      return `&${name};`;
    }

    resolving.add(name);
    const rawValue = rawValues.get(name) ?? "";
    const expandedValue = rawValue.replace(/&([^;]+);/g, (_match, reference) => resolveReference(reference));
    resolving.delete(name);
    cache.set(name, expandedValue);
    return expandedValue;
  }

  const entries = [];
  for (const name of rawValues.keys()) {
    entries.push([name, expandEntity(name)]);
  }
  for (const name of externalNames.values()) {
    entries.push([name, ""]);
  }
  return Object.fromEntries(entries);
}

module.exports = {
  buildExpandedEntityMap,
  extractEntityDeclarations,
};

