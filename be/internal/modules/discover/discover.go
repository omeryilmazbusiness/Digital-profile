// Package discover manages the Discover part of the site: topics in display order, each
// with PDF brochures visitors read in the browser or download.
package discover

import (
	"encoding/hex"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

// Locales that may carry texts, in fallback order; mirrored by the translation CHECKs.
var Locales = []string{"en", "id", "ar"}

const (
	maxEyebrowRunes = 60
	maxTitleRunes   = 160
	maxBodyRunes    = 3000
	maxSections     = 200
)

// SectionText is a topic's wording in one language. Body is plain text; blank lines
// separate paragraphs.
type SectionText struct {
	Eyebrow string
	Title   string
	Body    string
}

type Section struct {
	ID           uuid.UUID
	Position     int
	Translations map[string]SectionText
	Documents    []Document
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Localized returns the texts in locale or, failing that, the first available in Locales
// order; ok is false when the topic has no text at all.
func (s *Section) Localized(locale string) (SectionText, bool) {
	return localized(s.Translations, locale)
}

type Document struct {
	ID        uuid.UUID
	SectionID uuid.UUID
	// Language is the language the PDF is written in.
	Language string
	FileName string
	ByteSize int64
	// PageCount is 0 when it could not be read from the file.
	PageCount  int
	SHA256     []byte
	storageKey string
	Titles     map[string]string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// ETag identifies the file's content, so a new upload is fetched right away.
func (d *Document) ETag() string { return `"` + hex.EncodeToString(d.SHA256) + `"` }

// Title is the title in locale, falling back like Section.Localized.
func (d *Document) Title(locale string) (string, bool) {
	return localized(d.Titles, locale)
}

func localized[T any](m map[string]T, locale string) (T, bool) {
	if v, ok := m[locale]; ok {
		return v, true
	}
	for _, loc := range Locales {
		if v, ok := m[loc]; ok {
			return v, true
		}
	}
	var zero T
	return zero, false
}

// DocumentInput describes a PDF: the language it is written in and its title per language.
type DocumentInput struct {
	Language string
	Titles   map[string]string
}

func normalizeSection(texts map[string]SectionText) (map[string]SectionText, error) {
	var v validation.Fields
	out := make(map[string]SectionText, len(texts))
	for loc, t := range texts {
		if !slices.Contains(Locales, loc) {
			v.Add("translations", fmt.Sprintf("%q is not a supported language", loc))
			continue
		}
		prefix := "translations." + loc + "."
		out[loc] = SectionText{
			Eyebrow: v.SingleLine(prefix+"eyebrow", t.Eyebrow, 0, maxEyebrowRunes),
			Title:   v.SingleLine(prefix+"title", t.Title, 1, maxTitleRunes),
			Body:    v.MultiLine(prefix+"body", t.Body, maxBodyRunes),
		}
	}
	if len(texts) == 0 {
		v.Add("translations", "needs a title in at least one language")
	}
	return out, v.Err()
}

func normalizeDocument(in DocumentInput) (DocumentInput, error) {
	var v validation.Fields
	out := DocumentInput{Language: in.Language, Titles: make(map[string]string, len(in.Titles))}
	if !slices.Contains(Locales, in.Language) {
		v.Add("language", fmt.Sprintf("%q is not a supported language", in.Language))
	}
	for loc, title := range in.Titles {
		if !slices.Contains(Locales, loc) {
			v.Add("translations", fmt.Sprintf("%q is not a supported language", loc))
			continue
		}
		out.Titles[loc] = v.SingleLine("translations."+loc+".title", title, 1, maxTitleRunes)
	}
	if len(in.Titles) == 0 {
		v.Add("translations", "needs a title in at least one language")
	}
	return out, v.Err()
}

// checkOrder verifies ids lists every existing topic exactly once.
func checkOrder(existing, ids []uuid.UUID) error {
	if len(ids) != len(existing) || len(ids) > maxSections {
		return errOrder
	}
	seen := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		if seen[id] || !slices.Contains(existing, id) {
			return errOrder
		}
		seen[id] = true
	}
	return nil
}

var errOrder = apperr.Invalid(validation.Message, apperr.FieldError{
	Field: "ids", Message: "must list every topic exactly once",
})
