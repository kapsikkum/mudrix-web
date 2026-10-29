(function () {
  // Same name as POPOUT_CHANNEL in src/app/features/calls/CallPopoutWindow.tsx.
  var CHANNEL = 'mudrix-call-popout';
  var params = new URLSearchParams(location.search);
  var $ = function (id) {
    return document.getElementById(id);
  };
  var labels = {
    mute: params.get('mute') || 'Mute',
    unmute: params.get('unmute') || 'Unmute',
    back: params.get('back') || 'Return to call',
    hangup: params.get('hangup') || 'Hang up',
  };
  if (params.get('novideo')) $('empty').textContent = params.get('novideo');
  if (params.get('title')) document.title = params.get('title');

  function label(id, text) {
    $(id).title = text;
    $(id).setAttribute('aria-label', text);
  }
  label('back', labels.back);
  label('hangup', labels.hangup);
  function setMuted(muted) {
    $('mute').classList.toggle('muted', muted);
    label('mute', muted ? labels.unmute : labels.mute);
    $('mute').setAttribute('aria-pressed', String(muted));
  }
  setMuted(false);

  var channel = new BroadcastChannel(CHANNEL);
  var canvas = $('video');
  var ctx = canvas.getContext('2d');
  function setHasVideo(has) {
    canvas.hidden = !has;
    $('empty').hidden = has;
  }

  channel.onmessage = function (e) {
    var msg = e.data;
    if (!msg) return;
    if (msg.type === 'state') {
      setMuted(!!msg.muted);
      setHasVideo(!!msg.hasVideo);
    } else if (msg.type === 'frame' && msg.bitmap) {
      if (canvas.width !== msg.bitmap.width) canvas.width = msg.bitmap.width;
      if (canvas.height !== msg.bitmap.height) canvas.height = msg.bitmap.height;
      ctx.drawImage(msg.bitmap, 0, 0);
      msg.bitmap.close();
    }
  };

  $('mute').addEventListener('click', function () {
    channel.postMessage({ type: 'mute' });
  });
  $('hangup').addEventListener('click', function () {
    channel.postMessage({ type: 'hangup' });
  });
  $('back').addEventListener('click', function () {
    channel.postMessage({ type: 'return' });
    // The IPC global is injected into every webview of the shell.
    var internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      Promise.resolve(internals.invoke('call_popout_focus_main')).catch(function (err) {
        console.warn('[call-popout] call_popout_focus_main failed', err);
      });
    }
  });
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Tell the main window we are here, so it sends the current state.
  channel.postMessage({ type: 'ready' });
})();
