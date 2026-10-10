import type { SiteContent } from "./content";
import { doc, mockSiteContent } from "./mock-content";

// The Indonesian edition of the placeholder content (see mock-content.ts). Documents keep their
// own language: the badge on each card says which one the PDF is written in.

const en = mockSiteContent;

export const mockSiteContentId: Omit<SiteContent, "ui"> = {
  locale: "id",
  home: "/",
  hotel: {
    ...en.hotel,
    address: "Jabal Al Kaaba, Ibrahim Al Khalil Street, Makkah 24231, Arab Saudi",
    postalAddress: { ...en.hotel.postalAddress, country: "Arab Saudi" },
  },
  nav: [
    { label: "Jelajahi", href: "/#discover" },
    { label: "Tur 360°", href: "/#tour" },
    {
      label: "Momen Tawfiq Alkiswani",
      href: "/momen",
      image: "/profile/momen-avatar.webp",
      caption: "Profil",
    },
  ],
  hero: {
    lead: "Selangkah dari Masjidil Haram. Gulir untuk masuk.",
    film: "Berjalan dari pintu masuk Sheraton Makkah Jabal Al Kaaba menuju lobinya",
    lobbyAlt: "Lobi Sheraton Makkah Jabal Al Kaaba",
    scenes: [
      {
        eyebrow: "Untuk mitra perjalanan",
        title: "Setiap jemaah disambut dengan penuh perhatian",
        body: "Layanan khusus untuk rombongan umrah dan haji — dari pertanyaan pertama hingga perpisahan.",
      },
      {
        eyebrow: "Di dalam",
        title: "Kedatangan yang tenang setelah perjalanan panjang",
        body: "Check-in rombongan yang lancar, layanan multibahasa, dan satu kontak untuk setiap pemesanan.",
      },
    ],
  },
  discover: {
    eyebrow: "Jelajahi",
    title: "Semua yang dibutuhkan agen Anda, dalam satu tempat",
    body: "Lembar fakta, kebijakan rombongan, dan peta — siap dibagikan kepada jemaah Anda.",
    note: "Setiap dokumen diterbitkan dalam bahasa yang tertera pada kartunya.",
  },
  sections: [
    {
      id: "rooms",
      eyebrow: "Menginap",
      title: "Kamar dan suite, hanya beberapa saat dari Haram",
      body: "Kamar yang tenang dan lapang dengan pemandangan Haram dan kota, dirancang untuk beristirahat di antara waktu salat. Kamar yang saling terhubung memudahkan keluarga dan rombongan kecil tetap bersama.",
      documents: [
        doc("rooms-fact-sheet", "Lembar Fakta Kamar & Suite", "en", 2_457_600, 8, "2026-09-14"),
        doc("rooms-guide-ar", "Panduan Kamar & Suite", "ar", 3_145_728, 12, "2026-08-30"),
      ],
    },
    {
      id: "groups",
      eyebrow: "Umrah & Haji",
      title: "Dirancang untuk perjalanan rombongan",
      body: "Check-in khusus rombongan, daftar kamar yang fleksibel, dan satu kontak untuk setiap pemesanan — dari pertanyaan pertama hingga perpisahan.",
      documents: [
        doc(
          "group-booking-policy",
          "Kebijakan Pemesanan Rombongan 2026",
          "en",
          1_048_576,
          6,
          "2026-09-02",
        ),
        doc("panduan-grup", "Panduan Pemesanan Grup", "id", 1_258_291, 6, "2026-09-02"),
      ],
    },
    {
      id: "dining",
      eyebrow: "Bersantap",
      title: "Paket makan untuk setiap rencana perjalanan",
      body: "Hanya kamar, sarapan, setengah atau penuh — dengan menu sahur dan iftar selama Ramadan serta prasmanan yang disesuaikan dengan waktu salat.",
      documents: [
        doc("meal-plans", "Panduan Paket Makan & Restoran", "en", 4_404_019, 10, "2026-07-21"),
      ],
    },
    {
      id: "location",
      eyebrow: "Lokasi",
      title: "Cukup berjalan kaki ke Masjidil Haram",
      body: "Keluar ke Ibrahim Al Khalil Street dan tiba di Haram dengan berjalan kaki, dengan rute akses langsung yang dipetakan untuk tamu lansia dan pengguna kursi roda.",
      documents: [
        doc("access-map", "Menuju Hotel: Peta & Akses", "en", 838_861, 2, "2026-06-10"),
        doc("access-map-ar", "Menuju Hotel: Peta & Akses", "ar", 870_400, 2, "2026-06-10"),
      ],
    },
  ],
  tour: {
    eyebrow: "Tur virtual",
    title: "Masuk ke dalam, dalam 360°",
    body: "Jelajahi lobi, kamar, dan pemandangannya sebelum tamu Anda tiba.",
    url: en.tour.url,
    cta: "Mulai tur virtual",
  },
  contact: {
    eyebrow: "Kontak Anda",
    title: "Satu orang untuk setiap pemesanan",
    body: "Pertanyaan, penawaran harga, atau daftar kamar di tengah malam — hubungi langsung.",
    profile: {
      ...en.contact.profile,
      title: "Penjualan, Travel Trade",
      tagline: "Membantu agen merencanakan masa inap di Makkah sejak 2014.",
      whatsappUrl: `https://wa.me/966500000000?text=${encodeURIComponent("Halo Momen, saya ingin meminta penawaran harga.")}`,
      portrait: en.contact.profile.portrait && {
        ...en.contact.profile.portrait,
        alt: "Momen Tawfiq Alkiswani mengenakan jas biru tua, bersedekap dan tersenyum",
      },
    },
  },
  profile: {
    eyebrow: "Profil",
    statement:
      "Satu jalur langsung untuk setiap rombongan yang Anda bawa ke Makkah — dari penawaran pertama hingga check-out terakhir.",
    stats: [
      { value: 12, suffix: "+", label: "Tahun di perhotelan Makkah" },
      { value: 1200, suffix: "+", label: "Rombongan jemaah dilayani" },
      { value: 30, suffix: "+", label: "Negara mitra" },
      { value: 2, prefix: "<", suffix: "j", label: "Waktu balas rata-rata" },
    ],
    about: {
      eyebrow: "Tentang",
      title: "Mitra Anda di Makkah",
      paragraphs: [
        "Momen melayani agen perjalanan dan operator tur di Sheraton Makkah Jabal Al Kaaba — penawaran harga, alokasi kamar, daftar kamar, dan semua yang ada di antaranya.",
        "Ia bekerja dalam bahasa Arab, Inggris, dan Indonesia, sehingga tim dan jemaah Anda selalu dipahami, baik di musim ramai maupun di luar musim.",
      ],
    },
    services: {
      eyebrow: "Yang bisa saya bantu",
      title: "Dirancang untuk rombongan Anda",
      items: [
        {
          icon: "groups",
          title: "Rombongan umrah & haji",
          body: "Tarif rombongan, daftar kamar, dan check-in khusus untuk setiap kedatangan.",
        },
        {
          icon: "allotments",
          title: "Kontrak seri & alokasi",
          body: "Alokasi musiman dan kontrak seri, dengan tanggal pelepasan yang jelas.",
        },
        {
          icon: "vip",
          title: "Menginap VIP & keluarga",
          body: "Suite dengan pemandangan Haram dan kamar yang saling terhubung, diatur secara pribadi.",
        },
        {
          icon: "events",
          title: "Ramadan & musim puncak",
          body: "Perencanaan lebih awal untuk malam-malam tersibuk sepanjang tahun, termasuk sahur dan iftar.",
        },
      ],
    },
    reach: { eyebrow: "Hubungi saya", title: "Melalui cara yang paling nyaman bagi Anda" },
    availability: {
      ...en.profile.availability,
      hoursLabel: "Minggu – Kamis, 09.00 – 18.00",
      responseTime: "Pesan di luar jam tersebut akan dibalas pada pagi hari kerja berikutnya.",
    },
    resources: {
      eyebrow: "Dari hotel",
      title: "Bagikan kepada jemaah Anda",
      links: [
        {
          label: "Lembar fakta & panduan",
          description: "Kamar, kebijakan rombongan, restoran, dan akses — dalam PDF.",
          href: "/#discover",
        },
        {
          label: "Tur virtual 360°",
          description: "Jelajahi lobi, kamar, dan pemandangannya.",
          href: "/#tour",
        },
        {
          label: "Petunjuk arah",
          description: "Ibrahim Al Khalil Street, Makkah",
          href: en.hotel.mapUrl,
          external: true,
        },
      ],
    },
    social: en.profile.social,
    share: {
      eyebrow: "Bagikan",
      title: "Teruskan kartu ini",
      body: "Kirim tautannya kepada rekan Anda, atau simpan kartu nama ini di ponsel Anda.",
    },
    closing: {
      title: "Merencanakan menginap untuk rombongan?",
      body: "Kirimkan tanggal dan jumlah rombongan Anda — penawaran harga akan Anda terima pada hari yang sama.",
      cta: "Kirim pesan via WhatsApp",
    },
  },
  footer: {
    tagline: "Pengalaman penjualan digital untuk agen perjalanan dan operator tur.",
    privacy:
      "Situs ini tidak menggunakan cookie dan tidak mengumpulkan data pribadi kecuali Anda mengirimkan permintaan.",
    credit: en.footer.credit && { ...en.footer.credit, label: "oleh" },
  },
};
