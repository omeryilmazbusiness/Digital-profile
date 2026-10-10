#!/usr/bin/env python3
"""Builds the profile page's display serif: Bodoni Moda with its optical-size axis kept (so the
browser thickens hairlines at smaller sizes), weights 400-700, subset to Latin, as WOFF2.

Usage (from fe/, needs fontTools and brotli: pip install fonttools brotli):
    python3 scripts/build-display-font.py
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/fonts/bodoni-moda"
OUTPUT = ROOT / "src/features/profile/fonts"

# Basic Latin, Latin-1, Latin Extended-A, and general punctuation (dashes, quotes, ellipsis).
UNICODES = "U+0000-00FF,U+0100-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2190-2193"
STYLES = {"BodoniModa.ttf": "bodoni-moda.woff2", "BodoniModa-Italic.ttf": "bodoni-moda-italic.woff2"}


def build(source: Path, target: Path) -> None:
    # Subset before instancing: the instancer leaves glyph variations the subsetter can't read.
    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "lnum", "onum", "pnum", "tnum", "case"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    font = instancer.instantiateVariableFont(font, {"opsz": (11, 96), "wght": (400, 700)})
    font.flavor = "woff2"
    font.save(target)
    print(f"{target.relative_to(ROOT)}: {target.stat().st_size / 1024:.1f} KB")


OUTPUT.mkdir(parents=True, exist_ok=True)
for source, target in STYLES.items():
    build(SOURCE / source, OUTPUT / target)
