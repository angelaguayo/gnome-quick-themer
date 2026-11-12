# 🤖 AGENTS.md — Architecture Contract & Guidelines for GNOME Quick Themer

This document establishes the architecture, invariants, and guidelines for AI coding agents and human developers maintaining **GNOME Quick Themer (`gnome-quick-themer`)**.

---

## 🎯 1. Project Philosophy

**GNOME Quick Themer** follows the **GNOME-Native First** philosophy:
1. **Zero Web Bloat**: No Flask, no local web server, no browser required. The UI is 100% native GNOME Shell & Libadwaita.
2. **Instant Gratification**: 1-click preset switching from the top panel (Quick Settings) with visual color swatches.
3. **Deep Visual Customization**: Full palette editing and metric tweaking via native Libadwaita Preferences (`prefs.js`).
4. **Headless CLI Parity**: The engine runs fast and independently via `./quick-themer` with zero external pip dependencies.

---

## 🏗️ 2. Architectural Overview

```
gnome-quick-themer/
├── extension/                     # GNOME Shell 45–51+ Native Extension (ESM)
│   ├── metadata.json              # Shell versions (45-51+), UUID & schema declaration
│   ├── extension.js               # QuickSettings.QuickMenuToggle + live color swatches
│   ├── prefs.js                   # Adw.PreferencesWindow (Studio Libadwaita GTK4)
│   ├── stylesheet.css             # Swatch dots, scroll max-height & header button styling
│   └── schemas/                   # GSettings XML schema & compiled binaries
│       ├── org.gnome.shell.extensions.quick-themer.gschema.xml
│       └── gschemas.compiled
├── engine/                        # Headless Python 3 Theme Engine (Zero pip deps)
│   ├── compiler.py                # Sassc SCSS compilation & SVG asset recoloring
│   ├── installer.py               # Deployer (GTK4, GTK3, Shell, Firefox, Flatpak, WM)
│   ├── wallpaper_generator.py     # Pure Python 4K SVG algorithmic wallpaper generator
│   ├── presets.py                 # Bundled & ~/.config/gnome-quick-themer/ presets manager
│   └── presets.json               # 26 master calibrated color palettes
├── base_theme/                    # Master SCSS templates & GNOME Shell assets
│   ├── scss/                      # _variables.scss and _metrics.scss templates
│   ├── gtk-4.0/                   # Libadwaita stylesheet template
│   ├── gtk-3.0/                   # GTK 3 compatibility stylesheet template
│   ├── gnome-shell/               # Shell 51 stylesheet & SVG calendar/dock assets
│   └── firefox/                   # userChrome.scss & userContent.scss templates
├── quick-themer                   # Standalone headless executable CLI runner
├── install.sh                     # 1-Click user installer
├── uninstall.sh                   # Clean system restore & uninstaller
├── LICENSE                        # MIT License
└── README.md                      # Comprehensive user & developer guide
```

---

## ⚠️ 3. Critical Theming Invariants (Must Never Be Broken)

### 🛡️ Invariant 1: Libadwaita / Nautilus ToolbarView Zero-Desfase
* Outer container `toolbarview > .top-bar` must have `background-color: @headerbar_bg_color;`.
* Inner headerbars must remain transparent with `background: none !important;` to prevent the 6px vertical gap in Nautilus and Settings.
* Split view sidebars must seamlessly match: `.sidebar-pane toolbarview > .top-bar` with `background-color: @sidebar_bg_color !important;`.

### 🛡️ Invariant 2: Multi-Path Firefox Profile Scanning
* Always scan all known paths in `engine/installer.py`: `~/.mozilla/firefox/`, `~/.config/mozilla/firefox/`, Flatpak `~/.var/app/org.mozilla.firefox/`, and Snap `~/snap/firefox/common/`.
* Always set `toolkit.legacyUserProfileCustomizations.stylesheets = true` in `user.js`.

### 🛡️ Invariant 3: GTK 3 Base Inheritance Switching
* Never hardcode `gtk-contained-dark.css`. Dynamically import `gtk-contained.css` for light schemes and `gtk-contained-dark.css` for dark schemes.

### 🛡️ Invariant 4: Live Hot-Reload Pulse on Wayland
* To trigger instant live CSS reload without logging out, toggle empty string to `/org/gnome/shell/extensions/user-theme/name` for 150ms before writing the actual theme name back.

### 🛡️ Invariant 5: GNOME Shell Non-Blocking Async Execution
* Never call synchronous command execution in `extension.js` or `prefs.js`. Mutter compositor loop must not drop frames.
* Always use `Gio.Subprocess` with `Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE` and await with `communicate_utf8_async`.

---

## 📋 4. GSettings Schema Contract

The extension exposes the following schema under `org.gnome.shell.extensions.quick-themer`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `show-only-favorites` | `b` | `true` | Compact mode: displays top 5 favorite presets in Quick Settings |
| `favorite-preset-1..5` | `s` | Presets | Configured favorite theme names |
| `apply-wallpaper` | `b` | `true` | Automatically generates and applies matching 4K SVG wallpaper |
| `wallpaper-style` | `s` | `'abstract_waves'` | `abstract_waves`, `aurora`, or `geometric` |
| `apply-firefox` | `b` | `true` | Injects matching userChrome.css into Firefox/LibreWolf/Waterfox profiles |
| `apply-flatpak` | `b` | `true` | Propagates compiled GTK 4 stylesheet to `~/.var/app/*/config/gtk-4.0/` |
| `show-notifications` | `b` | `true` | Displays desktop toast notification on theme apply/reset |
| `window-radius` | `i` | `12` | Corner radius for Libadwaita windows and dialogs (0 to 32 px) |
| `button-radius` | `i` | `8` | Corner radius for buttons and interactive controls (0 to 24 px) |
| `border-width` | `i` | `1` | Border width for windows and cards (0 to 4 px) |
| `button-layout` | `s` | `'right'` | Window controls layout: `right`, `left`, `right-compact`, `left-compact` |
| `window-controls-style` | `s` | `'traffic-hover'` | macOS traffic lights with smart hover or standard Adwaita monochrome |

---

## 🎨 5. Preset Configuration Schema

Presets (both bundled in `presets.json` and custom in `~/.config/gnome-quick-themer/custom_presets.json`) follow this structure:

```json
{
  "theme_name": "Studio-Theme-Name",
  "color_scheme": "dark",
  "accent_color": "#a7c080",
  "accent_fg": "#1a201c",
  "accent_secondary": "#83c092",
  "window_bg": "#2d353b",
  "sidebar_bg": "#272e33",
  "surface_elevated": "#343f44",
  "headerbar_bg": "#232a2e",
  "text_primary": "#d3c6aa",
  "text_muted": "#859289",
  "border_color": "#3d484d",
  "border_active": "#475258",
  "window_radius": 12,
  "button_radius": 8,
  "border_width": 1,
  "button_layout": "right",
  "window_controls_style": "traffic-hover",
  "wallpaper_style": "aurora"
}
```

---

## 🧪 6. Verification & Testing

### Python Syntax Validation:
```bash
python3 -m py_compile quick-themer engine/compiler.py engine/installer.py engine/presets.py engine/wallpaper_generator.py
```

### Headless CLI Tests:
```bash
./quick-themer list
./quick-themer status
./quick-themer info "Catppuccin Mocha"
./quick-themer info "Tokyo Night"

# Custom preset create / delete lifecycle:
./quick-themer custom --save --name "Test-Theme" --scheme dark --accent "#ff6600" --bg "#1a1a1a"
./quick-themer info "Test-Theme"
./quick-themer delete "Test-Theme"
```

### Shell Script Syntax Validation:
```bash
bash -n install.sh && bash -n uninstall.sh
```

### GSettings Schema Compilation:
```bash
glib-compile-schemas --strict extension/schemas
```

### Installation Smoke Test:
```bash
./install.sh
```
