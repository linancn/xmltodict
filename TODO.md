# Implementation Status

This file records the completed implementation checklist for the current Node.js compatibility release.

## Current Focus

- [x] Bootstrap the Node 24 package, vendor the pinned Python reference, and enable Python-oracle tests
- [x] Implement `parse()` with Python-compatible SAX state handling
- [x] Implement `unparse()` with Python-compatible XML emission
- [x] Add migration-friendly extras: `ParsingInterrupted`, CLI streaming entrypoint, ESM/CJS exports, typings
- [x] Finish docs, release metadata, and full verification

## Phase 0: Baseline

- [x] Add package metadata, source layout, and test layout
- [x] Vendor pinned upstream reference files from Python `xmltodict`
- [x] Add Python oracle bridge for result comparison
- [x] Add initial smoke tests

## Phase 1: `parse()`

- [x] Port `_DictSAXHandler`
- [x] Build SAX adapter for namespace/comment events
- [x] Support `item_depth` / `item_callback` streaming mode
- [x] Support `process_namespaces`, `namespaces`, `namespace_separator`
- [x] Support `force_list`, `force_cdata`, `postprocessor`, `dict_constructor`
- [x] Reproduce entity behavior for `disable_entities`
- [x] Port upstream `parse` tests
- [x] Add JS-vs-Python differential tests for `parse`

## Phase 2: `unparse()`

- [x] Port `_convert_value_to_string`
- [x] Port `_validate_name` / `_validate_comment`
- [x] Port `_process_namespace` / `_emit`
- [x] Support comments, pretty print, `short_empty_elements`, `expand_iter`
- [x] Support `bytes_errors`
- [x] Port upstream `unparse` tests
- [x] Add JS-vs-Python differential tests for `unparse`

## Phase 3: Compatibility Surface

- [x] Export `parse`, `unparse`, `ParsingInterrupted`
- [x] Add a Node CLI compatible with the Python streaming script use case
- [x] Add type definitions
- [x] Document Python-to-Node migration notes

## Phase 4: Release

- [x] Final README
- [x] Verify `npm pack`
- [x] Run full test matrix locally
- [x] Prepare publish checklist for npm
