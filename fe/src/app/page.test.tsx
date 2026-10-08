import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "./page";

test("renders the hotel name as the page heading", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Sheraton Makkah Jabal Al Kaaba" }),
  ).toBeDefined();
});
