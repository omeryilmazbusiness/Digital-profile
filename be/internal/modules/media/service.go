// Package media manages the image library: validated uploads rendered to responsive WebP
// variants, multilingual alt text, safe deletion and immutable public delivery.
package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/imaging"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

// PublicPath is where variants are served; file names are "<sha256>.webp".
const PublicPath = "/api/v1/public/media/"

const (
	keyPrefix       = "media/"
	DefaultPageSize = 30
	MaxPageSize     = 100
	maxAltTextRunes = 300
	maxFilenameLen  = 255
)

// Locales that may carry alt text, mirrored by the media_translations CHECK constraint.
var Locales = []string{"en", "id", "ar"}

var (
	errNotFound = apperr.NotFound("image not found")
	errInUse    = apperr.Conflict("the image is used by other content; remove it there first")
	errCursor   = apperr.BadRequest("request validation failed", apperr.FieldError{Field: "cursor", Message: "is invalid"})
)

type Variant struct {
	Width    int
	Height   int
	URL      string
	ByteSize int64
}

type Media struct {
	ID               uuid.UUID
	Width            int
	Height           int
	SourceType       string
	SourceBytes      int64
	OriginalFilename string
	Placeholder      string
	AltText          map[string]string
	Variants         []Variant
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Processor renders variants; *imaging.Processor implements it.
type Processor interface {
	Process(ctx context.Context, data []byte) (*imaging.Result, error)
}

type Service struct {
	pool    *pgxpool.Pool
	tx      database.Transactor
	storage storage.Storage
	proc    Processor
	baseURL string
	log     *slog.Logger
}

// NewService wires the service. baseURL prefixes variant URLs (a CDN origin); empty yields
// paths relative to the API origin.
func NewService(pool *pgxpool.Pool, st storage.Storage, proc Processor, baseURL string, log *slog.Logger) *Service {
	return &Service{pool: pool, tx: database.NewTxManager(pool), storage: st, proc: proc, baseURL: baseURL, log: log}
}

func (s *Service) q(ctx context.Context) *store.Queries {
	return store.New(database.Executor(ctx, s.pool))
}

// Upload stores an image. Re-uploading identical bytes returns the existing image with
// created=false, so retried uploads never create duplicates.
func (s *Service) Upload(ctx context.Context, filename string, data []byte) (m Media, created bool, err error) {
	sum := sha256.Sum256(data)
	if existing, err := s.byChecksum(ctx, sum[:]); err == nil {
		return existing, false, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Media{}, false, err
	}

	res, err := s.proc.Process(ctx, data)
	if err != nil {
		return Media{}, false, processingError(err)
	}

	keys := make([]string, len(res.Variants))
	for i, v := range res.Variants {
		h := sha256.Sum256(v.Data)
		keys[i] = keyPrefix + hex.EncodeToString(h[:]) + ".webp"
		if err := s.storage.Put(ctx, keys[i], bytes.NewReader(v.Data), int64(len(v.Data)), imaging.OutputType); err != nil {
			s.removeOrphans(ctx, keys[:i])
			return Media{}, false, apperr.Unavailable("image storage is unavailable; try again").Wrap(err)
		}
	}

	var row store.Media
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		var err error
		row, err = q.CreateMedia(ctx, store.CreateMediaParams{
			Checksum:         sum[:],
			OriginalFilename: SanitizeFilename(filename),
			SourceType:       res.SourceType,
			SourceBytes:      int64(len(data)),
			Width:            int32(res.Width),  //nolint:gosec // bounded by imaging limits
			Height:           int32(res.Height), //nolint:gosec // bounded by imaging limits
			Placeholder:      res.Placeholder,
		})
		if err != nil {
			return err
		}
		for i, v := range res.Variants {
			if err := q.CreateVariant(ctx, store.CreateVariantParams{
				MediaID:    row.ID,
				Width:      int32(v.Width),  //nolint:gosec // bounded by imaging limits
				Height:     int32(v.Height), //nolint:gosec // bounded by imaging limits
				StorageKey: keys[i],
				ByteSize:   int64(len(v.Data)),
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		s.removeOrphans(ctx, keys)
		// A concurrent upload of the same file won the race: return its image.
		if database.ConstraintName(err) == "media_checksum_key" {
			if existing, err := s.byChecksum(ctx, sum[:]); err == nil {
				return existing, false, nil
			}
		}
		return Media{}, false, database.MapError(err)
	}

	m, err = s.Get(ctx, row.ID)
	return m, true, err
}

func processingError(err error) error {
	switch {
	case errors.Is(err, imaging.ErrUnsupportedType), errors.Is(err, imaging.ErrHEIC),
		errors.Is(err, imaging.ErrCorrupt), errors.Is(err, imaging.ErrTooLarge), errors.Is(err, imaging.ErrEmpty):
		return apperr.Invalid("image rejected", apperr.FieldError{Field: "file", Message: err.Error()})
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return apperr.Unavailable("image processing was interrupted; try again").Wrap(err)
	default:
		return apperr.Internal(err)
	}
}

// removeOrphans deletes stored variants that no database row references. Keys are content
// hashes, so a key can belong to another image (identical renditions) and must then stay.
func (s *Service) removeOrphans(ctx context.Context, keys []string) {
	ctx = context.WithoutCancel(ctx)
	q := s.q(ctx)
	for _, k := range keys {
		if _, err := q.GetVariantByKey(ctx, k); !errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err := s.storage.Delete(ctx, k); err != nil {
			s.log.WarnContext(ctx, "delete orphaned media object", "key", k, "error", err)
		}
	}
}

func (s *Service) byChecksum(ctx context.Context, sum []byte) (Media, error) {
	row, err := s.q(ctx).GetMediaByChecksum(ctx, sum)
	if err != nil {
		return Media{}, err
	}
	items, err := s.assemble(ctx, []store.Media{row})
	if err != nil {
		return Media{}, err
	}
	return items[0], nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (Media, error) {
	row, err := s.q(ctx).GetMedia(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Media{}, errNotFound
	}
	if err != nil {
		return Media{}, database.MapError(err)
	}
	items, err := s.assemble(ctx, []store.Media{row})
	if err != nil {
		return Media{}, err
	}
	return items[0], nil
}

// List returns a page, newest first, and the cursor for the next page ("" on the last one).
func (s *Service) List(ctx context.Context, limit int, cursor string) ([]Media, string, error) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	limit = min(limit, MaxPageSize)

	params := store.ListMediaParams{PageSize: int32(limit + 1)}
	if cursor != "" {
		at, id, err := decodeCursor(cursor)
		if err != nil {
			return nil, "", errCursor
		}
		params.AfterCreatedAt, params.AfterID = &at, &id
	}
	rows, err := s.q(ctx).ListMedia(ctx, params)
	if err != nil {
		return nil, "", database.MapError(err)
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		next = encodeCursor(last.CreatedAt, last.ID)
	}
	items, err := s.assemble(ctx, rows)
	return items, next, err
}

// UpdateAltText replaces the alt text: given locales are set, the others cleared.
func (s *Service) UpdateAltText(ctx context.Context, id uuid.UUID, alt map[string]string) (Media, error) {
	clean, fields := validateAltText(alt)
	if len(fields) > 0 {
		return Media{}, apperr.Invalid("request validation failed", fields...)
	}
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		n, err := q.TouchMedia(ctx, id)
		if err != nil {
			return err
		}
		if n == 0 {
			return errNotFound
		}
		if err := q.DeleteTranslations(ctx, id); err != nil {
			return err
		}
		for _, loc := range Locales {
			if text, ok := clean[loc]; ok {
				if err := q.CreateTranslation(ctx, store.CreateTranslationParams{MediaID: id, Locale: loc, AltText: text}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return Media{}, database.MapError(err)
	}
	return s.Get(ctx, id)
}

func validateAltText(alt map[string]string) (map[string]string, []apperr.FieldError) {
	clean := make(map[string]string, len(alt))
	var fields []apperr.FieldError
	for _, loc := range Locales {
		text, ok := alt[loc]
		if !ok {
			continue
		}
		text = strings.TrimSpace(text)
		switch n := utf8.RuneCountInString(text); {
		case n == 0:
			fields = append(fields, apperr.FieldError{Field: loc, Message: "must not be blank"})
		case n > maxAltTextRunes:
			fields = append(fields, apperr.FieldError{Field: loc, Message: fmt.Sprintf("must be at most %d characters", maxAltTextRunes)})
		default:
			clean[loc] = text
		}
	}
	return clean, fields
}

// Delete removes an image and its files. Images still referenced by content cannot be
// deleted: the referencing foreign keys make the DELETE fail.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	var keys []string
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if _, err := q.LockMedia(ctx, id); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errNotFound
			}
			return err
		}
		variants, err := q.ListVariants(ctx, []uuid.UUID{id})
		if err != nil {
			return err
		}
		for _, v := range variants {
			keys = append(keys, v.StorageKey)
		}
		_, err = q.DeleteMedia(ctx, id)
		return err
	})
	if err != nil {
		if mapped := database.MapError(err); apperr.KindOf(mapped) == apperr.KindConflict {
			return errInUse.Wrap(err)
		}
		return database.MapError(err)
	}
	// Files go after the commit: a failure leaves an unreachable file, never a broken image.
	s.removeOrphans(ctx, keys)
	return nil
}

// OpenVariant returns a variant by its public file name ("<sha256>.webp").
func (s *Service) OpenVariant(ctx context.Context, file string) (io.ReadCloser, storage.Object, error) {
	key := keyPrefix + file
	if !storage.ValidKey(key) {
		return nil, storage.Object{}, errNotFound
	}
	// Only files registered as variants are served, never arbitrary objects in the bucket.
	if _, err := s.q(ctx).GetVariantByKey(ctx, key); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, storage.Object{}, errNotFound
		}
		return nil, storage.Object{}, database.MapError(err)
	}
	rc, obj, err := s.storage.Get(ctx, key)
	if errors.Is(err, storage.ErrNotFound) {
		s.log.ErrorContext(ctx, "media variant missing from storage", "key", key)
		return nil, storage.Object{}, errNotFound
	}
	if err != nil {
		return nil, storage.Object{}, apperr.Unavailable("image storage is unavailable").Wrap(err)
	}
	return rc, obj, nil
}

// OpenImage returns the smallest variant at least minWidth wide (the largest when none is),
// for server-side consumers that need the pixels rather than a URL.
func (s *Service) OpenImage(ctx context.Context, id uuid.UUID, minWidth int) (io.ReadCloser, error) {
	variants, err := s.q(ctx).ListVariants(ctx, []uuid.UUID{id})
	if err != nil {
		return nil, database.MapError(err)
	}
	if len(variants) == 0 {
		return nil, errNotFound
	}
	// Variants are ordered by ascending width.
	pick := variants[len(variants)-1]
	for i := range variants {
		if int(variants[i].Width) >= minWidth {
			pick = variants[i]
			break
		}
	}
	rc, _, err := s.storage.Get(ctx, pick.StorageKey)
	if errors.Is(err, storage.ErrNotFound) {
		s.log.ErrorContext(ctx, "media variant missing from storage", "key", pick.StorageKey)
		return nil, errNotFound
	}
	if err != nil {
		return nil, apperr.Unavailable("image storage is unavailable").Wrap(err)
	}
	return rc, nil
}

// assemble loads variants and translations for rows with two queries, whatever the page size.
func (s *Service) assemble(ctx context.Context, rows []store.Media) ([]Media, error) {
	if len(rows) == 0 {
		return []Media{}, nil
	}
	ids := make([]uuid.UUID, len(rows))
	for i := range rows {
		ids[i] = rows[i].ID
	}
	q := s.q(ctx)
	variants, err := q.ListVariants(ctx, ids)
	if err != nil {
		return nil, database.MapError(err)
	}
	translations, err := q.ListTranslations(ctx, ids)
	if err != nil {
		return nil, database.MapError(err)
	}

	byID := make(map[uuid.UUID]*Media, len(rows))
	out := make([]Media, len(rows))
	for i := range rows {
		r := &rows[i]
		out[i] = Media{
			ID: r.ID, Width: int(r.Width), Height: int(r.Height),
			SourceType: r.SourceType, SourceBytes: r.SourceBytes, OriginalFilename: r.OriginalFilename,
			Placeholder: r.Placeholder, AltText: map[string]string{}, Variants: []Variant{},
			CreatedAt: r.CreatedAt.UTC(), UpdatedAt: r.UpdatedAt.UTC(),
		}
		byID[r.ID] = &out[i]
	}
	for _, v := range variants {
		if m := byID[v.MediaID]; m != nil {
			m.Variants = append(m.Variants, Variant{
				Width: int(v.Width), Height: int(v.Height), ByteSize: v.ByteSize,
				URL: s.baseURL + PublicPath + strings.TrimPrefix(v.StorageKey, keyPrefix),
			})
		}
	}
	for _, t := range translations {
		if m := byID[t.MediaID]; m != nil {
			m.AltText[t.Locale] = t.AltText
		}
	}
	return out, nil
}

// SanitizeFilename keeps a display name only: no directories, control characters or
// unbounded length.
func SanitizeFilename(name string) string {
	if i := strings.LastIndexAny(name, `/\`); i >= 0 {
		name = name[i+1:]
	}
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f || r == utf8.RuneError {
			return -1
		}
		return r
	}, strings.ToValidUTF8(name, ""))
	name = strings.TrimSpace(name)
	for len(name) > maxFilenameLen {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	if name == "" || name == "." || name == ".." {
		return "image"
	}
	return name
}

func encodeCursor(at time.Time, id uuid.UUID) string {
	b := make([]byte, 24)
	binary.BigEndian.PutUint64(b, uint64(at.UnixMicro()))
	copy(b[8:], id[:])
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(c string) (time.Time, uuid.UUID, error) {
	b, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil || len(b) != 24 {
		return time.Time{}, uuid.Nil, errors.New("bad cursor")
	}
	id, err := uuid.FromBytes(b[8:])
	if err != nil {
		return time.Time{}, uuid.Nil, err
	}
	return time.UnixMicro(int64(binary.BigEndian.Uint64(b))).UTC(), id, nil //nolint:gosec // round-trips encodeCursor
}
