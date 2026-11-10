"""
GNOME Theme Studio - Vector Wallpaper Generator
Generates high-resolution 4K SVG wallpapers dynamically tailored to the theme's color palette.
"""

import os
import re

USER_HOME = os.path.expanduser("~")
DEFAULT_BACKGROUNDS_DIR = os.path.join(USER_HOME, ".local", "share", "backgrounds")


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Converts hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def generate_svg_wallpaper(config: dict, style: str = "abstract_waves", width: int = 3840, height: int = 2160) -> str:
    """
    Generates a 4K SVG wallpaper matching the theme colors.
    Styles supported: 'abstract_waves', 'aurora', 'geometric'
    """
    bg = config.get("window_bg", "#2d353b")
    bg_dim = config.get("headerbar_bg", "#232a2e")
    accent = config.get("accent_color", "#a7c080")
    secondary = config.get("accent_secondary", "#83c092")
    surface = config.get("surface_elevated", "#343f44")
    card_bg = config.get("sidebar_bg", "#272e33")

    if style == "aurora":
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <radialGradient id="aurora1" cx="30%" cy="20%" r="65%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="{secondary}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="{bg}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aurora2" cx="80%" cy="85%" r="70%">
      <stop offset="0%" stop-color="{secondary}" stop-opacity="0.4"/>
      <stop offset="50%" stop-color="{accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="{bg_dim}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aurora3" cx="70%" cy="30%" r="50%">
      <stop offset="0%" stop-color="{surface}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="{bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="{bg_dim}"/>
  <rect width="{width}" height="{height}" fill="{bg}" opacity="0.85"/>
  <rect width="{width}" height="{height}" fill="url(#aurora1)"/>
  <rect width="{width}" height="{height}" fill="url(#aurora2)"/>
  <circle cx="{width * 0.7}" cy="{height * 0.35}" r="{width * 0.35}" fill="url(#aurora3)"/>
</svg>"""

    elif style == "geometric":
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{bg_dim}"/>
      <stop offset="100%" stop-color="{bg}"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="{secondary}" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="g3" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="{secondary}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="{surface}" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#g1)"/>
  <polygon points="0,0 {width * 0.65},0 {width * 0.4},{height} 0,{height}" fill="{surface}" opacity="0.35"/>
  <polygon points="{width * 0.25},0 {width},0 {width},{height * 0.75} {width * 0.45},{height}" fill="url(#g2)"/>
  <polygon points="{width * 0.1},{height} {width},{height * 0.4} {width},{height}" fill="url(#g3)"/>
  <polygon points="{width * 0.5},0 {width * 0.85},0 {width * 0.6},{height * 0.5}" fill="{accent}" opacity="0.25"/>
</svg>"""

    else:
        # Default: "abstract_waves" (GNOME Signature Style)
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{bg_dim}"/>
      <stop offset="50%" stop-color="{bg}"/>
      <stop offset="100%" stop-color="{card_bg}"/>
    </linearGradient>
    <linearGradient id="wave1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="{secondary}" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="wave2Grad" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="{secondary}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="{accent}" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="wave3Grad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="{surface}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="{bg_dim}" stop-opacity="0.9"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="80" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Base background -->
  <rect width="{width}" height="{height}" fill="url(#bgGrad)"/>

  <!-- Subtle glow orb -->
  <circle cx="{width * 0.65}" cy="{height * 0.35}" r="{width * 0.28}" fill="{accent}" opacity="0.12" filter="url(#softGlow)"/>

  <!-- Wave 3 (Deep Surface) -->
  <path d="M 0,{height * 0.65} Q {width * 0.35},{height * 0.4} {width * 0.65},{height * 0.75} T {width},{height * 0.55} L {width},{height} L 0,{height} Z" fill="url(#wave3Grad)"/>

  <!-- Wave 2 (Secondary Accent Sage/Teal) -->
  <path d="M 0,{height * 0.8} Q {width * 0.25},{height * 0.55} {width * 0.55},{height * 0.82} T {width},{height * 0.68} L {width},{height} L 0,{height} Z" fill="url(#wave2Grad)"/>

  <!-- Wave 1 (Primary Accent Green/Forest) -->
  <path d="M 0,{height * 0.9} Q {width * 0.4},{height * 0.72} {width * 0.75},{height * 0.88} T {width},{height * 0.82} L {width},{height} L 0,{height} Z" fill="url(#wave1Grad)"/>
</svg>"""

    return svg


def save_theme_wallpaper(config: dict, theme_name: str, style: str = "abstract_waves", output_dir: str = None) -> str:
    """
    Saves generated SVG wallpaper to output_dir (or ~/.local/share/backgrounds/).
    Returns absolute path of the generated wallpaper file.
    """
    if not output_dir:
        output_dir = DEFAULT_BACKGROUNDS_DIR

    os.makedirs(output_dir, exist_ok=True)
    filename = f"{theme_name}-wallpaper.svg"
    filepath = os.path.join(output_dir, filename)

    svg_content = generate_svg_wallpaper(config, style=style)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(svg_content)

    return filepath
