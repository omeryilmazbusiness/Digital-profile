import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { sceneReveal } from "./scene-reveal";
import { SceneStory } from "./scene-story";

test("reads as one heading while each word is marked for the reveal", () => {
  const { container } = render(
    <SceneStory index="01" eyebrow="Inside" title="A calm arrival" level={3}>
      <p>Lead</p>
    </SceneStory>,
  );

  expect(screen.getByRole("heading", { level: 3, name: "A calm arrival" })).toBeInTheDocument();
  expect(container.querySelectorAll(`[${sceneReveal.word}]`)).toHaveLength(3);
  expect(container.querySelectorAll(`[${sceneReveal.item}]`)).toHaveLength(2);
  expect(container.querySelector(`[${sceneReveal.line}]`)).toHaveAttribute("aria-hidden", "true");
});
