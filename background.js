// Fallback data source: reads title/description/tags from a video's public
// watch page. Used only when Studio's API doesn't return tags/description.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'ysp:watchPage') return false;
  fetchWatchPage(msg.videoId).then(
    (data) => sendResponse({ ok: true, data }),
    (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
  );
  return true; // async response
});

async function fetchWatchPage(videoId) {
  if (!/^[\w-]{11}$/.test(videoId || '')) throw new Error('Bad video id');
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const start = html.indexOf('ytInitialPlayerResponse');
  if (start < 0) throw new Error('No player data on watch page');
  const braceStart = html.indexOf('{', start);
  const json = extractJsonObject(html, braceStart);
  const pr = JSON.parse(json);
  const vd = pr.videoDetails || {};
  return {
    title: vd.title || '',
    description: vd.shortDescription || '',
    tags: Array.isArray(vd.keywords) ? vd.keywords : [],
  };
}

// Walk braces (respecting strings) to cut out one JSON object.
function extractJsonObject(text, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(from, i + 1); }
  }
  throw new Error('Could not parse player data');
}
