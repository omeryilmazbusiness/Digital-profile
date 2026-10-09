package imaging

import (
	"bytes"
	"encoding/binary"
	"slices"
)

// maxICCBytes bounds the colour profile carried over to variants; real profiles are a few KB.
const maxICCBytes = 256 << 10

// jpegMeta extracts the only metadata worth keeping from a JPEG: the EXIF orientation (applied
// to the pixels, then discarded) and the ICC colour profile (re-embedded so wide-gamut photos,
// e.g. iPhone Display P3, keep their colours). Everything else — GPS, camera, timestamps — is
// dropped because variants are re-encoded from pixels.
//
// The parser is defensive: malformed segments end the scan and yield defaults.
func jpegMeta(data []byte) (orientation int, icc []byte) {
	orientation = 1
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return orientation, nil
	}
	type iccChunk struct {
		seq  byte
		data []byte
	}
	var chunks []iccChunk
	total := 0

	for i := 2; i+4 <= len(data); {
		if data[i] != 0xFF {
			break
		}
		marker := data[i+1]
		if marker == 0xFF { // fill byte
			i++
			continue
		}
		if marker == 0xD9 || marker == 0xDA { // EOI / start of scan: no metadata follows
			break
		}
		if marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7) { // standalone markers
			i += 2
			continue
		}
		size := int(binary.BigEndian.Uint16(data[i+2:]))
		if size < 2 || i+2+size > len(data) {
			break
		}
		seg := data[i+4 : i+2+size]
		switch {
		case marker == 0xE1 && bytes.HasPrefix(seg, []byte("Exif\x00\x00")):
			if o := exifOrientation(seg[6:]); o != 0 {
				orientation = o
			}
		case marker == 0xE2 && bytes.HasPrefix(seg, []byte("ICC_PROFILE\x00")) && len(seg) > 14:
			total += len(seg) - 14
			if total <= maxICCBytes {
				chunks = append(chunks, iccChunk{seq: seg[12], data: seg[14:]})
			}
		}
		i += 2 + size
	}

	if len(chunks) > 0 && total <= maxICCBytes {
		slices.SortStableFunc(chunks, func(a, b iccChunk) int { return int(a.seq) - int(b.seq) })
		for _, c := range chunks {
			icc = append(icc, c.data...)
		}
	}
	return orientation, icc
}

// exifOrientation reads tag 0x0112 from IFD0 of a TIFF-structured EXIF block. It returns 0 when
// the tag is absent or the block is malformed.
func exifOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 0
	}
	var bo binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 0
	}
	if bo.Uint16(tiff[2:]) != 42 {
		return 0
	}
	ifd := int(bo.Uint32(tiff[4:]))
	if ifd < 8 || ifd+2 > len(tiff) {
		return 0
	}
	n := int(bo.Uint16(tiff[ifd:]))
	for e := range n {
		off := ifd + 2 + e*12
		if off+12 > len(tiff) {
			return 0
		}
		if bo.Uint16(tiff[off:]) != 0x0112 {
			continue
		}
		if bo.Uint16(tiff[off+2:]) != 3 { // SHORT
			return 0
		}
		if v := int(bo.Uint16(tiff[off+8:])); v >= 1 && v <= 8 {
			return v
		}
		return 0
	}
	return 0
}
