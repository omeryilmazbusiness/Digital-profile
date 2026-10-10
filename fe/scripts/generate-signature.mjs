#!/usr/bin/env node
// Turns the hotel name into handwriting-ready SVG outlines: each text is shaped with HarfBuzz
// (so Arabic joins correctly), and every glyph becomes a path with its outline length, listed
// in writing order. The page animates these, so no font is downloaded at runtime.
//
// Usage: node scripts/generate-signature.mjs   (run from fe/; rewrites the manifest below)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as hb from "harfbuzzjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = "src/features/home/hotel-signature.gen.ts";

/** One entry per language. Each line is written in turn; lines are centered. */
const SIGNATURES = [
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
];

/** Output units per em. */
const EM = 100;
const PADDING = 0.12 * EM;

const round = (n) => Math.round(n * 10) / 10 || 0;
/** Shortest SVG number: no leading zero. */
const num = (n) => String(n).replace(/^(-?)0\./, "$1.");
/** Space before a number unless its minus sign separates it (or it opens a command). */
const sep = (n, preceding = " ") => (preceding === "" || n < 0 ? "" : " ");

async function loadFont(file) {
  const data = await readFile(path.join(root, file));
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  return { font, scale: EM / face.upem };
}

/** Shapes a line and returns its glyphs in logical (writing) order, positioned from x = 0. */
function shapeLine(font, scale, text) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
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
    pen += p.xAdvance;
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

async function build({ lang, font: file, lines, lineHeight }) {
  const { font, scale } = await loadFont(file);
  const shaped = lines.map((text) => shapeLine(font, scale, text));
  const width = Math.max(...shaped.map((l) => l.width));

  const glyphs = [];
  const all = [];
  shaped.forEach((line, i) => {
    const dx = (width - line.width) / 2;
    const baseline = i * lineHeight * EM;
    for (const glyph of line.glyphs) {
      const o = outline(font, scale, glyph, dx, baseline);
      if (!o) continue;
      glyphs.push({ d: o.d, length: o.length });
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

const signatures = await Promise.all(SIGNATURES.map(build));
const body = `// Generated by scripts/generate-signature.mjs — do not edit.
import type { Signature } from "@/components/signature/handwriting";

export const hotelSignatures: readonly Signature[] = ${JSON.stringify(signatures)};
`;
await writeFile(path.join(root, OUTPUT), body);
for (const s of signatures) {
  const bytes = s.glyphs.reduce((n, g) => n + g.d.length, 0);
  console.log(`${s.lang}: ${s.glyphs.length} glyphs, ${(bytes / 1024).toFixed(1)} KB of paths`);
}
