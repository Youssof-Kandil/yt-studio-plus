<p align="center">
  <img src="icons/logo512.png" width="96" alt="Studio Plus logo">
</p>

<h1 align="center">Studio Plus</h1>

<p align="center">
  Upload templates, series auto-numbering, side-by-side video compare, a likes column and a video switcher – for YouTube Studio.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/YOUR_EXTENSION_ID">Chrome Web Store</a> ·
  <a href="#install-from-source">Install from source</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="https://buymeacoffee.com/YOUR_BMC_USERNAME">☕ Buy me a coffee</a>
</p>

<!-- Add screenshots to docs/ and uncomment:
<p align="center"><img src="docs/compare.png" width="800" alt="Compare page"></p>
-->

Everything Studio Plus adds is tinted **soft violet**, so you can always tell it apart from YouTube's own UI.

## Features

### Upload templates
Left menu → **Upload templates**. A template can set any of these fields; untick any field you want it to leave alone:

- title and description (replace, or add to the end)
- tags and playlists
- audience (made for kids), age restriction, paid promotion, altered / AI content
- video language, category and game title

**Placeholders**
- `{ep}` – the next episode number, found from your existing titles (`{file} | My Game Ep {ep}` → Ep 13 when Ep 12 is your latest)
- `{file}` – the uploaded file name (on an existing video, the episode name already in its title)
- `{date}` – today's date

**In the upload dialog** the side panel lists your templates and marks the best match for the file name as **Suggested**. One click on **Apply** fills the form. Templates never save or publish anything: you still click Save / Publish yourself.

Export and Import back up your templates as JSON.

### Series mode
Studio Plus finds the series in your titles (`Name | Ep 12`, `Part 3`, `Day 40`, `#7`, …) and offers **Continue <series> → Ep N**. That copies the title pattern, description, tags, category, game and audience settings from the latest episode. **Make template** turns a detected series into a saved template.

### Compare videos
Left menu → **Compare videos**. Inside a video, that video is preselected as **A**.

- **Video stats:** views, engaged views, likes, dislikes, like ratio, comments, duration and tags, with the better number in each row highlighted.
- **Analytics** for the same range for both videos (Same age, First 24 h / 7 d / 28 d, or Since published):
  - views, watch time, impressions, CTR, average view duration, average % viewed and subscribers
  - an over-time chart with both videos aligned to publish time
  - overlaid audience retention curves
  - traffic sources side by side

### Likes column
The Content page gets back a **Likes (vs. dislikes)** column: like ratio, counts and a ratio bar. You can turn it off in the panel's ⚙ settings.

### Video switcher panel
Your other uploads sit next to any video's details or analytics page.

- Jump between videos without going back to Content.
- **Copy from…** shows an older video's title, description and tags next to the form, with Copy / Replace / Append buttons.
- **Alt+V** toggles the panel.

## Install from source

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the repo folder.
4. Open or reload https://studio.youtube.com.

After editing any file, click ↻ on the extension card and reload Studio.

## Build a release zip

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1   # Windows
```
```bash
sh scripts/build.sh                                          # macOS / Linux
```

Either one writes `dist/studio-plus-<version>.zip` containing only the extension files. If you push a tag such as `v1.3.0`, the GitHub workflow builds the zip and attaches it to a release.

## How it works

| File | Role |
| --- | --- |
| `inject.js` | Runs in the Studio page (MAIN world). It calls the same internal endpoints Studio uses with your existing session: `creator/list_creator_videos` and `creator/get_creator_videos` for videos, and `yta_web/get_cards` and `yta_web/get_screen` for analytics. It talks to the other scripts through `window.postMessage`. |
| `core.js` | Shared helpers: the API bridge, the video cache, form helpers that drive Studio's own fields (text boxes, tag chips, radios, dropdowns, playlist picker, game search), page overlays, menu items and the theme. |
| `panel.js` | The side panel (video switcher, Copy from…, settings). |
| `templates.js` | Templates, series detection, suggestions and the Upload templates page. |
| `compare.js` | The Compare page, with SVG charts drawn from the analytics data. |
| `likes.js` | The Likes column on the Content page. |
| `background.js` | Fallback that reads a public watch page for title, description and tags. |

There's no build step, no dependencies and no remote code. UI is rendered in Shadow DOM so it doesn't clash with Studio's styles.

## Privacy

There are no servers, no analytics and no tracking. Templates are stored in `chrome.storage.local` and settings in `chrome.storage.sync`. Full details are in [PRIVACY.md](PRIVACY.md).

## Limitations

- YouTube Studio's internal API and page structure aren't public and can change without notice. When a template can't set a field, it tells you which one, so you can fill it in by hand.
- The extension learns your playlist names from the forms you open. You can also type them in.

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

If Studio Plus saves you time, you can [buy me a coffee ☕](https://buymeacoffee.com/YOUR_BMC_USERNAME). It's completely optional, and every feature stays free.

## License

[MIT](LICENSE)

_Studio Plus is not affiliated with, endorsed by or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC._
