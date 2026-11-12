#!/usr/bin/env bash
# ==============================================================================
# GNOME Quick Themer — 1-Click Master Installer
# Compatible with: Fedora 39+, Ubuntu 24.04+, Arch, Manjaro, openSUSE,
#                  EndeavourOS, Vanilla OS, and any GNOME Shell 45-51+ distro.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="quick-themer@angelaguayo.github.io"
EXT_TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
MIN_GNOME_MAJOR=45

# ------------------------------------------------------------------------------
# Help / usage
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: ./install.sh [--help]"
    echo ""
    echo "Installs GNOME Quick Themer for the current user."
    echo "Requires: python3 >= 3.9, sassc, glib-compile-schemas"
    echo "Optional: gnome-shell-extension-user-theme (for Shell stylesheet theming)"
    exit 0
fi

echo "======================================================================"
echo "       🎨 GNOME Quick Themer — Instalador Rápido de 1 Clic           "
echo "======================================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. GNOME Shell version check
# ------------------------------------------------------------------------------
echo "🔍 Verificando versión de GNOME Shell..."
if command -v gnome-shell &>/dev/null; then
    GNOME_VERSION="$(gnome-shell --version | grep -oP '\d+' | head -1)"
    echo "   GNOME Shell detectado: ${GNOME_VERSION}"
    if [[ "${GNOME_VERSION}" -lt "${MIN_GNOME_MAJOR}" ]]; then
        echo "⚠️  Advertencia: GNOME Shell ${GNOME_VERSION} detectado."
        echo "   GNOME Quick Themer requiere GNOME Shell ${MIN_GNOME_MAJOR} o superior."
        echo "   Puede que algunas funciones no estén disponibles."
        echo ""
    fi
else
    echo "⚠️  No se detectó gnome-shell en el PATH. Continuando de todas formas..."
fi

# ------------------------------------------------------------------------------
# 2. Dependency checks
# ------------------------------------------------------------------------------
echo "🔍 Comprobando dependencias del sistema..."
MISSING_DEPS=()

if ! command -v python3 &>/dev/null; then
    MISSING_DEPS+=("python3")
fi

if ! command -v sassc &>/dev/null; then
    MISSING_DEPS+=("sassc")
fi

if ! command -v glib-compile-schemas &>/dev/null; then
    MISSING_DEPS+=("glib-compile-schemas (paquete: glib2-devel / libglib2.0-dev)")
fi

if [[ "${#MISSING_DEPS[@]}" -gt 0 ]]; then
    echo ""
    echo "❌ Faltan dependencias obligatorias:"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "   • ${dep}"
    done
    echo ""
    echo "   Instálalas con tu gestor de paquetes:"
    echo ""
    echo "   # Fedora / RHEL / CentOS Stream:"
    echo "   sudo dnf install python3 sassc glib2-devel"
    echo ""
    echo "   # Ubuntu / Debian / Pop!_OS / Linux Mint:"
    echo "   sudo apt install python3 sassc libglib2.0-dev-bin"
    echo ""
    echo "   # Arch Linux / Manjaro / EndeavourOS:"
    echo "   sudo pacman -S python sassc glib2"
    echo ""
    echo "   # openSUSE Tumbleweed / Leap:"
    echo "   sudo zypper install python3 sassc glib2-devel"
    echo ""
    exit 1
fi

echo "✅ python3, sassc y glib-compile-schemas detectados correctamente."
echo ""

# Check Python version >= 3.9
PYTHON_VERSION="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PYTHON_MAJOR="$(python3 -c 'import sys; print(sys.version_info.major)')"
PYTHON_MINOR="$(python3 -c 'import sys; print(sys.version_info.minor)')"
if [[ "${PYTHON_MAJOR}" -lt 3 || ("${PYTHON_MAJOR}" -eq 3 && "${PYTHON_MINOR}" -lt 9) ]]; then
    echo "❌ Se requiere Python 3.9 o superior. Versión detectada: ${PYTHON_VERSION}"
    exit 1
fi
echo "   Python ${PYTHON_VERSION} ✅"

# Optional: User Themes extension
if command -v gnome-extensions &>/dev/null; then
    if ! gnome-extensions list 2>/dev/null | grep -q "user-theme@gnome-shell-extensions.gcampax.github.com"; then
        echo ""
        echo "💡 Recomendado: Instala la extensión 'User Themes' de GNOME para habilitar"
        echo "   el cambio en vivo del tema de GNOME Shell."
        echo "   • Fedora:  sudo dnf install gnome-shell-extension-user-theme"
        echo "   • Ubuntu:  sudo apt install gnome-shell-extension-prefs"
        echo "   • Arch:    sudo pacman -S gnome-shell-extensions"
        echo "   • O desde: https://extensions.gnome.org/extension/19/user-themes/"
    fi
fi
echo ""

# ------------------------------------------------------------------------------
# 3. Compile GSettings schemas
# ------------------------------------------------------------------------------
echo "⚙️  Compilando esquemas de GSettings para la extensión..."
glib-compile-schemas "${SCRIPT_DIR}/extension/schemas"
echo "✅ Schemas compilados con éxito."
echo ""

# ------------------------------------------------------------------------------
# 4. Register extension with GNOME Shell (symlink)
# ------------------------------------------------------------------------------
echo "🔗 Registrando extensión en GNOME Shell..."
mkdir -p "${HOME}/.local/share/gnome-shell/extensions"
rm -rf "${EXT_TARGET_DIR}"
ln -s "${SCRIPT_DIR}/extension" "${EXT_TARGET_DIR}"
echo "✅ Extensión enlazada en ${EXT_TARGET_DIR}"
echo ""

# ------------------------------------------------------------------------------
# 5. Enable extensions (User Themes + Quick Themer)
# ------------------------------------------------------------------------------
if command -v gnome-extensions &>/dev/null; then
    gnome-extensions enable "user-theme@gnome-shell-extensions.gcampax.github.com" 2>/dev/null || true
    gnome-extensions enable "${UUID}" 2>/dev/null || true
    echo "✅ Extensión ${UUID} habilitada."
fi

# ------------------------------------------------------------------------------
# 6. Ensure executable permissions
# ------------------------------------------------------------------------------
chmod +x "${SCRIPT_DIR}/quick-themer"
echo "✅ Permisos ejecutables asignados a ./quick-themer"
echo ""

# ------------------------------------------------------------------------------
# 7. Done — post-install instructions
# ------------------------------------------------------------------------------
echo "======================================================================"
echo "🎉 ¡GNOME Quick Themer instalado con éxito!"
echo "======================================================================"
echo ""
echo "👉 PASO IMPORTANTE — Reinicia GNOME Shell para activar la extensión:"
echo ""
echo "   • En Wayland (sesión estándar actual):  Cierra sesión y vuelve a entrar."
echo "   • En X11 (sesión Xorg clásica):         Presiona Alt+F2, escribe 'r', Enter."
echo ""
echo "👉 ¿Cómo usarlo después de reiniciar?"
echo ""
echo "   1. Mira en la esquina superior derecha de tu pantalla (Quick Settings)."
echo "      Verás el panel 'Temas' para cambiar paletas con 1 clic y muestras de color."
echo ""
echo "   2. Abre el Studio Visual nativo desde el ícono de engranaje del panel"
echo "      o ejecutando:"
echo "         gnome-extensions prefs ${UUID}"
echo ""
echo "   3. CLI de terminal ultrarrápido (sin dependencias pip):"
echo "         ./quick-themer list"
echo "         ./quick-themer apply 'Catppuccin Mocha'"
echo "         ./quick-themer info 'Tokyo Night'"
echo ""
echo "======================================================================"
