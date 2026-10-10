// Package settings holds site-wide options: for now, where the virtual tour lives.
package settings

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/settings/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

type Settings struct {
	// TourURL is the 360° virtual tour; empty hides the tour section.
	TourURL string
	// UpdatedAt is zero until the settings are saved for the first time.
	UpdatedAt time.Time
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) q(ctx context.Context) *store.Queries {
	return store.New(database.Executor(ctx, s.pool))
}

// Get returns the saved settings, or the defaults before the first save.
func (s *Service) Get(ctx context.Context) (Settings, error) {
	row, err := s.q(ctx).GetSettings(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return Settings{}, nil
	}
	if err != nil {
		return Settings{}, database.MapError(err)
	}
	return Settings{TourURL: row.TourUrl, UpdatedAt: row.UpdatedAt.UTC()}, nil
}

func (s *Service) Update(ctx context.Context, in Settings) (Settings, error) {
	var v validation.Fields
	tour := v.HTTPSURL("tourUrl", in.TourURL)
	if err := v.Err(); err != nil {
		return Settings{}, err
	}
	row, err := s.q(ctx).UpsertSettings(ctx, tour)
	if err != nil {
		return Settings{}, database.MapError(err)
	}
	return Settings{TourURL: row.TourUrl, UpdatedAt: row.UpdatedAt.UTC()}, nil
}

// Handler implements the settings operations of api.StrictServerInterface.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) GetSettings(ctx context.Context, _ api.GetSettingsRequestObject) (api.GetSettingsResponseObject, error) {
	st, err := h.svc.Get(ctx)
	if err != nil {
		return nil, err
	}
	return api.GetSettings200JSONResponse(toAPI(st)), nil
}

func (h *Handler) UpdateSettings(ctx context.Context, in api.UpdateSettingsRequestObject) (api.UpdateSettingsResponseObject, error) {
	var tour string
	if in.Body.TourUrl != nil {
		tour = *in.Body.TourUrl
	}
	st, err := h.svc.Update(ctx, Settings{TourURL: tour})
	if err != nil {
		return nil, err
	}
	return api.UpdateSettings200JSONResponse(toAPI(st)), nil
}

func toAPI(st Settings) api.Settings {
	out := api.Settings{UpdatedAt: st.UpdatedAt}
	if st.TourURL != "" {
		out.TourUrl = &st.TourURL
	}
	return out
}
