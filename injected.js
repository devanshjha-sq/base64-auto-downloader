(function () {
  if (window._autoDownloadEnabled) return;
  window._autoDownloadEnabled = true;
  console.log('🔍 Base64 Auto-Download ENABLED');

  function detectFileType(bytes) {
    if (bytes.length < 4) return { ext: 'bin', mime: 'application/octet-stream' };
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) return { ext: 'xls', mime: 'application/vnd.ms-excel' };
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { ext: 'pdf', mime: 'application/pdf' };
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return { ext: 'jpg', mime: 'image/jpeg' };
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { ext: 'gif', mime: 'image/gif' };
    return { ext: 'bin', mime: 'application/octet-stream' };
  }

  function downloadFile(base64String, filename) {
    try {
      var base64Prefix = /^data:[^;]+;base64,/i;
      if (base64Prefix.test(base64String)) base64String = base64String.replace(base64Prefix, '');
      base64String = base64String.replace(/\s/g, '');
      console.log('🔄 Attempting to download: ' + (filename || 'file'));
      var binaryString = atob(base64String);
      var bytes = new Uint8Array(binaryString.length);
      for (var i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      var fileInfo = detectFileType(bytes);
      if (fileInfo.ext === 'bin' && filename) {
        var extFromName = (filename.split('.').pop() || '').toLowerCase();
        if (extFromName === 'csv') fileInfo = { ext: 'csv', mime: 'text/csv' };
        else if (extFromName === 'txt') fileInfo = { ext: 'txt', mime: 'text/plain' };
      }
      console.log('📋 Detected type: ' + fileInfo.ext);
      if (fileInfo.ext === 'bin') return false;
      window.postMessage({ type: 'BASE64_AUTO_DOWNLOAD', payload: { base64: base64String, filename: filename || null, ext: fileInfo.ext, mimeType: fileInfo.mime } }, '*');
      console.log('✅ Download triggered');
      return true;
    } catch (e) {
      if (e.name !== 'InvalidCharacterError' && e.message && e.message.indexOf('atob') === -1) console.error('❌ Download failed:', e);
      return false;
    }
  }

  function processResponse(text) {
    console.log('🔍 Base64 Auto-Download: Processing response (' + text.length + ' chars)');
    var downloadCount = 0;
    try {
      var json = JSON.parse(text);
      console.log('✓ Parsed as JSON');
      if (json.file_base64 && typeof json.file_base64 === 'string' && json.file_base64.length > 50) {
        console.log('📦 Found file_base64 + file_name');
        if (downloadFile(json.file_base64, json.file_name || null)) downloadCount++;
      }
      var base64Fields = ['file_base64', 'fileBase64', 'base64', 'data', 'content', 'file_data', 'fileData', 'fileContent', 'file_content', 'contentBase64', 'content_base64', 'result', 'response', 'body', 'payload', 'file', 'attachment', 'document'];
      var nameFields = ['file_name', 'fileName', 'filename', 'name', 'attachmentName', 'documentName'];
      for (var f = 0; f < base64Fields.length; f++) {
        var field = base64Fields[f];
        if (field === 'file_base64') continue;
        if (json[field] && typeof json[field] === 'string' && json[field].length > 50) {
          console.log('📦 Found base64 in field: ' + field);
          var fn = null;
          for (var n = 0; n < nameFields.length; n++) if (json[nameFields[n]]) { fn = json[nameFields[n]]; break; }
          if (downloadFile(json[field], fn)) downloadCount++;
        }
      }
      var skipKeys = { description: 1, title: 1, summary: 1, definition: 1, info: 1, termsOfService: 1, contact: 1, license: 1, paths: 1, schemas: 1, tags: 1, servers: 1, openapi: 1, swagger: 1, file_base64: 1, fileBase64: 1, base64: 1, data: 1, content: 1, file_data: 1, fileData: 1, fileContent: 1, file_content: 1, contentBase64: 1, content_base64: 1, result: 1, response: 1, body: 1, payload: 1, file: 1, attachment: 1, document: 1 };
      function searchNested(obj) {
        if (typeof obj !== 'object' || obj === null) return;
        for (var key in obj) {
          if (skipKeys[key]) continue;
          var val = obj[key];
          if (typeof val === 'string' && val.length > 50) {
            var stripped = val.replace(/\s/g, '');
            if (/^[A-Za-z0-9+\/]+=*$/.test(stripped) && stripped.length % 4 === 0) {
              if (downloadFile(val, null)) downloadCount++;
            }
          } else if (typeof val === 'object') searchNested(val);
        }
      }
      searchNested(json);
      // Only use regex when we have JSON but didn't find a file (so file_name is used, not timestamp)
      // Never run regex on non-JSON (e.g. HTML) - that would match inline base64 images on random pages
      if (downloadCount === 0) {
        var regex = /[A-Za-z0-9+\/]{200,}={0,2}/g;
        var matches = text.match(regex);
        if (matches && matches.length > 0) {
          console.log('📦 Found ' + matches.length + ' base64 string(s) via regex');
          for (var m = 0; m < matches.length; m++) if (downloadFile(matches[m], null)) downloadCount++;
        }
      }
    } catch (e) {
      console.log('⚠️ Not JSON, skipping (avoids false downloads on HTML pages with inline images)');
    }
    if (downloadCount > 0) console.log('✅ Total downloads: ' + downloadCount);
    else console.log('⚠️ No base64 data found to download');
  }

  var originalFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    return originalFetch.apply(this, args).then(function (response) {
      var cloned = response.clone();
      cloned.text().then(function (text) {
        console.log('📡 Fetch response received');
        processResponse(text);
      }).catch(function (e) { console.error('Fetch processing error:', e); });
      return response;
    });
  };

  var originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    xhr.addEventListener('load', function () {
      if (xhr.responseText) {
        console.log('📡 XHR response received');
        processResponse(xhr.responseText);
      }
    });
    return originalXHRSend.apply(this, arguments);
  };

  console.log('✅ Auto-download active!');
})();
