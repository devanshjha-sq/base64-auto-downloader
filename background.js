// background.js - Always-on: auto-inject into every tab when it loads

function canInjectIntoUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

// Also inject on tab complete (backup; content script injects at document_start)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !canInjectIntoUrl(tab.url)) return;
  chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    function: enableAutoDownload
  }).catch(() => {});
});

// Handle download from page (Chrome downloads API)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'download' || !message.base64) return;
  const { base64, ext, mimeType } = message;
  const rawName = message.filename ?? message.fileName ?? '';
  let filename = typeof rawName === 'string' ? rawName.trim() : '';
  filename = filename.replace(/[\\/:*?"<>|]/g, '_');
  const name = filename ? (filename.includes('.') ? filename : `${filename}.${ext}`) : `download_${Date.now()}.${ext}`;
  const tabId = sender.tab && sender.tab.id;
  try {
    const url = `data:${mimeType};base64,${base64}`;
    chrome.downloads.download({ url, filename: name, saveAs: false }, () => {
      const err = chrome.runtime.lastError;
      if (!err && tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'downloadComplete', filename: name }).catch(() => {});
      }
      sendResponse({ ok: !err, error: err && err.message });
    });
  } catch (e) {
    sendResponse({ ok: false, error: (e && e.message) || 'Download failed' });
  }
  return true;
});

function enableAutoDownload() {
  if (window._autoDownloadEnabled) return;
  window._autoDownloadEnabled = true;
  console.log('🔍 Base64 Auto-Download ENABLED');
  
  function detectFileType(bytes) {
    if (bytes.length < 4) return { ext: 'bin', mime: 'application/octet-stream' };
    
    // Excel .xlsx (ZIP with xl/ folder)
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    // Excel .xls (OLE)
    if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
      return { ext: 'xls', mime: 'application/vnd.ms-excel' };
    }
    // PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { ext: 'pdf', mime: 'application/pdf' };
    }
    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return { ext: 'gif', mime: 'image/gif' };
    }
    
    return { ext: 'bin', mime: 'application/octet-stream' };
  }
  
  function downloadFile(base64String, filename) {
    try {
      // Strip data URL prefix if present (e.g. data:application/pdf;base64,xxxx)
      const base64Prefix = /^data:[^;]+;base64,/i;
      if (base64Prefix.test(base64String)) {
        base64String = base64String.replace(base64Prefix, '');
      }
      base64String = base64String.replace(/\s/g, '');

      console.log(`🔄 Attempting to download: ${filename || 'file'}`);
      console.log(`📏 Base64 length: ${base64String.length}`);

      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const fileInfo = detectFileType(bytes);
      console.log(`📋 Detected type: ${fileInfo.ext}`);
      // Only download known file types; skip .bin to avoid false downloads on page load/refresh
      if (fileInfo.ext === 'bin') return false;

      // Use postMessage so content script can trigger Chrome downloads API (no user-gesture block)
      window.postMessage({
        type: 'BASE64_AUTO_DOWNLOAD',
        payload: { base64: base64String, filename: filename || null, ext: fileInfo.ext, mimeType: fileInfo.mime }
      }, '*');
      console.log('✅ Download triggered');
      return true;
    } catch (e) {
      console.error('❌ Download failed:', e);
      return false;
    }
  }
  
  function processResponse(text) {
    console.log('🔍 Base64 Auto-Download: Processing response (' + text.length + ' chars)');
    
    let downloadCount = 0;
    
    // Strategy 1: Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('✓ Parsed as JSON');
      
      // Explicit handling for { file_base64, file_name, success } (e.g. Swagger API)
      if (json.file_base64 && typeof json.file_base64 === 'string' && json.file_base64.length > 50) {
        console.log('📦 Found file_base64 + file_name');
        if (downloadFile(json.file_base64, json.file_name || null)) downloadCount++;
      }
      
      // Look for base64 fields (common API response keys)
      const base64Fields = ['file_base64', 'fileBase64', 'base64', 'data', 'content', 'file_data', 'fileData', 'fileContent', 'file_content', 'contentBase64', 'content_base64', 'result', 'response', 'body', 'payload', 'file', 'attachment', 'document'];
      const nameFields = ['file_name', 'fileName', 'filename', 'name', 'attachmentName', 'documentName'];
      
      for (const field of base64Fields) {
        if (field === 'file_base64') continue; // already handled above
        if (json[field] && typeof json[field] === 'string' && json[field].length > 50) {
          console.log('📦 Found base64 in field: ' + field);
          let filename = null;
          for (const nameField of nameFields) {
            if (json[nameField]) { filename = json[nameField]; break; }
          }
          if (downloadFile(json[field], filename)) downloadCount++;
        }
      }
      
      // Check nested objects (skip keys we already handled above to avoid double download)
      const skipKeys = new Set(['description', 'title', 'summary', 'definition', 'info', 'termsOfService', 'contact', 'license', 'paths', 'schemas', 'tags', 'servers', 'openapi', 'swagger', 'file_base64', 'fileBase64', 'base64', 'data', 'content', 'file_data', 'fileData', 'fileContent', 'file_content', 'contentBase64', 'content_base64', 'result', 'response', 'body', 'payload', 'file', 'attachment', 'document']);
      function searchNested(obj) {
        if (typeof obj !== 'object' || obj === null) return;
        for (const key in obj) {
          if (skipKeys.has(key)) continue;
          const val = obj[key];
          if (typeof val === 'string' && val.length > 50) {
            const stripped = val.replace(/\s/g, '');
            if (/^[A-Za-z0-9+\/]+=*$/.test(stripped) && stripped.length % 4 === 0) {
              if (downloadFile(val, null)) downloadCount++;
            }
          } else if (typeof val === 'object') {
            searchNested(val);
          }
        }
      }
      searchNested(json);
      
      // Only use regex when we have JSON but didn't find a file (so file_name is used, not timestamp)
      // Never run regex on non-JSON (e.g. HTML) - that would match inline base64 images on random pages
      if (downloadCount === 0) {
        const regex = /[A-Za-z0-9+\/]{200,}={0,2}/g;
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          console.log(`📦 Found ${matches.length} base64 string(s) via regex`);
          for (const match of matches) {
            if (downloadFile(match, null)) downloadCount++;
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Not JSON, skipping (avoids false downloads on HTML pages with inline images)');
    }
    
    if (downloadCount > 0) {
      console.log(`✅ Total downloads: ${downloadCount}`);
    } else {
      console.log('⚠️ No base64 data found to download');
    }
  }
  
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    const cloned = response.clone();
    
    try {
      const text = await cloned.text();
      console.log('📡 Fetch response received');
      processResponse(text);
    } catch (e) {
      console.error('Fetch processing error:', e);
    }
    
    return response;
  };
  
  // Intercept XHR
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this.responseText) {
        console.log('📡 XHR response received');
        processResponse(this.responseText);
      }
    });
    return originalXHRSend.apply(this, args);
  };
  
  console.log('✅ Auto-download active!');
}