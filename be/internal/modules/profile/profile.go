// Package profile manages the sales manager's digital business card: contact details,
// localized texts, the published public card and its vCard.
package profile

import (
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/nyaruka/phonenumbers"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
)

// Locales that may carry texts, in fallback order; mirrored by the profile_translations CHECK.
var Locales = []string{"en", "id", "ar"}

// DefaultLanguages are shown until the admin chooses the spoken languages.
var DefaultLanguages = []string{"ar", "en", "tr"}

// SpokenLanguages is the ISO 639-1 set the admin may choose from, mirrored by the
// SpokenLanguage enum of the API contract.
var SpokenLanguages = []string{
	"ar", "en", "tr", "id", "ms", "ur", "fa", "fr", "de", "es", "it", "nl", "pt", "ru", "zh", "ja", "ko",
	"hi", "bn", "ta", "ml", "th", "tl", "ha", "so", "sw", "am", "az", "kk", "uz", "ky", "tg", "ps", "sq",
	"bs", "ku", "yo", "wo",
}

// Requirements reported by Profile.Missing.
const (
	MissingTitle   = "title"
	MissingContact = "contact"
)

const (
	maxNameRunes         = 60
	maxOrganizationRunes = 120
	maxTitleRunes        = 120
	maxTaglineRunes      = 160
	maxBioRunes          = 1000
	maxGreetingRunes     = 500
	maxEmailBytes        = 254
	maxLanguages         = 20
)

var (
	errPhoneCountryCode = errors.New("must start with the country code, e.g. +966")
	errPhoneInvalid     = errors.New("is not a valid phone number")
	errEmailInvalid     = errors.New("is not a valid e-mail address")
)

type Translation struct {
	Title           string
	Tagline         string
	Bio             string
	WhatsAppMessage string
}

type Profile struct {
	FirstName    string
	LastName     string
	Organization string
	Portrait     *media.Media
	// Phone and WhatsApp are E.164; empty when not set, like Email.
	Phone        string
	WhatsApp     string
	Email        string
	Languages    []string
	Translations map[string]Translation
	UpdatedAt    time.Time
}

func (p *Profile) FullName() string {
	return strings.TrimSpace(p.FirstName + " " + p.LastName)
}

// Missing lists what must be added before the profile is published: a title in at least
// one language, and at least one way to get in touch.
func (p *Profile) Missing() []string {
	missing := []string{}
	if len(p.Translations) == 0 {
		missing = append(missing, MissingTitle)
	}
	if p.Phone == "" && p.WhatsApp == "" && p.Email == "" {
		missing = append(missing, MissingContact)
	}
	return missing
}

func (p *Profile) Complete() bool { return len(p.Missing()) == 0 }

// Localized returns the texts in the requested locale or, failing that, the first available
// one in Locales order, with the locale actually used.
func (p *Profile) Localized(locale string) (string, Translation) {
	if t, ok := p.Translations[locale]; ok {
		return locale, t
	}
	for _, loc := range Locales {
		if t, ok := p.Translations[loc]; ok {
			return loc, t
		}
	}
	return locale, Translation{}
}

// Input is a full replacement of the profile. Nil Languages means DefaultLanguages.
type Input struct {
	FirstName       string
	LastName        string
	Organization    string
	PortraitMediaID *uuid.UUID
	Phone           string
	WhatsApp        string
	Email           string
	Languages       []string
	Translations    map[string]Translation
}

// normalize trims and validates in, converting phone numbers to E.164 and lower-casing the
// e-mail domain. It reports every invalid field at once.
func normalize(in Input) (Input, []apperr.FieldError) {
	var fields []apperr.FieldError
	fail := func(field, msg string) { fields = append(fields, apperr.FieldError{Field: field, Message: msg}) }

	out := Input{PortraitMediaID: in.PortraitMediaID, Translations: map[string]Translation{}}
	out.FirstName = singleLine("firstName", in.FirstName, 1, maxNameRunes, fail)
	out.LastName = singleLine("lastName", in.LastName, 0, maxNameRunes, fail)
	out.Organization = singleLine("organization", in.Organization, 0, maxOrganizationRunes, fail)

	var err error
	if out.Phone, err = NormalizePhone(in.Phone); err != nil {
		fail("phone", err.Error())
	}
	if out.WhatsApp, err = NormalizePhone(in.WhatsApp); err != nil {
		fail("whatsapp", err.Error())
	}
	if out.Email, err = NormalizeEmail(in.Email); err != nil {
		fail("email", err.Error())
	}

	out.Languages = DefaultLanguages
	if in.Languages != nil {
		out.Languages = make([]string, 0, len(in.Languages))
		for _, l := range in.Languages {
			switch {
			case !slices.Contains(SpokenLanguages, l):
				fail("languages", fmt.Sprintf("%q is not a supported language", l))
			case !slices.Contains(out.Languages, l):
				out.Languages = append(out.Languages, l)
			}
		}
		if len(out.Languages) > maxLanguages {
			fail("languages", fmt.Sprintf("must have at most %d items", maxLanguages))
		}
	}

	for loc, t := range in.Translations {
		if !slices.Contains(Locales, loc) {
			fail("translations", fmt.Sprintf("%q is not a supported language", loc))
			continue
		}
		prefix := "translations." + loc + "."
		out.Translations[loc] = Translation{
			Title:           singleLine(prefix+"title", t.Title, 1, maxTitleRunes, fail),
			Tagline:         singleLine(prefix+"tagline", t.Tagline, 0, maxTaglineRunes, fail),
			Bio:             multiLine(prefix+"bio", t.Bio, maxBioRunes, fail),
			WhatsAppMessage: multiLine(prefix+"whatsappMessage", t.WhatsAppMessage, maxGreetingRunes, fail),
		}
	}
	return out, fields
}

func singleLine(field, s string, minRunes, maxRunes int, fail func(field, msg string)) string {
	s = strings.TrimSpace(s)
	if strings.ContainsFunc(s, unicode.IsControl) {
		fail(field, "must be a single line of text")
		return s
	}
	checkLength(field, s, minRunes, maxRunes, fail)
	return s
}

func multiLine(field, s string, maxRunes int, fail func(field, msg string)) string {
	s = strings.TrimSpace(strings.ReplaceAll(s, "\r\n", "\n"))
	if strings.ContainsFunc(s, func(r rune) bool { return unicode.IsControl(r) && r != '\n' }) {
		fail(field, "must not contain control characters")
		return s
	}
	checkLength(field, s, 0, maxRunes, fail)
	return s
}

func checkLength(field, s string, minRunes, maxRunes int, fail func(field, msg string)) {
	switch n := utf8.RuneCountInString(s); {
	case n < minRunes:
		fail(field, "must not be blank")
	case n > maxRunes:
		fail(field, fmt.Sprintf("must be at most %d characters", maxRunes))
	}
}

// NormalizePhone converts an international number ("+966 12 545 6789", "00966…") to E.164.
// Numbers without a country code are rejected: visitors come from many countries, so a
// local format would be ambiguous. Empty input yields "".
func NormalizePhone(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", nil
	}
	if rest, ok := strings.CutPrefix(s, "00"); ok {
		s = "+" + rest
	}
	if !strings.HasPrefix(s, "+") {
		return "", errPhoneCountryCode
	}
	num, err := phonenumbers.Parse(s, "")
	if err != nil || !phonenumbers.IsValidNumber(num) {
		return "", errPhoneInvalid
	}
	return phonenumbers.Format(num, phonenumbers.E164), nil
}

// DisplayPhone formats an E.164 number for reading ("+966 12 545 6789").
func DisplayPhone(e164 string) string {
	num, err := phonenumbers.Parse(e164, "")
	if err != nil {
		return e164
	}
	return phonenumbers.Format(num, phonenumbers.INTERNATIONAL)
}

// NormalizeEmail accepts a bare address and lower-cases its domain. Empty input yields "".
func NormalizeEmail(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", nil
	}
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s || len(s) > maxEmailBytes {
		return "", errEmailInvalid
	}
	local, domain, _ := strings.Cut(s, "@")
	if !strings.Contains(domain, ".") {
		return "", errEmailInvalid
	}
	return local + "@" + strings.ToLower(domain), nil
}

// WhatsAppURL opens a chat with e164, pre-filling message when it is not empty.
func WhatsAppURL(e164, message string) string {
	u := "https://wa.me/" + strings.TrimPrefix(e164, "+")
	if message != "" {
		// wa.me reads "+" literally, so spaces must be %20.
		u += "?text=" + strings.ReplaceAll(url.QueryEscape(message), "+", "%20")
	}
	return u
}
