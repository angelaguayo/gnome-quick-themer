#!/usr/bin/env bash
# ==============================================================================
# GNOME Quick Themer — 1-Click Master Installer
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="quick-themer@angelaguayo.github.io"
EXT_TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "======================================================================"
echo "         🎨 GNOME Quick Themer — Instalador Rápido de 1 Clic          "
echo "======================================================================"

# 1. Comprobación de dependencias básicas
echo "🔍 Comprobando dependencias del sistema..."

if ! command -v python3 &>/dev/null; then
    echo "❌ Error: Python 3 no está instalado." >&2
    exit 1
fi

if ! command -v sassc &>/dev/null; then
    echo "⚠️  'sassc' no está instalado en el sistema."
    echo "   Por favor instálalo con tu gestor de paquetes:"
    echo "     • Fedora:   sudo dnf install sassc"
    echo "     • Ubuntu:   sudo apt install sassc"
    echo "     • Arch:     sudo pacman -S sassc"
    echo "======================================================================"
    exit 1
fi

echo "✅ python3 y sassc detectados correctamente."

# 2. Compilar schemas de GSettings
echo "⚙️  Compilando esquemas de GSettings para la extensión..."
if command -v glib-compile-schemas &>/dev/null; then
    glib-compile-schemas "${SCRIPT_DIR}/extension/schemas"
    echo "✅ Schemas compilados con éxito."
fi

# 3. Enlazar la extensión a GNOME Shell
echo "🔗 Registrando extensión en GNOME Shell..."
mkdir -p "${HOME}/.local/share/gnome-shell/extensions"
rm -rf "${EXT_TARGET_DIR}"
ln -s "${SCRIPT_DIR}/extension" "${EXT_TARGET_DIR}"
echo "✅ Extensión enlazada en ${EXT_TARGET_DIR}"

# 4. Habilitar extensión User Themes (si existe)
if command -v gnome-extensions &>/dev/null; then
    gnome-extensions enable "user-theme@gnome-shell-extensions.gcampax.github.com" 2>/dev/null || true
    gnome-extensions enable "${UUID}" 2>/dev/null || true
    echo "✅ Extensión ${UUID} habilitada en GNOME Shell."
fi

# 5. Asegurar permisos ejecutables en el CLI
chmod +x "${SCRIPT_DIR}/quick-themer"
chmod +x "${SCRIPT_DIR}/extension/install.sh"

echo ""
echo "======================================================================"
echo "🎉 ¡GNOME Quick Themer instalado con éxito!"
echo "======================================================================"
echo "👉 ¿Cómo usarlo?"
echo "   1. Mira en la esquina superior derecha de tu pantalla (Quick Settings)."
echo "      Verás el botón 'Quick Themer' para cambiar temas con 1 clic."
echo "   2. Abre el Studio Visual nativo desde el botón 'Studio de Personalización...'"
echo "      o ejecutando: gnome-extensions prefs ${UUID}"
echo "   3. También tienes el CLI de terminal ultrarrápido:"
echo "      ./quick-themer list"
echo "      ./quick-themer apply 'Catppuccin Mocha'"
echo "======================================================================"
