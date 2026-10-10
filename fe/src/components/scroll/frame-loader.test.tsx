import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { FrameLoader } from "./frame-loader";

afterEach(() => vi.useRealTimers());

test("shows progress accessibly", () => {
  render(<FrameLoader progress={42.4} done={false} />);
  const bar = screen.getByRole("progressbar", { name: "Loading" });
  expect(bar).toHaveAttribute("aria-valuenow", "42");
  expect(screen.getByText("42%")).toBeInTheDocument();
});

test("fades out, then unmounts once done", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<FrameLoader progress={90} done={false} />);
  rerender(<FrameLoader progress={100} done />);
  const loader = container.querySelector("[data-frame-loader]");
  expect(loader).toHaveAttribute("aria-hidden", "true");
  expect(loader).toHaveClass("opacity-0");

  act(() => vi.advanceTimersByTime(700));
  expect(container.querySelector("[data-frame-loader]")).toBeNull();
});
