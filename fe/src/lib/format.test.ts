import { expect, test } from "vitest";

import { formatFileSize, formatMonthYear, languageName } from "./format";

test("file sizes use binary units with one decimal from megabytes", () => {
  expect(formatFileSize(512)).toBe("512 byte");
  expect(formatFileSize(838_861)).toBe("819 kB");
  expect(formatFileSize(2_457_600)).toBe("2.3 MB");
  expect(formatFileSize(-1)).toBe("0 byte");
});

test("dates show month and year, independent of the time zone", () => {
  expect(formatMonthYear("2026-09-01")).toBe("Sep 2026");
  expect(formatMonthYear("2026-01-01T00:30:00Z")).toBe("Jan 2026");
});

test("languages are named in their own language", () => {
  expect(languageName("en")).toBe("English");
  expect(languageName("ar")).toBe("العربية");
  expect(languageName("id")).toBe("Bahasa Indonesia");
});
