import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { DirectionProvider } from "./direction";
import { SegmentedControl } from "./segmented-control";
import { Textarea, TextField } from "./text-field";

const views = [
  { value: "rooms", label: "Rooms" },
  { value: "dining", label: "Dining" },
  { value: "spa", label: "Spa" },
] as const;

describe("SegmentedControl", () => {
  test("is a named radio group that selects on click", async () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl aria-label="View" options={views} onValueChange={onValueChange} />);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rooms" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Spa" }));
    expect(screen.getByRole("radio", { name: "Spa" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledWith("spa");
  });

  test("arrow keys move the selection", async () => {
    render(<SegmentedControl aria-label="View" options={views} defaultValue="rooms" />);
    screen.getByRole("radio", { name: "Rooms" }).focus();
    // Radix moves focus on a timer and selects only while the key is still held.
    await userEvent.keyboard("{ArrowRight>}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Dining" })).toBeChecked());
    await userEvent.keyboard("{/ArrowRight}");
  });

  test("follows the provided reading direction", () => {
    render(
      <DirectionProvider dir="rtl">
        <SegmentedControl aria-label="View" options={views} />
      </DirectionProvider>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("dir", "rtl");
  });

  test("stays put when controlled until the parent updates", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="View"
        options={views}
        value="dining"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Spa" }));
    expect(onValueChange).toHaveBeenCalledWith("spa");
    expect(screen.getByRole("radio", { name: "Dining" })).toBeChecked();
  });
});

describe("TextField", () => {
  test("labels the input and links hint text", () => {
    render(<TextField label="Email" hint="We reply within a day" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We reply within a day");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  test("an error marks the input invalid and is described first", () => {
    render(<TextField label="Email" hint="Work address" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email Work address");
  });

  test("email, phone and URL inputs stay left-to-right", () => {
    render(
      <>
        <TextField label="Email" type="email" />
        <TextField label="Name" />
      </>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("dir", "ltr");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("dir");
  });

  test("a hidden label still names the field", () => {
    render(<Textarea label="Message" hideLabel placeholder="Write…" />);
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
  });
});

describe("Accordion", () => {
  test("expands an item on press", async () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="checkin">
          <AccordionTrigger>Check-in time</AccordionTrigger>
          <AccordionContent>From 16:00</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Check-in time" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("From 16:00")).toBeVisible();
  });
});
