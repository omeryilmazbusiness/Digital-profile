package imaging

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/gen2brain/webp"
)

func TestSquareJPEG_CropsAndScales(t *testing.T) {
	// Tall portrait: top quarter red, the rest blue. The crop keeps the upper part.
	src := image.NewNRGBA(image.Rect(0, 0, 400, 800))
	for y := range 800 {
		for x := range 400 {
			c := color.NRGBA{B: 255, A: 255}
			if y < 200 {
				c = color.NRGBA{R: 255, A: 255}
			}
			src.SetNRGBA(x, y, c)
		}
	}
	var webpSrc bytes.Buffer
	if err := webp.Encode(&webpSrc, src, webp.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}

	out, err := SquareJPEG(webpSrc.Bytes(), 200, 85)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("output is not a JPEG: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 200 || b.Dy() != 200 {
		t.Fatalf("size = %v, want 200x200", b)
	}
	// The crop starts at y=100 (a quarter of the 400px excess), so the top quarter of the
	// output is red and the bottom is blue.
	if r, _, b, _ := img.At(100, 10).RGBA(); r>>8 < 200 || b>>8 > 60 {
		t.Errorf("top is not red: r=%d b=%d", r>>8, b>>8)
	}
	if r, _, b, _ := img.At(100, 190).RGBA(); b>>8 < 200 || r>>8 > 60 {
		t.Errorf("bottom is not blue: r=%d b=%d", r>>8, b>>8)
	}
}

func TestSquareJPEG_NeverUpscalesAndFlattensTransparency(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 50, 80)) // fully transparent
	out, err := SquareJPEG(encodePNG(t, src), 600, 85)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if b := img.Bounds(); b.Dx() != 50 || b.Dy() != 50 {
		t.Fatalf("size = %v, want 50x50", b)
	}
	if r, g, b, _ := img.At(25, 25).RGBA(); r>>8 < 245 || g>>8 < 245 || b>>8 < 245 {
		t.Errorf("transparent pixels must become white, got %d,%d,%d", r>>8, g>>8, b>>8)
	}
}

func TestSquareJPEG_RejectsBadInput(t *testing.T) {
	if _, err := SquareJPEG([]byte("not an image"), 100, 80); !errors.Is(err, ErrUnsupportedType) {
		t.Errorf("err = %v, want ErrUnsupportedType", err)
	}
	if _, err := SquareJPEG(encodeJPEG(t, halves(10, 10)), 0, 80); err == nil {
		t.Error("size 0 must be rejected")
	}
}

func TestFlatJPEG_KeepsProportions(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 3200, 2000)) // landscape card, transparent
	out, err := FlatJPEG(encodePNG(t, src), 1600, 90)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("output is not a JPEG: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 1600 || b.Dy() != 1000 {
		t.Fatalf("size = %v, want 1600x1000", b)
	}
	if r, g, b, _ := img.At(800, 500).RGBA(); r>>8 < 245 || g>>8 < 245 || b>>8 < 245 {
		t.Errorf("transparent pixels must become white, got %d,%d,%d", r>>8, g>>8, b>>8)
	}
}

func TestFlatJPEG_NeverUpscales(t *testing.T) {
	out, err := FlatJPEG(encodeJPEG(t, halves(300, 500)), 1600, 90)
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 300 || cfg.Height != 500 {
		t.Fatalf("size = %dx%d, want 300x500", cfg.Width, cfg.Height)
	}
}

func TestFlatJPEG_RejectsBadInput(t *testing.T) {
	if _, err := FlatJPEG([]byte("not an image"), 100, 80); !errors.Is(err, ErrUnsupportedType) {
		t.Errorf("err = %v, want ErrUnsupportedType", err)
	}
	if _, err := FlatJPEG(encodeJPEG(t, halves(10, 10)), 100, 0); err == nil {
		t.Error("quality 0 must be rejected")
	}
}
