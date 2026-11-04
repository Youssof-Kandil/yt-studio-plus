// Studio Plus – side-by-side video comparison page with native, overlaid charts.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.compare) return;
  const { h, videos: V, toast } = YSP;
  const SVG = 'http://www.w3.org/2000/svg';
  const COLORS = { a: '#3ea6ff', b: '#f28b82' };

  const S = { a: null, b: null, range: 'equal', chartMetric: 'EXTERNAL_VIEWS' };
  const details = new Map();   // id -> normalized video
  const analytics = new Map(); // id -> analytics | null (loading) | {error}

  YSP.page.addStyle('compare', `
.cmp-pickers { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: stretch; margin-bottom: 20px; }
.picker { position: relative; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: var(--bg2); display: flex; gap: 12px; align-items: center; min-height: 92px; }
.picker.empty { border-style: dashed; justify-content: center; color: var(--muted); cursor: pointer; background: transparent; }
.picker.empty:hover { background: var(--hover); }
.picker img { width: 128px; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; flex: none; }
.picker .pm { flex: 1; min-width: 0; }
.picker .pt { font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.picker .ps { font-size: 12px; color: var(--muted); }
.picker .ps a { color: var(--accent); }
.ab { display: inline-block; font-size: 11px; font-weight: 700; padding: 0 8px; border-radius: 8px; color: #0f0f0f; line-height: 18px; }
.abA { background: ${COLORS.a}; } .abB { background: ${COLORS.b}; }
.picker > .ab { position: absolute; top: -9px; left: 12px; }
.swap { align-self: center; }
.pop { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; right: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); padding: 8px; }
.pop .input { margin-bottom: 6px; }
.pop-list { max-height: 360px; overflow-y: auto; }
.pop-item { display: flex; gap: 10px; align-items: center; padding: 6px; border-radius: 8px; cursor: pointer; }
.pop-item:hover { background: var(--hover); }
.pop-item img { width: 80px; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; flex: none; }
.pop-item div { min-width: 0; }
.pop-item b { font-weight: 500; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sec { margin: 26px 0 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sec h2 { margin: 0; font-size: 18px; font-weight: 600; }
.sec .grow { flex: 1; }
.stats-table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg2); }
.stats-table th, .stats-table td { padding: 9px 16px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.stats-table tr:last-child th, .stats-table tr:last-child td { border-bottom: 0; }
.stats-table th { text-align: left; font-weight: 500; color: var(--muted); width: 32%; }
.stats-table td { text-align: center; width: 34%; }
.stats-table thead td { padding-top: 12px; padding-bottom: 12px; }
.stats-table td.win { color: var(--good); font-weight: 700; }
.stats-table .delta { font-size: 11px; color: var(--muted); font-weight: 400; margin-left: 6px; }
.stats-table .note { font-size: 11px; color: var(--muted); font-weight: 400; margin-left: 4px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; flex-wrap: wrap; }
.seg button { border: 0; background: var(--bg2); padding: 6px 12px; cursor: pointer; }
.seg button.on { background: var(--accent); color: var(--accent-fg); }
.card { border: 1px solid var(--line); border-radius: 12px; padding: 16px; background: var(--bg2); }
.card-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.card-hd b { font-size: 15px; }
.card-hd .grow { flex: 1; }
.legend { display: flex; gap: 14px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
.chart { position: relative; width: 100%; }
.chart svg { display: block; width: 100%; overflow: visible; }
.chart text { fill: var(--muted); font-size: 11px; font-family: Roboto, Arial, sans-serif; }
.chart .grid line { stroke: var(--line); }
.chart .guide { stroke: var(--muted); stroke-dasharray: 3 3; }
.tip { position: absolute; pointer-events: none; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.3); white-space: nowrap; z-index: 2; }
.tip b { display: block; margin-bottom: 2px; }
.nodata { color: var(--muted); font-size: 12px; padding: 20px 0; text-align: center; }
.bars { display: flex; flex-direction: column; gap: 10px; }
.bar-row .bl { font-size: 12px; margin-bottom: 3px; display: flex; justify-content: space-between; }
.bar-row .bt { height: 7px; border-radius: 4px; background: var(--bg3); margin-top: 3px; overflow: hidden; }
.bar-row .bt span { display: block; height: 100%; border-radius: 4px; }
.bar-row .bv { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hint { font-size: 12px; color: var(--muted); }
.foot { margin-top: 16px; font-size: 12px; color: var(--muted); }
.foot a { color: var(--accent); }
@media (max-width: 1000px) { .grid2 { grid-template-columns: 1fr; } .cmp-pickers { grid-template-columns: 1fr; } }
`);

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  async function loadDetail(id) {
    if (!id || details.has(id)) return;
    details.set(id, null);
    try {
      const raw = await YSP.call('getVideo', { videoId: id });
      const n = YSP.normVideo(raw);
      n.category = YSP.categoryLabel(raw.category);
      n.tagCount = YSP.extractTags(raw.tags).length;
      details.set(id, n);
    } catch (e) {
      details.delete(id);
      toast('Could not load video: ' + e.message, 'error');
    }
    rerenderIfOpen();
  }
  async function loadAnalytics(id) {
    if (!id || analytics.has(id)) return;
    analytics.set(id, null);
    try { analytics.set(id, await YSP.call('getAnalytics', { videoId: id }, 45000)); }
    catch (e) { analytics.set(id, { error: e.message, metrics: {}, traffic: [] }); }
    rerenderIfOpen();
  }
  function rerenderIfOpen() { if (YSP.page.current && YSP.page.current.name === 'compare') rerender(); }

  const HOUR = 3600 * 1000;
  function ageHours(id) {
    const a = analytics.get(id);
    const v = details.get(id) || V.get(id);
    const pub = (a && a.publishedMs) || (v && v.ts ? v.ts * 1000 : null);
    return pub ? Math.max(0, (Date.now() - pub) / HOUR) : null;
  }
  function windowHours() {
    if (S.range === '24h') return 24;
    if (S.range === '7d') return 24 * 7;
    if (S.range === '28d') return 24 * 28;
    if (S.range === 'equal') {
      const x = ageHours(S.a), y = ageHours(S.b);
      return x != null && y != null ? Math.max(1, Math.min(x, y)) : Infinity;
    }
    return Infinity;
  }
  function fmtWindow(hrs) {
    if (!isFinite(hrs)) return 'since published';
    if (hrs < 48) return `first ${Math.round(hrs)} hours`;
    return `first ${Math.round(hrs / 24)} days`;
  }
  // Hours-since-publish series, clipped to the window.
  function seriesHours(m, a, W) {
    if (!m || !m.series || !m.series.length) return [];
    const ev = a.metrics && a.metrics.EXTERNAL_VIEWS;
    const x0 = (ev && ev.series && ev.series.length ? ev.series[0][0] : null) || a.publishedMs || m.series[0][0];
    const pts = m.series.map(([x, y]) => [(x - x0) / HOUR, y]).filter(([x]) => x >= 0);
    return isFinite(W) ? pts.filter(([x]) => x <= W + 1e-6) : pts;
  }
  function valueAt(m, a, W) {
    if (!m) return null;
    if (!isFinite(W) || !m.cumulative) return m.total;
    const pts = seriesHours(m, a, W);
    return pts.length ? pts[pts.length - 1][1] : 0;
  }

  // ---------------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------------
  function open(a, b) {
    S.a = a || null;
    S.b = b || null;
    V.ensure();
    YSP.page.open('compare', render);
  }
  YSP.compare = { open };

  let root = null;
  function rerender() { if (root) { const y = YSP.page.el.scrollTop; root.replaceChildren(); build(root); YSP.page.el.scrollTop = y; } }
  function render(container) {
    root = h('div', { class: 'page-inner' });
    container.append(root);
    build(root);
    const unsub = V.subscribe(() => { if (YSP.page.current && YSP.page.current.name === 'compare') refreshPickers(); });
    const stop = setInterval(() => { if (!YSP.page.current || YSP.page.current.name !== 'compare') { unsub(); clearInterval(stop); root = null; } }, 1000);
  }

  let pickersEl = null;
  function refreshPickers() { if (pickersEl && pickersEl.isConnected) { const n = pickers(); pickersEl.replaceWith(n); pickersEl = n; } }

  function build(r) {
    r.append(YSP.page.header('Compare videos'));
    pickersEl = pickers();
    r.append(pickersEl);
    if (!S.a || !S.b) {
      r.append(h('div', { class: 'hint', text: S.a || S.b ? 'Pick a second video to compare.' : 'Pick two videos to compare them side by side.' }));
      return;
    }
    loadDetail(S.a); loadDetail(S.b);
    loadAnalytics(S.a); loadAnalytics(S.b);
    r.append(h('div', { class: 'sec' }, h('h2', { text: 'Video stats' }), h('span', { class: 'hint', text: 'Lifetime totals' })));
    r.append(statsTable());
    r.append(analyticsSection());
  }

  function pickers() {
    const p = (slot) => {
      const id = S[slot];
      const v = id && (details.get(id) || V.get(id));
      const label = h('span', { class: 'ab ' + (slot === 'a' ? 'abA' : 'abB'), text: slot.toUpperCase() });
      if (!v) {
        const el = h('div', { class: 'picker empty' }, label, id ? 'Loading…' : '+ Choose a video');
        el.addEventListener('click', () => openPop(el, slot));
        if (id) loadDetail(id);
        return el;
      }
      const el = h('div', { class: 'picker' }, label,
        h('img', { src: v.thumb, alt: '' }),
        h('div', { class: 'pm' },
          h('div', { class: 'pt', title: v.title, text: v.title }),
          h('div', { class: 'ps' }, `${v.tsLabel} ${YSP.fmtDate(v.ts)} · `, h('span', { class: 'pill ' + v.privacy, text: v.privacy })),
          h('div', { class: 'ps' }, h('a', { href: `/video/${v.id}/edit` }, 'Details'), ' · ',
            h('a', { href: `/video/${v.id}/analytics/tab-overview/period-default` }, 'Full analytics'))),
        h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); openPop(el, slot); } }, 'Change'));
      return el;
    };
    return h('div', { class: 'cmp-pickers' }, p('a'),
      h('button', { class: 'btn swap', title: 'Swap A and B', onclick: () => { [S.a, S.b] = [S.b, S.a]; rerender(); } }, '⇄'),
      p('b'));
  }

  function openPop(anchor, slot) {
    const existing = anchor.querySelector('.pop');
    if (existing) { existing.remove(); return; }
    YSP.page.shadow.querySelectorAll('.pop').forEach((x) => x.remove());
    const q = h('input', { class: 'input', type: 'search', placeholder: 'Search your videos…' });
    const list = h('div', { class: 'pop-list' });
    const fill = () => {
      const s = q.value.trim().toLowerCase();
      const other = slot === 'a' ? S.b : S.a;
      const items = V.list.filter((v) => v.id !== other && (!s || v.title.toLowerCase().includes(s))).slice(0, 200);
      list.replaceChildren(...items.map((v) => h('div', { class: 'pop-item', onclick: (e) => { e.stopPropagation(); S[slot] = v.id; rerender(); } },
        h('img', { src: v.thumb, alt: '', loading: 'lazy' }),
        h('div', null, h('b', { text: v.title }), h('span', { class: 'hint', text: `${YSP.fmtDate(v.ts)} · ${YSP.fmtNum(v.views)} views` })))));
      if (V.loading) list.append(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading…'));
      else if (V.nextToken) list.append(h('button', { class: 'btn wide', onclick: (e) => { e.stopPropagation(); V.load({ more: true }).then(fill); } }, 'Load more'));
    };
    q.addEventListener('input', fill);
    const pop = h('div', { class: 'pop', onclick: (e) => e.stopPropagation() }, q, list);
    anchor.append(pop);
    fill();
    q.focus();
    const off = (e) => { if (!e.composedPath().includes(pop)) { pop.remove(); YSP.page.shadow.removeEventListener('click', off, true); } };
    setTimeout(() => YSP.page.shadow.addEventListener('click', off, true), 0);
  }

  // Generic A/B table. rows: [label, valueA, valueB, fmt, better('high'|'low'|null), note]
  function abTable(rows) {
    const tbody = h('tbody');
    for (const [label, a, b, fmt, better, note] of rows) {
      if (a == null && b == null) continue;
      const tdA = h('td', { text: a == null ? '–' : fmt(a) });
      const tdB = h('td', { text: b == null ? '–' : fmt(b) });
      if (better && typeof a === 'number' && typeof b === 'number' && a !== b) {
        const aWins = better === 'high' ? a > b : a < b;
        const win = aWins ? tdA : tdB;
        win.classList.add('win');
        const lo = Math.min(a, b), hi = Math.max(a, b);
        if (lo > 0 && !/ratio|%|rate/i.test(label)) win.append(h('span', { class: 'delta', text: `${((hi / lo - 1) * 100).toFixed(0)}% ${better === 'high' ? 'higher' : 'lower'}` }));
      }
      tbody.append(h('tr', null, h('th', null, label, note ? h('span', { class: 'note', text: note }) : null), tdA, tdB));
    }
    return h('table', { class: 'stats-table' },
      h('thead', null, h('tr', null, h('th', { text: '' }),
        h('td', null, h('span', { class: 'ab abA', text: 'A' })),
        h('td', null, h('span', { class: 'ab abB', text: 'B' })))),
      tbody);
  }

  function statsTable() {
    const A = details.get(S.a) || V.get(S.a);
    const B = details.get(S.b) || V.get(S.b);
    const days = (v) => (v.ts ? Math.max(1, (Date.now() / 1000 - v.ts) / 86400) : null);
    const ratio = (v) => (v.likes != null && v.dislikes != null && v.likes + v.dislikes > 0 ? (v.likes / (v.likes + v.dislikes)) * 100 : null);
    const per100 = (n, v) => (n != null && v.views ? (n / v.views) * 100 : null);
    const g = (fn) => [fn(A), fn(B)];
    const safe = (fn) => (v) => { try { return v ? fn(v) : null; } catch (_) { return null; } };
    const row = (label, fn, fmt, better, note) => [label, ...g(safe(fn)), fmt, better, note];
    return abTable([
      row('Published / uploaded', (v) => v.ts, (x) => YSP.fmtDate(x), null),
      row('Duration', (v) => v.length || null, (x) => YSP.fmtDur(x), null),
      row('Category', (v) => v.category || null, (x) => x + '', null),
      row('Views', (v) => v.views, YSP.fmtFull, 'high'),
      row('Views per day', (v) => (v.views != null && days(v) ? v.views / days(v) : null), (x) => x.toFixed(1), 'high'),
      row('Likes', (v) => v.likes, YSP.fmtFull, 'high'),
      row('Dislikes', (v) => v.dislikes, YSP.fmtFull, 'low'),
      row('Like ratio', ratio, (x) => x.toFixed(1) + '%', 'high'),
      row('Likes per 100 views', (v) => per100(v.likes, v), (x) => x.toFixed(2), 'high'),
      row('Comments', (v) => v.comments, YSP.fmtFull, 'high'),
      row('Comments per 100 views', (v) => per100(v.comments, v), (x) => x.toFixed(2), 'high'),
      row('Tags', (v) => (v.tagCount != null ? v.tagCount : null), (x) => String(x), null),
      row('Title length', (v) => v.title.length, (x) => x + ' chars', null),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Analytics (native)
  // ---------------------------------------------------------------------------
  const fmtHours = (ms) => (ms / HOUR).toFixed(ms / HOUR < 10 ? 2 : 1);
  const fmtDurMs = (ms) => YSP.fmtDur(Math.round(ms / 1000)) || '0:00';
  const CHART_METRICS = [
    ['EXTERNAL_VIEWS', 'Views', (y) => YSP.fmtNum(y)],
    ['EXTERNAL_WATCH_TIME', 'Watch time (hours)', (y) => (Math.round(y * 100) / 100).toString(), (y) => y / HOUR],
    ['VIDEO_THUMBNAIL_IMPRESSIONS', 'Impressions', (y) => YSP.fmtNum(y)],
    ['ENGAGED_VIEWS', 'Engaged views', (y) => YSP.fmtNum(y)],
    ['SUBSCRIBERS_NET_CHANGE', 'Subscribers', (y) => String(Math.round(y))],
  ];
  const TRAFFIC = {
    YT_RELATED: 'Suggested videos', SUBSCRIBER: 'Browse features', YT_SEARCH: 'YouTube search', YT_CHANNEL: 'Channel pages',
    NOTIFICATION: 'Notifications', PLAYLIST: 'Playlists', YT_PLAYLIST_PAGE: 'Playlist page', UNKNOWN_MOBILE_OR_DIRECT: 'Direct or unknown',
    YT_OTHER_PAGE: 'Other YouTube features', EXT_URL: 'External', END_SCREEN: 'End screens', SHORTS: 'Shorts feed',
    ANNOTATION: 'Cards', NO_LINK_EMBEDDED: 'Embedded', NO_LINK_OTHER: 'Other', ADVERTISING: 'YouTube advertising', HASHTAGS: 'Hashtag pages',
    SOUND_PAGE: 'Sound pages', SHORTS_CONTENT_LINKS: 'Shorts links', VIDEO_REMIXES: 'Remixes', LIVE_REDIRECT: 'Live redirects', PRODUCT_PAGE: 'Product pages',
  };
  const trafficLabel = (s) => TRAFFIC[s] || String(s).toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  function analyticsSection() {
    const wrap = h('div');
    const aA = analytics.get(S.a), aB = analytics.get(S.b);
    const ranges = [['equal', 'Same age'], ['24h', 'First 24 hours'], ['7d', 'First 7 days'], ['28d', 'First 28 days'], ['all', 'Since published']];
    const seg = h('div', { class: 'seg' }, ranges.map(([k, l]) => h('button', { class: S.range === k ? 'on' : '', onclick: () => { S.range = k; rerender(); } }, l)));
    const W = windowHours();
    wrap.append(h('div', { class: 'sec' }, h('h2', { text: 'Analytics' }), h('span', { class: 'hint', text: `Comparing the ${fmtWindow(W)} after each video was published` }), h('span', { class: 'grow' }), seg));
    if (!aA || !aB) {
      wrap.append(h('div', { class: 'card' }, h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading analytics for both videos…')));
      return wrap;
    }
    for (const [x, slot] of [[aA, 'A'], [aB, 'B']]) if (x.error) wrap.append(h('div', { class: 'error', text: `Analytics for ${slot} could not be loaded: ${x.error}` }));

    const youngNote = (id) => { const age = ageHours(id); return isFinite(W) && age != null && age < W - 1 ? 'not that old yet' : null; };
    const m = (a, k) => a.metrics[k];
    const win = (k) => [valueAt(m(aA, k), aA, W), valueAt(m(aB, k), aB, W)];
    const notes = [youngNote(S.a), youngNote(S.b)].some(Boolean) ? '(one video is younger than this range)' : null;
    const life = 'lifetime';
    const rA = aA.retention || {}, rB = aB.retention || {};
    wrap.append(abTable([
      ['Views', ...win('EXTERNAL_VIEWS'), YSP.fmtFull, 'high', notes],
      ['Watch time (hours)', ...win('EXTERNAL_WATCH_TIME'), fmtHours, 'high'],
      ['Impressions', ...win('VIDEO_THUMBNAIL_IMPRESSIONS'), YSP.fmtFull, 'high'],
      ['Engaged views', ...win('ENGAGED_VIEWS'), YSP.fmtFull, 'high'],
      ['Subscribers gained', ...win('SUBSCRIBERS_NET_CHANGE'), (x) => (x > 0 ? '+' : '') + x, 'high'],
      ['Impressions click-through rate', m(aA, 'VIDEO_THUMBNAIL_IMPRESSIONS_VTR') && m(aA, 'VIDEO_THUMBNAIL_IMPRESSIONS_VTR').total, m(aB, 'VIDEO_THUMBNAIL_IMPRESSIONS_VTR') && m(aB, 'VIDEO_THUMBNAIL_IMPRESSIONS_VTR').total, (x) => x.toFixed(2) + '%', 'high', life],
      ['Average view duration', m(aA, 'AVERAGE_WATCH_TIME') && m(aA, 'AVERAGE_WATCH_TIME').total, m(aB, 'AVERAGE_WATCH_TIME') && m(aB, 'AVERAGE_WATCH_TIME').total, fmtDurMs, 'high', life],
      ['Average percentage viewed', rA.avgPercentWatched, rB.avgPercentWatched, (x) => x.toFixed(1) + '%', 'high', life],
      // Unique viewers is computed per day and lags 1–2 days; a fresh 0 just means "not ready".
      ['Unique viewers', uniq(aA, S.a), uniq(aB, S.b), YSP.fmtFull, 'high', life],
    ]));

    // Over-time chart
    const metricDef = CHART_METRICS.find((c) => c[0] === S.chartMetric) || CHART_METRICS[0];
    const mseg = h('div', { class: 'seg' }, CHART_METRICS.filter(([k]) => m(aA, k) || m(aB, k)).map(([k, l]) =>
      h('button', { class: S.chartMetric === k ? 'on' : '', onclick: () => { S.chartMetric = k; rerender(); } }, l)));
    const scale = metricDef[3] || ((y) => y);
    const pts = (a) => seriesHours(m(a, metricDef[0]), a, W).map(([x, y]) => [x, scale(y)]);
    const lines = [
      { color: COLORS.a, label: 'A', points: pts(aA) },
      { color: COLORS.b, label: 'B', points: pts(aB) },
    ];
    const xMax = isFinite(W) ? W : Math.max(1, ...lines.map((l) => (l.points.length ? l.points[l.points.length - 1][0] : 0)));
    wrap.append(h('div', { class: 'card', style: 'margin-top:14px' },
      h('div', { class: 'card-hd' }, h('b', { text: metricDef[1] + ' over time' }), legend(), h('span', { class: 'grow' }), mseg),
      lines.some((l) => l.points.length > 1)
        ? lineChart({ lines, xMax, height: 280, xFmt: (x) => fmtAge(x, xMax), yFmt: metricDef[2], step: true, tipX: (x) => fmtAge(x, xMax, true) })
        : h('div', { class: 'nodata', text: 'No data for this range yet.' }),
      h('div', { class: 'hint', text: 'Lines start at each video\'s publish time, so the videos are compared at the same age.' })));

    // Retention + traffic
    const retLines = [
      { color: COLORS.a, label: 'A', points: (rA.values || []).map((y, i, arr) => [(i / Math.max(1, arr.length - 1)) * 100, y]) },
      { color: COLORS.b, label: 'B', points: (rB.values || []).map((y, i, arr) => [(i / Math.max(1, arr.length - 1)) * 100, y]) },
    ];
    const missing = retLines.filter((l) => !l.points.length).map((l) => l.label);
    const retCard = h('div', { class: 'card' },
      h('div', { class: 'card-hd' }, h('b', { text: 'Audience retention' }), legend(), h('span', { class: 'grow' }), h('span', { class: 'hint', text: 'lifetime' })),
      retLines.some((l) => l.points.length)
        ? lineChart({ lines: retLines, xMax: 100, yMax: 100, height: 230, xFmt: (x) => Math.round(x) + '%', yFmt: (y) => Math.round(y) + '%', tipX: (x) => `${Math.round(x)}% into the video` })
        : h('div', { class: 'nodata', text: 'Not enough views yet for retention data.' }),
      missing.length && missing.length < 2 ? h('div', { class: 'hint', text: `Video ${missing[0]} doesn't have enough views for retention data yet.` }) : null);
    wrap.append(h('div', { class: 'grid2' }, retCard, trafficCard(aA, aB)));
    wrap.append(h('div', { class: 'foot' }, 'Full Studio analytics: ',
      h('a', { href: `/video/${S.a}/analytics/tab-overview/period-default` }, 'A'), ' · ',
      h('a', { href: `/video/${S.b}/analytics/tab-overview/period-default` }, 'B')));
    return wrap;
  }

  function uniq(a, id) {
    const u = a.metrics.ESTIMATED_UNIQUE_VIEWERS;
    if (!u || u.total == null) return null;
    const age = ageHours(id);
    return u.total === 0 && age != null && age < 72 ? null : u.total;
  }

  function legend() {
    return h('span', { class: 'legend' },
      h('span', null, h('i', { style: `background:${COLORS.a}` }), 'A'),
      h('span', null, h('i', { style: `background:${COLORS.b}` }), 'B'));
  }

  function trafficCard(aA, aB) {
    const map = new Map();
    for (const t of aA.traffic || []) map.set(t.source, { a: t.pct, b: 0 });
    for (const t of aB.traffic || []) { const e = map.get(t.source) || { a: 0, b: 0 }; e.b = t.pct; map.set(t.source, e); }
    const rows = [...map.entries()].filter(([, v]) => v.a > 0 || v.b > 0).sort((x, y) => (y[1].a + y[1].b) - (x[1].a + x[1].b)).slice(0, 8);
    const bar = (pct, color) => h('div', { class: 'bt' }, h('span', { style: `width:${Math.min(100, pct)}%;background:${color}` }));
    return h('div', { class: 'card' },
      h('div', { class: 'card-hd' }, h('b', { text: 'Traffic sources' }), legend(), h('span', { class: 'grow' }), h('span', { class: 'hint', text: '% of views, lifetime' })),
      rows.length ? h('div', { class: 'bars' }, rows.map(([src, v]) => h('div', { class: 'bar-row' },
        h('div', { class: 'bl' }, h('span', { text: trafficLabel(src) }), h('span', { class: 'bv', text: `A ${v.a.toFixed(1)}% · B ${v.b.toFixed(1)}%` })),
        bar(v.a, COLORS.a), bar(v.b, COLORS.b))))
        : h('div', { class: 'nodata', text: 'No traffic source data yet.' }));
  }

  function fmtAge(hrs, xMax, long) {
    if (xMax <= 72) return long ? `${Math.round(hrs)} hours after publishing` : `${Math.round(hrs)}h`;
    const d = hrs / 24;
    return long ? `Day ${d < 10 ? d.toFixed(1) : Math.round(d)} after publishing` : `Day ${Math.round(d)}`;
  }

  // ---------------------------------------------------------------------------
  // Minimal SVG line chart with hover tooltip (redraws on resize)
  // ---------------------------------------------------------------------------
  // Round tick step (1, 2, 2.5, 5 × 10^n) so axis labels read 0, 25, 50…
  function niceStep(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function lineChart({ lines, xMax, yMax, height = 240, xFmt, yFmt, tipX, step }) {
    const box = h('div', { class: 'chart', style: `height:${height}px` });
    const tip = h('div', { class: 'tip hidden' });
    box.append(tip);
    const dataMax = Math.max(0, yMax || 0, ...lines.flatMap((l) => l.points.map((p) => p[1])));
    const yStep = niceStep(dataMax / 4);
    const yTop = Math.max(yStep, Math.ceil(dataMax / yStep) * yStep);
    const valueAtX = (pts, x) => {
      if (!pts.length) return null;
      if (step) { let v = null; for (const p of pts) { if (p[0] <= x + 1e-9) v = p[1]; else break; } return v; }
      let best = pts[0];
      for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
      return best[1];
    };
    let svg = null;
    const draw = () => {
      const W = Math.max(200, box.clientWidth);
      const pad = { l: 48, r: 12, t: 10, b: 26 };
      const iw = W - pad.l - pad.r, ih = height - pad.t - pad.b;
      const sx = (x) => pad.l + (x / xMax) * iw;
      const sy = (y) => pad.t + ih - (y / yTop) * ih;
      const el = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };
      const s = el('svg', { width: W, height, viewBox: `0 0 ${W} ${height}` });
      const g = el('g', { class: 'grid' });
      for (let y = 0; y <= yTop + 1e-9; y += yStep) {
        g.append(el('line', { x1: pad.l, x2: W - pad.r, y1: sy(y), y2: sy(y) }));
        const t = el('text', { x: pad.l - 8, y: sy(y) + 4, 'text-anchor': 'end' });
        t.textContent = yFmt(y);
        g.append(t);
      }
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const x = (xMax / ticks) * i;
        const t = el('text', { x: sx(x), y: height - 6, 'text-anchor': i === 0 ? 'start' : i === ticks ? 'end' : 'middle' });
        t.textContent = xFmt(x);
        g.append(t);
      }
      s.append(g);
      for (const l of lines) {
        if (!l.points.length) continue;
        let d = '';
        l.points.forEach(([x, y], i) => {
          const X = sx(Math.min(x, xMax)).toFixed(1), Y = sy(y).toFixed(1);
          if (i === 0) d += `M${X},${Y}`;
          else if (step) d += `H${X}V${Y}`;
          else d += `L${X},${Y}`;
        });
        s.append(el('path', { d, fill: 'none', stroke: l.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
      const guide = el('line', { class: 'guide', y1: pad.t, y2: pad.t + ih, x1: 0, x2: 0, visibility: 'hidden' });
      s.append(guide);
      s.addEventListener('mousemove', (e) => {
        const r = s.getBoundingClientRect();
        const px = e.clientX - r.left;
        if (px < pad.l || px > W - pad.r) { tip.classList.add('hidden'); guide.setAttribute('visibility', 'hidden'); return; }
        const x = ((px - pad.l) / iw) * xMax;
        guide.setAttribute('x1', px); guide.setAttribute('x2', px); guide.setAttribute('visibility', 'visible');
        tip.replaceChildren(h('b', { text: tipX ? tipX(x) : xFmt(x) }),
          ...lines.map((l) => { const v = valueAtX(l.points, x); return h('div', null, h('span', { style: `color:${l.color};font-weight:700`, text: l.label + ' ' }), v == null ? '–' : yFmt(v)); }));
        tip.classList.remove('hidden');
        const tw = tip.offsetWidth;
        tip.style.left = Math.min(W - tw - 4, Math.max(0, px + 12)) + 'px';
        tip.style.top = '8px';
      });
      s.addEventListener('mouseleave', () => { tip.classList.add('hidden'); guide.setAttribute('visibility', 'hidden'); });
      if (svg) svg.replaceWith(s); else box.prepend(s);
      svg = s;
    };
    const ro = new ResizeObserver(() => draw());
    ro.observe(box);
    return box;
  }

  YSP.nav.add({
    id: 'compare', label: 'Compare videos', icon: YSP.ICONS.compare, scope: 'both',
    onClick: () => open(YSP.detailsId(), null),
  });
})();
