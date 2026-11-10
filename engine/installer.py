"""
GNOME Theme Studio - 1-Click Installer & Live Applier Engine
Deploys theme to user directories, configures Libadwaita, sets wallpapers and triggers live hot-reloads.
"""

import os
import time
import shutil
import subprocess

USER_HOME = os.path.expanduser("~")
USER_THEMES_DIR = os.environ.get("QUICK_THEMER_THEMES_DIR") or os.path.join(USER_HOME, ".themes")
USER_LOCAL_THEMES_DIR = os.environ.get("QUICK_THEMER_LOCAL_THEMES_DIR") or os.path.join(USER_HOME, ".local", "share", "themes")
GTK4_CONFIG_DIR = os.environ.get("QUICK_THEMER_GTK4_DIR") or os.path.join(USER_HOME, ".config", "gtk-4.0")
BACKGROUNDS_DIR = os.environ.get("QUICK_THEMER_BG_DIR") or os.path.join(USER_HOME, ".local", "share", "backgrounds")
USER_THEME_UUID = "user-theme@gnome-shell-extensions.gcampax.github.com"

# Standard GNOME Accent color palette map
GNOME_ACCENTS = {
    "blue": (53, 132, 228),
    "teal": (33, 164, 153),
    "green": (51, 209, 122),
    "yellow": (246, 211, 45),
    "orange": (255, 120, 0),
    "red": (224, 27, 36),
    "pink": (255, 97, 136),
    "purple": (145, 65, 172),
    "slate": (133, 146, 137)
}


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Converts hex to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_closest_gnome_accent(hex_color: str) -> str:
    """Finds the closest official GNOME accent color name for gsettings."""
    try:
        r, g, b = hex_to_rgb(hex_color)
    except Exception:
        return "green"

    closest_name = "green"
    min_dist = float("inf")

    for name, (ar, ag, ab) in GNOME_ACCENTS.items():
        # Weighted Euclidean distance (human perception)
        dist = 0.3 * (r - ar) ** 2 + 0.59 * (g - ag) ** 2 + 0.11 * (b - ab) ** 2
        if dist < min_dist:
            min_dist = dist
            closest_name = name

    return closest_name


def run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    """Runs a system command via subprocess."""
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def get_current_theme_status() -> dict:
    """Returns the current GNOME interface theme configuration."""
    status = {}
    _, gtk_theme, _ = run_cmd(["gsettings", "get", "org.gnome.desktop.interface", "gtk-theme"])
    status["gtk_theme"] = gtk_theme.strip("'\"") if gtk_theme else "Adwaita"

    _, color_scheme, _ = run_cmd(["gsettings", "get", "org.gnome.desktop.interface", "color-scheme"])
    status["color_scheme"] = color_scheme.strip("'\"") if color_scheme else "default"

    _, accent_color, _ = run_cmd(["gsettings", "get", "org.gnome.desktop.interface", "accent-color"])
    status["accent_color"] = accent_color.strip("'\"") if accent_color else "green"

    _, shell_theme, _ = run_cmd(["dconf", "read", "/org/gnome/shell/extensions/user-theme/name"])
    status["shell_theme"] = shell_theme.strip("'\"") if shell_theme else "Default"

    # User theme extension status
    _, ext_info, _ = run_cmd(["gnome-extensions", "info", USER_THEME_UUID])
    status["user_theme_extension"] = "ACTIVE" if "ACTIVE" in ext_info.upper() or "ENABLED" in ext_info.upper() else "INACTIVE"

    # Libadwaita custom config exists
    status["gtk4_config_active"] = os.path.exists(os.path.join(GTK4_CONFIG_DIR, "gtk.css"))

    # Button layout
    _, button_layout, _ = run_cmd(["gsettings", "get", "org.gnome.desktop.wm.preferences", "button-layout"])
    status["button_layout"] = button_layout.strip("'\"") if button_layout else "appmenu:minimize,maximize,close"

    return status


def get_firefox_profile_dirs() -> list[str]:
    """
    Finds all active user profile directories for Firefox, LibreWolf, and Waterfox
    across XDG config (~/.config/mozilla/firefox), legacy ~/.mozilla, Flatpak, and Snap.
    """
    search_roots = [
        os.path.join(USER_HOME, ".config", "mozilla", "firefox"),
        os.path.join(USER_HOME, ".mozilla", "firefox"),
        os.path.join(USER_HOME, ".var", "app", "org.mozilla.firefox", ".mozilla", "firefox"),
        os.path.join(USER_HOME, "snap", "firefox", "common", ".mozilla", "firefox"),
        os.path.join(USER_HOME, ".config", "librewolf"),
        os.path.join(USER_HOME, ".librewolf"),
        os.path.join(USER_HOME, ".var", "app", "io.gitlab.librewolf-community", ".librewolf"),
        os.path.join(USER_HOME, ".config", "waterfox"),
        os.path.join(USER_HOME, ".waterfox"),
    ]

    profiles = []
    for root in search_roots:
        if not os.path.exists(root):
            continue
        pini = os.path.join(root, "profiles.ini")
        if os.path.exists(pini):
            try:
                with open(pini, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.startswith("Path="):
                            p_rel = line.strip().split("=")[1].strip()
                            p_full = os.path.normpath(os.path.join(root, p_rel))
                            if os.path.isdir(p_full) and p_full not in profiles:
                                profiles.append(p_full)
            except Exception:
                pass
        try:
            for entry in os.listdir(root):
                full_path = os.path.join(root, entry)
                if os.path.isdir(full_path):
                    if "default" in entry.lower() or os.path.exists(os.path.join(full_path, "prefs.js")):
                        if full_path not in profiles:
                            profiles.append(full_path)
        except Exception:
            pass

    return profiles


def install_firefox_theme(compiled_dir: str, theme_name: str, logs: list) -> int:
    """
    Deploys userChrome.css and userContent.css and activates toolkit.legacyUserProfileCustomizations.stylesheets
    in all discovered Firefox profiles.
    """
    src_firefox_dir = os.path.join(compiled_dir, "firefox")
    if not os.path.exists(src_firefox_dir):
        src_firefox_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firefox")
        if not os.path.exists(src_firefox_dir):
            return 0

    src_chrome = os.path.join(src_firefox_dir, "userChrome.css")
    src_content = os.path.join(src_firefox_dir, "userContent.css")
    if not os.path.exists(src_chrome):
        return 0

    profiles = get_firefox_profile_dirs()
    if not profiles:
        logs.append("No se detectaron perfiles activos de Firefox para tematizar.")
        return 0

    updated_count = 0
    required_prefs = [
        'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);',
        'user_pref("browser.tabs.drawInTitlebar", true);',
        'user_pref("browser.theme.toolbar-theme", 0);',
        'user_pref("browser.theme.content-theme", 0);',
        'user_pref("svg.context-properties.content.enabled", true);'
    ]

    for prof in profiles:
        chrome_dir = os.path.join(prof, "chrome")
        os.makedirs(chrome_dir, exist_ok=True)

        shutil.copy(src_chrome, os.path.join(chrome_dir, "userChrome.css"))
        if os.path.exists(src_content):
            shutil.copy(src_content, os.path.join(chrome_dir, "userContent.css"))

        user_js_path = os.path.join(prof, "user.js")
        existing_lines = []
        if os.path.exists(user_js_path):
            try:
                with open(user_js_path, "r", encoding="utf-8", errors="ignore") as f:
                    existing_lines = f.readlines()
            except Exception:
                existing_lines = []

        existing_text = "".join(existing_lines)
        added_lines = []
        for pref in required_prefs:
            pref_key = pref.split(",")[0]
            if pref_key not in existing_text:
                added_lines.append(pref + "\n")

        if added_lines:
            with open(user_js_path, "a", encoding="utf-8") as f:
                if existing_text and not existing_text.endswith("\n"):
                    f.write("\n")
                f.write("// Applied by GNOME Theme Studio\n")
                f.writelines(added_lines)

        updated_count += 1
        prof_name = os.path.basename(prof)
        logs.append(f"Tematizado Firefox con éxito en: .../{prof_name}/chrome/")

    return updated_count


def reset_firefox_theme(logs: list) -> int:
    """Removes custom chrome stylesheets from Firefox profiles."""
    profiles = get_firefox_profile_dirs()
    cleaned = 0
    for prof in profiles:
        chrome_dir = os.path.join(prof, "chrome")
        if os.path.exists(chrome_dir):
            try:
                shutil.rmtree(chrome_dir)
                cleaned += 1
            except Exception:
                pass
    if cleaned > 0:
        logs.append(f"Eliminados estilos custom de Firefox en {cleaned} perfiles.")
    return cleaned


def install_and_apply_theme(
    theme_name: str = "",
    compiled_dir: str = "",
    config: dict = None,
    apply_gtk4: bool = True,
    apply_wallpaper: bool = True,
    apply_firefox: bool = True,
    apply_flatpak: bool = True,
    **kwargs
) -> dict:
    """
    Installs compiled theme to user directories, configures Libadwaita, wallpaper, and triggers live GNOME reload.
    """
    if config is None:
        config = {}
    else:
        config = dict(config)

    for k, v in kwargs.items():
        if k not in config or v is not None:
            config[k] = v

    if not theme_name and "theme_name" in config:
        theme_name = config["theme_name"]
    if not compiled_dir and "compiled_dir" in config:
        compiled_dir = config["compiled_dir"]

    logs = []
    logs.append(f"Installing theme '{theme_name}' from {compiled_dir}")

    try:
        # 1. Target theme directories
        dst_themes = os.path.join(USER_THEMES_DIR, theme_name)
        dst_local_themes = os.path.join(USER_LOCAL_THEMES_DIR, theme_name)

        os.makedirs(USER_THEMES_DIR, exist_ok=True)
        os.makedirs(USER_LOCAL_THEMES_DIR, exist_ok=True)

        # Clean old versions
        if os.path.exists(dst_themes):
            shutil.rmtree(dst_themes)
        if os.path.exists(dst_local_themes) and os.path.abspath(dst_themes) != os.path.abspath(dst_local_themes):
            shutil.rmtree(dst_local_themes)

        shutil.copytree(compiled_dir, dst_themes)
        if os.path.abspath(dst_themes) != os.path.abspath(dst_local_themes):
            shutil.copytree(compiled_dir, dst_local_themes)
        logs.append(f"Copied theme to ~/.themes/{theme_name} and ~/.local/share/themes/{theme_name}")

        # 2. Configure GTK4 / Libadwaita if requested
        if apply_gtk4:
            os.makedirs(GTK4_CONFIG_DIR, exist_ok=True)
            gtk4_css = os.path.join(GTK4_CONFIG_DIR, "gtk.css")
            gtk4_bak = os.path.join(GTK4_CONFIG_DIR, "gtk.css.bak")

            # Backup if exists and not already backed up
            if os.path.exists(gtk4_css) and not os.path.islink(gtk4_css):
                if not os.path.exists(gtk4_bak):
                    shutil.copy(gtk4_css, gtk4_bak)
                    logs.append("Created backup ~/.config/gtk-4.0/gtk.css.bak")

            shutil.copy(os.path.join(compiled_dir, "gtk-4.0", "gtk.css"), gtk4_css)
            shutil.copy(os.path.join(compiled_dir, "gtk-4.0", "gtk-dark.css"), os.path.join(GTK4_CONFIG_DIR, "gtk-dark.css"))
            logs.append("Applied compiled GTK 4 / Libadwaita styling to ~/.config/gtk-4.0/")

            # Propagate to Flatpak apps if requested and ~/.var/app exists
            if apply_flatpak:
                flatpak_var = os.path.join(USER_HOME, ".var", "app")
                if os.path.exists(flatpak_var):
                    flatpak_count = 0
                    for app_entry in os.listdir(flatpak_var):
                        app_config_dir = os.path.join(flatpak_var, app_entry, "config", "gtk-4.0")
                        if os.path.exists(os.path.dirname(app_config_dir)):
                            os.makedirs(app_config_dir, exist_ok=True)
                            shutil.copy(gtk4_css, os.path.join(app_config_dir, "gtk.css"))
                            flatpak_count += 1
                    if flatpak_count > 0:
                        logs.append(f"Propagated GTK4 theme to {flatpak_count} Flatpak sandboxed applications.")

        # 2.5. Configure Firefox if requested
        if apply_firefox:
            ff_count = install_firefox_theme(compiled_dir, theme_name, logs)
            if ff_count > 0:
                logs.append(f"Sincronizados estilos e integración en {ff_count} perfil(es) de Mozilla Firefox.")

        # 3. Apply Matching Wallpaper if requested
        if apply_wallpaper:
            wp_filename = f"{theme_name}-wallpaper.svg"
            src_wp = os.path.join(compiled_dir, wp_filename)
            if os.path.exists(src_wp):
                os.makedirs(BACKGROUNDS_DIR, exist_ok=True)
                dst_wp = os.path.join(BACKGROUNDS_DIR, wp_filename)
                shutil.copy(src_wp, dst_wp)
                file_uri = f"file://{dst_wp}"
                run_cmd(["gsettings", "set", "org.gnome.desktop.background", "picture-uri", file_uri])
                run_cmd(["gsettings", "set", "org.gnome.desktop.background", "picture-uri-dark", file_uri])
                run_cmd(["gsettings", "set", "org.gnome.desktop.background", "picture-options", "zoom"])
                logs.append(f"Applied matching desktop wallpaper ({wp_filename}) via gsettings.")

        # 4. Window Controls Layout (macOS left vs GNOME right vs compact)
        button_layout = config.get("button_layout", "right")
        if button_layout in ("left", "macos"):
            run_cmd(["gsettings", "set", "org.gnome.desktop.wm.preferences", "button-layout", "close,minimize,maximize:"])
            logs.append("Set window controls layout to Left (macOS style).")
        elif button_layout in ("left-compact", "left_compact"):
            run_cmd(["gsettings", "set", "org.gnome.desktop.wm.preferences", "button-layout", "close:"])
            logs.append("Set window controls layout to Left Compact (Close only).")
        elif button_layout in ("right-compact", "right_compact"):
            run_cmd(["gsettings", "set", "org.gnome.desktop.wm.preferences", "button-layout", "appmenu:close"])
            logs.append("Set window controls layout to Right Compact (Close only).")
        elif ":" in str(button_layout):
            run_cmd(["gsettings", "set", "org.gnome.desktop.wm.preferences", "button-layout", str(button_layout)])
            logs.append(f"Set custom window controls layout to '{button_layout}'.")
        else:
            run_cmd(["gsettings", "set", "org.gnome.desktop.wm.preferences", "button-layout", "appmenu:minimize,maximize,close"])
            logs.append("Set window controls layout to Right (GNOME default).")

        # 5. Enable user-theme extension
        run_cmd(["gnome-extensions", "enable", USER_THEME_UUID])
        logs.append("Enabled user-theme GNOME Shell extension.")

        # 6. Apply Desktop Accent Color & Color Scheme
        accent_hex = config.get("accent_color", "#a7c080")
        closest_accent = get_closest_gnome_accent(accent_hex)
        run_cmd(["gsettings", "set", "org.gnome.desktop.interface", "accent-color", closest_accent])
        logs.append(f"Synchronized GNOME system accent-color to '{closest_accent}'.")

        color_scheme = config.get("color_scheme", "dark")
        scheme_val = "prefer-light" if color_scheme == "light" else "prefer-dark"
        run_cmd(["gsettings", "set", "org.gnome.desktop.interface", "color-scheme", scheme_val])
        logs.append(f"Set color-scheme: '{scheme_val}'.")

        # 7. Hot-reload trick for GTK
        _, current_gtk, _ = run_cmd(["gsettings", "get", "org.gnome.desktop.interface", "gtk-theme"])
        current_gtk = current_gtk.strip("'\"")

        if current_gtk == theme_name:
            logs.append("Theme already active; triggering instant hot-reload toggle...")
            run_cmd(["gsettings", "set", "org.gnome.desktop.interface", "gtk-theme", "Adwaita"])
            time.sleep(0.1)

        run_cmd(["gsettings", "set", "org.gnome.desktop.interface", "gtk-theme", theme_name])
        logs.append(f"Applied GTK theme: '{theme_name}'.")

        # 8. GNOME Shell Live Reload trick via dconf & gsettings
        run_cmd(["dconf", "write", "/org/gnome/shell/extensions/user-theme/name", "''"])
        time.sleep(0.15)
        run_cmd(["dconf", "write", "/org/gnome/shell/extensions/user-theme/name", f"'{theme_name}'"])
        run_cmd(["gsettings", "set", "org.gnome.shell.extensions.user-theme", "name", theme_name])
        logs.append(f"Applied GNOME Shell theme: '{theme_name}' with hot-reload pulse.")

        return {
            "success": True,
            "theme_name": theme_name,
            "logs": logs
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "theme_name": theme_name,
            "logs": logs
        }


def reset_gnome_defaults() -> dict:
    """
    Restores GNOME Desktop, Shell, Libadwaita, and Wallpapers to factory out-of-the-box defaults.
    """
    logs = []
    logs.append("Iniciando restauración de fábrica para GNOME Desktop...")

    # 1. Reset GTK Theme to Adwaita default
    run_cmd(["gsettings", "reset", "org.gnome.desktop.interface", "gtk-theme"])
    logs.append("GTK Theme restablecido a default ('Adwaita').")

    # 2. Reset Color Scheme to default
    run_cmd(["gsettings", "reset", "org.gnome.desktop.interface", "color-scheme"])
    logs.append("Color-scheme restablecido a default.")

    # 3. Reset Accent Color to blue default
    run_cmd(["gsettings", "reset", "org.gnome.desktop.interface", "accent-color"])
    logs.append("Accent-color restablecido a 'blue'.")

    # 4. Reset Button Layout
    run_cmd(["gsettings", "reset", "org.gnome.desktop.wm.preferences", "button-layout"])
    logs.append("Disposición de controles de ventana (button-layout) restablecida.")

    # 5. Reset GNOME Shell Theme
    run_cmd(["dconf", "reset", "/org/gnome/shell/extensions/user-theme/name"])
    run_cmd(["dconf", "write", "/org/gnome/shell/extensions/user-theme/name", "''"])
    run_cmd(["gsettings", "reset", "org.gnome.shell.extensions.user-theme", "name"])
    logs.append("Tema de GNOME Shell restablecido a la apariencia predeterminada del sistema.")

    # 6. Reset Wallpapers
    run_cmd(["gsettings", "reset", "org.gnome.desktop.background", "picture-uri"])
    run_cmd(["gsettings", "reset", "org.gnome.desktop.background", "picture-uri-dark"])
    run_cmd(["gsettings", "reset", "org.gnome.desktop.background", "picture-options"])
    run_cmd(["gsettings", "reset", "org.gnome.desktop.background", "primary-color"])
    run_cmd(["gsettings", "reset", "org.gnome.desktop.background", "secondary-color"])
    logs.append("Fondos de pantalla (claro y oscuro) restablecidos a los originales del sistema.")

    # 7. Clean up Libadwaita / GTK4 custom CSS overrides
    gtk4_css = os.path.join(GTK4_CONFIG_DIR, "gtk.css")
    gtk4_dark_css = os.path.join(GTK4_CONFIG_DIR, "gtk-dark.css")
    backup_dir = os.path.join(GTK4_CONFIG_DIR, "studio_backups")

    if os.path.exists(gtk4_css) or os.path.exists(gtk4_dark_css):
        os.makedirs(backup_dir, exist_ok=True)
        ts = int(time.time())
        if os.path.exists(gtk4_css):
            shutil.move(gtk4_css, os.path.join(backup_dir, f"gtk_{ts}.css.bak"))
            logs.append(f"Overrides de Libadwaita (~/.config/gtk-4.0/gtk.css) respaldados en studio_backups y removidos.")
        if os.path.exists(gtk4_dark_css):
            shutil.move(gtk4_dark_css, os.path.join(backup_dir, f"gtk-dark_{ts}.css.bak"))
            logs.append(f"Overrides de Libadwaita (~/.config/gtk-4.0/gtk-dark.css) removidos.")

    # Clean up Flatpak overrides if present
    flatpak_var = os.path.join(USER_HOME, ".var", "app")
    if os.path.exists(flatpak_var):
        flatpak_cleaned = 0
        for app_entry in os.listdir(flatpak_var):
            fp_gtk4 = os.path.join(flatpak_var, app_entry, "config", "gtk-4.0", "gtk.css")
            if os.path.exists(fp_gtk4):
                try:
                    os.remove(fp_gtk4)
                    flatpak_cleaned += 1
                except Exception:
                    pass
        if flatpak_cleaned > 0:
            logs.append(f"Removidos overrides de GTK4 en {flatpak_cleaned} aplicaciones Flatpak.")

    # 7.5. Clean up Firefox custom chrome stylesheets
    reset_firefox_theme(logs)

    # 8. Trigger live hot-reload pulse
    run_cmd(["gsettings", "set", "org.gnome.desktop.interface", "gtk-theme", "HighContrast"])
    time.sleep(0.1)
    run_cmd(["gsettings", "reset", "org.gnome.desktop.interface", "gtk-theme"])
    logs.append("Pulso de recarga en caliente ejecutado con éxito.")

    # Fetch new active status
    status = get_current_theme_status()

    return {
        "success": True,
        "message": "GNOME ha sido restablecido a su configuración de fábrica.",
        "status": status,
        "logs": logs
    }

