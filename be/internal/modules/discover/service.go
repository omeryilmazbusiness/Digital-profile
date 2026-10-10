package discover

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/discover/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

const pdfContentType = "application/pdf"

var (
	errSectionNotFound  = apperr.NotFound("topic not found")
	errDocumentNotFound = apperr.NotFound("document not found")
)

type Service struct {
	pool  *pgxpool.Pool
	tx    database.Transactor
	blobs storage.Storage
	log   *slog.Logger
}

func NewService(pool *pgxpool.Pool, blobs storage.Storage, log *slog.Logger) *Service {
	return &Service{pool: pool, tx: database.NewTxManager(pool), blobs: blobs, log: log}
}

func (s *Service) q(ctx context.Context) *store.Queries {
	return store.New(database.Executor(ctx, s.pool))
}

// List returns every topic in display order with its documents. The whole catalogue is a
// handful of rows, so it is read in four queries rather than per topic.
func (s *Service) List(ctx context.Context) ([]Section, error) {
	q := s.q(ctx)
	rows, err := q.ListSections(ctx)
	if err != nil {
		return nil, database.MapError(err)
	}
	texts, err := q.ListSectionTranslations(ctx)
	if err != nil {
		return nil, database.MapError(err)
	}
	docs, err := s.documents(ctx, q)
	if err != nil {
		return nil, err
	}

	sections := make([]Section, len(rows))
	index := make(map[uuid.UUID]*Section, len(rows))
	for i, r := range rows {
		sections[i] = Section{
			ID: r.ID, Position: int(r.Position), Translations: map[string]SectionText{},
			Documents: []Document{}, CreatedAt: r.CreatedAt.UTC(), UpdatedAt: r.UpdatedAt.UTC(),
		}
		index[r.ID] = &sections[i]
	}
	for _, t := range texts {
		if sec := index[t.SectionID]; sec != nil {
			sec.Translations[t.Locale] = SectionText{Eyebrow: t.Eyebrow, Title: t.Title, Body: t.Body}
		}
	}
	for i := range docs {
		if sec := index[docs[i].SectionID]; sec != nil {
			sec.Documents = append(sec.Documents, docs[i])
		}
	}
	return sections, nil
}

func (s *Service) documents(ctx context.Context, q *store.Queries) ([]Document, error) {
	rows, err := q.ListDocuments(ctx)
	if err != nil {
		return nil, database.MapError(err)
	}
	titles, err := q.ListDocumentTranslations(ctx)
	if err != nil {
		return nil, database.MapError(err)
	}
	byDoc := map[uuid.UUID]map[string]string{}
	for _, t := range titles {
		if byDoc[t.DocumentID] == nil {
			byDoc[t.DocumentID] = map[string]string{}
		}
		byDoc[t.DocumentID][t.Locale] = t.Title
	}
	out := make([]Document, len(rows))
	for i := range rows {
		out[i] = toDocument(&rows[i], byDoc[rows[i].ID])
	}
	return out, nil
}

func toDocument(r *store.Document, titles map[string]string) Document {
	if titles == nil {
		titles = map[string]string{}
	}
	d := Document{
		ID: r.ID, SectionID: r.SectionID, Language: r.Language, FileName: r.FileName,
		ByteSize: r.ByteSize, SHA256: r.Sha256, storageKey: r.StorageKey, Titles: titles,
		CreatedAt: r.CreatedAt.UTC(), UpdatedAt: r.UpdatedAt.UTC(),
	}
	if r.PageCount != nil {
		d.PageCount = int(*r.PageCount)
	}
	return d
}

func (s *Service) Section(ctx context.Context, id uuid.UUID) (Section, error) {
	all, err := s.List(ctx)
	if err != nil {
		return Section{}, err
	}
	for _, sec := range all {
		if sec.ID == id {
			return sec, nil
		}
	}
	return Section{}, errSectionNotFound
}

func (s *Service) Document(ctx context.Context, id uuid.UUID) (Document, error) {
	q := s.q(ctx)
	row, err := q.GetDocument(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, errDocumentNotFound
	}
	if err != nil {
		return Document{}, database.MapError(err)
	}
	all, err := q.ListDocumentTranslations(ctx)
	if err != nil {
		return Document{}, database.MapError(err)
	}
	titles := map[string]string{}
	for _, t := range all {
		if t.DocumentID == id {
			titles[t.Locale] = t.Title
		}
	}
	return toDocument(&row, titles), nil
}

// CreateSection adds a topic at the end.
func (s *Service) CreateSection(ctx context.Context, texts map[string]SectionText) (Section, error) {
	texts, err := normalizeSection(texts)
	if err != nil {
		return Section{}, err
	}
	id := uuid.New()
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		// Serialises position assignment with concurrent creates and reorders.
		if _, err := q.LockSections(ctx); err != nil {
			return err
		}
		if _, err := q.CreateSection(ctx, id); err != nil {
			return err
		}
		return writeSectionTexts(ctx, q, id, texts)
	})
	if err != nil {
		return Section{}, database.MapError(err)
	}
	return s.Section(ctx, id)
}

// UpdateSection replaces a topic's texts; languages left out are removed.
func (s *Service) UpdateSection(ctx context.Context, id uuid.UUID, texts map[string]SectionText) (Section, error) {
	texts, err := normalizeSection(texts)
	if err != nil {
		return Section{}, err
	}
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if _, err := q.GetSection(ctx, id); err != nil {
			return err
		}
		if err := q.DeleteSectionTranslations(ctx, id); err != nil {
			return err
		}
		if err := writeSectionTexts(ctx, q, id, texts); err != nil {
			return err
		}
		return q.TouchSection(ctx, id)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Section{}, errSectionNotFound
	}
	if err != nil {
		return Section{}, database.MapError(err)
	}
	return s.Section(ctx, id)
}

func writeSectionTexts(ctx context.Context, q *store.Queries, id uuid.UUID, texts map[string]SectionText) error {
	for _, loc := range Locales {
		t, ok := texts[loc]
		if !ok {
			continue
		}
		if err := q.CreateSectionTranslation(ctx, store.CreateSectionTranslationParams{
			SectionID: id, Locale: loc, Eyebrow: t.Eyebrow, Title: t.Title, Body: t.Body,
		}); err != nil {
			return err
		}
	}
	return nil
}

// DeleteSection removes a topic with its documents and their files.
func (s *Service) DeleteSection(ctx context.Context, id uuid.UUID) error {
	var keys []string
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		var err error
		if keys, err = q.ListSectionStorageKeys(ctx, id); err != nil {
			return err
		}
		n, err := q.DeleteSection(ctx, id)
		if err != nil {
			return err
		}
		if n == 0 {
			return errSectionNotFound
		}
		return nil
	})
	if err != nil {
		return database.MapError(err)
	}
	s.removeFiles(ctx, keys...)
	return nil
}

// Reorder sets the display order; ids must list every topic exactly once.
func (s *Service) Reorder(ctx context.Context, ids []uuid.UUID) ([]Section, error) {
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		existing, err := q.LockSections(ctx)
		if err != nil {
			return err
		}
		if err := checkOrder(existing, ids); err != nil {
			return err
		}
		for i, id := range ids {
			if err := q.SetSectionPosition(ctx, store.SetSectionPositionParams{ID: id, Position: int32(i)}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, database.MapError(err)
	}
	return s.List(ctx)
}

// AddDocument stores a PDF under a topic, last in its list.
func (s *Service) AddDocument(ctx context.Context, sectionID uuid.UUID, in DocumentInput, fileName string, data []byte) (Document, error) {
	in, err := normalizeDocument(in)
	if err != nil {
		return Document{}, err
	}
	id := uuid.New()
	file, err := s.store(ctx, id, fileName, data)
	if err != nil {
		return Document{}, err
	}
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if _, err := q.GetSection(ctx, sectionID); err != nil {
			return err
		}
		if _, err := q.CreateDocument(ctx, store.CreateDocumentParams{
			ID: id, SectionID: sectionID, Language: in.Language, StorageKey: file.key,
			FileName: file.name, ByteSize: file.size, PageCount: file.pages, Sha256: file.sum,
		}); err != nil {
			return err
		}
		return writeTitles(ctx, q, id, in.Titles)
	})
	if err != nil {
		s.removeFiles(ctx, file.key)
		if errors.Is(err, pgx.ErrNoRows) || database.ConstraintName(err) == "documents_section_id_fkey" {
			return Document{}, errSectionNotFound
		}
		return Document{}, database.MapError(err)
	}
	return s.Document(ctx, id)
}

// UpdateDocument replaces a document's language and titles; the file stays.
func (s *Service) UpdateDocument(ctx context.Context, id uuid.UUID, in DocumentInput) (Document, error) {
	in, err := normalizeDocument(in)
	if err != nil {
		return Document{}, err
	}
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if _, err := q.LockDocument(ctx, id); err != nil {
			return err
		}
		if err := q.UpdateDocumentLanguage(ctx, store.UpdateDocumentLanguageParams{ID: id, Language: in.Language}); err != nil {
			return err
		}
		if err := q.DeleteDocumentTranslations(ctx, id); err != nil {
			return err
		}
		return writeTitles(ctx, q, id, in.Titles)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, errDocumentNotFound
	}
	if err != nil {
		return Document{}, database.MapError(err)
	}
	return s.Document(ctx, id)
}

// ReplaceFile uploads a new version of a document's PDF; its link stays the same.
func (s *Service) ReplaceFile(ctx context.Context, id uuid.UUID, fileName string, data []byte) (Document, error) {
	if _, err := s.Document(ctx, id); err != nil {
		return Document{}, err
	}
	file, err := s.store(ctx, id, fileName, data)
	if err != nil {
		return Document{}, err
	}
	var old string
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		row, err := q.LockDocument(ctx, id)
		if err != nil {
			return err
		}
		old = row.StorageKey
		return q.ReplaceDocumentFile(ctx, store.ReplaceDocumentFileParams{
			ID: id, StorageKey: file.key, FileName: file.name, ByteSize: file.size,
			PageCount: file.pages, Sha256: file.sum,
		})
	})
	if err != nil {
		if old != file.key {
			s.removeFiles(ctx, file.key)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return Document{}, errDocumentNotFound
		}
		return Document{}, database.MapError(err)
	}
	if old != file.key {
		s.removeFiles(ctx, old)
	}
	return s.Document(ctx, id)
}

func (s *Service) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	var key string
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		row, err := q.LockDocument(ctx, id)
		if err != nil {
			return err
		}
		key = row.StorageKey
		_, err = q.DeleteDocument(ctx, id)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return errDocumentNotFound
	}
	if err != nil {
		return database.MapError(err)
	}
	s.removeFiles(ctx, key)
	return nil
}

// OpenFile opens a document's PDF for reading; the caller closes the reader.
func (s *Service) OpenFile(ctx context.Context, d *Document) (io.ReadCloser, error) {
	rc, _, err := s.blobs.Get(ctx, d.storageKey)
	if errors.Is(err, storage.ErrNotFound) {
		s.log.ErrorContext(ctx, "document file missing", "document_id", d.ID, "key", d.storageKey)
		return nil, errDocumentNotFound
	}
	return rc, err
}

func writeTitles(ctx context.Context, q *store.Queries, id uuid.UUID, titles map[string]string) error {
	for _, loc := range Locales {
		title, ok := titles[loc]
		if !ok {
			continue
		}
		if err := q.CreateDocumentTranslation(ctx, store.CreateDocumentTranslationParams{
			DocumentID: id, Locale: loc, Title: title,
		}); err != nil {
			return err
		}
	}
	return nil
}

type storedFile struct {
	key   string
	name  string
	size  int64
	pages *int32
	sum   []byte
}

// store validates a PDF and writes it for document id under a key naming its content,
// before the database row: a failed commit leaves an unreferenced file, which removeFiles
// cleans up, never a row without its file.
func (s *Service) store(ctx context.Context, id uuid.UUID, fileName string, data []byte) (storedFile, error) {
	pages, err := inspectPDF(data)
	if err != nil {
		return storedFile{}, err
	}
	sum := sha256.Sum256(data)
	f := storedFile{
		key:  "documents/" + id.String() + "/" + hex.EncodeToString(sum[:]) + ".pdf",
		name: pdfFileName(fileName) + ".pdf",
		size: int64(len(data)),
		sum:  sum[:],
	}
	if pages > 0 {
		n := int32(min(pages, 1<<20))
		f.pages = &n
	}
	if err := s.blobs.Put(ctx, f.key, bytes.NewReader(data), f.size, pdfContentType); err != nil {
		return storedFile{}, err
	}
	return f, nil
}

// removeFiles deletes files after the database no longer refers to them. Keys belong to a
// single document, so nothing else can be using them.
func (s *Service) removeFiles(ctx context.Context, keys ...string) {
	ctx = context.WithoutCancel(ctx)
	for _, k := range keys {
		if k == "" {
			continue
		}
		if err := s.blobs.Delete(ctx, k); err != nil {
			s.log.WarnContext(ctx, "delete document file", "key", k, "error", err)
		}
	}
}
