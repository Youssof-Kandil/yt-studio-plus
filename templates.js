// Studio Plus – upload templates, series mode and template suggestions.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.templates) return;
  const { h, videos: V, form: F, toast } = YSP;

  const KEY = 'ysp_templates';
  const T = (YSP.templates = { list: [], ready: null });

  // ---------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------
  const FIELD_DEFS = [
    ['title', 'Title'], ['description', 'Description'], ['tags', 'Tags'], ['playlists', 'Playlists'],
    ['madeForKids', 'Audience'], ['ageRestricted', 'Age restriction'], ['paidPromotion', 'Paid promotion'],
    ['alteredContent', 'Altered / AI content'], ['language', 'Video language'], ['category', 'Category'], ['gameTitle', 'Game title'],
  ];
  T.FIELD_DEFS = FIELD_DEFS;
  function blankFields() {
    return {
      title: { on: false, value: '' },
      description: { on: false, value: '', mode: 'replace' },
      tags: { on: false, value: [] },
      playlists: { on: false, value: [] },
      madeForKids: { on: false, value: 'no' },
      ageRestricted: { on: false, value: 'no' },
      paidPromotion: { on: false, value: 'no' },
      alteredContent: { on: false, value: 'no' },
      language: { on: false, value: 'English' },
      category: { on: false, value: YSP.GAMING },
      gameTitle: { on: false, value: '' },
    };
  }
  T.blank = function (name = 'New template') {
    return { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, keywords: '', fields: blankFields(), createdAt: Date.now(), updatedAt: Date.now(), lastUsed: 0, uses: 0 };
  };
  T.load = async function () {
    const l = await YSP.store.get(KEY);
    T.list = Array.isArray(l) ? l.map((t) => Object.assign(T.blank(), t, { fields: Object.assign(blankFields(), t.fields || {}) })) : [];
    return T.list;
  };
  T.save = async function () {
    await YSP.store.set(KEY, T.list);
    YSP.panel && YSP.panel.render();
  };
  T.upsert = async function (t) {
    t.updatedAt = Date.now();
    const i = T.list.findIndex((x) => x.id === t.id);
    if (i >= 0) T.list[i] = t; else T.list.unshift(t);
    await T.save();
  };
  T.remove = async function (id) { T.list = T.list.filter((t) => t.id !== id); await T.save(); };
  T.ready = T.load();
  try {
    chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[KEY]) T.load().then(() => YSP.panel && YSP.panel.render()); });
  } catch (_) {}

  // ---------------------------------------------------------------------------
  // Placeholders: {ep} next episode number, {file} upload file name, {date}
  // ---------------------------------------------------------------------------
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function patternRegex(title) {
    if (!title || !/\{ep\}/i.test(title)) return null;
    let re = '';
    for (const part of title.split(/(\{ep\}|\{file\}|\{date\})/i)) {
      if (/^\{ep\}$/i.test(part)) re += '\\s*(\\d+)\\s*';
      else if (/^\{(file|date)\}$/i.test(part)) re += '.*?';
      else re += esc(part).replace(/\s+/g, '\\s*');
    }
    return new RegExp('^\\s*' + re + '\\s*$', 'i');
  }
  T.lastEpisode = function (title) {
    const re = patternRegex(title);
    if (!re) return null;
    let best = null;
    for (const v of V.list) {
      const m = v.title.match(re);
      if (m) { const n = Number(m[1]); if (!best || n > best.n) best = { n, video: v }; }
    }
    return best;
  };
  T.nextEpisode = function (title, currentId) {
    const re = patternRegex(title);
    if (!re) return null;
    // On an existing video that already has a number, keep it.
    const cur = currentId && V.get(currentId);
    if (cur) { const m = cur.title.match(re); if (m) return Number(m[1]); }
    const last = T.lastEpisode(title);
    return last ? last.n + 1 : 1;
  };
  T.fileName = function () {
    const f = (YSP.mode() === 'upload' ? YSP.uploadFilename() || T._initialTitle : YSP.uploadFilename()) || '';
    return f.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  };
  // On an existing video, {file} means "the episode name already in this title".
  function fileFromTitle(pattern, title) {
    if (!title) return null;
    if (pattern && /\{file\}/i.test(pattern)) {
      let re = '';
      for (const part of pattern.split(/(\{ep\}|\{file\}|\{date\})/i)) {
        if (/^\{file\}$/i.test(part)) re += '(.+?)';
        else if (/^\{ep\}$/i.test(part)) re += '\\s*\\d+\\s*';
        else if (/^\{date\}$/i.test(part)) re += '.*?';
        else re += esc(part).replace(/\s+/g, '\\s*');
      }
      const m = title.match(new RegExp('^\\s*' + re + '\\s*$', 'i'));
      if (m && m[1].trim()) return m[1].trim();
    }
    const sep = title.match(/^(.*\S)\s+[|\-–—]\s+/);
    return sep ? sep[1].trim() : title.trim();
  }
  T.resolve = function (text, ctx = {}) {
    if (!text) return text;
    const ep = /\{ep\}/i.test(text) ? (ctx.ep != null ? ctx.ep : T.nextEpisode(ctx.titlePattern || text, YSP.detailsId())) : null;
    let file = ctx.file;
    if (file == null && /\{file\}/i.test(text)) {
      file = YSP.mode() === 'details' ? (ctx.currentTitle != null ? fileFromTitle(ctx.titlePattern || text, ctx.currentTitle) : fileFromTitle(ctx.titlePattern || text, F.getText('title'))) : T.fileName();
    }
    return text
      .replace(/\{ep\}/gi, ep != null ? String(ep) : '')
      .replace(/\{file\}/gi, file || '')
      .replace(/\{date\}/gi, new Date().toLocaleDateString());
  };

  // ---------------------------------------------------------------------------
  // Series detection from your existing titles
  // ---------------------------------------------------------------------------
  const MARKER = /^(.*?)\b(ep(?:isode)?|part|pt|day|chapter|#)\s*\.?\s*(\d+)(.*)$/i;
  function parseTitle(title) {
    let prefix = '', sep = '', rest = title;
    const m = title.match(/^(.*\S)(\s+[|\-–—]\s+)(.+)$/);
    if (m) { prefix = m[1]; sep = m[2]; rest = m[3]; }
    const mk = rest.match(MARKER);
    if (mk && (mk[1].trim() || sep)) {
      const name = mk[1].trim();
      return {
        key: (name + ' ' + mk[2] + mk[4]).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(),
        name: name || prefix,
        num: Number(mk[3]),
        pattern: (sep ? '{file}' + sep : '') + (name ? name + ' ' : '') + mk[2] + ' {ep}' + mk[4],
      };
    }
    if (sep) return { key: rest.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(), name: rest.trim(), num: null, pattern: '{file}' + sep + rest.trim() };
    return null;
  }
  T.detectSeries = function () {
    const groups = new Map();
    for (const v of V.list) {
      const p = parseTitle(v.title);
      if (!p) continue;
      let g = groups.get(p.key);
      if (!g) { g = { key: p.key, name: p.name, pattern: p.pattern, count: 0, latest: null, maxNum: null, lastTs: 0 }; groups.set(p.key, g); }
      g.count++;
      if (p.num != null && (g.maxNum == null || p.num > g.maxNum)) { g.maxNum = p.num; g.latest = v; }
      if (p.num == null && (!g.latest || v.ts > g.latest.ts)) g.latest = v;
      g.lastTs = Math.max(g.lastTs, v.ts || 0);
    }
    return [...groups.values()]
      .filter((g) => g.maxNum != null || g.count >= 2)
      .sort((a, b) => b.lastTs - a.lastTs);
  };
  const templateForSeries = (g) => T.list.find((t) => t.fields.title.on && norm(t.fields.title.value) === norm(g.pattern));

  // ---------------------------------------------------------------------------
  // Suggestions
  // ---------------------------------------------------------------------------
  const norm = (s) => String(s || '').trim().toLowerCase();
  const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'my', 'is', 'for', 'with', 'mp4', 'mov', 'mkv', 'webm', 'avi', 'final', 'export', 'video', 'clip', 'ep', 'episode', 'part']);
  function tokens(s) {
    return norm(s).replace(/[_.\-–—|:()[\]{}#,!?'"]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
  }
  function overlap(a, b) {
    if (!a.length || !b.length) return 0;
    const sb = new Set(b);
    let hits = 0;
    for (const w of new Set(a)) if (sb.has(w) || [...sb].some((x) => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x)))) hits++;
    return hits;
  }
  let filenameIndex = null; // videoId -> original file name
  async function loadFilenames() {
    if (filenameIndex || !V.list.length) return;
    filenameIndex = {};
    try { filenameIndex = await YSP.call('getFilenames', { videoIds: V.list.slice(0, 150).map((v) => v.id) }); } catch (_) {}
    YSP.panel && YSP.panel.render();
  }
  T.suggest = function (file) {
    const ft = tokens(file);
    const out = [];
    for (const t of T.list) {
      const words = tokens([t.name, t.keywords, t.fields.title.value.replace(/\{\w+\}/g, ' '), t.fields.gameTitle.on ? t.fields.gameTitle.value : ''].join(' '));
      const kw = tokens(t.keywords);
      let score = overlap(ft, words) * 2 + overlap(ft, kw) * 3;
      let why = score ? 'matches the file name' : '';
      out.push({ kind: 'template', t, score, why, recency: t.lastUsed || t.updatedAt });
    }
    for (const g of T.detectSeries()) {
      const existing = templateForSeries(g);
      if (existing) continue; // the template card already covers it
      let score = overlap(ft, tokens(g.name + ' ' + (g.latest ? g.latest.title : ''))) * 2;
      let why = score ? 'matches the file name' : '';
      out.push({ kind: 'series', g, score, why, recency: g.lastTs * 1000 });
    }
    // Similar file names to earlier uploads → suggest what that upload used.
    if (filenameIndex && ft.length) {
      let best = null;
      for (const [id, fn] of Object.entries(filenameIndex)) {
        const s = overlap(ft, tokens(fn));
        if (s && (!best || s > best.s)) best = { s, id, fn };
      }
      if (best) {
        const v = V.get(best.id);
        const p = v && parseTitle(v.title);
        if (p) {
          for (const o of out) {
            const pat = o.kind === 'template' ? o.t.fields.title.value : o.g.pattern;
            if (norm(pat) === norm(p.pattern)) { o.score += best.s * 2; o.why = `similar file to "${v.title}"`; }
          }
        }
      }
    }
    out.sort((a, b) => b.score - a.score || b.recency - a.recency);
    return out;
  };

  // ---------------------------------------------------------------------------
  // Apply a template to Studio's form (upload dialog or details page)
  // ---------------------------------------------------------------------------
  T.apply = async function (t, opts = {}) {
    if (!F.available()) { toast('Open the upload dialog or a video\'s details page first.', 'warn'); return; }
    const f = t.fields;
    const done = [], failed = [];
    const step = async (label, fn) => {
      try { const r = await fn(); if (r === false) failed.push(label); else done.push(label); }
      catch (e) { failed.push(label + (e && e.message ? ` (${e.message})` : '')); }
    };
    // Capture the current title before we overwrite it ({file} on details pages).
    const ctx = { titlePattern: f.title.value, currentTitle: F.getText('title') };
    if (f.title.on) {
      const ep = T.nextEpisode(f.title.value, YSP.detailsId());
      ctx.ep = ep;
      await step('Title', () => F.setText('title', T.resolve(f.title.value, ctx).slice(0, 100)));
    }
    if (f.description.on) await step('Description', () => F.setText('description', T.resolve(f.description.value, ctx), f.description.mode === 'append'));
    if (f.playlists.on && f.playlists.value.length) {
      await step('Playlists', async () => {
        const r = await F.setPlaylists(f.playlists.value, { exclusive: false });
        if (r.missing.length) throw new Error('not found: ' + r.missing.join(', '));
      });
    }
    if (f.madeForKids.on) await step('Audience', () => F.setRadio(F.RADIOS.madeForKids[f.madeForKids.value === 'yes' ? 0 : 1]));
    if (f.ageRestricted.on) {
      await step('Age restriction', async () => {
        const name = F.RADIOS.ageRestricted[f.ageRestricted.value === 'yes' ? 0 : 1];
        if (!F.radio(name)) {
          const exp = [...F.root().querySelectorAll('ytcp-button, button, #toggle-button')].find((b) => /^\s*age restriction/i.test(b.innerText || ''));
          if (exp) { exp.click(); await YSP.waitFor(() => F.radio(name), 1500); }
        }
        return F.setRadio(name);
      });
    }
    if (['paidPromotion', 'alteredContent', 'tags', 'language', 'category', 'gameTitle'].some((k) => f[k].on)) await F.ensureShowMore();
    if (f.paidPromotion.on) await step('Paid promotion', () => F.setRadio(F.RADIOS.paidPromotion[f.paidPromotion.value === 'yes' ? 0 : 1]));
    if (f.alteredContent.on) await step('Altered content', () => F.setRadio(F.RADIOS.alteredContent[f.alteredContent.value === 'yes' ? 0 : 1]));
    if (f.tags.on && f.tags.value.length) await step('Tags', async () => { await F.addTags(f.tags.value.map((x) => T.resolve(x, ctx))); });
    if (f.language.on && f.language.value) await step('Language', () => F.setLanguage(f.language.value));
    if (f.category.on && f.category.value) await step('Category', () => F.setCategory(f.category.value));
    if (f.gameTitle.on && f.gameTitle.value) {
      await step('Game title', async () => {
        if (!F.root().querySelector('ytcp-form-gaming')) await F.setCategory(YSP.GAMING);
        return F.setGame(f.gameTitle.value);
      });
    }
    if (!opts.preview) {
      t.lastUsed = Date.now();
      t.uses = (t.uses || 0) + 1;
      T.upsert(t);
    }
    const after = YSP.mode() === 'details' ? ' Click Save to keep the changes.' : '';
    if (failed.length) toast(`Applied "${t.name}": ${done.length} field(s) set. Couldn't set: ${failed.join('; ')}.${after}`, 'warn', 8000);
    else toast(`Applied "${t.name}" (${done.length} field${done.length === 1 ? '' : 's'}).${after}`, 'ok', 5000);
  };

  // Build a template from an earlier episode (series mode / "from video").
  T.fromVideo = async function (videoId, { pattern, name } = {}) {
    const raw = await YSP.call('getVideo', { videoId });
    const t = T.blank(name || raw.title);
    const f = t.fields;
    if (pattern) { f.title = { on: true, value: pattern }; }
    if (typeof raw.description === 'string') f.description = { on: true, value: raw.description, mode: 'replace' };
    const tags = YSP.extractTags(raw.tags);
    if (tags.length) f.tags = { on: true, value: tags };
    if (raw.category) f.category = { on: true, value: raw.category };
    if (raw.gameTitle && raw.gameTitle.title) f.gameTitle = { on: true, value: raw.gameTitle.title };
    if (raw.ageRestriction) f.ageRestricted = { on: true, value: raw.ageRestriction === 'VIDEO_AGE_RESTRICTION_SELF' ? 'yes' : 'no' };
    if (raw.paidProductPlacement) f.paidPromotion = { on: true, value: /NOTIFY|YES/.test(raw.paidProductPlacement) ? 'yes' : 'no' };
    const ar = raw.audienceRestriction && raw.audienceRestriction.selfRating;
    if (ar) f.madeForKids = { on: true, value: /MADE_FOR_KIDS|MFK|KIDS/.test(ar) && !/NOT/.test(ar) ? 'yes' : 'no' };
    // Guess the playlist: one of your playlists whose name matches the series.
    const known = (await YSP.store.get('ysp_playlists')) || [];
    const guess = name && known.find((p) => norm(p) === norm(name) || norm(name).includes(norm(p)) || norm(p).includes(norm(name)));
    if (guess) f.playlists = { on: true, value: [guess] };
    t.keywords = tokens(name || '').join(', ');
    return t;
  };
  T.fromForm = function () {
    const v = F.read();
    const t = T.blank('Template from ' + (v.title || 'form').slice(0, 40));
    const f = t.fields;
    const p = v.title && parseTitle(v.title);
    f.title = { on: !!v.title, value: p ? p.pattern : v.title };
    if (p) t.name = p.name || t.name;
    f.description = { on: !!v.description, value: v.description, mode: 'replace' };
    f.tags = { on: v.tags.length > 0, value: v.tags };
    f.playlists = { on: v.playlists.length > 0, value: v.playlists };
    for (const k of ['madeForKids', 'ageRestricted', 'paidPromotion', 'alteredContent']) if (v[k]) f[k] = { on: true, value: v[k] };
    if (v.language && !/^select$/i.test(v.language)) f.language = { on: true, value: v.language };
    const cat = YSP.CATEGORIES.find((c) => norm(c[1]) === norm(v.category));
    if (cat) f.category = { on: true, value: cat[0] };
    if (v.gameTitle) f.gameTitle = { on: true, value: v.gameTitle };
    t.keywords = tokens(t.name).join(', ');
    return t;
  };

  // ---------------------------------------------------------------------------
  // Panel section (upload dialog + details page)
  // ---------------------------------------------------------------------------
  let detailsOpen = false;
  let lastUploadId = null;
  let lastPlLearn = 0;
  YSP.onTick.add(() => {
    // Learn your playlist names from the forms you open (used as shortcuts and for series guesses).
    if (Date.now() - lastPlLearn > 5000 && F.available()) {
      lastPlLearn = Date.now();
      const names = F.getPlaylists();
      if (names.length) {
        YSP.store.get('ysp_playlists').then((known) => {
          known = known || [];
          const add = names.filter((n) => !known.some((k) => norm(k) === norm(n)));
          if (add.length) YSP.store.set('ysp_playlists', known.concat(add));
        });
      }
    }
    // Remember the title Studio pre-fills from the file name when the upload starts.
    const dlg = YSP.uploadDialogEl();
    if (!dlg) { lastUploadId = null; return; }
    const id = YSP.uploadingVideoId(dlg) || 'pending';
    if (id !== lastUploadId) {
      lastUploadId = id;
      T._initialTitle = F.getText('title');
      YSP.panel && YSP.panel.render();
    }
  });

  function card(o, best) {
    if (o.kind === 'template') {
      const t = o.t;
      const preview = t.fields.title.on ? T.resolve(t.fields.title.value, { titlePattern: t.fields.title.value }) : '(keeps current title)';
      const nOn = Object.values(t.fields).filter((x) => x.on).length;
      return h('div', { class: 'tpl-card' + (best ? ' best' : '') },
        h('div', { class: 'tc-main' },
          h('div', { class: 'tc-name' }, t.name, best ? h('span', { class: 'badge', text: 'Suggested' }) : null),
          h('div', { class: 'tc-sub', title: preview, text: preview }),
          h('div', { class: 'tc-sub', text: `${nOn} field${nOn === 1 ? '' : 's'}${o.why ? ' · ' + o.why : ''}` })),
        h('button', { class: 'btn', title: 'Edit template', onclick: () => openPage(t.id) }, '✎'),
        h('button', { class: 'btn primary', onclick: () => T.apply(t) }, 'Apply'));
    }
    const g = o.g;
    const next = (g.maxNum || 0) + 1;
    const preview = T.resolve(g.pattern, { ep: next });
    return h('div', { class: 'tpl-card' + (best ? ' best' : '') },
      h('div', { class: 'tc-main' },
        h('div', { class: 'tc-name' }, g.maxNum != null ? `Continue ${g.name} → Ep ${next}` : `Continue "${g.name}"`, best ? h('span', { class: 'badge', text: 'Suggested' }) : null),
        h('div', { class: 'tc-sub', title: preview, text: preview }),
        h('div', { class: 'tc-sub', text: `copies ${g.latest ? '"' + g.latest.title + '"' : 'latest episode'}${o.why ? ' · ' + o.why : ''}` })),
      h('button', { class: 'btn', title: 'Save as a reusable template', onclick: async (e) => {
        e.target.disabled = true;
        try { const t = await T.fromVideo(g.latest.id, { pattern: g.pattern, name: g.name }); await T.upsert(t); openPage(t.id); }
        catch (err) { toast(err.message, 'error'); }
        e.target.disabled = false;
      } }, 'Save'),
      h('button', { class: 'btn primary', onclick: async (e) => {
        e.target.disabled = true;
        try { const t = await T.fromVideo(g.latest.id, { pattern: g.pattern, name: g.name }); t.name = g.name; await T.apply(t, { preview: true }); }
        catch (err) { toast(err.message, 'error'); }
        e.target.disabled = false;
      } }, 'Apply'));
  }

  function section({ mode }) {
    if (mode !== 'upload' && mode !== 'details') return null;
    if (!F.available()) return null;
    loadFilenames();
    const file = mode === 'upload' ? T.fileName() : (T.fileName() + ' ' + F.getText('title')).trim();
    const sug = T.suggest(file);
    const wrap = h('div', { class: 'tpl-section' });
    const collapsed = mode === 'details' && !detailsOpen;
    wrap.append(h('div', { class: 'sec-hd' },
      h('b', { text: mode === 'upload' ? 'Upload templates' : 'Apply a template' }),
      h('button', { class: 'link small', onclick: () => openPage() }, 'Manage'),
      mode === 'details' ? h('button', { class: 'link small', onclick: () => { detailsOpen = !detailsOpen; YSP.panel.render(); } }, collapsed ? 'Show ▾' : 'Hide ▴') : null));
    if (collapsed) return wrap;
    if (file && mode === 'upload') wrap.append(h('div', { class: 'fname', text: 'File: ' + file }));
    const shown = sug.slice(0, mode === 'upload' ? 5 : 4);
    shown.forEach((o, i) => wrap.append(card(o, i === 0 && o.score > 0)));
    if (!shown.length) wrap.append(h('div', { class: 'muted small', text: 'No templates yet. Save the current form as one, or create one under "Upload templates" in the left menu.' }));
    if (sug.length > shown.length) {
      const more = h('select', { class: 'filter', style: 'width:100%' }, h('option', { value: '', text: `More templates (${sug.length - shown.length})…` }),
        sug.slice(shown.length).map((o, i) => h('option', { value: String(i + shown.length), text: o.kind === 'template' ? o.t.name : 'Continue ' + o.g.name })));
      more.addEventListener('change', () => { const o = sug[Number(more.value)]; if (o) { wrap.insertBefore(card(o, false), more); more.value = ''; } });
      wrap.append(more);
    }
    wrap.append(h('button', { class: 'link small', style: 'align-self:flex-start', onclick: async () => { const t = T.fromForm(); await T.upsert(t); openPage(t.id); } }, '+ Save this form as a template'));
    return wrap;
  }
  T.ready.then(() => { if (YSP.panel) { YSP.panel.sections.push(section); YSP.panel.render(); } });
  V.subscribe(() => { if (YSP.panel && YSP.panel.state.mode === 'upload') { /* list re-render handled by panel */ } });

  // ---------------------------------------------------------------------------
  // "Upload templates" page
  // ---------------------------------------------------------------------------
  YSP.page.addStyle('templates', `
.tpl-layout { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
.tpl-list { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 0; }
.tpl-item { text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--bg2); cursor: pointer; }
.tpl-item:hover { background: var(--hover); }
.tpl-item.sel { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg)); }
.tpl-item b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tpl-item span { font-size: 11px; color: var(--muted); }
.side-title { font-weight: 600; margin: 12px 0 2px; }
.series-item { display: flex; gap: 8px; align-items: center; font-size: 12px; padding: 6px 8px; border-radius: 8px; background: var(--bg2); }
.series-item div { flex: 1; min-width: 0; }
.series-item b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.editor { border: 1px solid var(--line); border-radius: 12px; padding: 20px; background: var(--bg2); }
.ed-top { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.lbl { font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block; }
.frow { display: grid; grid-template-columns: 190px 1fr; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); align-items: start; }
.frow.off .fval { opacity: .45; }
.ftog { display: flex; gap: 8px; align-items: flex-start; font-weight: 600; cursor: pointer; padding-top: 7px; }
.ftog input { margin-top: 3px; accent-color: var(--accent); }
.fhint { font-size: 11px; color: var(--muted); font-weight: 400; display: block; }
.fval { display: flex; flex-direction: column; gap: 6px; }
.tokens { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 11px; color: var(--muted); }
.tok { font-size: 11px; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); cursor: pointer; font-family: monospace; }
.preview { font-size: 12px; padding: 6px 10px; border-radius: 6px; background: var(--bg2); }
.chips { display: flex; gap: 5px; flex-wrap: wrap; }
.chip { font-size: 12px; padding: 2px 9px; border-radius: 12px; background: var(--bg3); }
.chip.add { cursor: pointer; border: 1px dashed var(--line); background: transparent; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: var(--bg2); padding: 6px 14px; cursor: pointer; }
.seg button.on { background: var(--accent); color: var(--accent-fg); }
.ed-actions { display: flex; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.ed-actions .grow { flex: 1; }
.empty-page { padding: 48px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; }
.io { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
@media (max-width: 900px) { .tpl-layout { grid-template-columns: 1fr; } .frow { grid-template-columns: 1fr; } .ed-top { grid-template-columns: 1fr; } }
`);

  let selectedId = null;
  function openPage(id) {
    if (id) selectedId = id;
    V.ensure();
    T.ready.then(() => YSP.page.open('templates', renderPage));
  }
  T.openPage = openPage;

  function renderPage(root) {
    const inner = h('div', { class: 'page-inner' });
    root.append(inner);
    const rerender = () => { inner.replaceChildren(); build(); };
    function build() {
      inner.append(YSP.page.header('Upload templates', h('button', { class: 'btn primary', onclick: async () => { const t = T.blank(); await T.upsert(t); selectedId = t.id; rerender(); } }, '+ New template')));
      inner.append(h('p', { class: 'muted', style: 'margin:-8px 0 18px' },
        'Templates fill in the upload form for you. Turn on only the fields you want a template to set. In the title, ',
        h('code', { text: '{ep}' }), ' becomes the next episode number, ', h('code', { text: '{file}' }), ' the uploaded file name, and ',
        h('code', { text: '{date}' }), ' today\'s date. Templates appear beside the upload dialog, with the best match for the file name marked "Suggested".'));
      if (!selectedId || !T.list.find((t) => t.id === selectedId)) selectedId = T.list[0] ? T.list[0].id : null;
      const listCol = h('div', { class: 'tpl-list' });
      for (const t of T.list) {
        const n = Object.values(t.fields).filter((x) => x.on).length;
        listCol.append(h('button', { class: 'tpl-item' + (t.id === selectedId ? ' sel' : ''), onclick: () => { selectedId = t.id; rerender(); } },
          h('b', { text: t.name }), h('span', { text: `${n} field${n === 1 ? '' : 's'} · used ${t.uses || 0}×` })));
      }
      if (!T.list.length) listCol.append(h('div', { class: 'muted small', text: 'No templates yet.' }));
      const series = T.detectSeries().filter((g) => !templateForSeries(g)).slice(0, 8);
      if (series.length) {
        listCol.append(h('div', { class: 'side-title', text: 'Series found in your titles' }));
        for (const g of series) {
          listCol.append(h('div', { class: 'series-item' },
            h('div', null, h('b', { text: g.name }), h('span', { class: 'muted', text: g.maxNum != null ? `latest: Ep ${g.maxNum} · ${g.count} video(s)` : `${g.count} videos` })),
            h('button', { class: 'btn', onclick: async (e) => {
              e.target.disabled = true;
              try { const t = await T.fromVideo(g.latest.id, { pattern: g.pattern, name: g.name }); await T.upsert(t); selectedId = t.id; rerender(); }
              catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
            } }, 'Make template')));
        }
      } else if (!V.loadedOnce) {
        listCol.append(h('div', { class: 'muted small', text: 'Looking for series in your titles…' }));
      }
      listCol.append(h('div', { class: 'io' },
        h('button', { class: 'btn', onclick: async () => toast((await YSP.copyText(JSON.stringify(T.list, null, 2))) ? `Copied ${T.list.length} template(s) as JSON` : 'Copy failed') }, 'Export'),
        h('button', { class: 'btn', onclick: () => importBox() }, 'Import')));
      const sel = T.list.find((t) => t.id === selectedId);
      const edCol = sel ? editor(JSON.parse(JSON.stringify(sel)), rerender) : h('div', { class: 'empty-page' },
        h('div', { style: 'font-size:16px;margin-bottom:8px', text: 'Create your first upload template' }),
        h('div', { text: 'Start blank, or use "Make template" on a series found in your titles.' }));
      inner.append(h('div', { class: 'tpl-layout' }, listCol, edCol));
      function importBox() {
        const ta = h('textarea', { class: 'input', placeholder: 'Paste exported templates JSON here', style: 'min-height:160px' });
        const box = h('div', { class: 'editor', style: 'margin-top:12px' }, h('b', { text: 'Import templates' }), ta,
          h('div', { class: 'ed-actions' }, h('button', { class: 'btn primary', onclick: async () => {
            try {
              const arr = JSON.parse(ta.value);
              if (!Array.isArray(arr)) throw new Error('Expected a list of templates');
              for (const raw of arr) {
                const t = Object.assign(T.blank(), raw, { fields: Object.assign(blankFields(), raw.fields || {}) });
                if (T.list.find((x) => x.id === t.id)) t.id = T.blank().id;
                T.list.push(t);
              }
              await T.save();
              toast(`Imported ${arr.length} template(s)`);
              rerender();
            } catch (e) { toast('Import failed: ' + e.message, 'error'); }
          } }, 'Import'), h('button', { class: 'btn', onclick: () => box.remove() }, 'Cancel')));
        listCol.append(box);
        ta.focus();
      }
    }
    build();
    const unsub = V.subscribe(() => { if (YSP.page.current && YSP.page.current.name === 'templates' && !inner.querySelector('.dirty')) rerender(); });
    const stop = setInterval(() => { if (!YSP.page.current || YSP.page.current.name !== 'templates') { unsub(); clearInterval(stop); } }, 1000);
  }

  function editor(t, rerender) {
    const f = t.fields;
    const ed = h('div', { class: 'editor' });
    const markDirty = () => ed.classList.add('dirty');
    const name = h('input', { class: 'input', value: t.name });
    name.addEventListener('input', () => { t.name = name.value; markDirty(); });
    const kw = h('input', { class: 'input', value: t.keywords, placeholder: 'e.g. subnautica, sub2' });
    kw.addEventListener('input', () => { t.keywords = kw.value; markDirty(); });
    ed.append(h('div', { class: 'ed-top' },
      h('label', null, h('span', { class: 'lbl', text: 'Template name' }), name),
      h('label', null, h('span', { class: 'lbl', text: 'Suggest when the file name contains (comma-separated)' }), kw)));

    const row = (key, label, hint, valueEl) => {
      const cb = h('input', { type: 'checkbox', checked: f[key].on });
      const r = h('div', { class: 'frow' + (f[key].on ? '' : ' off') },
        h('label', { class: 'ftog' }, cb, h('span', null, label, hint ? h('span', { class: 'fhint', text: hint }) : null)),
        h('div', { class: 'fval' }, valueEl));
      cb.addEventListener('change', () => { f[key].on = cb.checked; r.classList.toggle('off', !cb.checked); markDirty(); });
      valueEl.addEventListener('input', () => { if (!f[key].on) { f[key].on = true; cb.checked = true; r.classList.remove('off'); } }, true);
      valueEl.addEventListener('click', (e) => { if (e.target.closest('button') && !f[key].on) { f[key].on = true; cb.checked = true; r.classList.remove('off'); } }, true);
      return r;
    };
    const seg = (key, opts) => {
      const box = h('div', { class: 'seg' });
      const paint = () => [...box.children].forEach((b) => b.classList.toggle('on', b.dataset.v === f[key].value));
      for (const [v, l] of opts) box.append(h('button', { 'data-v': v, onclick: () => { f[key].value = v; paint(); markDirty(); } }, l));
      paint();
      return box;
    };

    // Title
    const title = h('input', { class: 'input', value: f.title.value, maxlength: '150', placeholder: '{file} | My Series Ep {ep}' });
    const prev = h('div', { class: 'preview' });
    const updPrev = () => {
      const last = T.lastEpisode(f.title.value);
      const res = T.resolve(f.title.value, { file: '<file name>', titlePattern: f.title.value, ep: /\{ep\}/i.test(f.title.value) ? (last ? last.n + 1 : 1) : null });
      prev.textContent = 'Next upload: ' + (res || '—') + (last ? `   (last: Ep ${last.n} "${last.video.title}")` : '');
    };
    title.addEventListener('input', () => { f.title.value = title.value; updPrev(); markDirty(); });
    const ins = (tok) => { const s = title.selectionStart ?? title.value.length; title.value = title.value.slice(0, s) + tok + title.value.slice(title.selectionEnd ?? s); title.dispatchEvent(new Event('input')); title.focus(); };
    updPrev();
    ed.append(row('title', 'Title', 'Max 100 characters', h('div', { class: 'fval' }, title,
      h('div', { class: 'tokens' }, 'Insert:', ['{ep}', '{file}', '{date}'].map((tk) => h('button', { class: 'tok', onclick: () => ins(tk) }, tk))), prev)));

    // Description
    const desc = h('textarea', { class: 'input', style: 'min-height:160px' });
    desc.value = f.description.value;
    const dcount = h('span', { class: 'fhint' });
    const updD = () => { dcount.textContent = `${desc.value.length}/5000 · {ep}, {file} and {date} work here too`; };
    desc.addEventListener('input', () => { f.description.value = desc.value; updD(); markDirty(); });
    updD();
    const dmode = h('div', { class: 'fval' });
    const modeSel = h('div', { class: 'seg' },
      ...[['replace', 'Replace description'], ['append', 'Add to end']].map(([v, l]) => {
        const b = h('button', { onclick: () => { f.description.mode = v; [...modeSel.children].forEach((x) => x.classList.toggle('on', x === b)); markDirty(); } }, l);
        if ((f.description.mode || 'replace') === v) b.classList.add('on');
        return b;
      }));
    dmode.replaceChildren(desc, h('div', { class: 'tokens' }, modeSel, dcount));
    ed.append(row('description', 'Description', null, dmode));

    // Tags
    const tagsIn = h('input', { class: 'input', value: f.tags.value.join(', '), placeholder: 'tag one, tag two, tag three' });
    const tagChips = h('div', { class: 'chips' });
    const updTags = () => {
      f.tags.value = tagsIn.value.split(',').map((x) => x.trim()).filter(Boolean);
      tagChips.replaceChildren(...f.tags.value.map((x) => h('span', { class: 'chip', text: x })),
        h('span', { class: 'fhint', text: `${f.tags.value.length} tags · ${f.tags.value.join(',').length}/500 characters` }));
    };
    tagsIn.addEventListener('input', () => { updTags(); markDirty(); });
    updTags();
    ed.append(row('tags', 'Tags', 'Added to any tags already there', h('div', { class: 'fval' }, tagsIn, tagChips)));

    // Playlists
    const plIn = h('input', { class: 'input', value: f.playlists.value.join(', '), placeholder: 'Playlist name, another playlist' });
    const plKnown = h('div', { class: 'chips' });
    plIn.addEventListener('input', () => { f.playlists.value = plIn.value.split(',').map((x) => x.trim()).filter(Boolean); markDirty(); });
    YSP.store.get('ysp_playlists').then((known) => {
      if (!known || !known.length) { plKnown.append(h('span', { class: 'fhint', text: 'Type exact playlist names. Your playlists show here as shortcuts after you open the Playlists picker in Studio once.' })); return; }
      plKnown.append(h('span', { class: 'fhint', text: 'Your playlists:' }), ...known.map((p) => h('button', { class: 'chip add', onclick: () => {
        if (!f.playlists.value.some((x) => norm(x) === norm(p))) { f.playlists.value.push(p); plIn.value = f.playlists.value.join(', '); markDirty(); }
      } }, '+ ' + p)));
    });
    ed.append(row('playlists', 'Playlists', 'Ticks these in the playlist picker', h('div', { class: 'fval' }, plIn, plKnown)));

    ed.append(row('madeForKids', 'Audience', null, seg('madeForKids', [['no', 'No, not made for kids'], ['yes', 'Yes, made for kids']])));
    ed.append(row('ageRestricted', 'Age restriction', null, seg('ageRestricted', [['no', 'No restriction'], ['yes', 'Restrict to 18+']])));
    ed.append(row('paidPromotion', 'Paid promotion', null, seg('paidPromotion', [['no', 'No paid promotion'], ['yes', 'Includes paid promotion']])));
    ed.append(row('alteredContent', 'Altered content', 'Realistic AI / synthetic media', seg('alteredContent', [['no', 'No'], ['yes', 'Yes']])));

    const langId = 'ysp-langs';
    const lang = h('input', { class: 'input', value: f.language.value, list: langId, placeholder: 'English' });
    lang.addEventListener('input', () => { f.language.value = lang.value; markDirty(); });
    ed.append(row('language', 'Video language', 'Exact name as in Studio\'s list', h('div', { class: 'fval' }, lang,
      h('datalist', { id: langId }, YSP.LANGUAGES.map((l) => h('option', { value: l }))))));

    const cat = h('select', { class: 'input' }, YSP.CATEGORIES.map(([id, l]) => h('option', { value: id, text: l })));
    cat.value = f.category.value || YSP.GAMING;
    cat.addEventListener('change', () => { f.category.value = cat.value; markDirty(); });
    ed.append(row('category', 'Category', null, cat));

    const game = h('input', { class: 'input', value: f.gameTitle.value, placeholder: 'e.g. Subnautica 2' });
    game.addEventListener('input', () => { f.gameTitle.value = game.value; markDirty(); });
    ed.append(row('gameTitle', 'Game title', 'Sets category to Gaming if needed', game));

    const canApply = F.available();
    ed.append(h('div', { class: 'ed-actions' },
      h('button', { class: 'btn primary', onclick: async () => { await T.upsert(t); ed.classList.remove('dirty'); toast('Template saved'); rerender(); } }, 'Save template'),
      canApply ? h('button', { class: 'btn', onclick: async () => { await T.upsert(t); YSP.page.close(); T.apply(t); } }, 'Save & apply to current form') : null,
      h('button', { class: 'btn', onclick: async () => { const c = JSON.parse(JSON.stringify(t)); c.id = T.blank().id; c.name = t.name + ' (copy)'; c.uses = 0; await T.upsert(c); selectedId = c.id; rerender(); } }, 'Duplicate'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn danger', onclick: async () => { if (!confirmDelete(ed, t)) return; } }, 'Delete')));
    return ed;
  }
  function confirmDelete(ed, t) {
    const bar = ed.querySelector('.del-confirm');
    if (bar) return false;
    const box = h('div', { class: 'del-confirm error', style: 'display:flex;gap:8px;align-items:center;margin-top:10px' },
      h('span', { style: 'flex:1', text: `Delete "${t.name}"? This can't be undone.` }),
      h('button', { class: 'btn danger', onclick: async () => { await T.remove(t.id); selectedId = null; YSP.page.open('templates', renderPage); } }, 'Delete'),
      h('button', { class: 'btn', onclick: () => box.remove() }, 'Cancel'));
    ed.append(box);
    return false;
  }

  YSP.nav.add({ id: 'templates', label: 'Upload templates', icon: YSP.ICONS.template, scope: 'both', onClick: () => openPage() });
})();
