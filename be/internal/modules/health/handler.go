package health

import (
	"context"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

// Handler implements the system endpoints of api.StrictServerInterface.
type Handler struct {
	svc     *Service
	version string
}

func NewHandler(svc *Service, version string) *Handler {
	return &Handler{svc: svc, version: version}
}

func (h *Handler) GetLiveness(_ context.Context, _ api.GetLivenessRequestObject) (api.GetLivenessResponseObject, error) {
	return api.GetLiveness200JSONResponse{Status: api.Up, Version: h.version}, nil
}

func (h *Handler) GetReadiness(ctx context.Context, _ api.GetReadinessRequestObject) (api.GetReadinessResponseObject, error) {
	results := h.svc.Check(ctx)

	report := api.HealthReport{Status: api.Up, Version: h.version}
	checks := make([]api.HealthCheck, 0, len(results))
	for _, r := range results {
		c := api.HealthCheck{Name: r.Name, Status: api.Up}
		if r.Err != nil {
			msg := r.Err.Error()
			c.Status, c.Error = api.Down, &msg
			report.Status = api.Down
		}
		checks = append(checks, c)
	}
	report.Checks = &checks

	if report.Status == api.Down {
		return api.GetReadiness503JSONResponse(report), nil
	}
	return api.GetReadiness200JSONResponse(report), nil
}
