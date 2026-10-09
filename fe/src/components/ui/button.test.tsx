import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { describe, expect, test, vi } from "vitest";

import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Spinner } from "./spinner";

describe("Button", () => {
  test("is a non-submitting button by default", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("loading blocks presses and announces busy while keeping the label", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("asChild styles the child element", () => {
    render(
      <Button asChild variant="tinted">
        <a href="/contact">Contact</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Contact" });
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link.className).toContain("bg-tint/15");
    expect(link.className).toContain("text-tint");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("variants map to tokens", () => {
    render(
      <Button variant="destructive" size="lg" shape="rounded" block>
        Delete
      </Button>,
    );
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("bg-system-red");
    expect(cls).toContain("w-full");
    expect(cls).toContain("rounded-[0.875rem]");
  });
});

describe("IconButton", () => {
  test("requires and exposes an accessible name", () => {
    render(
      <IconButton label="Add photo">
        <Plus aria-hidden />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Add photo" })).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  test("announces its label", () => {
    render(<Spinner label="Uploading" />);
    expect(screen.getByRole("status", { name: "Uploading" })).toBeInTheDocument();
  });

  test("is hidden from assistive technology without a label", () => {
    const { container } = render(<Spinner label={null} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
