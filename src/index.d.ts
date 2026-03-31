export class ParsingInterrupted extends Error {
  constructor(message?: string);
}

export type DictConstructor = (entries?: Iterable<readonly [string, unknown]>) => Record<string, unknown>;
export type PathEntry = [string, Record<string, unknown> | null];

export interface ParseOptions {
  item_depth?: number;
  item_callback?: (path: PathEntry[], item: unknown) => boolean;
  xml_attribs?: boolean;
  attr_prefix?: string;
  cdata_key?: string;
  force_cdata?: boolean | string[] | ((path: PathEntry[], key: string, value: unknown) => boolean);
  cdata_separator?: string;
  postprocessor?: (path: PathEntry[], key: string, value: unknown) => [string, unknown] | null;
  dict_constructor?: DictConstructor;
  strip_whitespace?: boolean;
  namespace_separator?: string;
  namespaces?: Record<string, string | null>;
  force_list?: boolean | string[] | ((path: PathEntry[], key: string, value: unknown) => boolean);
  comment_key?: string;
  encoding?: string | null;
  process_namespaces?: boolean;
  disable_entities?: boolean;
  process_comments?: boolean;
}

export interface UnparseOptions {
  output?: { write(chunk: string): unknown } | null;
  encoding?: string;
  full_document?: boolean;
  short_empty_elements?: boolean;
  attr_prefix?: string;
  cdata_key?: string;
  pretty?: boolean;
  indent?: string | number;
  newl?: string;
  expand_iter?: string | null;
  comment_key?: string;
  bytes_errors?: string;
  namespaces?: Record<string, string | null>;
  namespace_separator?: string;
  preprocessor?: (key: string, value: unknown) => [string, unknown] | null;
}

export function parse(xmlInput: unknown, options?: ParseOptions): unknown;
export function unparse(input: Record<string, unknown>, options?: UnparseOptions): string | undefined;

declare const _default: {
  ParsingInterrupted: typeof ParsingInterrupted;
  parse: typeof parse;
  unparse: typeof unparse;
};

export default _default;

