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
    postalAddress: {
      street: "Jabal Al Kaaba, Ibrahim Al Khalil Street",
      city: "Makkah",
      postalCode: "24231",
      country: "Saudi Arabia",
    },
    mapUrl: "https://maps.google.com/?q=Sheraton+Makkah+Jabal+Al+Kaaba",
  },
  nav: [
    { label: "Discover", href: "/#discover" },
    { label: "360° Tour", href: "/#tour" },
    {
      label: "Momen Tawfiq Alkiswani",
      href: "/momen",
      image: "/profile/momen-avatar.webp",
      caption: "Digital business card",
    },
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
      name: "Momen Tawfiq Alkiswani",
      givenName: "Momen Tawfiq",
      familyName: "Alkiswani",
      title: "Sales Manager, Travel Trade",
      tagline: "Helping agencies plan stays in Makkah since 2014.",
      languages: ["ar", "en", "id"],
      phone: { e164: "+966500000000", display: "+966 50 000 0000" },
      email: "momen@example.com",
      whatsappUrl: "https://wa.me/966500000000?text=Hello%20Momen%2C%20I%27d%20like%20a%20quote.",
      portrait: {
        src: "/profile/momen-1049.webp",
        srcSet:
          "/profile/momen-560.webp 560w, /profile/momen-840.webp 840w, /profile/momen-1049.webp 1049w",
        width: 1049,
        height: 1024,
        alt: "Momen Tawfiq Alkiswani in a navy suit, arms folded, smiling",
        avatar: "/profile/momen-avatar.webp",
        ogImage: "/profile/momen-og.jpg",
        ink: "/profile/momen-ink.webp",
      },
      href: "/momen",
      vcardHref: "/momen/vcard",
    },
  },
  // Figures, hours and links are placeholders to be confirmed by Momen before launch.
  profile: {
    eyebrow: "Digital business card",
    statement:
      "One direct line for every group you bring to Makkah — from the first quote to the last checkout.",
    stats: [
      { value: 12, suffix: "+", label: "Years in Makkah hospitality" },
      { value: 1200, suffix: "+", label: "Pilgrim groups hosted" },
      { value: 30, suffix: "+", label: "Partner countries" },
      { value: 2, prefix: "<", suffix: "h", label: "Typical reply time" },
    ],
    about: {
      eyebrow: "About",
      title: "Your partner on the ground in Makkah",
      paragraphs: [
        "Momen looks after travel agencies and tour operators at Sheraton Makkah Jabal Al Kaaba — quotes, allotments, rooming lists and everything in between.",
        "He works in Arabic, English and Bahasa Indonesia, so your team and your guests are always understood, in season and out.",
      ],
    },
    services: {
      eyebrow: "How I can help",
      title: "Built around your groups",
      items: [
        {
          icon: "groups",
          title: "Umrah & Hajj groups",
          body: "Group rates, rooming lists and a dedicated check-in for every arrival.",
        },
        {
          icon: "allotments",
          title: "Series & allotments",
          body: "Seasonal allotments and series contracts, with clear release dates.",
        },
        {
          icon: "vip",
          title: "VIP & family stays",
          body: "Haram-view suites and connecting rooms, arranged personally.",
        },
        {
          icon: "events",
          title: "Ramadan & peak season",
          body: "Early planning for the busiest nights of the year, Suhoor and Iftar included.",
        },
      ],
    },
    reach: { eyebrow: "Reach me", title: "Whichever way suits you" },
    availability: {
      timeZone: "Asia/Riyadh",
      place: "Makkah",
      days: [0, 1, 2, 3, 4],
      opens: "09:00",
      closes: "18:00",
      hoursLabel: "Sunday – Thursday, 9:00 – 18:00",
      responseTime: "Messages outside these hours are answered the next working morning.",
    },
    resources: {
      eyebrow: "From the hotel",
      title: "Share these with your travellers",
      links: [
        {
          label: "Fact sheets & guides",
          description: "Rooms, group policies, dining and access — in PDF.",
          href: "/#discover",
        },
        {
          label: "360° virtual tour",
          description: "Walk the lobby, rooms and views.",
          href: "/#tour",
        },
        {
          label: "Directions",
          description: "Ibrahim Al Khalil Street, Makkah",
          href: "https://maps.google.com/?q=Sheraton+Makkah+Jabal+Al+Kaaba",
          external: true,
        },
      ],
    },
    social: [{ label: "LinkedIn", href: "https://www.linkedin.com/" }],
    share: {
      eyebrow: "Share",
      title: "Pass this card on",
      body: "Scan to open this card on another phone, or send the link to a colleague.",
    },
    closing: {
      title: "Planning a group stay?",
      body: "Send the dates and the size of your group — you'll have a quote the same day.",
      cta: "Message on WhatsApp",
    },
  },
  footer: {
    tagline: "Digital sales experience for travel agencies and tour operators.",
    privacy: "This site uses no cookies and collects no personal data unless you send a request.",
    credit: "Crafted by Widdi",
  },
};
