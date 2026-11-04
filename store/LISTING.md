# Chrome Web Store listing – copy & paste sheet

Everything you need for the Developer Dashboard (https://chrome.google.com/webstore/devconsole).
Upload `dist/studio-plus-<version>.zip` (made by `scripts/build.ps1`).

---

## Store listing tab

**Name** (from manifest)
Studio Plus – Templates, Compare & Video Switcher

**Summary** (from manifest, max 132 chars)
Upload templates with series auto-numbering, side-by-side video compare, likes column and a video switcher for YouTube Studio.

**Category:** Tools (or Productivity → Workflow & Planning)

**Language:** English

**Description**

```
Studio Plus adds the features creators keep asking for to YouTube Studio – without leaving Studio.

★ UPLOAD TEMPLATES
Save templates for everything you fill in on every upload: title, description, tags, playlists, audience (made for kids), age restriction, paid promotion, altered/AI content, video language, category and game title.
• Templates appear right inside the upload dialog – one click fills the form.
• Suggests the best template from your file name.
• Placeholders: {ep} = next episode number, {file} = file name, {date} = today.
• Untick any field you want a template to leave alone.
• Export / import your templates as JSON.

★ SERIES MODE
Studio Plus finds the series in your titles ("My Game | Ep 12") and offers "Continue series → Ep 13" with the title, description, tags and settings copied from the latest episode.

★ COMPARE VIDEOS
Put two videos side by side: views, watch time, impressions, CTR, average view duration, retention curves, traffic sources and more – drawn on the same timeline so you compare them at the same age (first 24 hours, 7 days, 28 days…).

★ LIKES COLUMN IS BACK
See likes vs. dislikes for every video on the Content page, with a ratio bar.

★ VIDEO SWITCHER PANEL
A list of your other videos next to any video's details or analytics page. Jump between videos, copy descriptions and tags from older uploads, or open Compare – no trips back to the Content page. (Alt+V toggles it.)

PRIVATE BY DESIGN
• No servers, no tracking, no analytics. Your data never leaves your browser.
• Templates only fill in the form – nothing is saved or published until you click Save/Publish yourself.
• Open source: https://github.com/YOUR_GITHUB_USERNAME/studio-plus

Everything Studio Plus adds is tinted soft violet, so you always know what's ours and what's YouTube's.

Enjoying it? Support development: https://buymeacoffee.com/YOUR_BMC_USERNAME

Studio Plus is not affiliated with, endorsed by or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC.
```

**Graphic assets**
- Store icon: `icons/icon128.png` (128×128, 96px artwork with 16px padding – as Google asks)
- Small promo tile: `store/promo-small-440x280.png`
- Marquee promo tile (optional): `store/promo-marquee-1400x560.png`
- Screenshots (1 required, up to 5, **1280×800** or 640×400): take these yourself in Studio – see "Screenshots" below.

**Official URL / Homepage:** your GitHub repo URL
**Support URL:** `https://github.com/YOUR_GITHUB_USERNAME/studio-plus/issues`

---

## Privacy tab

**Single purpose**
```
Studio Plus improves the YouTube Studio creator dashboard: it adds upload templates, a side-by-side video comparison page, a likes/dislikes column and a panel for switching between your own videos.
```

**Permission justifications**

| Permission | Justification to paste |
| --- | --- |
| `storage` | Saves the user's upload templates locally and their extension settings (panel and column options). |
| Host `https://studio.youtube.com/*` | The extension's features run inside YouTube Studio: it adds UI to Studio pages and reads the user's own video details and analytics through the same endpoints the Studio page uses. |
| Host `https://www.youtube.com/*` | Fallback only: reads the public watch page of the user's own video to get its title, description and tags when Studio's data doesn't include them. |

**Remote code:** No, I am not using remote code. (All JavaScript ships inside the package.)

**Data usage** – tick these, and explain they never leave the device:
- ☑ **Website content** (video titles, descriptions, tags, statistics shown in Studio)
- ☑ **Authentication information** (the signed-in YouTube session is used to make requests to YouTube on the user's behalf, like the Studio page does; it is never stored or sent elsewhere)

Then tick all three certifications:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** link to `PRIVACY.md` on GitHub, e.g.
`https://github.com/YOUR_GITHUB_USERNAME/studio-plus/blob/main/PRIVACY.md`

---

## Distribution tab
- Visibility: Public (or Unlisted for a soft launch)
- Regions: All regions
- Pricing: Free

---

## Screenshots (1280×800)

Take them in Chrome at a 1280×800 window (DevTools → device toolbar → Responsive 1280×800 → "Capture screenshot"). Suggested set:
1. Upload dialog with the Studio Plus panel showing a **Suggested** template.
2. **Upload templates** page with the editor open.
3. **Compare** page – stats table + the over-time chart.
4. Content page with the **Likes (vs. dislikes)** column.
5. A video's details page with the **My videos** panel.

Hide anything you don't want public (unlisted video titles, revenue, email).

---

## Review tips
- First review usually takes a few days. Extensions that touch a Google property are sometimes reviewed more carefully – the clear single purpose, minimal permissions and privacy policy above are what reviewers look for.
- Don't use "YouTube" as the first word of the name or the YouTube logo in images (trademark policy). "for YouTube Studio" in the description is fine.
- Each update: bump `version` in `manifest.json`, run the build script, upload the new zip.
