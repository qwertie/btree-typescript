#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.resolve(__dirname, '..');
const entryPoints = [
  { name: 'btree', raw: 'b+tree.js', min: 'b+tree.min.js' },
  { name: 'btreeex', raw: path.join('extended', 'index.js'), min: path.join('extended', 'index.min.js') },
  { name: 'diffAgainst', raw: path.join('extended', 'diffAgainst.js'), min: path.join('extended', 'diffAgainst.min.js') }
];

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

console.log('Entry        Raw Size     Minified     Gzipped');
console.log('-----------------------------------------------');

for (const entry of entryPoints) {
  const raw = fileSize(entry.raw);
  const min = fileSize(entry.min);
  const gz = gzipSize(entry.min);
  const line =
    pad(entry.name, 12) +
    pad(formatBytes(raw), 13) +
    pad(formatBytes(min), 13) +
    formatBytes(gz);
  console.log(line);
}

if (process.exitCode) {
  process.exit(1);
}
