# Privacy Policy – Studio Plus

_Last updated: November 4, 2026_

Studio Plus is a browser extension that adds features to YouTube Studio (studio.youtube.com). This policy explains what data it handles.

## The short version

- Studio Plus has **no servers**. It never sends your data to the developer or to any third party.
- No analytics, tracking, ads or telemetry.
- Everything it saves stays in your own browser.

## What the extension accesses

To work, Studio Plus runs only on `studio.youtube.com` and reads data from your own channel through the same YouTube endpoints the Studio website already uses:

- **Video details:** titles, descriptions, tags, category, language, game title, audience and age settings, playlists, original file names.
- **Video statistics and analytics:** views, likes, dislikes, comments, watch time, impressions, retention and traffic sources. These are used to draw the Compare page and the Likes column.
- **Your signed-in YouTube session:** requests are sent to YouTube with the session you are already signed in with (as the Studio page itself does). The extension does not read, store or send your password, and session data never leaves the request to YouTube.

As a fallback, the extension may load a video's public watch page on `www.youtube.com` to read its title, description and tags.

All of this data is processed in your browser and only displayed back to you.

## What the extension stores

| Data | Where | Why |
| --- | --- | --- |
| Upload templates you create | `chrome.storage.local` (this device) | To fill in the upload form |
| Playlist names seen in your forms | `chrome.storage.local` | Shortcuts in the template editor |
| Settings (panel options, Likes column on/off) | `chrome.storage.sync` | Kept across your Chrome profile by Chrome's own sync |

You can delete all of it at any time by removing the extension, or by deleting templates on the **Upload templates** page.

## Sharing

Studio Plus does not sell, transfer or share user data with anyone. The developer cannot see your data.

## Changes

If this policy changes, the new version will be published in the project's repository with an updated date.

## Contact

Questions: open an issue at https://github.com/Youssof-Kandil/studio-plus/issues

_Studio Plus is not affiliated with, endorsed by or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC._
