package validation

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

const maxURLBytes = 500

var ErrHTTPSURL = errors.New("must be a full https:// address")

// Fields collects field errors so a request reports every invalid field at once.
type Fields struct {
	list []apperr.FieldError
}

func (f *Fields) Add(field, msg string) {
	f.list = append(f.list, apperr.FieldError{Field: field, Message: msg})
}

func (f *Fields) List() []apperr.FieldError { return f.list }

// Err is nil when no field failed, otherwise an *apperr.Error of KindInvalid.
func (f *Fields) Err() error {
	if len(f.list) == 0 {
		return nil
	}
	return apperr.Invalid(Message, f.list...)
}

// SingleLine trims s and checks it is one line of minRunes to maxRunes characters.
func (f *Fields) SingleLine(field, s string, minRunes, maxRunes int) string {
	s = strings.TrimSpace(s)
	if strings.ContainsFunc(s, unicode.IsControl) {
		f.Add(field, "must be a single line of text")
		return s
	}
	f.length(field, s, minRunes, maxRunes)
	return s
}

// MultiLine trims s, normalises line breaks to \n and checks it is at most maxRunes long.
func (f *Fields) MultiLine(field, s string, maxRunes int) string {
	s = strings.TrimSpace(strings.ReplaceAll(s, "\r\n", "\n"))
	if strings.ContainsFunc(s, func(r rune) bool { return unicode.IsControl(r) && r != '\n' }) {
		f.Add(field, "must not contain control characters")
		return s
	}
	f.length(field, s, 0, maxRunes)
	return s
}

// HTTPSURL keeps an absolute https link, empty input meaning "no link".
func (f *Fields) HTTPSURL(field, raw string) string {
	s, err := HTTPSURL(raw)
	if err != nil {
		f.Add(field, err.Error())
	}
	return s
}

func (f *Fields) length(field, s string, minRunes, maxRunes int) {
	switch n := utf8.RuneCountInString(s); {
	case n < minRunes:
		f.Add(field, "must not be blank")
	case n > maxRunes:
		f.Add(field, fmt.Sprintf("must be at most %d characters", maxRunes))
	}
}

// HTTPSURL accepts an absolute https URL with a host and no credentials. Empty input
// yields "". Plain http is refused: the site is served over https and links open from it.
func HTTPSURL(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", nil
	}
	u, err := url.Parse(s)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || len(s) > maxURLBytes ||
		strings.ContainsFunc(s, unicode.IsSpace) {
		return "", ErrHTTPSURL
	}
	return u.String(), nil
}
