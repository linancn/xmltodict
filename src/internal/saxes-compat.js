"use strict";

const { SaxesParser } = require("saxes");

const { buildExpandedEntityMap, extractEntityDeclarations } = require("./entities");
const { normalizeChunkToString, objectFromEntries } = require("./common");

const XMLNS_URI = "http://www.w3.org/2000/xmlns/";

function buildQualifiedName(uri, localName, qualifiedName, namespaceSeparator) {
  if (!namespaceSeparator) {
    return qualifiedName;
  }
  if (!uri) {
    return localName || qualifiedName;
  }
  return `${uri}${namespaceSeparator}${localName}`;
}

function splitTagAttributes(tag, namespaceSeparator, namespacesEnabled) {
  if (!namespacesEnabled) {
    return {
      attributes: { ...tag.attributes },
      namespaceDeclarations: [],
    };
  }

  const attributes = [];
  const namespaceDeclarations = [];

  for (const attribute of Object.values(tag.attributes)) {
    if (namespacesEnabled && attribute.uri === XMLNS_URI) {
      const prefix = attribute.name === "xmlns" ? "" : attribute.local;
      namespaceDeclarations.push([prefix, attribute.value]);
      continue;
    }

    const attributeName = namespacesEnabled
      ? buildQualifiedName(attribute.uri, attribute.local, attribute.name, namespaceSeparator)
      : attribute.name;
    attributes.push([attributeName, attribute.value]);
  }

  return {
    attributes: objectFromEntries(attributes),
    namespaceDeclarations,
  };
}

class SaxesCompatParser {
  constructor(encoding, namespaceSeparator) {
    this.encoding = encoding || "utf8";
    this.namespaceSeparator = namespaceSeparator;
    this.namespacesEnabled = namespaceSeparator !== null && namespaceSeparator !== undefined;
    this.ordered_attributes = true;
    this.buffer_text = true;
    this.StartNamespaceDeclHandler = null;
    this.StartElementHandler = null;
    this.EndElementHandler = null;
    this.CharacterDataHandler = null;
    this.CommentHandler = null;
    this.EntityDeclHandler = null;
    this._parser = new SaxesParser({
      xmlns: this.namespacesEnabled,
    });
    this._wireEvents();
  }

  _wireEvents() {
    this._parser.on("error", (error) => {
      throw error;
    });

    this._parser.on("doctype", (doctype) => {
      const declarations = extractEntityDeclarations(doctype);
      if (declarations.length === 0) {
        return;
      }

      if (typeof this.EntityDeclHandler === "function") {
        for (const declaration of declarations) {
          this.EntityDeclHandler(declaration.name, declaration.value, declaration.systemId, declaration.publicId);
        }
        return;
      }

      const entities = buildExpandedEntityMap(declarations);
      for (const [name, value] of Object.entries(entities)) {
        this._parser.ENTITIES[name] = value;
      }
    });

    this._parser.on("opentag", (tag) => {
      const name = this.namespacesEnabled
        ? buildQualifiedName(tag.uri, tag.local, tag.name, this.namespaceSeparator)
        : tag.name;
      const { attributes, namespaceDeclarations } = splitTagAttributes(
        tag,
        this.namespaceSeparator,
        this.namespacesEnabled,
      );

      if (typeof this.StartNamespaceDeclHandler === "function") {
        for (const [prefix, uri] of namespaceDeclarations) {
          this.StartNamespaceDeclHandler(prefix, uri);
        }
      }

      if (typeof this.StartElementHandler === "function") {
        this.StartElementHandler(name, attributes);
      }
    });

    this._parser.on("closetag", (tag) => {
      const name = this.namespacesEnabled
        ? buildQualifiedName(tag.uri, tag.local, tag.name, this.namespaceSeparator)
        : tag.name;
      if (typeof this.EndElementHandler === "function") {
        this.EndElementHandler(name);
      }
    });

    this._parser.on("text", (text) => {
      if (typeof this.CharacterDataHandler === "function") {
        this.CharacterDataHandler(text);
      }
    });

    this._parser.on("comment", (text) => {
      if (typeof this.CommentHandler === "function") {
        this.CommentHandler(text);
      }
    });
  }

  Parse(chunk, isFinal = false) {
    this._parser.write(normalizeChunkToString(chunk, this.encoding));
    if (isFinal) {
      this._parser.close();
    }
    return 1;
  }

  ParseFile(fileObject) {
    const chunk = typeof fileObject.read === "function" ? fileObject.read() : "";
    return this.Parse(chunk, true);
  }
}

const expatCompat = {
  ExpatError: Error,
  ParserCreate(encoding, namespaceSeparator) {
    return new SaxesCompatParser(encoding, namespaceSeparator);
  },
};

module.exports = {
  SaxesCompatParser,
  buildQualifiedName,
  expatCompat,
};
