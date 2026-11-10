#!/usr/bin/env bash
# ==============================================================================
# GNOME Quick Themer — Extension Installer
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="quick-themer@angelaguayo.github.io"
TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "📦 Instalando extensión GNOME Quick Themer..."

# 1. Compilar schemas de GSettings
echo "⚙️  Compilando schemas de GSettings..."
if command -v glib-compile-schemas &>/dev/null; then
    glib-compile-schemas "${SCRIPT_DIR}/schemas"
    echo "✅ Schemas compilados en ${SCRIPT_DIR}/schemas/gschemas.compiled"
else
    echo "⚠️  Advertencia: glib-compile-schemas no encontrado en PATH."
fi

# 2. Instalar symlink en ~/.local/share/gnome-shell/extensions/
echo "🔗 Creando enlace simbólico hacia las extensiones de GNOME..."
mkdir -p "${HOME}/.local/share/gnome-shell/extensions"

if [ -L "${TARGET_DIR}" ] || [ -d "${TARGET_DIR}" ]; then
    rm -rf "${TARGET_DIR}"
fi

ln -s "${SCRIPT_DIR}" "${TARGET_DIR}"
echo "✅ Enlace creado: ${TARGET_DIR} -> ${SCRIPT_DIR}"

# 3. Habilitar extensión
if command -v gnome-extensions &>/dev/null; then
    echo "🚀 Habilitando extensión en GNOME Shell..."
    gnome-extensions enable "${UUID}" 2>/dev/null || true
    echo "✅ Extensión habilitada."
fi

echo ""
echo "🎉 ¡GNOME Quick Themer instalado correctamente!"
echo "   Puedes ver el nuevo icono en tu barra superior (Quick Settings)."
