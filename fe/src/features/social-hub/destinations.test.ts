import { expect, test } from "vitest";

import { HUB_ADDRESS, hubDestinations, SOCIAL_NETWORK_IDS, whatsappUrl } from "./destinations";

test("does not list Snapchat", () => {
  expect(SOCIAL_NETWORK_IDS).not.toContain("snapchat");
  expect(hubDestinations.social.map((item) => item.id)).not.toContain("snapchat");
});

test("lists each network once, with an https destination", () => {
  expect(hubDestinations.social.map((item) => item.id)).toEqual([...SOCIAL_NETWORK_IDS]);
  expect(new Set(hubDestinations.social.map((item) => item.id)).size).toBe(
    SOCIAL_NETWORK_IDS.length,
  );
  for (const item of hubDestinations.social) {
    expect(item.href).toMatch(/^https:\/\//);
    expect(item.label.length).toBeGreaterThan(0);
  }
});

test("opens the hotel's public accounts and the Makkah place", () => {
  const href = Object.fromEntries(hubDestinations.social.map((item) => [item.id, item.href]));
  expect(href.facebook).toBe("https://www.facebook.com/MakkahSheraton");
  expect(href.instagram).toBe("https://www.instagram.com/MakkahSheraton");
  expect(href.x).toBe("https://x.com/MakkahSheraton");
  expect(href.tiktok).toBe("https://www.tiktok.com/@sheratonmakkah");
  expect(href.linkedin).toBe("https://www.linkedin.com/company/makkahsheraton");
  expect(href.maps).toContain(encodeURIComponent(HUB_ADDRESS));
  expect(href.maps).toContain("Sheraton");
});

test("gives each line a WhatsApp link and a tel: number, in the forms the OS expects", () => {
  expect(hubDestinations.lines).toEqual([
    { e164: "+966592197039", display: "+966 59 219 7039" },
    { e164: "+966592623702", display: "+966 59 262 3702" },
  ]);
  for (const line of hubDestinations.lines) {
    expect(whatsappUrl(line.e164)).toMatch(/^https:\/\/wa\.me\/966\d+$/);
    expect(line.e164).toMatch(/^\+966\d+$/);
  }
});
