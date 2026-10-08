package app

import (
	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
)

// AuthHandler is a named alias so the embedded field does not clash with health.Handler.
type AuthHandler = auth.Handler

// Server composes every module handler into the generated contract.
// Each module contributes its operations by embedding; a missing operation is a compile error.
type Server struct {
	*health.Handler
	*AuthHandler
}

var _ api.StrictServerInterface = (*Server)(nil)
