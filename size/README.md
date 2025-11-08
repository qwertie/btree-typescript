# Size Reporting

1. Run `npm run build` to emit the latest `core/index.js`, `extended/index.js`, `algorithms/index.js`, and `b+tree.js` bundles.
2. Execute `npm run size-report` to print raw, minified, and gzip sizes for each entry point.

The script reads the compiled CommonJS files, runs them through `uglify-js`, and uses Node's `zlib` to compute gzip sizes so you can compare the baseline core bundle with the extended/diff-enabled build, the standalone algorithms entry point, and the full bundle.
