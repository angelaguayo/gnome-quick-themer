/**
 * GNOME Quick Themer — Quick Settings Extension
 * Compatible with GNOME Shell 45–51+ (ESM architecture)
 *
 * Provides a native Quick Settings toggle button with a rich dropdown
 * featuring live color swatches, 1-click theme switching, non-blocking
 * async SCSS compilation, and instant hot-reload.
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const DEFAULT_FAVORITES = [
    'Everforest Dark',
    'Catppuccin Mocha',
    'Tokyo Night',
    'Nord Dark',
    'Gruvbox Dark',
];

/**
 * Scrollable popup menu section to accommodate presets cleanly without overflowing screen.
 */
class PopupScrollMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        this.actor = new St.ScrollView({
            style_class: 'quick-themer-scroll-section',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            child: this.box,
        });
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
    }
}

/**
 * Main Quick Settings Toggle Item
 */
const QuickThemerToggle = GObject.registerClass(
class QuickThemerToggle extends QuickSettings.QuickMenuToggle {
    _init(extension, settings) {
        super._init({
            title: _('Temas'),
            subtitle: _('Cargando...'),
            iconName: 'preferences-desktop-theme-symbolic',
            toggleMode: false,
            menuButtonAccessibleName: _('Abrir catálogo de temas'),
        });

        this._extension = extension;
        this._settings = settings;
        this._isApplying = false;
        this._presets = {};
        this._menuItems = new Map();
        this._activePresetName = null;

        // Submenu header (matches native GNOME Shell submenus like Network and Bluetooth)
        this.menu.setHeader('preferences-desktop-theme-symbolic', _('Tema de Interfaz'));
        this._setupHeaderButtons();

        // Preset list container section (scrollable)
        this._presetSection = new PopupScrollMenuSection();
        this.menu.addMenuItem(this._presetSection);

        // Actions container section
        this._actionsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._actionsSection);

        // Clicking toggle body opens the menu
        this.connect('clicked', () => {
            this.menu.open();
        });

        // Re-read presets whenever the menu is opened
        this.menu.connectObject('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._loadPresets();
            }
        }, this);

        // Listen for GSettings changes from Preferences Window
        if (this._settings) {
            this._extensionSettingsChangedId = this._settings.connect('changed', () => {
                this._rebuildPresetsMenu();
                this._rebuildActionsMenu();
            });
        }

        // Watch GNOME settings for GTK theme changes
        this._interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        this._interfaceSettingsChangedId = this._interfaceSettings.connect('changed::gtk-theme', () => {
            this._syncActiveTheme();
        });

        // Initial load
        this._loadPresets();
        this._syncActiveTheme();
    }

    /**
     * Resolves the project root directory.
     */
    _findProjectDir() {
        const envDir = GLib.getenv('GNOME_QUICK_THEMER_DIR');
        if (envDir && GLib.file_test(envDir, GLib.FileTest.IS_DIR)) {
            return envDir;
        }

        const extPath = this._extension ? this._extension.path : null;
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
        logError(new Error('[QuickThemer] Project directory not found. Re-install with ./install.sh'));
        return null;
    }

    /**
     * Finds the python3 binary.
     */
    _getPythonBin() {
        return 'python3';
    }

    /**
     * Reads presets from presets.json and custom presets.
     */
    _loadPresets() {
        const projectDir = this._findProjectDir();
        let loadedPresets = {};

        // 1. Bundled presets
        const bundledPresetsPath = GLib.build_filenamev([projectDir, 'presets.json']);
        try {
            const [ok, contents] = GLib.file_get_contents(bundledPresetsPath);
            if (ok) {
                loadedPresets = JSON.parse(new TextDecoder().decode(contents));
            }
        } catch (err) {
            console.error(`[QuickThemer] Error al leer presets.json: ${err.message}`);
        }

        // 2. Custom user presets (~/.config/gnome-quick-themer/custom_presets.json)
        const userCustomPath = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-quick-themer', 'custom_presets.json']);
        try {
            if (GLib.file_test(userCustomPath, GLib.FileTest.EXISTS)) {
                const [okUser, contentsUser] = GLib.file_get_contents(userCustomPath);
                if (okUser) {
                    const userPresets = JSON.parse(new TextDecoder().decode(contentsUser));
                    Object.assign(loadedPresets, userPresets);
                }
            }
        } catch (err) {
            console.warn(`[QuickThemer] Custom presets: ${err.message}`);
        }

        this._presets = loadedPresets;
        this._rebuildPresetsMenu();
        this._rebuildActionsMenu();
        this._syncActiveTheme();
    }

    /**
     * Returns array of configured favorite preset names.
     */
    _getFavoritePresetNames() {
        const favorites = [];
        if (this._settings) {
            for (let i = 1; i <= 5; i++) {
                const fav = this._settings.get_string(`favorite-preset-${i}`);
                if (fav && !favorites.includes(fav)) {
                    favorites.push(fav);
                }
            }
        }
        if (favorites.length === 0) {
            return [...DEFAULT_FAVORITES];
        }
        return favorites;
    }

    /**
     * Adds the single standard GNOME Settings gear icon to the submenu header.
     */
    _setupHeaderButtons() {
        const settingsBtn = new St.Button({
            style_class: 'button icon-button',
            child: new St.Icon({
                icon_name: 'emblem-system-symbolic',
                style_class: 'popup-menu-icon',
            }),
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
            accessible_name: _('Ajustes de Tema'),
        });
        settingsBtn.connect('clicked', () => {
            this.menu.close();
            this._extension.openPreferences();
        });

        if (typeof this.menu.addHeaderSuffix === 'function') {
            this.menu.addHeaderSuffix(settingsBtn);
        } else if (this.menu._header) {
            const headerLayout = this.menu._header.layout_manager;
            if (headerLayout && this.menu._headerSpacer) {
                const side = this.menu.actor.text_direction === Clutter.TextDirection.RTL
                    ? Clutter.GridPosition.LEFT
                    : Clutter.GridPosition.RIGHT;
                headerLayout.attach_next_to(settingsBtn, this.menu._headerSpacer, side, 1, 1);
            }
        }
    }

    /**
     * Clears and rebuilds the preset list inside the menu.
     */
    _rebuildPresetsMenu() {
        this._presetSection.removeAll();
        this._menuItems.clear();

        const showOnlyFavorites = this._settings ? this._settings.get_boolean('show-only-favorites') : true;
        const favorites = this._getFavoritePresetNames();
        const allPresetNames = Object.keys(this._presets).sort();

        if (showOnlyFavorites) {
            const displayPresets = [...favorites];
            // Ensure the currently active preset is visible even if not in top 5 favorites
            if (this._activePresetName && !displayPresets.includes(this._activePresetName) && this._presets[this._activePresetName]) {
                displayPresets.push(this._activePresetName);
            }
            for (const name of displayPresets) {
                this._addPresetMenuItem(name, this._presetSection);
            }
        } else {
            for (const name of favorites) {
                this._addPresetMenuItem(name, this._presetSection);
            }

            this._presetSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (const name of allPresetNames) {
                if (!favorites.includes(name)) {
                    this._addPresetMenuItem(name, this._presetSection);
                }
            }
        }

        this._updateOrnaments();
    }

    /**
     * Creates and attaches a single preset menu item with a sleek native accent dot.
     */
    _addPresetMenuItem(name, container) {
        const cfg = this._presets[name] || {};
        const isDark = (cfg.color_scheme === 'dark');
        const iconName = isDark ? 'weather-clear-night-symbolic' : 'weather-clear-symbolic';

        const item = new PopupMenu.PopupImageMenuItem(name, iconName, {
            style_class: 'quick-themer-preset-item',
        });

        if (item.label) {
            item.label.x_expand = true;
            item.label.x_align = Clutter.ActorAlign.START;
        }

        const accentHex = cfg.accent_color || '#3584e4';
        const dot = new St.Widget({
            style_class: 'quick-themer-accent-dot',
            style: `background-color: ${accentHex};`,
        });

        const ornament = item._ornamentIcon || item._ornamentLabel;
        if (ornament) {
            item.insert_child_below(dot, ornament);
        } else {
            item.add_child(dot);
        }

        item.connect('activate', () => {
            this._applyPreset(name);
        });

        this._menuItems.set(name, item);
        container.addMenuItem(item);
    }

    /**
     * Rebuilds utility action items conforming to GNOME Shell submenu HIG.
     */
    _rebuildActionsMenu() {
        this._actionsSection.removeAll();
        this._actionsSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Action: Preferences Studio
        const prefsItem = new PopupMenu.PopupImageMenuItem(
            _('Ajustes de Tema...'),
            'emblem-system-symbolic'
        );
        prefsItem.connect('activate', () => {
            this.menu.close();
            this._extension.openPreferences();
        });
        this._actionsSection.addMenuItem(prefsItem);

        // Action: Reset GNOME desktop to Adwaita
        const resetItem = new PopupMenu.PopupImageMenuItem(
            _('Restablecer a Adwaita'),
            'edit-undo-symbolic'
        );
        resetItem.connect('activate', () => {
            this._resetToDefault();
        });
        this._actionsSection.addMenuItem(resetItem);
    }

    /**
     * Synchronizes active theme checkmarks.
     */
    _syncActiveTheme() {
        if (!this._interfaceSettings) return;

        const currentGtk = this._interfaceSettings.get_string('gtk-theme') || '';
        const normCurrent = currentGtk.toLowerCase().replace(/[-_ ]/g, '');

        let matchedName = null;
        for (const name of Object.keys(this._presets)) {
            const normPreset = name.toLowerCase().replace(/[-_ ]/g, '');
            if (normCurrent.includes(normPreset) || normPreset.includes(normCurrent)) {
                matchedName = name;
                break;
            }
        }

        if (matchedName) {
            this._activePresetName = matchedName;
            this.subtitle = matchedName;
        } else if (currentGtk.toLowerCase().includes('adwaita')) {
            this._activePresetName = null;
            this.subtitle = 'Adwaita';
        } else if (currentGtk) {
            this.subtitle = currentGtk;
        }

        this._updateOrnaments();
    }

    /**
     * Updates checkmarks for active presets.
     */
    _updateOrnaments() {
        for (const [name, item] of this._menuItems) {
            const isCurrent = (name === this._activePresetName);
            item.setOrnament(isCurrent ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }
    }

    /**
     * Asynchronously compiles and applies preset via quick-themer CLI without blocking.
     */
    _applyPreset(presetName) {
        if (this._isApplying) return;

        this._isApplying = true;
        const prevSubtitle = this.subtitle;
        this.subtitle = `${_('Aplicando')} ${presetName}...`;

        const projectDir = this._findProjectDir();
        const pythonBin = this._getPythonBin();
        const cliPath = GLib.build_filenamev([projectDir, 'quick-themer']);

        const args = [pythonBin, cliPath, 'apply', presetName];

        // Read integrations settings
        if (this._settings) {
            if (!this._settings.get_boolean('apply-wallpaper')) {
                args.push('--no-wallpaper');
            } else {
                const wpStyle = this._settings.get_string('wallpaper-style') || 'abstract_waves';
                args.push('--wallpaper-style', wpStyle);
            }

            if (!this._settings.get_boolean('apply-firefox')) {
                args.push('--no-firefox');
            }
            if (!this._settings.get_boolean('apply-flatpak')) {
                args.push('--no-flatpak');
            }

            const winRadius = this._settings.get_int('window-radius');
            if (winRadius > 0) {
                args.push('--window-radius', winRadius.toString());
            }

            const btnRadius = this._settings.get_int('button-radius');
            if (btnRadius > 0) {
                args.push('--button-radius', btnRadius.toString());
            }

            const borderWidth = this._settings.get_int('border-width');
            if (borderWidth >= 0) {
                args.push('--border-width', borderWidth.toString());
            }

            const btnLayout = this._settings.get_string('button-layout');
            if (btnLayout) {
                args.push('--button-layout', btnLayout);
            }
        }

        try {
            const proc = new Gio.Subprocess({
                argv: args,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (source, res) => {
                this._isApplying = false;
                try {
                    const [ok, stdout, stderr] = source.communicate_utf8_finish(res);
                    const exitStatus = source.get_exit_status();

                    if (exitStatus === 0) {
                        this._activePresetName = presetName;
                        this.subtitle = presetName;
                        this._updateOrnaments();

                        const notifyEnabled = this._settings ? this._settings.get_boolean('show-notifications') : true;
                        if (notifyEnabled) {
                            Main.notify('GNOME Quick Themer', `${_('Tema aplicado')}: ${presetName}`);
                        }
                    } else {
                        console.error(`[QuickThemer] Error al aplicar (${exitStatus}): ${stderr || stdout}`);
                        this.subtitle = _('Error al aplicar');
                        Main.notifyError('GNOME Quick Themer', `${_('Error al aplicar')}: ${presetName}`);
                    }
                } catch (finishErr) {
                    console.error(`[QuickThemer] Error en Subprocess: ${finishErr.message}`);
                    this.subtitle = prevSubtitle;
                }
            });
        } catch (procErr) {
            this._isApplying = false;
            console.error(`[QuickThemer] No se pudo lanzar subproceso: ${procErr.message}`);
            this.subtitle = prevSubtitle;
        }
    }

    /**
     * Asynchronously resets GNOME Desktop to factory Adwaita.
     */
    _resetToDefault() {
        if (this._isApplying) return;

        this._isApplying = true;
        this.subtitle = _('Restableciendo...');

        const projectDir = this._findProjectDir();
        const pythonBin = this._getPythonBin();
        const cliPath = GLib.build_filenamev([projectDir, 'quick-themer']);

        try {
            const proc = new Gio.Subprocess({
                argv: [pythonBin, cliPath, 'reset'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (source, res) => {
                this._isApplying = false;
                try {
                    source.communicate_utf8_finish(res);
                    if (source.get_exit_status() === 0) {
                        this._activePresetName = null;
                        this.subtitle = 'Adwaita';
                        this._updateOrnaments();

                        const notifyEnabled = this._settings ? this._settings.get_boolean('show-notifications') : true;
                        if (notifyEnabled) {
                            Main.notify('GNOME Quick Themer', _('Escritorio restablecido a valores de fábrica.'));
                        }
                    } else {
                        this.subtitle = _('Error al restablecer');
                    }
                } catch (finishErr) {
                    console.error(`[QuickThemer] Error en reset finish: ${finishErr.message}`);
                    this.subtitle = 'Adwaita';
                }
            });
        } catch (err) {
            this._isApplying = false;
            console.error(`[QuickThemer] Error al ejecutar reset: ${err.message}`);
            this.subtitle = 'Adwaita';
        }
    }

    destroy() {
        if (this._extensionSettingsChangedId && this._settings) {
            this._settings.disconnect(this._extensionSettingsChangedId);
            this._extensionSettingsChangedId = null;
        }

        if (this._interfaceSettingsChangedId && this._interfaceSettings) {
            this._interfaceSettings.disconnect(this._interfaceSettingsChangedId);
            this._interfaceSettingsChangedId = null;
        }

        this.menu.disconnectObject(this);
        super.destroy();
    }
});

/**
 * Quick Settings System Indicator Container
 */
const QuickThemerIndicator = GObject.registerClass(
class QuickThemerIndicator extends QuickSettings.SystemIndicator {
    _init(extension, settings) {
        super._init();

        this._toggle = new QuickThemerToggle(extension, settings);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        this.quickSettingsItems = [];
        super.destroy();
    }
});

export default class QuickThemerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new QuickThemerIndicator(this, this._settings);

        // Add indicator and toggle to Quick Settings
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}

