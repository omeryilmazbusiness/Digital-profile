import type { SiteContent, SiteDocument } from "./content";

// Placeholder content until the CMS and the approved PDFs arrive (DLV-01). Contact details are
// fictitious on purpose: nothing here may reach production as real information.

const SAMPLE_PDF = "/mock/sample.pdf";

function doc(
  id: string,
  title: string,
  language: SiteDocument["language"],
  sizeBytes: number,
  pages: number,
  updatedAt: string,
): SiteDocument {
  return {
    id,
    title,
    language,
    url: SAMPLE_PDF,
    fileName: `${id}.pdf`,
    sizeBytes,
    pages,
    updatedAt,
  };
}

export const mockSiteContent: SiteContent = {
  hotel: {
    name: "Sheraton Makkah Jabal Al Kaaba",
    address: "Jabal Al Kaaba, Ibrahim Al Khalil Street, Makkah 24231, Saudi Arabia",
    mapUrl: "https://maps.google.com/?q=Sheraton+Makkah+Jabal+Al+Kaaba",
  },
  nav: [
    { label: "Discover", href: "#discover" },
    { label: "360° Tour", href: "#tour" },
    { label: "Contact", href: "#contact" },
  ],
  discover: {
    eyebrow: "Discover",
    title: "Everything your agency needs, in one place",
    body: "Fact sheets, group policies and maps — ready to share with your travellers.",
    note: "Each document is published in the language shown on its card.",
  },
  sections: [
    {
      id: "rooms",
      eyebrow: "Stay",
      title: "Rooms and suites, moments from the Haram",
      body: "Calm, generous rooms with Haram and city views, designed for rest between prayers. Connecting rooms keep families and small groups together.",
      documents: [
        doc("rooms-fact-sheet", "Rooms & Suites Fact Sheet", "en", 2_457_600, 8, "2026-09-14"),
        doc("rooms-guide-ar", "Rooms & Suites Guide", "ar", 3_145_728, 12, "2026-08-30"),
      ],
    },
    {
      id: "groups",
      eyebrow: "Umrah & Hajj",
      title: "Built around group travel",
      body: "Dedicated group check-in, flexible rooming lists and one contact for every booking — from the first enquiry to the final farewell.",
      documents: [
        doc("group-booking-policy", "Group Booking Policy 2026", "en", 1_048_576, 6, "2026-09-02"),
        doc("panduan-grup", "Panduan Pemesanan Grup", "id", 1_258_291, 6, "2026-09-02"),
      ],
    },
    {
      id: "dining",
      eyebrow: "Dining",
      title: "Meal plans for every itinerary",
      body: "Room only, breakfast, half or full board — with Suhoor and Iftar menus through Ramadan and buffets timed around prayer.",
      documents: [
        doc("meal-plans", "Meal Plans & Dining Guide", "en", 4_404_019, 10, "2026-07-21"),
      ],
    },
    {
      id: "location",
      eyebrow: "Location",
      title: "A short walk to Masjid al-Haram",
      body: "Step out onto Ibrahim Al Khalil Street and reach the Haram on foot, with direct access routes mapped for elderly guests and wheelchair users.",
      documents: [
        doc("access-map", "Getting Here: Map & Access", "en", 838_861, 2, "2026-06-10"),
        doc("access-map-ar", "Getting Here: Map & Access", "ar", 870_400, 2, "2026-06-10"),
      ],
    },
  ],
  tour: {
    eyebrow: "Virtual tour",
    title: "Step inside, in 360°",
    body: "Walk the lobby, the rooms and the views before your guests arrive.",
    url: "https://example.com/virtual-tour",
    cta: "Start the virtual tour",
  },
  contact: {
    eyebrow: "Your contact",
    title: "One person for every booking",
    body: "Questions, quotes or a rooming list at midnight — reach out directly.",
    profile: {
      name: "Momen",
      title: "Sales Manager, Travel Trade",
      tagline: "Helping agencies plan stays in Makkah since 2014.",
      languages: ["ar", "en", "id"],
      phone: { e164: "+966500000000", display: "+966 50 000 0000" },
      email: "momen@example.com",
      whatsappUrl: "https://wa.me/966500000000?text=Hello%20Momen%2C%20I%27d%20like%20a%20quote.",
    },
  },
  footer: {
    tagline: "Digital sales experience for travel agencies and tour operators.",
    privacy: "This site uses no cookies and collects no personal data unless you send a request.",
    credit: "Crafted by Widdi",
  },
};
