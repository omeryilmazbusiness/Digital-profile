package discover

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

const (
	// Documents can be replaced under the same URL, so caches revalidate after a few minutes.
	documentCache    = "public, max-age=300, must-revalidate"
	maxMetadataBytes = 64 << 10
	publicPath       = "/api/v1/public/documents/"
)

// Handler implements the discover operations of api.StrictServerInterface.
type Handler struct {
	svc            *Service
	maxUploadBytes int64
}

func NewHandler(svc *Service, maxUploadBytes int64) *Handler {
	return &Handler{svc: svc, maxUploadBytes: maxUploadBytes}
}

func (h *Handler) ListDiscoverSections(ctx context.Context, _ api.ListDiscoverSectionsRequestObject) (api.ListDiscoverSectionsResponseObject, error) {
	sections, err := h.svc.List(ctx)
	if err != nil {
		return nil, err
	}
	return api.ListDiscoverSections200JSONResponse(toSectionList(sections)), nil
}

func (h *Handler) CreateDiscoverSection(ctx context.Context, in api.CreateDiscoverSectionRequestObject) (api.CreateDiscoverSectionResponseObject, error) {
	sec, err := h.svc.CreateSection(ctx, sectionTexts(in.Body.Translations))
	if err != nil {
		return nil, err
	}
	return api.CreateDiscoverSection201JSONResponse(toSection(&sec)), nil
}

func (h *Handler) UpdateDiscoverSection(ctx context.Context, in api.UpdateDiscoverSectionRequestObject) (api.UpdateDiscoverSectionResponseObject, error) {
	sec, err := h.svc.UpdateSection(ctx, in.SectionId, sectionTexts(in.Body.Translations))
	if err != nil {
		return nil, err
	}
	return api.UpdateDiscoverSection200JSONResponse(toSection(&sec)), nil
}

func (h *Handler) DeleteDiscoverSection(ctx context.Context, in api.DeleteDiscoverSectionRequestObject) (api.DeleteDiscoverSectionResponseObject, error) {
	if err := h.svc.DeleteSection(ctx, in.SectionId); err != nil {
		return nil, err
	}
	return api.DeleteDiscoverSection204Response{}, nil
}

func (h *Handler) ReorderDiscoverSections(ctx context.Context, in api.ReorderDiscoverSectionsRequestObject) (api.ReorderDiscoverSectionsResponseObject, error) {
	sections, err := h.svc.Reorder(ctx, in.Body.Ids)
	if err != nil {
		return nil, err
	}
	return api.ReorderDiscoverSections200JSONResponse(toSectionList(sections)), nil
}

func (h *Handler) UploadDocument(ctx context.Context, in api.UploadDocumentRequestObject) (api.UploadDocumentResponseObject, error) {
	up, err := h.readUpload(in.Body, true)
	if err != nil {
		return nil, err
	}
	d, err := h.svc.AddDocument(ctx, in.SectionId, up.metadata, up.fileName, up.data)
	if err != nil {
		return nil, err
	}
	return api.UploadDocument201JSONResponse(toDocumentAPI(&d)), nil
}

func (h *Handler) UpdateDocument(ctx context.Context, in api.UpdateDocumentRequestObject) (api.UpdateDocumentResponseObject, error) {
	d, err := h.svc.UpdateDocument(ctx, in.DocumentId, documentInput(in.Body))
	if err != nil {
		return nil, err
	}
	return api.UpdateDocument200JSONResponse(toDocumentAPI(&d)), nil
}

func (h *Handler) ReplaceDocumentFile(ctx context.Context, in api.ReplaceDocumentFileRequestObject) (api.ReplaceDocumentFileResponseObject, error) {
	up, err := h.readUpload(in.Body, false)
	if err != nil {
		return nil, err
	}
	d, err := h.svc.ReplaceFile(ctx, in.DocumentId, up.fileName, up.data)
	if err != nil {
		return nil, err
	}
	return api.ReplaceDocumentFile200JSONResponse(toDocumentAPI(&d)), nil
}

func (h *Handler) DeleteDocument(ctx context.Context, in api.DeleteDocumentRequestObject) (api.DeleteDocumentResponseObject, error) {
	if err := h.svc.DeleteDocument(ctx, in.DocumentId); err != nil {
		return nil, err
	}
	return api.DeleteDocument204Response{}, nil
}

func (h *Handler) GetPublicDocument(ctx context.Context, in api.GetPublicDocumentRequestObject) (api.GetPublicDocumentResponseObject, error) {
	d, err := h.svc.Document(ctx, in.DocumentId)
	if err != nil {
		return nil, err
	}
	etag, cache := d.ETag(), documentCache
	if in.Params.IfNoneMatch != nil && httpx.ETagMatches(*in.Params.IfNoneMatch, etag) {
		return api.GetPublicDocument304Response{Headers: api.GetPublicDocument304ResponseHeaders{CacheControl: &cache, ETag: &etag}}, nil
	}
	rc, err := h.svc.OpenFile(ctx, &d)
	if err != nil {
		return nil, err
	}
	disposition := "inline"
	if in.Params.Download != nil && *in.Params.Download {
		disposition = "attachment"
	}
	return pdfResponse{
		body: rc, size: d.ByteSize, etag: etag,
		disposition: httpx.ContentDisposition(disposition, strings.TrimSuffix(d.FileName, ".pdf"), ".pdf", defaultFileName),
	}, nil
}

// pdfResponse streams a PDF with headers the generated type cannot express: the
// cross-origin resource policy (the site may run on another origin than the API) and a
// sandbox, since browsers render PDFs in a privileged viewer.
type pdfResponse struct {
	body        io.ReadCloser
	size        int64
	etag        string
	disposition string
}

func (r pdfResponse) VisitGetPublicDocumentResponse(w http.ResponseWriter) error {
	defer r.body.Close()
	h := w.Header()
	h.Set("Content-Type", pdfContentType)
	h.Set("Content-Length", strconv.FormatInt(r.size, 10))
	h.Set("Content-Disposition", r.disposition)
	h.Set("Cache-Control", documentCache)
	h.Set("ETag", r.etag)
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	h.Set("Content-Security-Policy", "sandbox")
	w.WriteHeader(http.StatusOK)
	_, err := io.Copy(w, r.body)
	return err
}

type upload struct {
	metadata DocumentInput
	fileName string
	data     []byte
}

// readUpload streams the multipart body: only the "metadata" and "file" parts are read, and
// never more than their limits, so oversized files fail without being buffered.
func (h *Handler) readUpload(body *multipart.Reader, wantMetadata bool) (upload, error) {
	var (
		up               upload
		gotFile, gotMeta bool
		malformed        = func(err error) error { return bodyError(err, apperr.BadRequest("malformed multipart body").Wrap(err)) }
		fieldRequired    = func(f string) error {
			return apperr.BadRequest("request validation failed", apperr.FieldError{Field: f, Message: "is required"})
		}
		invalidMetadata = apperr.BadRequest("request validation failed", apperr.FieldError{Field: "metadata", Message: "must be a JSON DocumentInput"})
		tooLarge        = apperr.New(apperr.KindTooLarge, "the PDF exceeds the "+strconv.FormatInt(h.maxUploadBytes>>20, 10)+" MB upload limit")
	)
	if body == nil {
		return up, fieldRequired("file")
	}
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return up, malformed(err)
		}
		switch {
		case part.FormName() == "file" && !gotFile:
			gotFile = true
			up.fileName = part.FileName()
			up.data, err = io.ReadAll(io.LimitReader(part, h.maxUploadBytes+1))
			_ = part.Close()
			if err != nil {
				return up, malformed(err)
			}
			if int64(len(up.data)) > h.maxUploadBytes {
				return up, tooLarge
			}
		case part.FormName() == "metadata" && wantMetadata && !gotMeta:
			gotMeta = true
			raw, err := io.ReadAll(io.LimitReader(part, maxMetadataBytes+1))
			_ = part.Close()
			if err != nil {
				return up, malformed(err)
			}
			var in api.DocumentInput
			dec := json.NewDecoder(bytes.NewReader(raw))
			dec.DisallowUnknownFields()
			if len(raw) > maxMetadataBytes || dec.Decode(&in) != nil {
				return up, invalidMetadata
			}
			up.metadata = documentInput(&in)
		default:
			_ = part.Close()
		}
	}
	if wantMetadata && !gotMeta {
		return up, fieldRequired("metadata")
	}
	if !gotFile {
		return up, fieldRequired("file")
	}
	return up, nil
}

// bodyError keeps the request size limit's own error (413) and maps anything else to fallback.
func bodyError(err, fallback error) error {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		return err
	}
	return fallback
}

func sectionTexts(l api.LocalizedDiscoverSectionText) map[string]SectionText {
	out := map[string]SectionText{}
	for loc, t := range map[string]*api.DiscoverSectionText{"en": l.En, "id": l.Id, "ar": l.Ar} {
		if t != nil {
			out[loc] = SectionText{Eyebrow: val(t.Eyebrow), Title: t.Title, Body: val(t.Body)}
		}
	}
	return out
}

func documentInput(b *api.DocumentInput) DocumentInput {
	in := DocumentInput{Language: string(b.Language), Titles: map[string]string{}}
	for loc, t := range map[string]*api.DocumentText{"en": b.Translations.En, "id": b.Translations.Id, "ar": b.Translations.Ar} {
		if t != nil {
			in.Titles[loc] = t.Title
		}
	}
	return in
}

func toSectionList(sections []Section) api.DiscoverSectionList {
	out := api.DiscoverSectionList{Items: make([]api.DiscoverSection, len(sections))}
	for i := range sections {
		out.Items[i] = toSection(&sections[i])
	}
	return out
}

func toSection(s *Section) api.DiscoverSection {
	out := api.DiscoverSection{
		Id: s.ID, Position: int32(s.Position), //nolint:gosec // bounded by maxSections
		Documents: make([]api.Document, len(s.Documents)), CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
	}
	for loc, t := range s.Translations {
		at := &api.DiscoverSectionText{Eyebrow: opt(t.Eyebrow), Title: t.Title, Body: opt(t.Body)}
		switch loc {
		case "en":
			out.Translations.En = at
		case "id":
			out.Translations.Id = at
		case "ar":
			out.Translations.Ar = at
		}
	}
	for i := range s.Documents {
		out.Documents[i] = toDocumentAPI(&s.Documents[i])
	}
	return out
}

func toDocumentAPI(d *Document) api.Document {
	out := api.Document{
		Id: d.ID, SectionId: d.SectionID, Language: api.Locale(d.Language), FileName: d.FileName,
		ByteSize: d.ByteSize, PageCount: pageCount(d), Url: DocumentURL(d.ID), DownloadUrl: DownloadURL(d.ID),
		CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt,
	}
	for loc, title := range d.Titles {
		t := &api.DocumentText{Title: title}
		switch loc {
		case "en":
			out.Translations.En = t
		case "id":
			out.Translations.Id = t
		case "ar":
			out.Translations.Ar = t
		}
	}
	return out
}

// ToPublicAPI maps the topics to what visitors see in locale. Topics and documents without
// any text are left out.
func ToPublicAPI(sections []Section, locale string) []api.PublicDiscoverSection {
	out := []api.PublicDiscoverSection{}
	for i := range sections {
		s := &sections[i]
		t, ok := s.Localized(locale)
		if !ok {
			continue
		}
		ps := api.PublicDiscoverSection{
			Id: s.ID, Eyebrow: t.Eyebrow, Title: t.Title, Body: t.Body, Documents: []api.PublicDocument{},
		}
		for j := range s.Documents {
			d := &s.Documents[j]
			title, ok := d.Title(locale)
			if !ok {
				continue
			}
			ps.Documents = append(ps.Documents, api.PublicDocument{
				Id: d.ID, Title: title, Language: api.Locale(d.Language), FileName: d.FileName,
				ByteSize: d.ByteSize, PageCount: pageCount(d), Url: DocumentURL(d.ID), DownloadUrl: DownloadURL(d.ID),
				UpdatedAt: d.UpdatedAt,
			})
		}
		out = append(out, ps)
	}
	return out
}

// DocumentURL opens the PDF in the browser, relative to the API origin.
func DocumentURL(id uuid.UUID) string { return publicPath + id.String() }

// DownloadURL saves the PDF under its file name.
func DownloadURL(id uuid.UUID) string { return DocumentURL(id) + "?download=true" }

func pageCount(d *Document) *int32 {
	if d.PageCount == 0 {
		return nil
	}
	n := int32(d.PageCount) //nolint:gosec // clamped when stored
	return &n
}

func opt(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func val(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
