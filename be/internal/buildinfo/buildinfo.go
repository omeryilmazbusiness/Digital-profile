// Package buildinfo exposes metadata injected at link time.
package buildinfo

// Version is overridden at build time:
//
//	go build -ldflags "-X github.com/omeryilmazbusiness/digital-profile/be/internal/buildinfo.Version=1.2.3"
var Version = "dev"
