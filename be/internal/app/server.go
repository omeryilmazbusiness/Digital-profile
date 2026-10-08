package app

import (
	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
)

// Server composes every module handler into the generated contract.
// Each module contributes its operations by embedding; a missing operation is a compile error.
type Server struct {
	*health.Handler
}

var _ api.StrictServerInterface = (*Server)(nil)
