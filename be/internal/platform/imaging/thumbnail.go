package imaging

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"

	"golang.org/x/image/draw"
)

// SquareJPEG renders a square JPEG thumbnail of at most size pixels per side, the format
// every contacts app accepts for a vCard PHOTO. Tall images keep their upper part, where a
// portrait's face usually is; transparency is flattened onto white.
func SquareJPEG(data []byte, size, quality int) ([]byte, error) {
	if size < 1 || quality < 1 || quality > 100 {
		return nil, fmt.Errorf("imaging: invalid thumbnail options size=%d quality=%d", size, quality)
	}
	ct, err := Sniff(data)
	if err != nil {
		return nil, err
	}
	cfg, err := decodeConfig(ct, data)
	if err != nil || cfg.Width < 1 || cfg.Height < 1 {
		return nil, ErrCorrupt
	}
	if cfg.Width > maxDimension || cfg.Height > maxDimension {
		return nil, ErrTooLarge
	}
	src, err := decode(ct, data)
	if err != nil {
		return nil, ErrCorrupt
	}

	b := src.Bounds()
	side := min(b.Dx(), b.Dy())
	x0 := b.Min.X + (b.Dx()-side)/2
	y0 := b.Min.Y + (b.Dy()-side)/4
	crop := image.Rect(x0, y0, x0+side, y0+side)

	out := min(size, side)
	dst := image.NewRGBA(image.Rect(0, 0, out, out))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, crop, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: quality}); err != nil {
		return nil, fmt.Errorf("imaging: encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}
