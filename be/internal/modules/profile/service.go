package profile

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/imaging"
)

const (
	// photoSize keeps the embedded vCard photo sharp on retina screens yet the card small
	// (tens of kilobytes), well under what contacts apps accept.
	photoSize    = 512
	photoQuality = 85
	// maxPhotoSourceBytes bounds what is read from storage to render the photo.
	maxPhotoSourceBytes = 8 << 20
)

var (
	errNotSetUp        = apperr.NotFound("the profile has not been set up yet")
	errNotPublished    = apperr.NotFound("the profile is not published yet")
	errPortraitField   = apperr.FieldError{Field: "portraitMediaId", Message: "image not found"}
	errCardPhotoField  = apperr.FieldError{Field: "vcardPhotoMediaId", Message: "image not found"}
	imageFieldByFKName = map[string]apperr.FieldError{
		"profile_portrait_media_id_fkey":    errPortraitField,
		"profile_vcard_photo_media_id_fkey": errCardPhotoField,
	}
)

// Images is the part of the media library the profile needs. *media.Service implements it.
type Images interface {
	Get(ctx context.Context, id uuid.UUID) (media.Media, error)
	OpenImage(ctx context.Context, id uuid.UUID, minWidth int) (io.ReadCloser, error)
}

type Service struct {
	pool    *pgxpool.Pool
	tx      database.Transactor
	images  Images
	siteURL string
	log     *slog.Logger

	// The vCard photo of a portrait never changes (variants are immutable), so it is
	// rendered once per portrait.
	photoMu  sync.Mutex
	photoFor uuid.UUID
	photo    []byte
}

// NewService wires the service. siteURL is the public site, written into the vCard.
func NewService(pool *pgxpool.Pool, images Images, siteURL string, log *slog.Logger) *Service {
	return &Service{pool: pool, tx: database.NewTxManager(pool), images: images, siteURL: siteURL, log: log}
}

func (s *Service) q(ctx context.Context) *store.Queries {
	return store.New(database.Executor(ctx, s.pool))
}

// Get returns the profile as last saved, complete or not.
func (s *Service) Get(ctx context.Context) (Profile, error) {
	q := s.q(ctx)
	row, err := q.GetProfile(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, errNotSetUp
	}
	if err != nil {
		return Profile{}, database.MapError(err)
	}
	translations, err := q.ListTranslations(ctx)
	if err != nil {
		return Profile{}, database.MapError(err)
	}

	p := Profile{
		FirstName: row.FirstName, LastName: row.LastName, Organization: row.Organization,
		Phone: val(row.Phone), WhatsApp: val(row.Whatsapp), Email: val(row.Email),
		Languages: row.Languages, PostalCode: row.PostalCode, MapURL: row.MapUrl, LinkedInURL: row.LinkedinUrl,
		Translations: make(map[string]Translation, len(translations)),
		UpdatedAt:    row.UpdatedAt.UTC(),
	}
	for i := range translations {
		t := &translations[i]
		p.Translations[t.Locale] = Translation{
			Title: t.Title, Tagline: t.Tagline, Bio: t.Bio, WhatsAppMessage: t.WhatsappMessage,
			DisplayName: t.DisplayName, Address: Address{Street: t.Street, City: t.City, Country: t.Country},
		}
	}
	if p.Portrait, err = s.image(ctx, row.PortraitMediaID); err != nil {
		return Profile{}, err
	}
	if p.VCardPhoto, err = s.image(ctx, row.VcardPhotoMediaID); err != nil {
		return Profile{}, err
	}
	return p, nil
}

func (s *Service) image(ctx context.Context, id *uuid.UUID) (*media.Media, error) {
	if id == nil {
		return nil, nil //nolint:nilnil // no image chosen
	}
	m, err := s.images.Get(ctx, *id)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Published returns the profile only when it is complete, so visitors never see a
// half-filled card.
func (s *Service) Published(ctx context.Context) (Profile, error) {
	p, err := s.Get(ctx)
	if apperr.KindOf(err) == apperr.KindNotFound {
		return Profile{}, errNotPublished
	}
	if err != nil {
		return Profile{}, err
	}
	if !p.Complete() {
		return Profile{}, errNotPublished
	}
	return p, nil
}

// Update replaces the profile; translations left out are removed.
func (s *Service) Update(ctx context.Context, in Input) (Profile, error) {
	in, fields := normalize(in)
	for _, img := range []struct {
		id    *uuid.UUID
		field apperr.FieldError
	}{{in.PortraitMediaID, errPortraitField}, {in.VCardPhotoMediaID, errCardPhotoField}} {
		if img.id == nil {
			continue
		}
		if _, err := s.images.Get(ctx, *img.id); apperr.KindOf(err) == apperr.KindNotFound {
			fields = append(fields, img.field)
		} else if err != nil {
			return Profile{}, err
		}
	}
	if len(fields) > 0 {
		return Profile{}, apperr.Invalid("request validation failed", fields...)
	}

	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if _, err := q.UpsertProfile(ctx, store.UpsertProfileParams{
			FirstName: in.FirstName, LastName: in.LastName, Organization: in.Organization,
			PortraitMediaID: in.PortraitMediaID, VcardPhotoMediaID: in.VCardPhotoMediaID,
			Phone: opt(in.Phone), Whatsapp: opt(in.WhatsApp), Email: opt(in.Email),
			Languages: in.Languages, PostalCode: in.PostalCode, MapUrl: in.MapURL, LinkedinUrl: in.LinkedInURL,
		}); err != nil {
			return err
		}
		if err := q.DeleteTranslations(ctx); err != nil {
			return err
		}
		for _, loc := range Locales {
			t, ok := in.Translations[loc]
			if !ok {
				continue
			}
			if err := q.CreateTranslation(ctx, store.CreateTranslationParams{
				Locale: loc, Title: t.Title, Tagline: t.Tagline, Bio: t.Bio, WhatsappMessage: t.WhatsAppMessage,
				DisplayName: t.DisplayName, Street: t.Address.Street, City: t.Address.City, Country: t.Address.Country,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		// An image was deleted between the check above and the write.
		if field, ok := imageFieldByFKName[database.ConstraintName(err)]; ok {
			return Profile{}, apperr.Invalid("request validation failed", field)
		}
		return Profile{}, database.MapError(err)
	}
	return s.Get(ctx)
}

// VCard renders the published profile as a contact card, texts in locale when available.
// A portrait that cannot be rendered is left out rather than failing the download.
func (s *Service) VCard(ctx context.Context, locale string) (Profile, []byte, error) {
	p, err := s.Published(ctx)
	if err != nil {
		return Profile{}, nil, err
	}
	_, t := p.Localized(locale)
	addr := p.AddressIn(t)
	card := Card{
		FirstName: p.FirstName, LastName: p.LastName, FullName: p.NameIn(t),
		Organization: p.Organization, Title: t.Title, Note: t.Tagline,
		Phone: p.Phone, WhatsApp: p.WhatsApp, Email: p.Email, URL: s.siteURL, LinkedIn: p.LinkedInURL,
		Street: addr.Street, City: addr.City, PostalCode: p.PostalCode, Country: addr.Country,
		Revision: p.UpdatedAt,
	}
	if photo := p.CardPhoto(); photo != nil {
		if card.Photo, err = s.vcardPhoto(ctx, photo.ID); err != nil {
			s.log.ErrorContext(ctx, "render vcard photo", "media_id", photo.ID, "error", err)
		}
	}
	return p, card.Encode(), nil
}

func (s *Service) vcardPhoto(ctx context.Context, id uuid.UUID) ([]byte, error) {
	s.photoMu.Lock()
	defer s.photoMu.Unlock()
	if s.photoFor == id && s.photo != nil {
		return s.photo, nil
	}
	rc, err := s.images.OpenImage(ctx, id, photoSize)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	src, err := io.ReadAll(io.LimitReader(rc, maxPhotoSourceBytes))
	if err != nil {
		return nil, err
	}
	jpg, err := imaging.SquareJPEG(src, photoSize, photoQuality)
	if err != nil {
		return nil, err
	}
	s.photoFor, s.photo = id, jpg
	return jpg, nil
}
