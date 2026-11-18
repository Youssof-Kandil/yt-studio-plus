// Studio Plus – "Redirect Shorts to…": bulk-set the related (linked) video of
// the Shorts selected on Content → Shorts.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.shortsRedirect) return;
  const { h } = YSP;

  const onShortsList = () => /^\/channel\/UC[\w-]{22}\/videos\/short/.test(location.pathname);

  // ---------------------------------------------------------------- selection
  function rowVideoId(row) {
    const a = row.querySelector('a[href*="/video/"]');
    const m = a && a.getAttribute('href').match(/\/video\/([\w-]{11})/);
    return m ? m[1] : null;
  }
  function selectedShorts() {
    const out = [];
    for (const row of document.querySelectorAll('ytcp-video-row')) {
      const cb = row.querySelector('ytcp-checkbox-lit');
      if (!cb || !(cb.checked || cb.hasAttribute('checked'))) continue;
      const id = rowVideoId(row);
      if (!id) continue;
      const t = row.querySelector('#video-title');
      const img = row.querySelector('img');
      out.push({ id, title: (t && t.textContent.trim()) || id, thumb: img && img.src });
    }
    return out;
  }

  // ---------------------------------------------------------- bulk bar button
  function injectButton() {
    const header = document.querySelector('ytcp-bulk-actions #header.opened');
    const toolbar = header && header.querySelector('.toolbar');
    if (!toolbar) return;
    if (toolbar.querySelector('.ysp-redirect-btn')) return;
    const btn = h('button', {
      class: 'ysp-redirect-btn', type: 'button', title: 'Studio Plus: point the selected Shorts at one of your videos',
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); openDialog(); },
    }, YSP.icon('M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z', 18), h('span', { text: 'Redirect Shorts to…' }));
    toolbar.append(btn);
  }

  // -------------------------------------------------------------- the dialog
  const ui = YSP.makeHost('ysp-redirect-host', `
.backdrop { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,.55); display: none; align-items: center; justify-content: center; }
.backdrop.open { display: flex; }
.card { width: min(620px, calc(100vw - 32px)); max-height: calc(100vh - 64px); display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.5); border-top: 3px solid var(--accent); overflow: hidden; }
.card > * { flex: none; }
.card > .list { flex: 1 1 auto; }
.hd { display: flex; align-items: center; gap: 10px; padding: 16px 20px 8px; }
.hd h2 { margin: 0; font-size: 18px; font-weight: 600; flex: 1; }
.x { background: none; border: 0; font-size: 18px; cursor: pointer; color: var(--muted); width: 32px; height: 32px; border-radius: 50%; }
.x:hover { background: var(--hover); color: var(--fg); }
.sub { padding: 0 20px 10px; color: var(--muted); }
.sec { padding: 6px 20px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.shorts { padding: 0 20px 8px; display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow: auto; }
.short { display: flex; align-items: center; gap: 10px; font-size: 12px; min-height: 40px; }
.short img { width: 24px; height: 40px; object-fit: cover; border-radius: 4px; background: var(--bg3); flex: none; }
.short .t { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.short .cur { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.short .st { width: 18px; text-align: center; flex: none; }
.st.ok { color: var(--good); } .st.err { color: var(--err); }
.search { padding: 4px 20px 8px; }
.list { flex: 1; min-height: 160px; overflow: auto; padding: 0 12px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vid { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.vid:hover { background: var(--hover); }
.vid.sel { background: var(--cur); border-color: var(--accent); }
.vid img { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; background: var(--bg3); flex: none; }
.vid .meta { flex: 1; min-width: 0; }
.vid .tt { font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.vid .info { color: var(--muted); font-size: 11.5px; margin-top: 2px; display: flex; gap: 6px; align-items: center; }
.vid .radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--muted); flex: none; }
.vid.sel .radio { border-color: var(--accent); background: radial-gradient(var(--accent) 45%, transparent 50%); }
.ft { display: flex; align-items: center; gap: 8px; padding: 12px 20px; }
.ft .spacer { flex: 1; }
.msg { padding: 8px 20px 0; }
.msg.err { color: var(--err); } .msg.ok { color: var(--good); }
.empty { padding: 24px; text-align: center; color: var(--muted); }
`);
  const back = h('div', { class: 'backdrop' });
  ui.shadow.append(back);
  back.addEventListener('mousedown', (e) => { if (e.target === back && !state.running) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && back.classList.contains('open') && !state.running) { e.stopPropagation(); close(); }
  }, true);

  const state = { shorts: [], target: null, query: '', running: false, links: {}, statuses: {} };
  let longCache = null; // { at, videos, hasType }

  function close() {
    back.classList.remove('open');
    back.replaceChildren();
  }

  async function loadLongVideos() {
    if (longCache && Date.now() - longCache.at < 5 * 60 * 1000) return longCache;
    const r = await YSP.call('listAllWithType', {}, 120000);
    const videos = r.videos
      .filter((v) => (r.hasType ? v.contentType !== 'CREATOR_CONTENT_TYPE_SHORTS' : Number(v.lengthSeconds || 0) > 180))
      .map(YSP.normVideo)
      .filter((v) => v.id);
    longCache = { at: Date.now(), videos, hasType: r.hasType };
    return longCache;
  }

  function openDialog() {
    const shorts = selectedShorts();
    if (!shorts.length) { YSP.toast('Select at least one Short first.', 'warn'); return; }
    Object.assign(state, { shorts, target: null, query: '', running: false, links: {}, statuses: {} });
    ui.host.classList.toggle('dark', YSP.isDark());
    back.classList.add('open');
    render();
    YSP.call('getShortLinks', { videoIds: shorts.map((s) => s.id) })
      .then((links) => { state.links = links; render(); })
      .catch(() => {});
    loadLongVideos().then(render, (e) => { state.loadError = e.message; render(); });
  }

  function titleOf(id) {
    const v = (longCache && longCache.videos.find((x) => x.id === id)) || YSP.videos.get(id);
    return v ? v.title : id;
  }

  let listScroll = 0;
  function render() {
    if (!back.classList.contains('open')) return;
    const prevList = back.querySelector('.list');
    if (prevList) listScroll = prevList.scrollTop;
    const n = state.shorts.length;
    const plural = n === 1 ? 'Short' : 'Shorts';

    const shortRows = state.shorts.map((s) => {
      const cur = state.links[s.id];
      const st = state.statuses[s.id];
      return h('div', { class: 'short' },
        h('span', { class: 'st ' + (st ? st.kind : ''), text: st ? (st.kind === 'ok' ? '✓' : st.kind === 'err' ? '✕' : '…') : '' , title: st && st.msg }),
        s.thumb ? h('img', { src: s.thumb, alt: '' }) : h('img', { alt: '' }),
        h('span', { class: 't', text: s.title, title: s.title }),
        h('span', { class: 'cur', text: s.id in state.links ? (cur ? '→ ' + titleOf(cur) : 'no related video') : '', title: cur ? titleOf(cur) : '' }));
    });

    const search = h('input', {
      class: 'input', placeholder: 'Search your videos…', value: state.query,
      oninput: (e) => { state.query = e.target.value; renderList(); },
    });
    const list = h('div', { class: 'list' });
    const msg = h('div', { class: 'msg' });
    const go = h('button', {
      class: 'btn primary', text: state.target ? `Redirect ${n} ${plural}` : 'Pick a video',
      disabled: !state.target || state.running, onclick: () => run(state.target),
    });
    const clear = h('button', {
      class: 'link', text: 'Remove related video instead', disabled: state.running,
      title: `Clear the related video on the ${n} selected ${plural}`, onclick: () => run(null),
    });
    const cancel = h('button', { class: 'btn', text: state.done ? 'Close' : 'Cancel', disabled: state.running, onclick: close });

    function renderList() {
      list.replaceChildren();
      if (state.loadError) { list.append(h('div', { class: 'error', text: state.loadError })); return; }
      if (!longCache) { list.append(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading your videos…')); return; }
      const q = state.query.trim().toLowerCase();
      const items = longCache.videos.filter((v) => !q || v.title.toLowerCase().includes(q) || v.id === state.query.trim());
      if (!items.length) { list.append(h('div', { class: 'empty', text: q ? 'No videos match.' : 'No long-form videos found.' })); return; }
      for (const v of items) {
        const row = h('div', {
          class: 'vid' + (state.target === v.id ? ' sel' : ''),
          onclick: () => { if (state.running) return; state.target = v.id; state.done = false; render(); },
        },
          h('span', { class: 'radio' }),
          h('img', { src: v.thumb, alt: '', loading: 'lazy' }),
          h('div', { class: 'meta' },
            h('div', { class: 'tt', text: v.title, title: v.title }),
            h('div', { class: 'info' },
              h('span', { class: 'pill ' + v.privacy, text: v.privacy }),
              h('span', { text: YSP.fmtDur(v.length) }),
              h('span', { text: YSP.fmtDate(v.ts) }))));
        list.append(row);
      }
    }
    renderList();

    if (state.summary) { msg.className = 'msg ' + state.summary.kind; msg.textContent = state.summary.text; }

    back.replaceChildren(h('div', { class: 'card', role: 'dialog', 'aria-label': 'Redirect Shorts' },
      h('div', { class: 'hd' },
        h('h2', { text: `Redirect ${n} ${plural} to…` }),
        h('span', { class: 'brand', text: 'Studio Plus' }),
        h('button', { class: 'x', text: '✕', title: 'Close', disabled: state.running, onclick: close })),
      h('div', { class: 'sub', text: `Pick the video these ${plural} should link to. Viewers will see it as the related video on each Short.` }),
      h('div', { class: 'sec', text: `Selected ${plural}` }),
      h('div', { class: 'shorts' }, shortRows),
      h('div', { class: 'sec', text: 'Point them at' }),
      h('div', { class: 'search' }, search),
      list,
      msg,
      h('div', { class: 'ft' }, clear, h('span', { class: 'spacer' }), cancel, go)));
    list.scrollTop = listScroll;
  }

  async function run(targetId) {
    if (state.running) return;
    const n = state.shorts.length;
    if (targetId === null && !confirmClear(n)) return;
    state.running = true; state.summary = null; state.statuses = {};
    for (const s of state.shorts) state.statuses[s.id] = { kind: 'busy' };
    render();
    let ok = 0, fail = 0;
    for (const s of state.shorts) {
      try {
        await YSP.call('setShortLink', { videoId: s.id, targetId }, 30000);
        state.statuses[s.id] = { kind: 'ok' };
        state.links[s.id] = targetId;
        ok++;
      } catch (e) {
        state.statuses[s.id] = { kind: 'err', msg: e.message };
        fail++;
      }
      render();
      await YSP.sleep(250); // be gentle with Studio's API
    }
    state.running = false; state.done = true;
    const what = targetId ? `now point to “${titleOf(targetId)}”` : 'no longer have a related video';
    state.summary = fail
      ? { kind: 'err', text: `${ok} of ${n} updated, ${fail} failed (hover ✕ for the reason).` }
      : { kind: 'ok', text: `Done: ${ok === 1 ? '1 Short' : ok + ' Shorts'} ${ok === 1 ? what.replace(/^now point /, 'now points ').replace(/^no longer have/, 'no longer has') : what}.` };
    render();
    YSP.toast(state.summary.text, fail ? 'error' : 'ok');
  }

  let clearArmed = 0;
  function confirmClear(n) {
    // Two clicks within 4s instead of a blocking confirm() dialog.
    if (Date.now() - clearArmed < 4000) { clearArmed = 0; return true; }
    clearArmed = Date.now();
    state.summary = { kind: 'err', text: `Click “Remove related video instead” again to clear it on ${n} ${n === 1 ? 'Short' : 'Shorts'}.` };
    render();
    return false;
  }

  YSP.shortsRedirect = { open: openDialog };
  YSP.onTick.add(() => { if (onShortsList()) injectButton(); });
})();
