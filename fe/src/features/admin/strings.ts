import type { Locale } from "@/i18n/locales";

/** The admin panel's own words. Placeholders in braces are filled with `fill`. */
export interface AdminStrings {
  formatLocale: string;
  admin: string;
  brand: string;
  sections: string;
  discover: string;
  profile: string;
  account: string;
  signOut: string;
  viewSite: string;
  language: string;
  save: string;
  saveChanges: string;
  saved: string;
  savedLive: string;
  saveFailed: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
  retry: string;
  loading: string;
  unsavedChanges: string;
  optional: string;
  networkError: string;
  sessionExpired: string;
  genericError: string;
  fileTooLarge: string;
  hasErrors: string;
  notTranslated: string;

  signInTitle: string;
  signInLead: string;
  email: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  signIn: string;
  invalidCredentials: string;
  tooManyAttempts: string;

  discoverLead: string;
  tourTitle: string;
  tourLead: string;
  tourUrl: string;
  tourHint: string;
  openLink: string;
  topicsTitle: string;
  addTopic: string;
  newTopic: string;
  editTopic: string;
  eyebrow: string;
  eyebrowHint: string;
  title: string;
  body: string;
  paragraphHint: string;
  noTopics: string;
  noTopicsLead: string;
  moveUp: string;
  moveDown: string;
  noDocuments: string;
  uploadPdf: string;
  newDocument: string;
  editDocument: string;
  pdfFile: string;
  choosePdf: string;
  dropHint: string;
  replaceFile: string;
  documentLanguage: string;
  uploading: string;
  open: string;
  pages: string;
  deleteTopicConfirm: string;
  deleteDocumentConfirm: string;
  untitled: string;
  deleted: string;

  profileLead: string;
  published: string;
  notPublished: string;
  photos: string;
  portrait: string;
  portraitHint: string;
  cardPhoto: string;
  cardPhotoHint: string;
  businessCard: string;
  businessCardHint: string;
  nameLead: string;
  jobTitleLead: string;
  uploadImage: string;
  changeImage: string;
  removeImage: string;
  name: string;
  firstName: string;
  lastName: string;
  displayName: string;
  displayNameHint: string;
  organization: string;
  contact: string;
  phone: string;
  phoneHint: string;
  whatsapp: string;
  whatsappHint: string;
  address: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  mapUrl: string;
  mapUrlHint: string;
  linkedin: string;
  links: string;
  languagesSpoken: string;
  languagesHint: string;
  addLanguage: string;
  translationsTitle: string;
  translationsLead: string;
  jobTitle: string;
  tagline: string;
  bio: string;
  whatsappMessage: string;
  whatsappMessageHint: string;

  errRequired: string;
  errPhone: string;
  errPhoneCountry: string;
  errEmail: string;
  errUrl: string;
  errLinkedIn: string;
  errTooLong: string;
  errImageMissing: string;
  errNotPdf: string;
  errNotImage: string;
  errPdfIncomplete: string;
  errSingleLine: string;
}

const en: AdminStrings = {
  formatLocale: "en",
  admin: "Admin",
  brand: "Sheraton Makkah",
  sections: "Sections",
  discover: "Discover",
  profile: "Profile",
  account: "Account",
  signOut: "Sign out",
  viewSite: "View site",
  language: "Language",
  save: "Save",
  saveChanges: "Save changes",
  saved: "Saved",
  savedLive: "The site is up to date.",
  saveFailed: "Couldn't save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  retry: "Try again",
  loading: "Loading",
  unsavedChanges: "Unsaved changes",
  optional: "Optional",
  networkError: "The server can't be reached. Check your connection and try again.",
  sessionExpired: "Your session has ended. Please sign in again.",
  genericError: "Something went wrong. Please try again.",
  fileTooLarge: "The file is too large.",
  hasErrors: "Please check the highlighted fields.",
  notTranslated: "Not filled in — visitors reading this language see another one.",

  signInTitle: "Sign in",
  signInLead: "Manage the content of the digital sales experience.",
  email: "Email",
  password: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  signIn: "Sign in",
  invalidCredentials: "The email or password is incorrect.",
  tooManyAttempts: "Too many attempts. Please wait a moment and try again.",

  discoverLead: "The topics, brochures and virtual tour of the Discover section.",
  tourTitle: "360° virtual tour",
  tourLead: "Where the “Take the tour” button leads.",
  tourUrl: "Tour link",
  tourHint: "A full https:// link, for example from Matterport.",
  openLink: "Open link",
  topicsTitle: "Topics",
  addTopic: "Add topic",
  newTopic: "New topic",
  editTopic: "Edit topic",
  eyebrow: "Label",
  eyebrowHint: "A few words above the title.",
  title: "Title",
  body: "Text",
  paragraphHint: "Leave a blank line to start a new paragraph.",
  noTopics: "No topics yet",
  noTopicsLead:
    "Add a topic, then upload its PDF brochures. Until then, the site shows its built-in topics.",
  moveUp: "Move up",
  moveDown: "Move down",
  noDocuments: "No brochures in this topic yet.",
  uploadPdf: "Upload PDF",
  newDocument: "New brochure",
  editDocument: "Edit brochure",
  pdfFile: "PDF file",
  choosePdf: "Choose a PDF",
  dropHint: "or drop it here · up to {size}",
  replaceFile: "Replace PDF",
  documentLanguage: "Language of the document",
  uploading: "Uploading… {percent}%",
  open: "Open",
  pages: "{count} p.",
  deleteTopicConfirm: "Delete “{title}” and all of its brochures?",
  deleteDocumentConfirm: "Delete “{title}”?",
  untitled: "Untitled",
  deleted: "Deleted",

  profileLead: "Your digital business card and the contact card visitors save.",
  published: "Published",
  notPublished: "Not published yet — add a job title and a phone number, WhatsApp or email.",
  photos: "Photos",
  portrait: "Portrait",
  portraitHint: "Shown on your profile page. A photo on a white background looks best.",
  cardPhoto: "Contact card photo",
  cardPhotoHint:
    "Saved to the visitor's phone with “Save contact”. The portrait is used when empty.",
  businessCard: "Business card",
  businessCardHint:
    "Your designed card, saved to the visitor's photos with “Save business card”. Without one, the contact card is saved.",
  nameLead: "Written across your portrait on the site, and shown in the menu and footer.",
  jobTitleLead: "Shown under your name. Fill in the languages you publish.",
  uploadImage: "Upload image",
  changeImage: "Change",
  removeImage: "Remove",
  name: "Name",
  firstName: "First name",
  lastName: "Last name",
  displayName: "Name in this language",
  displayNameHint: "For example in Arabic script. Leave empty to use the name above.",
  organization: "Hotel or company",
  contact: "Contact",
  phone: "Phone",
  phoneHint: "With the country code, e.g. +966 12 545 6789.",
  whatsapp: "WhatsApp",
  whatsappHint: "Leave empty to use the phone number.",
  address: "Address",
  street: "Street",
  city: "City",
  postalCode: "Postal code",
  country: "Country",
  mapUrl: "Map link",
  mapUrlHint: "A Google Maps or Apple Maps link to the office.",
  linkedin: "LinkedIn",
  links: "Links",
  languagesSpoken: "Languages spoken",
  languagesHint: "Tap to add or remove. They are shown in the order chosen.",
  addLanguage: "Add language",
  translationsTitle: "Texts per language",
  translationsLead:
    "Fill in at least one language. Visitors reading a language left empty see another one.",
  jobTitle: "Job title",
  tagline: "Tagline",
  bio: "About",
  whatsappMessage: "WhatsApp greeting",
  whatsappMessageHint: "Pre-filled when a visitor starts a chat.",

  errRequired: "Required.",
  errPhone: "Not a valid phone number.",
  errPhoneCountry: "Start with the country code, e.g. +966.",
  errEmail: "Not a valid email address.",
  errUrl: "Enter a full link starting with https://.",
  errLinkedIn: "Enter a linkedin.com link.",
  errTooLong: "At most {max} characters.",
  errImageMissing: "This image no longer exists. Choose another.",
  errNotPdf: "This file isn't a PDF.",
  errNotImage: "Choose a JPEG, PNG or WebP image.",
  errPdfIncomplete: "The PDF is incomplete. Please upload it again.",
  errSingleLine: "Must be a single line.",
};

const ar: AdminStrings = {
  formatLocale: "ar-u-nu-latn",
  admin: "لوحة الإدارة",
  brand: "شيراتون مكة",
  sections: "الأقسام",
  discover: "اكتشف",
  profile: "الملف الشخصي",
  account: "الحساب",
  signOut: "تسجيل الخروج",
  viewSite: "عرض الموقع",
  language: "اللغة",
  save: "حفظ",
  saveChanges: "حفظ التغييرات",
  saved: "تم الحفظ",
  savedLive: "الموقع محدَّث الآن.",
  saveFailed: "تعذّر الحفظ",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  close: "إغلاق",
  retry: "إعادة المحاولة",
  loading: "جارٍ التحميل",
  unsavedChanges: "تغييرات غير محفوظة",
  optional: "اختياري",
  networkError: "تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مرة أخرى.",
  sessionExpired: "انتهت جلستك. يُرجى تسجيل الدخول مرة أخرى.",
  genericError: "حدث خطأ ما. يُرجى المحاولة مرة أخرى.",
  fileTooLarge: "حجم الملف كبير جدًا.",
  hasErrors: "يُرجى مراجعة الحقول المحدَّدة.",
  notTranslated: "غير مُعبّأ — يرى زوّار هذه اللغة لغةً أخرى.",

  signInTitle: "تسجيل الدخول",
  signInLead: "أدِر محتوى تجربة المبيعات الرقمية.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  showPassword: "إظهار كلمة المرور",
  hidePassword: "إخفاء كلمة المرور",
  signIn: "تسجيل الدخول",
  invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  tooManyAttempts: "محاولات كثيرة. يُرجى الانتظار قليلًا ثم المحاولة مجددًا.",

  discoverLead: "موضوعات قسم «اكتشف» وكتيّباته والجولة الافتراضية.",
  tourTitle: "الجولة الافتراضية 360 درجة",
  tourLead: "الوجهة التي يفتحها زر «ابدأ الجولة».",
  tourUrl: "رابط الجولة",
  tourHint: "رابط كامل يبدأ بـ https://‎، مثل رابط Matterport.",
  openLink: "فتح الرابط",
  topicsTitle: "الموضوعات",
  addTopic: "إضافة موضوع",
  newTopic: "موضوع جديد",
  editTopic: "تعديل الموضوع",
  eyebrow: "العنوان التمهيدي",
  eyebrowHint: "كلمات قليلة تظهر فوق العنوان.",
  title: "العنوان",
  body: "النص",
  paragraphHint: "اترك سطرًا فارغًا لبدء فقرة جديدة.",
  noTopics: "لا توجد موضوعات بعد",
  noTopicsLead:
    "أضف موضوعًا ثم ارفع كتيّباته بصيغة PDF. حتى ذلك الحين يعرض الموقع موضوعاته المدمجة.",
  moveUp: "نقل لأعلى",
  moveDown: "نقل لأسفل",
  noDocuments: "لا توجد كتيّبات في هذا الموضوع بعد.",
  uploadPdf: "رفع ملف PDF",
  newDocument: "كتيّب جديد",
  editDocument: "تعديل الكتيّب",
  pdfFile: "ملف PDF",
  choosePdf: "اختر ملف PDF",
  dropHint: "أو أفلته هنا · حتى {size}",
  replaceFile: "استبدال الملف",
  documentLanguage: "لغة المستند",
  uploading: "جارٍ الرفع… {percent}%",
  open: "فتح",
  pages: "{count} صفحة",
  deleteTopicConfirm: "حذف «{title}» وجميع كتيّباته؟",
  deleteDocumentConfirm: "حذف «{title}»؟",
  untitled: "بلا عنوان",
  deleted: "تم الحذف",

  profileLead: "بطاقة أعمالك الرقمية وبطاقة الاتصال التي يحفظها الزوّار.",
  published: "منشور",
  notPublished: "غير منشور بعد — أضف المسمّى الوظيفي ورقم هاتف أو واتساب أو بريدًا إلكترونيًا.",
  photos: "الصور",
  portrait: "الصورة الشخصية",
  portraitHint: "تظهر في صفحة ملفك الشخصي. تبدو الصورة بخلفية بيضاء أجمل.",
  cardPhoto: "صورة بطاقة الاتصال",
  cardPhotoHint:
    "تُحفظ في هاتف الزائر عند الضغط على «حفظ جهة الاتصال». تُستخدم الصورة الشخصية إن تُركت فارغة.",
  businessCard: "بطاقة العمل",
  businessCardHint:
    "بطاقتك المصمَّمة، تُحفظ في صور الزائر عند الضغط على «حفظ بطاقة العمل». بدونها تُحفظ بطاقة الاتصال.",
  nameLead: "يُكتب على صورتك في الموقع، ويظهر في القائمة وتذييل الصفحة.",
  jobTitleLead: "يظهر تحت اسمك. املأ اللغات التي تنشر بها.",
  uploadImage: "رفع صورة",
  changeImage: "تغيير",
  removeImage: "إزالة",
  name: "الاسم",
  firstName: "الاسم الأول",
  lastName: "اسم العائلة",
  displayName: "الاسم بهذه اللغة",
  displayNameHint: "مثلًا بالحروف العربية. اتركه فارغًا لاستخدام الاسم أعلاه.",
  organization: "الفندق أو الشركة",
  contact: "التواصل",
  phone: "الهاتف",
  phoneHint: "مع رمز الدولة، مثل ‎+966 12 545 6789.",
  whatsapp: "واتساب",
  whatsappHint: "اتركه فارغًا لاستخدام رقم الهاتف.",
  address: "العنوان",
  street: "الشارع",
  city: "المدينة",
  postalCode: "الرمز البريدي",
  country: "الدولة",
  mapUrl: "رابط الخريطة",
  mapUrlHint: "رابط خرائط Google أو Apple لموقع المكتب.",
  linkedin: "LinkedIn",
  links: "الروابط",
  languagesSpoken: "اللغات المحكية",
  languagesHint: "اضغط للإضافة أو الإزالة. تظهر بترتيب اختيارها.",
  addLanguage: "إضافة لغة",
  translationsTitle: "النصوص حسب اللغة",
  translationsLead: "املأ لغة واحدة على الأقل. يرى زوّار اللغة غير المُعبّأة لغةً أخرى.",
  jobTitle: "المسمّى الوظيفي",
  tagline: "العبارة التعريفية",
  bio: "نبذة",
  whatsappMessage: "رسالة الترحيب في واتساب",
  whatsappMessageHint: "تُكتب تلقائيًا عندما يبدأ الزائر محادثة.",

  errRequired: "حقل مطلوب.",
  errPhone: "رقم هاتف غير صالح.",
  errPhoneCountry: "ابدأ برمز الدولة، مثل ‎+966.",
  errEmail: "بريد إلكتروني غير صالح.",
  errUrl: "أدخل رابطًا كاملًا يبدأ بـ https://‎.",
  errLinkedIn: "أدخل رابطًا من linkedin.com.",
  errTooLong: "{max} حرفًا كحد أقصى.",
  errImageMissing: "لم تعد هذه الصورة موجودة. اختر صورة أخرى.",
  errNotPdf: "هذا الملف ليس بصيغة PDF.",
  errNotImage: "اختر صورة بصيغة JPEG أو PNG أو WebP.",
  errPdfIncomplete: "ملف PDF غير مكتمل. يُرجى رفعه مرة أخرى.",
  errSingleLine: "يجب أن يكون في سطر واحد.",
};

const id: AdminStrings = {
  formatLocale: "id",
  admin: "Admin",
  brand: "Sheraton Makkah",
  sections: "Bagian",
  discover: "Jelajahi",
  profile: "Profil",
  account: "Akun",
  signOut: "Keluar",
  viewSite: "Lihat situs",
  language: "Bahasa",
  save: "Simpan",
  saveChanges: "Simpan perubahan",
  saved: "Tersimpan",
  savedLive: "Situs sudah diperbarui.",
  saveFailed: "Gagal menyimpan",
  cancel: "Batal",
  delete: "Hapus",
  edit: "Ubah",
  close: "Tutup",
  retry: "Coba lagi",
  loading: "Memuat",
  unsavedChanges: "Perubahan belum disimpan",
  optional: "Opsional",
  networkError: "Server tidak dapat dijangkau. Periksa koneksi Anda dan coba lagi.",
  sessionExpired: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  genericError: "Terjadi kesalahan. Silakan coba lagi.",
  fileTooLarge: "Ukuran berkas terlalu besar.",
  hasErrors: "Silakan periksa kolom yang ditandai.",
  notTranslated: "Belum diisi — pengunjung dalam bahasa ini melihat bahasa lain.",

  signInTitle: "Masuk",
  signInLead: "Kelola konten pengalaman penjualan digital.",
  email: "Email",
  password: "Kata sandi",
  showPassword: "Tampilkan kata sandi",
  hidePassword: "Sembunyikan kata sandi",
  signIn: "Masuk",
  invalidCredentials: "Email atau kata sandi salah.",
  tooManyAttempts: "Terlalu banyak percobaan. Harap tunggu sebentar lalu coba lagi.",

  discoverLead: "Topik, brosur, dan tur virtual di bagian Jelajahi.",
  tourTitle: "Tur virtual 360°",
  tourLead: "Tujuan tombol “Mulai tur”.",
  tourUrl: "Tautan tur",
  tourHint: "Tautan lengkap https://, misalnya dari Matterport.",
  openLink: "Buka tautan",
  topicsTitle: "Topik",
  addTopic: "Tambah topik",
  newTopic: "Topik baru",
  editTopic: "Ubah topik",
  eyebrow: "Label",
  eyebrowHint: "Beberapa kata di atas judul.",
  title: "Judul",
  body: "Teks",
  paragraphHint: "Sisakan satu baris kosong untuk memulai paragraf baru.",
  noTopics: "Belum ada topik",
  noTopicsLead:
    "Tambahkan topik, lalu unggah brosur PDF-nya. Sampai saat itu, situs menampilkan topik bawaannya.",
  moveUp: "Pindah ke atas",
  moveDown: "Pindah ke bawah",
  noDocuments: "Belum ada brosur di topik ini.",
  uploadPdf: "Unggah PDF",
  newDocument: "Brosur baru",
  editDocument: "Ubah brosur",
  pdfFile: "Berkas PDF",
  choosePdf: "Pilih PDF",
  dropHint: "atau letakkan di sini · maks. {size}",
  replaceFile: "Ganti PDF",
  documentLanguage: "Bahasa dokumen",
  uploading: "Mengunggah… {percent}%",
  open: "Buka",
  pages: "{count} hlm.",
  deleteTopicConfirm: "Hapus “{title}” beserta semua brosurnya?",
  deleteDocumentConfirm: "Hapus “{title}”?",
  untitled: "Tanpa judul",
  deleted: "Dihapus",

  profileLead: "Kartu nama digital Anda dan kartu kontak yang disimpan pengunjung.",
  published: "Terbit",
  notPublished: "Belum terbit — tambahkan jabatan serta nomor telepon, WhatsApp, atau email.",
  photos: "Foto",
  portrait: "Potret",
  portraitHint: "Ditampilkan di halaman profil Anda. Foto berlatar putih terlihat paling baik.",
  cardPhoto: "Foto kartu kontak",
  cardPhotoHint:
    "Disimpan di ponsel pengunjung melalui “Simpan kontak”. Potret dipakai bila dikosongkan.",
  businessCard: "Kartu nama",
  businessCardHint:
    "Kartu rancangan Anda, disimpan ke galeri pengunjung melalui “Simpan kartu nama”. Tanpanya, kartu kontak yang disimpan.",
  nameLead: "Dituliskan di atas potret Anda di situs, serta tampil di menu dan footer.",
  jobTitleLead: "Ditampilkan di bawah nama Anda. Isi bahasa yang Anda terbitkan.",
  uploadImage: "Unggah gambar",
  changeImage: "Ganti",
  removeImage: "Hapus",
  name: "Nama",
  firstName: "Nama depan",
  lastName: "Nama belakang",
  displayName: "Nama dalam bahasa ini",
  displayNameHint: "Misalnya dalam aksara Arab. Kosongkan untuk memakai nama di atas.",
  organization: "Hotel atau perusahaan",
  contact: "Kontak",
  phone: "Telepon",
  phoneHint: "Dengan kode negara, mis. +966 12 545 6789.",
  whatsapp: "WhatsApp",
  whatsappHint: "Kosongkan untuk memakai nomor telepon.",
  address: "Alamat",
  street: "Jalan",
  city: "Kota",
  postalCode: "Kode pos",
  country: "Negara",
  mapUrl: "Tautan peta",
  mapUrlHint: "Tautan Google Maps atau Apple Maps ke kantor.",
  linkedin: "LinkedIn",
  links: "Tautan",
  languagesSpoken: "Bahasa yang dikuasai",
  languagesHint: "Ketuk untuk menambah atau menghapus. Ditampilkan sesuai urutan pilihan.",
  addLanguage: "Tambah bahasa",
  translationsTitle: "Teks per bahasa",
  translationsLead:
    "Isi setidaknya satu bahasa. Pengunjung dalam bahasa yang kosong melihat bahasa lain.",
  jobTitle: "Jabatan",
  tagline: "Slogan",
  bio: "Tentang",
  whatsappMessage: "Sapaan WhatsApp",
  whatsappMessageHint: "Terisi otomatis saat pengunjung memulai obrolan.",

  errRequired: "Wajib diisi.",
  errPhone: "Nomor telepon tidak valid.",
  errPhoneCountry: "Awali dengan kode negara, mis. +966.",
  errEmail: "Alamat email tidak valid.",
  errUrl: "Masukkan tautan lengkap yang diawali https://.",
  errLinkedIn: "Masukkan tautan linkedin.com.",
  errTooLong: "Maksimal {max} karakter.",
  errImageMissing: "Gambar ini sudah tidak ada. Pilih gambar lain.",
  errNotPdf: "Berkas ini bukan PDF.",
  errNotImage: "Pilih gambar JPEG, PNG, atau WebP.",
  errPdfIncomplete: "PDF tidak lengkap. Silakan unggah ulang.",
  errSingleLine: "Harus satu baris.",
};

const strings: Record<Locale, AdminStrings> = { en, ar, id };

export function adminStrings(locale: Locale): AdminStrings {
  return strings[locale];
}

/**
 * The API's field messages in the admin's language; unknown ones are shown as sent, which is
 * still more useful than a generic error.
 */
export function fieldMessage(t: AdminStrings, message: string): string {
  if (message === "must not be blank" || message === "is required") return t.errRequired;
  if (message === "is not a valid phone number") return t.errPhone;
  if (message.startsWith("must start with the country code")) return t.errPhoneCountry;
  if (message === "is not a valid e-mail address") return t.errEmail;
  if (message === "must be a full https:// address") return t.errUrl;
  if (message === "must be a linkedin.com address") return t.errLinkedIn;
  if (message === "image not found") return t.errImageMissing;
  if (message === "must be a PDF document") return t.errNotPdf;
  if (message.startsWith("the PDF is incomplete")) return t.errPdfIncomplete;
  if (message === "must be a single line of text") return t.errSingleLine;
  const tooLong = /^must be at most (\d+) characters$/.exec(message);
  if (tooLong) return t.errTooLong.replace("{max}", tooLong[1]!);
  return message;
}
