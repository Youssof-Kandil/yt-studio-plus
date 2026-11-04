# Contributing to Studio Plus

Thanks for helping! Studio Plus is plain JavaScript with no build step, so you can start quickly.

## How contributions work
- **Every change goes through a pull request.** Fork the repo, make your change on a branch, and open a PR against `main`. The maintainer (@Youssof-Kandil) reviews it and decides whether to merge it.
- **Big changes:** open an issue first so we can agree on the approach before you spend time on it. This applies to new features, new permissions and redesigns.
- **One topic per PR.** Small, focused PRs get reviewed faster.
- **Bugs and ideas** go in [Issues](https://github.com/Youssof-Kandil/yt-studio-plus/issues) using the templates there.
- Be respectful. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing of contributions
When you open a pull request, you confirm that:
1. The contribution is your own work, or you have the right to submit it.
2. You license it under the project's [MIT License](LICENSE). That's the same license as the rest of the code.
3. You don't add code, images or text copied from projects with incompatible licenses.

Contributions don't give you rights to the Studio Plus name or logo. See [TRADEMARKS.md](TRADEMARKS.md).

## Project rules
These are required for the Chrome Web Store and are core promises of the project. PRs that break them won't be merged.
- **No remote code and no servers.** Everything must ship inside the extension, and user data must never leave the browser. No analytics, tracking or ads.
- **Keep permissions minimal.** Any new permission needs a strong reason, explained in the PR.
- **Never save or publish on the user's behalf.** Features may fill in Studio's form, but the user always clicks Save or Publish.
- **No paywalls, upsells or nagging** inside the extension.

## Code guidelines
- **Mark our UI.** Anything Studio Plus adds uses the violet accent: `--accent` in `core.js`, `--ysp-accent` in `content.css`.
- **Use Shadow DOM for new UI** (see `YSP.makeHost` / `YSP.page` in `core.js`) so Studio's styles and ours don't affect each other.
- **Use stable selectors.** Studio's DOM changes often, so prefer its stable IDs and `test-id` attributes over class names or visible text.
- **Match the existing style:** 2-space indent, single quotes, small helper functions.
- **Test in real Studio.** Check your change in Studio, including the upload dialog when your change affects forms.
- **Check syntax.** Run `node --check *.js` before opening a PR. CI runs it too.

## Setup
1. Fork and clone the repo.
2. In `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. After each change, click ↻ on the extension card, then reload YouTube Studio.

## Releasing (maintainer only)
1. Bump `version` in `manifest.json` and add an entry to `CHANGELOG.md`.
2. Commit, then tag: `git tag vX.Y.Z && git push --tags`. The workflow attaches the zip to a GitHub Release.
3. Upload the same zip in the Chrome Web Store Developer Dashboard.
