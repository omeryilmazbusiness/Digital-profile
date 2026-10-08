package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

// Handler implements the auth operations of api.StrictServerInterface.
type Handler struct {
	svc     *Service
	cookies Cookies
	now     func() time.Time
}

func NewHandler(svc *Service, cookies Cookies, now func() time.Time) *Handler {
	return &Handler{svc: svc, cookies: cookies, now: now}
}

func (h *Handler) Login(ctx context.Context, in api.LoginRequestObject) (api.LoginResponseObject, error) {
	req := requestFrom(ctx)
	admin, tokens, err := h.svc.Login(ctx, string(in.Body.Email), in.Body.Password, req.client)
	if err != nil {
		return nil, err
	}
	return withCookies{
		status:  http.StatusOK,
		body:    api.LoginResponse{Admin: toAPIAdmin(admin), AccessTokenExpiresAt: tokens.AccessExpiresAt},
		cookies: h.cookies.session(tokens, h.now()),
	}, nil
}

func (h *Handler) RefreshSession(ctx context.Context, _ api.RefreshSessionRequestObject) (api.RefreshSessionResponseObject, error) {
	req := requestFrom(ctx)
	tokens, err := h.svc.Refresh(ctx, req.refresh, req.client)
	if err != nil {
		return nil, err
	}
	return withCookies{
		status:  http.StatusOK,
		body:    api.SessionInfo{AccessTokenExpiresAt: tokens.AccessExpiresAt},
		cookies: h.cookies.session(tokens, h.now()),
	}, nil
}

func (h *Handler) Logout(ctx context.Context, _ api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	req := requestFrom(ctx)
	if err := h.svc.Logout(ctx, req.refresh, req.access, req.client); err != nil {
		return nil, err
	}
	return withCookies{status: http.StatusNoContent, cookies: h.cookies.cleared()}, nil
}

func (h *Handler) GetCurrentAdmin(ctx context.Context, _ api.GetCurrentAdminRequestObject) (api.GetCurrentAdminResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return nil, errUnauthenticated
	}
	admin, err := h.svc.Me(ctx, p)
	if err != nil {
		return nil, err
	}
	return api.GetCurrentAdmin200JSONResponse(toAPIAdmin(admin)), nil
}

func (h *Handler) ChangePassword(ctx context.Context, in api.ChangePasswordRequestObject) (api.ChangePasswordResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return nil, errUnauthenticated
	}
	req := requestFrom(ctx)
	tokens, err := h.svc.ChangePassword(ctx, p, in.Body.CurrentPassword, in.Body.NewPassword, req.client)
	if err != nil {
		return nil, err
	}
	return withCookies{status: http.StatusNoContent, cookies: h.cookies.session(tokens, h.now())}, nil
}

func toAPIAdmin(a Admin) api.AdminUser {
	return api.AdminUser{
		Id:                a.ID,
		Email:             openapi_types.Email(a.Email),
		LastLoginAt:       a.LastLoginAt,
		PasswordChangedAt: a.PasswordChangedAt,
	}
}

// withCookies is a strict response that sets cookies. The generated response types can only
// emit a single Set-Cookie header, while a session needs two.
type withCookies struct {
	status  int
	body    any
	cookies []*http.Cookie
}

func (r withCookies) write(w http.ResponseWriter) error {
	for _, c := range r.cookies {
		http.SetCookie(w, c)
	}
	w.Header().Set("Cache-Control", "no-store")
	if r.body == nil {
		w.WriteHeader(r.status)
		return nil
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(r.status)
	return json.NewEncoder(w).Encode(r.body)
}

func (r withCookies) VisitLoginResponse(w http.ResponseWriter) error          { return r.write(w) }
func (r withCookies) VisitRefreshSessionResponse(w http.ResponseWriter) error { return r.write(w) }
func (r withCookies) VisitLogoutResponse(w http.ResponseWriter) error         { return r.write(w) }
func (r withCookies) VisitChangePasswordResponse(w http.ResponseWriter) error { return r.write(w) }
