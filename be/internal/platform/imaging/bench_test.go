package imaging

import "testing"

// BenchmarkProcess12MP measures a typical phone photo: about 2 s and 300 MB per upload on a
// laptop CPU, which is why MEDIA_PROCESSING_CONCURRENCY defaults to 1.
func BenchmarkProcess12MP(b *testing.B) {
	p, err := NewProcessor(Options{MaxPixels: 50_000_000, Quality: 82, Concurrency: 1})
	if err != nil {
		b.Fatal(err)
	}
	data := encodeJPEG(b, halves(4032, 3024))
	for b.Loop() {
		if _, err := p.Process(b.Context(), data); err != nil {
			b.Fatal(err)
		}
	}
}
