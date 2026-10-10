package discover

import (
	"bytes"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

const (
	// The header may follow a few bytes of junk (e.g. a BOM); readers search the first KiB.
	headerWindow = 1024
	// "%%EOF" ends the last revision; trailing whitespace or junk is tolerated by readers.
	trailerWindow   = 2048
	maxFileNameLen  = 200
	defaultFileName = "document"
)

var (
	errNotPDF = apperr.Invalid(validation.Message, apperr.FieldError{
		Field: "file", Message: "must be a PDF document",
	})
	errTruncatedPDF = apperr.Invalid(validation.Message, apperr.FieldError{
		Field: "file", Message: "the PDF is incomplete; upload it again",
	})
	// Page objects ("/Type /Page"), not the page tree ("/Type /Pages").
	pageObject = regexp.MustCompile(`/Type\s*/Page(?:[^a-zA-Z]|$)`)
)

// inspectPDF checks data is a whole PDF, identified by its content rather than its name,
// and counts its pages. The count is 0 when the page objects are compressed into object
// streams, which only a full parser could read.
func inspectPDF(data []byte) (pages int, err error) {
	head := data[:min(len(data), headerWindow)]
	if !bytes.Contains(head, []byte("%PDF-")) {
		return 0, errNotPDF
	}
	if !bytes.Contains(data[max(0, len(data)-trailerWindow):], []byte("%%EOF")) {
		return 0, errTruncatedPDF
	}
	return len(pageObject.FindAllIndex(data, -1)), nil
}

// pdfFileName keeps a display name for downloads: no directories or control characters,
// bounded length and always a .pdf extension. It returns the name without the extension.
func pdfFileName(name string) string {
	if i := strings.LastIndexAny(name, `/\`); i >= 0 {
		name = name[i+1:]
	}
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f || r == utf8.RuneError || r == '"' {
			return -1
		}
		return r
	}, strings.ToValidUTF8(name, ""))
	name = strings.TrimSpace(name)
	if len(name) >= 4 && strings.EqualFold(name[len(name)-4:], ".pdf") {
		name = strings.TrimSpace(name[:len(name)-4])
	}
	for utf8.RuneCountInString(name) > maxFileNameLen-4 {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	name = strings.Trim(name, ". ")
	if name == "" {
		return defaultFileName
	}
	return name
}
