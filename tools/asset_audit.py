#!/usr/bin/env python3
"""Medieverse asset audit — measures assets against docs/ASSETS.md.

Emits JSON (default) or Markdown. Every check reports one of:
  PASS | WARN | FAIL | NOT_ASSESSED (with a reason).
Never estimates: anything not measurable is NOT_ASSESSED.

Usage:
  python3 tools/asset_audit.py [--root .] [--scope all|units|weapons|vfx|ui|maps|audio] [--md]

Requires: Pillow (pip install pillow --break-system-packages).
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]

# --- Standards mirrored from docs/ASSETS.md (§1.2, §2). Keep in sync. ---------
PALETTE_HEX = {
    "lapis": "2c4a8c", "azur": "6f93c9", "vermillon": "b8322a", "rose_garance": "c96a6e",
    "vert_de_gris": "4d7a4a", "vert_tendre": "8fae6a", "ocre": "c99a3e", "terre_ombre": "6b4a2e",
    "or": "d4a93c", "ceruse": "f3ecd9", "velin": "e9dcc0", "encre": "2a1d14", "carnation": "f0cfb0",
}
SHADE_FACTORS = (1.0, 0.82, 0.66)      # ASSETS §1.1: 1–2 darker shades allowed for modelling
PALETTE_TOLERANCE = 48                 # RGB euclidean distance
OFF_PALETTE_MAX = 0.05                 # ASSETS §9.3: <= 5 % off-palette
ATLAS_MAX = 2048                       # ASSETS §2 / TECH_SPEC §9
PIVOT_RGB = (255, 0, 255)              # ASSETS §2: magenta pivot pixel in rig sources
CATEGORIES = {"unit", "weapon", "vfx", "ui", "map", "prop", "sfx", "mus", "amb", "font", "atlas"}
NAME_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)+\.[a-z0-9]+$")
IMAGE_EXT = {".png", ".webp"}
AUDIO_EXT = {".ogg", ".wav", ".mp3"}
SCOPES = {
    "units": ("unit_",), "weapons": ("weapon_",), "vfx": ("vfx_",), "ui": ("ui_",),
    "maps": ("map_", "paint", "mask", "bg_", "frame"), "audio": ("sfx_", "mus_", "amb_"),
}


@dataclass
class Finding:
    file: str
    check: str
    status: str
    detail: str = ""


@dataclass
class Report:
    roots: dict[str, str]
    scanned: int = 0
    findings: list[Finding] = field(default_factory=list)
    sections: dict[str, str] = field(default_factory=dict)

    def add(self, *a: str) -> None:
        self.findings.append(Finding(*a))


def _pixels(img: "Image.Image"):
    fn = getattr(img, "get_flattened_data", None)  # Pillow >= 12.x; getdata deprecated
    return fn() if fn else _pixels(img)


def _palette() -> list[tuple[int, int, int]]:
    out = []
    for h in PALETTE_HEX.values():
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        out += [(int(r * f), int(g * f), int(b * f)) for f in SHADE_FACTORS]
    return out


def off_palette_ratio(img: "Image.Image") -> float | None:
    img = img.convert("RGBA")
    img.thumbnail((256, 256))  # sampling is enough for a ratio
    pal = _palette()
    tol2 = PALETTE_TOLERANCE ** 2
    total = off = 0
    for r, g, b, a in _pixels(img):
        if a != 255:  # skip anti-aliased edges and transparency
            continue
        total += 1
        if min((r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2 for p in pal) > tol2:
            off += 1
    return None if total == 0 else off / total


def is_grayscale(img: "Image.Image") -> bool:
    rgb = img.convert("RGB")
    rgb.thumbnail((128, 128))
    return all(max(px) - min(px) <= 12 for px in _pixels(rgb))


def ogg_sample_rate(path: Path) -> int | None:
    data = path.read_bytes()[:256]
    i = data.find(b"\x01vorbis")
    if i < 0:
        return None
    return struct.unpack_from("<I", data, i + 12)[0]


def audit(root: Path, scope: str) -> Report:
    src, pkg = root / "assets", root / "public" / "assets"
    rep = Report(roots={"source": str(src), "packaged": str(pkg)})
    if not src.exists() and not pkg.exists():
        rep.sections["all"] = "NOT_ASSESSED — neither assets/ nor public/assets/ exists"
        return rep
    if Image is None:
        rep.sections["images"] = "NOT_ASSESSED — Pillow not installed"

    files = [p for base in (src, pkg) if base.exists() for p in base.rglob("*") if p.is_file()]
    if scope != "all":
        prefixes = SCOPES[scope]
        files = [p for p in files if p.name.startswith(prefixes)]
    files = [p for p in files if not p.name.startswith(".")]
    rep.scanned = len(files)
    if not files:
        rep.sections["all"] = f"NOT_ASSESSED — no files in scope '{scope}'"
        return rep

    for p in sorted(files):
        rel = str(p.relative_to(root))
        is_source = src in p.parents
        ext = p.suffix.lower()

        # Naming (ASSETS §2). Map folders keep fixed file names (TECH_SPEC §6).
        in_map_dir = "maps" in p.parts
        if not in_map_dir and ext not in {".json", ".psd", ".kra", ".svg", ".md"}:
            if not NAME_RE.match(p.name):
                rep.add(rel, "naming", "WARN", "expected snake_case <category>_<subject>_<variant>[_<state>]")
            elif p.name.split("_", 1)[0] not in CATEGORIES:
                rep.add(rel, "naming", "WARN", f"unknown category prefix; allowed: {sorted(CATEGORIES)}")

        if ext in IMAGE_EXT and Image is not None:
            try:
                with Image.open(p) as img:
                    w, h = img.size
                    if "atlas" in p.parts or p.name.startswith("atlas_"):
                        if max(w, h) > ATLAS_MAX:
                            rep.add(rel, "atlas_size", "FAIL", f"{w}x{h} > {ATLAS_MAX}")
                    if in_map_dir and p.name.startswith("paint_") and (w > 512 or h > 512):
                        rep.add(rel, "tile_size", "FAIL", f"terrain tile {w}x{h} > 512 (TECH_SPEC §4.3)")
                    if p.name.startswith("mask"):
                        continue  # material mask: fixed colours, checked by maps:build
                    if "_tint" in p.stem:
                        if not is_grayscale(img):
                            rep.add(rel, "tintable", "FAIL", "tintable piece is not neutral grayscale")
                    else:
                        ratio = off_palette_ratio(img)
                        if ratio is None:
                            rep.add(rel, "palette", "NOT_ASSESSED", "no fully opaque pixel")
                        elif ratio > OFF_PALETTE_MAX:
                            rep.add(rel, "palette", "WARN", f"{ratio:.1%} off-palette (max {OFF_PALETTE_MAX:.0%})")
                    if is_source and p.name.startswith("unit_") and ext == ".png":
                        rgba = img.convert("RGBA")
                        if PIVOT_RGB + (255,) not in set(_pixels(rgba)):
                            rep.add(rel, "pivot", "WARN", "no magenta pivot pixel in rig source")
            except Exception as e:  # noqa: BLE001
                rep.add(rel, "read", "FAIL", f"cannot open image: {e}")

        if ext in AUDIO_EXT:
            if ext == ".ogg":
                sr = ogg_sample_rate(p)
                if sr is None:
                    rep.add(rel, "audio_rate", "NOT_ASSESSED", "no vorbis header found")
                elif sr not in (44100, 48000):
                    rep.add(rel, "audio_rate", "WARN", f"sample rate {sr}")
            elif not is_source:
                rep.add(rel, "audio_format", "WARN", f"{ext} in packaged assets; expected .ogg")
            rep.sections.setdefault("audio_duration", "NOT_ASSESSED — duration not measured by this tool")

    return rep


def verdict(rep: Report) -> str:
    st = {f.status for f in rep.findings}
    if "FAIL" in st:
        return "NON_COMPLIANT"
    if "WARN" in st:
        return "WARNINGS"
    if rep.scanned == 0 or rep.sections or "NOT_ASSESSED" in st:
        return "NOT_ASSESSED"
    return "COMPLIANT"


def to_md(rep: Report) -> str:
    lines = [f"# Asset audit — verdict: **{verdict(rep)}**", "", f"Scanned: {rep.scanned} files", ""]
    if rep.sections:
        lines += ["## Not assessed", *[f"- {k}: {v}" for k, v in rep.sections.items()], ""]
    if rep.findings:
        lines += ["## Findings", "| File | Check | Status | Detail |", "|---|---|---|---|"]
        lines += [f"| `{f.file}` | {f.check} | {f.status} | {f.detail} |" for f in rep.findings]
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--scope", default="all", choices=["all", *SCOPES])
    ap.add_argument("--md", action="store_true")
    a = ap.parse_args()
    rep = audit(Path(a.root).resolve(), a.scope)
    if a.md:
        sys.stdout.write(to_md(rep))
    else:
        json.dump({**asdict(rep), "verdict": verdict(rep)}, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
    return {"COMPLIANT": 0, "NOT_ASSESSED": 0, "WARNINGS": 0}.get(verdict(rep), 1)


if __name__ == "__main__":
    raise SystemExit(main())
