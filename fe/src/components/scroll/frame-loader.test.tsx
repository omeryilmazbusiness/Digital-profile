import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { FrameLoader } from "./frame-loader";

afterEach(() => vi.useRealTimers());

test("shows progress accessibly", () => {
  render(<FrameLoader progress={42.4} done={false} title="Sheraton" />);
  const bar = screen.getByRole("progressbar", { name: "Loading" });
  expect(bar).toHaveAttribute("aria-valuenow", "42");
  expect(screen.getByText("42%")).toBeInTheDocument();
  expect(screen.getByText("Sheraton")).toBeInTheDocument();
});

test("fades out, then unmounts once done", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<FrameLoader progress={90} done={false} title="S" />);
  rerender(<FrameLoader progress={100} done title="S" />);
  const curtain = container.querySelector("[data-frame-loader]");
  expect(curtain).toHaveAttribute("aria-hidden", "true");
  expect(curtain).toHaveClass("opacity-0", "pointer-events-none");

  act(() => vi.advanceTimersByTime(700));
  expect(container.querySelector("[data-frame-loader]")).toBeNull();
});
