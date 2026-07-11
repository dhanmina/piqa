/**
 * Rasterize the official Piqa logo kit (assets/brand/*.svg) into the PNGs
 * Expo's launcher/splash config requires. Artwork is the kit's, verbatim —
 * this only converts formats and sizes.
 *
 * Requires sharp (dev-only): npm i --no-save sharp && node scripts/build-icons.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kit = (p) => path.join(root, 'assets/brand', p);
const out = (p) => path.join(root, 'assets/images', p);

const jobs = [
  // Store / main app icon — rounded ink tile.
  { src: 'app/piqa-icon-512.svg', size: 1024, file: 'icon.png' },
  // Android adaptive layers (kit already frames the mark in the 66% safe zone).
  { src: 'app/piqa-adaptive-foreground.svg', size: 1024, file: 'android-icon-foreground.png' },
  { src: 'app/piqa-adaptive-background.svg', size: 1024, file: 'android-icon-background.png' },
  // Themed-icon monochrome layer — same silhouette; Android tints it by alpha.
  { src: 'app/piqa-adaptive-foreground.svg', size: 432, file: 'android-icon-monochrome.png' },
  // Splash — transparent mark; the splash background color comes from app.json.
  { src: 'mark/piqa-mark.svg', size: 512, file: 'splash-icon.png' },
  // Web favicon.
  { src: 'app/piqa-icon-512.svg', size: 96, file: 'favicon.png' },
];

for (const j of jobs) {
  await sharp(kit(j.src), { density: 512 }).resize(j.size, j.size).png().toFile(out(j.file));
  console.log('wrote', j.file, `${j.size}x${j.size}  <- ${j.src}`);
}
console.log('done');
