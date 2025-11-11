#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');

const targets = [
  { input: 'b+tree.js', output: 'b+tree.min.js' },
  { input: path.join('extended', 'index.js'), output: path.join('extended', 'index.min.js') },
  { input: path.join('extended', 'diffAgainst.js'), output: path.join('extended', 'diffAgainst.min.js') }
];

for (const { input, output } of targets) {
  const sourcePath = path.resolve(__dirname, '..', input);
  const outPath = path.resolve(__dirname, '..', output);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = UglifyJS.minify(source, {
    compress: true,
    mangle: true
  });
  if (result.error) {
    console.error(`Failed to minify ${input}:`, result.error);
    process.exit(1);
  }
  fs.writeFileSync(outPath, `${result.code}\n`, 'utf8');
}
