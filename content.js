// content.js - Load page script, relay downloads, show toast UI
(function () {
  var EXTENSION_NAME = 'Base64 File Auto Downloader';
  try {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.documentElement || document.head).appendChild(script);
    try { EXTENSION_NAME = (chrome.runtime.getManifest().name) || EXTENSION_NAME; } catch (e2) {}
  } catch (e) {
    return;
  }

  function showToast(message, isSuccess) {
    try {
      var displayName = message || 'file';
    var toast = document.createElement('div');
    toast.id = 'base64-auto-download-toast-' + Date.now();
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:500;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.25);z-index:2147483647;animation:base64ToastIn 0.3s ease;max-width:320px;word-break:break-all;line-height:1.4;';
    toast.style.background = isSuccess ? 'linear-gradient(135deg,#2e7d32 0%,#1b5e20 100%)' : 'linear-gradient(135deg,#1565c0 0%,#0d47a1 100%)';
    toast.innerHTML = '<div style="font-size:11px;opacity:0.9;margin-bottom:4px;">' + EXTENSION_NAME + '</div><div>' + (isSuccess ? '&#10003; ' : '&#8595; ') + displayName + '</div>';
    if (!document.getElementById('base64-toast-styles')) {
      var style = document.createElement('style');
      style.id = 'base64-toast-styles';
      style.textContent = '@keyframes base64ToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes base64ToastOut{to{opacity:0;transform:translateY(-8px)}}';
      (document.head || document.documentElement).appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.animation = 'base64ToastOut 0.25s ease forwards';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 280);
    }, 3500);
    } catch (e) {}
  }

  function isExtensionActive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  window.addEventListener('message', function (event) {
    try {
      if (!event.data || event.data.type !== 'BASE64_AUTO_DOWNLOAD') return;
      if (!isExtensionActive()) return;
      var payload = event.data.payload || {};
      var base64 = payload.base64, filename = payload.filename, ext = payload.ext, mimeType = payload.mimeType;
      if (base64 && ext && mimeType) {
        var displayName = (filename && filename.trim()) ? (filename.indexOf('.') >= 0 ? filename : filename + '.' + ext) : 'download.' + ext;
        showToast('Downloading: ' + displayName, false);
        try {
          chrome.runtime.sendMessage(
            { action: 'download', base64: base64, filename: filename, ext: ext, mimeType: mimeType },
            function (res) {
              if (chrome.runtime.lastError) {
                showToast('Failed: ' + (chrome.runtime.lastError.message || 'Extension error'), false);
                return;
              }
              if (res && res.error) showToast('Failed: ' + res.error, false);
            }
          );
        } catch (err) {
          showToast('Failed: ' + ((err && err.message) || 'Send error'), false);
        }
      }
    } catch (e) {}
  });

  try {
    chrome.runtime.onMessage.addListener(function (msg) {
      try {
        if (msg.action === 'downloadComplete' && msg.filename) showToast('Downloaded: ' + msg.filename, true);
      } catch (e) {}
    });
  } catch (e) {}
})();
