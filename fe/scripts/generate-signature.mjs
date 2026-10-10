#!/usr/bin/env node
// Turns names into handwriting-ready SVG outlines: each text is shaped with HarfBuzz (so Arabic
// joins correctly), and every glyph becomes a path with its outline length, listed in writing
// order. The page animates these, so no font is downloaded at runtime.
//
// Usage: node scripts/generate-signature.mjs   (run from fe/; rewrites the manifests below)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as hb from "harfbuzzjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One manifest per file; one signature per language. Each line is written in turn; lines are
 * centered. `variations` pins the axes of a variable font (e.g. "wght=500"); `features` sets
 * OpenType features (e.g. "-liga": letters spaced apart shouldn't join); `tracking` spaces the
 * letters, in em; `accent` marks the glyphs of a part of one line, which the page can set apart
 * (e.g. in another color).
 */
const OUTPUTS = [
  {
    file: "src/features/home/hotel-signature.gen.ts",
    name: "hotelSignatures",
    signatures: [
      {
        lang: "en",
        font: "assets/fonts/sacramento/Sacramento-Regular.ttf",
        lines: ["Sheraton Makkah", "Jabal Al Kaaba"],
        lineHeight: 0.95,
      },
      {
        lang: "ar",
        font: "assets/fonts/aref-ruqaa/ArefRuqaa-Regular.ttf",
        lines: ["شيراتون مكة", "جبل الكعبة"],
        lineHeight: 1.3,
      },
    ],
  },
  {
    file: "src/features/profile/profile-signature.gen.ts",
    name: "profileSignatures",
    signatures: [
      {
        lang: "en",
        font: "assets/fonts/inter/Inter-wght.ttf",
        variations: ["wght=600", "opsz=32"],
        features: ["-liga"],
        tracking: -0.01,
        lines: ["Momen Tawfiq", "Alkiswani"],
        lineHeight: 1.1,
        accent: "omen Tawfi",
      },
    ],
  },
];

/** Output units per em. */
const EM = 100;
const PADDING = 0.12 * EM;

const round = (n) => Math.round(n * 10) / 10 || 0;
/** Shortest SVG number: no leading zero. */
const num = (n) => String(n).replace(/^(-?)0\./, "$1.");
/** Space before a number unless its minus sign separates it (or it opens a command). */
const sep = (n, preceding = " ") => (preceding === "" || n < 0 ? "" : " ");

async function loadFont(file, variations = []) {
  const data = await readFile(path.join(root, file));
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  if (variations.length > 0) font.setVariations(variations.map((v) => hb.Variation.fromString(v)));
  return { font, scale: EM / face.upem };
}

/** Shapes a line and returns its glyphs in logical (writing) order, positioned from x = 0. */
function shapeLine(font, scale, text, { features = [], tracking = 0 } = {}) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(
    font,
    buffer,
    features.map((f) => hb.Feature.fromString(f)),
  );
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();

  let pen = 0;
  const placed = infos.map((info, i) => {
    const p = positions[i];
    const glyph = {
      id: info.codepoint,
      cluster: info.cluster,
      x: (pen + p.xOffset) * scale,
      y: p.yOffset * scale,
    };
    pen += p.xAdvance + (i < infos.length - 1 ? (tracking * EM) / scale : 0);
    return glyph;
  });
  // HarfBuzz returns right-to-left runs in visual order; the pen writes in logical order.
  placed.sort((a, b) => a.cluster - b.cluster);
  return { glyphs: placed, width: pen * scale };
}

/** Converts a glyph outline to page coordinates (y down) and measures its length. */
function outline(font, scale, glyph, dx, baseline) {
  const commands = font.glyphToJson(glyph.id);
  if (commands.length === 0) return null;

  const points = [];
  let d = "";
  let length = 0;
  let start = null;
  let last = null;
  // Snapped to the output grid first, so relative steps add up without drift.
  const at = (x, y) => [round(dx + glyph.x + x * scale), round(baseline - glyph.y - y * scale)];
  const step = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // The pen position the previous command left, for relative coordinates.
  let pen = [0, 0];

  for (const { type, values } of commands) {
    const pts = [];
    for (let i = 0; i < values.length; i += 2) pts.push(at(values[i], values[i + 1]));
    points.push(...pts);
    if (type === "Z") {
      d += "z";
      pen = start ?? pen;
    } else if (d === "") {
      d += "M" + pts.map(([x, y]) => num(x) + sep(y) + num(y)).join("");
      pen = pts.at(-1);
    } else {
      let out = "";
      for (const [x, y] of pts) {
        const rx = round(x - pen[0]);
        const ry = round(y - pen[1]);
        out += sep(rx, out) + num(rx) + sep(ry) + num(ry);
      }
      d += type.toLowerCase() + out;
      pen = pts.at(-1);
    }

    if (type === "M") {
      start = last = pts[0];
    } else if (type === "Z") {
      if (last && start) length += step(last, start);
      last = start;
    } else if (last) {
      // Curves are measured as polylines; precise enough for pacing the pen.
      const ctrl = [last, ...pts];
      let prev = last;
      for (let t = 1; t <= 8; t++) {
        const s = t / 8;
        const p = bezier(ctrl, s);
        length += step(prev, p);
        prev = p;
      }
      last = pts.at(-1);
    }
  }
  return { d, length: round(length), points };
}

function bezier(ctrl, t) {
  let pts = ctrl;
  while (pts.length > 1) {
    pts = pts
      .slice(1)
      .map((p, i) => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]);
  }
  return pts[0];
}

async function build({
  lang,
  font: file,
  variations,
  features,
  tracking,
  lines,
  lineHeight,
  accent,
}) {
  const { font, scale } = await loadFont(file, variations);
  const shaped = lines.map((text) => shapeLine(font, scale, text, { features, tracking }));
  const width = Math.max(...shaped.map((l) => l.width));
  const accentLine = accent ? lines.findIndex((text) => text.includes(accent)) : -1;
  if (accent && accentLine < 0) throw new Error(`"${accent}" is in none of ${lines.join(" / ")}`);
  const accentFrom = accentLine < 0 ? 0 : lines[accentLine].indexOf(accent);
  const accentTo = accentFrom + (accent?.length ?? 0);

  const glyphs = [];
  const all = [];
  shaped.forEach((line, i) => {
    const dx = (width - line.width) / 2;
    const baseline = i * lineHeight * EM;
    for (const glyph of line.glyphs) {
      const o = outline(font, scale, glyph, dx, baseline);
      if (!o) continue;
      const accented = i === accentLine && glyph.cluster >= accentFrom && glyph.cluster < accentTo;
      glyphs.push({ d: o.d, length: o.length, ...(accented ? { accent: true } : {}) });
      all.push(...o.points);
    }
  });

  // Tight box around the ink, so the art centers optically.
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const viewBox = [
    round(minX),
    round(minY),
    round(Math.max(...xs) + PADDING - minX),
    round(Math.max(...ys) + PADDING - minY),
  ];
  return { lang, dir: lang === "ar" ? "rtl" : "ltr", text: lines.join(" "), viewBox, glyphs };
}

for (const output of OUTPUTS) {
  const signatures = await Promise.all(output.signatures.map(build));
  const body = `// Generated by scripts/generate-signature.mjs — do not edit.
import type { Signature } from "@/components/signature/handwriting";

export const ${output.name}: readonly Signature[] = ${JSON.stringify(signatures)};
`;
  await writeFile(path.join(root, output.file), body);
  for (const s of signatures) {
    const bytes = s.glyphs.reduce((n, g) => n + g.d.length, 0);
    console.log(
      `${output.name} ${s.lang}: ${s.glyphs.length} glyphs, ${(bytes / 1024).toFixed(1)} KB of paths`,
    );
  }
}
