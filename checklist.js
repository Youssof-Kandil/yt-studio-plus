// Studio Plus – Pre-publish checklist. A small pill next to Publish/Save in the
// upload dialog and on a video's details page ("Checklist: 2 to fix"). Clicking it
// shows each check. Which checks run (or the whole thing) is set in ⚙ Settings.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.checklist) return;
  const { h, form: F } = YSP;

  // id, label shown in settings, default on/off
  const CHECKS = [
    { id: 'title', label: 'Title is more than the file name', on: true },
    { id: 'description', label: 'Description has at least 100 characters', on: true },
    { id: 'tags', label: 'Has tags', on: true },
    { id: 'playlist', label: 'Added to a playlist', on: true },
    { id: 'thumbnail', label: 'Custom thumbnail uploaded', on: true },
    { id: 'endscreen', label: 'Has an end screen (long videos)', on: true },
    { id: 'audience', label: 'Audience (made for kids) answered', on: true },
    { id: 'hashtag', label: 'Has a #hashtag in title or description', on: false },
  ];
  YSP.checklist = { CHECKS };

  const enabled = (id) => {
    const items = YSP.settings.checklistItems || {};
    return id in items ? !!items[id] : CHECKS.find((c) => c.id === id).on;
  };

  // ---------------------------------------------------------------- data that needs the API
  const apiCache = new Map(); // videoId -> { at, tags, endscreen, isShort, durMs }
  const inflight = new Set();
  function apiInfo(id) {
    const c = apiCache.get(id);
    if ((!c || Date.now() - c.at > 30000) && !inflight.has(id)) {
      inflight.add(id);
      Promise.allSettled([
        YSP.call('getMetadata', { videoIds: [id] }),
        YSP.call('getEndscreens', { videoIds: [id] }),
        YSP.call('getDurations', { videoIds: [id] }),
      ]).then(([meta, es, dur]) => {
        const v = meta.status === 'fulfilled' && meta.value[0];
        const e = es.status === 'fulfilled' ? es.value[id] : undefined;
        apiCache.set(id, {
          at: Date.now(),
          tags: v ? YSP.extractTags(v.tags) : null,
          tagsFailed: !v,
          isShort: v ? v.contentType === 'CREATOR_CONTENT_TYPE_SHORTS' : null,
          endscreen: e === undefined ? null : !!(e && (e.elements || []).length),
          endscreenFailed: e === undefined,
          durMs: dur.status === 'fulfilled' ? dur.value[id] : null,
        });
      }).finally(() => inflight.delete(id));
    }
    return c || null;
  }

  // ---------------------------------------------------------------- run the checks
  // Each result: { id, label, state: 'ok' | 'warn' | 'unknown', hint }
  function evaluate(videoId) {
    const out = [];
    const add = (id, label, state, hint) => { if (enabled(id)) out.push({ id, label, state, hint }); };
    const api = videoId ? apiInfo(videoId) : null;

    const title = F.getText('title').trim();
    const file = (YSP.uploadFilename() || '').trim();
    add('title', 'Title', !title ? 'warn' : (file && title.toLowerCase() === file.toLowerCase() ? 'warn' : 'ok'),
      !title ? 'The title is empty.' : (file && title.toLowerCase() === file.toLowerCase() ? 'The title is still the file name.' : ''));

    const desc = F.getText('description').trim();
    add('description', 'Description', desc.length >= 100 ? 'ok' : 'warn',
      desc.length >= 100 ? '' : desc.length ? `Only ${desc.length} characters – at least 100 helps search.` : 'The description is empty.');

    // Tags live under "Show more"; when it's closed, use the saved tags instead.
    let tags = F.getTags();
    const tagsVisible = !!F.root().querySelector('ytcp-free-text-chip-bar');
    if (!tagsVisible) tags = api && api.tags;
    add('tags', 'Tags', tags == null ? 'unknown' : tags.length ? 'ok' : 'warn',
      tags == null ? (api && api.tagsFailed ? 'Couldn\'t check – open “Show more” to see your tags.' : 'Checking…') : tags.length ? '' : 'No tags yet (under “Show more”).');

    const pls = F.getPlaylists();
    add('playlist', 'Playlist', pls.length ? 'ok' : 'warn', pls.length ? '' : 'Not in any playlist.');

    const uploader = F.root().querySelector('ytcp-thumbnail-uploader');
    const hasThumb = uploader ? [...uploader.querySelectorAll('img')].some((i) => YSP.visible(i) && i.getAttribute('src')) : null;
    add('thumbnail', 'Thumbnail', hasThumb == null ? 'unknown' : hasThumb ? 'ok' : 'warn',
      hasThumb == null ? 'Thumbnail section not found.' : hasThumb ? '' : 'Using an auto-generated thumbnail.');

    if (enabled('endscreen')) {
      const tooShort = api && api.durMs && api.durMs < 25000;
      if (api && (api.isShort || tooShort)) {
        // Shorts and videos under 25 s can't have end screens – nothing to check.
      } else {
        add('endscreen', 'End screen', !api || api.endscreen == null ? 'unknown' : api.endscreen ? 'ok' : 'warn',
          !api ? 'Checking…' : api.endscreenFailed ? 'Couldn\'t check right now.' : api.endscreen ? '' : 'No end screen (Editor → End screen, or the “Video elements” step).');
      }
    }

    const mfk = F.radioValue(...F.RADIOS.madeForKids);
    add('audience', 'Audience', mfk ? 'ok' : 'warn', mfk ? '' : 'Choose whether it\'s made for kids.');

    const hasHash = /(^|\s)#[\p{L}\p{N}_]+/u.test(title + ' ' + desc);
    add('hashtag', 'Hashtag', hasHash ? 'ok' : 'warn', hasHash ? '' : 'No #hashtag in the title or description.');
    return out;
  }

  // ---------------------------------------------------------------- the pill + popover
  const ui = YSP.makeHost('ysp-checklist-host', `
.pop { position: fixed; z-index: 2147483300; width: 330px; display: none; flex-direction: column; background: var(--bg2); color: var(--fg);
  border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.45); overflow: hidden; }
.pop.open { display: flex; }
.hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; }
.hd b { flex: 1; font-size: 14px; }
.items { padding: 2px 8px 6px; display: flex; flex-direction: column; gap: 2px; }
.it { display: flex; gap: 8px; padding: 5px 6px; border-radius: 6px; align-items: flex-start; }
.it .ic { width: 16px; flex: none; text-align: center; }
.it.ok .ic { color: var(--good); } .it.warn .ic { color: var(--warn); } .it.unknown .ic { color: var(--muted); }
.it .tx { flex: 1; min-width: 0; }
.it .hint { color: var(--muted); font-size: 11.5px; }
.ft { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--muted); }
.ft .spacer { flex: 1; }
`);
  const pop = h('div', { class: 'pop' });
  ui.shadow.append(pop);
  let pill = null, lastKey = '';
  const P = { open: false, results: [] };

  function closePop() { P.open = false; pop.classList.remove('open'); }
  document.addEventListener('mousedown', (e) => {
    if (!P.open) return;
    const path = e.composedPath();
    if (path.includes(ui.host) || (pill && path.includes(pill))) return;
    closePop();
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && P.open) { e.stopPropagation(); closePop(); } }, true);

  function openSettings() {
    closePop();
    if (YSP.panel && YSP.panel.open) YSP.panel.open('settings');
    // Point the user at the checklist section in the panel's settings.
    setTimeout(() => {
      const host = document.getElementById('ysp-host');
      const sec = host && host.shadowRoot && host.shadowRoot.getElementById('checklist-settings');
      if (!sec) return;
      sec.scrollIntoView({ block: 'center', behavior: 'smooth' });
      sec.classList.remove('flash'); void sec.offsetWidth; sec.classList.add('flash');
    }, 150);
  }

  function renderPop() {
    const warn = P.results.filter((r) => r.state === 'warn').length;
    pop.replaceChildren(
      h('div', { class: 'hd' }, h('b', { text: warn ? `Before you publish: ${warn} to fix` : 'All checks passed' }), h('span', { class: 'brand', text: 'Studio Plus' })),
      h('div', { class: 'items' }, P.results.map((r) => h('div', { class: 'it ' + r.state },
        h('span', { class: 'ic', text: r.state === 'ok' ? '✓' : r.state === 'warn' ? '⚠' : '…' }),
        h('div', { class: 'tx' }, h('div', { text: r.label }), r.hint ? h('div', { class: 'hint', text: r.hint }) : null)))),
      h('div', { class: 'ft' },
        h('span', { text: 'Only a reminder – nothing is blocked.' }), h('span', { class: 'spacer' }),
        h('button', { class: 'link', text: '⚙ Choose checks / turn off', onclick: openSettings })));
    position();
  }
  function position() {
    if (!P.open || !pill || !pill.isConnected) return;
    const r = pill.getBoundingClientRect();
    const W = 330, H = pop.offsetHeight || 300;
    pop.style.left = Math.min(Math.max(8, r.right - W), innerWidth - W - 8) + 'px';
    pop.style.top = (r.top - H - 8 > 8 ? r.top - H - 8 : r.bottom + 8) + 'px';
  }
  window.addEventListener('resize', position);

  function makePill() {
    const el = h('button', {
      class: 'ysp-checklist-pill', type: 'button', title: 'Studio Plus pre-publish checklist – click for details. Turn it off or choose checks in ⚙ Settings.',
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); P.open = !P.open; pop.classList.toggle('open', P.open); ui.host.classList.toggle('dark', YSP.isDark()); P.sig = null; renderPop(); },
    });
    return el;
  }

  // Where to put the pill: next to Next/Publish in the upload dialog, or Save on details.
  function anchor() {
    const dlg = YSP.uploadDialogEl();
    if (dlg) {
      const btn = dlg.querySelector('ytcp-button#done-button') || dlg.querySelector('ytcp-button#next-button');
      return btn && YSP.visible(btn) ? btn : null;
    }
    if (YSP.detailsId() && /\/edit\/?$/.test(location.pathname)) {
      const save = document.querySelector('ytcp-button#save');
      return save && YSP.visible(save) ? save : null;
    }
    return null;
  }

  function videoIdNow() {
    return YSP.uploadDialogEl() ? YSP.uploadingVideoId() : YSP.detailsId();
  }

  function tick() {
    if (YSP.settings.checklist === false || !F.available()) { if (pill) { pill.remove(); pill = null; } closePop(); return; }
    const a = anchor();
    if (!a) { if (pill) { pill.remove(); pill = null; } closePop(); return; }
    if (!pill || !pill.isConnected) { pill = makePill(); }
    if (pill.nextElementSibling !== a) a.parentElement.insertBefore(pill, a);
    P.results = evaluate(videoIdNow());
    const warn = P.results.filter((r) => r.state === 'warn').length;
    const unknown = P.results.filter((r) => r.state === 'unknown').length;
    const key = warn + ':' + unknown + ':' + P.results.length;
    if (key !== lastKey || !pill.firstChild) {
      lastKey = key;
      pill.classList.toggle('ok', !warn);
      pill.replaceChildren(h('span', { class: 'dot' }),
        h('span', { text: !P.results.length ? 'Checklist off' : warn ? `Checklist: ${warn} to fix` : 'Checklist ✓' }));
    }
    // Re-draw the open popover only when something changed (so clicks inside it aren't interrupted).
    const sig = P.results.map((r) => r.id + r.state + r.hint).join('|');
    if (P.open && sig !== P.sig) { P.sig = sig; renderPop(); }
  }

  YSP.settingsReady.then(() => { YSP.onTick.add(tick); });
})();
