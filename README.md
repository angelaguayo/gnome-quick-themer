# 🎨 GNOME Quick Themer

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%20--%2051%2B-blue?logo=gnome&style=flat-square)](https://www.gnome.org/)
[![GTK4 & Libadwaita](https://img.shields.io/badge/UI-GTK4%20%2F%20Libadwaita-blueviolet?style=flat-square)](https://gnome.pages.gitlab.gnome.org/libadwaita/)
[![Python 3](https://img.shields.io/badge/Engine-Python%203%20(Zero%20Pip%20Deps)-brightgreen?logo=python&style=flat-square)](https://python.org/)
[![Wayland](https://img.shields.io/badge/Display-Wayland%20%26%20X11-orange?style=flat-square)](https://wayland.freedesktop.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

<p align="center">
  <img src="assets/screenshots/hero-banner.png" alt="GNOME Quick Themer Banner" width="100%">
</p>

> **El entorno de diseño y personalización nativo más rápido, fluido y completo para GNOME Shell y Libadwaita.**  
> Cambia, diseña y aplica temas con armonía matemática en **1 clic** directamente desde la barra superior (*Quick Settings*), o crea tus propias paletas personalizadas con un **Studio visual 100% nativo en Libadwaita (GTK4)**.

---

## 📸 Capturas de Pantalla

| ⚡ Acceso Rápido (Quick Settings) | 🎨 Studio Libadwaita GTK4 (`prefs.js`) |
|:---:|:---:|
| <img src="assets/screenshots/quick-settings.png" alt="Menú Quick Settings" width="100%"> | <img src="assets/screenshots/studio-palette.png" alt="Studio Libadwaita de Paletas" width="100%"> |
| *Muestras de color en vivo y presets favoritos en 1 clic* | *Selectores de color visuales nativos, bordes y layout de botones* |

<p align="center">
  <b>💻 CLI Headless de Terminal Ultrarrápido (Zero Pip Deps)</b><br>
  <img src="assets/screenshots/cli-demo.png" alt="CLI Headless Demo" width="90%">
  <br>
  <i>Gestión, compilación y aplicación instantánea de temas con muestras de color ANSI para scripts y dotfiles</i>
</p>

---

## ⚡ ¿Por qué GNOME Quick Themer?

A diferencia de herramientas que requieren servidores web locales en segundo plano (Flask, Node, navegadores pesados) o configuradores externos desactualizados:

* 🚀 **100% Nativo de GNOME**: Se integra como un menú toggle en el panel superior (*Quick Settings*, junto a Wi-Fi y Volumen) compatible con **GNOME Shell 45, 46, 47, 48, 49, 50 y 51+**.
* 🎨 **Muestras de Color en Vivo (Swatches)**: Cada tema muestra en el menú sus tonos reales de ventana y acento antes de aplicarlo.
* 🛠️ **Libadwaita Studio Integrado (`prefs.js`)**: Ventana de configuración nativa en GTK4 con selector de color interactivo (`Gtk.ColorDialogButton`), sliders de esquinas (`border-radius`), grosor de bordes y selector de disposición de botones (*macOS a la izquierda* o *GNOME a la derecha*).
* ⚡ **Live Hot-Reload sin Reiniciar Sesión**: Aplica temas en caliente en Wayland mediante pulsos seguros de `dconf` sin parpadeos, sin reiniciar sesión y sin perder ventanas abiertas.
* 🖼️ **Fondos de Pantalla 4K Vectoriales Automáticos**: Generador matemático en Python puro que crea y aplica un fondo SVG 4K que combina armónicamente con tu paleta activa.
* 🦊 **Sincronización Total del Ecosistema**: Propaga el estilo a **GTK 4 (Libadwaita)**, **GTK 3**, **GNOME Shell**, **aplicaciones Flatpak aisladas** y perfiles de **Firefox / LibreWolf / Waterfox** (`userChrome.css`).
* 💻 **CLI Ultrarrápido Sin Dependencias**: Incluye `./quick-themer` independiente para usuarios de terminal, dotfiles y automatizaciones headless en r/unixporn.

---

## 📦 Instalación Rápida (1 Clic)

### Dependencias Básicas del Sistema
Solo necesitas `python3` y el compilador SCSS `sassc`:

```bash
# Fedora / RHEL:
sudo dnf install sassc python3

# Arch Linux / Manjaro:
sudo pacman -S sassc python

# Ubuntu / Debian / Pop!_OS:
sudo apt install sassc python3

# openSUSE:
sudo zypper install sassc python3
```

> **Recomendado**: Instala la extensión oficial **User Themes** (`gnome-shell-extension-user-theme`) para permitir que GNOME Shell cambie su propia hoja de estilos en tiempo real.

### Clonar e Instalar
```bash
git clone https://github.com/angelaguayo/gnome-quick-themer.git
cd gnome-quick-themer
./install.sh
```

El script verificará las herramientas, compilará los esquemas de GSettings y registrará la extensión en tu entorno GNOME inmediatamente.

---

## 🕹️ Modos de Uso

### 1. Desde el Panel Superior (Quick Settings)
Haz clic en el botón de **Temas** en la esquina superior derecha de tu pantalla:
* **Favoritos de 1 Clic**: Accede al instante a tus 5 paletas favoritas con sus círculos de color.
* **Catálogo Completo**: Despliega y aplica cualquiera de los 26 presets o tus temas creados.
* **Botones Rápidos**: Abre el *Studio de Personalización* o *Restablece a Adwaita original* directamente desde la cabecera del menú.

---

### 2. Studio de Personalización Nativo (Libadwaita GTK4)
Abre el Studio desde el menú de la extensión o ejecutando en tu terminal:
```bash
gnome-extensions prefs quick-themer@angelaguayo.github.io
```

La ventana de preferencias se organiza en 5 páginas intuitivas:

#### 🌟 1. Catálogo y Favoritos
* Configura cuáles 5 temas ocupan las posiciones preferentes en el panel superior.
* Activa el **Modo Compacto** para mantener el menú desplegable ligero.
* Explora la biblioteca completa: aplica cualquier tema con un clic, ábrelo en el editor o elimina presets personalizados creados por ti.

#### 🎨 2. Studio de Paleta (Creador y Editor)
* **Plantilla Base**: Elige cualquier preset existente como punto de partida para clonar o editar.
* **Modo Claro / Oscuro**: Diseña esquemas con variantes `dark` o `light`.
* **Selectores de Color Intuitivos**:
  * Haz clic en el botón de color para abrir la **rueda de colores nativa de GNOME** con selector visual, deslizadores RGB/HSV y cuentagotas.
  * O introduce/pega directamente códigos hexadecimales (`#RRGGBB`).
  * Personaliza: *Acento principal, texto sobre acento, acento secundario, fondo de ventana, barra lateral (sidebar), barra de título (headerbar), superficie elevada (tarjetas), textos y bordes*.
* **Geometría de Ventanas y Bordes**:
  * **Radio de ventana** (0 a 32 px): esquinas cuadradas estilo retro o ultra redondeadas modernas.
  * **Radio de botones** (0 a 24 px): redondeo de controles interactivos.
  * **Grosor de borde** (0 a 4 px): desde ventanas sin borde hasta contornos marcados.
  * **Disposición de botones** (*Derecha GNOME*, *Izquierda macOS*, *Compacto Derecha* o *Compacto Izquierda*).
  * **Estilo de controles** (*macOS Traffic Lights* con semáforo hover o *Adwaita Estándar* monocromático).
  * **Estilo de fondo SVG** (*Olas abstractas*, *Aurora boreal* o *Geométrico*).
* **Guardar Preset**: Guárdalo en tu biblioteca sin necesidad de aplicarlo de inmediato.
* **Guardar y Aplicar**: Compila en ~300ms y aplícalo a todo tu escritorio en caliente.

#### 📐 3. Métricas Globales
* Ajusta los valores globales de redondeo de ventanas, radio de botones y grosor de bordes.
* Modifica la disposición de botones de ventana del sistema (`button-layout`) en vivo.

#### 🔗 4. Integraciones del Sistema
* **Fondo de Pantalla 4K**: Activa la generación matemática del wallpaper coordinado.
* **Firefox Sync**: Sincroniza automáticamente `userChrome.css` en todos los perfiles de Firefox detectados (nativos XDG, Flatpak y Snap).
* **Flatpak Propagation**: Enlaza los estilos a las aplicaciones aisladas en `~/.var/app/`.
* **Notificaciones**: Muestra confirmaciones toast nativas al cambiar de tema.

#### ℹ️ 5. Acerca de y Restauración
* Información de la versión.
* Enlace oficial al repositorio.
* **Botón de Restauración de Fábrica**: Deja tu entorno GNOME exactamente como venía por defecto.

---

### 3. Modo Terminal / CLI Headless (`./quick-themer`)

Ideal para automatizaciones, scripts de dotfiles o entornos sin interfaz gráfica:

```bash
# Listar las 26 paletas calibradas con muestras de color ANSI en la terminal
./quick-themer list

# Ver detalles completos, colores y métricas de un preset
./quick-themer info "Catppuccin Mocha"

# Aplicar un tema inmediatamente
./quick-themer apply "Everforest Dark"

# Aplicar con parámetros personalizados de geometría al vuelo
./quick-themer apply "Tokyo Night" --window-radius 16 --button-radius 10 --button-layout left

# Aplicar sin generar fondo de pantalla ni tocar Firefox
./quick-themer apply "Nord Dark" --no-wallpaper --no-firefox

# Crear y compilar un tema custom desde la línea de comandos
./quick-themer custom --save --name "Cyber-Neon" --scheme dark \
  --accent "#00ffff" --bg "#10141d" --sidebar "#0a0e14" --headerbar "#070a0e" \
  --window-radius 14 --layout left

# Eliminar un preset personalizado creado por el usuario
./quick-themer delete "Cyber-Neon"

# Consultar el estado activo del escritorio GNOME
./quick-themer status

# Restablecer GNOME a los valores de fábrica
./quick-themer reset
```

---

## 🎨 Catálogo de las 26 Paletas Maestras

GNOME Quick Themer incluye 26 paletas calibradas profesionalmente para garantizar contraste WCAG y elegancia visual:

| Paleta | Modo | Acento Principal | Estética |
|---|:---:|:---:|---|
| **Everforest Dark / Light** | 🌙 / ☀️ | `#a7c080` (Verde bosque) | Tonos naturales, orgánicos y relajantes |
| **Catppuccin Mocha / Latte** | 🌙 / ☀️ | `#cba6f7` (Malva pastel) | La aclamada paleta pastel para desarrolladores |
| **Tokyo Night / Day** | 🌙 / ☀️ | `#7aa2f7` (Azul neón) | Luces nocturnas inspiradas en Shibuya |
| **Nord Dark / Snow Storm** | 🌙 / ☀️ | `#88c0d0` (Azul escandinavo) | Paleta ártica, limpia y minimalista |
| **Gruvbox Dark / Light** | 🌙 / ☀️ | `#fe8019` (Naranja retro) | Tonos cálidos y nostálgicos inspirados en vim |
| **Kanagawa Wave** | 🌙 | `#7e9cd8` (Azul ola) | Tonos tradicionales japoneses de pinturas ukiyo-e |
| **Dracula** | 🌙 | `#bd93f9` (Púrpura gótico) | Oscuridad vibrante con contrastes fluorescentes |
| **Rosé Pine / Dawn** | 🌙 / ☀️ | `#ebbcba` (Rosa empolvado) | Estética sobria, chic y elegante |
| **Solarized Dark / Light** | 🌙 / ☀️ | `#268bd2` (Azul Solarized) | Clásico indiscutible de máxima ergonomía ocular |
| **One Dark Pro / One Light** | 🌙 / ☀️ | `#61afef` (Azul Atom) | El icónico esquema de Atom y VS Code |
| **Monokai Pro** | 🌙 | `#ffd866` (Amarillo oro) | Paleta profesional de alto contraste para editores |
| **Cyberpunk 2077** | 🌙 | `#ffee00` (Amarillo ciber) | Distopía futurista amarilla con fondos de carbón |
| **Adwaita Dark / Light** | 🌙 / ☀️ | `#3584e4` (Azul GNOME) | La experiencia fiel y original de GNOME |

---

## 💾 Gestión de Presets Personalizados

Los presets personalizados se almacenan de forma segura en:
```
~/.config/gnome-quick-themer/custom_presets.json
```

Puedes guardar este archivo en tus **dotfiles**, sincronizarlo entre tus ordenadores o compartirlo con la comunidad. Cada preset contiene todos los colores HEX y parámetros de ventana de manera independiente.

---

## 🏗️ Arquitectura y Principios de Diseño

```
                                 [ Quick Settings Menu (extension.js) ]
                                                   │
                                                   ▼
[ Preferences Studio (prefs.js) ] ────► [ Engine Runner (quick-themer) ]
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                     ▼
             [ SCSS Compiler (sassc) ]                             [ System Installer ]
                        │                                                     │
             ┌──────────┴──────────┐                               ┌──────────┴──────────┐
             ▼                     ▼                               ▼                     ▼
     ~/.themes/<Name>/    ~/.config/gtk-4.0/                 GNOME Shell        Firefox & Flatpak
```

* **Cero desfase en ToolbarView**: Implementación estricta de fondos continuos en la barra superior de Nautilus y apps con sidebar split-view.
* **Compilación SCSS en memoria**: Las plantillas maestras en `base_theme/` son inmutables; el compilador inyecta variables dinámicas en un workspace aislado antes de generar los CSS.
* **Procesamiento asíncrono no bloqueante**: Todas las llamadas a subprocesos usan `Gio.Subprocess` con callbacks asíncronos para garantizar que el compositor Mutter jamás pierda un fotograma.

---

## 🗑️ Desinstalación Limpia

Si alguna vez deseas desinstalar la herramienta y devolver tu entorno GNOME a su configuración original:

```bash
./uninstall.sh
```

El script restaurará el tema GTK de fábrica, fondos del sistema, restablecerá `dconf` y desenlazará la extensión de GNOME Shell.

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas!
* ¿Tienes una paleta calibrada que te gustaría incluir en `presets.json`? Envía un Pull Request.
* ¿Encontraste un problema o tienes una sugerencia? Abre un Issue en GitHub.

---

## 📄 Licencia

Este proyecto está liberado bajo la licencia de código abierto [MIT License](LICENSE).  
Desarrollado con dedicación para la comunidad de **GNOME** y **Linux**.
