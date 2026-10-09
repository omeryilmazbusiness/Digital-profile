package profile

import (
	"bytes"
	"context"
	"net/http"
	"strconv"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
)

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
	return api.GetPublicProfile200JSONResponse(toPublicAPI(&p, locale(in.Params.Locale))), nil
}

func (h *Handler) GetProfileVCard(ctx context.Context, in api.GetProfileVCardRequestObject) (api.GetProfileVCardResponseObject, error) {
	p, card, err := h.svc.VCard(ctx, locale(in.Params.Locale))
	if err != nil {
		return nil, err
	}
	return vcardResponse{body: card, disposition: Filename(p.FullName())}, nil
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
		PortraitMediaID: b.PortraitMediaId,
		Phone:           val(b.Phone), WhatsApp: val(b.Whatsapp), Email: val(b.Email),
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
			in.Translations[loc] = Translation{
				Title: t.Title, Tagline: val(t.Tagline), Bio: val(t.Bio), WhatsAppMessage: val(t.WhatsappMessage),
			}
		}
	}
	return in
}

func toAPI(p *Profile) api.Profile {
	out := api.Profile{
		FirstName: p.FirstName, LastName: p.LastName, FullName: p.FullName(), Organization: p.Organization,
		Phone: opt(p.Phone), Whatsapp: opt(p.WhatsApp), Email: opt(p.Email),
		Languages: languages(p.Languages), Complete: p.Complete(), UpdatedAt: p.UpdatedAt,
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
	for loc, t := range p.Translations {
		at := &api.ProfileTranslation{
			Title: t.Title, Tagline: opt(t.Tagline), Bio: opt(t.Bio), WhatsappMessage: opt(t.WhatsAppMessage),
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

func toPublicAPI(p *Profile, requested string) api.PublicProfile {
	loc, t := p.Localized(requested)
	out := api.PublicProfile{
		Locale: api.Locale(loc), FirstName: p.FirstName, LastName: p.LastName, FullName: p.FullName(),
		Organization: p.Organization, Title: t.Title, Tagline: opt(t.Tagline), Bio: opt(t.Bio),
		Email: opt(p.Email), Languages: languages(p.Languages),
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
