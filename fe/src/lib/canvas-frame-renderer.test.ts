import { beforeEach, expect, test, vi } from "vitest";

import { CanvasFrameRenderer } from "./canvas-frame-renderer";

type Img = CanvasImageSource & { naturalWidth: number; naturalHeight: number; id: string };

const img = (id: string): Img =>
  ({ id, naturalWidth: 1600, naturalHeight: 1200 }) as unknown as Img;

let drawImage: ReturnType<typeof vi.fn>;
let canvas: HTMLCanvasElement;

beforeEach(() => {
  drawImage = vi.fn();
  canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
});

test("paints the current frame, cropped to cover, only when it changes", () => {
  const frames: (Img | null)[] = [img("a"), img("b"), null];
  const r = new CanvasFrameRenderer(canvas, () => frames);

  r.resize(960, 540, 2);
  expect(canvas.width).toBe(1920);
  expect(canvas.height).toBe(1080);
  expect(drawImage).toHaveBeenLastCalledWith(frames[0], 0, 150, 1600, 900, 0, 0, 1920, 1080);

  r.setFrame(0);
  expect(drawImage).toHaveBeenCalledTimes(1);

  r.setFrame(1);
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(drawImage.mock.lastCall?.[0]).toBe(frames[1]);

  // Frame 2 is not loaded: the nearest one (1) is already on screen.
  r.setFrame(2);
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(r.frame).toBe(2);
});

test("resizing repaints; an unchanged size does not", () => {
  const frames = [img("a")];
  const r = new CanvasFrameRenderer(canvas, () => frames);
  r.resize(100, 100, 1);
  r.resize(100, 100, 1);
  expect(drawImage).toHaveBeenCalledTimes(1);
  r.resize(200, 100, 1);
  expect(drawImage).toHaveBeenCalledTimes(2);
});

test("nothing is painted before any frame loads or at zero size", () => {
  const frames: (Img | null)[] = [null];
  const r = new CanvasFrameRenderer(canvas, () => frames);
  r.resize(100, 100, 1);
  expect(drawImage).not.toHaveBeenCalled();
  frames[0] = img("a");
  r.resize(0, 0, 1);
  expect(drawImage).not.toHaveBeenCalled();
});
