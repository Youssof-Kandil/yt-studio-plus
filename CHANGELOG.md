# Changelog

## 1.6.3 – 2026-11-19
- **Pre-publish checklist:** a pill next to Publish (upload dialog) and Save (details page) shows what's missing: title, description, tags, playlist, custom thumbnail, end screen, audience, plus an optional hashtag check. Click it for details. It never blocks publishing.
- Choose the checks or turn the checklist off in ⚙ Settings; the checklist has a direct ⚙ Choose checks / turn off link.

## 1.6.2 – 2026-11-19
- Find & replace, tags: new tags are added only while a video stays within YouTube's 500-character tag limit (in the order typed). Tags that don't fit are listed, and each video shows its tag count (for example 492/500).
- Tags with < or >, or longer than 500 characters, are ignored with a warning.
- Saving stops automatically after 3 failures in a row (remaining videos are marked not attempted), and a Stop button ends a run after the current video.

## 1.6.1 – 2026-11-19
- **Find & replace:** select videos on Content, then find & replace text in titles and/or descriptions, or add/remove tags in bulk. Every change is previewed first, checked against YouTube's data after saving, and can be undone.

## 1.6.0 – 2026-11-18
- Toolbar popup: click the Studio Plus icon to see the logo, a Ko-fi link, every feature and where to find it, and an Open YouTube Studio button.

## 1.5.1 – 2026-11-18
- A small, closable Ko-fi banner at the top of the side panel, Upload templates and Compare videos. Closing it hides it everywhere until Studio is opened in a new tab.

## 1.5.0 – 2026-11-18
- **Outlier score:** a 2.4×-style badge next to every view count on the Content page and overview cards. It compares the video with your typical video of the same kind (median of your last 30 settled public Shorts or long videos).
- **Saved replies:** a Saved replies button under every comment reply box, with {name}, {handle} and {video} placeholders. It fills the box only; you still click Reply.

## 1.4.1 – 2026-11-18
- "Redirect Shorts to…" button: light violet with dark text, easier to read on the selection bar.

## 1.4.0 – 2026-11-18
- **Redirect Shorts to…:** select Shorts on Content → Shorts and point all of them at one long-form video as their related video. You can also clear the related video on all of them.
- Like and dislike counts on the video cards of the Content overview page.

## 1.3.0 – 2026-11-04
- New violet logo and store artwork.
- Removed the unused `clipboardWrite` permission (copying still works).
- Open-source release: MIT license, privacy policy, build scripts, GitHub release workflow.

## 1.2.0
- Compare draws its own charts from Studio's analytics data instead of embedding two Studio pages:
  - same-age ranges
  - over-time chart
  - retention overlay
  - traffic sources
- Menu items now match Studio's spacing.
- Soft violet accent on everything Studio Plus adds.

## 1.1.0
- Upload templates covering every upload field, with `{ep}`, `{file}` and `{date}` placeholders.
- Series detection and "Continue series → Ep N".
- Template suggestions based on the file name.
- **Upload templates** page with export and import.
- Likes (vs. dislikes) column on the Content page.
- **Compare videos** page, which preselects the current video.

## 1.0.0
- Side panel listing your videos on the details and upload pages.
- **Copy from…** for an older video's title, description and tags.
