// Studio Plus – toolbar popup.
(() => {
  'use strict';
  const hasChrome = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest;

  const ver = document.getElementById('ver');
  if (hasChrome) ver.textContent = 'v' + chrome.runtime.getManifest().version;
  else ver.remove();

  // Reuse an open Studio tab if there is one, otherwise open a new one.
  document.getElementById('open-studio').addEventListener('click', async () => {
    const url = 'https://studio.youtube.com/';
    if (!hasChrome || !chrome.tabs) { window.open(url, '_blank'); return; }
    try {
      const [tab] = await chrome.tabs.query({ url: 'https://studio.youtube.com/*' });
      if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url });
      }
    } catch (_) {
      chrome.tabs.create({ url });
    }
    window.close();
  });
})();
