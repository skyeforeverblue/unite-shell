const Lang     = imports.lang;
const Mainloop = imports.mainloop;
const GLib     = imports.gi.GLib;
const Meta     = imports.gi.Meta;
const Util     = imports.misc.util;
const Unite    = imports.misc.extensionUtils.getCurrentExtension();
const Base     = Unite.imports.module.BaseModule;
const Helpers  = Unite.imports.helpers;
const STYLES   = GLib.get_user_config_dir() + '/gtk-3.0/gtk.css';

var WindowDecoration = new Lang.Class({
  Name: 'Unite.WindowDecoration',
  Extends: Base,
  EnableKey: 'hide-window-titlebars',
  DisableValue: 'never',

  _onActivate() {
    this._signals.connect(global.display, 'notify::focus-window', this._updateTitlebar);
    this._signals.connect(global.window_manager, 'size-change', this._updateTitlebar);

    this._addUserStyles();
    this._undecorateWindows();
  },

  _onDeactivate() {
    this._removeUserStyles();
    this._decorateWindows();
  },

  _getWindowXID(win) {
    win._windowXID = win._windowXID || win.get_description().match(/0x[0-9a-f]+/)[0];
    return win._windowXID;
  },

  _getAllWindows() {
    let windows = global.get_window_actors().map(win => win.meta_window);
    return windows.filter(win => Helpers.isValidWindow(win));
  },

  _toggleDecorations(win, hide) {
    let winId = this._getWindowXID(win);
    if (!winId) return;

    let prop  = '_GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED';
    let value = hide ? '0x1' : '0x0';

    Util.spawn(['xprop', '-id', winId, '-f', prop, '32c', '-set', prop, value]);
  },

  _resetDecorations(win) {
    this._toggleDecorations(win, false);

    delete win._decorationOFF;
    delete win._windowXID;
  },

  _updateTitlebar() {
    let window = global.display.focus_window;
    let toggle = window;

    if (this._enabled == 'both') {
      toggle = window && window.get_maximized() !== 0;
    }

    if (toggle && Helpers.isValidWindow(window)) {
      this._toggleTitlebar(window);
    }
  },

  _showTitlebar(win) {
    if (win && win._decorationOFF) {
      win._decorationOFF = false;
      this._toggleDecorations(win, false);
    }
  },

  _hideTitlebar(win) {
    if (win && !win._decorationOFF && win.decorated) {
      win._decorationOFF = true;
      this._toggleDecorations(win, true);
    }
  },

  _toggleTitlebar(win) {
    if (Helpers.isMaximized(win, this._enabled))
      this._hideTitlebar(win);
    else
      this._showTitlebar(win);
  },

  _getUserStyles() {
    if (!GLib.file_test(STYLES, GLib.FileTest.EXISTS)) return '';

    let file  = GLib.file_get_contents(STYLES);
    let style = String.fromCharCode.apply(null, file[1]);

    return style.replace(/@import.*unite@hardpixel\.eu.*css['"]\);\n/g, '');
  },

  _addUserStyles() {
    let buttonsPosition = Helpers.getWindowButtons('position');
    if (!buttonsPosition) return;

    let content   = this._getUserStyles();
    let filePath  = `${Unite.path}/styles/buttons-${buttonsPosition}`;
    let maximized = `@import url('${filePath}.css');\n`;
    let tiled     = `@import url('${filePath}-tiled.css');\n`;

    if (this._enabled == 'both')
      content = maximized + tiled + content;

    if (this._enabled == 'maximized')
      content = maximized + content;

    if (this._enabled == 'tiled')
      content = tiled + content;

    GLib.file_set_contents(STYLES, content);
  },

  _removeUserStyles() {
    let content = this._getUserStyles();
    GLib.file_set_contents(STYLES, content);
  },

  _undecorateWindows() {
    let windows = this._getAllWindows();

    windows.forEach(Lang.bind(this, function (win) {
      Mainloop.idle_add(Lang.bind(this, function () {
        this._toggleTitlebar(win);
      }));
    }));
  },

  _decorateWindows() {
    let windows = this._getAllWindows();

    windows.forEach(Lang.bind(this, function (win) {
      Mainloop.idle_add(Lang.bind(this, function () {
        this._resetDecorations(win);
      }));
    }));
  }
});
