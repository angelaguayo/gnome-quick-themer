#!/usr/bin/env bash
# ==============================================================================
# GNOME Quick Themer — Uninstaller
# Removes the extension, compiled themes, and optionally user data.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="quick-themer@angelaguayo.github.io"
EXT_TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
USER_CONFIG_DIR="${HOME}/.config/gnome-quick-themer"

echo "======================================================================"
echo "       🗑️  GNOME Quick Themer — Desinstalador Limpio                   "
echo "======================================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. Reset desktop to Adwaita defaults
# ------------------------------------------------------------------------------
if [ -x "${SCRIPT_DIR}/quick-themer" ]; then
    echo "🔄 Restableciendo escritorio a valores de fábrica (Adwaita)..."
    "${SCRIPT_DIR}/quick-themer" reset 2>/dev/null || true
    echo "✅ Tema restablecido a Adwaita."
fi
echo ""

# ------------------------------------------------------------------------------
# 2. Disable and remove the extension
# ------------------------------------------------------------------------------
echo "🔌 Deshabilitando extensión de GNOME Shell..."
if command -v gnome-extensions &>/dev/null; then
    gnome-extensions disable "${UUID}" 2>/dev/null || true
fi

if [ -L "${EXT_TARGET_DIR}" ] || [ -d "${EXT_TARGET_DIR}" ]; then
    rm -rf "${EXT_TARGET_DIR}"
    echo "✅ Extensión eliminada de ${EXT_TARGET_DIR}"
fi
echo ""

# ------------------------------------------------------------------------------
# 3. Remove compiled themes from ~/.themes and ~/.local/share/themes
# ------------------------------------------------------------------------------
echo "🎨 Eliminando temas compilados..."
for themes_dir in "${HOME}/.themes" "${HOME}/.local/share/themes"; do
    if [ -d "${themes_dir}" ]; then
        # Remove any theme that starts with a known Quick Themer preset name
        while IFS= read -r -d '' theme_dir; do
            theme_name="$(basename "${theme_dir}")"
            echo "   Eliminando tema: ${theme_name}"
            rm -rf "${theme_dir}"
        done < <(find "${themes_dir}" -maxdepth 1 -type d \( \
            -name "Everforest-*" -o \
            -name "Catppuccin-*" -o \
            -name "TokyoNight-*" -o \
            -name "Nord-*" -o \
            -name "Gruvbox-*" -o \
            -name "Kanagawa-*" -o \
            -name "Dracula-*" -o \
            -name "RosePine-*" -o \
            -name "Solarized-*" -o \
            -name "OneDark-*" -o \
            -name "Monokai-*" -o \
            -name "Cyberpunk-*" -o \
            -name "Adwaita-*" \
        \) -print0 2>/dev/null || true)
    fi
done
echo "✅ Temas compilados eliminados."
echo ""

# ------------------------------------------------------------------------------
# 4. Optionally remove user configuration and custom presets
# ------------------------------------------------------------------------------
if [ -d "${USER_CONFIG_DIR}" ]; then
    echo "--------------------------------------------------------------------"
    echo "📁 Se encontró configuración de usuario en:"
    echo "   ${USER_CONFIG_DIR}"
    echo ""
    echo "   Contiene tus presets personalizados y ajustes guardados."
    printf "   ¿Deseas eliminar esta carpeta también? [s/N]: "
    read -r REMOVE_CONFIG
    echo ""
    if [[ "${REMOVE_CONFIG}" =~ ^[sS]$ ]]; then
        rm -rf "${USER_CONFIG_DIR}"
        echo "✅ Configuración de usuario eliminada."
    else
        echo "✅ Configuración de usuario conservada en ${USER_CONFIG_DIR}"
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# 5. Done
# ------------------------------------------------------------------------------
echo "======================================================================"
echo "✅ GNOME Quick Themer ha sido desinstalado correctamente."
echo ""
echo "👉 Reinicia GNOME Shell para completar la desinstalación:"
echo "   • Wayland: Cierra sesión y vuelve a entrar."
echo "   • X11:     Presiona Alt+F2, escribe 'r', Enter."
echo "======================================================================"
