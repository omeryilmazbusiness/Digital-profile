package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Config configures an S3-compatible backend.
type S3Config struct {
	// Endpoint is a URL such as https://<account>.r2.cloudflarestorage.com or http://localhost:9000.
	Endpoint  string
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
	// PathStyle addresses buckets as /bucket/key instead of bucket.host (RustFS, MinIO).
	PathStyle bool
	// Transport overrides the HTTP transport (tests).
	Transport http.RoundTripper
}

// S3 stores objects in an S3-compatible bucket. A single PUT is atomic by S3 semantics.
type S3 struct {
	client *minio.Client
	bucket string
}

func NewS3(cfg S3Config) (*S3, error) {
	u, err := url.Parse(cfg.Endpoint)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("storage: invalid S3 endpoint %q", cfg.Endpoint)
	}
	lookup := minio.BucketLookupDNS
	if cfg.PathStyle {
		lookup = minio.BucketLookupPath
	}
	client, err := minio.New(u.Host, &minio.Options{
		Creds:        credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure:       u.Scheme == "https",
		Region:       cfg.Region,
		BucketLookup: lookup,
		Transport:    cfg.Transport,
	})
	if err != nil {
		return nil, fmt.Errorf("storage: S3 client: %w", err)
	}
	return &S3{client: client, bucket: cfg.Bucket}, nil
}

func (s *S3) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	_, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{
		ContentType:      contentType,
		DisableMultipart: size >= 0 && size < 64<<20,
	})
	if err != nil {
		return fmt.Errorf("storage: put %s: %w", key, err)
	}
	return nil
}

func (s *S3) Get(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	if err := checkKey(key); err != nil {
		return nil, Object{}, err
	}
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, Object{}, mapS3Error(err)
	}
	// GetObject is lazy; Stat performs the request and surfaces missing objects.
	info, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, Object{}, mapS3Error(err)
	}
	return obj, toObject(info), nil
}

func (s *S3) Stat(ctx context.Context, key string) (Object, error) {
	if err := checkKey(key); err != nil {
		return Object{}, err
	}
	info, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return Object{}, mapS3Error(err)
	}
	return toObject(info), nil
}

func (s *S3) Delete(ctx context.Context, key string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		if errors.Is(mapS3Error(err), ErrNotFound) {
			return nil
		}
		return fmt.Errorf("storage: delete %s: %w", key, err)
	}
	return nil
}

// Ping confirms credentials and bucket access with a HEAD on the bucket.
func (s *S3) Ping(ctx context.Context) error {
	ok, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("storage: S3 unreachable: %w", err)
	}
	if !ok {
		return fmt.Errorf("storage: bucket %q does not exist", s.bucket)
	}
	return nil
}

func toObject(info minio.ObjectInfo) Object {
	return Object{Size: info.Size, ContentType: info.ContentType, ModTime: info.LastModified}
}

func mapS3Error(err error) error {
	resp := minio.ToErrorResponse(err)
	if resp.Code == minio.NoSuchKey || resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	return fmt.Errorf("storage: %w", err)
}

func randomSuffix() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
