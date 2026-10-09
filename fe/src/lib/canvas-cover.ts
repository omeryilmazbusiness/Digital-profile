export interface SourceRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/**
 * The part of a source image that fills a destination like CSS `object-fit: cover`: the
 * largest region with the destination's aspect ratio, positioned by focus (0–1 per axis,
 * 0.5 = centered). Cropping the source, rather than drawing an oversized image, keeps
 * drawImage from touching pixels that are never seen.
 */
export function coverRect(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  focusX = 0.5,
  focusY = 0.5,
): SourceRect {
  if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) {
    return { sx: 0, sy: 0, sWidth: Math.max(0, srcWidth), sHeight: Math.max(0, srcHeight) };
  }
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
  const sWidth = Math.min(srcWidth, dstWidth / scale);
  const sHeight = Math.min(srcHeight, dstHeight / scale);
  return {
    sx: (srcWidth - sWidth) * clamp01(focusX),
    sy: (srcHeight - sHeight) * clamp01(focusY),
    sWidth,
    sHeight,
  };
}

/** Canvas backing-store size for a CSS size, capped at maxDpr: beyond 2× the cost outgrows the gain. */
export function backingSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxDpr = 2,
): { width: number; height: number } {
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), maxDpr);
  return { width: Math.round(cssWidth * dpr), height: Math.round(cssHeight * dpr) };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
