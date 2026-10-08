#!/usr/bin/env bash
# Regenerate subsetted webfonts for Mainsail (PRD docs/prd/frontend-performance.md R1).
#
# Takes the full 0xProto Nerd Font Mono TTFs in scripts/font-sources/ and emits,
# per weight, a `latin` subset (always downloaded) and a `symbols` subset
# (Nerd Font icon glyphs — downloaded only when rendered text needs them),
# each as woff2 + subset-ttf fallback with matching unicode-ranges declared in
# src/assets/styles/fonts.css.
#
# Prerequisite: pip install fonttools brotli
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRCDIR="$ROOT/scripts/font-sources"
FONTDIR="$ROOT/public/fonts/0xproto"

if ! python3 -c "import fontTools, brotli" 2>/dev/null; then
    echo "error: need 'pip install fonttools brotli'" >&2
    exit 1
fi

# Google Fonts 'latin' subset plus latin-ext/vietnamese so Central/Eastern
# European locales don't pull the 900KB symbols file for one glyph.
# Must stay in sync with the unicode-range descriptors in
# src/assets/styles/fonts.css.
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT="U+0100-024F,U+0259,U+1E00-1E9E,U+1EA0-1EF9,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF"
LATIN="$LATIN,$LATIN_EXT"

python3 - "$SRCDIR" "$FONTDIR" "$LATIN" <<'EOF'
import os
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

srcdir, fontdir, latin_spec = sys.argv[1], sys.argv[2], sys.argv[3]
latin = set(subset.parse_unicodes(latin_spec))


def to_ranges(codepoints):
    points = sorted(codepoints)
    if not points:
        return ""
    out, start, prev = [], points[0], points[0]
    for cp in points[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        out.append((start, prev))
        start, prev = cp, cp
    out.append((start, prev))
    return ",".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out)


for weight in ("Regular", "Bold"):
    src = os.path.join(srcdir, f"0xProtoNerdFontMono-{weight}.ttf")
    full = set()
    for table in TTFont(src)["cmap"].tables:
        if table.isUnicode():
            full.update(table.cmap.keys())
    symbols_spec = to_ranges(full - latin)
    print(f"SYMBOLS_RANGE={symbols_spec}")
    for name, spec in (("latin", latin_spec), ("symbols", symbols_spec)):
        for flavor, ext in (("woff2", "woff2"), (None, "ttf")):
            opts = subset.Options()
            if flavor:
                opts.flavor = flavor
            ss = subset.Subsetter(opts)
            ss.populate(unicodes=subset.parse_unicodes(spec))
            font = TTFont(src)
            ss.subset(font)
            out = os.path.join(fontdir, f"0xProtoNerdFontMono-{weight}-{name}.{ext}")
            subset.save_font(font, out, opts)
            print(f"{os.path.basename(out)}: {os.path.getsize(out) // 1024}KB")
EOF
