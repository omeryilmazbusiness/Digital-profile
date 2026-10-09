import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Button } from "./button";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";
import { dismissToast, toast, Toaster } from "./toast";

function SheetExample(props: { onOpenChange?: (open: boolean) => void }) {
  return (
    <Sheet onOpenChange={props.onOpenChange}>
      <SheetTrigger asChild>
        <Button>Share</Button>
      </SheetTrigger>
      <SheetContent title="Share profile" description="Send it to a colleague">
        <p>Body</p>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  test("opens as a titled, described modal dialog", async () => {
    render(<SheetExample />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = screen.getByRole("dialog", { name: "Share profile" });
    expect(dialog).toHaveAccessibleDescription("Send it to a colleague");
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  test("closes with the close button and with Escape", async () => {
    render(<SheetExample />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("dragging the header down past the threshold dismisses it", async () => {
    const onOpenChange = vi.fn();
    render(<SheetExample onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const handle = screen.getByRole("heading", { name: "Share profile" }).closest(".touch-none")!;

    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const drag = (to: number, ms: number) => {
      now = 0;
      fireEvent.pointerDown(handle, { button: 0, clientY: 100, pointerId: 1 });
      now = ms;
      fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
    };

    drag(150, 500); // short and slow: springs back
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(handle.closest<HTMLElement>("[role=dialog]")!.style.transform).toBe("");

    drag(160, 40); // short but flung
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  test("dragging far enough dismisses even slowly", async () => {
    const onOpenChange = vi.fn();
    render(<SheetExample onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const handle = screen.getByRole("heading", { name: "Share profile" }).closest(".touch-none")!;
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    fireEvent.pointerDown(handle, { button: 0, clientY: 100, pointerId: 1 });
    now = 2000;
    fireEvent.pointerMove(handle, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("toast", () => {
  afterEach(() => vi.useRealTimers());

  test("shows a banner that can be dismissed", async () => {
    render(<Toaster />);
    let id = 0;
    act(() => {
      id = toast.success("Profile saved", { description: "Visible to everyone" });
    });
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(screen.getByText("Visible to everyone")).toBeInTheDocument();

    vi.useFakeTimers();
    act(() => dismissToast(id));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByText("Profile saved")).toBeNull();
  });

  test("keeps at most three banners", async () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      for (let i = 1; i <= 5; i++) toast(`Message ${i}`);
    });
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByText("Message 1")).toBeNull();
    expect(screen.queryByText("Message 2")).toBeNull();
    expect(screen.getByText("Message 5")).toBeInTheDocument();
  });
});
