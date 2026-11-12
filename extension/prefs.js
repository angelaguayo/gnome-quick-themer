/**
 * GNOME Quick Themer — Libadwaita Preferences Studio (prefs.js)
 * Compatible with GNOME Shell 45–51+ (ESM architecture)
 *
 * UI Principles (GNOME HIG):
 * - Catalog page: collapsible groups (System / Custom), search filter bar, color swatches
 * - Designer page: live color preview banner, clean sections, prominent save/apply actions
 * - System page: clear integration toggles, factory reset safely isolated
 * - No redundant pages, no info overload, no blocking calls
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class QuickThemerPreferences extends ExtensionPreferences {

    // =========================================================================
    // PROJECT DIR RESOLVER
    // =========================================================================

    _findProjectDir() {
        const envDir = GLib.getenv('GNOME_QUICK_THEMER_DIR');
        if (envDir && GLib.file_test(envDir, GLib.FileTest.IS_DIR)) {
            return envDir;
        }

        const extPath = this.path;
        if (extPath) {
            const parentDir = GLib.path_get_dirname(extPath);
            if (GLib.file_test(GLib.build_filenamev([parentDir, 'quick-themer']), GLib.FileTest.EXISTS)) {
                return parentDir;
            }
            try {
                const file = Gio.File.new_for_path(extPath);
                const info = file.query_info('standard::symlink-target', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                const target = info.get_symlink_target();
                if (target) {
                    const resolvedParent = GLib.path_get_dirname(target);
                    if (GLib.file_test(GLib.build_filenamev([resolvedParent, 'quick-themer']), GLib.FileTest.EXISTS)) {
                        return resolvedParent;
                    }
                }
            } catch (_) {}
        }

        const fallback = GLib.build_filenamev([GLib.get_home_dir(), 'gnome-quick-themer']);
        if (GLib.file_test(GLib.build_filenamev([fallback, 'quick-themer']), GLib.FileTest.EXISTS)) {
            return fallback;
        }
        console.error('[QuickThemer] Project directory not found. Re-install with ./install.sh');
        return null;
    }

    // =========================================================================
    // PRESET I/O
    // =========================================================================

    _loadBundledPresets() {
        const projectDir = this._findProjectDir();
        if (!projectDir) return {};
        try {
            const [ok, contents] = GLib.file_get_contents(GLib.build_filenamev([projectDir, 'presets.json']));
            if (ok) return JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            console.warn(`[QuickThemerPrefs] bundled presets: ${e.message}`);
        }
        return {};
    }

    _loadUserPresets() {
        const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-quick-themer', 'custom_presets.json']);
        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                const [ok, contents] = GLib.file_get_contents(path);
                if (ok) return JSON.parse(new TextDecoder().decode(contents));
            }
        } catch (e) {
            console.warn(`[QuickThemerPrefs] user presets: ${e.message}`);
        }
        return {};
    }

    _saveUserPresets(map) {
        const dir = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-quick-themer']);
        GLib.mkdir_with_parents(dir, 0o755);
        GLib.file_set_contents(
            GLib.build_filenamev([dir, 'custom_presets.json']),
            new TextEncoder().encode(JSON.stringify(map, null, 2))
        );
    }

    _deleteUserPreset(name) {
        const map = this._loadUserPresets();
        if (map[name]) { delete map[name]; this._saveUserPresets(map); return true; }
        return false;
    }

    _loadAllPresets() {
        return Object.assign({}, this._loadBundledPresets(), this._loadUserPresets());
    }

    // =========================================================================
    // ASYNC CLI RUNNER
    // =========================================================================

    _run(args, onDone) {
        const projectDir = this._findProjectDir();
        if (!projectDir) { if (onDone) onDone(false, '', 'Project dir not found'); return; }
        try {
            const proc = new Gio.Subprocess({
                argv: ['python3', GLib.build_filenamev([projectDir, 'quick-themer']), ...args],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (src, res) => {
                try {
                    const [, stdout, stderr] = src.communicate_utf8_finish(res);
                    if (onDone) onDone(src.get_exit_status() === 0, stdout, stderr);
                } catch (err) {
                    if (onDone) onDone(false, '', err.message);
                }
            });
        } catch (err) {
            if (onDone) onDone(false, '', err.message);
        }
    }

    // =========================================================================
    // COLOR ROW BUILDER
    // =========================================================================

    _colorRow(title, subtitle, hex, onChange) {
        const row = new Adw.ActionRow({ title, subtitle: subtitle || hex });

        const entry = new Gtk.Entry({
            text: hex, max_length: 7, width_chars: 9,
            valign: Gtk.Align.CENTER,
            css_classes: ['monospace'],
            placeholder_text: '#000000',
        });

        const isModern = typeof Gtk.ColorDialogButton !== 'undefined';
        let btn;
        if (isModern) {
            btn = new Gtk.ColorDialogButton({
                dialog: new Gtk.ColorDialog({ title, with_alpha: false }),
                valign: Gtk.Align.CENTER,
            });
        } else {
            btn = new Gtk.ColorButton({ valign: Gtk.Align.CENTER, use_alpha: false });
        }

        const rgba = new Gdk.RGBA();
        rgba.parse(hex);
        btn.set_rgba(rgba);

        let busy = false;
        const toHex = (r, g, b) => {
            const h = c => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
            return `#${h(r)}${h(g)}${h(b)}`;
        };
        const emit = (v) => { row.set_subtitle(v); if (onChange) onChange(v); };

        const onPick = () => {
            if (busy) return; busy = true;
            try { const c = btn.get_rgba(); const h = toHex(c.red, c.green, c.blue); entry.set_text(h); emit(h); }
            finally { busy = false; }
        };

        isModern ? btn.connect('notify::rgba', onPick) : btn.connect('color-set', onPick);

        entry.connect('changed', () => {
            if (busy) return;
            const t = entry.get_text().trim();
            if (/^#[0-9a-fA-F]{6}$/.test(t)) {
                busy = true;
                try { const r = new Gdk.RGBA(); if (r.parse(t)) { btn.set_rgba(r); emit(t); } }
                finally { busy = false; }
            }
        });

        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, valign: Gtk.Align.CENTER });
        box.append(entry);
        box.append(btn);
        row.add_suffix(box);
        row.set_activatable_widget(btn);

        return {
            row,
            getHex: () => entry.get_text().trim(),
            setHex: (v) => {
                if (!v) return; busy = true;
                try {
                    entry.set_text(v); row.set_subtitle(v);
                    const r = new Gdk.RGBA(); if (r.parse(v)) btn.set_rgba(r);
                } finally { busy = false; }
            },
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /** Creates a colored dot using CSS on a DrawingArea */
    _makeDot(hexColor, size = 18) {
        const dot = new Gtk.DrawingArea({ width_request: size, height_request: size, valign: Gtk.Align.CENTER });
        dot.set_draw_func((area, cr) => {
            const rgba = new Gdk.RGBA();
            rgba.parse(hexColor || '#888888');
            cr.arc(size / 2, size / 2, size / 2 - 1, 0, 2 * Math.PI);
            Gdk.cairo_set_source_rgba(cr, rgba);
            cr.fillPreserve();
            cr.setLineWidth(1);
            const border = new Gdk.RGBA();
            border.parse('rgba(0,0,0,0.25)');
            Gdk.cairo_set_source_rgba(cr, border);
            cr.stroke();
        });
        return dot;
    }

    /** Creates a row with an icon prefix for visual category separation */
    _sectionHeader(text) {
        const label = new Gtk.Label({
            label: `<span size="small" weight="bold" alpha="70%">${text}</span>`,
            use_markup: true,
            xalign: 0,
            margin_start: 6,
            margin_top: 4,
            margin_bottom: 4,
        });
        return label;
    }

    // =========================================================================
    // MAIN ENTRY POINT
    // =========================================================================

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(760, 820);
        window.set_search_enabled(true);

        let allPresets = this._loadAllPresets();
        let userPresets = this._loadUserPresets();
        let sortedNames = Object.keys(allPresets).sort((a, b) => a.localeCompare(b));

        // Forward references
        let loadPresetIntoDesigner = null;
        let pageDesigner = null;

        // =================================================================
        // PAGE 1 — CATÁLOGO
        // =================================================================
        const pageCatalog = new Adw.PreferencesPage({
            title: _('Catálogo'),
            icon_name: 'view-grid-symbolic',
            name: 'catalog',
        });
        window.add(pageCatalog);

        // --- Quick Settings favorites ---
        const groupFavs = new Adw.PreferencesGroup({
            title: _('Acceso Rápido (Panel Superior)'),
            description: _('Estos 5 temas aparecen con 1 clic en el menú de Quick Settings.'),
        });
        pageCatalog.add(groupFavs);

        const compactRow = new Adw.SwitchRow({
            title: _('Modo compacto'),
            subtitle: _('Muestra solo los 5 favoritos; oculta el catálogo completo del panel.'),
        });
        settings.bind('show-only-favorites', compactRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupFavs.add(compactRow);

        const favsExpander = new Adw.ExpanderRow({
            title: _('Elegir favoritos'),
            subtitle: _('Personaliza las 5 posiciones del panel rápido'),
            icon_name: 'starred-symbolic',
        });
        groupFavs.add(favsExpander);

        const defaults = ['Everforest Dark', 'Catppuccin Mocha', 'Tokyo Night', 'Nord Dark', 'Gruvbox Dark'];
        for (let i = 1; i <= 5; i++) {
            const key = `favorite-preset-${i}`;
            const model = new Gtk.StringList();
            sortedNames.forEach(n => model.append(n));
            const combo = new Adw.ComboRow({ title: _(`Posición ${i}`), model });
            const cur = settings.get_string(key) || defaults[i - 1] || sortedNames[0];
            const idx = sortedNames.indexOf(cur);
            if (idx >= 0) combo.selected = idx;
            combo.connect('notify::selected', () => {
                const sel = sortedNames[combo.selected];
                if (sel && sel !== settings.get_string(key)) settings.set_string(key, sel);
            });
            favsExpander.add_row(combo);
        }

        // --- Theme Library ---
        const groupLibrary = new Adw.PreferencesGroup({
            title: _('Biblioteca de Temas'),
            description: _('Aplica cualquier tema con 1 clic o cárgalo en el Diseñador para editarlo.'),
        });
        pageCatalog.add(groupLibrary);

        // Search bar
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: _('Buscar tema...'),
            margin_bottom: 6,
        });
        groupLibrary.add(searchEntry);

        // Container for the two expander rows
        const systemExpander = new Adw.ExpanderRow({
            title: _('Temas del Sistema'),
            subtitle: _('26 paletas calibradas incluidas'),
            icon_name: 'applications-graphics-symbolic',
            expanded: true,
        });
        groupLibrary.add(systemExpander);

        const customExpander = new Adw.ExpanderRow({
            title: _('Mis Temas Personalizados'),
            subtitle: _('Paletas guardadas por ti'),
            icon_name: 'document-edit-symbolic',
            expanded: true,
        });
        groupLibrary.add(customExpander);

        // "New theme" shortcut button in the custom expander header
        const newThemeBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Crear nuevo tema en el Diseñador'),
            css_classes: ['flat'],
        });
        customExpander.add_suffix(newThemeBtn);

        const makeThemeRow = (name, cfg, isCustom) => {
            const isDark = cfg.color_scheme === 'dark';
            const accent = cfg.accent_color || '#3584e4';
            const bg = cfg.window_bg || '#ffffff';

            const row = new Adw.ActionRow({
                title: name,
                subtitle: isDark ? _('Oscuro') : _('Claro'),
            });

            // Dual dot: accent + background
            const dotBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 3, valign: Gtk.Align.CENTER, margin_end: 4 });
            dotBox.append(this._makeDot(accent, 14));
            dotBox.append(this._makeDot(bg, 14));
            row.add_prefix(dotBox);

            // Edit
            const editBtn = new Gtk.Button({
                icon_name: 'document-edit-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Editar en el Diseñador'),
                css_classes: ['flat'],
            });
            editBtn.connect('clicked', () => {
                if (loadPresetIntoDesigner) {
                    loadPresetIntoDesigner(name, cfg);
                    window.set_visible_page(pageDesigner);
                }
            });
            row.add_suffix(editBtn);

            // Delete (custom only)
            if (isCustom) {
                const delBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    tooltip_text: _('Eliminar este preset personalizado'),
                    css_classes: ['flat', 'destructive-action'],
                });
                delBtn.connect('clicked', () => {
                    this._deleteUserPreset(name);
                    rebuildCatalog();
                });
                row.add_suffix(delBtn);
            }

            // Apply
            const applyBtn = new Gtk.Button({
                label: _('Aplicar'),
                valign: Gtk.Align.CENTER,
                css_classes: ['suggested-action', 'pill'],
                width_request: 90,
            });
            applyBtn.connect('clicked', () => {
                applyBtn.set_sensitive(false);
                applyBtn.set_label(_('…'));
                this._run(['apply', name], (ok) => {
                    applyBtn.set_sensitive(true);
                    applyBtn.set_label(ok ? _('✓ Listo') : _('✗ Error'));
                    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                        applyBtn.set_label(_('Aplicar'));
                        return GLib.SOURCE_REMOVE;
                    });
                });
            });
            row.add_suffix(applyBtn);

            return row;
        };

        // Maps to quickly remove rows on rebuild
        let systemRows = [];
        let customRows = [];

        const rebuildCatalog = () => {
            systemRows.forEach(r => systemExpander.remove(r));
            customRows.forEach(r => customExpander.remove(r));
            systemRows = [];
            customRows = [];

            allPresets = this._loadAllPresets();
            userPresets = this._loadUserPresets();
            sortedNames = Object.keys(allPresets).sort((a, b) => a.localeCompare(b));

            const filter = searchEntry.get_text().trim().toLowerCase();

            let systemCount = 0;
            let customCount = 0;

            for (const name of sortedNames) {
                if (filter && !name.toLowerCase().includes(filter)) continue;
                const cfg = allPresets[name] || {};
                const isCustom = Boolean(userPresets[name]);
                const row = makeThemeRow(name, cfg, isCustom);

                if (isCustom) {
                    customExpander.add_row(row);
                    customRows.push(row);
                    customCount++;
                } else {
                    systemExpander.add_row(row);
                    systemRows.push(row);
                    systemCount++;
                }
            }

            systemExpander.set_subtitle(
                filter ? `${systemCount} resultado(s)` : _('26 paletas calibradas incluidas')
            );
            customExpander.set_subtitle(
                customCount > 0
                    ? `${customCount} tema(s) personal(es)`
                    : filter ? _('Sin resultados') : _('Aún no has creado ningún tema personalizado')
            );
        };

        rebuildCatalog();
        searchEntry.connect('search-changed', () => rebuildCatalog());
        newThemeBtn.connect('clicked', () => {
            if (pageDesigner) window.set_visible_page(pageDesigner);
        });

        // =================================================================
        // PAGE 2 — DISEÑADOR
        // =================================================================
        pageDesigner = new Adw.PreferencesPage({
            title: _('Diseñador'),
            icon_name: 'applications-graphics-symbolic',
            name: 'designer',
        });
        window.add(pageDesigner);

        // --- Live preview banner ---
        const previewGroup = new Adw.PreferencesGroup({
            title: _('Vista Previa en Vivo'),
            description: _('Se actualiza al cambiar los colores.'),
        });
        pageDesigner.add(previewGroup);

        const previewBar = new Gtk.DrawingArea({
            height_request: 56,
            hexpand: true,
            margin_top: 4,
            margin_bottom: 8,
        });
        previewBar.set_draw_func((area, cr) => {
            const w = area.get_width();
            const h = area.get_height();
            const r = 10;

            const bg = new Gdk.RGBA(); bg.parse(previewState.window_bg);
            const header = new Gdk.RGBA(); header.parse(previewState.headerbar_bg);
            const accent = new Gdk.RGBA(); accent.parse(previewState.accent_color);
            const text = new Gdk.RGBA(); text.parse(previewState.text_primary);

            // Rounded rect header
            Gdk.cairo_set_source_rgba(cr, header);
            cr.moveTo(r, 0);
            cr.lineTo(w - r, 0);
            cr.arc(w - r, r, r, -Math.PI / 2, 0);
            cr.lineTo(w, h * 0.4);
            cr.lineTo(0, h * 0.4);
            cr.arc(r, r, r, Math.PI, 3 * Math.PI / 2);
            cr.closePath();
            cr.fill();

            // Window body
            Gdk.cairo_set_source_rgba(cr, bg);
            cr.rectangle(0, h * 0.4, w, h * 0.6);
            cr.fill();

            // Window controls (3 dots)
            const dotY = h * 0.2;
            const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
            dotColors.forEach((c, i) => {
                const dotRgba = new Gdk.RGBA(); dotRgba.parse(c);
                Gdk.cairo_set_source_rgba(cr, dotRgba);
                cr.arc(14 + i * 18, dotY, 5, 0, 2 * Math.PI);
                cr.fill();
            });

            // Accent button in header
            Gdk.cairo_set_source_rgba(cr, accent);
            const bx = w - 72, by = dotY - 7, bw = 60, bh = 14;
            const br = 7;
            cr.moveTo(bx + br, by);
            cr.lineTo(bx + bw - br, by);
            cr.arc(bx + bw - br, by + br, br, -Math.PI / 2, 0);
            cr.lineTo(bx + bw, by + bh - br);
            cr.arc(bx + bw - br, by + bh - br, br, 0, Math.PI / 2);
            cr.lineTo(bx + br, by + bh);
            cr.arc(bx + br, by + bh - br, br, Math.PI / 2, Math.PI);
            cr.lineTo(bx, by + br);
            cr.arc(bx + br, by + br, br, Math.PI, 3 * Math.PI / 2);
            cr.closePath();
            cr.fill();

            // Sample text lines in body
            Gdk.cairo_set_source_rgba(cr, text);
            cr.rectangle(14, h * 0.5, w * 0.3, 4);
            cr.fill();
            const textMuted = new Gdk.RGBA(); textMuted.parse(previewState.text_muted || previewState.text_primary);
            textMuted.alpha = 0.5;
            Gdk.cairo_set_source_rgba(cr, textMuted);
            cr.rectangle(14, h * 0.72, w * 0.2, 3);
            cr.fill();
        });

        const previewState = {
            accent_color: '#a7c080',
            window_bg: '#2d353b',
            headerbar_bg: '#232a2e',
            text_primary: '#d3c6aa',
            text_muted: '#859289',
        };

        const refreshPreview = () => { previewBar.queue_draw(); };

        previewGroup.add(previewBar);

        // Color swatch row under preview
        const swatchRow = new Adw.ActionRow({ title: _('Paleta activa') });
        const swatchBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, valign: Gtk.Align.CENTER });
        const swatchDots = {};
        const swatchColors = ['accent_color', 'window_bg', 'headerbar_bg', 'text_primary'];
        const swatchLabels = [_('Acento'), _('Ventana'), _('Barras'), _('Texto')];

        swatchColors.forEach((key, i) => {
            const dot = this._makeDot(previewState[key], 20);
            swatchDots[key] = dot;
            const col = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, valign: Gtk.Align.CENTER });
            const lbl = new Gtk.Label({ label: `<span size="x-small">${swatchLabels[i]}</span>`, use_markup: true });
            col.append(dot);
            col.append(lbl);
            swatchBox.append(col);
        });
        swatchRow.add_suffix(swatchBox);
        previewGroup.add(swatchRow);

        // --- Identity ---
        const groupIdentity = new Adw.PreferencesGroup({ title: _('Identidad del Tema') });
        pageDesigner.add(groupIdentity);

        const baseModel = new Gtk.StringList();
        sortedNames.forEach(n => baseModel.append(n));
        const baseCombo = new Adw.ComboRow({
            title: _('Cargar plantilla base'),
            subtitle: _('Importa todos los colores y métricas de un tema existente'),
            model: baseModel,
            icon_name: 'document-open-symbolic',
        });
        groupIdentity.add(baseCombo);

        const nameEntry = new Adw.EntryRow({ title: _('Nombre del tema'), text: 'Mi-Tema' });
        groupIdentity.add(nameEntry);

        const schemeModel = new Gtk.StringList();
        schemeModel.append(_('🌙 Oscuro'));
        schemeModel.append(_('☀️ Claro'));
        const schemeCombo = new Adw.ComboRow({ title: _('Modo de color'), model: schemeModel, selected: 0 });
        groupIdentity.add(schemeCombo);

        // --- Essential Colors ---
        const groupEssential = new Adw.PreferencesGroup({
            title: _('Colores Esenciales'),
            description: _('Los 4 tonos que definen la personalidad visual de tu escritorio.'),
        });
        pageDesigner.add(groupEssential);

        const cAccent = this._colorRow(_('Acento'), _('Botones, selección y controles activos'), '#a7c080', (v) => {
            previewState.accent_color = v; swatchDots['accent_color'].queue_draw(); refreshPreview();
        });
        const cWindow = this._colorRow(_('Fondo de Ventana'), _('Tono base de las ventanas y apps'), '#2d353b', (v) => {
            previewState.window_bg = v; swatchDots['window_bg'].queue_draw(); refreshPreview();
        });
        const cBars = this._colorRow(_('Barras y Paneles'), _('Headerbar, barra superior y sidebar de Nautilus'), '#232a2e', (v) => {
            previewState.headerbar_bg = v; swatchDots['headerbar_bg'].queue_draw(); refreshPreview();
        });
        const cText = this._colorRow(_('Texto Principal'), _('Texto de lectura en primer plano'), '#d3c6aa', (v) => {
            previewState.text_primary = v; swatchDots['text_primary'].queue_draw(); refreshPreview();
        });

        groupEssential.add(cAccent.row);
        groupEssential.add(cWindow.row);
        groupEssential.add(cBars.row);
        groupEssential.add(cText.row);

        // --- Advanced Colors (collapsed) ---
        const groupAdv = new Adw.PreferencesGroup();
        pageDesigner.add(groupAdv);

        const advExpander = new Adw.ExpanderRow({
            title: _('Colores Avanzados'),
            subtitle: _('Contraste, superficies elevadas y bordes — opcional'),
            icon_name: 'color-picker-symbolic',
        });
        groupAdv.add(advExpander);

        const cAccentFg = this._colorRow(_('Texto sobre Acento'), _('Contraste dentro de botones activos'), '#1a201c');
        const cAccentSec = this._colorRow(_('Acento Secundario'), _('Enlaces y efectos de selección'), '#83c092');
        const cSurface = this._colorRow(_('Superficie Elevada'), _('Tarjetas, menús y diálogos flotantes'), '#343f44');
        const cTextMuted = this._colorRow(_('Texto Secundario'), _('Subtítulos y etiquetas atenuadas'), '#859289', (v) => {
            previewState.text_muted = v; refreshPreview();
        });
        const cBorder = this._colorRow(_('Borde de Ventana'), _('Contorno sutil de ventanas'), '#3d484d');
        const cBorderActive = this._colorRow(_('Borde Activo'), _('Resaltado de la ventana enfocada'), '#475258');

        [cAccentFg, cAccentSec, cSurface, cTextMuted, cBorder, cBorderActive]
            .forEach(c => advExpander.add_row(c.row));

        // --- Geometry ---
        const groupGeometry = new Adw.PreferencesGroup({
            title: _('Forma y Botones de Ventana'),
            description: _('Redondeo de esquinas y disposición de los controles de ventana.'),
        });
        pageDesigner.add(groupGeometry);

        const winRadius = new Adw.SpinRow({
            title: _('Redondeo de ventanas'),
            subtitle: _('0 px = cuadrado  ·  32 px = muy redondeado'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 32, step_increment: 1, page_increment: 4, value: 12 }),
            icon_name: 'rounded-corners-symbolic',
        });
        groupGeometry.add(winRadius);

        const btnRadius = new Adw.SpinRow({
            title: _('Redondeo de botones'),
            subtitle: _('Aplica a botones e inputs (0 a 24 px)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 24, step_increment: 1, page_increment: 2, value: 8 }),
        });
        groupGeometry.add(btnRadius);

        const borderWidth = new Adw.SpinRow({
            title: _('Grosor de borde'),
            subtitle: _('0 = sin contorno  ·  4 px = borde marcado'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 4, step_increment: 1, page_increment: 1, value: 1 }),
        });
        groupGeometry.add(borderWidth);

        const layoutModel = new Gtk.StringList();
        [
            _('Derecha — GNOME estándar   ✗ □ ×'),
            _('Izquierda — Estilo macOS  ● ● ●'),
            _('Derecha compacto — Solo Cerrar  ×'),
            _('Izquierda compacto — Solo Cerrar  ×'),
        ].forEach(l => layoutModel.append(l));
        const layoutValues = ['right', 'left', 'right-compact', 'left-compact'];
        const layoutCombo = new Adw.ComboRow({
            title: _('Botones de ventana'),
            subtitle: _('Posición de Minimizar / Maximizar / Cerrar'),
            model: layoutModel,
            selected: 0,
        });
        groupGeometry.add(layoutCombo);

        const controlModel = new Gtk.StringList();
        controlModel.append(_('Traffic Lights — Semáforo macOS con hover'));
        controlModel.append(_('Adwaita — Monocromático discreto'));
        const controlCombo = new Adw.ComboRow({
            title: _('Estilo de controles'),
            model: controlModel,
            selected: 0,
        });
        groupGeometry.add(controlCombo);

        // --- loadPresetIntoDesigner ---
        loadPresetIntoDesigner = (name, cfg) => {
            if (!cfg) return;
            nameEntry.set_text(name.endsWith('-Custom') || userPresets[name] ? name : `${name}-Custom`);
            schemeCombo.set_selected(cfg.color_scheme === 'light' ? 1 : 0);

            if (cfg.accent_color) { cAccent.setHex(cfg.accent_color); previewState.accent_color = cfg.accent_color; }
            if (cfg.window_bg) { cWindow.setHex(cfg.window_bg); previewState.window_bg = cfg.window_bg; }
            if (cfg.headerbar_bg) { cBars.setHex(cfg.headerbar_bg); previewState.headerbar_bg = cfg.headerbar_bg; }
            if (cfg.text_primary) { cText.setHex(cfg.text_primary); previewState.text_primary = cfg.text_primary; }
            if (cfg.accent_fg) cAccentFg.setHex(cfg.accent_fg);
            if (cfg.accent_secondary) cAccentSec.setHex(cfg.accent_secondary);
            if (cfg.surface_elevated) cSurface.setHex(cfg.surface_elevated);
            if (cfg.text_muted) { cTextMuted.setHex(cfg.text_muted); previewState.text_muted = cfg.text_muted; }
            if (cfg.border_color) cBorder.setHex(cfg.border_color);
            if (cfg.border_active) cBorderActive.setHex(cfg.border_active);
            if (typeof cfg.window_radius === 'number') winRadius.set_value(cfg.window_radius);
            if (typeof cfg.button_radius === 'number') btnRadius.set_value(cfg.button_radius);
            if (typeof cfg.border_width === 'number') borderWidth.set_value(cfg.border_width);
            if (cfg.button_layout) {
                const i = layoutValues.indexOf(cfg.button_layout);
                if (i >= 0) layoutCombo.set_selected(i);
            }
            if (cfg.window_controls_style) {
                controlCombo.set_selected(cfg.window_controls_style === 'adwaita' ? 1 : 0);
            }

            swatchColors.forEach(k => swatchDots[k]?.queue_draw());
            refreshPreview();
        };

        baseCombo.connect('notify::selected', () => {
            const name = sortedNames[baseCombo.selected];
            if (name) loadPresetIntoDesigner(name, allPresets[name]);
        });

        // --- Save / Apply actions ---
        const groupActions = new Adw.PreferencesGroup({ title: _('Guardar Tema') });
        pageDesigner.add(groupActions);

        const buildConfig = () => ({
            theme_name: nameEntry.get_text().trim() || 'Custom-Theme',
            color_scheme: schemeCombo.selected === 1 ? 'light' : 'dark',
            accent_color: cAccent.getHex(),
            accent_fg: cAccentFg.getHex(),
            accent_secondary: cAccentSec.getHex(),
            window_bg: cWindow.getHex(),
            sidebar_bg: cBars.getHex(),
            surface_elevated: cSurface.getHex(),
            headerbar_bg: cBars.getHex(),
            text_primary: cText.getHex(),
            text_muted: cTextMuted.getHex(),
            border_color: cBorder.getHex(),
            border_active: cBorderActive.getHex(),
            window_radius: Math.round(winRadius.get_value()),
            button_radius: Math.round(btnRadius.get_value()),
            border_width: Math.round(borderWidth.get_value()),
            button_layout: layoutValues[layoutCombo.selected] || 'right',
            window_controls_style: controlCombo.selected === 1 ? 'adwaita' : 'traffic-hover',
            wallpaper_style: settings.get_string('wallpaper-style') || 'abstract_waves',
        });

        // Save Only row
        const saveRow = new Adw.ActionRow({
            title: _('Guardar en Biblioteca'),
            subtitle: _('Añade el tema a "Mis Temas" sin aplicarlo todavía'),
        });
        const saveBtn = new Gtk.Button({
            label: _('Guardar'),
            valign: Gtk.Align.CENTER,
            css_classes: ['pill'],
            width_request: 110,
        });
        saveBtn.connect('clicked', () => {
            const cfg = buildConfig();
            const map = this._loadUserPresets();
            map[cfg.theme_name] = cfg;
            this._saveUserPresets(map);
            saveBtn.set_label(_('¡Guardado ✓'));
            rebuildCatalog();
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                saveBtn.set_label(_('Guardar'));
                return GLib.SOURCE_REMOVE;
            });
        });
        saveRow.add_suffix(saveBtn);
        groupActions.add(saveRow);

        // Save & Apply row
        const applyRow = new Adw.ActionRow({
            title: _('Guardar y Aplicar'),
            subtitle: _('Compila el tema (~300 ms) y lo activa en todo el escritorio en caliente'),
        });
        const applyBtn2 = new Gtk.Button({
            label: _('Aplicar'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action', 'pill'],
            width_request: 110,
        });
        applyBtn2.connect('clicked', () => {
            applyBtn2.set_sensitive(false);
            applyBtn2.set_label(_('Compilando…'));
            const cfg = buildConfig();
            this._run(['custom', '--save', '--json', JSON.stringify(cfg)], (ok) => {
                applyBtn2.set_sensitive(true);
                applyBtn2.set_label(ok ? _('¡Aplicado ✓') : _('✗ Error'));
                rebuildCatalog();
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                    applyBtn2.set_label(_('Aplicar'));
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
        applyRow.add_suffix(applyBtn2);
        groupActions.add(applyRow);

        // =================================================================
        // PAGE 3 — SISTEMA
        // =================================================================
        const pageSystem = new Adw.PreferencesPage({
            title: _('Sistema'),
            icon_name: 'emblem-system-symbolic',
            name: 'system',
        });
        window.add(pageSystem);

        // Wallpaper
        const groupWP = new Adw.PreferencesGroup({
            title: _('Fondo de Escritorio (4K SVG)'),
            description: _('Genera automáticamente un wallpaper vectorial que armoniza con la paleta activa.'),
        });
        pageSystem.add(groupWP);

        const wpSwitch = new Adw.SwitchRow({
            title: _('Generar fondo coordinado'),
            subtitle: _('Aplica un SVG 4K generado algorítmicamente al cambiar de tema.'),
        });
        settings.bind('apply-wallpaper', wpSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupWP.add(wpSwitch);

        const wpModel = new Gtk.StringList();
        [_('Olas Abstractas'), _('Aurora Boreal'), _('Geométrico Cristalino')].forEach(s => wpModel.append(s));
        const wpStyles = ['abstract_waves', 'aurora', 'geometric'];
        const wpStyleCombo = new Adw.ComboRow({ title: _('Estilo de composición'), model: wpModel });
        const curWp = settings.get_string('wallpaper-style') || 'abstract_waves';
        wpStyleCombo.selected = Math.max(0, wpStyles.indexOf(curWp));
        wpStyleCombo.connect('notify::selected', () => {
            const s = wpStyles[wpStyleCombo.selected];
            if (s) settings.set_string('wallpaper-style', s);
        });
        groupWP.add(wpStyleCombo);

        // Apps
        const groupApps = new Adw.PreferencesGroup({
            title: _('Integración con Aplicaciones'),
            description: _('Extiende el tema a Firefox, Flatpak y el escritorio completo.'),
        });
        pageSystem.add(groupApps);

        const ffSwitch = new Adw.SwitchRow({
            title: _('Firefox / LibreWolf / Waterfox'),
            subtitle: _('Inyecta userChrome.css coordinado en todos los perfiles detectados (XDG, Flatpak, Snap).'),
        });
        settings.bind('apply-firefox', ffSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(ffSwitch);

        const fpSwitch = new Adw.SwitchRow({
            title: _('Aplicaciones Flatpak'),
            subtitle: _('Propaga la hoja de estilos GTK4 a los contenedores en ~/.var/app/.'),
        });
        settings.bind('apply-flatpak', fpSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(fpSwitch);

        const notifSwitch = new Adw.SwitchRow({
            title: _('Notificaciones toast'),
            subtitle: _('Muestra una notificación de escritorio al compilar y aplicar un tema.'),
        });
        settings.bind('show-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupApps.add(notifSwitch);

        // Maintenance
        const groupMaint = new Adw.PreferencesGroup({
            title: _('Mantenimiento'),
            description: _('Restaura GNOME a su estado original de fábrica o accede al repositorio.'),
        });
        pageSystem.add(groupMaint);

        const resetRow = new Adw.ActionRow({
            title: _('Restablecer a Adwaita original'),
            subtitle: _('Elimina temas, overrides de GTK4/GTK3/Shell y fondos personalizados.'),
        });
        const resetBtn = new Gtk.Button({
            label: _('Restablecer'),
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action', 'pill'],
        });
        resetBtn.connect('clicked', () => {
            resetBtn.set_sensitive(false);
            resetBtn.set_label(_('Restableciendo…'));
            this._run(['reset'], (ok) => {
                resetBtn.set_sensitive(true);
                resetBtn.set_label(ok ? _('✓ Listo') : _('✗ Error'));
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    resetBtn.set_label(_('Restablecer'));
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
        resetRow.add_suffix(resetBtn);
        groupMaint.add(resetRow);

        const ghRow = new Adw.ActionRow({
            title: _('Ver en GitHub'),
            subtitle: 'github.com/angelaguayo/gnome-quick-themer',
            activatable: true,
        });
        ghRow.add_suffix(new Gtk.Image({ icon_name: 'external-link-symbolic', valign: Gtk.Align.CENTER }));
        ghRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/angelaguayo/gnome-quick-themer', null);
        });
        groupMaint.add(ghRow);
    }
}
