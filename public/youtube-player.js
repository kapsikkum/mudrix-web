// Hosts the YouTube player on a real web origin for watch together. YouTube refuses to play in
// pages whose origin is not http(s) (the desktop and phone apps), so the app embeds this page
// instead and talks to it with postMessage. A separate file (not inline) so a strict
// script-src 'self' policy still allows it.
/* global YT */
(function () {
  var SOURCE = 'mudrix-youtube';
  var player = null;
  var ready = false;
  var queue = [];

  function post(message) {
    message.source = SOURCE;
    window.parent.postMessage(message, '*');
  }

  function status() {
    if (!ready) return;
    var data = player.getVideoData ? player.getVideoData() : {};
    post({
      type: 'status',
      time: player.getCurrentTime(),
      state: player.getPlayerState(),
      duration: player.getDuration(),
      videoId: data && data.video_id,
    });
  }

  function run(command) {
    if (!ready) {
      queue.push(command);
      return;
    }
    if (command.type === 'play') player.playVideo();
    else if (command.type === 'pause') player.pauseVideo();
    else if (command.type === 'seek') player.seekTo(command.seconds, true);
    else if (command.type === 'load')
      player.loadVideoById({ videoId: command.videoId, startSeconds: command.seconds });
    else if (command.type === 'cue')
      player.cueVideoById({ videoId: command.videoId, startSeconds: command.seconds });
    status();
  }

  function create(options) {
    if (player) return;
    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player('player', {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        videoId: options.videoId,
        playerVars: {
          autoplay: options.autoplay ? 1 : 0,
          start: Math.floor(options.start || 0),
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: function () {
            ready = true;
            post({ type: 'ready' });
            queue.splice(0).forEach(run);
            status();
          },
          onStateChange: function (event) {
            status();
            post({ type: 'state', state: event.data });
          },
          onError: function (event) {
            post({ type: 'error', code: event.data });
          },
        },
      });
    };
    var script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = function () {
      post({ type: 'error', code: -1 });
    };
    document.head.appendChild(script);
    setInterval(status, 250);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var command = event.data;
    if (!command || command.target !== SOURCE) return;
    if (command.type === 'init') create(command);
    else run(command);
  });

  post({ type: 'loaded' });
})();
