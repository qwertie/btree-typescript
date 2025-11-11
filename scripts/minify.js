#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');

const rootDir = path.resolve(__dirname, '..');
const extendedDir = path.join(rootDir, 'extended');

function extendedTargets() {
  try {
    return fs
      .readdirSync(extendedDir)
      .filter((file) => file.endsWith('.js') && !file.endsWith('.min.js'))
      .map((file) => {
        const relative = path.join('extended', file);
        const output = path.join('extended', file.replace(/\.js$/, '.min.js'));
        return { input: relative, output };
      });
  } catch (err) {
    console.error(`Failed to read ${extendedDir}:`, err.message);
    process.exit(1);
  }
}

const targets = [{ input: 'b+tree.js', output: 'b+tree.min.js' }, ...extendedTargets()];

for (const { input, output } of targets) {
  const sourcePath = path.resolve(rootDir, input);
  const outPath = path.resolve(rootDir, output);
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
