#!/usr/bin/env node
// Prepares the profile portrait for a white page: lifts the studio's near-white backdrop (and
// its darker corners) to pure white without touching the subject, then writes the sizes the
// site uses — responsive WebP with the edges dissolved into white, the mask that turns the
// name white over the photo, a small avatar, the sharing image and the square vCard photo.
//
// Usage: node scripts/prepare-portrait.mjs   (run from fe/; source in assets/portraits/)

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "assets/portraits/momen.jpg");
const OUT = path.join(root, "public/profile");
const NAME = "momen";
const VCARD_PHOTO = "src/features/profile/vcard-photo.gen.ts";

/** Portrait widths for srcset (keep in sync with the profile content). */
const WIDTHS = [560, 840, 1049];
/** Face crop (source pixels) for square images: head and shoulders. */
const FACE = { left: 250, top: 40, width: 560, height: 560 };

const smoothstep = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/**
 * The backdrop: bright, colorless pixels reachable from the top and side edges. The bottom
 * edge is left out — the white shirt cuff touches it — and the shirt itself is walled in by
 * the suit. Returns a 0–1 mask, feathered so the cut-out has no hard rim.
 */
function backdropMask(data, width, height) {
  const isBackdrop = (p) => {
    const i = p * 3;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    return min > 205 && max - min < 24;
  };
  const seen = new Uint8Array(width * height);
  const queue = [];
  const seed = (x, y) => {
    const p = y * width + x;
    if (!seen[p] && isBackdrop(p)) {
      seen[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) seed(x, 0);
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (queue.length > 0) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
  return feather(Float32Array.from(seen), width, height, 3);
}

/** Box blur, horizontal then vertical. */
function feather(mask, width, height, radius) {
  const pass = (src, horizontal) => {
    const out = new Float32Array(src.length);
    const [n, m] = horizontal ? [height, width] : [width, height];
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < m; b++) {
        let sum = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const c = b + k;
          if (c < 0 || c >= m) continue;
          sum += src[horizontal ? a * width + c : c * width + a];
          count++;
        }
        out[horizontal ? a * width + b : b * width + a] = sum / count;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

async function whiten() {
  const { data, info } = await sharp(SOURCE)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const backdrop = backdropMask(data, info.width, info.height);
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    // Near-white and colorless anywhere also lifts a little: the studio's soft falloff.
    const lift = smoothstep(218, 242, min) * (1 - smoothstep(8, 20, Math.max(r, g, b) - min));
    const t = Math.max(lift, backdrop[p]);
    data[i] = r + (255 - r) * t;
    data[i + 1] = g + (255 - g) * t;
    data[i + 2] = b + (255 - b) * t;
  }
  return sharp(data, { raw: info }).toColourspace("srgb").png().toBuffer();
}

/**
 * Dissolves the frame's edges into white — the cropped arms at the bottom most of all — so
 * the page portrait has no edge at all. Baked into the pixels rather than a CSS mask: Chrome
 * leaves a hairline under composited two-layer masks.
 */
async function dissolveEdges(input) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    // The suit stays dark where the white part of the name's first line crosses it.
    const vertical = smoothstep(0, 0.05, v) * (1 - smoothstep(0.93, 1, v));
    for (let x = 0; x < width; x++) {
      const h = x / (width - 1);
      const keep = vertical * smoothstep(0, 0.13, h) * (1 - smoothstep(0.87, 1, h));
      const i = (y * width + x) * channels;
      for (let c = 0; c < 3; c++) data[i + c] = 255 - (255 - data[i + c]) * keep;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

await mkdir(OUT, { recursive: true });
const clean = await whiten();
const page = await dissolveEdges(clean);
const outputs = [];

for (const width of WIDTHS) {
  const file = `${NAME}-${width}.webp`;
  await sharp(page)
    .resize({ width })
    .webp({ quality: 84, smartSubsample: true })
    .toFile(path.join(OUT, file));
  outputs.push(file);
}

await sharp(clean)
  .extract(FACE)
  .resize(160, 160)
  .webp({ quality: 82 })
  .toFile(path.join(OUT, `${NAME}-avatar.webp`));
outputs.push(`${NAME}-avatar.webp`);

// iOS and Android import vCard photos reliably as JPEG. Embedded in the server code, so the
// card needs no file access at runtime.
const vcardPhoto = await sharp(clean)
  .extract(FACE)
  .resize(512, 512)
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
await writeFile(
  path.join(root, VCARD_PHOTO),
  `// Generated by scripts/prepare-portrait.mjs — do not edit.\n` +
    `/** Base64 512×512 JPEG for the contact card. */\n` +
    `export const vcardPhoto = "${vcardPhoto.toString("base64")}";\n`,
);
console.log(`${VCARD_PHOTO} ${(vcardPhoto.length / 1024).toFixed(1)} KB JPEG`);

const og = await sharp(clean).resize({ height: 630 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ffffff" } })
  .composite([{ input: og, gravity: "centre" }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(OUT, `${NAME}-og.jpg`));
outputs.push(`${NAME}-og.jpg`);

for (const file of outputs) {
  const { size } = await stat(path.join(OUT, file));
  console.log(`public/profile/${file} ${(size / 1024).toFixed(1)} KB`);
}
