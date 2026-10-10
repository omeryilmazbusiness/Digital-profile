import { expect, test } from "vitest";

import { mergeSite } from "./merge-site";
import { mockSiteContent as base } from "./mock-content";
import { mockSiteContentAr } from "./mock-content.ar";
import type { PublicSite } from "./site-api";

const empty: PublicSite = { locale: "en", sections: [] };

test("keeps the built-in content while nothing is published", () => {
  expect(mergeSite(base, empty, "en")).toBe(base);
});

test("published topics and the tour link replace the built-in ones", () => {
  const merged = mergeSite(
    base,
    {
      ...empty,
      tour: { url: "https://tour.example/360" },
      sections: [
        {
          id: "s1",
          eyebrow: "Groups",
          title: "Rates",
          body: "Body",
          documents: [
            {
              id: "d1",
              title: "Rate sheet",
              language: "ar",
              fileName: "rates.pdf",
              byteSize: 2048,
              url: "/api/v1/public/documents/d1",
              downloadUrl: "/api/v1/public/documents/d1?download=true",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ],
    },
    "en",
  );
  expect(merged.tour).toEqual({ ...base.tour, url: "https://tour.example/360" });
  expect(merged.sections).toEqual([
    {
      id: "s1",
      eyebrow: "Groups",
      title: "Rates",
      body: "Body",
      documents: [
        {
          id: "d1",
          title: "Rate sheet",
          language: "ar",
          url: "/api/v1/public/documents/d1",
          downloadUrl: "/api/v1/public/documents/d1?download=true",
          fileName: "rates.pdf",
          sizeBytes: 2048,
          pages: undefined,
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    },
  ]);
});

test("the published profile fills the card, the about text, the address and links", () => {
  const merged = mergeSite(
    mockSiteContentAr,
    {
      ...empty,
      locale: "ar",
      profile: {
        locale: "ar",
        firstName: "Momen",
        lastName: "Tawfiq",
        fullName: "Momen Tawfiq",
        displayName: "مؤمن توفيق",
        organization: "Sheraton",
        title: "مدير المبيعات",
        bio: "الفقرة الأولى\nتكملة\n\nالفقرة الثانية",
        phone: { e164: "+966125456789", display: "+966 12 545 6789" },
        email: "momen@example.com",
        languages: ["ar", "en"],
        address: { street: "شارع إبراهيم الخليل", city: "مكة", postalCode: "24231", country: "" },
        mapUrl: "https://maps.example/x",
        linkedinUrl: "https://www.linkedin.com/in/momen",
      },
    },
    "ar",
  );
  const card = merged.contact.profile;
  expect(card).toMatchObject({
    name: "مؤمن توفيق",
    givenName: "Momen",
    familyName: "Tawfiq",
    title: "مدير المبيعات",
    languages: ["ar", "en"],
    phone: { e164: "+966125456789", display: "+966 12 545 6789" },
    email: "momen@example.com",
    whatsappUrl: "https://wa.me/966125456789",
  });
  expect(card.portrait).toBe(mockSiteContentAr.contact.profile.portrait);
  expect(merged.profile.about.paragraphs).toEqual(["الفقرة الأولى تكملة", "الفقرة الثانية"]);
  expect(merged.hotel.address).toBe("شارع إبراهيم الخليل، مكة 24231");
  expect(merged.hotel.mapUrl).toBe("https://maps.example/x");
  expect(merged.profile.social[0]).toEqual({
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/momen",
  });
  expect(merged.profile.social.filter((s) => s.label === "LinkedIn")).toHaveLength(1);
});
