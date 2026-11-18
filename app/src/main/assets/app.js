(() => {
const api = window.launcher, $ = s => document.querySelector(s);
const WALLS = [['senja', 'Senja'], ['laut', 'Laut'], ['malam', 'Malam'], ['hutan', 'Hutan']];
let data = { items: [], settings: {} };
const ui = { tab: 'Semua', query: '' };

const save = () => api.saveData(data);
const commit = () => { save(); render(); };
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); }
function el(tag, p = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k === 'checked') e.checked = !!v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => e.append(c)); return e;
}
const iconEl = i => i.icon ? el('img', { src: i.icon, alt: '', draggable: 'false' }) : el('div', { class: 'ph', text: (i.name[0] || '?').toUpperCase() });
const cats = () => [...new Set(data.items.map(i => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
const mkItem = a => ({ id: a.path, name: a.name, path: a.path, icon: a.icon || '', category: '', favorite: false });

function visible() {
  const q = ui.query.trim().toLowerCase();
  return data.items.filter(i => q ? i.name.toLowerCase().includes(q) : ui.tab === 'Favorit' ? i.favorite : ui.tab === 'Semua' || i.category === ui.tab)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

function render() {
  const c = cats();
  if (!['Semua', 'Favorit', ...c].includes(ui.tab)) ui.tab = 'Semua';
  $('#tabs').replaceChildren(...['Semua', 'Favorit', ...c].map(t =>
    el('button', { class: 'tab', role: 'tab', 'aria-selected': String(t === ui.tab), text: t, onclick: () => { ui.tab = t; render(); } })));
  const list = visible();
  $('#grid').replaceChildren(...list.map(tile));
  $('#grid').hidden = !list.length; $('#empty').hidden = !!list.length;
  const none = !data.items.length;
  $('#eTitle').textContent = none ? 'Belum ada aplikasi' : 'Tidak ada yang cocok';
  $('#eText').textContent = none ? 'Ketuk “Tambah aplikasi” atau “Impor semua”.' : 'Coba kata kunci atau kategori lain.';
  const favs = data.items.filter(i => i.favorite);
  $('#dock').replaceChildren(...(favs.length ? favs.map(dockBtn) : [el('span', { class: 'hint', text: 'Tahan lama sebuah aplikasi, lalu pilih “Tambah ke dock”.' })]));
}

// Ketuk = buka, tahan lama = menu
function press(b, i) {
  let timer, sx = 0, sy = 0, fired = false;
  const cancel = () => clearTimeout(timer);
  b.addEventListener('pointerdown', e => {
    fired = false; sx = e.clientX; sy = e.clientY; cancel();
    timer = setTimeout(() => { fired = true; showMenu(sx, sy, i); }, 480);
  });
  b.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, cancel));
  b.addEventListener('click', e => {
    if (fired) { fired = false; e.preventDefault(); e.stopPropagation(); return; }
    launch(i);
  });
  b.addEventListener('contextmenu', e => e.preventDefault());
}

function tile(i) {
  const b = el('button', { class: 'tile', 'data-id': i.id }, iconEl(i), el('span', { text: i.name }));
  press(b, i); return b;
}
function dockBtn(i) {
  const b = el('button', { title: i.name }, iconEl(i));
  press(b, i); return b;
}

async function launch(i) {
  const err = await api.launch(i.path);
  if (err) toast('Tidak bisa membuka “' + i.name + '”. Mungkin aplikasinya sudah dihapus.');
}

function showMenu(x, y, i) {
  const m = $('#menu');
  const acts = [['Buka', () => launch(i)], ['Info aplikasi', () => api.info(i.path)], 0,
    [i.favorite ? 'Hapus dari dock' : 'Tambah ke dock', () => { i.favorite = !i.favorite; commit(); }],
    ['Ubah nama atau kategori…', () => edit(i)], 0,
    ['Copot pemasangan…', () => api.uninstall(i.path), 'danger'],
    ['Sembunyikan dari launcher', () => { data.items = data.items.filter(t => t !== i); commit(); toast('“' + i.name + '” disembunyikan. Tambahkan lagi lewat “Tambah aplikasi”.'); }, 'danger']];
  m.replaceChildren(...acts.map(a => a ? el('button', { class: a[2] || '', text: a[0], onclick: () => { hideMenu(); a[1](); } }) : el('hr')));
  m.hidden = false; const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
}
const hideMenu = () => { $('#menu').hidden = true; };

function modal(title, nodes, actions) {
  const box = el('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' }, el('h2', { text: title }), el('div', { class: 'body' }, nodes),
    el('div', { class: 'actions' }, actions.map(a => el('button', { class: 'btn' + (a.primary ? ' primary' : ''), text: a.label, onclick: () => { if (a.run && a.run() === false) return; closeModal(); } }))));
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.type === 'text') box.querySelector('.primary').click(); };
  $('#modal').replaceChildren(box); $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').replaceChildren(); };

function edit(i) {
  const n = el('input', { type: 'text', maxlength: '60' }), c = el('input', { type: 'text', placeholder: 'Contoh: Game, Kerja, Utilitas' });
  n.value = i.name; c.value = i.category || '';
  modal('Ubah aplikasi', [el('label', { class: 'f', text: 'Nama' }), n, el('label', { class: 'f', text: 'Kategori' }), c],
    [{ label: 'Batal' }, { label: 'Simpan', primary: true, run: () => { i.name = n.value.trim() || i.name; i.category = c.value.trim(); commit(); } }]);
}

async function freshApps() {
  const known = new Set(data.items.map(i => i.path));
  return (await api.scanApps()).filter(a => !known.has(a.path));
}

function addApps(list) {
  list.forEach(a => { if (!data.items.some(i => i.path === a.path)) data.items.push(mkItem(a)); });
  if (list.length) commit();
}

async function chooseApps() {
  toast('Memuat daftar aplikasi…');
  const fresh = await freshApps();
  if (!fresh.length) return toast('Semua aplikasi sudah ada di launcher.');
  const f = el('input', { type: 'search', placeholder: 'Filter daftar' }), list = el('div', { class: 'scan-list' });
  fresh.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const rows = fresh.map(p => { const cb = el('input', { type: 'checkbox' }), row = el('label', { class: 'row' }, cb, el('span', { text: p.name })); list.append(row); return { p, cb, row }; });
  f.oninput = () => rows.forEach(r => r.row.hidden = !r.p.name.toLowerCase().includes(f.value.toLowerCase()));
  modal('Pilih aplikasi', [f, list], [
    { label: 'Batal' },
    { label: 'Pilih semua', run: () => { rows.filter(r => !r.row.hidden).forEach(r => r.cb.checked = true); return false; } },
    { label: 'Tambahkan', primary: true, run: () => { const ch = rows.filter(r => r.cb.checked).map(r => r.p); if (ch.length) { addApps(ch); toast(ch.length + ' aplikasi ditambahkan.'); } } }]);
}

async function importAll(silent) {
  const fresh = await freshApps();
  if (!fresh.length) { if (!silent) toast('Tidak ada aplikasi baru.'); return; }
  addApps(fresh);
  if (!silent) toast(fresh.length + ' aplikasi diimpor.');
}

function applySettings() {
  const s = data.settings, w = $('#wall');
  document.body.dataset.size = s.iconSize; w.dataset.wall = s.wallpaper;
  w.style.backgroundImage = s.wallpaper === 'custom' && s.customWallpaper ? 'url("' + s.customWallpaper + '")' : '';
}
function settings() {
  const s = data.settings, p = $('#settings'), set = (k, v) => { s[k] = v; applySettings(); save(); settings(); };
  p.replaceChildren(
    el('div', { class: 'sh' }, el('h2', { text: 'Pengaturan' }), el('button', { class: 'btn', text: 'Tutup', onclick: () => p.hidden = true })),
    el('h3', { text: 'Wallpaper' }),
    el('div', { class: 'swatches' }, WALLS.map(([id, n]) => el('button', { class: 'sw', 'data-wall': id, title: n, 'aria-pressed': String(s.wallpaper === id), 'aria-label': n, onclick: () => set('wallpaper', id) }))),
    el('button', { class: 'btn', text: 'Pilih gambar sendiri…', onclick: async () => { const u = await api.pickWallpaper(); if (u) { s.customWallpaper = u; set('wallpaper', 'custom'); } } }),
    el('h3', { text: 'Ukuran ikon' }),
    el('div', { class: 'seg' }, [['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']].map(([k, n]) => el('button', { class: 'btn', text: n, 'aria-pressed': String(s.iconSize === k), onclick: () => set('iconSize', k) }))),
    el('h3', { text: 'Layar utama' }),
    el('button', { class: 'btn primary', text: 'Jadikan launcher utama', onclick: () => api.openHomeSettings() }),
    el('p', { class: 'note', text: 'Ketuk aplikasi untuk membuka, tahan lama untuk menu (dock, ubah nama, kategori, info, copot). Aplikasi yang baru dipasang ditambahkan lewat “Tambah aplikasi” atau “Impor semua”.' }));
  p.hidden = false;
}

$('#search').oninput = e => { ui.query = e.target.value; render(); };
$('#search').onkeydown = e => {
  if (e.key === 'Enter') { const f = visible()[0]; if (f) { e.target.blur(); launch(f); } }
};
$('#btnAdd').onclick = chooseApps;
$('#btnScan').onclick = () => importAll(false);
$('#btnSet').onclick = settings;
addEventListener('click', e => { if (!e.target.closest('#menu')) hideMenu(); });
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

// Dipanggil dari Android: tombol Kembali menutup panel yang terbuka
window.__back = () => {
  if (!$('#modal').hidden) closeModal();
  else if (!$('#menu').hidden) hideMenu();
  else if (!$('#settings').hidden) $('#settings').hidden = true;
  else if (ui.query) { $('#search').value = ''; ui.query = ''; render(); }
};
// Dipanggil dari Android: tombol Home ditekan saat launcher sudah terbuka
window.__home = () => {
  closeModal(); hideMenu(); $('#settings').hidden = true;
  $('#search').value = ''; $('#search').blur(); ui.query = ''; ui.tab = 'Semua'; render();
  $('#grid').scrollTop = 0;
};

function tick() {
  const d = new Date();
  $('#time').textContent = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
  $('#date').textContent = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
(async () => {
  data = await api.getData(); applySettings();
  if (!data.items.length && !data.settings.imported) {   // pertama kali dibuka: impor semua aplikasi
    await importAll(true);
    data.settings.imported = true; save();
  }
  render(); tick(); setInterval(tick, 1000);
})();
})();
