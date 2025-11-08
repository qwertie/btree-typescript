const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const uglify = require('uglify-js');

const targets = [
  { label: 'core', file: path.resolve(__dirname, '../core/index.js') },
  { label: 'extended', file: path.resolve(__dirname, '../extended/index.js') },
  { label: 'algorithms', file: path.resolve(__dirname, '../algorithms/index.js') },
  { label: 'full', file: path.resolve(__dirname, '../b+tree.js') }
];

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function measure(file) {
  const source = fs.readFileSync(file, 'utf8');
  const minified = uglify.minify(source, { compress: true, mangle: true });
  if (minified.error) {
    throw minified.error;
  }
  const raw = Buffer.from(source, 'utf8');
  const min = Buffer.from(minified.code || '', 'utf8');
  const gzip = (buf) => zlib.gzipSync(buf, { level: zlib.constants.Z_BEST_COMPRESSION });
  return {
    raw: raw.length,
    rawGzip: gzip(raw).length,
    min: min.length,
    minGzip: gzip(min).length
  };
}

const rows = targets.map(({ label, file }) => {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}. Did you run \`npm run build\`?`);
  }
  const stats = measure(file);
  return {
    target: label,
    'raw size': formatBytes(stats.raw),
    'raw gzip': formatBytes(stats.rawGzip),
    'min size': formatBytes(stats.min),
    'min gzip': formatBytes(stats.minGzip)
  };
});

console.table(rows);
