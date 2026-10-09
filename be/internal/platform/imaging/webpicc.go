package imaging

import (
	"encoding/binary"
	"errors"
)

// embedICC inserts an ICCP chunk into an encoded WebP file, converting a simple-format file
// (a lone VP8/VP8L chunk) to the extended format with a VP8X header as the spec requires.
// See https://developers.google.com/speed/webp/docs/riff_container.
func embedICC(webp, icc []byte, width, height int) ([]byte, error) {
	if len(icc) == 0 {
		return webp, nil
	}
	if len(webp) < 20 || string(webp[:4]) != "RIFF" || string(webp[8:12]) != "WEBP" {
		return nil, errors.New("imaging: not a WebP file")
	}
	body := webp[12:]
	first := string(body[:4])

	out := make([]byte, 0, len(webp)+len(icc)+40)
	out = append(out, "RIFF\x00\x00\x00\x00WEBP"...)

	switch first {
	case "VP8X":
		if len(body) < 18 {
			return nil, errors.New("imaging: truncated VP8X chunk")
		}
		vp8x := append([]byte(nil), body[:18]...)
		vp8x[8] |= 0x20 // ICC flag
		out = append(out, vp8x...)
		out = appendChunk(out, "ICCP", icc)
		out = append(out, body[18:]...)
	case "VP8 ", "VP8L":
		var hdr [10]byte
		hdr[0] = 0x20
		putUint24(hdr[4:], width-1)
		putUint24(hdr[7:], height-1)
		out = appendChunk(out, "VP8X", hdr[:])
		out = appendChunk(out, "ICCP", icc)
		out = append(out, body...)
	default:
		return nil, errors.New("imaging: unexpected first WebP chunk " + first)
	}
	binary.LittleEndian.PutUint32(out[4:], uint32(len(out)-8)) //nolint:gosec // bounded by upload limits
	return out, nil
}

func appendChunk(out []byte, fourCC string, payload []byte) []byte {
	out = append(out, fourCC...)
	out = binary.LittleEndian.AppendUint32(out, uint32(len(payload))) //nolint:gosec // bounded by maxICCBytes
	out = append(out, payload...)
	if len(payload)%2 == 1 {
		out = append(out, 0)
	}
	return out
}

func putUint24(b []byte, v int) {
	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], uint32(v)) //nolint:gosec // callers pass 24-bit values (dimensions minus one)
	copy(b, tmp[:3])
}
