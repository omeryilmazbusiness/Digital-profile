package config

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

const (
	StorageLocal = "local"
	StorageS3    = "s3"
)

type Storage struct {
	// Driver selects the blob store: "local" (filesystem) or "s3" (any S3-compatible service).
	Driver   string `env:"DRIVER"    envDefault:"local"`
	LocalDir string `env:"LOCAL_DIR" envDefault:"./data/storage"`
}

// S3 shares its variable names with the development RustFS container (S3_ACCESS_KEY, ...).
type S3 struct {
	Endpoint  string `env:"ENDPOINT"`
	Region    string `env:"REGION"     envDefault:"us-east-1"`
	Bucket    string `env:"BUCKET"`
	AccessKey string `env:"ACCESS_KEY"`
	SecretKey string `env:"SECRET_KEY"`
	// PathStyle is required by RustFS/MinIO; R2 and AWS work with either.
	PathStyle bool `env:"PATH_STYLE" envDefault:"true"`
}

type Media struct {
	// MaxUploadBytes caps a single image upload (the whole multipart request).
	MaxUploadBytes int64 `env:"MAX_UPLOAD_BYTES" envDefault:"20971520"`
	// MaxPixels rejects decompression bombs before decoding: a 50 MP limit admits 48 MP
	// phone photos while bounding decode memory.
	MaxPixels int `env:"MAX_PIXELS" envDefault:"50000000"`
	// ProcessingConcurrency bounds simultaneous decodes; each can need a few hundred MB.
	ProcessingConcurrency int `env:"PROCESSING_CONCURRENCY" envDefault:"1"`
	WebPQuality           int `env:"WEBP_QUALITY"           envDefault:"82"`
	// PublicBaseURL prefixes media URLs in API responses (e.g. a CDN). Empty means paths
	// relative to the API origin.
	PublicBaseURL string `env:"PUBLIC_BASE_URL"`
}

// Documents configures the PDF brochures of the Discover section.
type Documents struct {
	// MaxUploadBytes caps a single PDF.
	MaxUploadBytes int64 `env:"MAX_UPLOAD_BYTES" envDefault:"26214400"`
}

func (d Documents) validate() []error {
	if d.MaxUploadBytes < 1<<20 || d.MaxUploadBytes > 100<<20 {
		return []error{fmt.Errorf("DOCUMENTS_MAX_UPLOAD_BYTES must be between 1 MiB and 100 MiB, got %d", d.MaxUploadBytes)}
	}
	return nil
}

func (s Storage) validate(s3 S3) []error {
	var errs []error
	switch s.Driver {
	case StorageLocal:
		if strings.TrimSpace(s.LocalDir) == "" {
			errs = append(errs, errors.New("STORAGE_LOCAL_DIR must not be empty"))
		}
	case StorageS3:
		if u, err := url.Parse(s3.Endpoint); err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			errs = append(errs, errors.New("S3_ENDPOINT must be an http(s) URL when STORAGE_DRIVER=s3"))
		}
		if s3.Bucket == "" || s3.AccessKey == "" || s3.SecretKey == "" {
			errs = append(errs, errors.New("S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY are required when STORAGE_DRIVER=s3"))
		}
	default:
		errs = append(errs, fmt.Errorf("STORAGE_DRIVER %q is not one of local|s3", s.Driver))
	}
	return errs
}

func (m Media) validate(production bool) []error {
	var errs []error
	if m.MaxUploadBytes < 1<<20 || m.MaxUploadBytes > 100<<20 {
		errs = append(errs, fmt.Errorf("MEDIA_MAX_UPLOAD_BYTES must be between 1 MiB and 100 MiB, got %d", m.MaxUploadBytes))
	}
	if m.MaxPixels < 1_000_000 || m.MaxPixels > 200_000_000 {
		errs = append(errs, fmt.Errorf("MEDIA_MAX_PIXELS must be between 1e6 and 2e8, got %d", m.MaxPixels))
	}
	if m.ProcessingConcurrency < 1 || m.ProcessingConcurrency > 16 {
		errs = append(errs, fmt.Errorf("MEDIA_PROCESSING_CONCURRENCY must be between 1 and 16, got %d", m.ProcessingConcurrency))
	}
	if m.WebPQuality < 50 || m.WebPQuality > 100 {
		errs = append(errs, fmt.Errorf("MEDIA_WEBP_QUALITY must be between 50 and 100, got %d", m.WebPQuality))
	}
	if m.PublicBaseURL != "" {
		u, err := url.Parse(m.PublicBaseURL)
		switch {
		case err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || strings.HasSuffix(m.PublicBaseURL, "/"):
			errs = append(errs, fmt.Errorf("MEDIA_PUBLIC_BASE_URL %q must be an absolute URL without a trailing slash", m.PublicBaseURL))
		case production && u.Scheme != "https":
			errs = append(errs, errors.New("MEDIA_PUBLIC_BASE_URL must use https in production"))
		}
	}
	return errs
}
