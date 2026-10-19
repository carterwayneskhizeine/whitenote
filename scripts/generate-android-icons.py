#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens for the WhiteNote APK.

Design matches the site's light minimal theme: near-black brand tile
(#1C1C21, 站点 --primary 近似) + white logo glyph (the mountain stroke from
public/goldielogoL.svg). Splash is white background + centered dark tile, so
the handoff from splash to the site's white first screen has no black flash.

Usage: python3 scripts/generate-android-icons.py   (run from repo root)
"""

from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"

BRAND_DARK = (0x1C, 0x1C, 0x21, 255)   # #1C1C21 near-black brand
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Logo polygon from public/goldielogoL.svg (viewBox 512), plus its bbox center
# so it can be centered in any target box.
LOGO_POINTS = [
    (256.8, 61), (236.14, 96.79), (236.15, 96.82), (70, 384.6),
    (111.4, 384.6), (256.93, 132.54), (382.67, 348.75), (210.66, 348.75),
    (269.06, 246.93), (248.32, 211.01), (148.76, 384.6), (179.71, 384.6),
    (190.1, 384.6), (403.52, 384.6), (419.08, 384.6), (445, 384.6),
]
LOGO_CX, LOGO_CY = (70 + 445) / 2, (61 + 384.6) / 2

# Supersampling factor: draw large, downscale with LANCZOS for smooth edges.
SS = 12


def draw_logo(draw: ImageDraw.ImageDraw, x: float, y: float, s: float, color) -> None:
    """Draw the logo glyph centered inside the box (x, y, s, s)."""
    k = s / 512.0
    pts = [
        (x + s / 2 + (px - LOGO_CX) * k, y + s / 2 + (py - LOGO_CY) * k)
        for px, py in LOGO_POINTS
    ]
    draw.polygon(pts, fill=color)


def make_launcher(size: int) -> Image.Image:
    """Legacy launcher icon: full-bleed dark circle + white logo."""
    c = size * SS
    img = Image.new("RGBA", (c, c), TRANSPARENT)
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, c - 1, c - 1], fill=BRAND_DARK)
    g = c * 0.62
    draw_logo(d, (c - g) / 2, (c - g) / 2, g, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def make_foreground(size: int) -> Image.Image:
    """Adaptive-icon foreground: transparent canvas, glyph inside the 66/108 safe zone."""
    c = size * SS
    img = Image.new("RGBA", (c, c), TRANSPARENT)
    d = ImageDraw.Draw(img)
    g = c * 0.55
    draw_logo(d, (c - g) / 2, (c - g) / 2, g, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def make_splash(w: int, h: int) -> Image.Image:
    """Splash screen: white background + centered dark rounded tile with white logo."""
    cw, ch = w * SS, h * SS
    img = Image.new("RGBA", (cw, ch), WHITE)
    d = ImageDraw.Draw(img)
    tile = min(cw, ch) * 0.30
    tx, ty = (cw - tile) / 2, (ch - tile) / 2
    d.rounded_rectangle([tx, ty, tx + tile, ty + tile], radius=tile * 0.24, fill=BRAND_DARK)
    g = tile * 0.62
    draw_logo(d, tx + (tile - g) / 2, ty + (tile - g) / 2, g, WHITE)
    return img.resize((w, h), Image.LANCZOS)


DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def main() -> None:
    for density, scale in DENSITIES.items():
        launcher = int(48 * scale)
        foreground = int(108 * scale)
        mipmap = RES / f"mipmap-{density}"
        make_launcher(launcher).save(mipmap / "ic_launcher.png")
        make_launcher(launcher).save(mipmap / "ic_launcher_round.png")
        make_foreground(foreground).save(mipmap / "ic_launcher_foreground.png")
        print(f"mipmap-{density}: launcher {launcher}px, foreground {foreground}px")

    # Adaptive icon background: solid brand dark (replaces template color)
    colors = RES / "values" / "ic_launcher_background.xml"
    colors.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#1C1C21</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    splash_sizes = {
        "drawable/splash.png": (480, 320),
        "drawable-port-mdpi/splash.png": (320, 480),
        "drawable-port-hdpi/splash.png": (480, 800),
        "drawable-port-xhdpi/splash.png": (720, 1280),
        "drawable-port-xxhdpi/splash.png": (960, 1600),
        "drawable-port-xxxhdpi/splash.png": (1280, 1920),
        "drawable-land-mdpi/splash.png": (480, 320),
        "drawable-land-hdpi/splash.png": (800, 480),
        "drawable-land-xhdpi/splash.png": (1280, 720),
        "drawable-land-xxhdpi/splash.png": (1600, 960),
        "drawable-land-xxxhdpi/splash.png": (1920, 1280),
    }
    for rel, (w, h) in splash_sizes.items():
        make_splash(w, h).save(RES / rel)
        print(f"{rel}: {w}x{h}")

    print("done")


if __name__ == "__main__":
    main()
