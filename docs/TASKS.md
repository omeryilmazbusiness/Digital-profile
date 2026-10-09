# Sheraton Makkah — QR Digital Sales Experience

Mimari & Task Planı

---

## 1. Mimari Kararlar

| Konu | Karar |
|---|---|
| Mimari | **Modüler monolith** — tek Go binary (API), tek Next.js uygulaması (public site + admin), tek PostgreSQL. Tek domain altında reverse proxy ile tek deploy birimi. |
| Backend | Go 1.27+, `chi` router, `pgx/v5` + `sqlc` (type-safe SQL), `golang-migrate`, `log/slog`, `golang-jwt/jwt/v5`, `argon2id` parola hash |
| API sözleşmesi | **Contract-first OpenAPI 3.0.3** (`be/api/openapi.yaml`). Go tarafı `oapi-codegen` ile server interface, frontend `openapi-typescript` ile tipli client |
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS, shadcn/ui (admin), `next-intl` (id/en/ar + RTL), Framer Motion (reduced-motion uyumlu), Embla Carousel, React Hook Form + Zod, TanStack Query (admin) |
| Veritabanı | PostgreSQL 16. Çok dilli içerik `*_translations` tablolarıyla (locale bazlı satır) |
| Dosya depolama | `Storage` arayüzü: local disk (dev) / S3-uyumlu (dev: RustFS, prod: Cloudflare R2 vb.). Kısıtlı dosyalar için HMAC imzalı, süreli URL |
| Auth | Tek admin kullanıcısı (CLI ile seed). Kısa ömürlü **access JWT** + rotasyonlu **refresh token** (DB’de hash’li). İkisi de `HttpOnly; Secure; SameSite=Strict` cookie |
| E-posta | `Mailer` arayüzü (SMTP / Resend). **Transactional outbox** + arka plan worker ile garantili bildirim |
| Analytics | First-party, cookie’siz event tablosu. Admin dashboard’da raporlama |
| Deploy | Docker Compose: `caddy` (TLS + routing) → `/api/*` Go, geri kalan Next.js; `postgres`. Replit veya tek VPS’e taşınabilir |
| Gözlemlenebilirlik | Yapısal JSON log (slog), request-id, `/healthz` & `/readyz`, panic recovery |

### 1.1 Repo Yapısı

Monolith en üst seviyede iki bağımsız projeye ayrılır: **`be/`** sözleşmenin ve altyapısının sahibidir, **`fe/`** sözleşmeyi yalnızca tüketir. Bağımlılık tek yönlüdür (`fe → be/api/openapi.yaml`). Her iki proje de aynı make hedeflerini sunar (`setup`, `dev`, `generate`, `drift-check`, `fmt`, `lint`, `test`, `build`, `check`, `clean`). Kökte yalnızca bu hedefleri çağıran orkestrasyon dosyaları, CI, git hook’ları ve dokümanlar bulunur.

```
digital-profile/
├── be/                              # Go backend (modüler monolith)
│   ├── api/
│   │   └── openapi.yaml             # Tek kaynak API sözleşmesi
│   ├── deploy/
│   │   └── docker-compose.dev.yml   # Postgres, RustFS, Mailpit
│   ├── tools/                       # Sabitlenmiş geliştirici araçları (ayrı go.mod)
│   ├── .env.example
│   ├── cmd/
│   │   ├── api/                     # HTTP sunucu entrypoint
│   │   └── cli/                     # admin create / reset-password / migrate
│   ├── internal/
│   │   ├── app/                     # Bootstrap, dependency wiring, lifecycle
│   │   ├── config/                  # Env tabanlı konfig + doğrulama
│   │   ├── platform/                # Altyapı adaptörleri
│   │   │   ├── database/            # pgx pool, tx helper
│   │   │   ├── storage/             # local / s3 implementasyonları
│   │   │   ├── mailer/              # smtp / resend implementasyonları
│   │   │   ├── imaging/             # resize, webp varyant üretimi
│   │   │   └── outbox/              # outbox worker
│   │   ├── httpx/                   # middleware, hata modeli, response helper
│   │   └── modules/                 # Bounded context’ler
│   │       ├── auth/
│   │       ├── profile/
│   │       ├── media/
│   │       ├── document/
│   │       ├── content/             # otel keşif kartları + galeriler
│   │       ├── tour/
│   │       ├── settings/
│   │       ├── lead/
│   │       ├── analytics/
│   │       └── qr/
│   ├── db/
│   │   ├── migrations/
│   │   └── queries/                 # sqlc SQL dosyaları
│   ├── sqlc.yaml
│   ├── Dockerfile                   # OPS-01
│   └── Makefile
├── fe/                              # Next.js frontend (public site + /admin)
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/            # Public site (id, en, ar)
│   │   │   └── admin/               # Admin panel (login + dashboard)
│   │   ├── features/                # Feature bazlı UI modülleri
│   │   ├── components/ui/           # Ortak UI bileşenleri
│   │   ├── lib/api/                 # OpenAPI’den üretilen tipli client
│   │   └── i18n/
│   ├── messages/{id,en,ar}.json
│   ├── Dockerfile                   # OPS-01
│   └── Makefile
├── deploy/                          # OPS-02: prod kompozisyonu (be + fe + Caddy); iki projeyi birleştirdiği için kökte
├── docs/
├── .github/workflows/
├── lefthook.yml
└── Makefile                         # Yalnızca orkestrasyon — be/ ve fe/ hedeflerine delege eder
```

### 1.2 Backend Modül Katmanları

Her modül aynı katman düzenini izler; bağımlılık yönü dıştan içe:

```
handler (HTTP, DTO, validasyon)
   └─> service (iş kuralları, transaction sınırı)
         └─> repository (interface)  <── postgres implementasyonu (sqlc)
```

- Modüller birbirinin repository’sine erişmez; yalnızca service arayüzleri üzerinden konuşur.
- Tüm hatalar tek tip problem modeline (`RFC 9457 application/problem+json`) dönüştürülür.
- Transaction yönetimi service katmanında `TxManager` ile yapılır.

### 1.3 Veri Modeli (özet)

| Tablo | Amaç |
|---|---|
| `admin_users` | Tek admin hesabı (email, argon2id hash, last_login_at) |
| `refresh_tokens` | Hash’li refresh token, `family_id` (reuse tespiti), expires/revoked |
| `profile` + `profile_translations` | Momen: ad, portre, telefon/WhatsApp (E.164), e-posta, konuştuğu diller; çevrilebilir: unvan, slogan, kısa bio, WhatsApp hazır mesajı |
| `media` | Yüklenen görseller: storage key, mime, boyut, width/height, webp varyantları (jsonb), checksum |
| `documents` + `document_translations` | PDF: dosya, tip, **doküman dili**, görünürlük (`draft` / `public` / `restricted`), sıra, son güncelleme; çevrilebilir başlık/açıklama |
| `document_access_links` | Kısıtlı doküman için partnere özel, süreli, iptal edilebilir link |
| `highlights` + `highlight_translations` + `highlight_media` | Otel keşif kartları ve galerileri |
| `virtual_tour` + `virtual_tour_translations` | Tur URL’i, önizleme görseli, açılış modu (`embed` / `new_tab`) |
| `site_settings` + `site_settings_translations` | Hero görseli/metni, bölüm sırası, aktif diller, varsayılan dil, Widdi imzası (aç/kapa + metin), bildirim e-postası, gizlilik notu |
| `leads` | Teklif talepleri: şirket, kişi, iletişim kanalı/değeri, giriş-çıkış, oda, misafir, yemek planı, not, locale, **source**, durum (`new` / `contacted` / `quoted` / `closed`) |
| `outbox` | Garantili e-posta bildirimi için bekleyen işler |
| `analytics_events` | `page_view`, `tour_click`, `doc_preview`, `doc_download`, `whatsapp_click`, `vcard_click`, `lead_submitted` + locale, source, ref_id, anonim session id |
| `qr_codes` | Kampanya/kaynak bazlı QR varyantları (label, source slug) |

### 1.4 API Yüzeyi (özet)

**Public** (`/api/v1/public`, auth yok, rate-limit’li)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/site?locale=` | Hero, ayarlar, bölüm sırası, profil, highlight’lar, tur, public dokümanlar (tek çağrı) |
| GET | `/profile/vcard` | `.vcf` indirme |
| GET | `/documents/{id}/file` | Public dosya stream (preview/download) |
| GET | `/documents/access/{token}` | Kısıtlı doküman — imzalı link doğrulama |
| POST | `/leads` | Teklif talebi |
| POST | `/events` | Analytics event |

**Auth** (`/api/v1/auth`)

| Method | Path | Açıklama |
|---|---|---|
| POST | `/login` | Email + parola → access & refresh cookie |
| POST | `/refresh` | Refresh rotasyonu |
| POST | `/logout` | Token family iptali |
| GET | `/me` | Oturum doğrulama |
| PUT | `/password` | Parola değiştirme |

**Admin** (`/api/v1/admin`, JWT zorunlu)

`profile`, `media`, `documents`, `documents/{id}/access-links`, `highlights`, `tour`, `settings`, `leads` (liste/filtre/durum/CSV export), `analytics/summary`, `qr` için CRUD uçları.

---

## 2. Task Konvansiyonu

- **ID formatı:** `<EPIC>-<NO>` (örn. `BE-03`)
- **Tahmin:** gün (1 kişi, odaklı çalışma)
- **Öncelik:** `P0` = MVP için zorunlu, `P1` = MVP’de olmalı, `P2` = sonraki sürüm
- Her task **Kabul Kriterleri (AC)** karşılanmadan “Done” sayılmaz. Genel Definition of Done:
  - Kod review’dan geçti, lint & testler yeşil
  - OpenAPI sözleşmesi güncel
  - Gerekli migration geri alınabilir (`down`)
  - Yeni env değişkenleri `.env.example` ve dokümana eklendi

---

## 3. Epic’ler ve Tasklar

### EPIC 0 — Proje Altyapısı (`INF`) ✅ Tamamlandı

| ID | Task | Öncelik | Tahmin | Bağımlılık | Durum |
|---|---|---|---|---|---|
| INF-01 | Monorepo iskeleti, `.editorconfig`, `.gitignore`, kök `Makefile` | P0 | 0.5 | — | ✅ |
| INF-02 | `docker-compose.dev.yml`: Postgres, RustFS (S3), Mailpit | P0 | 0.5 | INF-01 | ✅ ¹ |
| INF-03 | Go modül kurulumu, `golangci-lint` konfig, `air` hot-reload | P0 | 0.5 | INF-01 | ✅ |
| INF-04 | Next.js kurulumu: TS strict, ESLint, Prettier, Tailwind, shadcn/ui | P0 | 0.5 | INF-01 | ✅ |
| INF-05 | OpenAPI sözleşmesinin ilk versiyonu + codegen pipeline (`oapi-codegen`, `openapi-typescript`) | P0 | 1 | INF-03, INF-04 | ✅ |
| INF-06 | CI (GitHub Actions): lint, test, build, OpenAPI drift kontrolü | P0 | 1 | INF-05 | ✅ |
| INF-07 | Pre-commit hook’ları (lefthook): format, lint | P1 | 0.25 | INF-03, INF-04 | ✅ |

**AC:**
- `make dev` tek komutla tüm servisleri ayağa kaldırır.
- OpenAPI değişip codegen çalıştırılmazsa CI kırılır.

**Uygulama notları:**
- MinIO, 2025’te community Docker image dağıtımını durdurduğu için yerel S3 olarak **RustFS** seçildi. Uygulama S3 API’siyle konuştuğu için prod’da R2 veya başka bir sağlayıcıya geçişte kod değişmez.
- `oapi-codegen` OpenAPI 3.1’i tam desteklemediği için sözleşme **OpenAPI 3.0.3** ile yazıldı.
- Geliştirme araçları (`oapi-codegen`, `air`, `lefthook`) uygulama bağımlılıklarını kirletmemek için ayrı bir `be/tools/go.mod` dosyasında sabitlendi.
- Monolith en üst seviyede `be/` ve `fe/` olarak ikiye ayrıldı; her proje kendi `Makefile`, `.gitignore`, env ve araç yapılandırmasına sahip. Kök `Makefile` yalnızca orkestrasyon yapar.
- ¹ Compose dosyası, Docker kurulu olmayan bir makinede yazıldı; YAML sözdizimi doğrulandı ama `make infra-up` henüz çalıştırılmadı.

---

### EPIC 1 — Backend Çekirdeği (`BE`) ✅ Tamamlandı

| ID | Task | Öncelik | Tahmin | Bağımlılık | Durum |
|---|---|---|---|---|---|
| BE-01 | Config paketi: env okuma, zorunlu alan doğrulama, fail-fast | P0 | 0.5 | INF-03 | ✅ |
| BE-02 | `slog` JSON logger, request-id middleware, access log | P0 | 0.5 | BE-01 | ✅ |
| BE-03 | pgx pool, `TxManager`, sqlc konfig, migration runner | P0 | 1 | BE-01 | ✅ |
| BE-04 | HTTP sunucu: chi router, graceful shutdown, timeouts, panic recovery | P0 | 0.5 | BE-02 | ✅ |
| BE-05 | Hata modeli (RFC 9457 problem+json), domain hata → HTTP eşleme | P0 | 0.5 | BE-04 | ✅ |
| BE-06 | Validasyon katmanı (`go-playground/validator`), alan bazlı hata mesajları | P0 | 0.5 | BE-05 | ✅ |
| BE-07 | Güvenlik middleware’leri: CORS (tek origin), security header’ları, body size limit | P0 | 0.5 | BE-04 | ✅ |
| BE-08 | Rate limiter (IP bazlı, token bucket; public & login uçları için ayrı profiller) | P0 | 0.5 | BE-04 | ✅ |
| BE-09 | `/healthz` (liveness), `/readyz` (DB + storage kontrolü) | P0 | 0.25 | BE-03 | ✅ ² |
| BE-10 | Test altyapısı: `testcontainers-go` ile gerçek Postgres entegrasyon testleri | P0 | 1 | BE-03 | ✅ |

**AC:**
- Sunucu SIGTERM’de açık istekleri bitirip kapanır.
- Tüm hatalar tutarlı problem+json formatında döner; stack trace istemciye sızmaz.

**Uygulama notları:**
- **Hata modeli:** Servisler `apperr` tipleri döner; HTTP katmanı türü status’a eşler. Sözleşme ihlali (bozuk JSON, şemaya uymayan alan) **400**, iş kuralı ihlali **422** döner; ikisi de alan bazlı `errors[]` içerir. 5xx’lerde neden yalnızca loglanır, istemciye gitmez.
- **Çift katmanlı doğrulama:** İstekler önce OpenAPI şemasına göre middleware’de doğrulanır (tip, format, zorunlu alan, bilinmeyen alan); iş kuralları (`checkOut > checkIn` gibi) `validation` paketiyle serviste kontrol edilir.
- **Transaction:** `TxManager.WithinTx` iç içe çağrıları tek transaction’da birleştirir; hata ya da panic’te rollback yapar. Repository’ler `database.Executor(ctx, pool)` ile tx içinde ya da dışında aynı kodla çalışır.
- **Migration:** Dosyalar binary’ye gömülü. Dev’de `DATABASE_AUTO_MIGRATE=true` açılışta uygular; prod’da `cli migrate up` ayrı bir release adımıdır. `/readyz`, şema sürümü binary’nin beklediğinden farklıysa ya da dirty ise 503 döner.
- **İstemci IP:** `X-Forwarded-For` yalnızca güvenilen proxy’den (`HTTP_TRUSTED_PROXIES`) gelirse ve sağdan sola okunarak kullanılır; sahte header ile rate limit atlatılamaz.
- **Rate limit:** Login ve public form uçları ayrı, sıkı bir kovada tutulur. Probe’lar ve CORS preflight sınırlanmaz. Bellek 100k istemciyle sınırlıdır.
- **Test DB:** Testler `TEST_DATABASE_URL` varsa onu, yoksa Docker üzerinden testcontainers’ı kullanır. Migration’lar bir kez şablon DB’ye uygulanır, her test kendi kopyasını alır (paralel ve izole). DB yoksa yerelde atlanır, CI’da başarısız olur.
- ² Storage kontrolü MED-01 ile eklendi: `/readyz` artık `database`, `migrations` ve `storage` kontrollerini raporlar.

---

### EPIC 2 — Kimlik Doğrulama / JWT (`AUTH`) ✅ Tamamlandı

| ID | Task | Öncelik | Tahmin | Bağımlılık | Durum |
|---|---|---|---|---|---|
| AUTH-01 | `admin_users`, `refresh_tokens` migration’ları | P0 | 0.25 | BE-03 | ✅ |
| AUTH-02 | CLI: `admin create`, `admin reset-password` (public kayıt yok) | P0 | 0.5 | AUTH-01 | ✅ |
| AUTH-03 | Parola hash’leme (argon2id), sabit zamanlı karşılaştırma | P0 | 0.25 | AUTH-01 | ✅ |
| AUTH-04 | JWT servisi: access token (15 dk, `HS256` veya `EdDSA`), `iss`/`aud`/`exp`/`jti` claim’leri, key rotation desteği (`kid`) | P0 | 1 | BE-01 | ✅ |
| AUTH-05 | Refresh token: opak, DB’de SHA-256 hash, 7 gün, **rotasyon + reuse tespiti** (çalınmış token kullanılırsa tüm family iptal) | P0 | 1 | AUTH-04 | ✅ |
| AUTH-06 | `login` / `refresh` / `logout` / `me` / `password` uçları | P0 | 1 | AUTH-05 | ✅ |
| AUTH-07 | Cookie stratejisi: `HttpOnly; Secure; SameSite=Strict`, refresh cookie `Path=/api/v1/auth` | P0 | 0.25 | AUTH-06 | ✅ |
| AUTH-08 | CSRF koruması: SameSite + state değiştiren isteklerde `Origin` kontrolü ve özel header zorunluluğu | P0 | 0.5 | AUTH-07 | ✅ |
| AUTH-09 | Auth middleware: admin route grubunu korur, claim’leri context’e koyar | P0 | 0.5 | AUTH-04 | ✅ |
| AUTH-10 | Brute-force koruması: başarısız denemede artan gecikme + geçici kilit, audit log | P0 | 0.5 | AUTH-06, BE-08 | ✅ |

**AC:**
- Token’sız veya süresi dolmuş token’la admin uçları `401` döner.
- Kullanılmış refresh token tekrar kullanılırsa tüm oturumlar iptal edilir.
- Login hatası e-postanın var olup olmadığını sızdırmaz.

**Uygulama notları:**
- **Token ailesi = oturum:** Planlanan `family_id` kolonu yerine her login bir `auth_sessions` satırı açar; o oturumun tüm refresh token’ları aynı aileye aittir. Access JWT `sid` taşır ve middleware oturumun aktif olduğunu DB’den doğrular; böylece logout, parola değişikliği ve reuse tespiti access token’ları da **anında** geçersiz kılar (15 dk beklemeden).
- **Reuse tespiti:** Kullanılmış refresh token 10 sn içinde (`AUTH_REFRESH_REUSE_GRACE`) tekrar gelirse eşzamanlı sekme yarışı sayılır: `409`, token verilmez, oturum düşmez. Sonrasında gelirse hesabın **tüm** oturumları iptal edilir, `401` döner ve audit’e yazılır. Oturumun mutlak ömrü (`AUTH_SESSION_MAX_AGE`, 30 gün) refresh ile uzamaz.
- **Hesap sızdırmama:** Bilinmeyen e-postada da argon2id çalışır (sahte hash ile); bilinmeyen e-posta, yanlış parola ve kilitli hesap aynı `401` mesajını alır, kilitliyken doğru parola da reddedilir.
- **Brute-force:** Eşikten (`AUTH_LOCKOUT_THRESHOLD`, 5) sonra kilit süresi her hatada ikiye katlanır (1 dk → 2 → 4 … en çok 1 sa). IP bazlı sıkı rate limit (BE-08) ile birlikte çalışır. Tüm olaylar `auth_audit_events` tablosuna IP ve user-agent ile yazılır.
- **Parolalar:** argon2id (64 MiB, t=3, p=2, PHC formatı); eş zamanlı hash sayısı sınırlı (bellek koruması); parametreler yükseltilince eski hash’ler login’de yeniden hash’lenir. Politika: 12–128 karakter, e-postaya eşit ya da tek karakter tekrarı olamaz.
- **JWT:** HS256, `kid` ile anahtar halkası (`AUTH_JWT_KEYS`, ilk anahtar imzalar), `iss`/`aud`/`exp`/`iat`/`jti`/`sid` zorunlu; `alg` sabitlenmiş, bilinmeyen `kid` reddedilir.
- **Varsayılan korumalı:** Kimlik doğrulama OpenAPI sözleşmesinden türetilir; global `security` tanımlı, public uçlar açıkça `security: []` ile işaretlenir. Public uç listesi bir testle sabitlenmiştir.
- **CSRF:** `SameSite=Strict` + `/api/v1/auth/` ve `/api/v1/admin/` altındaki state değiştiren isteklerde `X-CSRF-Protection: 1` zorunlu + `Origin` varsa `APP_PUBLIC_ORIGIN`/CORS listesinde olmalı; aksi halde `403`.
- **Tek admin:** DB’de singleton unique index ile garanti; hesap yalnızca CLI ile açılır/sıfırlanır (`make -C be admin-create email=…`). Parola argüman olarak alınmaz (TTY’de gizli prompt, otomasyonda stdin).
- **Bakım:** Süresi dolan ya da iptal edilip 24 saati geçen oturumlar saatlik bir iş ile temizlenir; audit kayıtları korunur.

---

### EPIC 3 — Medya & Depolama (`MED`) ✅ Tamamlandı

| ID | Task | Öncelik | Tahmin | Bağımlılık | Durum |
|---|---|---|---|---|---|
| MED-01 | `Storage` arayüzü + local ve S3 implementasyonları | P0 | 1 | BE-01 | ✅ |
| MED-02 | `media` migration + repository | P0 | 0.25 | BE-03 | ✅ ¹ |
| MED-03 | Görsel yükleme: MIME sniffing (uzantıya güvenmeden), boyut limiti, EXIF temizleme | P0 | 1 | MED-01, MED-02 | ✅ |
| MED-04 | Varyant üretimi: WebP, 3 genişlik (480/960/1600), width/height kaydı | P0 | 1 | MED-03 | ✅ |
| MED-05 | Admin medya kütüphanesi API’si: listele, yükle, alt text (çok dilli), sil (kullanımdaysa engelle) | P1 | 1 | MED-04 | ✅ |
| MED-06 | Public medya servis: uzun süreli `Cache-Control`, immutable URL (hash’li key) | P0 | 0.5 | MED-04 | ✅ |

**AC:**
- PDF uzantılı bir HTML dosyası veya bozuk bir görsel reddedilir.
- Yüklenen görsel EXIF/GPS verisi taşımaz.

**Uygulama notları:**
- **Orijinal saklanmaz:** Yüklenen dosya decode edilip yalnızca yeniden kodlanmış WebP varyantları saklanır. Bu sayede EXIF/GPS/XMP ve dosyaya gizlenmiş her türlü ek veri yapısal olarak düşer. JPEG EXIF yönü (orientation) uygulanır; renk profili (ICC, ör. iPhone Display P3) korunur.
- **Tip tespiti içerikten:** Dosya adı ve `Content-Type` dikkate alınmaz, ilk byte’lardan JPEG / PNG / WebP tanınır. HTML, PDF, SVG, GIF reddedilir; HEIC için “JPEG olarak dışa aktar” mesajı verilir. Bozuk/kesik dosya `422` döner.
- **Bomba koruması:** Decode öncesi yalnızca başlık okunur; `MEDIA_MAX_PIXELS` (50 MP) üstü reddedilir. Eş zamanlı işlem sayısı sınırlıdır (`MEDIA_PROCESSING_CONCURRENCY`; 12 MP fotoğraf ≈2 sn, ≈300 MB).
- **Boyut limiti:** Upload ucu kendi gövde limitine (`MEDIA_MAX_UPLOAD_BYTES` + multipart payı) ve uzatılmış okuma süresine sahiptir. Dosya stream edilirken limit aşılırsa `413` döner, tamamı belleğe alınmaz.
- **Varyantlar:** 480/960/1600 genişlikler; kaynak daha darsa büyütme yapılmaz, kaynak genişliği son varyant olur. Her varyantın width/height/byte boyutu kaydedilir. Ayrıca 16 px’lik bulanık LQIP (`placeholder`, data URI) üretilir.
- **Immutable URL:** Storage key’i içerik hash’idir (`media/<sha256>.webp`); public URL `/api/v1/public/media/<sha256>.webp`. Yanıt `Cache-Control: public, max-age=31536000, immutable`, `ETag`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cross-Origin-Resource-Policy: cross-origin` taşır; `If-None-Match` ile `304`. Yalnızca DB’de kayıtlı varyantlar servis edilir. Bu uç rate limit’ten muaftır (cache/CDN arkasında).
- **Tekrar yükleme:** Aynı dosya (SHA-256) tekrar gelirse yeni kayıt açılmaz, mevcut görsel `200` ile döner (yeni kayıtta `201`).
- **Silme:** İçerik tabloları `media(id)`’ye `ON DELETE NO ACTION` FK ile bağlanacak; kullanılan görselin silinmesi `409` döner. Dosyalar commit’ten sonra silinir; başka bir kayıt aynı içeriği kullanıyorsa dosyaya dokunulmaz.
- **Storage:** `STORAGE_DRIVER=local` (atomik yazma, `os.Root` ile dizin dışına çıkılamaz) veya `s3` (RustFS/MinIO/AWS; minio-go). `/readyz` storage’ı da kontrol eder. `MEDIA_PUBLIC_BASE_URL` ile varyant URL’leri CDN’e yönlendirilebilir.
- ¹ Planlanan tek `media` tablosundaki jsonb varyant kolonu yerine `media_variants` (varyant başına satır, unique storage key) ve `media_translations` (locale başına alt text) tabloları kullanıldı: FK/CHECK ile doğrulanabilir, servis edilecek dosya tek bir indeksli sorguyla bulunur.

---

### EPIC 4 — Profil Modülü (`PRF`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| PRF-01 | `profile` + `profile_translations` migration (singleton) | P0 | 0.25 | BE-03 |
| PRF-02 | Admin API: profil getir/güncelle — ad, portre, telefon, WhatsApp (E.164 doğrulama), e-posta, konuştuğu diller; locale bazlı unvan/slogan/bio/WhatsApp mesajı | P0 | 1 | PRF-01, MED-04 |
| PRF-03 | vCard 3.0 üretimi (`/profile/vcard`): FN, N, ORG, TITLE, TEL, EMAIL, PHOTO (base64), URL; UTF-8 ve Arapça karakter desteği | P0 | 1 | PRF-02 |
| PRF-04 | vCard’ın iPhone (Safari) ve Android (Chrome) üzerinde manuel testi, sonuçların kaydı | P0 | 0.5 | PRF-03 |
| PRF-05 | Profil eksikse public tarafta placeholder modu (yanlış iletişim bilgisi yayınlanmasın) | P0 | 0.25 | PRF-02 |

**AC:**
- Konuştuğu diller listesi yalnızca admin’in seçtiği değerlerden oluşur (varsayılan: ar, en, tr).
- vCard iki platformda da rehbere fotoğraflı ve doğru alanlarla eklenir.

---

### EPIC 5 — Doküman Merkezi (`DOC`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| DOC-01 | `documents`, `document_translations`, `document_access_links` migration’ları | P0 | 0.5 | BE-03 |
| DOC-02 | PDF yükleme: MIME doğrulama, boyut limiti, checksum, sayfa sayısı/boyut metadata | P0 | 1 | MED-01, DOC-01 |
| DOC-03 | Admin CRUD: başlık/açıklama (çok dilli), doküman dili, kapak görseli, görünürlük, sıralama (drag-drop için `sort_order` toplu güncelleme), dosya değiştirme (versiyon → `last_updated_at`) | P0 | 1.5 | DOC-02 |
| DOC-04 | Görünürlük kuralı: **yeni doküman varsayılan `draft`**; public listede yalnızca `public` olanlar | P0 | 0.25 | DOC-03 |
| DOC-05 | Public dosya stream: `inline` (preview) / `attachment` (download), `Range` desteği, doğru `Content-Type` | P0 | 1 | DOC-03 |
| DOC-06 | Kısıtlı doküman erişimi: admin’in oluşturduğu süreli, iptal edilebilir partner linki; erişim **sunucuda** HMAC imza + DB kontrolüyle | P1 | 1.5 | DOC-05 |
| DOC-07 | Çoklu dosya zip indirme (stream ederek) | P2 | 1 | DOC-05 |

**AC:**
- `restricted` ya da `draft` bir dokümanın dosya URL’i tahmin edilse bile `404` döner.
- Dosya değiştirildiğinde QR ve sayfa URL’i değişmeden yeni sürüm sunulur.
- Ramazan fiyat listesi admin açıkça yayınlamadıkça görünmez.

---

### EPIC 6 — Otel İçerikleri (`CNT`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| CNT-01 | `highlights`, `highlight_translations`, `highlight_media` migration’ları | P0 | 0.25 | BE-03 |
| CNT-02 | Admin CRUD: kart başlığı/özeti/detay metni (çok dilli), kapak görseli, galeri (sıralı), yayın durumu, sıralama | P0 | 1.5 | CNT-01, MED-04 |
| CNT-03 | Çeviri eksikse fallback kuralı (varsayılan dil) + admin’de eksik çeviri uyarısı | P1 | 0.5 | CNT-02 |

**AC:**
- Admin içerik ekleyip yayınlayınca, cache süresini beklemeden public sitede görünür (bkz. FE-07).

---

### EPIC 7 — Sanal Tur (`TOUR`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| TOUR-01 | `virtual_tour` migration + admin API: URL, önizleme görseli, açılış modu, çok dilli başlık/açıklama | P0 | 0.5 | BE-03, MED-04 |
| TOUR-02 | URL doğrulama: kısa linki (bit.ly) gerçek hedefe çözümleme, `X-Frame-Options`/CSP kontrolüyle embed uygunluğunu otomatik tespit etme | P1 | 0.5 | TOUR-01 |

---

### EPIC 8 — Site Ayarları (`SET`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| SET-01 | `site_settings` + translations migration (singleton) | P0 | 0.25 | BE-03 |
| SET-02 | Admin API: hero görseli ve metni, bölüm sırası ve görünürlüğü, aktif diller, varsayılan dil, Widdi imzası (aç/kapa + metin), bildirim e-postası, gizlilik notu | P0 | 1 | SET-01 |
| SET-03 | Toplu public uç `GET /public/site?locale=`: tüm sayfa verisini tek sorguda döner, ETag + kısa cache | P0 | 1 | PRF-02, DOC-04, CNT-02, TOUR-01, SET-02 |

---

### EPIC 9 — Teklif Talepleri (`LEAD`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| LEAD-01 | `leads` + `outbox` migration’ları | P0 | 0.25 | BE-03 |
| LEAD-02 | `POST /public/leads`: validasyon (zorunlu alanlar, `check_out > check_in`, geçmiş tarih yok, oda ≥ 1, misafir ≥ oda), yemek planı enum (RO/BB/HB/FB) | P0 | 1 | LEAD-01, BE-06 |
| LEAD-03 | Spam koruması: honeypot alan, minimum doldurma süresi, IP rate limit, opsiyonel Cloudflare Turnstile | P0 | 0.5 | LEAD-02 |
| LEAD-04 | Idempotency: `Idempotency-Key` header’ı ile çift gönderim engeli | P0 | 0.5 | LEAD-02 |
| LEAD-05 | Lead ve outbox kaydı **aynı transaction’da**; yanıt yalnızca commit sonrası `201` | P0 | 0.5 | LEAD-02 |
| LEAD-06 | Outbox worker: bildirim e-postası, exponential backoff ile retry, kalıcı hata logu | P0 | 1 | LEAD-05 |
| LEAD-07 | E-posta şablonu (HTML + text): talep özeti, kaynak, admin panel linki, hazır WhatsApp yanıt linki | P1 | 0.5 | LEAD-06 |
| LEAD-08 | Admin API: listeleme (sayfalama, tarih/durum/kaynak filtresi), detay, durum güncelleme, not ekleme | P0 | 1 | LEAD-02 |
| LEAD-09 | CSV export (Excel uyumlu UTF-8 BOM) | P0 | 0.5 | LEAD-08 |
| LEAD-10 | KVKK/GDPR: IP’yi ham değil hash’li sakla, saklama süresi politikası (örn. 24 ay sonra anonimleştirme job’ı) | P1 | 0.5 | LEAD-02 |

**AC:**
- DB hatasında kullanıcı “başarılı” mesajı görmez; retry yapılabilir hata alır.
- Mail sunucusu çökse bile lead kaybolmaz; servis düzelince e-posta gönderilir.
- Talep her zaman Momen’e atanır ve `source` alanı kaydedilir.

---

### EPIC 10 — Analytics (`ANL`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| ANL-01 | `analytics_events` migration, `(event_type, created_at)` index’i | P0 | 0.25 | BE-03 |
| ANL-02 | `POST /public/events`: event tipi whitelist, batch desteği, bot user-agent filtreleme, rate limit | P0 | 1 | ANL-01 |
| ANL-03 | `lead_submitted` event’i istemciden değil **sunucudan** (commit sonrası) yazılır | P0 | 0.25 | ANL-01, LEAD-05 |
| ANL-04 | Admin özet API: tarih aralığı, event tipi bazında sayım, kaynak (QR varyantı) ve dil kırılımı, günlük trend | P0 | 1 | ANL-02 |

**AC:**
- Cookie veya kişisel veri yok; session id rastgele ve yalnızca sekme ömrü boyunca tutulur.
- Raporlarda “WhatsApp tıklaması” ve “vCard tıklaması” ifadeleri kullanılır; “gönderildi” veya “kaydedildi” denmez.

---

### EPIC 11 — QR Üretimi (`QR`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| QR-01 | `qr_codes` migration + admin CRUD (label, source slug) | P1 | 0.5 | BE-03 |
| QR-02 | SVG ve PNG (1024px+) üretimi, hata düzeltme seviyesi `Q`/`H`, yeterli quiet zone (≥ 4 modül), URL: `https://<kalıcı-domain>/?src=<slug>` | P0 | 1 | QR-01 |
| QR-03 | Gelen `src` parametresinin sayfa boyunca saklanıp lead ve event’lere eklenmesi | P0 | 0.5 | QR-02, ANL-02, LEAD-02 |

**AC:**
- QR yalnızca kalıcı production domain’i için üretilir; preview/dev domain’i girilirse uyarı verir.

---

### EPIC 12 — Frontend Altyapısı (`FE`)

| ID | Task | Öncelik | Tahmin | Bağımlılık | Durum |
|---|---|---|---|---|---|
| FE-01 | Tasarım sistemi: renk/tipografi token’ları (Sheraton marka rehberine uygun), spacing, radius, motion token’ları | P0 | 1 | INF-04 | ✅ ¹ |
| FE-02 | `next-intl` kurulumu: `/[locale]` route’ları (id, en, ar), dil seçiminin cookie’de saklanması, `Accept-Language` ile ilk tahmin | P0 | 1 | INF-04 | |
| FE-03 | RTL desteği: `dir="rtl"`, Tailwind logical property’leri (`ms-`, `me-`, `ps-`), ikonların yön çevirisi, Arapça font | P0 | 1 | FE-02 | ◐ ² |
| FE-04 | Tipli API client (OpenAPI’den üretilmiş), hata normalizasyonu, server ve client ayrımı | P0 | 0.5 | INF-05 | |
| FE-05 | Ortak bileşenler: Button (pressed/loading), Card, Sheet/Drawer, Accordion, Toast, Skeleton, EmptyState, ErrorState | P0 | 1.5 | FE-01 | ✅ |
| FE-06 | Motion altyapısı: `prefers-reduced-motion` ile otomatik devre dışı kalan Framer Motion wrapper’ları | P0 | 0.5 | FE-01 | ✅ ³ |
| FE-07 | On-demand revalidation: admin değişikliğinde Go, Next’in korumalı `/api/revalidate` ucunu (secret ile) tetikler, ilgili tag’ler yenilenir | P0 | 1 | SET-03 | |
| FE-08 | Analytics client: `sendBeacon` ile event gönderimi, `src` parametresinin `sessionStorage`’da tutulması | P0 | 0.5 | ANL-02 | |

**Uygulama notları (FE-01/05/06 — iOS tasarım sistemi):**
- **Token’lar** `fe/src/app/globals.css` içinde tek yerde: iOS sistem renkleri (label hiyerarşisi, grouped arka planlar, fill, separator, material), Dynamic Type ölçeği (`text-large-title` … `text-caption-2`, rem tabanlı), radius, gölge, iOS eğrileri (`ease-ios`, `ease-spring`), safe-area utility’leri (`pt-safe`, `pb-safe-4`…), `material-*` (blur; desteklenmezse veya “şeffaflığı azalt” açıksa opak). Bileşenler yalnızca semantik token kullanır; ham renk yok.
- **Koyu mod** `light-dark()` ile: sistem ayarını izler, `<html data-theme="light|dark">` ile zorlanabilir; JS ve hydration flash’ı yok. İkincil metin ve sistem kırmızı/yeşil/turuncu tonları WCAG AA (4.5:1) için Apple varsayılanlarından koyulaştırıldı.
- **Bileşenler** `fe/src/components/ui/`: Button, IconButton, Spinner, Card, ListSection/ListItem/ListIcon, Sheet (sürükle-kapat, safe-area, masaüstünde ortalanmış panel), Accordion, Toast (`toast()` her yerden), Skeleton, EmptyState, ErrorState, SegmentedControl, Switch, TextField/Textarea, Badge, NavBar (blur + büyük başlık), Avatar, MediaImage (API varyantlarından `srcset` + LQIP, CLS yok), Reveal/Entrance, DirectionProvider. Hepsi 44 pt dokunma alanı, odak halkası ve ARIA kurallarına uyar; testleri yanlarında.
- **Galeri:** `/design` tüm bileşenleri tema (sistem/açık/koyu) ve LTR/RTL geçişiyle gösterir; `noindex`, production’da `DESIGN_GALLERY=true` olmadıkça 404.
- **`cn` yapılandırması:** Tailwind birleştiricisine özel tipografi ve gölge token’ları tanıtıldı (`src/lib/utils.ts`); aksi halde `text-body` gibi sınıflar `text-tint` rengini sessizce siliyordu. `globals.css`’e yeni token eklenince bu liste de güncellenmeli.
- ¹ Renk paleti Sheraton marka rehberi gelene kadar yer tutucudur; değişiklik yalnızca `--brand`/`--gold` token’larında yapılır.
- ² Bileşenler RTL’e hazır (logical property’ler, aynalanan ikonlar, Arapça font zinciri, `DirectionProvider`, e-posta/telefon alanları LTR). `<html dir>` ve locale bazlı provider FE-02/03 ile bağlanacak.
- ³ Framer Motion yerine sıfır JS’li CSS kullanıldı: `Reveal` scroll-driven animation (`animation-timeline: view()`), `Entrance` tek seferlik giriş. Desteklemeyen tarayıcıda ve reduced motion’da içerik doğrudan görünür. JS ile animasyon gerekirse `useReducedMotion` hook’u var. Global kural tüm geçişleri reduced motion’da kapatır; durum bildiren Spinner `data-motion="essential"` ile hariç tutulur.

---

### EPIC 13 — Public Site (`PUB`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| PUB-01 | Karşılama ekranı: tam ekran hero (öncelikli yüklenen, optimize görsel), başlık, dil seçici, iki CTA (Oteli Keşfet / Momen ile İletişim), kısa giriş animasyonu | P0 | 1.5 | FE-05, FE-06 |
| PUB-02 | Üç kısayol: Oteli keşfet / Dokümanları al / Teklif iste (smooth scroll, sticky nav) | P0 | 0.5 | PUB-01 |
| PUB-03 | Momen iletişim kartı: portre, ad, unvan, konuştuğu diller (bayrak/etiket), telefon, e-posta; WhatsApp / Ara / E-posta / Kişiyi Kaydet butonları | P0 | 1 | PRF-02, FE-05 |
| PUB-04 | Otel keşif kartları: dokunulabilir kartlar, detay açılınca bottom sheet, swipeable galeri (Embla), lazy-load | P0 | 2 | CNT-02 |
| PUB-05 | Sanal tur bölümü: önizleme görseli + “Start Virtual Tour”; tıklanınca iframe’i lazy mount et veya yeni sekmede aç | P0 | 0.5 | TOUR-01 |
| PUB-06 | Doküman merkezi: kartlarda başlık, **doküman dili rozeti**, dosya tipi, son güncelleme; Önizle (yeni sekme) / İndir; önizleme başarısızsa indirme seçeneği; “Arayüz çevirisi PDF’leri çevirmez” notu | P0 | 1.5 | DOC-05 |
| PUB-07 | Teklif formu: RHF + Zod (backend kurallarıyla aynı), tarih seçici, adım adım veya kompakt düzen, honeypot, gizlilik notu; idle / submitting / success / error + retry durumları; idempotency key | P0 | 2 | LEAD-02 |
| PUB-08 | Başarı ekranı: talep özeti + “WhatsApp’ta Momen’e devam et” (talep detaylarıyla dolu mesaj) | P0 | 0.5 | PUB-07 |
| PUB-09 | Sabit mobil iletişim çubuğu: WhatsApp + Kişiyi Kaydet, `safe-area-inset`, içerik altında yeterli padding, klavye açıkken gizlenme | P0 | 0.5 | PUB-03 |
| PUB-10 | WhatsApp deep link üretici: `wa.me/<E164>?text=` locale’e göre hazır mesaj; lead varsa detaylar eklenir | P0 | 0.5 | PRF-02 |
| PUB-11 | Footer: Widdi imzası (ayara bağlı), gizlilik notu, dil seçici | P0 | 0.25 | SET-02 |
| PUB-12 | SEO & paylaşım: metadata, OpenGraph görseli, `hreflang`, `robots` (gerekirse noindex) | P1 | 0.5 | FE-02 |
| PUB-13 | Hata ve placeholder durumları: 404, API erişilemez, eksik profil/içerik | P0 | 0.5 | FE-05 |
| PUB-14 | Karşılama videosu: manuel oynatma, id/en altyazı (WebVTT), poster görseli | P2 | 1 | — |

**AC:**
- Hover’a bağımlı hiçbir etkileşim yok; tüm dokunma alanları ≥ 44×44 px.
- Arapça’da tüm düzen doğru şekilde aynalanır.
- Mobil iletişim çubuğu hiçbir içeriği veya form butonunu kapatmaz.

---

### EPIC 14 — Admin Panel UI (`ADM`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| ADM-01 | Login sayfası + Next middleware ile `/admin/*` koruması (cookie varlığı), otomatik refresh, oturum düşünce login’e yönlendirme | P0 | 1 | AUTH-06 |
| ADM-02 | Admin layout: sidebar (Dashboard, Profil, İçerikler, Dokümanlar, Sanal Tur, Talepler, QR, Ayarlar), responsive, sağ üstte çıkış | P0 | 1 | ADM-01 |
| ADM-03 | Çok dilli form bileşeni: id/en/ar sekmeleri, RTL input, eksik çeviri göstergesi | P0 | 1 | ADM-02 |
| ADM-04 | Görsel yükleyici: sürükle-bırak, önizleme, ilerleme, kırpma (portre için 1:1) | P0 | 1 | MED-05 |
| ADM-05 | Profil yönetimi sayfası + canlı kart önizlemesi | P0 | 1 | PRF-02, ADM-03, ADM-04 |
| ADM-06 | Doküman yönetimi: liste, PDF yükleme, metadata, görünürlük anahtarı, drag-drop sıralama, dosya değiştirme, partner linki oluşturma/iptal | P0 | 2 | DOC-03, DOC-06 |
| ADM-07 | İçerik (highlight) yönetimi: kart CRUD, galeri sıralama, yayın durumu | P0 | 1.5 | CNT-02 |
| ADM-08 | Sanal tur ayarları sayfası | P0 | 0.5 | TOUR-01 |
| ADM-09 | Site ayarları: hero, bölüm sırası (drag-drop), aktif diller, Widdi imzası, bildirim e-postası | P0 | 1 | SET-02 |
| ADM-10 | Talepler: tablo, filtre, detay paneli, durum değişimi, CSV export, “WhatsApp’tan yanıtla” | P0 | 1.5 | LEAD-08, LEAD-09 |
| ADM-11 | Dashboard: KPI kartları (açılış, tur, doküman, WhatsApp, vCard, talep), tarih aralığı, kaynak kırılımı | P0 | 1 | ANL-04 |
| ADM-12 | QR sayfası: varyant oluşturma, SVG/PNG indirme, önizleme | P1 | 0.5 | QR-02 |
| ADM-13 | Hesap: parola değiştirme, tüm oturumları kapatma | P1 | 0.5 | AUTH-06 |
| ADM-14 | “Siteyi önizle” butonu (draft içerikleri görmek için önizleme modu) | P2 | 1 | FE-07 |

**AC:**
- Admin’in kaydettiği her değişiklik birkaç saniye içinde public sitede görünür.
- Kaydedilmemiş değişiklikle sayfadan çıkılırken uyarı gösterilir.

---

### EPIC 15 — Güvenlik, Performans & Erişilebilirlik (`HRD`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| HRD-01 | CSP (nonce tabanlı), HSTS, `Referrer-Policy`, `Permissions-Policy`, `frame-src` yalnızca tur sağlayıcısı | P0 | 0.5 | PUB-05 |
| HRD-02 | Upload güvenliği: dosyalar uygulama domain’inden ayrı servis edilir veya `Content-Disposition` ve `X-Content-Type-Options: nosniff` zorunlu | P0 | 0.5 | MED-06, DOC-05 |
| HRD-03 | Bağımlılık taraması: `govulncheck`, `npm audit`, Dependabot | P0 | 0.25 | INF-06 |
| HRD-04 | Performans bütçesi: mobil Lighthouse ≥ 90, LCP < 2.5 sn (4G), JS bundle bütçesi; ağır bileşenler `dynamic import` | P0 | 1 | PUB-* |
| HRD-05 | Erişilebilirlik: WCAG 2.2 AA kontrast, focus görünürlüğü, klavye navigasyonu, ARIA etiketleri, `axe` otomatik test | P0 | 1 | PUB-* |
| HRD-06 | Secret yönetimi: JWT key, DB, SMTP, revalidate secret yalnızca env/secret store’da; repoda yok | P0 | 0.25 | — |

---

### EPIC 16 — Test & QA (`QA`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| QA-01 | Backend unit testleri: service katmanı (auth, lead validasyonu, görünürlük kuralları) — kapsam ≥ %80 | P0 | 2 | ilgili BE task’ları |
| QA-02 | Backend entegrasyon testleri: repository ve HTTP uçları (testcontainers) | P0 | 2 | BE-10 |
| QA-03 | Frontend bileşen testleri (Vitest + Testing Library) | P1 | 1 | FE-05 |
| QA-04 | E2E (Playwright): dil değişimi + RTL, form başarılı ve başarısız akış, doküman indirme, admin login → içerik ekle → public’te gör | P0 | 2 | PUB-*, ADM-* |
| QA-05 | Gerçek cihaz testleri: iPhone Safari, Android Chrome; basılı QR okutma, vCard import, tel/mailto/WhatsApp | P0 | 1 | Staging |
| QA-06 | Kabul testi checklist’i (brief §11) ve sonuç raporu | P0 | 0.5 | QA-05 |

---

### EPIC 17 — Deploy & Operasyon (`OPS`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| OPS-01 | Multi-stage Dockerfile’lar: Go (distroless, non-root), Next (`output: standalone`) | P0 | 0.5 | — |
| OPS-02 | Production `docker-compose.yml` + Caddyfile (otomatik TLS, `/api` → Go, diğerleri → Next, gzip/zstd) | P0 | 0.5 | OPS-01 |
| OPS-03 | Hosting değerlendirmesi: Replit (free/paid limitler, custom domain, kalıcılık) ile VPS (Hetzner vb.) + R2 maliyet karşılaştırması, karar dokümanı | P0 | 0.5 | — |
| OPS-04 | Kalıcı domain kurulumu (müşteri sahipliğinde), DNS, TLS | P0 | 0.25 | OPS-03 |
| OPS-05 | Staging + production ortamları, CD pipeline (main → staging, tag → prod), migration’ların deploy’da otomatik çalışması | P0 | 1 | OPS-02, INF-06 |
| OPS-06 | Postgres günlük yedek + restore testi, dosya depolama yedeği | P0 | 0.5 | OPS-02 |
| OPS-07 | Uptime monitoring + hata bildirimi (outbox kalıcı hataları dahil) | P1 | 0.5 | OPS-05 |

---

### EPIC 18 — İçerik, Dokümantasyon & Teslim (`DLV`)

| ID | Task | Öncelik | Tahmin | Bağımlılık |
|---|---|---|---|---|
| DLV-01 | Müşteriden girdilerin toplanması: portre, unvan, WhatsApp, e-posta, marka varlıkları, onaylı PDF’ler + yayın izinleri, domain, bildirim adresi, Widdi kararı | P0 | — | Proje başlangıcı |
| DLV-02 | Drive klasörlerinden asset’lerin alınması, optimize edilmesi, sisteme yüklenmesi | P0 | 0.5 | DLV-01, ADM-* |
| DLV-03 | Ramazan fiyat listesinin yıl, pazar, geçerlilik ve izin doğrulaması (onay yoksa `draft` kalır) | P0 | — | DLV-01 |
| DLV-04 | Arayüz çevirilerinin (id/ar) native speaker review’ı | P0 | — | FE-02 |
| DLV-05 | Mobil tasarım (Figma) review ve onayı | P0 | 2 | FE-01 |
| DLV-06 | README: kurulum, env değişkenleri, mimari, komutlar | P0 | 0.5 | — |
| DLV-07 | Admin için kısa içerik güncelleme rehberi (ekran görüntülü) | P0 | 0.5 | ADM-* |
| DLV-08 | Teslim paketi: site, admin erişimi, SVG/PNG QR, kaynak kod, kabul testi sonuçları, hesap sahipliklerinin devri | P0 | 0.5 | QA-06 |

---

## 4. Sprint / Milestone Planı

| Milestone | Kapsam | Çıktı |
|---|---|---|
| **M1 — Temel** (1. hafta) | INF-*, BE-*, AUTH-*, FE-01…FE-04, DLV-05 başlangıcı | Çalışan iskelet, login olan admin, CI yeşil |
| **M2 — İçerik Yönetimi** (2. hafta) | MED-*, PRF-*, DOC-01…05, CNT-*, TOUR-*, SET-*, ADM-01…09 | Admin tüm içeriği yönetebiliyor |
| **M3 — Public Deneyim** (3. hafta) | FE-05…08, PUB-01…13 | 3 dilli, RTL destekli, tamamen dinamik public site |
| **M4 — Lead & Ölçüm** (4. hafta, ilk yarı) | LEAD-*, ANL-*, QR-*, ADM-10…12 | Talepler kaydediliyor ve bildiriliyor, dashboard hazır |
| **M5 — Sertleştirme & Yayın** (4. hafta, ikinci yarı) | HRD-*, QA-*, OPS-*, DLV-* | Production yayını, QR teslimi, kabul testi raporu |
| **Sonraki sürüm** | DOC-07, PUB-14, ADM-14, partner portalı, CRM entegrasyonu | — |

### Kritik Yol

`INF-05 → BE-03 → AUTH-06 → PRF-02 / DOC-03 → SET-03 → PUB-* → QA-04 → OPS-05 → DLV-08`

---

## 5. Riskler & Açık Kararlar

| # | Konu | Etki | Önlem |
|---|---|---|---|
| R1 | Müşteri girdileri (portre, numara, onaylı PDF’ler) gecikir | Yayın gecikir | Placeholder modu (PRF-05); DLV-01 ilk gün başlatılır |
| R2 | Sanal tur sağlayıcısı iframe’e izin vermez | Embed çalışmaz | Otomatik tespit (TOUR-02) + yeni sekme fallback’i |
| R3 | Replit free plan kalıcı hosting için yetersiz | QR bozulur | OPS-03 kararı QR basımından **önce** verilir; QR yalnızca müşterinin kalıcı domain’ine bağlanır |
| R4 | Ramazan fiyatlarının yanlışlıkla yayınlanması | Ticari risk | Varsayılan `draft` + sunucu tarafı erişim kontrolü |
| R5 | Arapça/Endonezce çeviri kalitesi | Marka algısı | Native review (DLV-04) |
| D1 | Admin panel arayüz dili (EN / TR)? | — | Karar bekleniyor |
| D2 | E-posta sağlayıcısı (SMTP / Resend)? | — | Karar bekleniyor |
| D3 | Prod dosya depolama (R2 / başka S3 sağlayıcı / local disk)? | — | OPS-03 ile birlikte karar verilecek |
