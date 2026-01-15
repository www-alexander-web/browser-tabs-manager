import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const iconsDir = path.join(root, 'public', 'icons');

// A tiny valid PNG (1x1). Placeholder icons for dev/scaffold purposes.
// Source: generated once and embedded here to avoid binary files in repo edits.
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Wj9kAAAAASUVORK5CYII=';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(filePath, buf) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, buf);
}

ensureDir(iconsDir);
const buf = Buffer.from(PNG_1x1_BASE64, 'base64');

writeIfMissing(path.join(iconsDir, 'icon16.png'), buf);
writeIfMissing(path.join(iconsDir, 'icon32.png'), buf);
writeIfMissing(path.join(iconsDir, 'icon48.png'), buf);
writeIfMissing(path.join(iconsDir, 'icon128.png'), buf);
