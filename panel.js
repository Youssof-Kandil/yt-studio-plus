// Studio Plus – right-hand side panel: video switcher + "Copy from" metadata view.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.panel) return;
  const { h, videos: V, form: F } = YSP;

  const PANEL_W = 400;
  const S = {
    open: false, view: 'list', mode: 'other', currentId: null,
    query: '', filter: 'all',
    source: null, sourceLoading: false, sourceError: null, selectedTags: new Set(),
    userClosedFor: null,
  };
  const panelApi = (YSP.panel = { sections: [], state: S, PANEL_W });

  const { host, shadow } = YSP.makeHost('ysp-host', CSS());
  const panel = h('aside', { class: 'panel', 'aria-label': 'Studio Plus' });
  const tab = h('button', { class: 'tab', title: 'Show my videos (Alt+V)', onclick: () => setOpen(true) },
    h('span', { class: 'tab-ico', text: '▤' }), h('span', { class: 'tab-txt', text: 'My videos' }));
  shadow.append(tab, panel);
  document.documentElement.style.setProperty('--ysp-w', PANEL_W + 'px');

  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); setOpen(!S.open); }
  }, true);

  let listEl = null, countEl = null;
  const toast = YSP.toast;

  function modeKey() { return S.mode + ':' + (S.currentId || ''); }
  function setOpen(open, { byUser = true } = {}) {
    S.open = open;
    if (!open && byUser) S.userClosedFor = modeKey();
    if (open && byUser) S.userClosedFor = null;
    if (open) V.ensure();
    applyLayout();
    render();
  }
  panelApi.open = (view) => { if (view) S.view = view; setOpen(true); };
  panelApi.render = () => render();

  function applyLayout() {
    const root = document.documentElement;
    host.classList.toggle('dark', YSP.isDark());
    root.classList.toggle('ysp-push', S.open && YSP.settings.pushLayout && S.mode !== 'upload');
    root.classList.toggle('ysp-upload', S.open && S.mode === 'upload');
    panel.classList.toggle('open', S.open);
    tab.classList.toggle('hidden', S.open);
    YSP.page.position();
  }

  function render() {
    panel.replaceChildren();
    if (!S.open) return;
    panel.append(renderHeader());
    const body = h('div', { class: 'body' });
    if (S.view === 'settings') body.append(renderSettings());
    else if (S.view === 'compare') body.append(renderCopyFrom());
    else body.append(renderListView());
    panel.append(body);
    if (S.view === 'list') renderList();
  }

  function renderHeader() {
    const title = S.mode === 'upload' ? 'Templates & previous videos' : 'My videos';
    const sub = S.mode === 'upload'
      ? 'Apply a template, continue a series, or copy from an older video'
      : S.mode === 'details' ? 'Switch videos without leaving the details page' : 'Your uploads';
    return h('header', { class: 'hdr' },
      h('div', { class: 'hdr-txt' }, h('div', { class: 'hdr-title' }, title, h('span', { class: 'brand', text: 'Studio Plus' })), h('div', { class: 'hdr-sub', text: sub })),
      h('button', { class: 'icon', title: 'Settings', onclick: () => { S.view = S.view === 'settings' ? 'list' : 'settings'; render(); } }, '⚙'),
      h('button', { class: 'icon', title: 'Close (Alt+V)', onclick: () => setOpen(false) }, '✕'));
  }

  function renderSettings() {
    const row = (key, label, hint) => {
      const cb = h('input', { type: 'checkbox', checked: !!YSP.settings[key] });
      cb.addEventListener('change', () => {
        YSP.settings[key] = cb.checked;
        YSP.saveSettings();
        applyLayout();
      });
      return h('label', { class: 'set-row' }, cb, h('div', null, h('div', { text: label }), h('div', { class: 'muted', text: hint })));
    };
    return h('div', { class: 'settings' },
      h('button', { class: 'link back', onclick: () => { S.view = 'list'; render(); } }, '← Back'),
      row('autoOpenDetails', 'Open automatically on video pages', 'Show the list when you open a video\'s details or analytics.'),
      row('autoOpenUpload', 'Open automatically when uploading', 'Show templates and previous videos beside the upload dialog.'),
      row('pushLayout', 'Make room for the panel', 'Shrink Studio so the panel sits beside it instead of covering it.'),
      row('likesColumn', 'Likes column on the Content page', 'Adds likes, dislikes and like ratio back to your video list.'),
      h('div', { class: 'muted small' }, 'Shortcut: Alt+V toggles the panel.'),
      h('button', { class: 'btn', onclick: () => { V.list = []; V.nextToken = null; V.loadedOnce = false; S.view = 'list'; render(); V.load(); } }, 'Refresh video list'));
  }

  function renderListView() {
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Search your videos…' });
    search.value = S.query;
    search.addEventListener('input', () => { S.query = search.value; renderList(); });
    const select = h('select', { class: 'filter', title: 'Visibility' },
      ['all', 'public', 'unlisted', 'private', 'draft'].map((f) => h('option', { value: f, text: f[0].toUpperCase() + f.slice(1) })));
    select.value = S.filter;
    select.addEventListener('change', () => { S.filter = select.value; renderList(); });
    countEl = h('div', { class: 'count muted' });
    listEl = h('div', { class: 'list' });
    const sections = [];
    for (const fn of panelApi.sections) {
      try { const n = fn({ mode: S.mode, currentId: S.currentId }); if (n) sections.push(n); } catch (e) { console.error('[Studio Plus]', e); }
    }
    const scroller = h('div', { class: 'scroller' }, sections,
      sections.length ? h('div', { class: 'section-title', text: S.mode === 'upload' ? 'Copy from a previous video' : 'Your videos' }) : null,
      h('div', { class: 'toolbar' }, search, select), countEl, listEl);
    scroller.addEventListener('scroll', () => {
      if (!S.query && V.nextToken && !V.loading && scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 300) V.load({ more: true });
    });
    return h('div', { class: 'listview' }, scroller);
  }

  function filtered() {
    const q = S.query.trim().toLowerCase();
    return V.list.filter((v) => {
      if (S.filter !== 'all' && v.privacy !== S.filter) return false;
      if (!q) return true;
      return v.title.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q) || v.id.toLowerCase() === q;
    });
  }

  function hrefFor(id, section) {
    if (section === 'same' && S.mode === 'details' && S.currentId) return location.pathname.replace(S.currentId, id);
    if (section === 'analytics') return `/video/${id}/analytics/tab-overview/period-default`;
    if (section === 'comments') return `/video/${id}/comments/inbox`;
    return `/video/${id}/edit`;
  }

  function renderList() {
    if (!listEl || S.view !== 'list' || !S.open) return;
    const vids = filtered();
    const excluded = S.mode === 'upload' ? YSP.uploadingVideoId() : null;
    countEl.textContent = V.list.length ? `${vids.length} of ${V.list.length}${V.nextToken ? '+' : ''} videos` : '';
    const items = vids.filter((v) => v.id !== excluded).map(renderItem);
    const tail = [];
    if (V.error) {
      tail.push(h('div', { class: 'error' },
        h('div', { text: 'Could not load your videos: ' + V.error }),
        h('button', { class: 'btn', onclick: () => V.load({ more: V.list.length > 0 }) }, 'Retry')));
    }
    if (V.loading) tail.push(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading…'));
    else if (V.nextToken) {
      if (S.query || S.filter !== 'all') tail.push(h('button', { class: 'btn wide', onclick: () => V.loadAll() }, 'Search older videos too (load all)'));
      else tail.push(h('button', { class: 'btn wide', onclick: () => V.load({ more: true }) }, 'Load more'));
    }
    if (!V.loading && !V.error && V.loadedOnce && !items.length) {
      tail.push(h('div', { class: 'empty muted', text: V.list.length ? 'No videos match.' : 'No videos found on this channel yet.' }));
    }
    listEl.replaceChildren(...items, ...tail);
  }
  V.subscribe(() => { renderList(); });

  function renderItem(v) {
    const isCurrent = v.id === S.currentId && S.mode === 'details';
    const canApply = !!F.targetLabel();
    const primaryHref = S.mode === 'upload' ? null : hrefFor(v.id, 'same');
    const thumb = h('div', { class: 'thumb' },
      h('img', { src: v.thumb, loading: 'lazy', alt: '' }),
      v.length ? h('span', { class: 'dur', text: YSP.fmtDur(v.length) }) : null);
    const titleEl = primaryHref
      ? h('a', { class: 'vtitle', href: primaryHref, title: v.title, text: v.title })
      : h('div', { class: 'vtitle', title: v.title, text: v.title });
    const stats = [];
    if (v.views != null) stats.push(h('span', { title: 'Views' }, '👁 ', YSP.fmtNum(v.views)));
    if (v.likes != null) stats.push(h('span', { title: 'Likes' }, '👍 ', YSP.fmtNum(v.likes)));
    if (v.comments != null) stats.push(h('span', { title: 'Comments' }, '💬 ', YSP.fmtNum(v.comments)));
    const actions = h('div', { class: 'actions' },
      h('button', { class: 'chipbtn primary', title: canApply ? `Copy fields from this video into ${F.targetLabel()}` : 'View and copy this video\'s title, description and tags', onclick: (e) => { e.preventDefault(); e.stopPropagation(); openCopyFrom(v.id); } }, canApply ? 'Copy from…' : 'Metadata'),
      S.mode === 'upload' ? null : h('a', { class: 'chipbtn', href: hrefFor(v.id, 'edit') }, 'Details'),
      S.mode === 'upload' ? null : h('a', { class: 'chipbtn', href: hrefFor(v.id, 'analytics') }, 'Analytics'),
      S.mode === 'upload' || !YSP.compare ? null : h('button', { class: 'chipbtn', title: isCurrent ? 'Compare this video with another' : (S.currentId ? 'Compare with the video you are viewing' : 'Compare this video'), onclick: (e) => { e.preventDefault(); YSP.compare.open(S.currentId && !isCurrent ? S.currentId : v.id, S.currentId && !isCurrent ? v.id : null); } }, 'Compare'));
    const item = h('div', { class: 'item' + (isCurrent ? ' current' : '') },
      primaryHref ? h('a', { class: 'thumb-link', href: primaryHref, tabindex: '-1' }, thumb) : thumb,
      h('div', { class: 'meta' },
        titleEl,
        h('div', { class: 'sub' },
          h('span', { class: `pill ${v.privacy}`, text: v.privacy }),
          v.ts ? h('span', { class: 'muted', title: v.tsLabel, text: YSP.fmtDate(v.ts) }) : null,
          isCurrent ? h('span', { class: 'pill viewing', text: 'viewing' }) : null),
        stats.length ? h('div', { class: 'stats muted' }, stats) : null,
        actions));
    if (S.mode === 'upload') {
      item.classList.add('clickable');
      item.addEventListener('click', (e) => { if (!e.target.closest('button')) openCopyFrom(v.id); });
    }
    return item;
  }

  // ---------------------------------------------------------------------------
  // "Copy from" view
  // ---------------------------------------------------------------------------
  async function openCopyFrom(id) {
    const base = V.get(id);
    S.view = 'compare';
    S.source = base ? { id, title: base.title, description: base.description, tags: [], thumb: base.thumb, privacy: base.privacy, category: '' } : null;
    S.sourceLoading = true; S.sourceError = null;
    render();
    try {
      const raw = await YSP.call('getVideo', { videoId: id });
      const n = YSP.normVideo(raw);
      let tags = YSP.extractTags(raw.tags);
      let description = typeof raw.description === 'string' ? raw.description : n.description;
      if ((!raw.tags || description == null) && n.privacy !== 'private' && n.privacy !== 'draft') {
        const fb = await YSP.watchPageFallback(id);
        if (fb) {
          if (!raw.tags && fb.tags.length) tags = fb.tags;
          if (description == null) description = fb.description;
        }
      }
      S.source = Object.assign(n, { tags, description: description || '', category: YSP.categoryLabel(raw.category) });
      S.selectedTags = new Set(tags);
    } catch (e) {
      S.sourceError = e.message;
    } finally {
      S.sourceLoading = false;
      if (S.view === 'compare') render();
    }
  }
  panelApi.openCopyFrom = (id) => { setOpen(true); openCopyFrom(id); };

  async function applyField(kind, mode) {
    const v = S.source;
    if (!v) return;
    if (!F.targetLabel()) { toast('Open a video details page or the upload dialog first. You can still use Copy.', 'warn'); return; }
    try {
      if (kind === 'title' || kind === 'description') {
        F.setText(kind, kind === 'title' ? v.title : v.description || '', mode === 'append');
        toast(`${kind === 'title' ? 'Title' : 'Description'} ${mode === 'append' ? 'appended' : 'replaced'}. Applied to ${F.targetLabel()}.`);
      } else if (kind === 'tags') {
        const tags = v.tags.filter((t) => S.selectedTags.has(t));
        if (!tags.length) { toast('No tags selected.', 'warn'); return; }
        const r = await F.addTags(tags);
        if (r.added > 0) toast(`Added ${r.added} tag${r.added === 1 ? '' : 's'}.`);
        else if (r.leftover) toast('Tags were typed into the Tags box. Press Enter there to confirm them.', 'warn');
        else toast('No new tags were added (they are already there).', 'warn');
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  async function applyAll() {
    if (!F.targetLabel()) { toast('Open a video details page or the upload dialog first.', 'warn'); return; }
    await applyField('title', 'replace');
    await YSP.sleep(150);
    if (S.source.description != null) await applyField('description', 'replace');
    await YSP.sleep(150);
    if (S.source.tags.length) await applyField('tags');
  }

  function fieldCard(label, count, body, buttons) {
    return h('section', { class: 'card' },
      h('div', { class: 'card-hd' }, h('span', { class: 'card-title', text: label }), count ? h('span', { class: 'muted small', text: count }) : null),
      body,
      h('div', { class: 'card-btns' }, buttons));
  }
  const copyBtn = (label, getText, msg) => h('button', { class: 'btn', onclick: async () => toast((await YSP.copyText(getText())) ? msg : 'Copy failed', 'ok') }, label);

  function renderCopyFrom() {
    const v = S.source;
    const canApply = !!F.targetLabel();
    const wrap = h('div', { class: 'compare' });
    wrap.append(h('button', { class: 'link back', onclick: () => { S.view = 'list'; render(); } }, '← All videos'));
    if (!v) {
      if (S.sourceLoading) wrap.append(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading video…'));
      if (S.sourceError) wrap.append(h('div', { class: 'error', text: S.sourceError }));
      return wrap;
    }
    wrap.append(h('div', { class: 'src' },
      h('img', { src: v.thumb, alt: '' }),
      h('div', null,
        h('div', { class: 'src-label muted small', text: 'Copying from' }),
        h('a', { class: 'src-title', href: `/video/${v.id}/edit`, target: '_blank', text: v.title }),
        h('div', { class: 'muted small' }, v.category ? v.category + ' · ' : '', v.privacy))));
    wrap.append(h('div', { class: 'target ' + (canApply ? 'ok' : 'none') },
      canApply ? `→ "Replace" / "Add" will fill in ${F.targetLabel()}.` : 'No editable form open. Use Copy, or open a video\'s details page / the upload dialog to apply directly.'));
    if (S.sourceLoading) wrap.append(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading description & tags…'));
    if (S.sourceError) wrap.append(h('div', { class: 'error', text: 'Could not load full details: ' + S.sourceError }));

    wrap.append(fieldCard('Title', `${v.title.length}/100`, h('div', { class: 'val', text: v.title }), [
      copyBtn('Copy', () => v.title, 'Title copied'),
      canApply ? h('button', { class: 'btn primary', onclick: () => applyField('title', 'replace') }, 'Replace title') : null,
    ]));
    if (v.description != null && !S.sourceLoading) {
      wrap.append(fieldCard('Description', `${v.description.length}/5000`, h('pre', { class: 'val desc', text: v.description || '(empty)' }), [
        copyBtn('Copy', () => v.description, 'Description copied'),
        canApply ? h('button', { class: 'btn', onclick: () => applyField('description', 'append') }, 'Append') : null,
        canApply ? h('button', { class: 'btn primary', onclick: () => applyField('description', 'replace') }, 'Replace') : null,
      ]));
    }
    if (!S.sourceLoading) {
      const countSpan = h('span');
      const updateCount = () => { countSpan.textContent = `${v.tags.filter((t) => S.selectedTags.has(t)).length}/${v.tags.length} selected · ${v.tags.join(',').length}/500 chars`; };
      const chips = h('div', { class: 'tags' }, v.tags.length ? v.tags.map((t) => {
        const c = h('button', { class: 'tag' + (S.selectedTags.has(t) ? ' on' : ''), title: 'Click to include/exclude', text: t });
        c.addEventListener('click', () => {
          if (S.selectedTags.has(t)) S.selectedTags.delete(t); else S.selectedTags.add(t);
          c.classList.toggle('on');
          updateCount();
        });
        return c;
      }) : h('div', { class: 'muted', text: 'This video has no tags.' }));
      updateCount();
      const card = fieldCard('Tags', null, chips, v.tags.length ? [
        h('button', { class: 'link small', onclick: () => { S.selectedTags = new Set(S.selectedTags.size === v.tags.length ? [] : v.tags); render(); } }, 'All / none'),
        copyBtn('Copy', () => v.tags.filter((t) => S.selectedTags.has(t)).join(', '), 'Tags copied'),
        canApply ? h('button', { class: 'btn primary', onclick: () => applyField('tags') }, 'Add to video') : null,
      ] : []);
      card.querySelector('.card-hd').append(h('span', { class: 'muted small' }, countSpan));
      wrap.append(card);
    }
    if (canApply && !S.sourceLoading) {
      wrap.append(h('button', { class: 'btn primary wide big', onclick: applyAll }, 'Apply title + description + tags'));
      if (S.mode === 'details') wrap.append(h('div', { class: 'muted small center', text: 'Remember to click Save in Studio when you\'re done.' }));
    }
    wrap.append(copyBtn('Copy everything as text', () => `${v.title}\n\n${v.description || ''}\n\nTags: ${v.tags.join(', ')}`, 'Everything copied'));
    wrap.lastChild.classList.add('wide');
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Route / dialog watcher
  // ---------------------------------------------------------------------------
  let lastKey = '';
  function tick() {
    const prevMode = S.mode;
    S.mode = YSP.mode();
    S.currentId = YSP.detailsId();
    const key = modeKey() + '|' + location.pathname;
    if (key !== lastKey) {
      lastKey = key;
      const st = YSP.settings;
      const auto = (S.mode === 'details' && st.autoOpenDetails) || (S.mode === 'upload' && st.autoOpenUpload);
      if (S.mode !== prevMode) {
        if (S.view === 'compare' && S.mode === 'other') S.view = 'list';
        if (S.mode === 'upload') S.view = 'list';
      }
      if (auto && S.userClosedFor !== modeKey()) setOpen(true, { byUser: false });
      else if (prevMode === 'upload' && S.mode !== 'upload' && !(S.mode === 'details' && st.autoOpenDetails)) setOpen(false, { byUser: false });
      else { applyLayout(); render(); }
    } else {
      host.classList.toggle('dark', YSP.isDark());
    }
  }
  YSP.settingsReady.then(() => { tick(); YSP.onTick.add(tick); });

  function CSS() {
    return `
.tab { position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 2147483000; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 7px; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-right: 0; border-radius: 10px 0 0 10px;
  background: var(--bg); color: var(--accent); cursor: pointer; box-shadow: -2px 2px 10px rgba(0,0,0,.18); }
.tab:hover { background: var(--accent-soft); }
.tab-ico { font-size: 16px; }
.tab-txt { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 500; letter-spacing: .3px; }
.panel { position: fixed; top: 0; right: 0; bottom: 0; width: ${PANEL_W}px; z-index: 2147483000; background: var(--bg); border-left: 1px solid var(--line);
  display: none; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,.12); }
.panel.open { display: flex; }
.hdr { display: flex; align-items: center; gap: 4px; padding: 14px 10px 12px 16px; border-bottom: 1px solid var(--line); box-shadow: inset 0 2px 0 var(--accent); }
.hdr-title { display: flex; align-items: center; gap: 8px; }
.hdr-txt { flex: 1; min-width: 0; }
.hdr-title { font-size: 16px; font-weight: 600; }
.hdr-sub { font-size: 12px; color: var(--muted); }
.icon { background: none; border: 0; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 15px; color: var(--muted); }
.icon:hover { background: var(--hover); color: var(--fg); }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.listview { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.scroller { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.section-title { font-weight: 600; padding: 12px 14px 0; }
.toolbar { display: flex; gap: 6px; padding: 10px 12px 4px; position: sticky; top: 0; background: var(--bg); z-index: 1; }
.search { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); outline: none; }
.search:focus, .filter:focus { border-color: var(--accent); }
.filter { padding: 6px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); }
.count { padding: 2px 14px 6px; font-size: 11px; }
.list { padding: 0 6px 12px; }
.item { display: flex; gap: 10px; padding: 8px 6px; border-radius: 10px; }
.item:hover { background: var(--hover); }
.item.current { background: var(--cur); }
.item.clickable { cursor: pointer; }
.thumb { position: relative; width: 128px; flex: none; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: var(--bg3); }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dur { position: absolute; right: 4px; bottom: 4px; background: rgba(0,0,0,.8); color: #fff; font-size: 11px; padding: 0 4px; border-radius: 3px; }
.meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.vtitle { font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
a.vtitle:hover { color: var(--accent); }
.sub { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 11px; }
.stats { display: flex; gap: 10px; font-size: 11px; }
.pill.viewing { background: var(--accent); color: var(--accent-fg); }
.actions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.chipbtn { font-size: 11px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); cursor: pointer; }
.chipbtn:hover { border-color: var(--accent); color: var(--accent); }
.chipbtn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.chipbtn.primary:hover { filter: brightness(1.1); color: var(--accent-fg); }
.back { margin: 8px 0 4px; }
.empty { padding: 24px; text-align: center; }
.error { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.compare { flex: 1; overflow-y: auto; padding: 0 14px 16px; }
.src { display: flex; gap: 10px; align-items: center; margin: 4px 0 10px; }
.src img { width: 112px; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; flex: none; }
.src-title { font-weight: 600; display: block; }
.src-title:hover { color: var(--accent); }
.target { font-size: 12px; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; }
.target.ok { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.target.none { background: var(--bg2); color: var(--muted); }
.card { border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 10px; background: var(--bg); }
.card-hd { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.card-title { font-weight: 600; flex: 1; }
.val { background: var(--bg2); border-radius: 6px; padding: 8px; word-break: break-word; }
.desc { margin: 0; white-space: pre-wrap; font: inherit; max-height: 240px; overflow-y: auto; }
.card-btns { display: flex; gap: 6px; justify-content: flex-end; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.card-btns .link { margin-right: auto; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; max-height: 220px; overflow-y: auto; }
.tag { font-size: 12px; padding: 3px 9px; border-radius: 14px; border: 1px dashed var(--line); background: transparent; color: var(--muted); cursor: pointer; text-decoration: line-through; }
.tag.on { border-style: solid; background: var(--bg3); color: var(--fg); text-decoration: none; }
.settings { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.set-row { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.set-row input { margin-top: 3px; accent-color: var(--accent); }
/* template section (templates.js) */
.tpl-section { padding: 10px 12px 4px; display: flex; flex-direction: column; gap: 6px; }
.tpl-section .sec-hd { display: flex; align-items: center; gap: 8px; }
.tpl-section .sec-hd b { flex: 1; font-size: 13px; }
.tpl-card { border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; display: flex; gap: 8px; align-items: center; background: var(--bg); }
.tpl-card.best { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }
.tpl-card .tc-main { flex: 1; min-width: 0; }
.tpl-card .tc-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tpl-card .tc-sub { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: var(--accent); color: var(--accent-fg); margin-left: 6px; vertical-align: middle; }
.fname { font-size: 11px; color: var(--muted); }
`;
  }
})();
