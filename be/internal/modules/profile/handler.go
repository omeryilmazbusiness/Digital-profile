package profile

import (
	"bytes"
	"context"
	"net/http"
	"strconv"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
)

// businessCardCache revalidates every download: the URL stays the same when a new card is chosen.
const businessCardCache = "public, no-cache"

// Handler implements the profile operations of api.StrictServerInterface.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetProfile(ctx context.Context, _ api.GetProfileRequestObject) (api.GetProfileResponseObject, error) {
	p, err := h.svc.Get(ctx)
	if err != nil {
		return nil, err
	}
	return api.GetProfile200JSONResponse(toAPI(&p)), nil
}

func (h *Handler) UpdateProfile(ctx context.Context, in api.UpdateProfileRequestObject) (api.UpdateProfileResponseObject, error) {
	p, err := h.svc.Update(ctx, fromAPI(in.Body))
	if err != nil {
		return nil, err
	}
	return api.UpdateProfile200JSONResponse(toAPI(&p)), nil
}

func (h *Handler) GetPublicProfile(ctx context.Context, in api.GetPublicProfileRequestObject) (api.GetPublicProfileResponseObject, error) {
	p, err := h.svc.Published(ctx)
	if err != nil {
		return nil, err
	}
	return api.GetPublicProfile200JSONResponse(ToPublicAPI(&p, locale(in.Params.Locale))), nil
}

func (h *Handler) GetProfileVCard(ctx context.Context, in api.GetProfileVCardRequestObject) (api.GetProfileVCardResponseObject, error) {
	p, card, err := h.svc.VCard(ctx, locale(in.Params.Locale))
	if err != nil {
		return nil, err
	}
	return vcardResponse{body: card, disposition: Filename(p.FullName())}, nil
}

func (h *Handler) GetProfileBusinessCard(ctx context.Context, in api.GetProfileBusinessCardRequestObject) (api.GetProfileBusinessCardResponseObject, error) {
	p, err := h.svc.BusinessCard(ctx)
	if err != nil {
		return nil, err
	}
	etag, cache := `"`+p.BusinessCard.ID.String()+`"`, businessCardCache
	if in.Params.IfNoneMatch != nil && httpx.ETagMatches(*in.Params.IfNoneMatch, etag) {
		return api.GetProfileBusinessCard304Response{
			Headers: api.GetProfileBusinessCard304ResponseHeaders{CacheControl: &cache, ETag: &etag},
		}, nil
	}
	jpg, err := h.svc.BusinessCardJPEG(ctx, p.BusinessCard.ID)
	if err != nil {
		return nil, err
	}
	return businessCardResponse{body: jpg, etag: etag, disposition: BusinessCardFilename(p.FullName())}, nil
}

// businessCardResponse adds the cross-origin resource policy the generated type cannot
// express: the site may run on another origin than the API.
type businessCardResponse struct {
	body        []byte
	etag        string
	disposition string
}

func (r businessCardResponse) VisitGetProfileBusinessCardResponse(w http.ResponseWriter) error {
	h := w.Header()
	h.Set("Content-Type", "image/jpeg")
	h.Set("Content-Length", strconv.Itoa(len(r.body)))
	h.Set("Content-Disposition", r.disposition)
	h.Set("Cache-Control", businessCardCache)
	h.Set("ETag", r.etag)
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	w.WriteHeader(http.StatusOK)
	_, err := bytes.NewReader(r.body).WriteTo(w)
	return err
}

// vcardResponse adds the charset the generated response type leaves out: without it some
// Android versions decode the card as Latin-1 and garble Arabic names.
type vcardResponse struct {
	body        []byte
	disposition string
}

func (r vcardResponse) VisitGetProfileVCardResponse(w http.ResponseWriter) error {
	h := w.Header()
	h.Set("Content-Type", "text/vcard; charset=utf-8")
	h.Set("Content-Length", strconv.Itoa(len(r.body)))
	h.Set("Content-Disposition", r.disposition)
	w.WriteHeader(http.StatusOK)
	_, err := bytes.NewReader(r.body).WriteTo(w)
	return err
}

func locale(l *api.LocaleQuery) string {
	if l == nil {
		return Locales[0]
	}
	return string(*l)
}

func fromAPI(b *api.ProfileInput) Input {
	in := Input{
		FirstName: b.FirstName, LastName: val(b.LastName), Organization: val(b.Organization),
		PortraitMediaID: b.PortraitMediaId, VCardPhotoMediaID: b.VcardPhotoMediaId,
		BusinessCardMediaID: b.BusinessCardMediaId,
		Phone:               val(b.Phone), WhatsApp: val(b.Whatsapp), Email: val(b.Email),
		PostalCode: val(b.PostalCode), MapURL: val(b.MapUrl), LinkedInURL: val(b.LinkedinUrl),
		Translations: map[string]Translation{},
	}
	if b.Languages != nil {
		in.Languages = make([]string, len(*b.Languages))
		for i, l := range *b.Languages {
			in.Languages[i] = string(l)
		}
	}
	for loc, t := range map[string]*api.ProfileTranslation{"en": b.Translations.En, "id": b.Translations.Id, "ar": b.Translations.Ar} {
		if t != nil {
			tr := Translation{
				Title: t.Title, Tagline: val(t.Tagline), Bio: val(t.Bio), WhatsAppMessage: val(t.WhatsappMessage),
				DisplayName: val(t.DisplayName),
			}
			if a := t.Address; a != nil {
				tr.Address = Address{Street: val(a.Street), City: val(a.City), Country: val(a.Country)}
			}
			in.Translations[loc] = tr
		}
	}
	return in
}

func toAPI(p *Profile) api.Profile {
	out := api.Profile{
		FirstName: p.FirstName, LastName: p.LastName, FullName: p.FullName(), Organization: p.Organization,
		Phone: opt(p.Phone), Whatsapp: opt(p.WhatsApp), Email: opt(p.Email),
		Languages: languages(p.Languages), Complete: p.Complete(), UpdatedAt: p.UpdatedAt,
		PostalCode: opt(p.PostalCode), MapUrl: opt(p.MapURL), LinkedinUrl: opt(p.LinkedInURL),
	}
	for _, m := range p.Missing() {
		out.Missing = append(out.Missing, api.ProfileMissing(m))
	}
	if out.Missing == nil {
		out.Missing = []api.ProfileMissing{}
	}
	if p.Portrait != nil {
		m := media.ToAPI(p.Portrait)
		out.Portrait = &m
	}
	if p.VCardPhoto != nil {
		m := media.ToAPI(p.VCardPhoto)
		out.VcardPhoto = &m
	}
	if p.BusinessCard != nil {
		m := media.ToAPI(p.BusinessCard)
		out.BusinessCard = &m
	}
	for loc := range p.Translations {
		t := p.Translations[loc]
		at := &api.ProfileTranslation{
			Title: t.Title, Tagline: opt(t.Tagline), Bio: opt(t.Bio), WhatsappMessage: opt(t.WhatsAppMessage),
			DisplayName: opt(t.DisplayName),
		}
		if !t.Address.IsZero() {
			at.Address = &api.Address{Street: opt(t.Address.Street), City: opt(t.Address.City), Country: opt(t.Address.Country)}
		}
		switch loc {
		case "en":
			out.Translations.En = at
		case "id":
			out.Translations.Id = at
		case "ar":
			out.Translations.Ar = at
		}
	}
	return out
}

// ToPublicAPI maps the published profile to what visitors see in the requested language.
func ToPublicAPI(p *Profile, requested string) api.PublicProfile {
	loc, t := p.Localized(requested)
	out := api.PublicProfile{
		Locale: api.Locale(loc), FirstName: p.FirstName, LastName: p.LastName, FullName: p.FullName(),
		DisplayName: p.NameIn(t), Organization: p.Organization, Title: t.Title, Tagline: opt(t.Tagline),
		Bio: opt(t.Bio), Email: opt(p.Email), Languages: languages(p.Languages),
		MapUrl: opt(p.MapURL), LinkedinUrl: opt(p.LinkedInURL),
	}
	if a := p.AddressIn(t); !a.IsZero() || p.PostalCode != "" {
		out.Address = &api.PublicAddress{Street: a.Street, City: a.City, PostalCode: p.PostalCode, Country: a.Country}
	}
	if p.Phone != "" {
		out.Phone = &api.PhoneNumber{E164: p.Phone, Display: DisplayPhone(p.Phone)}
	}
	if p.WhatsApp != "" {
		out.Whatsapp = &api.WhatsAppContact{
			E164: p.WhatsApp, Display: DisplayPhone(p.WhatsApp), Url: WhatsAppURL(p.WhatsApp, t.WhatsAppMessage),
		}
	}
	if m := p.Portrait; m != nil {
		img := &api.PublicImage{
			Width: int32(m.Width), Height: int32(m.Height), //nolint:gosec // bounded by imaging limits
			Placeholder: m.Placeholder, Alt: opt(m.AltText[loc]),
			Variants: make([]api.ImageVariant, len(m.Variants)),
		}
		for i, v := range m.Variants {
			img.Variants[i] = api.ImageVariant{
				Width: int32(v.Width), Height: int32(v.Height), //nolint:gosec // bounded by imaging limits
				Url: v.URL, ByteSize: v.ByteSize,
			}
		}
		out.Portrait = img
	}
	if p.BusinessCard != nil {
		u := BusinessCardPath + "?locale=" + loc
		out.BusinessCardUrl = &u
	}
	return out
}

func languages(codes []string) []api.SpokenLanguage {
	out := make([]api.SpokenLanguage, len(codes))
	for i, c := range codes {
		out[i] = api.SpokenLanguage(c)
	}
	return out
}

func opt(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func val(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
