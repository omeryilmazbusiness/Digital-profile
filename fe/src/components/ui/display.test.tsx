import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Avatar, initials } from "./avatar";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { MediaImage } from "./media-image";
import { Entrance, Reveal } from "./motion";
import { NavBackLink, NavBar } from "./nav-bar";

const PLACEHOLDER = "data:image/webp;base64,UklGRhAAAABXRUJQ";

const photo = {
  width: 3000,
  height: 2000,
  placeholder: PLACEHOLDER,
  variants: [
    { url: "/api/v1/public/media/c.webp", width: 1600 },
    { url: "/api/v1/public/media/a.webp", width: 480 },
    { url: "/api/v1/public/media/b.webp", width: 960 },
  ],
};

describe("MediaImage", () => {
  test("offers every variant and reserves the aspect ratio", () => {
    render(
      <MediaImage source={photo} alt="Kaaba view suite" sizes="(min-width: 48rem) 50vw, 100vw" />,
    );
    const img = screen.getByRole("img", { name: "Kaaba view suite" });
    expect(img).toHaveAttribute(
      "srcset",
      "/api/v1/public/media/a.webp 480w, /api/v1/public/media/b.webp 960w, /api/v1/public/media/c.webp 1600w",
    );
    expect(img).toHaveAttribute("src", "/api/v1/public/media/b.webp");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "3000");
    expect(img.parentElement).toHaveStyle({ aspectRatio: "3000 / 2000" });
    expect(img.previousElementSibling).toHaveStyle({ backgroundImage: `url("${PLACEHOLDER}")` });
  });

  test("priority images load eagerly with high priority", () => {
    render(<MediaImage source={photo} alt="Hero" priority />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  test("ignores placeholders that are not inline WebP data", () => {
    const evil = { ...photo, placeholder: 'x"); background: url("https://evil.example/t' };
    const { container } = render(<MediaImage source={evil} alt="" />);
    expect(container.querySelector("[style*='evil']")).toBeNull();
  });
});

describe("Avatar", () => {
  test.each([
    ["Momen Al Harbi", "MH"],
    ["  ömer   yılmaz ", "ÖY"],
    ["Cher", "C"],
    ["مؤمن الحربي", "ما"],
    ["", ""],
  ])("initials(%j) = %j", (name, want) => {
    expect(initials(name)).toBe(want);
  });

  test("falls back to initials and keeps the name accessible", () => {
    render(<Avatar name="Momen Al Harbi" />);
    expect(screen.getByText("MH")).toBeInTheDocument();
    expect(screen.getByText("Momen Al Harbi")).toHaveClass("sr-only");
  });
});

describe("states", () => {
  test("EmptyState renders title, description and action", () => {
    render(
      <EmptyState
        title="No images yet"
        description="Upload one to start"
        action={<button>Upload</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No images yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  test("ErrorState is an alert with retry and a support reference", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Couldn’t load" onRetry={onRetry} reference="req-123" />);
    expect(screen.getByRole("alert")).toHaveTextContent("req-123");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("Badge renders its tone", () => {
    render(<Badge tone="gold">Premium</Badge>);
    expect(screen.getByText("Premium").className).toContain("text-gold");
  });
});

describe("NavBar", () => {
  test("with a large title, the page heading is the large title", () => {
    render(<NavBar title="Rooms" largeTitle leading={<NavBackLink href="/">Home</NavBackLink>} />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Rooms");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  test("without a large title, the bar title is the heading", () => {
    render(<NavBar title="Settings" />);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveAttribute("data-collapsed", "true");
  });
});

describe("motion", () => {
  test("Reveal and Entrance render the requested element", () => {
    render(
      <>
        <Reveal as="section" effect="scale">
          A
        </Reveal>
        <Entrance as="p" delay={120}>
          B
        </Entrance>
      </>,
    );
    const a = screen.getByText("A");
    expect(a.tagName).toBe("SECTION");
    expect(a).toHaveAttribute("data-reveal", "scale");
    const b = screen.getByText("B");
    expect(b.tagName).toBe("P");
    expect(b.style.getPropertyValue("--entrance-delay")).toBe("120ms");
  });
});
