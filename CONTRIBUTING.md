# Contributing to Studio Plus

Thanks for helping! The project is plain JavaScript with no build step, so getting started is quick.

## Setup
1. Fork and clone the repo.
2. In `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. Make your change, click ↻ on the extension card, then reload YouTube Studio.

## Guidelines
- **No remote code and no new servers.** Everything must ship inside the extension, and user data must never leave the browser. This is required by the Chrome Web Store and is a core promise of the project.
- **Keep permissions minimal.** Any new permission needs a strong reason, explained in the PR.
- **Never save or publish on the user's behalf.** Features may fill in Studio's form, but the user always clicks Save or Publish.
- **Mark our UI.** Anything Studio Plus adds uses the violet accent (`--accent` in `core.js`, `--ysp-accent` in `content.css`).
- **Use Shadow DOM** for new UI (see `YSP.makeHost` / `YSP.page` in `core.js`), so Studio's styles and ours don't leak into each other.
- Studio's DOM changes often. Prefer Studio's stable IDs and `test-id` attributes over class names or visible text.
- Run `node --check *.js` before opening a PR.

## Releasing (maintainers)
1. Bump `version` in `manifest.json` and add an entry to `CHANGELOG.md`.
2. Commit, then tag: `git tag v1.3.0 && git push --tags`. The workflow attaches the zip to a GitHub Release.
3. Upload the same zip in the Chrome Web Store Developer Dashboard.
