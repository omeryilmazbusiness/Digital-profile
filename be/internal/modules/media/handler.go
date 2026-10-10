package media

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

// immutableCache lets browsers and CDNs keep a variant forever: its URL is its content hash.
const immutableCache = "public, max-age=31536000, immutable"

// Handler implements the media operations of api.StrictServerInterface.
type Handler struct {
	svc            *Service
	maxUploadBytes int64
}

func NewHandler(svc *Service, maxUploadBytes int64) *Handler {
	return &Handler{svc: svc, maxUploadBytes: maxUploadBytes}
}

func (h *Handler) ListMedia(ctx context.Context, in api.ListMediaRequestObject) (api.ListMediaResponseObject, error) {
	limit := DefaultPageSize
	if in.Params.Limit != nil {
		limit = *in.Params.Limit
	}
	cursor := ""
	if in.Params.Cursor != nil {
		cursor = *in.Params.Cursor
	}
	items, next, err := h.svc.List(ctx, limit, cursor)
	if err != nil {
		return nil, err
	}
	page := api.MediaPage{Items: make([]api.Media, len(items))}
	for i := range items {
		page.Items[i] = ToAPI(&items[i])
	}
	if next != "" {
		page.NextCursor = &next
	}
	return api.ListMedia200JSONResponse(page), nil
}

// UploadMedia streams the multipart body: only the "file" part is read, and never more than
// the upload limit, so oversized files fail without being buffered.
func (h *Handler) UploadMedia(ctx context.Context, in api.UploadMediaRequestObject) (api.UploadMediaResponseObject, error) {
	if in.Body == nil {
		return nil, missingFile()
	}
	var (
		data     []byte
		filename string
		found    bool
	)
	for {
		part, err := in.Body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				return nil, err
			}
			return nil, apperr.BadRequest("malformed multipart body").Wrap(err)
		}
		if part.FormName() != "file" || found {
			_ = part.Close()
			continue
		}
		found = true
		filename = part.FileName()
		data, err = io.ReadAll(io.LimitReader(part, h.maxUploadBytes+1))
		_ = part.Close()
		if err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				return nil, err
			}
			return nil, apperr.BadRequest("malformed multipart body").Wrap(err)
		}
		if int64(len(data)) > h.maxUploadBytes {
			return nil, apperr.New(apperr.KindTooLarge, "the image exceeds the "+humanBytes(h.maxUploadBytes)+" upload limit")
		}
	}
	if !found {
		return nil, missingFile()
	}

	m, created, err := h.svc.Upload(ctx, filename, data)
	if err != nil {
		return nil, err
	}
	if created {
		return api.UploadMedia201JSONResponse(ToAPI(&m)), nil
	}
	return api.UploadMedia200JSONResponse(ToAPI(&m)), nil
}

func missingFile() error {
	return apperr.BadRequest("request validation failed", apperr.FieldError{Field: "file", Message: "is required"})
}

func humanBytes(n int64) string {
	return strconv.FormatInt(n>>20, 10) + " MB"
}

func (h *Handler) GetMedia(ctx context.Context, in api.GetMediaRequestObject) (api.GetMediaResponseObject, error) {
	m, err := h.svc.Get(ctx, in.MediaId)
	if err != nil {
		return nil, err
	}
	return api.GetMedia200JSONResponse(ToAPI(&m)), nil
}

func (h *Handler) UpdateMediaAltText(ctx context.Context, in api.UpdateMediaAltTextRequestObject) (api.UpdateMediaAltTextResponseObject, error) {
	alt := map[string]string{}
	for loc, v := range map[string]*api.AltText{"en": in.Body.En, "id": in.Body.Id, "ar": in.Body.Ar} {
		if v != nil {
			alt[loc] = *v
		}
	}
	m, err := h.svc.UpdateAltText(ctx, in.MediaId, alt)
	if err != nil {
		return nil, err
	}
	return api.UpdateMediaAltText200JSONResponse(ToAPI(&m)), nil
}

func (h *Handler) DeleteMedia(ctx context.Context, in api.DeleteMediaRequestObject) (api.DeleteMediaResponseObject, error) {
	if err := h.svc.Delete(ctx, in.MediaId); err != nil {
		return nil, err
	}
	return api.DeleteMedia204Response{}, nil
}

func (h *Handler) GetPublicMedia(ctx context.Context, in api.GetPublicMediaRequestObject) (api.GetPublicMediaResponseObject, error) {
	etag := `"` + strings.TrimSuffix(in.File, ".webp") + `"`
	if in.Params.IfNoneMatch != nil && httpx.ETagMatches(*in.Params.IfNoneMatch, etag) {
		// The name is the content hash, so a matching ETag is current without a lookup.
		cache := immutableCache
		return api.GetPublicMedia304Response{Headers: api.GetPublicMedia304ResponseHeaders{CacheControl: &cache, ETag: &etag}}, nil
	}
	rc, obj, err := h.svc.OpenVariant(ctx, in.File)
	if err != nil {
		return nil, err
	}
	return variantResponse{body: rc, size: obj.Size, etag: etag}, nil
}

// variantResponse streams a variant with headers the generated type cannot express: the
// cross-origin resource policy (the frontend may run on another origin) and nosniff-safe
// inline disposition.
type variantResponse struct {
	body io.ReadCloser
	size int64
	etag string
}

func (r variantResponse) VisitGetPublicMediaResponse(w http.ResponseWriter) error {
	defer r.body.Close()
	h := w.Header()
	h.Set("Content-Type", "image/webp")
	h.Set("Content-Length", strconv.FormatInt(r.size, 10))
	h.Set("Content-Disposition", "inline")
	h.Set("Cache-Control", immutableCache)
	h.Set("ETag", r.etag)
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	w.WriteHeader(http.StatusOK)
	_, err := io.Copy(w, r.body)
	return err
}

// ToAPI maps an image to its admin representation; other modules embed it in their responses.
func ToAPI(m *Media) api.Media {
	out := api.Media{
		Id: m.ID, Width: int32(m.Width), Height: int32(m.Height), //nolint:gosec // bounded by imaging limits
		SourceType: api.MediaSourceType(m.SourceType), SourceBytes: m.SourceBytes,
		OriginalFilename: m.OriginalFilename, Placeholder: m.Placeholder,
		Variants:  make([]api.ImageVariant, len(m.Variants)),
		CreatedAt: m.CreatedAt, UpdatedAt: m.UpdatedAt,
	}
	for i, v := range m.Variants {
		out.Variants[i] = api.ImageVariant{
			Width: int32(v.Width), Height: int32(v.Height), //nolint:gosec // bounded by imaging limits
			Url: v.URL, ByteSize: v.ByteSize,
		}
	}
	for loc, text := range m.AltText {
		t := text
		switch loc {
		case "en":
			out.AltText.En = &t
		case "id":
			out.AltText.Id = &t
		case "ar":
			out.AltText.Ar = &t
		}
	}
	return out
}
