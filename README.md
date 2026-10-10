# Sheraton Makkah — QR Digital Sales Experience

Mobile-first website reached through a printed QR code. It introduces the hotel and its sales
contact to travel agencies, serves approved documents and captures quotation requests.
A protected admin panel manages all content.

See [`docs/TASKS.md`](docs/TASKS.md) for the architecture and delivery plan.

## Architecture

A single deployable monolith split into two self-contained projects:

| Project | Role                                                                  | Stack                                                     |
| ------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| `be/`   | Go modular monolith. **Owns** the HTTP contract and its infrastructure | Go 1.27, chi, oapi-codegen, slog, PostgreSQL 16, S3       |
| `fe/`   | Next.js app (public site + `/admin`). **Consumes** the contract        | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Vitest   |

Dependency direction is one-way: `fe → be/api/openapi.yaml`. The backend never depends on the
frontend, and the frontend only touches the backend through the generated, typed client.

```
be/                       Go backend
  api/openapi.yaml          HTTP contract — single source of truth
  cmd/api/                  API server entrypoint
  cmd/cli/                  operational commands (migrations)
  db/migrations/            SQL migrations, embedded into the binaries
  db/queries/               SQL for sqlc (shared/platform queries)
  internal/api/             generated server interface + models (do not edit)
  internal/app/             wiring, lifecycle, contract tests
  internal/apperr/          transport-agnostic application errors
  internal/httpx/           problem+json errors, middleware, router
  internal/validation/      business-rule validation with field errors
  internal/modules/<name>/  one package per bounded context
  internal/platform/        infrastructure adapters (logger, database, storage, imaging…)
  deploy/                   local infrastructure (docker compose)
  tools/                    pinned developer tools (separate go.mod)
  .env.example              backend configuration
fe/                       Next.js frontend
  src/app/                  routes (public + /admin), globals.css = design tokens
  src/components/ui/        iOS-style design system (see below)
  src/hooks/                shared React hooks
  src/lib/api/              generated types + typed client
docs/                     architecture & task plan
Makefile                  orchestration only — delegates to be/ and fe/
```

Both projects expose the **same make targets** — `setup`, `dev`, `generate`, `drift-check`,
`fmt`, `lint`, `test`, `build`, `check`, `clean` — so they can be driven individually
(`make -C be test`) or together from the root (`make test`).

## Prerequisites

- Go **1.27+**
- Node.js **24** (see `fe/.nvmrc`)
- Docker with Compose v2 (backend infrastructure only)
- GNU Make

## Getting started

```bash
make setup   # be/.env, pinned tools, npm ci, git hooks
make dev     # postgres + storage + mailpit, API on :8080 (hot reload), web on :3000
```

| Service         | URL                           |
| --------------- | ----------------------------- |
| Web             | http://localhost:3000         |
| API liveness    | http://localhost:8080/healthz |
| API readiness   | http://localhost:8080/readyz  |
| Mailpit         | http://localhost:8025         |
| Storage console | http://localhost:9001         |

## Everyday commands

Run `make help` (root), `make -C be help` or `make -C fe help` for the full lists.

| Command                 | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `make generate`         | Regenerate Go server and TS client after editing the contract |
| `make drift-check`      | Fail if generated code is stale (also runs on `git push`)     |
| `make lint`             | Contract + Go + TS lint and format checks                     |
| `make test`             | Go tests (race detector) + Vitest                             |
| `make build`            | Versioned static Go binary + Next.js standalone build         |
| `make check`            | Everything CI runs                                            |
| `make -C be infra-reset`| Wipe local Postgres/storage data                              |
| `make -C be migrate-create name=x` | New up/down migration pair                         |
| `make -C be migrate-up` / `migrate-down` / `migrate-version` | Manage the schema by hand |
| `make -C be admin-create email=x` / `admin-reset-password email=x` | Manage the admin account |
| `make -C be jwt-key`    | Generate an `AUTH_JWT_KEYS` entry                             |

## Admin access

There is no public sign-up. Create the single admin account from the CLI (the password is
prompted for, never passed as an argument):

```bash
make -C be admin-create email=you@example.com
make -C be admin-reset-password email=you@example.com   # also unlocks and signs out everywhere
```

- Sessions use two `HttpOnly; SameSite=Strict` cookies: a 15-minute JWT access token and an
  opaque, single-use refresh token (`Path=/api/v1/auth`). Over HTTPS they are named
  `__Host-dp_access` / `__Secure-dp_refresh`. Tokens never appear in response bodies.
- Every operation requires a session unless the OpenAPI contract marks it `security: []`.
- State-changing requests under `/api/v1/auth/` and `/api/v1/admin/` must send
  `X-CSRF-Protection: 1` (the generated FE client does) and, from browsers, an allowed `Origin`.
- `AUTH_JWT_KEYS` is a key ring (`kid:base64`, first key signs). Generate entries with
  `make -C be jwt-key`; rotate by prepending a new key and dropping the old one after 15 minutes.
- Production requires `AUTH_COOKIE_SECURE=true` and an `https` `APP_PUBLIC_ORIGIN`.

## Database

- Schema changes are SQL migrations in `be/db/migrations`, embedded into the binaries.
  In development the API applies them on startup (`DATABASE_AUTO_MIGRATE=true`); in production
  run `cli migrate up` as a release step. `/readyz` reports 503 while the schema does not match
  the version the binary expects.
- Queries are plain SQL compiled to type-safe Go by sqlc (`make generate`).
- Integration tests run against real PostgreSQL: `TEST_DATABASE_URL` if set, otherwise a
  throwaway container via testcontainers (Docker). Each test gets its own migrated database.

## Media

- `POST /api/v1/admin/media` (multipart, field `file`) accepts JPEG, PNG and WebP, detected from
  the bytes — never from the file name. The original is not stored: it is re-encoded to WebP at
  480/960/1600 px (never upscaled), which drops EXIF/GPS while keeping orientation and the color
  profile. A blurred 16 px placeholder comes with every image.
- Variants are served from `/api/v1/public/media/<sha256>.webp` with a one-year `immutable`
  cache. Point `MEDIA_PUBLIC_BASE_URL` at a CDN to serve them from there.
- Files live in a directory (`STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR`) or any S3-compatible
  bucket (`STORAGE_DRIVER=s3`, `S3_*`); `/readyz` checks the storage too.
- Images referenced by content cannot be deleted (`409`). Uploading the same file again returns the
  existing image.

## Profile

- `GET|PUT /api/v1/admin/profile` edits the business card (single record, full replacement). Phone
  and WhatsApp numbers are entered with their country code and stored in E.164; spoken languages
  come from a fixed ISO 639-1 list and default to Arabic, English, Turkish.
- `GET /api/v1/public/profile?locale=` and `GET /api/v1/public/profile/vcard?locale=` stay `404`
  until the profile has a title in at least one language and one contact channel, so visitors see
  a placeholder rather than half-filled details. The admin response lists what is `missing`.
- The vCard is 3.0 with the portrait embedded as a 512 px square JPEG — the format both iOS and
  Android import with the photo. Device checks to run before launch are listed under PRF-04 in
  `docs/TASKS.md`.

## Design system

The UI is an iOS-style, mobile-first kit in `fe/src/components/ui`, driven by the tokens in
`fe/src/app/globals.css`. Use the kit instead of styling screens from scratch:

- **Tokens:** semantic colors (`label`, `label-secondary`, `bg-grouped`, `fill-*`, `separator`,
  `tint`), Dynamic Type sizes (`text-large-title` … `text-caption-2`), `material-*` blur surfaces,
  `ease-ios` / `ease-spring`, safe-area padding (`pt-safe`, `pb-safe-4`). Dark mode follows the OS;
  `<html data-theme="dark|light">` forces it.
- **Components:** Button, IconButton, Card, ListSection/ListItem, Sheet, Accordion, Toast
  (`toast()`), Skeleton, EmptyState, ErrorState, SegmentedControl, Switch, TextField, Badge, NavBar,
  Avatar, MediaImage (renders API media with `srcset` + placeholder), Reveal/Entrance motion.
- **Rules:** use logical properties (`ms-`, `pe-`, `start-`) so RTL works. Wrap locale layouts in
  `DirectionProvider`, keep touch targets at least 44 px, and give icon-only controls a `label`.
  Motion must respect reduced motion; the CSS primitives already do.
- Browse everything at **http://localhost:3000/design**, with theme and RTL toggles. Production builds
  return 404 there unless `DESIGN_GALLERY=true`.

## Home hero

The home page opens with a scroll-scrubbed film: `ScrollCanvasVideo`
(`fe/src/components/scroll`) paints WebP frames onto a canvas while the section is pinned, and
Lenis drives smooth scrolling for the public site. Visitors who prefer reduced motion or have
Save-Data on get a single poster frame with the same copy instead.

The frames are generated from a video, not edited by hand. To replace the film (needs ffmpeg with
libwebp; set `FFMPEG` to use a specific binary):

```sh
cd fe
scripts/extract-frames.sh ~/path/to/video.mp4 hero src/features/home/hero-frames.gen.ts
```

The script writes a landscape set (1600 px wide) and a portrait 3:4 crop for phones to
`public/frames/hero-<hash>/` and updates the manifest. The directory name changes with the content,
so frames are served with an immutable one-year cache. Keep clips short (about 5 s / 120 frames).
Scene copy and timing live in `fe/src/features/home/home-hero.tsx`.

The hotel name on the opening screen writes itself, alternating English and Arabic. It is
pre-rendered from two OFL handwriting fonts in `fe/assets/fonts` (Sacramento, Aref Ruqaa) into SVG
outlines, so no font is downloaded. After changing the name or a font, regenerate it:

```sh
cd fe && node scripts/generate-signature.mjs
```

## Public site

Header, footer and sections live in `fe/src/features/site`. All their data comes from
`getSiteContent()` in `content.ts`, which serves **mock content** (`mock-content.ts`, with a sample
PDF in `fe/public/mock`) until the `GET /public/site` endpoint exists (SET-03). The mock contact
details are fictitious on purpose.

### Digital business card (`/momen`)

The site is a single landing page: hero, Discover, the 360° tour and, last, Momen Tawfiq
Alkiswani's card (`fe/src/features/profile`). `/` and `/momen` render the same page; `/momen` (the
link in the menu, the QR code and the shared URL) opens it at the card, and scrolling up leads into
the rest of the site. Links to sections in the page scroll there and update the URL instead of
navigating (`fe/src/lib/arrival.ts`).

On the card, the portrait settles in on white and his name writes itself beneath it in Instrument
Serif as you scroll, white where it crosses the suit; then the actions, figures, services, contact
details with live office hours, a QR share card and a closing call to action follow.
`/momen/vcard` serves the contact card with the photo embedded. The figures, hours and LinkedIn
link in `mock-content.ts` are placeholders.

Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://example.com`) in production so the QR code, canonical
URL, Open Graph image and JSON-LD use absolute links.

Assets are generated, not edited by hand — rerun after replacing a source:

```sh
cd fe
node scripts/prepare-portrait.mjs      # assets/portraits/momen.jpg → public/profile/* (incl. the
                                       # ink mask for the name), vCard photo
node scripts/generate-signature.mjs    # the written name (and the hotel signature)
python3 scripts/build-display-font.py  # Instrument Serif subset; needs fonttools + brotli
```

## Changing the API

1. Edit `be/api/openapi.yaml`.
2. `make generate` — the Go build now fails until every new operation is implemented.
3. Implement the operation in the owning module and embed its handler in `be/internal/app/server.go`.
4. Exercise the endpoint in `be/internal/app` tests (`contract_test.go`, or the `browser` helper in
   `auth_test.go`); both validate real responses against the spec. New operations are
   authenticated by default; making one public means `security: []` in the spec plus updating
   `TestGuard_PublicOperations`.
5. Use the regenerated types in `fe/` through `fe/src/lib/api/client.ts`.

## Conventions

- Every error response is RFC 9457 `application/problem+json` with a `requestId`.
  Contract violations answer 400, business-rule violations 422, both with field-level `errors`.
- Configuration comes only from environment variables and is validated at startup (fail fast).
- Generated files (`*.gen.go`, `*.gen.ts`) are committed and never edited by hand.
- Commits run format + lint on staged files; pushes run the contract drift check.
