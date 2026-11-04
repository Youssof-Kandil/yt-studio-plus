// Runs in the page's MAIN world so it can read ytcfg and call YouTube Studio's
// internal API (the same endpoints Studio itself uses) with your logged-in session.
// It talks to content.js through window.postMessage.
(() => {
  'use strict';
  if (window.__YSP_BRIDGE__) return;
  window.__YSP_BRIDGE__ = true;

  const ORIGIN = 'https://studio.youtube.com';
  const origFetch = window.fetch.bind(window);

  // ---------------------------------------------------------------------------
  // Capture the context/headers Studio uses for its own API calls. This is the
  // most reliable way to build requests that Studio's backend accepts
  // (brand accounts, delegated channels, session tokens, etc.).
  // ---------------------------------------------------------------------------
  const captured = { context: null, authUser: null, pageId: null };

  function noteBody(url, body) {
    try {
      if (!url || !String(url).includes('/youtubei/v1/') || typeof body !== 'string') return;
      const json = JSON.parse(body);
      if (json && json.context && json.context.client) captured.context = json.context;
    } catch (_) { /* ignore */ }
  }
  function noteHeader(name, value) {
    const n = String(name).toLowerCase();
    if (n === 'x-goog-authuser') captured.authUser = value;
    if (n === 'x-goog-pageid') captured.pageId = value;
  }

  try {
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url);
        if (init) {
          noteBody(url, init.body);
          const hd = init.headers;
          if (hd) {
            if (typeof hd.forEach === 'function' && !Array.isArray(hd)) hd.forEach((v, k) => noteHeader(k, v));
            else if (Array.isArray(hd)) hd.forEach(([k, v]) => noteHeader(k, v));
            else Object.keys(hd).forEach((k) => noteHeader(k, hd[k]));
          }
        }
      } catch (_) { /* never break Studio */ }
      return origFetch(input, init);
    };

    const XO = XMLHttpRequest.prototype.open;
    const XS = XMLHttpRequest.prototype.send;
    const XH = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__yspUrl = url;
      return XO.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
      try { if (String(this.__yspUrl || '').includes('/youtubei/')) noteHeader(k, v); } catch (_) {}
      return XH.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try { noteBody(this.__yspUrl, body); } catch (_) {}
      return XS.apply(this, arguments);
    };
  } catch (_) { /* ignore */ }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function cfg(key) {
    try { return window.ytcfg && typeof window.ytcfg.get === 'function' ? window.ytcfg.get(key) : undefined; }
    catch (_) { return undefined; }
  }
  function cookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  async function sha1(str) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function authHeader() {
    const ts = Math.floor(Date.now() / 1000);
    const parts = [];
    const sapisid = cookie('SAPISID') || cookie('__Secure-3PAPISID');
    if (sapisid) parts.push(`SAPISIDHASH ${ts}_${await sha1(`${ts} ${sapisid} ${ORIGIN}`)}`);
    const p1 = cookie('__Secure-1PAPISID');
    if (p1) parts.push(`SAPISID1PHASH ${ts}_${await sha1(`${ts} ${p1} ${ORIGIN}`)}`);
    const p3 = cookie('__Secure-3PAPISID');
    if (p3) parts.push(`SAPISID3PHASH ${ts}_${await sha1(`${ts} ${p3} ${ORIGIN}`)}`);
    return parts.join(' ');
  }

  function getChannelId() {
    const fromCfg = cfg('CHANNEL_ID');
    if (fromCfg) return fromCfg;
    const ctx = captured.context;
    const fromCtx = ctx && ctx.user && ctx.user.delegationContext && ctx.user.delegationContext.externalChannelId;
    if (fromCtx) return fromCtx;
    const m = location.pathname.match(/\/channel\/(UC[\w-]{22})/);
    return m ? m[1] : null;
  }

  function buildContext() {
    const channelId = getChannelId();
    let ctx;
    if (captured.context) {
      ctx = JSON.parse(JSON.stringify(captured.context));
    } else {
      const base = cfg('INNERTUBE_CONTEXT');
      ctx = base ? JSON.parse(JSON.stringify(base)) : {
        client: {
          clientName: cfg('INNERTUBE_CLIENT_NAME') || 62,
          clientVersion: cfg('INNERTUBE_CLIENT_VERSION') || '1.20250101.00.00',
          hl: cfg('HL') || 'en',
          gl: cfg('GL') || 'US',
        },
      };
    }
    ctx.user = ctx.user || {};
    if (channelId && !ctx.user.delegationContext) {
      ctx.user.delegationContext = {
        externalChannelId: channelId,
        roleType: { channelRoleType: 'CREATOR_CHANNEL_ROLE_TYPE_OWNER' },
      };
    }
    const delegated = cfg('DELEGATED_SESSION_ID');
    if (delegated && !ctx.user.onBehalfOfUser) ctx.user.onBehalfOfUser = delegated;
    ctx.request = ctx.request || {};
    if (ctx.request.returnErrorDetail === undefined) ctx.request.returnErrorDetail = true;
    return ctx;
  }

  async function innertube(endpoint, body) {
    const key = cfg('INNERTUBE_API_KEY');
    const url = `/youtubei/v1/${endpoint}?alt=json${key ? `&key=${encodeURIComponent(key)}` : ''}`;
    const headers = { 'Content-Type': 'application/json', 'X-Origin': ORIGIN };
    const auth = await authHeader();
    if (auth) headers.Authorization = auth;
    headers['X-Goog-AuthUser'] = String(captured.authUser ?? cfg('SESSION_INDEX') ?? '0');
    const pageId = captured.pageId || cfg('DELEGATED_SESSION_ID');
    if (pageId) headers['X-Goog-PageId'] = String(pageId);
    const cn = cfg('INNERTUBE_CONTEXT_CLIENT_NAME');
    if (cn) headers['X-Youtube-Client-Name'] = String(cn);
    const cv = cfg('INNERTUBE_CONTEXT_CLIENT_VERSION');
    if (cv) headers['X-Youtube-Client-Version'] = String(cv);

    const res = await origFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(Object.assign({ context: buildContext() }, body)),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* not json */ }
    if (!res.ok) {
      const err = new Error((json && json.error && json.error.message) || `YouTube Studio returned HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json || {};
  }

  // Try progressively smaller field masks: if YouTube rejects a field we asked
  // for (HTTP 400) we retry without it instead of failing outright.
  async function withMasks(masks, fn) {
    let lastErr;
    for (const mask of masks) {
      try { return await fn(mask); }
      catch (e) {
        lastErr = e;
        if (e.status && e.status !== 400) break;
      }
    }
    throw lastErr;
  }

  // Verified against live Studio (Nov 2026): publicMetrics -> {externalViewCount,
  // likeCount, commentCount}; tags -> [{value}]; category -> CREATOR_VIDEO_CATEGORY_*.
  const LIST_MASKS = [
    {
      videoId: true, title: true, description: true, lengthSeconds: true,
      thumbnailDetails: { all: true }, privacy: true, status: true, draftStatus: true,
      timeCreatedSeconds: true, timePublishedSeconds: true, publicMetrics: { all: true },
    },
    {
      videoId: true, title: true, lengthSeconds: true, thumbnailDetails: { all: true },
      privacy: true, timePublishedSeconds: true, timeCreatedSeconds: true,
    },
    { videoId: true, title: true, thumbnailDetails: { all: true } },
  ];

  const DETAIL_MASKS = [
    {
      videoId: true, title: true, description: true, tags: { all: true }, category: true,
      thumbnailDetails: { all: true }, privacy: true, timePublishedSeconds: true,
      timeCreatedSeconds: true, publicMetrics: { all: true }, privateMetrics: { all: true },
      lengthSeconds: true, originalFilename: true, gameTitle: { all: true }, ageRestriction: true,
      audienceRestriction: { all: true }, paidProductPlacement: true,
    },
    {
      videoId: true, title: true, description: true, tags: { all: true }, category: true,
      thumbnailDetails: { all: true }, privacy: true, timePublishedSeconds: true,
      timeCreatedSeconds: true, publicMetrics: { all: true },
    },
    { videoId: true, title: true, description: true, tags: { all: true }, thumbnailDetails: { all: true } },
    { videoId: true, title: true, description: true, tags: true },
    { videoId: true, title: true, description: true },
  ];

  const api = {
    async getConfig() {
      return { channelId: getChannelId(), hasCfg: !!window.ytcfg, captured: !!captured.context };
    },
    async listVideos({ pageToken, pageSize } = {}) {
      const channelId = getChannelId();
      if (!channelId) throw new Error('Could not detect your channel. Reload YouTube Studio and try again.');
      return withMasks(LIST_MASKS, async (mask) => {
        const body = {
          filter: { and: { operands: [{ channelIdIs: { value: channelId } }] } },
          order: 'VIDEO_ORDER_DISPLAY_TIME_DESC',
          pageSize: pageSize || 50,
          mask,
        };
        if (pageToken) body.pageToken = pageToken;
        const r = await innertube('creator/list_creator_videos', body);
        return { videos: r.videos || [], nextPageToken: r.nextPageToken || null, channelId };
      });
    },
    async getVideo({ videoId }) {
      if (!/^[\w-]{11}$/.test(videoId || '')) throw new Error('Bad video id');
      return withMasks(DETAIL_MASKS, async (mask) => {
        const r = await innertube('creator/get_creator_videos', { videoIds: [videoId], mask });
        const v = r.videos && r.videos[0];
        if (!v) throw new Error('Video not found');
        return v;
      });
    },
    // Likes / dislikes / comments / views for many videos at once (Content page column, Compare).
    async getMetrics({ videoIds }) {
      const ids = (videoIds || []).filter((id) => /^[\w-]{11}$/.test(id));
      const out = {};
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const r = await innertube('creator/get_creator_videos', {
          videoIds: chunk,
          mask: { videoId: true, publicMetrics: { all: true }, privateMetrics: { all: true } },
        });
        for (const v of r.videos || []) {
          const pm = v.publicMetrics || {};
          const pr = v.privateMetrics || {};
          out[v.videoId] = {
            views: pm.externalViewCount != null ? Number(pm.externalViewCount) : null,
            likes: pm.likeCount != null ? Number(pm.likeCount) : null,
            comments: pm.commentCount != null ? Number(pm.commentCount) : null,
            dislikes: pr.dislikeCount != null ? Number(pr.dislikeCount) : null,
            engagedViews: pr.engagedViewCount != null ? Number(pr.engagedViewCount) : null,
          };
        }
      }
      return out;
    },
    // Analytics for one video, straight from Studio's analytics endpoints (no page load):
    // key metrics with time series since publish, traffic sources, and audience retention.
    async getAnalytics({ videoId }) {
      if (!/^[\w-]{11}$/.test(videoId || '')) throw new Error('Bad video id');
      const tz = -new Date().getTimezoneOffset() * 60;
      const screenConfig = {
        entity: { videoId },
        timePeriod: { referencePoint: 'TIME_PERIOD_REFERENCE_POINT_SINCE_PUBLISH', timePeriodType: 'ANALYTICS_TIME_PERIOD_TYPE_SINCE_PUBLISH', entity: { videoId } },
        currency: 'USD',
        timeZoneOffsetSecs: tz,
      };
      const base = { autoUpdateInterval: 'ANALYTICS_AUTO_UPDATE_INTERVAL_NEVER', failureMode: 'ANALYTICS_CARD_FAILURE_MODE_FAIL_PAGE' };
      let metrics = ['EXTERNAL_VIEWS', 'EXTERNAL_WATCH_TIME', 'AVERAGE_WATCH_TIME', 'VIDEO_THUMBNAIL_IMPRESSIONS',
        'VIDEO_THUMBNAIL_IMPRESSIONS_VTR', 'SUBSCRIBERS_NET_CHANGE', 'ENGAGED_VIEWS', 'ESTIMATED_UNIQUE_VIEWERS'];
      const out = { metrics: {}, traffic: [], retention: null, publishedMs: null };

      // 1) key metrics + traffic sources (drop any metric Studio rejects and retry)
      for (let attempt = 0; attempt < 4 && metrics.length; attempt++) {
        try {
          const r = await innertube('yta_web/get_cards', {
            screenConfig, fetchingType: 'FETCHING_TYPE_FOREGROUND',
            cardConfigs: [
              Object.assign({ keyMetricCardConfig: { timePeriod: {}, metricTabConfigs: metrics.map((m) => ({ metric: m })) } }, base),
              Object.assign({ tableCardConfig: { dimension: 'TRAFFIC_SOURCE_TYPE', metrics: ['EXTERNAL_VIEWS'], order: 'ANALYTICS_TABLE_CARD_ORDER_TOP_METRIC', asPercentagesOfTotal: true, maxRowCount: 50 } }, base),
            ],
          });
          for (const card of r.cards || []) {
            const tabs = card.keyMetricCardData && card.keyMetricCardData.keyMetricTabs;
            if (tabs) {
              for (const t of tabs) {
                const p = t.primaryContent || {};
                const s = p.mainSeries || {};
                const datums = (s.datums || []).map((d) => [Number(d.x), Number(d.y)]);
                // Views (hour/minute series) start exactly at publish time; calendar-day
                // series (e.g. unique viewers) start at midnight before it, so don't use those.
                if (datums.length && p.metric === 'EXTERNAL_VIEWS') out.publishedMs = datums[0][0];
                else if (datums.length && out.publishedMs == null && /NTH_/.test(s.timeUnit || '')) out.publishedMs = datums[0][0];
                out.metrics[p.metric] = {
                  total: p.total != null ? Number(p.total) : null,
                  series: datums,
                  cumulative: !!s.isCumulative,
                  unit: s.timeUnit || null,
                  typical: p.typicalPerformanceTotal && p.typicalPerformanceTotal.typicalValue != null ? Number(p.typicalPerformanceTotal.typicalValue) : null,
                };
              }
            }
            const tbl = card.tableCardData && card.tableCardData.mainTableData;
            if (tbl) {
              const dims = (tbl.dimensionColumns && tbl.dimensionColumns[0] && tbl.dimensionColumns[0].enumValues && tbl.dimensionColumns[0].enumValues.values) || [];
              const pcts = (tbl.metricColumns && tbl.metricColumns[0] && tbl.metricColumns[0].percentages && tbl.metricColumns[0].percentages.values) || [];
              out.traffic = dims.map((d, i) => ({ source: d, pct: Number(pcts[i] || 0) }));
            }
          }
          break;
        } catch (e) {
          const bad = [...String(e.message).matchAll(/metric_tab_configs\[(\d+)\]/g)].map((m) => Number(m[1]));
          if (e.status === 400 && bad.length) metrics = metrics.filter((_, i) => !bad.includes(i));
          else { out.error = e.message; break; }
        }
      }

      // 2) audience retention (comes with the overview screen)
      try {
        const r = await innertube('yta_web/get_screen', {
          screenConfig: { entity: { videoId }, currency: 'USD', timeZoneOffsetSecs: tz },
          desktopState: { tabId: 'ANALYTICS_TAB_ID_OVERVIEW' },
          fetchingType: 'FETCHING_TYPE_FOREGROUND',
        });
        for (const card of r.cards || []) {
          const vd = card.audienceRetentionHighlightsCardData && card.audienceRetentionHighlightsCardData.videosData;
          const v = vd && (vd.find((x) => x.videoId === videoId) || vd[0]);
          if (v && Array.isArray(v.retentionValues)) {
            const t = v.metricTotals || {};
            out.retention = {
              values: v.retentionValues.map(Number),
              avgViewDurationMs: t.avgViewDurationMillis != null ? Number(t.avgViewDurationMillis) : null,
              avgPercentWatched: t.avgPercentageWatched != null ? Number(t.avgPercentageWatched) * 100 : null,
            };
          }
        }
      } catch (_) { /* retention is optional (not enough data yet) */ }
      return out;
    },
    // Original upload file names, used to suggest templates from a new file's name.
    async getFilenames({ videoIds }) {
      const ids = (videoIds || []).filter((id) => /^[\w-]{11}$/.test(id));
      const out = {};
      for (let i = 0; i < ids.length; i += 50) {
        const r = await innertube('creator/get_creator_videos', {
          videoIds: ids.slice(i, i + 50),
          mask: { videoId: true, originalFilename: true },
        });
        for (const v of r.videos || []) if (v.originalFilename) out[v.videoId] = v.originalFilename;
      }
      return out;
    },
  };

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__ysp !== 'req' || typeof d.id !== 'string') return;
    const fn = api[d.method];
    const reply = (payload) => window.postMessage(Object.assign({ __ysp: 'res', id: d.id }, payload), location.origin);
    if (!fn) return reply({ ok: false, error: 'Unknown method ' + d.method });
    try {
      const data = await fn(d.args || {});
      reply({ ok: true, data });
    } catch (err) {
      reply({ ok: false, error: String((err && err.message) || err) });
    }
  });
})();
