# Base64 File Auto Downloader

A Chrome/Edge extension that automatically downloads files from API responses when they are returned as base64-encoded data. No manual copy-paste or “Save as”—just run your API (e.g. in Swagger) and the file is saved to your Downloads folder.

---

## Features

- **Always on** – Works on every tab; no need to click “Enable” each time.
- **Automatic detection** – Intercepts `fetch` and XHR responses, detects base64 content, and triggers a download.
- **Known file types only** – Downloads only when the content is recognized as a real file (Excel, PDF, images, CSV/text when the API provides the filename). Ignores generic binary and text that looks like base64 (e.g. API descriptions).
- **Toast notifications** – Shows a small on-page toast when a download starts and when it completes, with the extension name and file name.
- **Works with Swagger** – Designed to work with Swagger UI and other API tools that return base64 in JSON.

---

## Supported file formats

| Type   | Extensions | Detection |
|--------|------------|-----------|
| Excel  | `.xlsx`, `.xls` | By file signature |
| PDF    | `.pdf`     | By file signature |
| Images | `.jpg`, `.png`, `.gif` | By file signature |
| CSV / text | `.csv`, `.txt` | By API filename (when response includes the file name) |
| Other  | `.bin`     | Not downloaded (skipped to avoid false downloads) |

---

## Installation

### 📥 Method 1: Install from GitHub Releases (Recommended)

1. **Download the extension**
   - Go to the [Releases page](https://github.com/devanshjha-sq/base64-auto-downloader/releases/latest)
   - Download `base64-auto-downloader-v1.0.0.zip`
   - Extract the ZIP file to a folder on your computer

2. **Open your browser's extension page**
   - **Chrome**: Navigate to `chrome://extensions`
   - **Edge**: Navigate to `edge://extensions`

3. **Enable Developer mode**
   - Look for the **Developer mode** toggle (usually in the left or light corner)
   - Turn it **ON**

4. **Load the extension**
   - Click **Load unpacked** button
   - Browse to and select the **extracted folder** (the one containing `manifest.json`)
   - Click **Select Folder**

5. **Confirm installation**
   - The extension icon (📥) should appear in your browser toolbar
   - You may need to click the puzzle piece icon and pin it for easy access

6. **Accept permissions**
   - If prompted, review and accept the requested permissions
   - The extension needs these to detect API responses and save files

✅ **Done!** The extension is now active and will automatically download files from base64 API responses.

---

### 🔧 Method 2: Install from Source (For Developers)

If you want to modify the code or contribute:

1. **Clone the repository**

   ```bash
   git clone https://github.com/devanshjha-sq/base64-auto-downloader.git
   cd base64-auto-downloader
   ```

2. **Open your browser's extension page**
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`

3. **Enable Developer mode** (toggle at left or right corner)

4. **Load unpacked**
   - Click **Load unpacked**
   - Select the cloned `base64-auto-downloader` folder
   - The extension will install immediately

---

## How to use

1. Open the page where you call your API (e.g. Swagger at `https://your-api.com/swagger`).
2. Run the API that returns a file as base64 (e.g. click **Execute** in Swagger).
3. The extension detects the response, decodes the base64, and starts a download.
4. A toast appears on the page: first “Downloading: filename”, then “Downloaded: filename”.
5. Find the file in your **Downloads** folder.

No need to open the extension popup or turn anything on—it runs automatically on all pages.

---

## API response format

The extension looks for base64 file data in JSON responses. It works best when your API returns something like:

```json
{
  "file_base64": "UEsDBBQAAAAIAIZxPlxGx01IlQAAAM0AAA...",
  "file_name": "report.xlsx",
  "success": true
}
```

**Recognized field names for base64 content:**

- `file_base64`, `fileBase64`, `base64`, `data`, `content`
- `file_data`, `fileData`, `fileContent`, `file_content`
- `contentBase64`, `content_base64`, `result`, `response`, `body`, `payload`, `file`, `attachment`, `document`

**Recognized field names for the file name:**

- `file_name`, `fileName`, `filename`, `name`, `attachmentName`, `documentName`

Nested objects are searched for long base64-like strings, but common API/spec fields (e.g. `description`, `title`, `info`) are skipped to avoid false positives.

---

## How it works

1. **Content script** (`content.js`) loads at `document_start` on every page and injects the page script from `injected.js` (loaded via `script.src` to respect strict Content Security Policy).
2. **Page script** (`injected.js`) overrides `window.fetch` and `XMLHttpRequest.prototype.send`. When a response is received, it checks the body for base64 (in known JSON fields or via pattern matching), decodes it, and detects the file type from the first bytes.
3. If the type is a known format (xlsx, pdf, jpg, etc.), the script sends the base64 and metadata to the extension via `postMessage`.
4. **Content script** receives the message, shows the “Downloading” toast, and forwards the request to the **background script**.
5. **Background script** uses the Chrome/Edge **Downloads API** (`chrome.downloads.download`) to save the file (so downloads work even without a user gesture). When the download finishes, it notifies the content script to show the “Downloaded” toast.

---

## Permissions

| Permission      | Purpose |
|-----------------|--------|
| `activeTab`     | Access the current tab when the user interacts with the extension. |
| `scripting`     | Inject the download logic into pages. |
| `storage`       | Reserved for future use. |
| `tabs`          | Know when tabs load so the script can be injected. |
| `downloads`     | Save files via the Chrome/Edge Downloads API. |
| `host_permissions` (`<all_urls>`) | Run on any website (e.g. Swagger, your API docs). |

---

## Troubleshooting

- **File doesn’t download**  
  - Ensure the API returns JSON with base64 in a recognized field (e.g. `file_base64`) and, if possible, a file name (e.g. `file_name`).  
  - Open DevTools (F12) → Console and look for messages like “Base64 Auto-Download: Processing response” and “Found file_base64 + file_name” to confirm the response is being handled.

- **CSP or “inline script” errors**  
  - The extension loads the page script from `injected.js` via `script.src` (not inline), so it should work on pages with strict CSP. If you see CSP errors, ensure the extension is up to date and reload it.

- **Unwanted .bin or “invalid base64” on refresh**  
  - The extension only downloads when the decoded content matches a known file type (xlsx, pdf, images). It skips `description` and similar fields and does not log errors for invalid base64 to reduce console noise.

- **Toast doesn’t appear**  
  - Toasts are added to the page DOM by the content script. If the page’s CSS or layout hides or overlays the bottom-right area, the toast might be hard to see. The download itself should still complete.

---

## License

See [LICENSE](LICENSE.md) for details.
