import { backingSize, coverRect } from "@/lib/canvas-cover";
import { nearestLoaded } from "@/lib/frame-sequence";

export interface Focus {
  /** 0–1 per axis; 0.5 centers the crop. */
  x: number;
  y: number;
}

type Frame = CanvasImageSource & { naturalWidth: number; naturalHeight: number };

/**
 * Paints frames of an image sequence onto a canvas, cropped like `object-fit: cover` at the
 * device pixel ratio. Only paints when the visible image actually changes, so it can be
 * called on every scroll tick. Frames still loading are replaced by the nearest loaded one.
 */
export class CanvasFrameRenderer<T extends Frame = HTMLImageElement> {
  private readonly ctx: CanvasRenderingContext2D | null;
  private index = 0;
  private painted: T | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly frames: () => readonly (T | null)[],
    private readonly focus: Focus = { x: 0.5, y: 0.5 },
  ) {
    // Opaque canvas: the browser can skip compositing with what is behind it.
    this.ctx = canvas.getContext("2d", { alpha: false });
  }

  get frame(): number {
    return this.index;
  }

  /** Matches the backing store to the canvas' CSS size, then repaints. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    const { width, height } = backingSize(cssWidth, cssHeight, devicePixelRatio);
    if (width === this.canvas.width && height === this.canvas.height && this.painted) return;
    this.canvas.width = width;
    this.canvas.height = height;
    // Resizing clears the canvas and resets the context state.
    this.painted = null;
    this.paint();
  }

  setFrame(index: number): void {
    this.index = index;
    this.paint();
  }

  /** Paints the current frame if it differs from what is on screen. */
  paint(): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const img = nearestLoaded(this.frames(), this.index);
    if (!ctx || !img || img === this.painted || width === 0 || height === 0) return;
    const r = coverRect(
      img.naturalWidth,
      img.naturalHeight,
      width,
      height,
      this.focus.x,
      this.focus.y,
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, r.sx, r.sy, r.sWidth, r.sHeight, 0, 0, width, height);
    this.painted = img;
  }
}
