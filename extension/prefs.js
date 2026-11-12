/**
 * GNOME Quick Themer — Libadwaita Preferences Studio (prefs.js)
 * Compatible with GNOME Shell 45–51+ (ESM architecture)
 *
 * Designed strictly following GNOME Human Interface Guidelines (HIG):
 * - Catálogo limpio con gestión de favoritos y prueba directa
 * - Diseñador intuitivo: 4 colores esenciales + expander avanzado + parámetros de ventanas/botones
 * - Sin redundancias ni duplicación de métricas
 * - Integraciones del sistema y restauración de fábrica
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

        // Could not find the project directory — the extension symlink may be absolute.
        // Fall back to a last-resort check in $HOME and then give up gracefully.
        const fallback = GLib.build_filenamev([GLib.get_home_dir(), 'gnome-quick-themer']);
        if (GLib.file_test(GLib.build_filenamev([fallback, 'quick-themer']), GLib.FileTest.EXISTS)) {
            return fallback;
        }
        console.error('[QuickThemer] Project directory not found. Re-install with ./install.sh');
        return null;
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
     * Saves user presets map.
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
     * Executes quick-themer asynchronously without blocking Mutter compositor loop.
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
        window.set_default_size(780, 800);

        let presets = this._loadPresets();
        let userPresets = this._loadUserPresets();
        let presetNames = Object.keys(presets).sort();

        // Forward declaration for loading a preset into the Designer
        let loadPresetIntoDesigner = null;

        // =====================================================================
        // PÁGINA 1: CATÁLOGO DE TEMAS
        // =====================================================================
        const pageCatalog = new Adw.PreferencesPage({
            title: _('Catálogo'),
            icon_name: 'view-grid-symbolic',
            name: 'catalog',
        });
        window.add(pageCatalog);

        // Grupo 1: Favoritos en Quick Settings
        const groupQuickSettings = new Adw.PreferencesGroup({
            title: _('Panel Superior (Quick Settings)'),
            description: _('Configura cómo se muestran los temas en el menú superior.'),
        });
        pageCatalog.add(groupQuickSettings);

        const onlyFavRow = new Adw.SwitchRow({
            title: _('Modo compacto (Solo mostrar 5 favoritos)'),
            subtitle: _('Mantiene el menú desplegable ligero y sin desplazamiento largo.'),
        });
        settings.bind('show-only-favorites', onlyFavRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupQuickSettings.add(onlyFavRow);

        // Expander para no agobiar con 5 dropdowns de golpe
        const favsExpander = new Adw.ExpanderRow({
            title: _('Elegir los 5 temas favoritos'),
            subtitle: _('Personaliza las 5 posiciones del acceso rápido'),
        });
        groupQuickSettings.add(favsExpander);

        const defaultFavs = ['Everforest Dark', 'Catppuccin Mocha', 'Tokyo Night', 'Nord Dark', 'Gruvbox Dark'];
        for (let i = 1; i <= 5; i++) {
            const key = `favorite-preset-${i}`;
            const strList = new Gtk.StringList();
            for (const name of presetNames) {
                strList.append(name);
            }

            const comboRow = new Adw.ComboRow({
                title: _(`Posición ${i}`),
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

            favsExpander.add_row(comboRow);
        }

        // Grupo 2: Biblioteca de Temas
        const groupThemes = new Adw.PreferencesGroup({
            title: _('Biblioteca de Temas'),
            description: _('Aplica cualquier tema con un clic o cárgalo en el diseñador para personalizarlo.'),
        });
        pageCatalog.add(groupThemes);

        const catalogBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });
        groupThemes.add(catalogBox);

        const rebuildCatalog = () => {
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

                const row = new Adw.ActionRow({
                    title: name,
                    subtitle: `${isDark ? '🌙 Oscuro' : '☀️ Claro'} • Acento: ${cfg.accent_color || '#3584e4'}${isCustom ? ' • [Personalizado]' : ''}`,
                });

                // Accent dot prefix
                const dot = new Gtk.Box({ valign: Gtk.Align.CENTER });
                dot.set_size_request(14, 14);
                dot.set_css_classes(['circular']);
                dot.set_tooltip_text(`Acento: ${cfg.accent_color || ''}`);
                row.add_prefix(dot);

                // Edit button
                const editBtn = new Gtk.Button({
                    icon_name: 'document-edit-symbolic',
                    valign: Gtk.Align.CENTER,
                    tooltip_text: _('Cargar en el Diseñador'),
                    css_classes: ['flat'],
                });
                editBtn.connect('clicked', () => {
                    if (loadPresetIntoDesigner) {
                        loadPresetIntoDesigner(name, cfg);
                        window.set_visible_page(pageDesigner);
                    }
                });
                row.add_suffix(editBtn);

                // Delete button for custom presets only
                if (isCustom) {
                    const deleteBtn = new Gtk.Button({
                        icon_name: 'user-trash-symbolic',
                        valign: Gtk.Align.CENTER,
                        tooltip_text: _('Eliminar preset'),
                        css_classes: ['flat', 'destructive-action'],
                    });
                    deleteBtn.connect('clicked', () => {
                        this._deleteUserPreset(name);
                        rebuildCatalog();
                    });
                    row.add_suffix(deleteBtn);
                }

                // Apply button
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

        rebuildCatalog();

        // =====================================================================
        // PÁGINA 2: DISEÑADOR DE TEMA (CLARO, DIRECTO Y SIN AGOBIO)
        // =====================================================================
        const pageDesigner = new Adw.PreferencesPage({
            title: _('Diseñador'),
            icon_name: 'applications-graphics-symbolic',
            name: 'designer',
        });
        window.add(pageDesigner);

        // 1. Identidad
        const groupIdentity = new Adw.PreferencesGroup({
            title: _('Identidad del Tema'),
        });
        pageDesigner.add(groupIdentity);

        const basePresetModel = new Gtk.StringList();
        for (const name of presetNames) {
            basePresetModel.append(name);
        }
        const basePresetCombo = new Adw.ComboRow({
            title: _('Cargar desde plantilla'),
            subtitle: _('Usa los colores y parámetros de un tema existente'),
            model: basePresetModel,
        });
        groupIdentity.add(basePresetCombo);

        const themeNameEntry = new Adw.EntryRow({
            title: _('Nombre del tema'),
            text: 'Mi-Tema',
        });
        groupIdentity.add(themeNameEntry);

        const schemeModel = new Gtk.StringList();
        schemeModel.append(_('Oscuro (Dark)'));
        schemeModel.append(_('Claro (Light)'));
        const schemeCombo = new Adw.ComboRow({
            title: _('Modo de color'),
            model: schemeModel,
            selected: 0,
        });
        groupIdentity.add(schemeCombo);

        // 2. Colores Esenciales (Solo los 4 colores fundamentales)
        const groupEssentialColors = new Adw.PreferencesGroup({
            title: _('Colores Esenciales'),
            description: _('Los 4 tonos que definen la personalidad visual de tu escritorio.'),
        });
        pageDesigner.add(groupEssentialColors);

        const colorAccent = this._createColorRow(
            _('Color de Acento'),
            _('Botones destacados, selección y controles activos'),
            '#a7c080'
        );
        const colorWindowBg = this._createColorRow(
            _('Fondo de Ventana'),
            _('Tono principal de las ventanas y aplicaciones'),
            '#2d353b'
        );
        const colorBarsBg = this._createColorRow(
            _('Barras y Paneles'),
            _('Barra superior Headerbar y barra lateral de Nautilus'),
            '#232a2e'
        );
        const colorText = this._createColorRow(
            _('Color del Texto'),
            _('Texto principal de lectura en primer plano'),
            '#d3c6aa'
        );

        groupEssentialColors.add(colorAccent.row);
        groupEssentialColors.add(colorWindowBg.row);
        groupEssentialColors.add(colorBarsBg.row);
        groupEssentialColors.add(colorText.row);

        // 3. Ajustes Avanzados de Color (Colapsado para evitar saturación)
        const groupAdvancedColors = new Adw.PreferencesGroup();
        pageDesigner.add(groupAdvancedColors);

        const advancedExpander = new Adw.ExpanderRow({
            title: _('Ajustes Avanzados de Color'),
            subtitle: _('Contraste sobre acento, tarjetas elevadas y bordes'),
        });
        groupAdvancedColors.add(advancedExpander);

        const colorAccentFg = this._createColorRow(
            _('Texto sobre el Acento'),
            _('Contraste dentro de botones activos'),
            '#1a201c'
        );
        const colorAccentSec = this._createColorRow(
            _('Acento Secundario'),
            _('Enlaces y efectos de selección'),
            '#83c092'
        );
        const colorSurface = this._createColorRow(
            _('Superficie Elevada'),
            _('Tarjetas, menús y diálogos flotantes'),
            '#343f44'
        );
        const colorTextMuted = this._createColorRow(
            _('Texto Secundario'),
            _('Subtítulos y etiquetas atenuadas'),
            '#859289'
        );
        const colorBorder = this._createColorRow(
            _('Color de Borde'),
            _('Contorno sutil de ventanas y contenedores'),
            '#3d484d'
        );
        const colorBorderActive = this._createColorRow(
            _('Borde Enfocado'),
            _('Resaltado de la ventana activa'),
            '#475258'
        );

        advancedExpander.add_row(colorAccentFg.row);
        advancedExpander.add_row(colorAccentSec.row);
        advancedExpander.add_row(colorSurface.row);
        advancedExpander.add_row(colorTextMuted.row);
        advancedExpander.add_row(colorBorder.row);
        advancedExpander.add_row(colorBorderActive.row);

        // 4. Geometría de Ventanas y Botones (Sin duplicados con otra página)
        const groupGeometry = new Adw.PreferencesGroup({
            title: _('Ventanas, Bordes y Botones'),
            description: _('Controla el redondeo de esquinas y la ubicación de los botones de ventana.'),
        });
        pageDesigner.add(groupGeometry);

        const winRadiusRow = new Adw.SpinRow({
            title: _('Radio de esquinas de ventana'),
            subtitle: _('0 px (cuadrado) a 32 px (ultra redondeado)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 32, step_increment: 1, page_increment: 4, value: 12 }),
        });
        groupGeometry.add(winRadiusRow);

        const btnRadiusRow = new Adw.SpinRow({
            title: _('Radio de botones e inputs'),
            subtitle: _('Redondeo de botones y controles interactivos (0 a 24 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 24, step_increment: 1, page_increment: 2, value: 8 }),
        });
        groupGeometry.add(btnRadiusRow);

        const borderWidthRow = new Adw.SpinRow({
            title: _('Grosor de borde de ventana'),
            subtitle: _('0 px (sin contorno) a 4 px (borde marcado)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 4, step_increment: 1, page_increment: 1, value: 1 }),
        });
        groupGeometry.add(borderWidthRow);

        const layoutModel = new Gtk.StringList();
        layoutModel.append(_('Derecha (GNOME / Windows: Minimizar, Maximizar, Cerrar)'));
        layoutModel.append(_('Izquierda (macOS: Cerrar, Minimizar, Maximizar)'));
        layoutModel.append(_('Derecha Compacto (Solo Cerrar)'));
        layoutModel.append(_('Izquierda Compacto (Solo Cerrar)'));

        const layoutValues = ['right', 'left', 'right-compact', 'left-compact'];
        const buttonLayoutCombo = new Adw.ComboRow({
            title: _('Disposición de botones de ventana'),
            subtitle: _('Ubicación de controles en la barra de título'),
            model: layoutModel,
            selected: 0,
        });
        groupGeometry.add(buttonLayoutCombo);

        const controlStyleModel = new Gtk.StringList();
        controlStyleModel.append(_('macOS Traffic Lights (Semáforo con hover inteligente)'));
        controlStyleModel.append(_('Adwaita Estándar (Monocromático discreto)'));

        const controlsStyleCombo = new Adw.ComboRow({
            title: _('Estilo de controles de ventana'),
            model: controlStyleModel,
            selected: 0,
        });
        groupGeometry.add(controlsStyleCombo);

        // Preload function
        loadPresetIntoDesigner = (name, cfg) => {
            if (!cfg) return;
            themeNameEntry.set_text(name.includes('Custom') ? name : `${name}-Custom`);
            schemeCombo.set_selected(cfg.color_scheme === 'light' ? 1 : 0);

            // Essential colors
            if (cfg.accent_color) colorAccent.setHex(cfg.accent_color);
            if (cfg.window_bg) colorWindowBg.setHex(cfg.window_bg);
            if (cfg.headerbar_bg) colorBarsBg.setHex(cfg.headerbar_bg);
            if (cfg.text_primary) colorText.setHex(cfg.text_primary);

            // Advanced colors
            if (cfg.accent_fg) colorAccentFg.setHex(cfg.accent_fg);
            if (cfg.accent_secondary) colorAccentSec.setHex(cfg.accent_secondary);
            if (cfg.surface_elevated) colorSurface.setHex(cfg.surface_elevated);
            if (cfg.text_muted) colorTextMuted.setHex(cfg.text_muted);
            if (cfg.border_color) colorBorder.setHex(cfg.border_color);
            if (cfg.border_active) colorBorderActive.setHex(cfg.border_active);

            // Geometry
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
        };

        basePresetCombo.connect('notify::selected', () => {
            const baseName = presetNames[basePresetCombo.selected];
            loadPresetIntoDesigner(baseName, presets[baseName]);
        });

        // 5. Botones de Acción
        const groupActions = new Adw.PreferencesGroup({
            title: _('Acciones'),
        });
        pageDesigner.add(groupActions);

        const buildPresetConfig = () => {
            const chosenLayout = layoutValues[buttonLayoutCombo.selected] || 'right';
            const chosenControls = controlsStyleCombo.selected === 1 ? 'adwaita' : 'traffic-hover';
            const barsColor = colorBarsBg.getHex() || '#232a2e';

            return {
                theme_name: themeNameEntry.get_text() || 'Custom-Theme',
                color_scheme: schemeCombo.selected === 1 ? 'light' : 'dark',
                accent_color: colorAccent.getHex() || '#a7c080',
                accent_fg: colorAccentFg.getHex() || '#1a201c',
                accent_secondary: colorAccentSec.getHex() || '#83c092',
                window_bg: colorWindowBg.getHex() || '#2d353b',
                sidebar_bg: barsColor,
                surface_elevated: colorSurface.getHex() || '#343f44',
                headerbar_bg: barsColor,
                text_primary: colorText.getHex() || '#d3c6aa',
                text_muted: colorTextMuted.getHex() || '#859289',
                border_color: colorBorder.getHex() || '#3d484d',
                border_active: colorBorderActive.getHex() || '#475258',
                window_radius: Math.round(winRadiusRow.get_value()),
                button_radius: Math.round(btnRadiusRow.get_value()),
                border_width: Math.round(borderWidthRow.get_value()),
                button_layout: chosenLayout,
                window_controls_style: chosenControls,
                wallpaper_style: settings.get_string('wallpaper-style') || 'abstract_waves',
            };
        };

        const actionRow = new Adw.ActionRow({
            title: _('Guardar y Aplicar'),
            subtitle: _('Compila y activa este tema en GNOME Shell y Libadwaita'),
        });

        const saveOnlyBtn = new Gtk.Button({
            label: _('Solo Guardar'),
            valign: Gtk.Align.CENTER,
            css_classes: ['pill'],
        });

        saveOnlyBtn.connect('clicked', () => {
            const config = buildPresetConfig();
            const allUser = this._loadUserPresets();
            allUser[config.theme_name] = config;
            this._saveUserPresets(allUser);

            saveOnlyBtn.set_label(_('¡Guardado!'));
            rebuildCatalog();
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                saveOnlyBtn.set_label(_('Solo Guardar'));
                return GLib.SOURCE_REMOVE;
            });
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
                applySaveBtn.set_label(ok ? _('¡Aplicado!') : _('Error'));
                rebuildCatalog();
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                    applySaveBtn.set_label(_('Guardar y Aplicar'));
                    return GLib.SOURCE_REMOVE;
                });
            });
        });

        const actionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            valign: Gtk.Align.CENTER,
        });
        actionBox.append(saveOnlyBtn);
        actionBox.append(applySaveBtn);

        actionRow.add_suffix(actionBox);
        groupActions.add(actionRow);

        // =====================================================================
        // PÁGINA 3: SISTEMA E INTEGRACIONES (SIN REDUNDANCIAS)
        // =====================================================================
        const pageSystem = new Adw.PreferencesPage({
            title: _('Sistema'),
            icon_name: 'emblem-system-symbolic',
            name: 'system',
        });
        window.add(pageSystem);

        // Fondo de pantalla 4K
        const groupWallpaper = new Adw.PreferencesGroup({
            title: _('Fondo de Pantalla Coordinado (4K SVG)'),
            description: _('Genera automáticamente un wallpaper armónico con la paleta de colores activa.'),
        });
        pageSystem.add(groupWallpaper);

        const wpSwitch = new Adw.SwitchRow({
            title: _('Generar fondo de escritorio a juego'),
            subtitle: _('Aplica un fondo vectorial adaptado a los tonos del tema al cambiar.'),
        });
        settings.bind('apply-wallpaper', wpSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupWallpaper.add(wpSwitch);

        const wpStyleModel = new Gtk.StringList();
        wpStyleModel.append(_('Olas Abstractas (Waves)'));
        wpStyleModel.append(_('Aurora Boreal'));
        wpStyleModel.append(_('Geométrico Cristalino'));

        const wpStyles = ['abstract_waves', 'aurora', 'geometric'];
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

        // Ecosistema
        const groupApps = new Adw.PreferencesGroup({
            title: _('Ecosistema y Aplicaciones'),
        });
        pageSystem.add(groupApps);

        const ffSwitch = new Adw.SwitchRow({
            title: _('Sincronizar navegador Firefox'),
            subtitle: _('Aplica userChrome y userContent coordinado en perfiles XDG, Flatpak y Snap.'),
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
            subtitle: _('Muestra una confirmación toast en GNOME al compilar y aplicar un tema.'),
        });
        settings.bind('show-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(notifSwitch);

        // Mantenimiento y Restauración
        const groupMaintenance = new Adw.PreferencesGroup({
            title: _('Mantenimiento y Fábrica'),
            description: _('Restaura los valores por defecto del sistema si deseas volver al tema original.'),
        });
        pageSystem.add(groupMaintenance);

        const resetAllRow = new Adw.ActionRow({
            title: _('Restablecer escritorio a Adwaita original'),
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
        groupMaintenance.add(resetAllRow);

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
        groupMaintenance.add(githubRow);
    }
}
