import { createCn } from "cn/config";

/**
 * Class joining with Tailwind conflict resolution, taught the design system's custom tokens.
 * Without this, `text-body` (a font size) is mistaken for a text color and silently drops
 * `text-tint`; keep these lists in sync with the @theme block in globals.css.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title-1",
            "title-2",
            "title-3",
            "headline",
            "body",
            "callout",
            "subheadline",
            "footnote",
            "caption-1",
            "caption-2",
          ],
        },
      ],
      shadow: [{ shadow: ["card", "float"] }],
    },
  },
});
