// Studio Plus – Saved replies (canned responses) for YouTube Studio comments.
// Adds a "Saved replies" button under every reply box. Picking one fills the
// box; you still click Reply yourself. Placeholders: {name} {handle} {video}.
(() => {
  'use strict';
  const YSP = window.YSP;
  if (!YSP || YSP.replies) return;
  const { h } = YSP;
  const KEY = 'ysp_replies';
  const DEFAULTS = [
    'Thanks for watching, {name}! 🙌',
    'Glad you enjoyed it, {name}! More coming soon.',
    'Thanks {name}! Subscribe so you don\'t miss the next one.',
  ];

  const R = { list: null };
  YSP.replies = R;
  async function loadList() {
    if (R.list) return R.list;
    const saved = await YSP.store.get(KEY);
    R.list = Array.isArray(saved) ? saved : DEFAULTS.map((text) => ({ id: uid(), text }));
    return R.list;
  }
  const save = () => YSP.store.set(KEY, R.list);
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ------------------------------------------------------------ comment context
  function contextFor(box) {
    const comment = box.closest('ytcp-comment');
    const nameEl = comment && comment.querySelector('a#name, .author-text');
    const handle = ((nameEl && nameEl.textContent) || '').trim();
    const thread = box.closest('ytcp-comment-thread');
    const vt = thread && thread.querySelector('ytcp-comment-video-thumbnail');
    const video = ((vt && (vt.getAttribute('title') || vt.innerText)) || '').trim().split('\n')[0];
    return { handle: handle.startsWith('@') ? handle : (handle ? '@' + handle : ''), name: handle.replace(/^@/, ''), video };
  }
  function fill(text, ctx) {
    return text
      .replace(/\{name\}/g, ctx.name || '')
      .replace(/\{handle\}/g, ctx.handle || '')
      .replace(/\{video\}/g, ctx.video || '')
      .replace(/ {2,}/g, ' ').replace(/ ([!?.,])/g, '$1').trim();
  }
  function textareaOf(box) { return box.querySelector('textarea'); }
  function insert(box, text) {
    const ta = textareaOf(box);
    if (!ta) return false;
    ta.focus();
    const before = ta.value;
    // Replace what's there (an empty box, or a previous canned reply) so picking twice doesn't stack.
    ta.select();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (_) {}
    if (!ok || ta.value === before) {
      ta.value = text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
    ta.setSelectionRange(ta.value.length, ta.value.length);
    return true;
  }

  // ------------------------------------------------------------ button in footer
  const ICON = 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z';
  function injectButtons() {
    for (const box of document.querySelectorAll('ytcp-commentbox')) {
      const footer = box.querySelector('#footer');
      if (!footer || footer.querySelector('.ysp-replies-btn')) continue;
      const btn = h('button', {
        class: 'ysp-replies-btn', type: 'button', title: 'Studio Plus: insert a saved reply',
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); toggle(box, btn); },
      }, YSP.icon(ICON, 16), h('span', { text: 'Saved replies' }));
      footer.prepend(btn);
    }
  }

  // ------------------------------------------------------------ popover
  const ui = YSP.makeHost('ysp-replies-host', `
.pop { position: fixed; z-index: 2147483000; width: 360px; max-height: 420px; display: none; flex-direction: column; background: var(--bg2); color: var(--fg);
  border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.45); overflow: hidden; }
.pop.open { display: flex; }
.hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; }
.hd b { flex: 1; font-size: 14px; }
.list { overflow: auto; padding: 0 6px 6px; flex: 1; }
.item { display: flex; align-items: flex-start; gap: 6px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.item:hover { background: var(--hover); }
.item .txt { flex: 1; white-space: pre-wrap; word-break: break-word; }
.item .acts { display: none; gap: 2px; }
.item:hover .acts { display: flex; }
.ic { background: none; border: 0; color: var(--muted); cursor: pointer; width: 24px; height: 24px; border-radius: 6px; }
.ic:hover { background: var(--bg3); color: var(--fg); }
.edit { padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--line); }
.edit textarea { min-height: 70px; }
.row { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
.row .hint { flex: 1; }
.ft { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--line); }
.empty { padding: 16px; text-align: center; color: var(--muted); }
`);
  const pop = h('div', { class: 'pop' });
  ui.shadow.append(pop);
  const P = { box: null, btn: null, editing: null };

  function close() { pop.classList.remove('open'); P.box = null; P.editing = null; }
  document.addEventListener('mousedown', (e) => {
    if (!pop.classList.contains('open')) return;
    const path = e.composedPath();
    if (path.includes(ui.host) || path.includes(P.btn)) return;
    close();
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop.classList.contains('open')) { e.stopPropagation(); close(); } }, true);
  window.addEventListener('scroll', () => { if (pop.classList.contains('open')) position(); }, true);

  function position() {
    if (!P.btn || !P.btn.isConnected) { close(); return; }
    const r = P.btn.getBoundingClientRect();
    const W = 360, H = Math.min(420, pop.offsetHeight || 300);
    let left = Math.min(Math.max(8, r.left), innerWidth - W - 8);
    let top = r.bottom + 6;
    if (top + H > innerHeight - 8) top = Math.max(8, r.top - H - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  async function toggle(box, btn) {
    if (pop.classList.contains('open') && P.box === box) { close(); return; }
    await loadList();
    Object.assign(P, { box, btn, editing: null });
    ui.host.classList.toggle('dark', YSP.isDark());
    pop.classList.add('open');
    render();
  }

  function render() {
    const ctx = contextFor(P.box);
    const list = h('div', { class: 'list' });
    if (!R.list.length) list.append(h('div', { class: 'empty', text: 'No saved replies yet. Type a reply in the box and click "Save box text", or add one below.' }));
    for (const item of R.list) {
      list.append(h('div', {
        class: 'item', title: 'Insert into the reply box',
        onclick: () => { insert(P.box, fill(item.text, ctx)); close(); },
      },
        h('span', { class: 'txt', text: item.text }),
        h('span', { class: 'acts' },
          h('button', { class: 'ic', title: 'Edit', text: '✎', onclick: (e) => { e.stopPropagation(); P.editing = item.id; render(); } }),
          h('button', { class: 'ic', title: 'Delete', text: '✕', onclick: (e) => { e.stopPropagation(); R.list = R.list.filter((x) => x !== item); save(); render(); } }))));
    }

    let editor = null;
    if (P.editing) {
      const item = R.list.find((x) => x.id === P.editing);
      const ta = h('textarea', { class: 'input', value: item ? item.text : '', placeholder: 'e.g. Thanks for watching, {name}!' });
      editor = h('div', { class: 'edit' },
        ta,
        h('div', { class: 'row' },
          h('span', { class: 'hint muted small', text: '{name} {handle} {video}' }),
          h('button', { class: 'btn', text: 'Cancel', onclick: () => { P.editing = null; render(); } }),
          h('button', {
            class: 'btn primary', text: 'Save', onclick: () => {
              const text = ta.value.trim();
              if (!text) return;
              if (item) item.text = text; else R.list.push({ id: P.editing, text });
              save(); P.editing = null; render();
            },
          })));
      setTimeout(() => ta.focus(), 0);
    }

    const ft = h('div', { class: 'ft' },
      h('button', { class: 'btn', text: '+ New reply', onclick: () => { P.editing = uid(); render(); } }),
      h('button', {
        class: 'btn', text: 'Save box text', title: 'Save what is typed in this reply box as a saved reply',
        onclick: () => {
          const ta = textareaOf(P.box);
          const text = ta && ta.value.trim();
          if (!text) { YSP.toast('Type a reply in the box first.', 'warn'); return; }
          R.list.push({ id: uid(), text }); save(); render();
          YSP.toast('Saved reply added.');
        },
      }));

    pop.replaceChildren(...[
      h('div', { class: 'hd' }, h('b', { text: 'Saved replies' }), h('span', { class: 'brand', text: 'Studio Plus' })),
      list, editor || ft,
    ]);
    position();
  }

  YSP.onTick.add(() => {
    if (!/\/comments|\/video\/[\w-]{11}\/comments/.test(location.pathname) && !document.querySelector('ytcp-commentbox')) return;
    injectButtons();
  });
})();
