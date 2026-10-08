package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

type (
	principalKey struct{}
	requestKey   struct{}
)

// request carries per-request credentials and client details to the auth handlers.
type request struct {
	client  ClientInfo
	access  string
	refresh string
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok
}

func requestFrom(ctx context.Context) request {
	r, _ := ctx.Value(requestKey{}).(request)
	return r
}

// Guard enforces authentication for every operation whose effective OpenAPI security
// requirement is non-empty. Protection is derived from the contract, so a new operation is
// protected unless the spec explicitly marks it public (security: []), and an operation the
// guard does not know is treated as protected.
type Guard struct {
	svc     *Service
	cookies Cookies
	public  map[string]bool
}

func NewGuard(spec *openapi3.T, svc *Service, cookies Cookies) *Guard {
	public := map[string]bool{}
	for _, item := range spec.Paths.Map() {
		for _, op := range item.Operations() {
			req := spec.Security
			if op.Security != nil {
				req = *op.Security
			}
			if len(req) == 0 {
				public[handlerName(op.OperationID)] = true
			}
		}
	}
	return &Guard{svc: svc, cookies: cookies, public: public}
}

// handlerName mirrors oapi-codegen's operation naming, which is what strict middleware receives.
func handlerName(operationID string) string {
	if operationID == "" {
		return ""
	}
	return strings.ToUpper(operationID[:1]) + operationID[1:]
}

func (g *Guard) IsPublic(operation string) bool { return g.public[operation] }

// Middleware is an api.StrictMiddlewareFunc.
func (g *Guard) Middleware(next api.StrictHandlerFunc, operation string) api.StrictHandlerFunc {
	public := g.public[operation]
	return func(ctx context.Context, w http.ResponseWriter, r *http.Request, in any) (any, error) {
		access, refresh := g.cookies.read(r)
		ctx = context.WithValue(ctx, requestKey{}, request{
			client:  ClientInfo{IP: httpx.ClientIPFrom(ctx), UserAgent: r.UserAgent()},
			access:  access,
			refresh: refresh,
		})
		if !public {
			p, err := g.svc.Authenticate(ctx, access)
			if err != nil {
				return nil, err
			}
			ctx = context.WithValue(ctx, principalKey{}, p)
		}
		return next(ctx, w, r, in)
	}
}
