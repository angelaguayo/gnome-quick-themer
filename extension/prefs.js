/**
 * GNOME Quick Themer — Libadwaita Preferences Studio (prefs.js)
 * Compatible with GNOME Shell 45–51+ (ESM architecture)
 *
 * Full-featured Libadwaita Desktop Studio:
 * - Catálogo completo de temas con previsualización, favoritos y filtros
 * - Creador y Editor visual de Presets con selectores de color nativos (Gtk.ColorDialogButton)
 * - Control de parámetros de bordes, esquinas y disposición de botones (Izquierda/Derecha)
 * - Métricas del sistema en tiempo real y hot-reload
 * - Integraciones de Ecosistema: Fondos 4K SVG, Firefox, Flatpaks
 * - Diagnóstico del sistema y restauración de fábrica
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class QuickThemerPreferences extends ExtensionPreferences {
    /**
     * Resolves the project root directory.
     */
    _findProjectDir() {
        const envDir = GLib.getenv('GNOME_QUICK_THEMER_DIR');
        if (envDir && GLib.file_test(envDir, GLib.FileTest.IS_DIR)) {
            return envDir;
        }

        const extPath = this.path;
        if (extPath) {
            const parentDir = GLib.path_get_dirname(extPath);
            const parentCli = GLib.build_filenamev([parentDir, 'quick-themer']);
            if (GLib.file_test(parentCli, GLib.FileTest.EXISTS)) {
                return parentDir;
            }

            try {
                const file = Gio.File.new_for_path(extPath);
                const info = file.query_info('standard::symlink-target', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                const target = info.get_symlink_target();
                if (target) {
                    const resolvedParent = GLib.path_get_dirname(target);
                    const targetCli = GLib.build_filenamev([resolvedParent, 'quick-themer']);
                    if (GLib.file_test(targetCli, GLib.FileTest.EXISTS)) {
                        return resolvedParent;
                    }
                }
            } catch (_) {}
        }

        const homeDir = GLib.get_home_dir();
        const candidateHome = GLib.build_filenamev([homeDir, 'gnome-quick-themer']);
        if (GLib.file_test(GLib.build_filenamev([candidateHome, 'quick-themer']), GLib.FileTest.EXISTS)) {
            return candidateHome;
        }

        return '/home/angelaguayo/gnome-quick-themer';
    }

    /**
     * Loads bundled presets.
     */
    _loadBundledPresets() {
        const projectDir = this._findProjectDir();
        const bundledPath = GLib.build_filenamev([projectDir, 'presets.json']);
        try {
            const [ok, contents] = GLib.file_get_contents(bundledPath);
            if (ok) {
                return JSON.parse(new TextDecoder().decode(contents));
            }
        } catch (e) {
            console.warn(`[QuickThemerPrefs] Error reading bundled presets: ${e.message}`);
        }
        return {};
    }

    /**
     * Loads user custom presets from ~/.config/gnome-quick-themer/custom_presets.json
     */
    _loadUserPresets() {
        const userCustomPath = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-quick-themer', 'custom_presets.json']);
        try {
            if (GLib.file_test(userCustomPath, GLib.FileTest.EXISTS)) {
                const [ok, contents] = GLib.file_get_contents(userCustomPath);
                if (ok) {
                    return JSON.parse(new TextDecoder().decode(contents));
                }
            }
        } catch (e) {
            console.warn(`[QuickThemerPrefs] Error reading user presets: ${e.message}`);
        }
        return {};
    }

    /**
     * Saves user presets map to ~/.config/gnome-quick-themer/custom_presets.json
     */
    _saveUserPresets(userPresets) {
        const configDir = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-quick-themer']);
        GLib.mkdir_with_parents(configDir, 0o755);
        const userCustomPath = GLib.build_filenamev([configDir, 'custom_presets.json']);
        const data = JSON.stringify(userPresets, null, 2);
        GLib.file_set_contents(userCustomPath, new TextEncoder().encode(data));
    }

    /**
     * Deletes a user preset by name.
     */
    _deleteUserPreset(name) {
        const userPresets = this._loadUserPresets();
        if (userPresets[name]) {
            delete userPresets[name];
            this._saveUserPresets(userPresets);
            return true;
        }
        return false;
    }

    /**
     * Loads all presets (bundled + user custom).
     */
    _loadPresets() {
        const presets = this._loadBundledPresets();
        const userPresets = this._loadUserPresets();
        Object.assign(presets, userPresets);
        return presets;
    }

    /**
     * Executes quick-themer asynchronously without blocking the UI.
     */
    _executeQuickThemer(args, onDone) {
        const projectDir = this._findProjectDir();
        const cliPath = GLib.build_filenamev([projectDir, 'quick-themer']);
        const fullArgs = ['python3', cliPath, ...args];

        try {
            const proc = new Gio.Subprocess({
                argv: fullArgs,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (source, res) => {
                try {
                    const [ok, stdout, stderr] = source.communicate_utf8_finish(res);
                    const exitCode = source.get_exit_status();
                    if (onDone) {
                        onDone(exitCode === 0, stdout, stderr);
                    }
                } catch (err) {
                    if (onDone) onDone(false, '', err.message);
                }
            });
        } catch (err) {
            if (onDone) onDone(false, '', err.message);
        }
    }

    /**
     * Helper to create an intuitive color row with direct Hex entry and a native Gtk.ColorDialogButton.
     */
    _createColorRow(title, subtitle, initialHex, onChange) {
        const row = new Adw.ActionRow({
            title: title,
            subtitle: subtitle || initialHex,
        });

        const entry = new Gtk.Entry({
            text: initialHex,
            max_length: 7,
            width_chars: 9,
            valign: Gtk.Align.CENTER,
            css_classes: ['monospace'],
            placeholder_text: '#000000',
        });

        // Use modern Gtk.ColorDialogButton with fallback to Gtk.ColorButton
        let colorBtn;
        let isModern = (typeof Gtk.ColorDialogButton !== 'undefined');

        if (isModern) {
            const dialog = new Gtk.ColorDialog({
                title: title,
                with_alpha: false,
            });
            colorBtn = new Gtk.ColorDialogButton({
                dialog: dialog,
                valign: Gtk.Align.CENTER,
            });
        } else {
            colorBtn = new Gtk.ColorButton({
                valign: Gtk.Align.CENTER,
                use_alpha: false,
            });
        }

        const rgba = new Gdk.RGBA();
        rgba.parse(initialHex);
        colorBtn.set_rgba(rgba);

        let updating = false;

        const rgbaToHex = (r, g, b) => {
            const toHex = (c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        const notifyChange = (hex) => {
            row.set_subtitle(hex);
            if (onChange) onChange(hex);
        };

        const onColorPicked = () => {
            if (updating) return;
            updating = true;
            try {
                const c = colorBtn.get_rgba();
                const hex = rgbaToHex(c.red, c.green, c.blue);
                entry.set_text(hex);
                notifyChange(hex);
            } finally {
                updating = false;
            }
        };

        if (isModern) {
            colorBtn.connect('notify::rgba', onColorPicked);
        } else {
            colorBtn.connect('color-set', onColorPicked);
        }

        entry.connect('changed', () => {
            if (updating) return;
            const text = entry.get_text().trim();
            if (/^#[0-9a-fA-F]{6}$/.test(text)) {
                updating = true;
                try {
                    const parsed = new Gdk.RGBA();
                    if (parsed.parse(text)) {
                        colorBtn.set_rgba(parsed);
                        notifyChange(text);
                    }
                } finally {
                    updating = false;
                }
            }
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            valign: Gtk.Align.CENTER,
        });
        box.append(entry);
        box.append(colorBtn);

        row.add_suffix(box);
        row.set_activatable_widget(colorBtn);

        return {
            row,
            getHex: () => entry.get_text().trim(),
            setHex: (hex) => {
                if (!hex) return;
                updating = true;
                try {
                    entry.set_text(hex);
                    row.set_subtitle(hex);
                    const r = new Gdk.RGBA();
                    if (r.parse(hex)) {
                        colorBtn.set_rgba(r);
                    }
                } finally {
                    updating = false;
                }
            },
        };
    }

    /**
     * Populates the Preferences Window.
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(820, 840);

        let presets = this._loadPresets();
        let userPresets = this._loadUserPresets();
        let presetNames = Object.keys(presets).sort();

        // =====================================================================
        // PAGE 1: CATÁLOGO Y FAVORITOS
        // =====================================================================
        const pageQuick = new Adw.PreferencesPage({
            title: _('Catálogo'),
            icon_name: 'starred-symbolic',
            name: 'catalog',
        });
        window.add(pageQuick);

        // Grupo 1: Favoritos en Quick Settings
        const groupFavs = new Adw.PreferencesGroup({
            title: _('Presets en Quick Settings'),
            description: _('Elige los 5 temas que aparecerán directamente en el panel superior para un acceso en 1 clic.'),
        });
        pageQuick.add(groupFavs);

        const onlyFavRow = new Adw.SwitchRow({
            title: _('Modo compacto (Solo mostrar los 5 favoritos)'),
            subtitle: _('Mantiene el menú desplegable liviano y limpio de scroll largo.'),
        });
        settings.bind('show-only-favorites', onlyFavRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupFavs.add(onlyFavRow);

        const defaultFavs = ['Everforest Dark', 'Catppuccin Mocha', 'Tokyo Night', 'Nord Dark', 'Gruvbox Dark'];
        const favComboRows = [];

        for (let i = 1; i <= 5; i++) {
            const key = `favorite-preset-${i}`;
            const strList = new Gtk.StringList();
            for (const name of presetNames) {
                strList.append(name);
            }

            const comboRow = new Adw.ComboRow({
                title: _(`Favorito ${i}`),
                subtitle: _(`Posición ${i} en el menú de acceso rápido`),
                model: strList,
            });

            let currentVal = settings.get_string(key) || defaultFavs[i - 1] || presetNames[0];
            let idx = presetNames.indexOf(currentVal);
            if (idx >= 0) comboRow.selected = idx;

            comboRow.connect('notify::selected', () => {
                const selectedText = presetNames[comboRow.selected];
                if (selectedText && selectedText !== settings.get_string(key)) {
                    settings.set_string(key, selectedText);
                }
            });

            groupFavs.add(comboRow);
            favComboRows.push(comboRow);
        }

        // Grupo 2: Explorador y Acciones Directas de Presets
        const groupCatalog = new Adw.PreferencesGroup({
            title: _('Explorador de Temas Calibrados'),
            description: _('Prueba, edita o elimina presets. Los temas personalizados pueden gestionarse con total libertad.'),
        });
        pageQuick.add(groupCatalog);

        // Container box for dynamic catalog rows
        const catalogBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });
        groupCatalog.add(catalogBox);

        // Forward declaration for editor setters (populated in Page 2)
        let editorLoadPreset = null;

        const rebuildCatalogList = () => {
            // Remove previous rows
            let child = catalogBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                catalogBox.remove(child);
                child = next;
            }

            presets = this._loadPresets();
            userPresets = this._loadUserPresets();
            presetNames = Object.keys(presets).sort();

            for (const name of presetNames) {
                const cfg = presets[name] || {};
                const isDark = (cfg.color_scheme === 'dark');
                const isCustom = Boolean(userPresets[name]);

                const subtitleText = `${isDark ? '🌙 Oscuro' : '☀️ Claro'} • Acento: ${cfg.accent_color || '#a7c080'} • Ventana: ${cfg.window_bg || '#2d353b'}${isCustom ? ' • [Personalizado]' : ''}`;

                const row = new Adw.ActionRow({
                    title: name,
                    subtitle: subtitleText,
                });

                // Color swatch dots preview
                const swatchBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 4,
                    valign: Gtk.Align.CENTER,
                    margin_end: 8,
                });

                const makeDot = (colorHex, tooltip) => {
                    const dot = new Gtk.Box({
                        valign: Gtk.Align.CENTER,
                    });
                    dot.set_size_request(16, 16);
                    dot.set_css_classes(['circular']);
                    dot.set_tooltip_text(tooltip);
                    return dot;
                };

                // Add dot indicators
                swatchBox.append(makeDot(cfg.accent_color || '#a7c080', `Acento: ${cfg.accent_color || ''}`));
                swatchBox.append(makeDot(cfg.window_bg || '#2d353b', `Fondo: ${cfg.window_bg || ''}`));
                row.add_prefix(swatchBox);

                // Button: Editar en Studio
                const editBtn = new Gtk.Button({
                    icon_name: 'document-edit-symbolic',
                    valign: Gtk.Align.CENTER,
                    tooltip_text: _('Cargar y editar en el Studio de Paleta'),
                    css_classes: ['flat'],
                });
                editBtn.connect('clicked', () => {
                    if (editorLoadPreset) {
                        editorLoadPreset(name, cfg);
                        window.set_visible_page(pageEditor);
                    }
                });
                row.add_suffix(editBtn);

                // Button: Eliminar (solo para presets del usuario)
                if (isCustom) {
                    const deleteBtn = new Gtk.Button({
                        icon_name: 'user-trash-symbolic',
                        valign: Gtk.Align.CENTER,
                        tooltip_text: _('Eliminar este preset personalizado'),
                        css_classes: ['flat', 'destructive-action'],
                    });
                    deleteBtn.connect('clicked', () => {
                        this._deleteUserPreset(name);
                        rebuildCatalogList();
                    });
                    row.add_suffix(deleteBtn);
                }

                // Button: Aplicar
                const applyBtn = new Gtk.Button({
                    label: _('Aplicar'),
                    valign: Gtk.Align.CENTER,
                    css_classes: ['suggested-action'],
                });

                applyBtn.connect('clicked', () => {
                    applyBtn.set_sensitive(false);
                    applyBtn.set_label(_('Aplicando...'));
                    this._executeQuickThemer(['apply', name], (ok) => {
                        applyBtn.set_sensitive(true);
                        applyBtn.set_label(ok ? _('¡Listo!') : _('Error'));
                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                            applyBtn.set_label(_('Aplicar'));
                            return GLib.SOURCE_REMOVE;
                        });
                    });
                });

                row.add_suffix(applyBtn);
                catalogBox.append(row);
            }
        };

        rebuildCatalogList();

        // =====================================================================
        // PAGE 2: STUDIO Y CREADOR DE PRESETS
        // =====================================================================
        const pageEditor = new Adw.PreferencesPage({
            title: _('Studio de Paleta'),
            icon_name: 'applications-graphics-symbolic',
            name: 'editor',
        });
        window.add(pageEditor);

        const groupBase = new Adw.PreferencesGroup({
            title: _('Plantilla y Nombre del Preset'),
            description: _('Comienza desde una paleta existente o diseña tu armonía visual desde cero.'),
        });
        pageEditor.add(groupBase);

        const basePresetModel = new Gtk.StringList();
        for (const name of presetNames) {
            basePresetModel.append(name);
        }
        const basePresetCombo = new Adw.ComboRow({
            title: _('Cargar plantilla base'),
            subtitle: _('Usa los colores y métricas de un tema como punto de partida'),
            model: basePresetModel,
        });
        groupBase.add(basePresetCombo);

        const themeNameEntry = new Adw.EntryRow({
            title: _('Nombre del tema'),
            text: 'Mi-Tema-Studio',
        });
        groupBase.add(themeNameEntry);

        const schemeModel = new Gtk.StringList();
        schemeModel.append(_('Oscuro (Dark)'));
        schemeModel.append(_('Claro (Light)'));
        const schemeCombo = new Adw.ComboRow({
            title: _('Modo de color'),
            model: schemeModel,
            selected: 0,
        });
        groupBase.add(schemeCombo);

        // Grupo: Colores Fáciles e Intuitivos con Selector Visual
        const groupColors = new Adw.PreferencesGroup({
            title: _('Colores de la Paleta'),
            description: _('Haz clic en el selector de color nativo para elegir visualmente o introduce el código #HEX.'),
        });
        pageEditor.add(groupColors);

        const colorAccent = this._createColorRow(_('Color de Acento Principal'), _('Botones destacados, switches y foco'), '#a7c080');
        const colorAccentFg = this._createColorRow(_('Texto sobre el Acento'), _('Contraste sobre fondo de acento'), '#1a201c');
        const colorAccentSec = this._createColorRow(_('Acento Secundario'), _('Hover activo, acentos sutiles y enlaces'), '#83c092');
        const colorWindowBg = this._createColorRow(_('Fondo de Ventana (Window BG)'), _('Fondo principal de aplicaciones'), '#2d353b');
        const colorSidebarBg = this._createColorRow(_('Barra Lateral (Sidebar)'), _('Paneles en Nautilus y apps split-view'), '#272e33');
        const colorHeaderbarBg = this._createColorRow(_('Barra de Título (Headerbar)'), _('Barra superior de ventanas'), '#232a2e');
        const colorSurfaceElevated = this._createColorRow(_('Superficie Elevada'), _('Tarjetas, diálogos y popups'), '#343f44');
        const colorTextPrimary = this._createColorRow(_('Texto Principal (Foreground)'), _('Texto principal legible'), '#d3c6aa');
        const colorTextMuted = this._createColorRow(_('Texto Secundario (Muted)'), _('Subtítulos y metadatos'), '#859289');
        const colorBorder = this._createColorRow(_('Color de Bordes'), _('Líneas divisorias y contornos'), '#3d484d');
        const colorBorderActive = this._createColorRow(_('Borde Activo / Foco'), _('Contorno de ventana enfocada'), '#475258');

        groupColors.add(colorAccent.row);
        groupColors.add(colorAccentFg.row);
        groupColors.add(colorAccentSec.row);
        groupColors.add(colorWindowBg.row);
        groupColors.add(colorSidebarBg.row);
        groupColors.add(colorHeaderbarBg.row);
        groupColors.add(colorSurfaceElevated.row);
        groupColors.add(colorTextPrimary.row);
        groupColors.add(colorTextMuted.row);
        groupColors.add(colorBorder.row);
        groupColors.add(colorBorderActive.row);

        // Grupo: Geometría, Ventanas y Bordes del Preset
        const groupPresetGeometry = new Adw.PreferencesGroup({
            title: _('Geometría, Ventanas y Bordes'),
            description: _('Parámetros de esquinas redondeadas, grosor de contorno y ubicación de botones.'),
        });
        pageEditor.add(groupPresetGeometry);

        const winRadiusRow = new Adw.SpinRow({
            title: _('Radio de esquinas de ventana'),
            subtitle: _('Redondeo superior e inferior en píxeles (0 = cuadrado, 32 = curvado)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 32, step_increment: 1, page_increment: 4, value: 12 }),
        });
        groupPresetGeometry.add(winRadiusRow);

        const btnRadiusRow = new Adw.SpinRow({
            title: _('Radio de bordes de botones'),
            subtitle: _('Redondeo de botones, inputs y selectores (0 a 24 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 24, step_increment: 1, page_increment: 2, value: 8 }),
        });
        groupPresetGeometry.add(btnRadiusRow);

        const borderWidthRow = new Adw.SpinRow({
            title: _('Grosor de borde de ventana y tarjetas'),
            subtitle: _('Anchura de contornos en píxeles (0 = sin bordes, 1 = sutil, 3 = marcado)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 4, step_increment: 1, page_increment: 1, value: 1 }),
        });
        groupPresetGeometry.add(borderWidthRow);

        // Disposición de botones (Derecha vs Izquierda vs Compacto)
        const layoutModel = new Gtk.StringList();
        layoutModel.append(_('Derecha (GNOME / Windows: Minimizar, Maximizar, Cerrar)'));
        layoutModel.append(_('Izquierda (macOS: Cerrar, Minimizar, Maximizar)'));
        layoutModel.append(_('Derecha Compacto (Solo Cerrar)'));
        layoutModel.append(_('Izquierda Compacto (Solo Cerrar)'));

        const layoutValues = ['right', 'left', 'right-compact', 'left-compact'];
        const buttonLayoutCombo = new Adw.ComboRow({
            title: _('Disposición de botones de ventana'),
            subtitle: _('Ubicación de los controles de cerrar, minimizar y maximizar'),
            model: layoutModel,
            selected: 0,
        });
        groupPresetGeometry.add(buttonLayoutCombo);

        const controlStyleModel = new Gtk.StringList();
        controlStyleModel.append(_('macOS Traffic Lights (Semáforo con hover inteligente)'));
        controlStyleModel.append(_('Adwaita Estándar (Monocromático discreto)'));

        const controlsStyleCombo = new Adw.ComboRow({
            title: _('Estilo de botones de control'),
            model: controlStyleModel,
            selected: 0,
        });
        groupPresetGeometry.add(controlsStyleCombo);

        const wpStyles = ['abstract_waves', 'aurora', 'geometric'];
        const wpStyleModel = new Gtk.StringList();
        wpStyleModel.append(_('Olas Abstractas (Waves)'));
        wpStyleModel.append(_('Aurora Boreal'));
        wpStyleModel.append(_('Geométrico Cristalino'));

        const wpStyleCombo = new Adw.ComboRow({
            title: _('Estilo de fondo de pantalla coordinado'),
            model: wpStyleModel,
            selected: 0,
        });
        groupPresetGeometry.add(wpStyleCombo);

        // Preload function for base preset template selection or direct catalog editing
        editorLoadPreset = (name, cfg) => {
            if (!cfg) return;
            themeNameEntry.set_text(name.includes('Custom') ? name : `${name}-Custom`);
            schemeCombo.set_selected(cfg.color_scheme === 'light' ? 1 : 0);

            if (cfg.accent_color) colorAccent.setHex(cfg.accent_color);
            if (cfg.accent_fg) colorAccentFg.setHex(cfg.accent_fg);
            if (cfg.accent_secondary) colorAccentSec.setHex(cfg.accent_secondary);
            if (cfg.window_bg) colorWindowBg.setHex(cfg.window_bg);
            if (cfg.sidebar_bg) colorSidebarBg.setHex(cfg.sidebar_bg);
            if (cfg.headerbar_bg) colorHeaderbarBg.setHex(cfg.headerbar_bg);
            if (cfg.surface_elevated) colorSurfaceElevated.setHex(cfg.surface_elevated);
            if (cfg.text_primary) colorTextPrimary.setHex(cfg.text_primary);
            if (cfg.text_muted) colorTextMuted.setHex(cfg.text_muted);
            if (cfg.border_color) colorBorder.setHex(cfg.border_color);
            if (cfg.border_active) colorBorderActive.setHex(cfg.border_active);

            if (typeof cfg.window_radius === 'number') winRadiusRow.set_value(cfg.window_radius);
            if (typeof cfg.button_radius === 'number') btnRadiusRow.set_value(cfg.button_radius);
            if (typeof cfg.border_width === 'number') borderWidthRow.set_value(cfg.border_width);

            if (cfg.button_layout) {
                const lIdx = layoutValues.indexOf(cfg.button_layout);
                if (lIdx >= 0) buttonLayoutCombo.set_selected(lIdx);
            }

            if (cfg.window_controls_style) {
                controlsStyleCombo.set_selected(cfg.window_controls_style === 'adwaita' ? 1 : 0);
            }

            if (cfg.wallpaper_style) {
                const wIdx = wpStyles.indexOf(cfg.wallpaper_style);
                if (wIdx >= 0) wpStyleCombo.set_selected(wIdx);
            }
        };

        basePresetCombo.connect('notify::selected', () => {
            const baseName = presetNames[basePresetCombo.selected];
            editorLoadPreset(baseName, presets[baseName]);
        });

        // Grupo Guardar Preset y Aplicar
        const groupSave = new Adw.PreferencesGroup({
            title: _('Acciones del Preset'),
        });
        pageEditor.add(groupSave);

        const buildPresetConfig = () => {
            const chosenLayout = layoutValues[buttonLayoutCombo.selected] || 'right';
            const chosenControls = controlsStyleCombo.selected === 1 ? 'adwaita' : 'traffic-hover';
            const chosenWp = wpStyles[wpStyleCombo.selected] || 'abstract_waves';

            return {
                theme_name: themeNameEntry.get_text() || 'Custom-Theme',
                color_scheme: schemeCombo.selected === 1 ? 'light' : 'dark',
                accent_color: colorAccent.getHex() || '#a7c080',
                accent_fg: colorAccentFg.getHex() || '#1a201c',
                accent_secondary: colorAccentSec.getHex() || '#83c092',
                window_bg: colorWindowBg.getHex() || '#2d353b',
                sidebar_bg: colorSidebarBg.getHex() || '#272e33',
                surface_elevated: colorSurfaceElevated.getHex() || '#343f44',
                headerbar_bg: colorHeaderbarBg.getHex() || '#232a2e',
                text_primary: colorTextPrimary.getHex() || '#d3c6aa',
                text_muted: colorTextMuted.getHex() || '#859289',
                border_color: colorBorder.getHex() || '#3d484d',
                border_active: colorBorderActive.getHex() || '#475258',
                window_radius: Math.round(winRadiusRow.get_value()),
                button_radius: Math.round(btnRadiusRow.get_value()),
                border_width: Math.round(borderWidthRow.get_value()),
                button_layout: chosenLayout,
                window_controls_style: chosenControls,
                wallpaper_style: chosenWp,
            };
        };

        const saveActionRow = new Adw.ActionRow({
            title: _('Guardar en Catálogo'),
            subtitle: _('Guarda este preset en tu biblioteca personalizada'),
        });

        const saveBtn = new Gtk.Button({
            label: _('Guardar Preset'),
            valign: Gtk.Align.CENTER,
            css_classes: ['pill'],
        });

        saveBtn.connect('clicked', () => {
            const config = buildPresetConfig();
            const allUser = this._loadUserPresets();
            allUser[config.theme_name] = config;
            this._saveUserPresets(allUser);

            saveBtn.set_label(_('¡Guardado!'));
            rebuildCatalogList();
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                saveBtn.set_label(_('Guardar Preset'));
                return GLib.SOURCE_REMOVE;
            });
        });

        saveActionRow.add_suffix(saveBtn);
        groupSave.add(saveActionRow);

        const saveAndApplyRow = new Adw.ActionRow({
            title: _('Guardar y Aplicar al Escritorio'),
            subtitle: _('Compila las hojas de estilo SCSS con sassc y activa el tema inmediatamente'),
        });

        const applySaveBtn = new Gtk.Button({
            label: _('Guardar y Aplicar'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action', 'pill'],
        });

        applySaveBtn.connect('clicked', () => {
            applySaveBtn.set_sensitive(false);
            applySaveBtn.set_label(_('Compilando...'));

            const config = buildPresetConfig();
            const jsonStr = JSON.stringify(config);

            this._executeQuickThemer(['custom', '--save', '--json', jsonStr], (ok) => {
                applySaveBtn.set_sensitive(true);
                applySaveBtn.set_label(ok ? _('¡Aplicado con Éxito!') : _('Error al compilar'));
                rebuildCatalogList();
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                    applySaveBtn.set_label(_('Guardar y Aplicar'));
                    return GLib.SOURCE_REMOVE;
                });
            });
        });

        saveAndApplyRow.add_suffix(applySaveBtn);
        groupSave.add(saveAndApplyRow);

        // =====================================================================
        // PAGE 3: MÉTRICAS Y GEOMETRÍA GLOBAL
        // =====================================================================
        const pageMetrics = new Adw.PreferencesPage({
            title: _('Métricas Globales'),
            icon_name: 'preferences-system-windows-symbolic',
            name: 'metrics',
        });
        window.add(pageMetrics);

        const groupRadii = new Adw.PreferencesGroup({
            title: _('Geometría de Ventanas y Controles'),
            description: _('Ajustes por defecto aplicados al cambiar de tema o compilar.'),
        });
        pageMetrics.add(groupRadii);

        const globalWinRadius = new Adw.SpinRow({
            title: _('Radio de esquinas de ventana'),
            subtitle: _('Esquinas de ventanas Libadwaita y diálogos (0 a 32 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 32, step_increment: 1, page_increment: 4, value: settings.get_int('window-radius') }),
        });
        settings.bind('window-radius', globalWinRadius, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupRadii.add(globalWinRadius);

        const globalBtnRadius = new Adw.SpinRow({
            title: _('Radio de botones e inputs'),
            subtitle: _('Redondeo de botones y controles interactivos (0 a 24 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 24, step_increment: 1, page_increment: 2, value: settings.get_int('button-radius') }),
        });
        settings.bind('button-radius', globalBtnRadius, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupRadii.add(globalBtnRadius);

        const globalBorderWidth = new Adw.SpinRow({
            title: _('Ancho de bordes en px'),
            subtitle: _('Grosor del contorno de ventanas y tarjetas (0 a 4 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 4, step_increment: 1, page_increment: 1, value: settings.get_int('border-width') }),
        });
        settings.bind('border-width', globalBorderWidth, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupRadii.add(globalBorderWidth);

        const groupGlobalControls = new Adw.PreferencesGroup({
            title: _('Controles de Ventana (Titlebar)'),
        });
        pageMetrics.add(groupGlobalControls);

        const globalLayoutModel = new Gtk.StringList();
        globalLayoutModel.append(_('Derecha (GNOME / Windows: Minimizar, Maximizar, Cerrar)'));
        globalLayoutModel.append(_('Izquierda (macOS: Cerrar, Minimizar, Maximizar)'));
        globalLayoutModel.append(_('Derecha Compacto (Solo Cerrar)'));
        globalLayoutModel.append(_('Izquierda Compacto (Solo Cerrar)'));

        const currentLayout = settings.get_string('button-layout') || 'right';
        let layoutIdx = layoutValues.indexOf(currentLayout);
        if (layoutIdx < 0) layoutIdx = 0;

        const globalLayoutCombo = new Adw.ComboRow({
            title: _('Disposición de botones de ventana'),
            subtitle: _('Ubicación de botones de control en la barra de título'),
            model: globalLayoutModel,
            selected: layoutIdx,
        });

        globalLayoutCombo.connect('notify::selected', () => {
            const selectedLayout = layoutValues[globalLayoutCombo.selected] || 'right';
            settings.set_string('button-layout', selectedLayout);

            // Also update GNOME WM button layout live
            let gsettingsVal = 'appmenu:minimize,maximize,close';
            if (selectedLayout === 'left') gsettingsVal = 'close,minimize,maximize:';
            else if (selectedLayout === 'right-compact') gsettingsVal = 'appmenu:close';
            else if (selectedLayout === 'left-compact') gsettingsVal = 'close:';

            try {
                const wmSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
                wmSettings.set_string('button-layout', gsettingsVal);
            } catch (_) {}
        });
        groupGlobalControls.add(globalLayoutCombo);

        const globalControlsCombo = new Adw.ComboRow({
            title: _('Estilo de botones de cierre y minimizar'),
            model: controlStyleModel,
            selected: settings.get_string('window-controls-style') === 'adwaita' ? 1 : 0,
        });
        globalControlsCombo.connect('notify::selected', () => {
            const val = globalControlsCombo.selected === 1 ? 'adwaita' : 'traffic-hover';
            settings.set_string('window-controls-style', val);
        });
        groupGlobalControls.add(globalControlsCombo);

        // =====================================================================
        // PAGE 4: INTEGRACIONES DEL SISTEMA
        // =====================================================================
        const pageIntegrations = new Adw.PreferencesPage({
            title: _('Integraciones'),
            icon_name: 'preferences-desktop-display-symbolic',
            name: 'integrations',
        });
        window.add(pageIntegrations);

        const groupWallpaper = new Adw.PreferencesGroup({
            title: _('Fondo de Pantalla 4K Vectorial'),
            description: _('Genera automáticamente un wallpaper SVG 4K que combina matemáticamente con la paleta de colores activa.'),
        });
        pageIntegrations.add(groupWallpaper);

        const wpSwitch = new Adw.SwitchRow({
            title: _('Generar fondo a juego'),
            subtitle: _('Aplica un fondo de escritorio coordinado al cambiar de tema.'),
        });
        settings.bind('apply-wallpaper', wpSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupWallpaper.add(wpSwitch);

        let currentWpStyle = settings.get_string('wallpaper-style') || 'abstract_waves';
        let wpGlobalIdx = wpStyles.indexOf(currentWpStyle);
        if (wpGlobalIdx < 0) wpGlobalIdx = 0;

        const globalWpCombo = new Adw.ComboRow({
            title: _('Estilo de composición'),
            model: wpStyleModel,
            selected: wpGlobalIdx,
        });
        globalWpCombo.connect('notify::selected', () => {
            const selectedStyle = wpStyles[globalWpCombo.selected];
            if (selectedStyle) {
                settings.set_string('wallpaper-style', selectedStyle);
            }
        });
        groupWallpaper.add(globalWpCombo);

        const groupApps = new Adw.PreferencesGroup({
            title: _('Aplicaciones y Ecosistema'),
        });
        pageIntegrations.add(groupApps);

        const ffSwitch = new Adw.SwitchRow({
            title: _('Sincronizar navegador Firefox'),
            subtitle: _('Aplica userChrome y userContent a juego en perfiles XDG, Flatpak y Snap.'),
        });
        settings.bind('apply-firefox', ffSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(ffSwitch);

        const flatpakSwitch = new Adw.SwitchRow({
            title: _('Propagar a aplicaciones Flatpak'),
            subtitle: _('Enlaza la configuración de GTK4 en los contenedores aislados ~/.var/app/.'),
        });
        settings.bind('apply-flatpak', flatpakSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(flatpakSwitch);

        const notifSwitch = new Adw.SwitchRow({
            title: _('Notificaciones del escritorio'),
            subtitle: _('Muestra una notificación en GNOME al compilar y aplicar un tema.'),
        });
        settings.bind('show-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(notifSwitch);

        // =====================================================================
        // PAGE 5: ACERCA DE Y DIAGNÓSTICO
        // =====================================================================
        const pageAbout = new Adw.PreferencesPage({
            title: _('Acerca de'),
            icon_name: 'help-about-symbolic',
            name: 'about',
        });
        window.add(pageAbout);

        const groupAboutInfo = new Adw.PreferencesGroup({
            title: _('GNOME Quick Themer'),
            description: _('Versión 1.0.0 • Entorno nativo de diseño y personalización para GNOME Shell y Libadwaita.'),
        });
        pageAbout.add(groupAboutInfo);

        const githubRow = new Adw.ActionRow({
            title: _('Repositorio en GitHub'),
            subtitle: 'https://github.com/angelaguayo/gnome-quick-themer',
            activatable: true,
        });
        githubRow.add_suffix(new Gtk.Image({
            icon_name: 'external-link-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        githubRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/angelaguayo/gnome-quick-themer', null);
        });
        groupAboutInfo.add(githubRow);

        const groupReset = new Adw.PreferencesGroup({
            title: _('Zona de Mantenimiento'),
            description: _('Restaura los valores predeterminados de fábrica de GNOME sin tocar tus datos personales.'),
        });
        pageAbout.add(groupReset);

        const resetAllRow = new Adw.ActionRow({
            title: _('Restablecer escritorio a Adwaita de fábrica'),
            subtitle: _('Restaura temas, fuentes, fondos y elimina overrides de Libadwaita y Flatpak'),
        });
        const resetBtn = new Gtk.Button({
            label: _('Restablecer'),
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetBtn.connect('clicked', () => {
            resetBtn.set_sensitive(false);
            resetBtn.set_label(_('Restableciendo...'));
            this._executeQuickThemer(['reset'], (ok) => {
                resetBtn.set_sensitive(true);
                resetBtn.set_label(ok ? _('Restablecido') : _('Error'));
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    resetBtn.set_label(_('Restablecer'));
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
        resetAllRow.add_suffix(resetBtn);
        groupReset.add(resetAllRow);
    }
}
