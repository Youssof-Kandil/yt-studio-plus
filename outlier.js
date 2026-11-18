// Studio Plus – Outlier score: how each video's views compare with your typical
// video of the same kind (Shorts vs. long-form). Shown next to view counts on
// the Content list and on the Content overview cards.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.outlier) return;
  const { h } = YSP;

  const TTL = 10 * 60 * 1000;
  const SETTLE_DAYS = 7;   // younger videos are still growing: not part of the baseline
  const SAMPLE = 30;       // baseline = median of your last 30 settled public videos of that type
  const DAY = 86400;

  const S = { data: null, loading: null, failedAt: 0 };
  YSP.outlier = S;

  const onContent = () => /^\/channel\/UC[\w-]{22}\/(videos|content)/.test(location.pathname);

  function median(nums) {
    if (!nums.length) return null;
    const a = nums.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function build(r) {
    const now = Date.now() / 1000;
    const byId = {};
    const groups = { short: [], long: [] };
    for (const raw of r.videos || []) {
      const v = YSP.normVideo(raw);
      if (!v.id) continue;
      const type = r.hasType ? (raw.contentType === 'CREATOR_CONTENT_TYPE_SHORTS' ? 'short' : 'long') : (v.length && v.length <= 180 ? 'short' : 'long');
      byId[v.id] = { views: v.views, type, ts: v.ts, privacy: v.privacy };
      if (v.privacy === 'public' && v.views != null && v.ts && now - v.ts >= SETTLE_DAYS * DAY) groups[type].push(v);
    }
    const base = {};
    for (const t of ['short', 'long']) {
      const sample = groups[t].sort((a, b) => b.ts - a.ts).slice(0, SAMPLE);
      base[t] = sample.length >= 3 ? { median: median(sample.map((v) => v.views)), n: sample.length } : null;
    }
    return { at: Date.now(), byId, base, hasType: r.hasType };
  }

  function load() {
    if (S.data && Date.now() - S.data.at < TTL) return Promise.resolve(S.data);
    if (S.loading) return S.loading;
    if (Date.now() - S.failedAt < 60000) return Promise.resolve(S.data);
    S.loading = YSP.call('listAllWithType', {}, 120000)
      .then((r) => {
        if (!(r.videos || []).some((v) => v.publicMetrics)) throw new Error('No view counts returned');
        S.data = build(r);
        return S.data;
      })
      .catch((e) => { console.warn('[Studio Plus] outlier score:', e.message); S.failedAt = Date.now(); return S.data; })
      .finally(() => { S.loading = null; });
    return S.loading;
  }

  // ---------------------------------------------------------------- scoring
  function scoreFor(id) {
    const d = S.data;
    const v = d && d.byId[id];
    if (!v || v.views == null) return null;
    // Private, draft or scheduled videos have no audience yet, and a video under
    // 2 days old can't be judged fairly – show nothing rather than a scary "<0.1×".
    if (v.privacy !== 'public' && v.privacy !== 'unlisted') return null;
    const ageDays = v.ts ? (Date.now() / 1000 - v.ts) / DAY : null;
    if (ageDays == null || ageDays < 2) return null;
    const b = d.base[v.type];
    if (!b || !b.median) return null;
    const score = v.views / b.median;
    return { score, v, b, young: ageDays != null && ageDays < SETTLE_DAYS };
  }
  const fmtScore = (s) => (s >= 10 ? Math.round(s) : s >= 0.1 ? s.toFixed(1) : '<0.1') + '×';
  function tier(s) {
    if (s >= 3) return 'hot';
    if (s >= 1.5) return 'good';
    if (s < 0.5) return 'low';
    return 'mid';
  }
  function tooltip(r) {
    const kind = r.v.type === 'short' ? 'Shorts' : 'long-form videos';
    return `${fmtScore(r.score)} your typical views. Typical = median ${YSP.fmtFull(Math.round(r.b.median))} views ` +
      `across your last ${r.b.n} public ${kind} older than ${SETTLE_DAYS} days.` +
      (r.young ? ' This video is under a week old and still growing.' : '') + '\nStudio Plus';
  }
  function badge(r) {
    const el = h('span', { class: `ysp-outlier ysp-outlier-${tier(r.score)}${r.young ? ' ysp-outlier-young' : ''}`, title: tooltip(r), text: fmtScore(r.score) });
    return el;
  }

  // ---------------------------------------------------------------- painting
  function videoIdFromRow(row) {
    const a = row.querySelector('a[href*="/video/"]');
    const m = a && a.getAttribute('href').match(/\/video\/([\w-]{11})/);
    return m ? m[1] : null;
  }
  function place(container, id, cls) {
    const r = scoreFor(id);
    let el = container.querySelector(':scope > .ysp-outlier');
    const stamp = r ? id + ':' + r.score.toFixed(3) + ':' + r.young : '';
    if (el && el.dataset.stamp === stamp) return;
    if (el) el.remove();
    if (!r) return;
    el = badge(r);
    el.dataset.stamp = stamp;
    if (cls) el.classList.add(cls);
    container.append(el);
  }

  function paint() {
    if (!S.data) return;
    // Content list rows (Videos / Shorts / Live tabs)
    for (const row of document.querySelectorAll('ytcp-video-row')) {
      const id = videoIdFromRow(row);
      const cell = row.querySelector('.tablecell-views');
      if (id && cell) place(cell, id, 'ysp-outlier-row');
    }
    // Content overview cards
    for (const host of document.querySelectorAll('yt-lockup-view-model [class*="content-id-"]')) {
      const m = (host.className || '').match(/\bcontent-id-([\w-]{11})\b/);
      if (!m) continue;
      const rows = host.querySelectorAll('yt-content-metadata-view-model .ytContentMetadataViewModelMetadataRow');
      const row = rows[rows.length - 1];
      if (row && row.querySelector('.ytContentMetadataViewModelLeadingIcon')) place(row, m[1], 'ysp-outlier-card');
    }
  }
  function removeAll() { document.querySelectorAll('.ysp-outlier').forEach((e) => e.remove()); }

  YSP.settingsReady.then(() => {
    if (YSP.settings.outlierScore === undefined) YSP.settings.outlierScore = true;
    YSP.onTick.add(() => {
      if (!YSP.settings.outlierScore || !onContent()) { if (document.querySelector('.ysp-outlier')) removeAll(); return; }
      if (!S.data || Date.now() - S.data.at > TTL) load().then(paint);
      paint();
    });
  });
})();
