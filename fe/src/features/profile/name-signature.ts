import { readFile } from "node:fs/promises";
import path from "node:path";

import { cacheLife } from "next/cache";

import type { Signature, SignatureGlyph } from "@/components/signature/handwriting";

/**
 * The name typed in the admin panel as handwriting-ready glyph outlines, set like the built-in
 * signature (scripts/generate-signature.mjs): the leading words on a first, accented line (the
 * white one over the portrait), the last word beneath. Shaped with HarfBuzz on the server, so
 * Arabic joins correctly and the page still downloads no font.
 *
 * Undefined when the name is empty or its font lacks one of its letters; the page then sets
 * the name as text instead.
 */
export async function nameSignature(name: string, lang: string): Promise<Signature | undefined> {
  "use cache";
  cacheLife("max");

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  const arabic = ARABIC.test(name);
  const style = arabic ? ARABIC_STYLE : LATIN_STYLE;
  try {
    return await build(splitLines(words), style, lang, arabic ? "rtl" : "ltr");
  } catch (error) {
    console.error("name signature:", error);
    return undefined;
  }
}

/** Two lines as even as possible, the first one never the shorter: "Momen Tawfiq / Alkiswani". */
export function splitLines(words: readonly string[]): string[] {
  if (words.length < 2) return [...words];
  let best = 1;
  let bestLength = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ").length;
    const second = words.slice(i).join(" ").length;
    const longest = Math.max(first, second);
    if (longest < bestLength || (longest === bestLength && first >= second)) {
      best = i;
      bestLength = longest;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/;

interface Style {
  /** Under assets/fonts. */
  font: string;
  variations?: readonly string[];
  features?: readonly string[];
  /** Letter spacing, in em. */
  tracking?: number;
  lineHeight: number;
}

const LATIN_STYLE: Style = {
  font: "inter/Inter-wght.ttf",
  variations: ["wght=600", "opsz=32"],
  features: ["-liga"],
  tracking: -0.01,
  lineHeight: 1.1,
};

const ARABIC_STYLE: Style = {
  font: "ibm-plex-sans-arabic/IBMPlexSansArabic-SemiBold.ttf",
  lineHeight: 1.25,
};

/** Output units per em. */
const EM = 100;
const PADDING = 0.12 * EM;

type HarfBuzz = typeof import("harfbuzzjs");
type Font = InstanceType<HarfBuzz["Font"]>;
type Point = [number, number];

let harfbuzz: Promise<HarfBuzz> | undefined;
const fonts = new Map<string, Promise<{ hb: HarfBuzz; font: Font; scale: number }>>();

function loadFont(style: Style) {
  let loaded = fonts.get(style.font);
  if (!loaded) {
    loaded = (async () => {
      harfbuzz ??= import("harfbuzzjs");
      const hb = await harfbuzz;
      const data = await readFile(path.join(process.cwd(), "assets", "fonts", style.font));
      const face = new hb.Face(new hb.Blob(data));
      const font = new hb.Font(face);
      const variations = (style.variations ?? []).map((v) => hb.Variation.fromString(v)!);
      if (variations.length > 0) font.setVariations(variations);
      return { hb, font, scale: EM / face.upem };
    })();
    // A failed load (e.g. a missing file) is retried next time rather than remembered.
    loaded.catch(() => fonts.delete(style.font));
    fonts.set(style.font, loaded);
  }
  return loaded;
}

interface Placed {
  id: number;
  cluster: number;
  x: number;
  y: number;
}

async function build(
  lines: readonly string[],
  style: Style,
  lang: string,
  dir: Signature["dir"],
): Promise<Signature | undefined> {
  const { hb, font, scale } = await loadFont(style);
  const features = (style.features ?? []).map((f) => hb.Feature.fromString(f)!);

  const shaped = lines.map((text) => {
    const buffer = new hb.Buffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer, features);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    let pen = 0;
    const glyphs: Placed[] = infos.map((info, i) => {
      const p = positions[i]!;
      const glyph = {
        id: info.codepoint,
        cluster: info.cluster,
        x: (pen + p.xOffset) * scale,
        y: p.yOffset * scale,
      };
      pen += p.xAdvance + (i < infos.length - 1 ? ((style.tracking ?? 0) * EM) / scale : 0);
      return glyph;
    });
    // HarfBuzz returns right-to-left runs in visual order; the pen writes in logical order.
    glyphs.sort((a, b) => a.cluster - b.cluster);
    return { glyphs, width: pen * scale };
  });
  // Glyph 0 is .notdef: the font can't write one of the letters.
  if (shaped.some((line) => line.glyphs.some((g) => g.id === 0))) return undefined;

  const width = Math.max(...shaped.map((line) => line.width));
  const glyphs: SignatureGlyph[] = [];
  const all: Point[] = [];
  shaped.forEach((line, i) => {
    const dx = (width - line.width) / 2;
    const baseline = i * style.lineHeight * EM;
    for (const glyph of line.glyphs) {
      const o = outline(font, scale, glyph, dx, baseline);
      if (!o) continue;
      glyphs.push({ d: o.d, length: o.length, ...(i === 0 ? { accent: true } : {}) });
      all.push(...o.points);
    }
  });
  if (all.length === 0) return undefined;

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
  return { lang, dir, text: lines.join(" "), viewBox, glyphs };
}

const round = (n: number) => Math.round(n * 10) / 10 || 0;
/** Shortest SVG number: no leading zero. */
const num = (n: number) => String(n).replace(/^(-?)0\./, "$1.");
/** Space before a number unless its minus sign separates it (or it opens a command). */
const sep = (n: number, preceding = " ") => (preceding === "" || n < 0 ? "" : " ");

/** Converts a glyph outline to page coordinates (y down) and measures its length. */
function outline(font: Font, scale: number, glyph: Placed, dx: number, baseline: number) {
  const commands = font.glyphToJson(glyph.id);
  if (commands.length === 0) return null;

  const points: Point[] = [];
  let d = "";
  let length = 0;
  let start: Point | null = null;
  let last: Point | null = null;
  // Snapped to the output grid first, so relative steps add up without drift.
  const at = (x: number, y: number): Point => [
    round(dx + glyph.x + x * scale),
    round(baseline - glyph.y - y * scale),
  ];
  const step = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // The pen position the previous command left, for relative coordinates.
  let pen: Point = [0, 0];

  for (const { type, values } of commands) {
    const pts: Point[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) pts.push(at(values[i]!, values[i + 1]!));
    points.push(...pts);
    if (type === "Z") {
      d += "z";
      pen = start ?? pen;
    } else if (d === "") {
      d += "M" + pts.map(([x, y]) => num(x) + sep(y) + num(y)).join("");
      pen = pts.at(-1) ?? pen;
    } else {
      let out = "";
      for (const [x, y] of pts) {
        const rx = round(x - pen[0]);
        const ry = round(y - pen[1]);
        out += sep(rx, out) + num(rx) + sep(ry) + num(ry);
      }
      d += type.toLowerCase() + out;
      pen = pts.at(-1) ?? pen;
    }

    if (type === "M") {
      start = last = pts[0] ?? null;
    } else if (type === "Z") {
      if (last && start) length += step(last, start);
      last = start;
    } else if (last) {
      // Curves are measured as polylines; precise enough for pacing the pen.
      const ctrl = [last, ...pts];
      let prev = last;
      for (let t = 1; t <= 8; t++) {
        const p = bezier(ctrl, t / 8);
        length += step(prev, p);
        prev = p;
      }
      last = pts.at(-1) ?? last;
    }
  }
  return { d, length: round(length), points };
}

function bezier(ctrl: readonly Point[], t: number): Point {
  let pts = ctrl;
  while (pts.length > 1) {
    pts = pts
      .slice(1)
      .map((p, i): Point => [
        pts[i]![0] + (p[0] - pts[i]![0]) * t,
        pts[i]![1] + (p[1] - pts[i]![1]) * t,
      ]);
  }
  return pts[0]!;
}
