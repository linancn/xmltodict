# Publishing Checklist

## Before Publish

1. Confirm the target repository URL for this Node port and add `repository`, `homepage`, and `bugs` fields back into `package.json`.
2. Re-check npm name availability:
   - `npm view xmltodict version`
3. Review `README.md` for any repo-specific links or examples that should point at the final project.
4. Run:
   - `npm install`
   - `npm run sync:upstream`
   - `npm test`
   - `npm run pack:check`

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

