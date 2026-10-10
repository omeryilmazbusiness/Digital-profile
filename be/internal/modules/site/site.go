// Package site assembles everything the public site shows into one response, so a page
// renders from a single request. It owns no data: each part comes from its module.
package site

import (
	"context"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/discover"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/settings"
)

// The parts of other modules the site reads; their services implement them.
type (
	Profiles interface {
		Published(ctx context.Context) (profile.Profile, error)
	}
	Topics interface {
		List(ctx context.Context) ([]discover.Section, error)
	}
	Settings interface {
		Get(ctx context.Context) (settings.Settings, error)
	}
)

// Handler implements the site operation of api.StrictServerInterface.
type Handler struct {
	profiles Profiles
	topics   Topics
	settings Settings
}

func NewHandler(profiles Profiles, topics Topics, opts Settings) *Handler {
	return &Handler{profiles: profiles, topics: topics, settings: opts}
}

func (h *Handler) GetPublicSite(ctx context.Context, in api.GetPublicSiteRequestObject) (api.GetPublicSiteResponseObject, error) {
	locale := discover.Locales[0]
	if in.Params.Locale != nil {
		locale = string(*in.Params.Locale)
	}
	out := api.PublicSite{Locale: api.Locale(locale)}

	// An unpublished profile is a normal state: the site shows its placeholder.
	p, err := h.profiles.Published(ctx)
	switch {
	case err == nil:
		pub := profile.ToPublicAPI(&p, locale)
		out.Profile = &pub
	case apperr.KindOf(err) != apperr.KindNotFound:
		return nil, err
	}

	sections, err := h.topics.List(ctx)
	if err != nil {
		return nil, err
	}
	out.Sections = discover.ToPublicAPI(sections, locale)

	st, err := h.settings.Get(ctx)
	if err != nil {
		return nil, err
	}
	if st.TourURL != "" {
		out.Tour = &api.PublicTour{Url: st.TourURL}
	}
	return api.GetPublicSite200JSONResponse(out), nil
}
