# Publishing Checklist

## Before Publish

1. Re-check npm name availability:
   - `npm view xmltodict version`
2. Review `README.md` and confirm the English and Chinese sections still match the actual package behavior.
3. Confirm the compatibility target under `vendor/upstream` if you are updating behavior against a newer Python release.
4. Run:
   - `npm install`
   - `npm run sync:upstream`
   - `npm test`
   - `npm run pack:check`

Development-only external sample verification can be run separately when needed:

- `npm run dev:verify:real-world-samples -- --repo <owner/name> --root <xml/root/path> --count 4`
- `npm run dev:verify:real-world-samples -- --repo <owner/name> --root <xml/root/path> --samples <file1.xml,file2.xml>`

This external-data verification is not part of the published npm tarball.

## Publish

1. Authenticate:
   - `npm login`
2. Publish:
   - `npm publish --access public`

## After Publish

1. Verify install:
   - `npm install xmltodict`
2. Smoke-test both APIs:
   - `parse()`
   - `unparse()`
3. Smoke-test the CLI:
   - `xmltodict`
   - `xmltodict stream 2`
   - `xmltodict unparse`
4. Verify npm metadata:
   - repository link
   - issue tracker link
   - README rendering
   - executable `xmltodict` bin
