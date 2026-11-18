// Studio Plus – Bulk edit: find & replace in titles/descriptions, and add/remove
// tags, across the selected videos (or all of them). Preview first, then apply,
// with Undo. Saves use the same call as Studio's details page.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.bulkEdit) return;
  const { h } = YSP;

  const LIMITS = { title: 100, description: 5000, tags: 500 };
  const onContentList = () => /^\/channel\/UC[\w-]{22}\/videos\//.test(location.pathname);

  // ---------------------------------------------------------------- selection
  function rowVideoId(row) {
    const a = row.querySelector('a[href*="/video/"]');
    const m = a && a.getAttribute('href').match(/\/video\/([\w-]{11})/);
    return m ? m[1] : null;
  }
  function selectedIds() {
    const out = [];
    for (const row of document.querySelectorAll('ytcp-video-row')) {
      const cb = row.querySelector('ytcp-checkbox-lit');
      if (cb && (cb.checked || cb.hasAttribute('checked'))) { const id = rowVideoId(row); if (id) out.push(id); }
    }
    return out;
  }
  function injectButton() {
    const header = document.querySelector('ytcp-bulk-actions #header.opened');
    const toolbar = header && header.querySelector('.toolbar');
    if (!toolbar || toolbar.querySelector('.ysp-bulkedit-btn')) return;
    toolbar.append(h('button', {
      class: 'ysp-redirect-btn ysp-bulkedit-btn', type: 'button', title: 'Studio Plus: find & replace text and edit tags on these videos',
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); openDialog(selectedIds()); },
    }, YSP.icon('M11 4a7 7 0 015.6 11.2l4.1 4.1-1.4 1.4-4.1-4.1A7 7 0 1111 4zm0 2a5 5 0 100 10 5 5 0 000-10z', 18),
    h('span', { text: 'Find & replace…' })));
  }

  // ---------------------------------------------------------------- text helpers
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function buildRegex(find, { matchCase, wholeWord }) {
    if (!find) return null;
    let src = escapeRe(find);
    if (wholeWord) {
      if (/^\w/.test(find)) src = '\\b' + src;
      if (/\w$/.test(find)) src = src + '\\b';
    }
    return new RegExp(src, matchCase ? 'g' : 'gi');
  }
  function replaceAll(text, re, repl) {
    if (!re || !text) return { text, count: 0, spans: [] };
    let count = 0;
    const spans = [];
    const out = text.replace(re, (m, ...args) => { const idx = args[args.length - 2]; count++; spans.push({ idx, len: m.length }); return repl; });
    return { text: out, count, spans };
  }
  const splitList = (s) => s.split(/[,\n]/).map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
  // Tags YouTube refuses outright (angle brackets, or a single tag longer than the whole budget).
  const badTag = (t) => /[<>]/.test(t) || t.length > LIMITS.tags;
  function tagsLength(tags) {
    // YouTube counts quotes around tags that contain spaces, plus separators.
    return tags.reduce((n, t) => n + t.length + (/\s/.test(t) ? 2 : 0), 0) + Math.max(0, tags.length - 1);
  }

  // ---------------------------------------------------------------- dialog
  const ui = YSP.makeHost('ysp-bulkedit-host', `
.backdrop { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,.55); display: none; align-items: center; justify-content: center; }
.backdrop.open { display: flex; }
.card { width: min(760px, calc(100vw - 32px)); height: min(820px, calc(100vh - 48px)); display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.5); border-top: 3px solid var(--accent); overflow: hidden; }
.card > * { flex: none; }
.card > .preview { flex: 1 1 auto; }
.hd { display: flex; align-items: center; gap: 10px; padding: 16px 20px 6px; }
.hd h2 { margin: 0; font-size: 18px; font-weight: 600; flex: 1; }
.x { background: none; border: 0; font-size: 18px; cursor: pointer; color: var(--muted); width: 32px; height: 32px; border-radius: 50%; }
.x:hover { background: var(--hover); color: var(--fg); }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 6px 20px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: var(--bg2); padding: 6px 12px; cursor: pointer; font-weight: 500; color: var(--muted); }
.seg button.on { background: var(--accent); color: var(--accent-fg); }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; padding: 6px 20px 4px; }
.form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.opts { display: flex; flex-wrap: wrap; gap: 14px; padding: 4px 20px 8px; font-size: 12.5px; }
.opts label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.opts input { accent-color: var(--accent); }
.sum { padding: 6px 20px; font-size: 12.5px; color: var(--muted); border-top: 1px solid var(--line); }
.sum b { color: var(--fg); font-weight: 500; }
.preview { overflow: auto; padding: 4px 12px 10px; border-bottom: 1px solid var(--line); }
.row { display: flex; gap: 10px; padding: 8px; border-radius: 8px; }
.row:hover { background: var(--hover); }
.row.off { opacity: .45; }
.row input[type=checkbox] { margin-top: 3px; accent-color: var(--accent); flex: none; }
.row img { width: 80px; height: 45px; object-fit: cover; border-radius: 5px; background: var(--bg3); flex: none; }
.row .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.row .t { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chg { font-size: 12px; line-height: 1.45; word-break: break-word; }
.chg .lbl { display: inline-block; min-width: 76px; color: var(--muted); }
del { background: color-mix(in srgb, var(--err) 22%, transparent); text-decoration: line-through; border-radius: 3px; padding: 0 1px; }
ins { background: color-mix(in srgb, var(--good) 22%, transparent); text-decoration: none; border-radius: 3px; padding: 0 1px; }
.warn { color: var(--err); font-size: 12px; }
.note-i { color: var(--warn); font-size: 12px; }
.cnt { margin-left: 6px; font-size: 11px; color: var(--muted); }
.cnt.over { color: var(--err); font-weight: 500; }
.st { flex: none; width: 18px; text-align: center; }
.st.ok { color: var(--good); } .st.err { color: var(--err); } .st.skip { color: var(--warn); }
.empty { padding: 28px; text-align: center; color: var(--muted); }
.ft { display: flex; align-items: center; gap: 8px; padding: 12px 20px; }
.ft .spacer { flex: 1; }
.msg { padding: 8px 20px 0; }
.msg.err { color: var(--err); } .msg.ok { color: var(--good); }
.note { padding: 0 20px 6px; font-size: 11.5px; color: var(--muted); }
`);
  const back = h('div', { class: 'backdrop' });
  ui.shadow.append(back);
  back.addEventListener('mousedown', (e) => { if (e.target === back && !S.running) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && back.classList.contains('open') && !S.running) { e.stopPropagation(); close(); }
  }, true);

  const S = {
    selected: [], scope: 'selected', mode: 'text',
    find: '', repl: '', inTitle: true, inDesc: true, matchCase: false, wholeWord: false,
    addTags: '', removeTags: '',
    meta: {}, allIds: null, loading: false, loadError: null,
    excluded: new Set(), statuses: {}, running: false, undo: null, summary: null, changedAny: false, frozen: null,
  };

  function close() {
    back.classList.remove('open');
    back.replaceChildren();
    if (S.changedAny) YSP.toast('Reload the Content page to see the new titles.', 'ok', 6000);
  }

  async function ensureMeta(ids) {
    const need = ids.filter((id) => !S.meta[id]);
    if (!need.length) return;
    const vids = await YSP.call('getMetadata', { videoIds: need }, 120000);
    for (const v of vids) {
      S.meta[v.videoId] = {
        id: v.videoId,
        title: v.title || '',
        description: typeof v.description === 'string' ? v.description : '',
        tags: YSP.extractTags(v.tags),
        thumb: YSP.normVideo(v).thumb,
        isShort: v.contentType === 'CREATOR_CONTENT_TYPE_SHORTS',
      };
    }
  }

  async function loadScope() {
    S.loading = true; S.loadError = null; render();
    try {
      if (S.scope === 'all' && !S.allIds) {
        const r = await YSP.call('listAllWithType', {}, 120000);
        S.allIds = r.videos.map((v) => v.videoId).filter(Boolean);
      }
      await ensureMeta(scopeIds());
    } catch (e) {
      S.loadError = e.message;
    }
    S.loading = false;
    render();
  }
  const scopeIds = () => (S.scope === 'all' ? (S.allIds || []) : S.selected);

  function openDialog(ids) {
    Object.assign(S, {
      selected: ids, scope: ids.length ? 'selected' : 'all', excluded: new Set(), statuses: {},
      running: false, undo: null, summary: null, changedAny: false, frozen: null,
    });
    ui.host.classList.toggle('dark', YSP.isDark());
    back.classList.add('open');
    loadScope();
  }

  // Compute the planned change for every video in scope.
  function plan() {
    const out = [];
    const re = S.mode === 'text' ? buildRegex(S.find, S) : null;
    const typed = S.mode === 'tags' ? splitList(S.addTags) : [];
    const add = typed.filter((t) => !badTag(t));
    S.badTags = typed.filter(badTag);
    const remove = S.mode === 'tags' ? new Set(splitList(S.removeTags).map((t) => t.toLowerCase())) : new Set();
    for (const id of scopeIds()) {
      const m = S.meta[id];
      if (!m) continue;
      // warnings block the video; notes are informational (it still updates).
      const p = { id, m, changes: {}, previews: [], warnings: [], notes: [] };
      if (S.mode === 'text' && re) {
        if (S.inTitle) {
          const r = replaceAll(m.title, re, S.repl);
          if (r.count && r.text !== m.title) {
            p.changes.title = r.text.replace(/\s+/g, ' ').trim();
            p.previews.push({ field: 'Title', old: m.title, spans: r.spans, repl: S.repl, count: r.count });
            if (!p.changes.title) p.warnings.push('Title would be empty');
            if (p.changes.title.length > LIMITS.title) p.warnings.push(`Title would be ${p.changes.title.length}/100 characters`);
            if (/[<>]/.test(p.changes.title)) p.warnings.push('Titles can\'t contain < or >');
          }
        }
        if (S.inDesc) {
          const r = replaceAll(m.description, re, S.repl);
          if (r.count && r.text !== m.description) {
            p.changes.description = r.text;
            p.previews.push({ field: 'Description', old: m.description, spans: r.spans, repl: S.repl, count: r.count });
            if (r.text.length > LIMITS.description) p.warnings.push(`Description would be ${r.text.length}/5000 characters`);
            if (/[<>]/.test(r.text) && !/[<>]/.test(m.description)) p.warnings.push('Descriptions can\'t contain < or >');
          }
        }
      }
      if (S.mode === 'tags' && (add.length || remove.size)) {
        const tags = m.tags.filter((t) => !remove.has(t.toLowerCase()));
        const removed = m.tags.filter((t) => remove.has(t.toLowerCase()));
        const have = new Set(tags.map((t) => t.toLowerCase()));
        const added = [], noRoom = [];
        for (const t of add) {
          if (have.has(t.toLowerCase())) continue;
          // Add tags in the order typed, only while the total stays within 500.
          if (tagsLength(tags.concat(t)) > LIMITS.tags) { noRoom.push(t); continue; }
          tags.push(t); have.add(t.toLowerCase()); added.push(t);
        }
        const len = tagsLength(tags);
        if (added.length || removed.length) {
          p.changes.tags = tags;
          p.previews.push({ field: 'Tags', added, removed, len });
          if (noRoom.length) {
            const names = noRoom.slice(0, 3).map((t) => `“${t}”`).join(', ') + (noRoom.length > 3 ? ` and ${noRoom.length - 3} more` : '');
            p.notes.push(`${noRoom.length} ${noRoom.length === 1 ? 'tag doesn\'t' : 'tags don\'t'} fit under 500 characters, so ${noRoom.length === 1 ? 'it was' : 'they were'} left out: ${names}`);
          }
          // Only possible when a video was already over the limit before this edit.
          if (len > LIMITS.tags) p.warnings.push(`Tags are ${len}/500 characters even after this change – remove some first`);
        } else if (noRoom.length) {
          p.previews.push({ field: 'Tags', added: [], removed: [], len });
          p.warnings.push(`No room: this video already uses ${len}/500 tag characters`);
          p.changes.tags = tags; // keeps the row visible; it's blocked by the warning
        }
      }
      if (Object.keys(p.changes).length) out.push(p);
    }
    return out;
  }

  function snippet(pv) {
    // Show up to 3 matches with ~40 characters of context each.
    const parts = [];
    const shown = pv.spans.slice(0, 3);
    for (const s of shown) {
      const a = Math.max(0, s.idx - 40), b = Math.min(pv.old.length, s.idx + s.len + 40);
      parts.push(h('div', { class: 'chg' },
        h('span', { class: 'lbl', text: pv.field }),
        a > 0 ? '…' : '', pv.old.slice(a, s.idx).replace(/\n/g, ' ⏎ '),
        h('del', { text: pv.old.slice(s.idx, s.idx + s.len) }),
        pv.repl ? h('ins', { text: pv.repl }) : null,
        pv.old.slice(s.idx + s.len, b).replace(/\n/g, ' ⏎ '), b < pv.old.length ? '…' : ''));
    }
    if (pv.spans.length > shown.length) parts.push(h('div', { class: 'chg muted', text: `+ ${pv.spans.length - shown.length} more in the ${pv.field.toLowerCase()}` }));
    return parts;
  }

  let previewScroll = 0;
  function render() {
    if (!back.classList.contains('open')) return;
    const prevPreview = back.querySelector('.preview');
    if (prevPreview) previewScroll = prevPreview.scrollTop;
    const focused = ui.shadow.activeElement && ui.shadow.activeElement.dataset ? ui.shadow.activeElement.dataset.k : null;
    const caret = focused && ui.shadow.activeElement.selectionStart;

    // After Apply, keep showing exactly what was applied (with ✓/✕) until the inputs change.
    const items = (S.loading || S.loadError) ? [] : (S.frozen || plan());
    const active = items.filter((p) => !S.excluded.has(p.id) && !p.warnings.length);
    const lock = S.running;

    const seg = (opts, cur, onPick) => h('span', { class: 'seg' }, opts.map(([v, label]) =>
      h('button', { class: cur === v ? 'on' : '', disabled: lock, onclick: () => onPick(v) }, label)));

    const scopeSeg = seg([
      ['selected', `Selected videos (${S.selected.length})`],
      ['all', `All videos${S.allIds ? ` (${S.allIds.length})` : ''}`],
    ], S.scope, (v) => { S.scope = v; S.excluded = new Set(); S.statuses = {}; S.summary = null; S.frozen = null; loadScope(); });
    const modeSeg = seg([['text', 'Find & replace'], ['tags', 'Tags']], S.mode, (v) => { S.mode = v; S.statuses = {}; S.summary = null; S.frozen = null; render(); });

    const input = (key, placeholder) => h('input', {
      class: 'input', value: S[key], placeholder, 'data-k': key, disabled: lock,
      oninput: (e) => { S[key] = e.target.value; S.statuses = {}; S.summary = null; S.frozen = null; render(); },
    });
    const check = (key, label) => h('label', {}, h('input', {
      type: 'checkbox', checked: S[key], disabled: lock,
      onchange: (e) => { S[key] = e.target.checked; S.statuses = {}; S.summary = null; S.frozen = null; render(); },
    }), label);

    const form = S.mode === 'text'
      ? [
        h('div', { class: 'form' },
          h('label', {}, 'Find', input('find', 'e.g. old-link.com/sponsor')),
          h('label', {}, 'Replace with (leave empty to delete)', input('repl', 'e.g. new-link.com/sponsor'))),
        h('div', { class: 'opts' }, check('inTitle', 'Titles'), check('inDesc', 'Descriptions'), check('matchCase', 'Match case'), check('wholeWord', 'Whole words only')),
      ]
      : [
        h('div', { class: 'form' },
          h('label', {}, 'Add tags (comma-separated)', input('addTags', 'e.g. gaming, rocket league')),
          h('label', {}, 'Remove tags (comma-separated)', input('removeTags', 'e.g. old tag, 2025'))),
        h('div', { class: 'note', text: 'Tags already on a video aren\'t added twice. Removing ignores upper/lower case. YouTube allows 500 tag characters per video; if new tags don\'t all fit, the ones that fit are added in the order you typed them.' }),
        (S.badTags && S.badTags.length)
          ? h('div', { class: 'note', style: 'color: var(--err)', text: `⚠ Ignored ${S.badTags.map((t) => `“${t.length > 30 ? t.slice(0, 30) + '…' : t}”`).join(', ')}: tags can't contain < or > or be longer than 500 characters.` })
          : null,
      ];

    let summary;
    if (S.loading) summary = h('div', { class: 'sum' }, h('span', { class: 'spin', style: 'display:inline-block;vertical-align:middle;margin-right:6px' }), 'Loading titles, descriptions and tags…');
    else if (S.loadError) summary = h('div', { class: 'sum' }, h('span', { class: 'warn', text: S.loadError }));
    else {
      const blocked = items.filter((p) => p.warnings.length).length;
      summary = h('div', { class: 'sum' },
        h('b', { text: `${active.length} ${active.length === 1 ? 'video' : 'videos'} will change` }),
        ` out of ${scopeIds().length} in scope`,
        blocked ? h('span', { class: 'warn', text: ` · ${blocked} skipped (see ⚠)` }) : null,
        S.excluded.size ? ` · ${S.excluded.size} unticked` : null);
    }

    const preview = h('div', { class: 'preview' });
    if (!S.loading && !S.loadError) {
      const nothing = S.mode === 'text' ? (S.find ? 'No matches.' : 'Type something to find. Matches show up here before anything is saved.')
        : (S.addTags || S.removeTags ? 'No video would change.' : 'Type tags to add or remove. Changes show up here before anything is saved.');
      if (!items.length) preview.append(h('div', { class: 'empty', text: nothing }));
      for (const p of items) {
        const st = S.statuses[p.id];
        const off = S.excluded.has(p.id) || p.warnings.length;
        const cb = h('input', {
          type: 'checkbox', checked: !off, disabled: lock || !!p.warnings.length, title: 'Include this video',
          onchange: (e) => { if (e.target.checked) S.excluded.delete(p.id); else S.excluded.add(p.id); render(); },
        });
        const changes = [];
        for (const pv of p.previews) {
          if (pv.field === 'Tags') {
            changes.push(h('div', { class: 'chg' }, h('span', { class: 'lbl', text: 'Tags' }),
              pv.removed.map((t) => h('del', { text: t, style: 'margin-right:4px' })),
              pv.added.map((t) => h('ins', { text: t, style: 'margin-right:4px' })),
              h('span', { class: 'cnt' + (pv.len > LIMITS.tags ? ' over' : ''), text: `${pv.len}/500` })));
          } else changes.push(...snippet(pv));
        }
        preview.append(h('div', { class: 'row' + (off ? ' off' : '') },
          st ? h('span', { class: 'st ' + st.kind, text: { ok: '✓', err: '✕', skip: '–' }[st.kind] || '…', title: st.msg || '' }) : cb,
          h('img', { src: p.m.thumb || '', alt: '', loading: 'lazy' }),
          h('div', { class: 'main' },
            h('div', { class: 't', text: p.m.title, title: p.m.title }),
            changes,
            p.warnings.map((w) => h('div', { class: 'warn', text: '⚠ ' + w })),
            (p.notes || []).map((n) => h('div', { class: 'note-i', text: 'ⓘ ' + n })),
            st && st.kind === 'err' ? h('div', { class: 'warn', text: st.msg }) : null,
            st && st.kind === 'skip' ? h('div', { class: 'note-i', text: st.msg }) : null)));
      }
    }

    const applyBtn = h('button', {
      class: 'btn primary', disabled: lock || !active.length || S.loading,
      text: S.running ? 'Saving…' : `Update ${active.length} ${active.length === 1 ? 'video' : 'videos'}`,
      onclick: () => run(active),
    });
    const undoBtn = S.undo && S.undo.length && !lock
      ? h('button', { class: 'link', text: `Undo (restore ${S.undo.length})`, onclick: runUndo }) : null;
    const cancel = S.running
      ? h('button', { class: 'btn danger', text: S.stopRequested ? 'Stopping…' : 'Stop', disabled: S.stopRequested, title: 'Finish the current video, then stop', onclick: () => { S.stopRequested = true; render(); } })
      : h('button', { class: 'btn', text: S.summary ? 'Close' : 'Cancel', onclick: close });
    const msg = S.summary ? h('div', { class: 'msg ' + S.summary.kind, text: S.summary.text }) : null;

    back.replaceChildren(h('div', { class: 'card', role: 'dialog', 'aria-label': 'Bulk edit' }, ...[
      h('div', { class: 'hd' }, h('h2', { text: 'Find & replace' }), h('span', { class: 'brand', text: 'Studio Plus' }),
        h('button', { class: 'x', text: '✕', title: 'Close', disabled: lock, onclick: close })),
      h('div', { class: 'bar' }, scopeSeg, modeSeg),
      ...form,
      summary,
      preview,
      msg,
      h('div', { class: 'ft' }, undoBtn, h('span', { class: 'spacer' }), cancel, applyBtn),
    ].filter(Boolean)));

    preview.scrollTop = previewScroll;
    if (focused) {
      const el = ui.shadow.querySelector(`[data-k="${focused}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (_) {} }
    }
  }

  async function run(active) {
    if (S.running || !active.length) return;
    S.running = true; S.stopRequested = false; S.summary = null; S.statuses = {}; S.undo = null; S.frozen = active;
    for (const p of active) S.statuses[p.id] = { kind: 'busy' };
    render();
    const undo = [];
    let ok = 0, fail = 0, skipped = 0, streak = 0, haltReason = null;
    for (const p of active) {
      if (haltReason || S.stopRequested) {
        S.statuses[p.id] = { kind: 'skip', msg: haltReason || 'Not attempted – you pressed Stop' };
        skipped++;
        continue;
      }
      const before = { title: p.m.title, description: p.m.description, tags: p.m.tags.slice() };
      try {
        await YSP.call('updateMetadata', Object.assign({ videoId: p.id }, p.changes), 30000);
        undo.push({ id: p.id, fields: Object.fromEntries(Object.keys(p.changes).map((k) => [k, before[k]])) });
        S.statuses[p.id] = { kind: 'ok' };
        ok++; streak = 0;
      } catch (e) {
        S.statuses[p.id] = { kind: 'err', msg: e.message };
        fail++; streak++;
        // Three failures in a row usually means a shared cause (signed out, offline,
        // YouTube refusing) – stop instead of hammering every remaining video.
        if (streak >= 3) haltReason = 'Not attempted – stopped after 3 failures in a row';
      }
      render();
      await YSP.sleep(300);
    }
    // Read back what YouTube actually stored, so "✓" means saved.
    const done = active.filter((p) => S.statuses[p.id].kind === 'ok').map((p) => p.id);
    if (done.length) {
      for (const id of done) delete S.meta[id];
      try { await ensureMeta(done); } catch (_) {}
      for (const p of active) {
        if (S.statuses[p.id].kind !== 'ok') continue;
        const now = S.meta[p.id];
        const same = now && Object.entries(p.changes).every(([k, v]) => (k === 'tags'
          ? now.tags.map((t) => t.toLowerCase()).sort().join('\n') === v.map((t) => t.toLowerCase()).sort().join('\n')
          : (now[k] || '').trim() === String(v).trim()));
        if (now && !same) {
          S.statuses[p.id] = { kind: 'err', msg: 'YouTube accepted the request but didn\'t store the change.' };
          ok--; fail++;
        }
      }
    }
    S.running = false;
    S.undo = undo;
    S.changedAny = S.changedAny || ok > 0;
    const parts = [`${ok} updated`];
    if (fail) parts.push(`${fail} failed`);
    if (skipped) parts.push(`${skipped} not attempted`);
    S.summary = {
      kind: fail || skipped ? 'err' : 'ok',
      text: fail || skipped
        ? parts.join(', ') + '.' + (haltReason ? ' Stopped after 3 failures in a row – check the first error, then try again.' : '') + (ok ? ' Undo restores the ones that changed.' : '')
        : `Done: ${ok} ${ok === 1 ? 'video' : 'videos'} updated.`,
    };
    S.stopRequested = false;
    YSP.toast(S.summary.text, fail ? 'error' : 'ok');
    render();
  }

  async function runUndo() {
    if (S.running || !S.undo || !S.undo.length) return;
    S.running = true; render();
    let ok = 0, fail = 0;
    for (const u of S.undo) {
      try {
        await YSP.call('updateMetadata', Object.assign({ videoId: u.id }, u.fields), 30000);
        delete S.meta[u.id];
        ok++;
      } catch (e) { fail++; }
      await YSP.sleep(300);
    }
    try { await ensureMeta(S.undo.map((u) => u.id)); } catch (_) {}
    S.running = false; S.undo = null; S.statuses = {}; S.frozen = null;
    S.summary = { kind: fail ? 'err' : 'ok', text: fail ? `Restored ${ok}, ${fail} failed.` : `Undone: ${ok} ${ok === 1 ? 'video' : 'videos'} restored.` };
    render();
  }

  YSP.bulkEdit = { open: openDialog };
  YSP.onTick.add(() => { if (onContentList()) injectButton(); });
})();
