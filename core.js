// Studio Plus – shared core (isolated world). Every other content script
// (panel, templates, likes, compare) builds on window.YSP defined here.
(() => {
  'use strict';
  if (window.YSP) return;
  const YSP = (window.YSP = {});

  // ---------------------------------------------------------------------------
  // Bridge to inject.js (MAIN world)
  // ---------------------------------------------------------------------------
  let seq = 0;
  const pending = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__ysp !== 'res') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.ok) p.resolve(d.data); else p.reject(new Error(d.error || 'Request failed'));
  });
  YSP.call = function call(method, args, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = `ysp${++seq}_${Date.now()}`;
      pending.set(id, { resolve, reject });
      window.postMessage({ __ysp: 'req', id, method, args }, location.origin);
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error('Timed out talking to YouTube Studio')); }
      }, timeout);
    });
  };
  YSP.watchPageFallback = function (videoId) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'ysp:watchPage', videoId }, (r) => {
          if (chrome.runtime.lastError || !r || !r.ok) resolve(null); else resolve(r.data);
        });
      } catch (_) { resolve(null); }
    });
  };

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------
  const sleep = (YSP.sleep = (ms) => new Promise((r) => setTimeout(r, ms)));
  YSP.waitFor = async function (fn, timeout = 3000, step = 100) {
    const end = Date.now() + timeout;
    for (;;) {
      let v;
      try { v = fn(); } catch (_) { v = null; }
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(step);
    }
  };
  YSP.visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const h = (YSP.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  });
  YSP.icon = function (d, size = 20) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'currentColor');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
    return s;
  };
  YSP.ICONS = {
    template: 'M4 3h11l5 5v13H4V3zm2 2v14h12V9h-4V5H6zm2 7h8v2H8v-2zm0 4h8v2H8v-2zm0-8h4v2H8V8z',
    compare: 'M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  };
  const nf = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  YSP.fmtNum = (n) => (n == null || isNaN(n) ? '–' : nf.format(n));
  YSP.fmtFull = (n) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString());
  YSP.fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
  YSP.fmtDur = (s) => {
    s = Number(s) || 0;
    if (!s) return '';
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
  };
  YSP.CATEGORIES = [
    ['CREATOR_VIDEO_CATEGORY_AUTOS', 'Autos & Vehicles'],
    ['CREATOR_VIDEO_CATEGORY_COMEDY', 'Comedy'],
    ['CREATOR_VIDEO_CATEGORY_EDUCATION', 'Education'],
    ['CREATOR_VIDEO_CATEGORY_ENTERTAINMENT', 'Entertainment'],
    ['CREATOR_VIDEO_CATEGORY_FILM', 'Film & Animation'],
    ['CREATOR_VIDEO_CATEGORY_GADGETS', 'Gaming'],
    ['CREATOR_VIDEO_CATEGORY_HOWTO', 'Howto & Style'],
    ['CREATOR_VIDEO_CATEGORY_MUSIC', 'Music'],
    ['CREATOR_VIDEO_CATEGORY_NEWS', 'News & Politics'],
    ['CREATOR_VIDEO_CATEGORY_GOVERNMENT', 'Nonprofits & Activism'],
    ['CREATOR_VIDEO_CATEGORY_PEOPLE', 'People & Blogs'],
    ['CREATOR_VIDEO_CATEGORY_PETS', 'Pets & Animals'],
    ['CREATOR_VIDEO_CATEGORY_SCIENCE', 'Science & Technology'],
    ['CREATOR_VIDEO_CATEGORY_SPORTS', 'Sports'],
    ['CREATOR_VIDEO_CATEGORY_TRAVEL', 'Travel & Events'],
  ];
  YSP.GAMING = 'CREATOR_VIDEO_CATEGORY_GADGETS';
  YSP.categoryLabel = (id) => {
    const f = YSP.CATEGORIES.find((c) => c[0] === id);
    return f ? f[1] : (id ? String(id).replace(/^CREATOR_VIDEO_CATEGORY_/, '').toLowerCase() : '');
  };
  YSP.LANGUAGES = ['English', 'English (United States)', 'English (United Kingdom)', 'Spanish', 'Spanish (Spain)', 'Spanish (Latin America)', 'Portuguese', 'Portuguese (Brazil)', 'French', 'German', 'Italian', 'Dutch', 'Arabic', 'Hindi', 'Urdu', 'Bengali', 'Punjabi', 'Tamil', 'Telugu', 'Japanese', 'Korean', 'Chinese', 'Indonesian', 'Filipino', 'Turkish', 'Russian', 'Ukrainian', 'Polish', 'Swedish', 'Vietnamese', 'Thai', 'Not applicable'];

  YSP.extractTags = function (t) {
    if (!t) return [];
    const toStr = (x) => (typeof x === 'string' ? x : x && (x.value || x.tag || x.text)) || null;
    if (Array.isArray(t)) return t.map(toStr).filter(Boolean);
    if (typeof t === 'object') for (const v of Object.values(t)) if (Array.isArray(v)) return v.map(toStr).filter(Boolean);
    return [];
  };
  function bestThumb(v) {
    const list = (v.thumbnailDetails && v.thumbnailDetails.thumbnails) || [];
    const pick = list.find((t) => t.width >= 160 && t.width <= 400) || list[list.length - 1];
    return (pick && pick.url) || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
  }
  YSP.normVideo = function (v) {
    const pm = v.publicMetrics || v.metrics || {};
    const pr = v.privateMetrics || {};
    const privacy = String(v.privacy || '').replace('VIDEO_PRIVACY_', '').toLowerCase();
    const draft = !!(v.draftStatus && v.draftStatus !== 'DRAFT_STATUS_NONE');
    const pub = Number(v.timePublishedSeconds || 0);
    const created = Number(v.timeCreatedSeconds || 0);
    const num = (x) => (x != null ? Number(x) : null);
    return {
      id: v.videoId,
      title: v.title || '(untitled)',
      description: typeof v.description === 'string' ? v.description : null,
      thumb: bestThumb(v),
      privacy: draft ? 'draft' : (privacy || 'unknown'),
      ts: pub || created,
      tsLabel: pub ? 'Published' : 'Uploaded',
      views: num(pm.externalViewCount != null ? pm.externalViewCount : pm.viewCount),
      likes: num(pm.likeCount),
      comments: num(pm.commentCount),
      dislikes: num(pr.dislikeCount),
      engagedViews: num(pr.engagedViewCount),
      length: Number(v.lengthSeconds || 0),
    };
  };

  YSP.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0;left:-9999px' });
      ta.value = text;
      document.documentElement.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  };

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------
  YSP.store = {
    async get(key, area = 'local') {
      try { const r = await chrome.storage[area].get(key); return r[key]; } catch (_) { return undefined; }
    },
    async set(key, value, area = 'local') {
      try { await chrome.storage[area].set({ [key]: value }); return true; } catch (_) { return false; }
    },
  };

  // ---------------------------------------------------------------------------
  // Shared video list (used by panel, templates, compare)
  // ---------------------------------------------------------------------------
  const V = (YSP.videos = {
    list: [], nextToken: null, loading: false, loadedOnce: false, error: null, channelId: null,
    _subs: new Set(),
    subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
    _emit() { for (const fn of this._subs) { try { fn(); } catch (e) { console.error('[Studio Plus]', e); } } },
  });
  const cacheKey = () => `ysp_cache_${V.channelId || 'x'}`;
  V.load = async function ({ more = false } = {}) {
    if (V.loading) return V._p;
    V.loading = true; V.error = null; V._emit();
    V._p = (async () => {
      try {
        if (!V.channelId) {
          const c = await YSP.call('getConfig');
          V.channelId = c.channelId;
          if (!more && !V.list.length) {
            const cached = await YSP.store.get(cacheKey());
            if (cached && Array.isArray(cached.videos)) { V.list = cached.videos; V._emit(); }
          }
        }
        const r = await YSP.call('listVideos', { pageToken: more ? V.nextToken : null, pageSize: 50 });
        const vids = r.videos.map(YSP.normVideo).filter((v) => v.id);
        if (more) {
          const seen = new Set(V.list.map((v) => v.id));
          V.list = V.list.concat(vids.filter((v) => !seen.has(v.id)));
        } else V.list = vids;
        V.nextToken = r.nextPageToken;
        V.loadedOnce = true;
        YSP.store.set(cacheKey(), { at: Date.now(), videos: V.list.slice(0, 300) });
      } catch (e) {
        V.error = e.message;
      } finally {
        V.loading = false;
        V._emit();
      }
    })();
    return V._p;
  };
  V.ensure = function () { if (!V.loadedOnce && !V.loading) return V.load(); return V._p; };
  V.loadAll = async function () {
    if (!V.loadedOnce) await V.load();
    let guard = 0;
    while (V.nextToken && guard++ < 60) { await V.load({ more: true }); if (V.error) break; }
  };
  V.get = (id) => V.list.find((v) => v.id === id);

  // ---------------------------------------------------------------------------
  // Page detection
  // ---------------------------------------------------------------------------
  YSP.uploadDialogEl = function () {
    const d = document.querySelector('ytcp-uploads-dialog');
    if (!d) return null;
    const inner = d.querySelector('tp-yt-paper-dialog, #dialog') || d;
    return YSP.visible(inner) ? d : null;
  };
  YSP.detailsId = function () {
    const m = location.pathname.match(/^\/video\/([\w-]{11})(?:\/|$)/);
    return m ? m[1] : null;
  };
  YSP.channelPath = function () {
    const m = location.pathname.match(/^\/channel\/(UC[\w-]{22})/);
    return m ? m[1] : null;
  };
  YSP.mode = function () {
    if (YSP.uploadDialogEl()) return 'upload';
    if (YSP.detailsId()) return 'details';
    return 'other';
  };
  YSP.uploadingVideoId = function (dlg) {
    dlg = dlg || YSP.uploadDialogEl();
    const a = dlg && dlg.querySelector('a[href*="youtu.be/"], a[href*="watch?v="], a[href*="/shorts/"]');
    if (!a) return null;
    const m = a.href.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  };
  // File name shown in the form ("Filename" on the upload dialog and on details pages), without extension.
  YSP.uploadFilename = function () {
    const dlg = YSP.uploadDialogEl() || (YSP.detailsId() ? document.querySelector('ytcp-video-metadata-editor-sidepanel') || document : null);
    if (!dlg) return '';
    const labels = [...dlg.querySelectorAll('div, span')].filter((e) => e.childElementCount === 0 && /^\s*filename\s*$/i.test(e.textContent || ''));
    for (const l of labels) {
      const val = l.nextElementSibling || (l.parentElement && l.parentElement.nextElementSibling);
      const t = val && val.textContent && val.textContent.trim();
      if (t) return t.replace(/\.[a-z0-9]{2,5}$/i, '');
    }
    const fn = dlg.querySelector('.filename, #filename, [class*="filename"] .value');
    if (fn && fn.textContent.trim()) return fn.textContent.trim().replace(/\.[a-z0-9]{2,5}$/i, '');
    return '';
  };

  // ---------------------------------------------------------------------------
  // Studio form: read & write every field a template can hold
  // ---------------------------------------------------------------------------
  const F = (YSP.form = {});
  F.root = () => YSP.uploadDialogEl() || document;
  F.available = () => !!F.root().querySelector('#title-textarea #textbox');
  F.targetLabel = () => {
    const m = YSP.mode();
    if (m === 'upload') return 'the video you are uploading';
    if (m === 'details' && F.available()) return 'this video (click Save after)';
    return null;
  };
  F.findEditable = function (kind) {
    const root = F.root();
    const sels = kind === 'title'
      ? ['#title-textarea #textbox', '#textbox[aria-label^="Add a title" i]']
      : ['#description-textarea #textbox', '#textbox[aria-label^="Tell viewers" i]'];
    for (const s of sels) { const el = root.querySelector(s); if (el) return el; }
    return null;
  };
  F.writeEditable = function (el, text, append) {
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    if (append) range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    let insert = text;
    if (append) {
      const cur = el.innerText.replace(/\n+$/, '');
      insert = (cur ? '\n\n' : '') + text;
    }
    let ok = false;
    try { ok = insert ? document.execCommand('insertText', false, insert) : document.execCommand('delete'); } catch (_) { ok = false; }
    if (!ok) {
      el.textContent = append ? el.innerText + insert : text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: insert }));
    }
    el.blur();
  };
  F.setText = function (kind, text, append) {
    const el = F.findEditable(kind);
    if (!el) throw new Error(`Could not find the ${kind} box.`);
    F.writeEditable(el, text, append);
  };
  F.getText = (kind) => { const el = F.findEditable(kind); return el ? el.innerText.replace(/\n$/, '') : ''; };

  F.ensureShowMore = async function () {
    const root = F.root();
    if (root.querySelector('ytcp-free-text-chip-bar input#text-input')) return;
    const btn = [...root.querySelectorAll('ytcp-button#toggle-button, #toggle-button')].find((b) => /show more/i.test(b.innerText || ''));
    if (btn) {
      btn.click();
      await YSP.waitFor(() => root.querySelector('ytcp-free-text-chip-bar input#text-input'), 2500);
    }
  };
  const tagsInput = (root) => root.querySelector('ytcp-free-text-chip-bar input#text-input') || root.querySelector('#tags-container input') || root.querySelector('input[aria-label="Tags"]');
  const chipBar = (root) => root.querySelector('ytcp-free-text-chip-bar') || root.querySelector('#tags-container');
  F.getTags = function () {
    const bar = chipBar(F.root());
    if (!bar) return [];
    return [...bar.querySelectorAll('ytcp-chip')].map((c) => (c.getAttribute('text') || c.innerText || '').trim()).filter(Boolean);
  };
  F.addTags = async function (tags) {
    await F.ensureShowMore();
    const root = F.root();
    const input = tagsInput(root);
    if (!input) throw new Error('Could not find the Tags box. Click "Show more" in the form and try again.');
    const existing = new Set(F.getTags().map((t) => t.toLowerCase()));
    tags = tags.filter((t) => t && !existing.has(t.toLowerCase()));
    if (!tags.length) return { added: 0, leftover: false };
    const count = () => { const b = chipBar(root); return b ? b.querySelectorAll('ytcp-chip').length : 0; };
    const before = count();
    input.focus();
    const ok = document.execCommand('insertText', false, tags.join(','));
    if (!ok) { input.value = tags.join(','); input.dispatchEvent(new Event('input', { bubbles: true })); }
    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', enter));
    input.dispatchEvent(new KeyboardEvent('keyup', enter));
    await sleep(300);
    if (count() === before && input.value) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      await sleep(250);
    }
    return { added: count() - before, leftover: !!input.value };
  };

  F.radio = (name) => F.root().querySelector(`tp-yt-paper-radio-button[name="${name}"]`);
  F.isChecked = (el) => !!el && (el.getAttribute('aria-checked') === 'true' || el.hasAttribute('checked'));
  F.setRadio = async function (name) {
    const r = F.radio(name);
    if (!r) throw new Error('Could not find option ' + name);
    if (!F.isChecked(r)) { r.click(); await sleep(150); }
    return F.isChecked(r);
  };
  F.radioValue = function (yesName, noName) {
    const y = F.radio(yesName), n = F.radio(noName);
    if (F.isChecked(y)) return 'yes';
    if (F.isChecked(n)) return 'no';
    return null;
  };
  F.RADIOS = {
    madeForKids: ['VIDEO_MADE_FOR_KIDS_MFK', 'VIDEO_MADE_FOR_KIDS_NOT_MFK'],
    ageRestricted: ['VIDEO_AGE_RESTRICTION_SELF', 'VIDEO_AGE_RESTRICTION_NONE'],
    paidPromotion: ['VIDEO_PAID_PRODUCT_PLACEMENT_NOTIFY', 'VIDEO_PAID_PRODUCT_PLACEMENT_NO'],
    alteredContent: ['VIDEO_HAS_ALTERED_CONTENT_YES', 'VIDEO_HAS_ALTERED_CONTENT_NO'],
  };

  // Open a Studio dropdown and click the item whose test-id or text matches.
  F.pickFromDropdown = async function (trigger, match) {
    if (!trigger) throw new Error('Dropdown not found');
    trigger.click();
    const item = await YSP.waitFor(() => {
      const items = [...document.querySelectorAll('tp-yt-paper-listbox tp-yt-paper-item')].filter(YSP.visible);
      return items.find(match) || null;
    }, 3000);
    if (!item) {
      // close the menu again without changing anything
      const sel = [...document.querySelectorAll('tp-yt-paper-listbox tp-yt-paper-item[aria-selected="true"]')].find(YSP.visible);
      if (sel) sel.click(); else trigger.click();
      return false;
    }
    item.click();
    await sleep(300);
    return true;
  };
  const norm = (s) => String(s || '').trim().toLowerCase();
  F.categoryTrigger = () => F.root().querySelector('ytcp-form-select#category ytcp-dropdown-trigger');
  F.getCategory = () => { const el = F.root().querySelector('ytcp-form-select#category'); return el ? el.innerText.trim() : ''; };
  F.setCategory = async function (idOrLabel) {
    await F.ensureShowMore();
    const want = norm(idOrLabel);
    const label = norm(YSP.categoryLabel(idOrLabel));
    if (norm(F.getCategory()) === label) return true;
    return F.pickFromDropdown(F.categoryTrigger(), (i) => norm(i.getAttribute('test-id')) === want || norm(i.innerText) === want || norm(i.innerText) === label);
  };
  F.languageTrigger = () => F.root().querySelector('ytcp-form-language-input#language-input ytcp-dropdown-trigger');
  F.getLanguage = () => {
    const el = F.root().querySelector('ytcp-form-language-input#language-input');
    return el ? el.innerText.replace(/^\s*Video language\s*/i, '').trim() : '';
  };
  F.setLanguage = async function (codeOrLabel) {
    await F.ensureShowMore();
    const want = norm(codeOrLabel);
    if (norm(F.getLanguage()) === want) return true;
    return F.pickFromDropdown(F.languageTrigger(), (i) => norm(i.getAttribute('test-id')) === want || norm(i.innerText) === want);
  };
  F.getGame = () => { const i = F.root().querySelector('ytcp-form-gaming input'); return i ? i.value.trim() : ''; };
  F.setGame = async function (title) {
    await F.ensureShowMore();
    const g = await YSP.waitFor(() => F.root().querySelector('ytcp-form-gaming'), 2000);
    if (!g) throw new Error('Game title only appears when the category is Gaming.');
    if (norm(F.getGame()) === norm(title)) return true;
    let input = g.querySelector('input');
    if (!input) { const t = g.querySelector('ytcp-dropdown-trigger'); if (t) t.click(); input = await YSP.waitFor(() => g.querySelector('input'), 1500); }
    if (!input) throw new Error('Could not open the game title box.');
    input.focus();
    input.select();
    document.execCommand('insertText', false, title);
    const want = norm(title);
    const item = await YSP.waitFor(() => {
      const items = [...document.querySelectorAll('tp-yt-paper-listbox tp-yt-paper-item')].filter(YSP.visible);
      const real = items.filter((i) => { const t = i.getAttribute('test-id') || ''; return t.startsWith('{'); });
      if (!real.length) return null;
      const exact = real.find((i) => { try { return norm(JSON.parse(i.getAttribute('test-id')).title) === want; } catch (_) { return false; } });
      return exact || real[0];
    }, 4000);
    if (!item) throw new Error(`No game named "${title}" found.`);
    item.click();
    await sleep(300);
    return true;
  };

  F.playlistTrigger = () => F.root().querySelector('ytcp-video-metadata-playlists ytcp-dropdown-trigger');
  F.getPlaylists = () => {
    const el = F.root().querySelector('ytcp-video-metadata-playlists ytcp-dropdown-trigger');
    const t = el ? el.innerText.trim() : '';
    if (!t || /^select$/i.test(t)) return [];
    return t.split(/\s*,\s*/).filter(Boolean);
  };
  // Opens Studio's playlist picker, ticks the wanted playlists (by name or id) and
  // unticks others when `exclusive`. Also remembers all playlist names it sees.
  F.setPlaylists = async function (wanted, { exclusive = false } = {}) {
    const trig = F.playlistTrigger();
    if (!trig) throw new Error('Could not find the Playlists box.');
    trig.click();
    const dlg = await YSP.waitFor(() => [...document.querySelectorAll('tp-yt-paper-dialog')].find((d) => YSP.visible(d) && d.querySelector('ytcp-checkbox-group ytcp-checkbox-lit, ytcp-checkbox-lit')), 3000);
    if (!dlg) throw new Error('Playlist picker did not open.');
    await sleep(250);
    const want = wanted.map(norm);
    const seen = [];
    const missing = new Set(want);
    for (const cb of dlg.querySelectorAll('ytcp-checkbox-lit')) {
      const label = (cb.closest('label') || cb.parentElement).innerText.trim();
      const id = cb.getAttribute('test-id') || '';
      if (!label) continue;
      seen.push(label);
      const match = want.includes(norm(label)) || (id && want.includes(norm(id)));
      if (match) { missing.delete(norm(label)); missing.delete(norm(id)); }
      const checked = cb.getAttribute('aria-checked') === 'true' || cb.hasAttribute('checked');
      if ((match && !checked) || (exclusive && !match && checked)) { cb.click(); await sleep(120); }
    }
    YSP.store.set('ysp_playlists', seen);
    const done = [...dlg.querySelectorAll('ytcp-button.done-button, .done-button')].find(YSP.visible);
    if (done) done.click();
    await sleep(400);
    return { missing: [...missing] };
  };

  // Snapshot of the current form (for "Save current form as template").
  F.read = function () {
    const v = {
      title: F.getText('title'),
      description: F.getText('description'),
      tags: F.getTags(),
      playlists: F.getPlaylists(),
      category: F.getCategory(),
      language: F.getLanguage(),
      gameTitle: F.getGame(),
    };
    for (const [k, [y, n]] of Object.entries(F.RADIOS)) v[k] = F.radioValue(y, n);
    return v;
  };

  // ---------------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------------
  const toastHost = h('div', { id: 'ysp-toast-host' });
  const toastShadow = toastHost.attachShadow({ mode: 'open' });
  const toastStyle = h('style');
  toastStyle.textContent = `
    .toasts { position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 2147483601; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; font: 13px/1.4 Roboto, "Segoe UI", Arial, sans-serif; }
    .toast { background: #202124; color: #fff; padding: 10px 14px; border-radius: 8px; max-width: 460px; box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: opacity .4s, transform .4s; border-left: 4px solid #b3a4ff; }
    .toast.warn { border-left-color: #fdd663; } .toast.error { border-left-color: #f28b82; } .toast.out { opacity: 0; transform: translateY(6px); }`;
  const toastBox = h('div', { class: 'toasts' });
  toastShadow.append(toastStyle, toastBox);
  document.documentElement.append(toastHost);
  YSP.toast = function (msg, kind = 'ok', ms = 4200) {
    const t = h('div', { class: `toast ${kind}`, text: msg });
    toastBox.append(t);
    setTimeout(() => t.classList.add('out'), ms - 400);
    setTimeout(() => t.remove(), ms);
  };

  // ---------------------------------------------------------------------------
  // Shared look (CSS vars + controls) for every shadow root we create
  // ---------------------------------------------------------------------------
  YSP.isDark = () => document.documentElement.hasAttribute('dark');
  YSP.BASE_CSS = `
:host { all: initial; }
/* Backgrounds match Studio exactly; --accent is the Studio Plus signature violet,
   used only on things this extension adds so they're easy to tell apart. */
:host { --bg: #ffffff; --bg2: #f9f9f9; --bg3: #f0f0f0; --fg: #0f0f0f; --muted: #606060; --line: #e5e5e5;
  --accent: #6a4fd6; --accent-fg: #fff; --accent-soft: rgba(106, 79, 214, 0.08); --hover: rgba(0, 0, 0, 0.05);
  --ok: #0b8043; --warn: #b06000; --err: #c5221f; --cur: rgba(106, 79, 214, 0.1);
  --good: #1e8e3e; font: 13px/1.4 Roboto, "Segoe UI", Arial, sans-serif; color: var(--fg); }
:host(.dark) { --bg: #0f0f0f; --bg2: #1a1a1a; --bg3: #272727; --fg: #f1f1f1; --muted: #aaaaaa; --line: #2e2e2e;
  --accent: #b3a4ff; --accent-fg: #0f0f0f; --accent-soft: rgba(179, 164, 255, 0.10); --hover: rgba(255, 255, 255, 0.08);
  --cur: rgba(179, 164, 255, 0.12); --good: #81c995; }
.brand { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 10px; letter-spacing: .2px; white-space: nowrap; }
.brand::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; color: inherit; }
a { color: inherit; text-decoration: none; }
.hidden { display: none !important; }
.muted { color: var(--muted); } .small { font-size: 11px; } .center { text-align: center; }
.btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg2); cursor: pointer; font-weight: 500; white-space: nowrap; }
.btn:hover { background: var(--bg3); }
.btn:disabled { opacity: .5; cursor: default; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.danger { color: var(--err); }
.btn.wide { display: block; width: calc(100% - 12px); margin: 8px 6px; }
.btn.big { padding: 10px; font-size: 14px; }
.link { background: none; border: 0; color: var(--accent); cursor: pointer; padding: 4px 0; }
.input, select.input, textarea.input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); outline: none; }
.input:focus { border-color: var(--accent); }
textarea.input { resize: vertical; min-height: 90px; line-height: 1.45; }
.loading { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 16px; color: var(--muted); }
.spin { width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: s .8s linear infinite; }
@keyframes s { to { transform: rotate(360deg); } }
.error { margin: 10px 6px; padding: 10px; border-radius: 8px; color: var(--err); background: color-mix(in srgb, var(--err) 10%, transparent); }
.pill { text-transform: capitalize; font-size: 10.5px; padding: 0 6px; border-radius: 9px; background: var(--bg3); }
.pill.public { color: var(--ok); } .pill.private { color: var(--muted); } .pill.unlisted { color: var(--warn); } .pill.draft { color: var(--err); }
`;
  YSP.makeHost = function (id, css) {
    const host = h('div', { id });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = h('style');
    style.textContent = YSP.BASE_CSS + (css || '');
    shadow.append(style);
    document.documentElement.append(host);
    host.classList.toggle('dark', YSP.isDark());
    // Keep Studio's dialogs/shortcuts from reacting to focus & keys inside our UI.
    for (const type of ['focus', 'focusin', 'keydown', 'keyup', 'keypress']) {
      window.addEventListener(type, (e) => { if (e.target === host) e.stopImmediatePropagation(); }, true);
    }
    return { host, shadow };
  };

  // ---------------------------------------------------------------------------
  // Full-page views drawn over Studio's main content area (Templates, Compare)
  // ---------------------------------------------------------------------------
  const pageUI = YSP.makeHost('ysp-page-host', `
.page { position: fixed; z-index: 2147482000; background: var(--bg); color: var(--fg); overflow: auto; display: none; }
.page.open { display: block; }
.page-inner { max-width: 1400px; margin: 0 auto; padding: 24px 32px 48px; }
.page-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.page-hd h1 { font-size: 24px; font-weight: 600; margin: 0; flex: 1; display: flex; align-items: center; }
.close { background: none; border: 0; font-size: 18px; cursor: pointer; color: var(--muted); width: 36px; height: 36px; border-radius: 50%; }
.close:hover { background: var(--hover); color: var(--fg); }
`);
  const pageEl = h('div', { class: 'page' });
  pageUI.shadow.append(pageEl);
  YSP.page = { current: null, shadow: pageUI.shadow, el: pageEl, _styles: new Map() };
  YSP.page.addStyle = function (name, css) {
    if (YSP.page._styles.has(name)) return;
    const st = h('style');
    st.textContent = css;
    pageUI.shadow.append(st);
    YSP.page._styles.set(name, st);
  };
  function mainRect() {
    const main = document.querySelector('ytcp-entity-page main#main') || document.querySelector('main#main');
    if (main && YSP.visible(main)) return main.getBoundingClientRect();
    const nav = document.querySelector('ytcp-navigation-drawer');
    const hdr = document.querySelector('ytcp-header');
    const left = nav ? nav.getBoundingClientRect().right : 0;
    const top = hdr ? hdr.getBoundingClientRect().bottom : 64;
    const right = document.documentElement.classList.contains('ysp-push') ? window.innerWidth - 400 : window.innerWidth;
    return { left, top, width: right - left, height: window.innerHeight - top };
  }
  YSP.page.position = function () {
    if (!YSP.page.current) return;
    const r = mainRect();
    Object.assign(pageEl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  // open(name, render) — render(container, api) builds the page; api.close()
  YSP.page.open = function (name, render) {
    YSP.page.current = { name, path: location.pathname };
    pageUI.host.classList.toggle('dark', YSP.isDark());
    pageEl.replaceChildren();
    pageEl.classList.add('open');
    YSP.page.position();
    pageEl.scrollTop = 0;
    render(pageEl);
    YSP.nav.refresh();
  };
  YSP.page.close = function () {
    if (!YSP.page.current) return;
    YSP.page.current = null;
    pageEl.classList.remove('open');
    pageEl.replaceChildren();
    YSP.nav.refresh();
  };
  YSP.page.header = function (title, extra) {
    return h('div', { class: 'page-hd' }, h('h1', null, title, ' ', h('span', { class: 'brand', style: 'vertical-align: middle; margin-left: 8px', text: 'Studio Plus' })), extra || null,
      h('button', { class: 'close', title: 'Close', onclick: () => YSP.page.close() }, '✕'));
  };
  window.addEventListener('resize', () => YSP.page.position());

  // ---------------------------------------------------------------------------
  // Extra items in Studio's left menu
  // ---------------------------------------------------------------------------
  const NAV = (YSP.nav = { items: [] });
  // scope: 'channel' (main channel menu), 'video' (inside a video), or 'both'
  NAV.add = function (item) { NAV.items.push(item); NAV.refresh(); };
  NAV.refresh = function () {
    const drawer = document.querySelector('ytcp-navigation-drawer');
    const menu = drawer && drawer.querySelector('ul#main-menu');
    if (!menu) return;
    const inVideo = !!YSP.detailsId();
    const sample = menu.querySelector('li tp-yt-paper-icon-item');
    const mini = drawer.getBoundingClientRect().width < 140;
    for (const item of NAV.items) {
      const show = item.scope === 'both' || (item.scope === 'video') === inVideo;
      let li = menu.querySelector(`li[data-ysp-nav="${item.id}"]`);
      if (!show) { if (li) li.remove(); continue; }
      if (!li) {
        const label = h('span', { class: 'ysp-nav-label', text: item.label });
        const row = h('div', { class: 'ysp-nav-item', role: 'link', tabindex: '0', title: item.label },
          h('span', { class: 'ysp-nav-icon' }, YSP.icon(item.icon, 24)), label);
        row.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); item.onClick(); });
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') item.onClick(); });
        li = h('li', { 'data-ysp-nav': item.id, class: 'ysp-nav-li' }, row);
        menu.append(li);
        if (sample) row.style.fontFamily = getComputedStyle(sample).fontFamily;
      }
      li.classList.toggle('ysp-mini', mini);
      li.classList.toggle('ysp-selected', !!(YSP.page.current && YSP.page.current.name === item.id));
    }
  };
  // Close our page when the user picks a real Studio menu item.
  document.addEventListener('click', (e) => {
    if (!YSP.page.current) return;
    const a = e.target.closest && e.target.closest('ytcp-navigation-drawer a, ytcp-navigation-drawer tp-yt-paper-icon-item');
    if (a && !e.target.closest('.ysp-nav-li')) YSP.page.close();
  }, true);

  // ---------------------------------------------------------------------------
  // Heartbeat: route changes, theme, menu items, page position
  // ---------------------------------------------------------------------------
  let lastPath = location.pathname;
  YSP.onTick = new Set();
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (YSP.page.current) YSP.page.close();
    }
    pageUI.host.classList.toggle('dark', YSP.isDark());
    NAV.refresh();
    YSP.page.position();
    for (const fn of YSP.onTick) { try { fn(); } catch (e) { console.error('[Studio Plus]', e); } }
  }, 600);

  YSP.settings = { autoOpenDetails: true, autoOpenUpload: true, pushLayout: true, likesColumn: true };
  YSP.settingsReady = (async () => {
    const s = await YSP.store.get('ysp_settings', 'sync');
    if (s) Object.assign(YSP.settings, s);
  })();
  YSP.saveSettings = () => YSP.store.set('ysp_settings', YSP.settings, 'sync');
})();
