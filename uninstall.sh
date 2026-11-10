#!/usr/bin/env bash
# ==============================================================================
# GNOME Quick Themer — Uninstaller
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="quick-themer@angelaguayo.github.io"
EXT_TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "🔄 Desinstalando GNOME Quick Themer..."

# 1. Restablecer entorno a Adwaita
if [ -x "${SCRIPT_DIR}/quick-themer" ]; then
    echo "Restableciendo escritorio a valores de fábrica..."
    "${SCRIPT_DIR}/quick-themer" reset || true
fi

# 2. Deshabilitar y eliminar extensión
if command -v gnome-extensions &>/dev/null; then
    gnome-extensions disable "${UUID}" 2>/dev/null || true
fi

if [ -L "${EXT_TARGET_DIR}" ] || [ -d "${EXT_TARGET_DIR}" ]; then
    rm -rf "${EXT_TARGET_DIR}"
    echo "✅ Extensión eliminada de ${EXT_TARGET_DIR}"
fi

echo "✅ GNOME Quick Themer ha sido desinstalado correctamente."
