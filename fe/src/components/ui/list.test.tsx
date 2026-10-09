import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe } from "lucide-react";
import { expect, test, vi } from "vitest";

import { ListIcon, ListItem, ListSection } from "./list";
import { Switch } from "./switch";

test("renders a labelled section of rows", () => {
  render(
    <ListSection header="Contact" footer="Available 9:00–18:00">
      <ListItem title="Phone" detail="+966 12 000 0000" />
    </ListSection>,
  );
  expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
  const list = screen.getByRole("list");
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Available 9:00–18:00")).toBeInTheDocument();
});

test("a row with href is a link, external ones open safely", () => {
  render(
    <ListSection>
      <ListItem
        title="Website"
        href="https://example.com"
        external
        leading={
          <ListIcon color="blue">
            <Globe />
          </ListIcon>
        }
      />
      <ListItem title="Rooms" href="/rooms" />
    </ListSection>,
  );
  const external = screen.getByRole("link", { name: "Website" });
  expect(external).toHaveAttribute("target", "_blank");
  expect(external).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("link", { name: "Rooms" })).not.toHaveAttribute("target");
});

test("a row with onClick is a button", async () => {
  const onClick = vi.fn();
  render(
    <ListSection>
      <ListItem title="Sign out" tone="destructive" onClick={onClick} />
    </ListSection>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(onClick).toHaveBeenCalledOnce();
});

test("a trailing control replaces the chevron and stays operable", async () => {
  render(
    <ListSection>
      <ListItem title="Notifications" trailing={<Switch aria-label="Notifications" />} />
    </ListSection>,
  );
  const toggle = screen.getByRole("switch", { name: "Notifications" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
});
