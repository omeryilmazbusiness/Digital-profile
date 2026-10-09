// Package imaging validates uploaded images and renders the responsive WebP variants served
// to browsers. Source files are never stored: variants are re-encoded from decoded pixels,
// which removes EXIF/GPS and any payload hidden in the original container.
package imaging

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"slices"

	"github.com/gen2brain/webp"
	"golang.org/x/image/draw"
)

// Supported source types.
const (
	TypeJPEG = "image/jpeg"
	TypePNG  = "image/png"
	TypeWebP = "image/webp"
)

// OutputType is the content type of every variant.
const OutputType = "image/webp"

// DefaultWidths are the responsive breakpoints: phone, tablet/retina phone, desktop.
var DefaultWidths = []int{480, 960, 1600}

// maxDimension is the WebP format limit.
const maxDimension = 16383

const placeholderWidth = 16

var (
	ErrUnsupportedType = errors.New("unsupported image type; upload a JPEG, PNG or WebP image")
	ErrHEIC            = errors.New("HEIC images are not supported; export the photo as JPEG and try again")
	ErrCorrupt         = errors.New("the file is not a valid image or is damaged")
	ErrTooLarge        = errors.New("image dimensions are too large")
	ErrEmpty           = errors.New("the file is empty")
)

type Options struct {
	MaxPixels   int
	Quality     int
	Concurrency int
	Widths      []int
}

// Variant is one encoded WebP rendition.
type Variant struct {
	Width  int
	Height int
	Data   []byte
}

type Result struct {
	// SourceType is the sniffed content type of the upload.
	SourceType string
	// Width and Height are the display dimensions, after applying EXIF orientation.
	Width  int
	Height int
	// Variants are ordered by ascending width; the largest never exceeds the source width.
	Variants []Variant
	// Placeholder is a tiny, blurred WebP data URI for progressive loading.
	Placeholder string
}

type Processor struct {
	opts Options
	sem  chan struct{}
}

func NewProcessor(o Options) (*Processor, error) {
	if o.MaxPixels <= 0 || o.Quality < 1 || o.Quality > 100 || o.Concurrency < 1 {
		return nil, fmt.Errorf("imaging: invalid options %+v", o)
	}
	if len(o.Widths) == 0 {
		o.Widths = DefaultWidths
	}
	o.Widths = slices.Sorted(slices.Values(o.Widths))
	return &Processor{opts: o, sem: make(chan struct{}, o.Concurrency)}, nil
}

// Sniff identifies the image type from its leading bytes, never from a file name.
func Sniff(data []byte) (string, error) {
	if len(data) == 0 {
		return "", ErrEmpty
	}
	if isHEIC(data) {
		return "", ErrHEIC
	}
	switch ct := http.DetectContentType(data); ct {
	case TypeJPEG, TypePNG, TypeWebP:
		return ct, nil
	default:
		return "", ErrUnsupportedType
	}
}

func isHEIC(data []byte) bool {
	if len(data) < 12 || string(data[4:8]) != "ftyp" {
		return false
	}
	switch string(data[8:12]) {
	case "heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "avif":
		return true
	}
	return false
}

// Process validates data and renders its variants. It returns ErrUnsupportedType, ErrHEIC,
// ErrCorrupt, ErrTooLarge or ErrEmpty for bad input; any other error is internal.
func (p *Processor) Process(ctx context.Context, data []byte) (*Result, error) {
	ct, err := Sniff(data)
	if err != nil {
		return nil, err
	}

	// Check dimensions from the header before allocating pixel memory (decompression bombs).
	cfg, err := decodeConfig(ct, data)
	if err != nil {
		return nil, ErrCorrupt
	}
	if cfg.Width < 1 || cfg.Height < 1 {
		return nil, ErrCorrupt
	}
	if cfg.Width > maxDimension || cfg.Height > maxDimension || cfg.Width*cfg.Height > p.opts.MaxPixels {
		return nil, ErrTooLarge
	}

	orientation, icc := 1, []byte(nil)
	if ct == TypeJPEG {
		orientation, icc = jpegMeta(data)
	}

	select {
	case p.sem <- struct{}{}:
		defer func() { <-p.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	src, err := decode(ct, data)
	if err != nil {
		return nil, ErrCorrupt
	}
	sb := src.Bounds()
	if sb.Dx() < 1 || sb.Dy() < 1 {
		return nil, ErrCorrupt
	}
	// The WebP decoder applies orientation itself; for JPEG we do it below.
	w, h := sb.Dx(), sb.Dy()
	if orientation >= 5 {
		w, h = h, w
	}

	targets := p.targetWidths(w)
	res := &Result{SourceType: ct, Width: w, Height: h, Variants: make([]Variant, len(targets))}

	// Render from the largest variant down, each from the previous one: one expensive
	// resample of the full-size source, then cheap ones.
	var prev image.Image
	for i := len(targets) - 1; i >= 0; i-- {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		tw := targets[i]
		th := max(1, (h*tw+w/2)/w)
		var img *image.NRGBA
		if prev == nil {
			rw, rh := tw, th
			if orientation >= 5 {
				rw, rh = th, tw
			}
			img = orient(resize(src, rw, rh), orientation)
		} else {
			img = resize(prev, tw, th)
		}
		prev = img

		enc, err := encode(img, p.opts.Quality)
		if err != nil {
			return nil, err
		}
		if enc, err = embedICC(enc, icc, tw, th); err != nil {
			return nil, err
		}
		res.Variants[i] = Variant{Width: tw, Height: th, Data: enc}
	}

	ph := resize(prev, placeholderWidth, max(1, (h*placeholderWidth+w/2)/w))
	enc, err := encode(ph, 30)
	if err != nil {
		return nil, err
	}
	res.Placeholder = "data:image/webp;base64," + base64.StdEncoding.EncodeToString(enc)
	return res, nil
}

// targetWidths keeps the configured widths that do not upscale, and adds the source width
// as the largest variant when it falls between breakpoints (or below the smallest).
func (p *Processor) targetWidths(srcW int) []int {
	var out []int
	for _, w := range p.opts.Widths {
		if w <= srcW {
			out = append(out, w)
		}
	}
	largest := p.opts.Widths[len(p.opts.Widths)-1]
	if srcW < largest && (len(out) == 0 || out[len(out)-1] != srcW) {
		out = append(out, srcW)
	}
	return out
}

func decodeConfig(ct string, data []byte) (image.Config, error) {
	r := bytes.NewReader(data)
	switch ct {
	case TypeJPEG:
		return jpeg.DecodeConfig(r)
	case TypePNG:
		return png.DecodeConfig(r)
	default:
		return webp.DecodeConfig(r)
	}
}

func decode(ct string, data []byte) (image.Image, error) {
	r := bytes.NewReader(data)
	switch ct {
	case TypeJPEG:
		return jpeg.Decode(r)
	case TypePNG:
		return png.Decode(r)
	default:
		return webp.Decode(r, webp.Options{AutoRotate: true})
	}
}

func resize(src image.Image, w, h int) *image.NRGBA {
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Src, nil)
	return dst
}

func encode(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := webp.Encode(&buf, img, webp.Options{Quality: quality, Method: 4}); err != nil {
		return nil, fmt.Errorf("imaging: encode webp: %w", err)
	}
	return buf.Bytes(), nil
}

// orient applies an EXIF orientation (1–8) by remapping pixels.
func orient(src *image.NRGBA, o int) *image.NRGBA {
	if o <= 1 || o > 8 {
		return src
	}
	w, h := src.Rect.Dx(), src.Rect.Dy()
	dw, dh := w, h
	if o >= 5 {
		dw, dh = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, dw, dh))
	for y := range dh {
		for x := range dw {
			var sx, sy int
			switch o {
			case 2:
				sx, sy = w-1-x, y
			case 3:
				sx, sy = w-1-x, h-1-y
			case 4:
				sx, sy = x, h-1-y
			case 5:
				sx, sy = y, x
			case 6:
				sx, sy = y, h-1-x
			case 7:
				sx, sy = w-1-y, h-1-x
			case 8:
				sx, sy = w-1-y, x
			}
			si := src.PixOffset(sx, sy)
			di := dst.PixOffset(x, y)
			copy(dst.Pix[di:di+4], src.Pix[si:si+4])
		}
	}
	return dst
}
