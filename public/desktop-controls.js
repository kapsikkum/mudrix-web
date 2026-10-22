/* Window controls for the frameless Windows/Linux desktop shell (Tauri).
 *
 * Deliberately independent of the React app: this runs before the bundle loads and the buttons live
 * outside #root, above every overlay, loading screen and error screen, so the window can always be
 * minimised, maximised or closed. It talks to Tauri's built-in window commands directly. */
(function () {
  var internals = window.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== 'function') return;
  if (/Mac|iPhone|iPad|Android/.test(navigator.platform || navigator.userAgent)) return;

  var label =
    (internals.metadata &&
      internals.metadata.currentWindow &&
      internals.metadata.currentWindow.label) ||
    'main';
  function call(cmd) {
    return internals.invoke('plugin:window|' + cmd, { label: label });
  }

  var icons = {
    minimize: '<svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg>',
    maximize: '<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9"/></svg>',
    restore:
      '<svg viewBox="0 0 12 12"><rect x="1.5" y="3.5" width="7" height="7"/><path d="M3.5 3.5v-2h7v7h-2"/></svg>',
    close: '<svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg>',
  };
  var titles = { minimize: 'Minimize', maximize: 'Maximize', restore: 'Restore', close: 'Close' };

  var bar = document.createElement('div');
  bar.id = 'mudrix-window-controls';
  bar.innerHTML =
    '<button type="button" data-act="minimize"></button>' +
    '<button type="button" data-act="maximize"></button>' +
    '<button type="button" data-act="close" class="close"></button>';
  var buttons = {};
  Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
    buttons[b.getAttribute('data-act')] = b;
  });

  // Styled through the CSSOM (element.style), not an injected <style> or style attribute: the
  // desktop CSP carries style hashes, which makes browsers drop runtime stylesheets.
  function setStyle(el, props) {
    Object.keys(props).forEach(function (k) {
      el.style.setProperty(k, props[k], 'important');
    });
  }
  function styleBar() {
    setStyle(bar, {
      position: 'fixed',
      top: '0',
      right: '0',
      height: '40px',
      display: 'flex',
      'z-index': '2147483647',
      '-webkit-app-region': 'no-drag',
      color: 'inherit',
      'user-select': 'none',
    });
    Object.keys(buttons).forEach(function (name) {
      var b = buttons[name];
      var hover = name === 'close' ? '#e81123' : 'rgba(128,128,128,.28)';
      setStyle(b, {
        'box-sizing': 'border-box',
        width: '46px',
        height: '40px',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        cursor: 'default',
        color: 'inherit',
        background: 'transparent',
        border: '0',
        padding: '0',
        opacity: '.85',
        '-webkit-app-region': 'no-drag',
      });
      b.addEventListener('mouseenter', function () {
        setStyle(b, { opacity: '1', background: hover });
        if (name === 'close') setStyle(b, { color: '#fff' });
      });
      b.addEventListener('mouseleave', function () {
        setStyle(b, { opacity: '.85', background: 'transparent', color: 'inherit' });
      });
    });
  }
  function paintIcon(button, svg) {
    button.innerHTML = svg;
    var el = button.firstChild;
    setStyle(el, {
      width: '12px',
      height: '12px',
      stroke: 'currentColor',
      fill: 'none',
      'stroke-width': '1.2',
    });
  }

  function paint(maximized) {
    paintIcon(buttons.minimize, icons.minimize);
    paintIcon(buttons.close, icons.close);
    paintIcon(buttons.maximize, maximized ? icons.restore : icons.maximize);
    var key = maximized ? 'restore' : 'maximize';
    var t = window.__mudrixWindowControlLabels || titles;
    buttons.minimize.title = buttons.minimize.ariaLabel = t.minimize || titles.minimize;
    buttons.maximize.title = buttons.maximize.ariaLabel = t[key] || titles[key];
    buttons.close.title = buttons.close.ariaLabel = t.close || titles.close;
  }
  function refresh() {
    call('is_maximized').then(paint, function () {
      paint(false);
    });
  }
  window.__mudrixRefreshWindowControls = refresh;

  buttons.minimize.addEventListener('click', function () {
    call('minimize');
  });
  buttons.maximize.addEventListener('click', function () {
    call('toggle_maximize').then(refresh, refresh);
  });
  buttons.close.addEventListener('click', function () {
    call('close');
  });
  window.addEventListener('resize', refresh);

  paint(false);
  styleBar();
  document.documentElement.classList.add('tauri-controls');
  (document.body || document.documentElement).appendChild(bar);
  refresh();
})();
