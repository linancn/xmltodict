"use strict";

const { ParsingInterrupted } = require("./errors");
const {
  constructDict,
  createValueError,
  getMappingValue,
  hasOwn,
  isAsyncIterable,
  isEmptyObject,
  isObjectLike,
  isSyncIterable,
  normalizeChunkToString,
} = require("./internal/common");
const { expatCompat } = require("./internal/saxes-compat");

function defaultItemCallback() {
  return true;
}

function defaultDictConstructor(entries) {
  return constructDict(null, entries);
}

class DictSAXHandler {
  constructor({
    attr_prefix = "@",
    cdata_key = "#text",
    cdata_separator = "",
    comment_key = "#comment",
    dict_constructor = defaultDictConstructor,
    force_cdata = false,
    force_list = null,
    item_callback = defaultItemCallback,
    item_depth = 0,
    namespace_separator = ":",
    namespaces = null,
    postprocessor = null,
    strip_whitespace = true,
    xml_attribs = true,
  } = {}) {
    this.attr_prefix = attr_prefix;
    this.cdata_key = cdata_key;
    this.cdata_separator = cdata_separator;
    this.comment_key = comment_key;
    this.data = [];
    this.dict_constructor = dict_constructor;
    this.force_cdata = force_cdata;
    this.force_list = force_list;
    this.item = null;
    this.item_callback = item_callback;
    this.item_depth = item_depth;
    this.namespace_declarations = this.dict_constructor();
    this.namespace_separator = namespace_separator;
    this.namespaces = namespaces;
    this.path = [];
    this.postprocessor = postprocessor;
    this.stack = [];
    this.strip_whitespace = strip_whitespace;
    this.xml_attribs = xml_attribs;
  }

  _buildName(fullName) {
    if (this.namespaces == null) {
      return fullName;
    }

    const index = String(fullName).lastIndexOf(this.namespace_separator);
    if (index === -1) {
      return fullName;
    }

    const namespace = fullName.slice(0, index);
    const name = fullName.slice(index + this.namespace_separator.length);
    const shortNamespace = getMappingValue(this.namespaces, namespace);

    if (shortNamespace === undefined) {
      return fullName;
    }
    if (!shortNamespace) {
      return name;
    }
    return `${shortNamespace}${this.namespace_separator}${name}`;
  }

  _attrsToDict(attrs) {
    if (isObjectLike(attrs) && !Array.isArray(attrs)) {
      return attrs;
    }

    const entries = [];
    for (let index = 0; index < attrs.length; index += 2) {
      entries.push([attrs[index], attrs[index + 1]]);
    }
    return this.dict_constructor(entries);
  }

  _shouldForceList(key, value) {
    if (!this.force_list) {
      return false;
    }
    if (typeof this.force_list === "boolean") {
      return this.force_list;
    }
    if (typeof this.force_list === "function") {
      return Boolean(this.force_list(this.path.slice(0, -1), key, value));
    }
    if (Array.isArray(this.force_list)) {
      return this.force_list.includes(key);
    }
    if (this.force_list instanceof Set) {
      return this.force_list.has(key);
    }
    return false;
  }

  _shouldForceCdata(key, value) {
    if (!this.force_cdata) {
      return false;
    }
    if (typeof this.force_cdata === "boolean") {
      return this.force_cdata;
    }
    if (typeof this.force_cdata === "function") {
      return Boolean(this.force_cdata(this.path.slice(0, -1), key, value));
    }
    if (Array.isArray(this.force_cdata)) {
      return this.force_cdata.includes(key);
    }
    if (this.force_cdata instanceof Set) {
      return this.force_cdata.has(key);
    }
    return false;
  }

  startNamespaceDecl(prefix, uri) {
    this.namespace_declarations[prefix || ""] = uri;
  }

  startElement(fullName, attrs) {
    const name = this._buildName(fullName);
    let convertedAttrs = this._attrsToDict(attrs);

    if (!isEmptyObject(this.namespace_declarations)) {
      if (isEmptyObject(convertedAttrs)) {
        convertedAttrs = this.dict_constructor();
      }
      convertedAttrs.xmlns = this.namespace_declarations;
      this.namespace_declarations = this.dict_constructor();
    }

    this.path.push([name, isEmptyObject(convertedAttrs) ? null : convertedAttrs]);
    if (this.path.length >= this.item_depth) {
      this.stack.push([this.item, this.data]);
      if (this.xml_attribs) {
        const attrEntries = [];
        for (const [key, value] of Object.entries(convertedAttrs)) {
          const attrKey = `${this.attr_prefix}${this._buildName(key)}`;
          const entry = this.postprocessor
            ? this.postprocessor(this.path, attrKey, value)
            : [attrKey, value];
          if (entry) {
            attrEntries.push(entry);
          }
        }
        convertedAttrs = this.dict_constructor(attrEntries);
      } else {
        convertedAttrs = null;
      }
      this.item = convertedAttrs && !isEmptyObject(convertedAttrs) ? convertedAttrs : null;
      this.data = [];
    }
  }

  endElement(fullName) {
    const name = this._buildName(fullName);

    if (this.path.length === this.item_depth) {
      let item = this.item;
      if (item === null) {
        item = this.data.length === 0 ? null : this.data.join(this.cdata_separator);
      }

      if (!this.item_callback(this.path, item)) {
        throw new ParsingInterrupted();
      }

      if (this.stack.length > 0) {
        [this.item, this.data] = this.stack.pop();
      } else {
        this.item = null;
        this.data = [];
      }
      this.path.pop();
      return;
    }

    if (this.stack.length > 0) {
      let data = this.data.length === 0 ? null : this.data.join(this.cdata_separator);
      let item = this.item;
      [this.item, this.data] = this.stack.pop();
      if (this.strip_whitespace && data) {
        data = data.trim() || null;
      }
      if (data && this._shouldForceCdata(name, data) && item === null) {
        item = this.dict_constructor();
      }
      if (item !== null) {
        if (data) {
          item = this.pushData(item, this.cdata_key, data);
        }
        this.item = this.pushData(this.item, name, item);
      } else {
        this.item = this.pushData(this.item, name, data);
      }
    } else {
      this.item = null;
      this.data = [];
    }

    this.path.pop();
  }

  characters(data) {
    if (this.data.length === 0) {
      this.data = [data];
      return;
    }
    this.data.push(data);
  }

  comments(data) {
    let comment = data;
    if (this.strip_whitespace) {
      comment = comment.trim();
    }
    this.item = this.pushData(this.item, this.comment_key, comment);
  }

  pushData(item, key, data) {
    let nextKey = key;
    let nextData = data;
    if (this.postprocessor) {
      const result = this.postprocessor(this.path, key, data);
      if (result == null) {
        return item;
      }
      [nextKey, nextData] = result;
    }

    let target = item;
    if (target === null) {
      target = this.dict_constructor();
    }

    if (hasOwn(target, nextKey)) {
      const value = target[nextKey];
      if (Array.isArray(value)) {
        value.push(nextData);
      } else {
        target[nextKey] = [value, nextData];
      }
      return target;
    }

    target[nextKey] = this._shouldForceList(nextKey, nextData) ? [nextData] : nextData;
    return target;
  }
}

function parse(xmlInput, options = {}) {
  const {
    attr_prefix = "@",
    cdata_key = "#text",
    cdata_separator = "",
    comment_key = "#comment",
    dict_constructor = defaultDictConstructor,
    disable_entities = true,
    encoding = null,
    expat = expatCompat,
    force_cdata = false,
    force_list = null,
    item_callback = defaultItemCallback,
    item_depth = 0,
    namespace_separator = ":",
    namespaces = null,
    postprocessor = null,
    process_comments = false,
    process_namespaces = false,
    strip_whitespace = true,
    xml_attribs = true,
  } = options;

  if (isAsyncIterable(xmlInput)) {
    throw createValueError("async iterables are not supported by parse()");
  }

  const handler = new DictSAXHandler({
    attr_prefix,
    cdata_key,
    cdata_separator,
    comment_key,
    dict_constructor,
    force_cdata,
    force_list,
    item_callback,
    item_depth,
    namespace_separator,
    namespaces,
    postprocessor,
    strip_whitespace,
    xml_attribs,
  });

  const effectiveNamespaceSeparator = process_namespaces ? namespace_separator : null;
  const parserFactory = expat && typeof expat.ParserCreate === "function" ? expat : expatCompat;
  const parser = parserFactory.ParserCreate(encoding, effectiveNamespaceSeparator);

  parser.ordered_attributes = true;
  parser.StartNamespaceDeclHandler = handler.startNamespaceDecl.bind(handler);
  parser.StartElementHandler = handler.startElement.bind(handler);
  parser.EndElementHandler = handler.endElement.bind(handler);
  parser.CharacterDataHandler = handler.characters.bind(handler);
  if (process_comments) {
    parser.CommentHandler = handler.comments.bind(handler);
  }
  parser.buffer_text = true;
  if (disable_entities) {
    parser.EntityDeclHandler = () => {
      throw createValueError("entities are disabled");
    };
  }

  if (xmlInput && typeof xmlInput.read === "function") {
    parser.ParseFile(xmlInput);
    return handler.item;
  }

  if (isSyncIterable(xmlInput)) {
    for (const chunk of xmlInput) {
      parser.Parse(chunk, false);
    }
    parser.Parse("", true);
    return handler.item;
  }

  parser.Parse(normalizeChunkToString(xmlInput, encoding || "utf8"), true);
  return handler.item;
}

module.exports = {
  DictSAXHandler,
  parse,
};
