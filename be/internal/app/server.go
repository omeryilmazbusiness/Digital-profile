package app

import (
	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
)

// Module handlers are embedded under aliases so their field names do not clash.
type (
	AuthHandler    = auth.Handler
	MediaHandler   = media.Handler
	ProfileHandler = profile.Handler
)

// Server composes every module handler into the generated contract.
// Each module contributes its operations by embedding; a missing operation is a compile error.
type Server struct {
	*health.Handler
	*AuthHandler
	*MediaHandler
	*ProfileHandler
}

var _ api.StrictServerInterface = (*Server)(nil)
