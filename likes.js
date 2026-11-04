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
    document.querySelectorAll('.ysp-likes-cell, .ysp-likes-h').forEach((e) => e.remove());
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
    const ids = [];
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
      if (!YSP.settings.likesColumn || !onContentPage()) { if (document.querySelector('.ysp-likes-cell, .ysp-likes-h')) removeAll(); return; }
      paint();
    });
  });
})();
