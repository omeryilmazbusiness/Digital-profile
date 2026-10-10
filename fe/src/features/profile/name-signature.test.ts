// @vitest-environment node
import { expect, test } from "vitest";

import { nameSignature, splitLines } from "./name-signature";
import { profileSignatures } from "./profile-signature.gen";

test("splits a name into two even lines, the first never the shorter", () => {
  expect(splitLines(["Momen", "Tawfiq", "Alkiswani"])).toEqual(["Momen Tawfiq", "Alkiswani"]);
  expect(splitLines(["Sara", "Haddad"])).toEqual(["Sara", "Haddad"]);
  expect(splitLines(["Ali", "Bin", "Abdullah", "Al", "Saud"])).toEqual([
    "Ali Bin Abdullah",
    "Al Saud",
  ]);
  expect(splitLines(["Cher"])).toEqual(["Cher"]);
});

test.each(profileSignatures.map((s) => [s.lang, s] as const))(
  "writes the built-in %s name exactly like the prepared signature",
  async (lang, prepared) => {
    expect(await nameSignature(prepared.text, lang)).toEqual(prepared);
  },
);

test("writes any other name, its first line accented", async () => {
  const signature = await nameSignature("  Sara   Haddad ", "id");
  expect(signature).toMatchObject({ lang: "id", dir: "ltr", text: "Sara Haddad" });
  const glyphs = signature!.glyphs;
  expect(glyphs).toHaveLength("SaraHaddad".length);
  expect(glyphs.slice(0, 4).every((g) => g.accent)).toBe(true);
  expect(glyphs.slice(4).some((g) => g.accent)).toBe(false);
  expect(glyphs.every((g) => g.d.startsWith("M") && g.length > 0)).toBe(true);
});

test("sets Arabic names right to left in the Arabic font", async () => {
  const signature = await nameSignature("سارة حداد", "ar");
  expect(signature).toMatchObject({ dir: "rtl", text: "سارة حداد" });
});

test("gives up on letters the fonts can't write, and on empty names", async () => {
  expect(await nameSignature("王小明 Wang", "en")).toBeUndefined();
  expect(await nameSignature("   ", "en")).toBeUndefined();
});
