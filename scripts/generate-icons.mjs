import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const iconsDir = path.join(root, 'public', 'icons');
const sourceSvgPath = path.join(iconsDir, 'icon.svg');

const SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512];

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readSourceSvg() {
  try {
    return await fs.readFile(sourceSvgPath);
  } catch {
    throw new Error(`Missing icon source SVG at: ${sourceSvgPath}`);
  }
}

function outPath(size) {
  return path.join(iconsDir, `icon-${size}.png`);
}

async function renderAllPngs(svgBuf) {
  await Promise.all(
    SIZES.map(async (size) => {
      const p = outPath(size);
      await sharp(svgBuf, { density: 384 })
        .resize(size, size, { fit: 'contain' })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true
        })
        .toFile(p);
    })
  );
}

async function main() {
  await ensureDir(iconsDir);
  const svgBuf = await readSourceSvg();
  await renderAllPngs(svgBuf);
}

await main();
