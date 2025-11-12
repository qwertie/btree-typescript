const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.resolve(__dirname, '..');
const extendedDir = path.join(rootDir, 'extended');

function discoverExtendedEntries() {
  try {
    return fs
      .readdirSync(extendedDir)
      .filter((file) => file.endsWith('.js') && !file.endsWith('.min.js'))
      .sort()
      .map((file) => {
        const base = file.replace(/\.js$/, '');
        const display = `extended/${base}`;
        const raw = path.join('extended', file);
        const min = path.join('extended', `${base}.min.js`);
        return { name: display, raw, min };
      });
  } catch (err) {
    console.error(`Cannot read ${extendedDir}: ${err.message}`);
    process.exitCode = 1;
    return [];
  }
}

const entryPoints = [{ name: 'btree', raw: 'b+tree.js', min: 'b+tree.min.js' }, ...discoverExtendedEntries()];
const nameColumnWidth =
  Math.max('Entry'.length, ...entryPoints.map((entry) => entry.name.length)) + 2;

function fileSize(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  try {
    return fs.statSync(filePath).size;
  } catch (err) {
    console.error(`Cannot read ${relativePath}: ${err.message}`);
    process.exitCode = 1;
    return null;
  }
}

function gzipSize(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  try {
    const buffer = fs.readFileSync(filePath);
    return zlib.gzipSync(buffer).length;
  } catch (err) {
    console.error(`Cannot gzip ${relativePath}: ${err.message}`);
    process.exitCode = 1;
    return null;
  }
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number') return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function pad(str, length) {
  const text = String(str);
  return text.length >= length ? `${text} ` : text.padEnd(length + 1, ' ');
}

const header =
  pad('Entry', nameColumnWidth) +
  pad('Raw Size', 13) +
  pad('Minified', 13) +
  'Gzipped';
console.log(header);
console.log('-'.repeat(header.length));

const nonCoreTotals = { raw: 0, min: 0, gz: 0 };
const nonCoreHasValue = { raw: false, min: false, gz: false };

entryPoints.forEach((entry, index) => {
  const raw = fileSize(entry.raw);
  const min = fileSize(entry.min);
  const gz = gzipSize(entry.min);
  const line =
    pad(entry.name, nameColumnWidth) +
    pad(formatBytes(raw), 13) +
    pad(formatBytes(min), 13) +
    formatBytes(gz);
  console.log(line);
  if (index > 0) {
    if (typeof raw === 'number') {
      nonCoreTotals.raw += raw;
      nonCoreHasValue.raw = true;
    }
    if (typeof min === 'number') {
      nonCoreTotals.min += min;
      nonCoreHasValue.min = true;
    }
    if (typeof gz === 'number') {
      nonCoreTotals.gz += gz;
      nonCoreHasValue.gz = true;
    }
  }
});

if (entryPoints.length > 1) {
  const line =
    pad('Non-core total', nameColumnWidth) +
    pad(nonCoreHasValue.raw ? formatBytes(nonCoreTotals.raw) : 'n/a', 13) +
    pad(nonCoreHasValue.min ? formatBytes(nonCoreTotals.min) : 'n/a', 13) +
    (nonCoreHasValue.gz ? formatBytes(nonCoreTotals.gz) : 'n/a');
  console.log('-'.repeat(header.length));
  console.log(line);
}

if (process.exitCode) {
  process.exit(1);
}
