// Studio Plus – brings a "Likes (vs. dislikes)" column back to the Content page.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.likes) return;
  const { h } = YSP;
  const cache = new Map(); // videoId -> { at, m }
  const inflight = new Set();
  const TTL = 5 * 60 * 1000;
  YSP.likes = { cache };

  const onContentPage = () => /^\/channel\/UC[\w-]{22}\/(videos|content)/.test(location.pathname);

  function rowVideoId(row) {
    const a = row.querySelector('a[href*="/video/"]');
    const m = a && a.getAttribute('href').match(/\/video\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  function cellContent(m) {
    if (!m) return [h('span', { class: 'ysp-likes-muted', text: '…' })];
    const likes = m.likes || 0, dislikes = m.dislikes || 0, total = likes + dislikes;
    if (m.likes == null) return [h('span', { class: 'ysp-likes-muted', text: '—' })];
    if (!total) return [h('span', { class: 'ysp-likes-muted', text: '—' }), h('span', { class: 'ysp-likes-sub', text: '0 likes' })];
    const pct = (likes / total) * 100;
    const bar = h('span', { class: 'ysp-likes-bar' }, h('span', { class: 'ysp-likes-fill', style: `width:${pct.toFixed(1)}%` }));
    return [
      h('span', { class: 'ysp-likes-pct', text: pct.toFixed(1) + '%' }),
      h('span', { class: 'ysp-likes-sub', title: `${likes.toLocaleString()} likes, ${dislikes.toLocaleString()} dislikes` },
        `${YSP.fmtNum(likes)} likes · ${YSP.fmtNum(dislikes)} dislikes`),
      bar,
    ];
  }

  function removeAll() {
    document.querySelectorAll('.ysp-likes-cell, .ysp-likes-h, .ysp-card-likes').forEach((e) => e.remove());
  }

  // ---- Video cards (Content overview shelves: "Videos", "Shorts") ----
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const THUMB = 'M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';
  function thumb(down) {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ysp-card-thumb' + (down ? ' ysp-card-thumb-down' : ''));
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', THUMB);
    s.append(p);
    return s;
  }
  function cardContent(m) {
    if (!m) return [h('span', { text: '…' })];
    if (m.likes == null) return [h('span', { text: '—' })];
    return [
      thumb(false), h('span', { text: YSP.fmtNum(m.likes || 0) }),
      thumb(true), h('span', { text: YSP.fmtNum(m.dislikes || 0) }),
    ];
  }
  function cardVideoId(host) {
    const m = (host.className || '').match(/\bcontent-id-([\w-]+)/);
    return m && /^[\w-]{11}$/.test(m[1]) ? m[1] : null; // playlists have longer ids
  }
  function paintCards() {
    const ids = [];
    for (const host of document.querySelectorAll('yt-lockup-view-model [class*="content-id-"]')) {
      const id = cardVideoId(host);
      if (!id) continue;
      const rows = host.querySelectorAll('yt-content-metadata-view-model .ytContentMetadataViewModelMetadataRow');
      const row = rows[rows.length - 1];
      // Only the stats row (has icons) – skip cards without view/comment counts.
      if (!row || !row.querySelector('.ytContentMetadataViewModelLeadingIcon')) continue;
      let el = row.querySelector('.ysp-card-likes');
      if (!el || el.dataset.vid !== id) {
        if (el) el.remove();
        el = h('span', { class: 'ysp-card-likes', title: 'Likes · dislikes (Studio Plus)' });
        el.dataset.vid = id;
        row.append(el);
      }
      const c = cache.get(id);
      const stamp = String(c ? c.at : 0);
      if (el.dataset.stamp !== stamp) {
        el.dataset.stamp = stamp;
        el.replaceChildren(...cardContent(c && c.m));
        if (c && c.m && c.m.likes != null) {
          el.title = `${(c.m.likes || 0).toLocaleString()} likes · ${(c.m.dislikes || 0).toLocaleString()} dislikes (Studio Plus)`;
        }
      }
      ids.push(id);
    }
    return ids;
  }

  async function fetchMissing(ids) {
    const need = ids.filter((id) => !inflight.has(id) && (!cache.has(id) || Date.now() - cache.get(id).at > TTL));
    if (!need.length) return;
    need.forEach((id) => inflight.add(id));
    try {
      const res = await YSP.call('getMetrics', { videoIds: need });
      const now = Date.now();
      for (const id of need) cache.set(id, { at: now, m: res[id] || { likes: null } });
    } catch (e) {
      console.warn('[Studio Plus] likes column:', e.message);
      for (const id of need) cache.set(id, { at: Date.now() - TTL + 30000, m: { likes: null } });
    } finally {
      need.forEach((id) => inflight.delete(id));
    }
    paint();
  }

  function paint() {
    if (!YSP.settings.likesColumn || !onContentPage()) return;
    const cardIds = paintCards();
    // header
    const hdrComments = document.querySelector('ytcp-table-header .tablecell-comments.cell-header');
    if (hdrComments && !(hdrComments.nextElementSibling && hdrComments.nextElementSibling.classList.contains('ysp-likes-h'))) {
      const hc = hdrComments.cloneNode(false);
      hc.classList.remove('sortable');
      hc.classList.add('ysp-likes-h');
      hc.textContent = 'Likes (vs. dislikes)';
      hc.title = 'Added by Studio Plus';
      hdrComments.after(hc);
    }
    const ids = cardIds.slice();
    for (const row of document.querySelectorAll('ytcp-video-row')) {
      const id = rowVideoId(row);
      const comments = row.querySelector('.tablecell-comments');
      if (!id || !comments) continue;
      let cell = comments.nextElementSibling;
      if (!cell || !cell.classList.contains('ysp-likes-cell')) {
        cell = comments.cloneNode(false);
        cell.classList.add('ysp-likes-cell');
        comments.after(cell);
      }
      const c = cache.get(id);
      const stamp = id + ':' + (c ? c.at : 0);
      if (cell.dataset.stamp !== stamp) {
        cell.dataset.stamp = stamp;
        cell.replaceChildren(...cellContent(c && c.m));
      }
      ids.push(id);
    }
    if (ids.length) fetchMissing(ids);
  }

  YSP.settingsReady.then(() => {
    YSP.onTick.add(() => {
      if (!YSP.settings.likesColumn || !onContentPage()) { if (document.querySelector('.ysp-likes-cell, .ysp-likes-h, .ysp-card-likes')) removeAll(); return; }
      paint();
    });
  });
})();
