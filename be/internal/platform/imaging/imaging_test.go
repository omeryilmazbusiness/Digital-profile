package imaging

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"strings"
	"testing"

	"github.com/gen2brain/webp"
)

func newProcessor(t *testing.T) *Processor {
	t.Helper()
	p, err := NewProcessor(Options{MaxPixels: 50_000_000, Quality: 80, Concurrency: 2})
	if err != nil {
		t.Fatal(err)
	}
	return p
}

// halves returns a w×h image whose left half is red and right half is blue.
func halves(w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			c := color.NRGBA{R: 255, A: 255}
			if x >= w/2 {
				c = color.NRGBA{B: 255, A: 255}
			}
			img.SetNRGBA(x, y, c)
		}
	}
	return img
}

func encodeJPEG(t testing.TB, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// exifSegment builds an APP1 segment with orientation and a GPS-looking string, standing in
// for the location data phones embed.
func exifSegment(orientation uint16) []byte {
	var tiff bytes.Buffer
	tiff.WriteString("II")
	_ = binary.Write(&tiff, binary.LittleEndian, uint16(42))
	_ = binary.Write(&tiff, binary.LittleEndian, uint32(8))
	_ = binary.Write(&tiff, binary.LittleEndian, uint16(1)) // one entry
	_ = binary.Write(&tiff, binary.LittleEndian, uint16(0x0112))
	_ = binary.Write(&tiff, binary.LittleEndian, uint16(3))
	_ = binary.Write(&tiff, binary.LittleEndian, uint32(1))
	_ = binary.Write(&tiff, binary.LittleEndian, orientation)
	_ = binary.Write(&tiff, binary.LittleEndian, uint16(0))
	_ = binary.Write(&tiff, binary.LittleEndian, uint32(0))
	tiff.WriteString("GPSLatitude=21.4225N;GPSLongitude=39.8262E;SecretCameraSerial")
	return segment(0xE1, append([]byte("Exif\x00\x00"), tiff.Bytes()...))
}

func iccSegment(seq, total byte, data string) []byte {
	return segment(0xE2, append([]byte("ICC_PROFILE\x00"), append([]byte{seq, total}, data...)...))
}

func segment(marker byte, payload []byte) []byte {
	out := make([]byte, 4, 4+len(payload))
	out[0], out[1] = 0xFF, marker
	binary.BigEndian.PutUint16(out[2:], uint16(len(payload)+2))
	return append(out, payload...)
}

// withSegments inserts segments right after the SOI marker.
func withSegments(jpg []byte, segs ...[]byte) []byte {
	out := append([]byte{}, jpg[:2]...)
	for _, s := range segs {
		out = append(out, s...)
	}
	return append(out, jpg[2:]...)
}

func decodeWebP(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, err := webp.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("variant is not decodable WebP: %v", err)
	}
	return img
}

func chunks(t *testing.T, data []byte) []string {
	t.Helper()
	if string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" {
		t.Fatal("not a RIFF/WEBP file")
	}
	if got := binary.LittleEndian.Uint32(data[4:]); int(got) != len(data)-8 {
		t.Fatalf("RIFF size %d, file %d", got, len(data))
	}
	var names []string
	for i := 12; i+8 <= len(data); {
		size := int(binary.LittleEndian.Uint32(data[i+4:]))
		names = append(names, string(data[i:i+4]))
		i += 8 + size + size%2
	}
	return names
}

func TestProcess_WidthsNeverUpscale(t *testing.T) {
	p := newProcessor(t)
	for _, tc := range []struct {
		w    int
		want []int
	}{
		{2000, []int{480, 960, 1600}},
		{1600, []int{480, 960, 1600}},
		{1000, []int{480, 960, 1000}},
		{480, []int{480}},
		{100, []int{100}},
	} {
		res, err := p.Process(t.Context(), encodeJPEG(t, halves(tc.w, tc.w/2)))
		if err != nil {
			t.Fatalf("%d: %v", tc.w, err)
		}
		var got []int
		for _, v := range res.Variants {
			got = append(got, v.Width)
			if v.Height != max(1, (tc.w/2*v.Width+tc.w/2)/tc.w) {
				t.Errorf("%d: variant %dx%d has the wrong aspect ratio", tc.w, v.Width, v.Height)
			}
			if b := decodeWebP(t, v.Data).Bounds(); b.Dx() != v.Width || b.Dy() != v.Height {
				t.Errorf("%d: encoded %v, declared %dx%d", tc.w, b, v.Width, v.Height)
			}
		}
		if !equalInts(got, tc.want) {
			t.Errorf("source %d: widths %v, want %v", tc.w, got, tc.want)
		}
		if res.SourceType != TypeJPEG || res.Width != tc.w {
			t.Errorf("result = %s %dx%d", res.SourceType, res.Width, res.Height)
		}
	}
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestProcess_AppliesOrientationAndStripsMetadata(t *testing.T) {
	p := newProcessor(t)
	// Stored landscape (left red, right blue); orientation 6 means "rotate 90° clockwise".
	src := withSegments(encodeJPEG(t, halves(640, 320)), exifSegment(6), iccSegment(1, 1, "FAKE-ICC-PROFILE"))

	res, err := p.Process(t.Context(), src)
	if err != nil {
		t.Fatal(err)
	}
	if res.Width != 320 || res.Height != 640 {
		t.Fatalf("display size %dx%d, want 320x640 (portrait)", res.Width, res.Height)
	}
	img := decodeWebP(t, res.Variants[0].Data)
	b := img.Bounds()
	top := color.NRGBAModel.Convert(img.At(b.Dx()/2, b.Dy()/4)).(color.NRGBA)
	bottom := color.NRGBAModel.Convert(img.At(b.Dx()/2, 3*b.Dy()/4)).(color.NRGBA)
	if top.R < 200 || top.B > 60 || bottom.B < 200 || bottom.R > 60 {
		t.Errorf("rotation wrong: top %v, bottom %v (want red over blue)", top, bottom)
	}

	for _, v := range res.Variants {
		for _, leak := range []string{"Exif", "GPS", "SecretCameraSerial"} {
			if bytes.Contains(v.Data, []byte(leak)) {
				t.Errorf("variant %d leaks %q", v.Width, leak)
			}
		}
		names := chunks(t, v.Data)
		if len(names) < 3 || names[0] != "VP8X" || names[1] != "ICCP" {
			t.Errorf("variant %d chunks = %v, want VP8X, ICCP, ...", v.Width, names)
		}
		if !bytes.Contains(v.Data, []byte("FAKE-ICC-PROFILE")) {
			t.Errorf("variant %d lost the colour profile", v.Width)
		}
	}
	if !strings.HasPrefix(res.Placeholder, "data:image/webp;base64,") || len(res.Placeholder) > 1024 {
		t.Errorf("placeholder = %d bytes", len(res.Placeholder))
	}
}

func TestProcess_EveryOrientation(t *testing.T) {
	p := newProcessor(t)
	for o := uint16(1); o <= 8; o++ {
		res, err := p.Process(t.Context(), withSegments(encodeJPEG(t, halves(200, 100)), exifSegment(o)))
		if err != nil {
			t.Fatalf("orientation %d: %v", o, err)
		}
		wantW, wantH := 200, 100
		if o >= 5 {
			wantW, wantH = 100, 200
		}
		if res.Width != wantW || res.Height != wantH {
			t.Errorf("orientation %d: %dx%d, want %dx%d", o, res.Width, res.Height, wantW, wantH)
		}
	}
}

func TestProcess_PNGKeepsTransparency(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 600, 300))
	for x := range 300 {
		for y := range 300 {
			img.SetNRGBA(x, y, color.NRGBA{G: 200, A: 255})
		}
	}
	res, err := newProcessor(t).Process(t.Context(), encodePNG(t, img))
	if err != nil {
		t.Fatal(err)
	}
	out := decodeWebP(t, res.Variants[0].Data)
	b := out.Bounds()
	if _, _, _, a := out.At(b.Dx()-5, b.Dy()/2).RGBA(); a > 0x1000 {
		t.Errorf("transparent area became opaque (alpha %d)", a)
	}
	if _, _, _, a := out.At(5, b.Dy()/2).RGBA(); a < 0xF000 {
		t.Errorf("opaque area became transparent (alpha %d)", a)
	}
}

func TestProcess_WebPInput(t *testing.T) {
	var buf bytes.Buffer
	if err := webp.Encode(&buf, halves(800, 400), webp.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	res, err := newProcessor(t).Process(t.Context(), buf.Bytes())
	if err != nil || res.SourceType != TypeWebP || len(res.Variants) != 2 {
		t.Fatalf("res = %+v, err = %v", res, err)
	}
}

func TestProcess_RejectsBadInput(t *testing.T) {
	p := newProcessor(t)
	jpg := encodeJPEG(t, halves(400, 200))

	var gifBuf bytes.Buffer
	_ = gif.Encode(&gifBuf, halves(10, 10), nil)

	cases := map[string]struct {
		data []byte
		want error
	}{
		"empty":                   {nil, ErrEmpty},
		"html posing as pdf":      {[]byte("<!DOCTYPE html><html><script>alert(1)</script></html>"), ErrUnsupportedType},
		"pdf":                     {[]byte("%PDF-1.7\n1 0 obj\n"), ErrUnsupportedType},
		"svg":                     {[]byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`), ErrUnsupportedType},
		"gif":                     {gifBuf.Bytes(), ErrUnsupportedType},
		"heic":                    {append([]byte{0, 0, 0, 24}, []byte("ftypheic\x00\x00\x00\x00mif1heic")...), ErrHEIC},
		"truncated jpeg":          {jpg[:len(jpg)/2], ErrCorrupt},
		"jpeg header only":        {jpg[:20], ErrCorrupt},
		"garbage after png magic": {append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{7}, 100)...), ErrCorrupt},
		"decompression bomb":      {pngHeader(20000, 20000), ErrTooLarge},
		"over pixel budget":       {pngHeader(10000, 6000), ErrTooLarge},
	}
	for name, tc := range cases {
		if _, err := p.Process(t.Context(), tc.data); !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", name, err, tc.want)
		}
	}
}

// pngHeader returns a PNG whose IHDR declares w×h but which has no pixel data, the shape of a
// decompression bomb: rejecting it must not require decoding.
func pngHeader(w, h uint32) []byte {
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], w)
	binary.BigEndian.PutUint32(ihdr[4:], h)
	ihdr[8], ihdr[9] = 8, 6 // 8-bit RGBA
	var out bytes.Buffer
	out.WriteString("\x89PNG\r\n\x1a\n")
	_ = binary.Write(&out, binary.BigEndian, uint32(len(ihdr)))
	chunk := append([]byte("IHDR"), ihdr...)
	out.Write(chunk)
	_ = binary.Write(&out, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return out.Bytes()
}

func TestProcess_HonoursContextWhileQueued(t *testing.T) {
	p, err := NewProcessor(Options{MaxPixels: 1e7, Quality: 80, Concurrency: 1})
	if err != nil {
		t.Fatal(err)
	}
	p.sem <- struct{}{} // occupy the only slot
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := p.Process(ctx, encodeJPEG(t, halves(100, 100))); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
}

func TestNewProcessor_Validates(t *testing.T) {
	for _, o := range []Options{{}, {MaxPixels: 1, Quality: 0, Concurrency: 1}, {MaxPixels: 1, Quality: 80}} {
		if _, err := NewProcessor(o); err == nil {
			t.Errorf("options %+v accepted", o)
		}
	}
}

func TestJPEGMeta_MultiChunkICC(t *testing.T) {
	jpg := withSegments(encodeJPEG(t, halves(8, 8)), iccSegment(2, 2, "-PART2"), iccSegment(1, 2, "PART1"))
	if _, icc := jpegMeta(jpg); string(icc) != "PART1-PART2" {
		t.Errorf("icc = %q, want chunks reassembled in sequence order", icc)
	}
	if o, _ := jpegMeta(jpg); o != 1 {
		t.Errorf("orientation without EXIF = %d, want 1", o)
	}
}

func FuzzJPEGMeta(f *testing.F) {
	f.Add(withSegments([]byte{0xFF, 0xD8, 0xFF, 0xD9}, exifSegment(6), iccSegment(1, 1, "x")))
	f.Add([]byte{0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x02})
	f.Add([]byte{0xFF, 0xD8, 0xFF, 0xE1, 0xFF, 0xFF, 'E', 'x', 'i', 'f', 0, 0, 'M', 'M', 0, 42, 0xFF, 0xFF, 0xFF, 0xFF})
	f.Fuzz(func(t *testing.T, data []byte) {
		o, icc := jpegMeta(data)
		if o < 1 || o > 8 || len(icc) > maxICCBytes {
			t.Fatalf("orientation %d, icc %d bytes", o, len(icc))
		}
	})
}
