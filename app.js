'use strict';

/* ============================================================
   UTIL
   ============================================================ */
function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function formatRupiah(n) {
  n = Math.round(Number(n) || 0);
  return 'Rp' + n.toLocaleString('id-ID');
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtTanggal(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

function generateNomor(prefix) {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return prefix + '-' + ymd + '-' + rnd;
}

/* ============================================================
   MODAL KONFIRMASI KUSTOM (Pengganti Confirm Bawaan)
   ============================================================ */
function tampilkanKonfirmasi({ icon = '⚠️', title = 'Konfirmasi', text = 'Apakah Anda yakin?', textBtnYa = 'Ya, Lanjutkan', isDanger = true, onYes }) {
  const modal = document.getElementById('modalKonfirmasi');
  if (!modal) {
    if (confirm(text)) onYes();
    return;
  }
  document.getElementById('konfirmasiIcon').textContent = icon;
  document.getElementById('modalKonfirmasiTitle').textContent = title;
  document.getElementById('modalKonfirmasiText').textContent = text;
  
  const btnYa = document.getElementById('btnKonfirmasiYa');
  btnYa.textContent = textBtnYa;
  btnYa.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  btnYa.style.flex = '1';
  btnYa.style.justifyContent = 'center';

  const newBtnYa = btnYa.cloneNode(true);
  btnYa.parentNode.replaceChild(newBtnYa, btnYa);

  const btnBatal = document.getElementById('btnKonfirmasiBatal');
  const newBtnBatal = btnBatal.cloneNode(true);
  btnBatal.parentNode.replaceChild(newBtnBatal, btnBatal);

  newBtnYa.addEventListener('click', () => {
    modal.classList.remove('show');
    if (onYes) onYes();
  });

  newBtnBatal.addEventListener('click', () => {
    modal.classList.remove('show');
  });

  modal.classList.add('show');
}

/* ============================================================
   LAPISAN DATABASE (IndexedDB)
   ============================================================ */
const DB_NAME = 'IPOSKasirDB';
const DB_VERSION = 1;
let _dbPromise = null;

function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('users')) {
        const s = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        s.createIndex('username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('products')) {
        const s = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        s.createIndex('kode', 'kode', { unique: true });
        s.createIndex('nama', 'nama', { unique: false });
      }
      if (!db.objectStoreNames.contains('sales')) {
        const s = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tanggal', 'tanggal', { unique: false });
        s.createIndex('nomor', 'nomor', { unique: true });
      }
      if (!db.objectStoreNames.contains('purchases')) {
        const s = db.createObjectStore('purchases', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tanggal', 'tanggal', { unique: false });
        s.createIndex('nomor', 'nomor', { unique: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

async function tx(storeName, mode) {
  const db = await getDB();
  return db.transaction(storeName, mode || 'readonly').objectStore(storeName);
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbAdd(store, obj) { const s = await tx(store, 'readwrite'); return wrap(s.add(obj)); }
async function dbPut(store, obj) { const s = await tx(store, 'readwrite'); return wrap(s.put(obj)); }
async function dbGet(store, id) { const s = await tx(store); return wrap(s.get(id)); }
async function dbDelete(store, id) { const s = await tx(store, 'readwrite'); return wrap(s.delete(id)); }
async function dbGetAll(store) { const s = await tx(store); return wrap(s.getAll()); }
async function dbGetByIndex(store, idx, val) { const s = await tx(store); return wrap(s.index(idx).get(val)); }

/* ============================================================
   SEED DATA & LOGIN (Versi Anti-Gagal / Tanpa Enkripsi)
   ============================================================ */
async function seedIfEmpty() {
  try {
    const users = await dbGetAll('users');
    if (!users || users.length === 0) {
      await dbAdd('users', { username: 'admin', password: 'admin123', nama: 'Administrator', role: 'admin' });
    }
    const settings = await dbGet('settings', 1);
    if (!settings) {
      await dbPut('settings', { id: 1, namaToko: 'Toko Saya', alamat: 'Jl. Contoh No. 1', telepon: '08123456789', footer: 'Terima kasih telah berbelanja di toko kami' });
    }
    const products = await dbGetAll('products');
    if (!products || products.length === 0) {
      const sample = [
        { kode: 'BRG100001', barcode: '8991002135376', nama: 'Beras 5kg', expire: '', kategori: 'Sembako', satuan: 'Karung', hargaBeli: 60000, hargaJual: 68000, stok: 20, stokMin: 5 },
        { kode: 'BRG100002', barcode: '', nama: 'Minyak Goreng 1L', expire: '', kategori: 'Sembako', satuan: 'Botol', hargaBeli: 15000, hargaJual: 18000, stok: 30, stokMin: 10 },
        { kode: 'BRG100003', barcode: '', nama: 'Gula Pasir 1kg', expire: '', kategori: 'Sembako', satuan: 'Kg', hargaBeli: 12000, hargaJual: 14500, stok: 25, stokMin: 8 },
        { kode: 'BRG100004', barcode: '', nama: 'Indomie Goreng', expire: '', kategori: 'Mie Instan', satuan: 'Pcs', hargaBeli: 2800, hargaJual: 3500, stok: 100, stokMin: 20 },
        { kode: 'BRG100005', barcode: '', nama: 'Air Mineral 600ml', expire: '', kategori: 'Minuman', satuan: 'Botol', hargaBeli: 2500, hargaJual: 4000, stok: 50, stokMin: 15 },
      ];
      for (const p of sample) await dbAdd('products', p);
    }
  } catch (err) {
    console.error("Gagal melakukan seed data:", err);
  }
}

let currentUser = null;

async function doLogin(username, password) {
  try {
    const user = await dbGetByIndex('users', 'username', username.trim());
    if (!user) return { ok: false, msg: 'Username tidak ditemukan' };
    if (password !== user.password) return { ok: false, msg: 'Password salah' };
    currentUser = user;
    sessionStorage.setItem('ipos_uid', String(user.id));
    return { ok: true };
  } catch (err) {
    console.error("Error saat login:", err);
    return { ok: false, msg: 'Terjadi kesalahan sistem' };
  }
}

function doLogout() {
  tampilkanKonfirmasi({
    icon: '⁉️',
    title: 'Keluar Aplikasi',
    text: 'Apakah Anda yakin ingin keluar dari sesi kasir ini?',
    textBtnYa: 'Ya, Keluar',
    isDanger: true,
    onYes: () => {
      sessionStorage.removeItem('ipos_uid');
      location.reload();
    }
  });
}

async function tryRestoreSession() {
  const uid = sessionStorage.getItem('ipos_uid');
  if (!uid) return false;
  const user = await dbGet('users', Number(uid));
  if (!user) return false;
  currentUser = user;
  return true;
}

/* ============================================================
   NAVIGASI
   ============================================================ */
const renderers = {};

function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  if (renderers[name]) renderers[name]();
}

function initShellForUser() {
  if (!currentUser) return;
  document.body.classList.toggle('role-kasir', currentUser.role !== 'admin');
  document.getElementById('avatarInitial').textContent = (currentUser.nama || '?').charAt(0).toUpperCase();
  document.getElementById('chipNama').textContent = currentUser.nama;
  document.getElementById('chipRole').textContent = currentUser.role;
}

async function refreshTopbarStore() {
  const s = await dbGet('settings', 1);
  if (s) {
    document.getElementById('topbarStoreName').textContent = s.namaToko;
    document.getElementById('topbarStoreAddr').textContent = s.alamat;
  }
}

function tickClock() {
  const el = document.getElementById('clockBox');
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }) + '  ' + d.toLocaleTimeString('id-ID');
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard() {
  const [sales, products] = await Promise.all([dbGetAll('sales'), dbGetAll('products')]);
  const today = todayStr();
  const salesToday = sales.filter(s => s.tanggal.slice(0, 10) === today);
  const totalToday = salesToday.reduce((a, s) => a + s.total, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const salesMonth = sales.filter(s => s.tanggal.slice(0, 7) === thisMonth);
  const totalMonth = salesMonth.reduce((a, s) => a + s.total, 0);
  const lowStock = products.filter(p => p.stok <= p.stokMin);

  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card"><div class="icon-badge ib-teal"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="label">Penjualan Hari Ini</div><div class="value">${formatRupiah(totalToday)}</div><div class="sub">${salesToday.length} transaksi</div></div>
    <div class="stat-card"><div class="icon-badge ib-gold"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M11 20V4M18 20v-7"/></svg></div>
      <div class="label">Penjualan Bulan Ini</div><div class="value">${formatRupiah(totalMonth)}</div><div class="sub">${salesMonth.length} transaksi</div></div>
    <div class="stat-card"><div class="icon-badge ib-ink"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 8l-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/></svg></div>
      <div class="label">Total Produk</div><div class="value">${products.length}</div><div class="sub">item terdaftar</div></div>
    <div class="stat-card"><div class="icon-badge ib-danger"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></div>
      <div class="label">Stok Menipis</div><div class="value">${lowStock.length}</div><div class="sub">perlu restock</div></div>
  `;

  const body = document.getElementById('dashLowStock');
  if (lowStock.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Semua stok barang aman 👍</td></tr>';
  } else {
    body.innerHTML = lowStock.map(p => `
      <tr><td>${esc(p.kode)}</td><td>${esc(p.nama)}</td><td>${p.stok} ${esc(p.satuan)}</td><td>${p.stokMin}</td>
      <td><span class="badge badge-danger">Stok Menipis</span></td></tr>
    `).join('');
  }
}
renderers.dashboard = renderDashboard;

/* ============================================================
   MASTER BARANG
   ============================================================ */
async function renderBarang() {
  const products = await dbGetAll('products');
  const searchEl = document.getElementById('barangSearch');
  const q = searchEl ? (searchEl.value || '').toLowerCase() : '';
  const filtered = products.filter(p => p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)));
  const body = document.getElementById('barangTableBody');
  if (!body) return;
  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="11">Belum ada barang. Klik "+ Tambah Barang" untuk mulai.</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(p => {
    const low = p.stok <= p.stokMin;
    return `<tr>
      <td style="font-family:var(--font-mono);">${esc(p.kode)}</td>
      <td style="font-family:var(--font-mono); color:#555; display:none;">${esc(p.barcode || '-')}</td>
      <td>${esc(p.nama)}</td>
      <td>${esc(p.expire || '-')}</td>
      <td>${esc(p.kategori || '-')}</td>
      <td>${esc(p.satuan || '-')}</td>
      <td>${formatRupiah(p.hargaBeli)}</td>
      <td style="font-weight:700;">${formatRupiah(p.hargaJual)}</td>
      <td>${p.stok}</td>
      <td>${low ? '<span class="badge badge-danger">Menipis</span>' : '<span class="badge badge-ok">Aman</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-outline btn-sm" onclick="editBarang(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="hapusBarang(${p.id})">Hapus</button>
      </td>
    </tr>`;
  }).join('');
}
renderers.barang = renderBarang;

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

async function generateKodeBarangOtomatis() {
  try {
    const products = await dbGetAll('products');
    let maxNum = 100000;
    for (const p of products) {
      const m = /^BRG(\d+)$/.exec(p.kode || '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    let kodeBarangBaru = "BRG" + (maxNum + 1);
    const existingKode = new Set(products.map(p => p.kode));
    while (existingKode.has(kodeBarangBaru)) {
      maxNum++;
      kodeBarangBaru = "BRG" + (maxNum + 1);
    }
    const inputKode = document.getElementById('brgKode') || document.getElementById('kodeBarang');
    if (inputKode) {
      inputKode.value = kodeBarangBaru;
    }
  } catch (err) {
    console.error("Gagal generate kode otomatis: ", err);
  }
}

function resetBarangForm() {
  document.getElementById('brgId').value = '';
  document.getElementById('brgKode').value = '';
  const inputBarcode = document.getElementById('brgBarcode');
  if (inputBarcode) inputBarcode.value = '';
  const inputExpire = document.getElementById('brgExpire');
  if (inputExpire) inputExpire.value = '';
  document.getElementById('brgKategori').value = '';
  document.getElementById('brgNama').value = '';
  document.getElementById('brgSatuan').value = '';
  document.getElementById('brgStok').value = '0';
  document.getElementById('brgHargaBeli').value = '0';
  document.getElementById('brgHargaJual').value = '0';
  const inputMargin = document.getElementById('brgMargin');
  if (inputMargin) inputMargin.value = '';
  document.getElementById('brgStokMin').value = '5';
}

function hitungOtomatisHargaJual() {
  const inputHrgBeli = document.getElementById('brgHargaBeli');
  const inputMargin = document.getElementById('brgMargin');
  const inputHrgJual = document.getElementById('brgHargaJual');
  if (!inputHrgBeli || !inputHrgJual) return;
  const hrgBeli = parseFloat(inputHrgBeli.value) || 0;
  const margin = inputMargin ? (parseFloat(inputMargin.value) || 0) : 0;
  if (margin > 0) {
    let hargaJualHitung = hrgBeli + (hrgBeli * (margin / 100));
    inputHrgJual.value = Math.round(hargaJualHitung);
  }
}

const elHrgBeli = document.getElementById('brgHargaBeli');
const elMargin = document.getElementById('brgMargin');
if (elHrgBeli) elHrgBeli.addEventListener('input', hitungOtomatisHargaJual);
if (elMargin) elMargin.addEventListener('input', hitungOtomatisHargaJual);

const btnTambahBarangEl = document.getElementById('btnTambahBarang');
if (btnTambahBarangEl) {
  btnTambahBarangEl.addEventListener('click', async () => {
    resetBarangForm();
    await generateKodeBarangOtomatis(); 
    const inputKode = document.getElementById('brgKode');
    if (inputKode) { inputKode.readOnly = true; }
    document.getElementById('modalBarangTitle').textContent = 'Tambah Barang';
    openModal('modalBarang');
  });
}

async function editBarang(id) {
  const p = await dbGet('products', id);
  if (!p) return;
  document.getElementById('brgId').value = p.id;
  const inputKode = document.getElementById('brgKode');
  if (inputKode) {
    inputKode.value = p.kode;
    inputKode.readOnly = true;
  }
  const inputBarcode = document.getElementById('brgBarcode');
  if (inputBarcode) { inputBarcode.value = p.barcode || ''; }
  const inputExpire = document.getElementById('brgExpire');
  if (inputExpire) { inputExpire.value = p.expire || ''; }
  document.getElementById('brgKategori').value = p.kategori || '';
  document.getElementById('brgNama').value = p.nama;
  document.getElementById('brgSatuan').value = p.satuan || '';
  document.getElementById('brgStok').value = p.stok;
  document.getElementById('brgHargaBeli').value = p.hargaBeli;
  document.getElementById('brgHargaJual').value = p.hargaJual;
  
  const inputMargin = document.getElementById('brgMargin');
  if (inputMargin && p.hargaBeli > 0) {
    let estimatedMargin = ((p.hargaJual - p.hargaBeli) / p.hargaBeli) * 100;
    inputMargin.value = Math.round(estimatedMargin);
  } else if (inputMargin) {
    inputMargin.value = '';
  }
  document.getElementById('brgStokMin').value = p.stokMin;
  document.getElementById('modalBarangTitle').textContent = 'Edit Barang';
  openModal('modalBarang');
}

async function hapusBarang(id) {
  const p = await dbGet('products', id);
  const namaBarang = p ? p.nama : 'Barang ini';
  tampilkanKonfirmasi({
    icon: '🗑️',
    title: 'Hapus Barang',
    text: `Apakah Anda yakin ingin menghapus "${namaBarang}"? Tindakan ini tidak dapat dibatalkan.`,
    textBtnYa: 'Ya, Hapus',
    isDanger: true,
    onYes: async () => {
      await dbDelete('products', id);
      toast('Barang berhasil dihapus', 'success');
      renderBarang();
    }
  });
}

const btnSimpanBarangEl = document.getElementById('btnSimpanBarang');
if (btnSimpanBarangEl) {
  btnSimpanBarangEl.addEventListener('click', async () => {
    const id = document.getElementById('brgId').value;
    const kode = document.getElementById('brgKode').value.trim();
    const barcode = document.getElementById('brgBarcode') ? document.getElementById('brgBarcode').value.trim() : '';
    const expire = document.getElementById('brgExpire') ? document.getElementById('brgExpire').value.trim() : '';
    const nama = document.getElementById('brgNama').value.trim();
    const hargaBeli = Number(document.getElementById('brgHargaBeli').value) || 0;
    const hargaJual = Number(document.getElementById('brgHargaJual').value) || 0;

    if (!kode || !nama) { toast('Kode dan Nama wajib diisi', 'error'); return; }
    if (hargaJual < hargaBeli) {
      toast('Peringatan: Harga jual tidak boleh lebih kecil dari harga beli!', 'error');
      return;
    }

    const obj = {
      kode, barcode, expire, nama,
      kategori: document.getElementById('brgKategori').value.trim(),
      satuan: document.getElementById('brgSatuan').value.trim(),
      stok: Number(document.getElementById('brgStok').value) || 0,
      hargaBeli: hargaBeli,
      hargaJual: hargaJual,
      stokMin: Number(document.getElementById('brgStokMin').value) || 0,
    };

    try {
      if (id) {
        obj.id = Number(id);
        await dbPut('products', obj);
        toast('Barang diperbarui', 'success');
      } else {
        const dup = await dbGetByIndex('products', 'kode', kode);
        if (dup) { toast('Kode barang sudah dipakai', 'error'); return; }
        await dbAdd('products', obj);
        toast('Barang ditambahkan', 'success');
      }
      closeModal('modalBarang');
      renderBarang();
    } catch (err) { toast('Gagal menyimpan: ' + err.message, 'error'); }
  });
}

const searchBarangEl = document.getElementById('barangSearch');
if (searchBarangEl) searchBarangEl.addEventListener('input', renderBarang);

/* ============================================================
   POS / PENJUALAN
   ============================================================ */
let cart = [];
let allProductsCache = [];

async function renderPOS() {
  allProductsCache = await dbGetAll('products');
  renderProductGrid();
  renderCart();
  const searchInput = document.getElementById('posSearch');
  if (searchInput) searchInput.focus();
}
renderers.penjualan = renderPOS;

function renderProductGrid() {
  const searchEl = document.getElementById('posSearch');
  const q = searchEl ? (searchEl.value || '').toLowerCase() : '';
  const grid = document.getElementById('posProductGrid');
  if (!grid) return;
  
  const filtered = allProductsCache.filter(p => 
    p.nama.toLowerCase().includes(q) || 
    p.kode.toLowerCase().includes(q) ||
    (p.barcode && p.barcode.toLowerCase().includes(q))
  );

  if (filtered.length === 0) { 
    grid.innerHTML = '<p style="color:var(--ink-faint);padding:20px;">Barang tidak ditemukan.</p>'; 
    return; 
  }

  if (q.length >= 3 && searchEl) {
    const exactMatch = filtered.find(p => p.kode.toLowerCase() === q || (p.barcode && p.barcode.toLowerCase() === q));
    if (exactMatch && filtered.length === 1) {
      addToCart(exactMatch.id);
      searchEl.value = '';
      renderProductGrid();
      return;
    }
  }

  let tableHtml = `<div class="table-wrap" style="border:1px solid var(--border-soft); border-radius:var(--radius-sm);">
    <table style="width: 100%; margin: 0;">
      <thead style="position: sticky; top: 0; background: var(--surface-2); z-index: 1;">
        <tr>
          <th>Kode</th>
          <th>Nama Barang</th>
          <th>Harga</th>
          <th>Stok</th>
        </tr>
      </thead>
      <tbody>`;

  tableHtml += filtered.map(p => {
    const out = p.stok <= 0;
    const low = p.stok > 0 && p.stok <= p.stokMin;
    
    // Tambahkan class "pos-item-row" dan tabindex="0" (kecuali jika stok habis)
    return `<tr class="pos-item-row" ${out ? '' : 'tabindex="0"'} style="cursor: pointer; outline: none; ${out ? 'opacity: 0.5;' : ''}" ${out ? '' : `onclick="addToCart(${p.id})"`}>
      <td style="font-family:var(--font-mono); font-size:12px; color:var(--ink-soft);">${esc(p.kode)}</td>
      <td style="font-weight:600; font-size:13px;">${esc(p.nama)}</td>
      <td style="font-family:var(--font-mono); color:var(--primary-dark); font-weight:700;">${formatRupiah(p.hargaJual)}</td>
      <td style="${low ? 'color:var(--danger); font-weight:bold;' : 'color:var(--ink-faint);'}">${out ? 'Habis' : p.stok + ' ' + esc(p.satuan || '')}</td>
    </tr>`;
  }).join('');

  tableHtml += `</tbody></table></div>`;
  grid.innerHTML = tableHtml;
}

const posSearchEl = document.getElementById('posSearch');
if (posSearchEl) posSearchEl.addEventListener('input', renderProductGrid);

function addToCart(productId) {
  const p = allProductsCache.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    if (existing.qty + 1 > p.stok) { toast('Stok tidak mencukupi', 'error'); return; }
    existing.qty++;
  } else {
    if (p.stok < 1) { toast('Stok habis', 'error'); return; }
    cart.push({ productId: p.id, kode: p.kode, nama: p.nama, harga: p.hargaJual, qty: 1, stokMax: p.stok });
  }
  renderCart();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart = cart.filter(i => i.productId !== productId); }
  else if (newQty > item.stokMax) { toast('Stok tidak mencukupi', 'error'); return; }
  else { item.qty = newQty; }
  renderCart();
}

function removeFromCart(productId) { cart = cart.filter(i => i.productId !== productId); renderCart(); }

const btnClearCartEl = document.getElementById('btnClearCart');
if (btnClearCartEl) btnClearCartEl.addEventListener('click', () => { cart = []; renderCart(); });

function getCartSubtotal() { return cart.reduce((a, i) => a + i.harga * i.qty, 0); }

function getDiskon() { 
  const el = document.getElementById('inputDiskon');
  const persenDiskon = el ? (Number(el.value) || 0) : 0;
  return getCartSubtotal() * (persenDiskon / 100); 
}

function getCartTotal() { return Math.max(0, getCartSubtotal() - getDiskon()); }

function renderCart() {
  const box = document.getElementById('cartItems');
  if (!box) return;
  if (cart.length === 0) {
    box.innerHTML = '<div class="cart-empty">Keranjang masih kosong.<br>Klik produk di sebelah kiri atau scan barcode.</div>';
  } else {
    box.innerHTML = cart.map(i => `
      <div class="cart-row">
        <div class="ci-name"><p>${esc(i.nama)}</p><span>${formatRupiah(i.harga)}</span></div>
        <div class="qty-control">
          <button onclick="changeQty(${i.productId},-1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty(${i.productId},1)">+</button>
        </div>
        <div class="ci-sub">${formatRupiah(i.harga * i.qty)}</div>
        <button class="ci-remove" onclick="removeFromCart(${i.productId})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>`).join('');
  }
  const subtotal = getCartSubtotal();
  const total = getCartTotal();
  const subEl = document.getElementById('sumSubtotal');
  const vfdEl = document.getElementById('vfdTotal');
  if (subEl) subEl.textContent = formatRupiah(subtotal);
  if (vfdEl) vfdEl.textContent = formatRupiah(total);
  updateKembalian();
  renderPayQuick();
}

const inputDiskonEl = document.getElementById('inputDiskon');
if (inputDiskonEl) inputDiskonEl.addEventListener('input', renderCart);

function updateKembalian() {
  const bayarEl = document.getElementById('inputBayar');
  const bayar = bayarEl ? (Number(bayarEl.value) || 0) : 0;
  const total = getCartTotal();
  const kembali = bayar - total;
  const el = document.getElementById('kembalianVal');
  if (!el) return;
  el.textContent = formatRupiah(Math.max(0, kembali));
  el.style.color = kembali < 0 ? 'var(--danger)' : 'var(--success)';
}

const inputBayarEl = document.getElementById('inputBayar');
if (inputBayarEl) inputBayarEl.addEventListener('input', updateKembalian);

function renderPayQuick() {
  const total = getCartTotal();
  const opts = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000];
  const uniq = [...new Set(opts.filter(v => v > 0))].sort((a, b) => a - b).slice(0, 4);
  const payQuickEl = document.getElementById('payQuick');
  if (payQuickEl) {
    payQuickEl.innerHTML = uniq.map(v => `<button type="button" onclick="setBayar(${v})">${formatRupiah(v)}</button>`).join('');
  }
}

function setBayar(v) { 
  const el = document.getElementById('inputBayar');
  if (el) { el.value = v; updateKembalian(); }
}

const btnBayarEl = document.getElementById('btnBayar');
if (btnBayarEl) {
  btnBayarEl.addEventListener('click', async () => {
    if (cart.length === 0) { toast('Keranjang masih kosong', 'error'); return; }
    const total = getCartTotal();
    const bayarEl = document.getElementById('inputBayar');
    const bayar = bayarEl ? (Number(bayarEl.value) || 0) : 0;
    if (bayar < total) { toast('Uang diterima kurang dari total', 'error'); return; }

    const metodeEl = document.getElementById('metodeBayar');
    const sale = {
      nomor: generateNomor('INV'),
      tanggal: new Date().toISOString(),
      kasir: currentUser.nama,
      items: cart.map(i => ({ productId: i.productId, kode: i.kode, nama: i.nama, harga: i.harga, qty: i.qty, subtotal: i.harga * i.qty })),
      subtotal: getCartSubtotal(),
      diskon: getDiskon(),
      total: total,
      bayar: bayar,
      kembalian: bayar - total,
      metode: metodeEl ? metodeEl.value : 'Tunai',
    };

    try {
      for (const item of cart) {
        const p = await dbGet('products', item.productId);
        if (p) { p.stok = Math.max(0, p.stok - item.qty); await dbPut('products', p); }
      }
      const newId = await dbAdd('sales', sale);
      sale.id = newId;
      toast('Transaksi berhasil disimpan', 'success');
      printStruk(sale);
      cart = [];
      if (inputDiskonEl) inputDiskonEl.value = 0;
      if (inputBayarEl) inputBayarEl.value = '';
      allProductsCache = await dbGetAll('products');
      renderProductGrid();
      renderCart();
    } catch (err) { toast('Gagal memproses transaksi: ' + err.message, 'error'); }
  });
}

/* ---- Cetak Struk ---- */
async function printStruk(sale) {
  const s = await dbGet('settings', 1);
  const itemsHtml = sale.items.map(i => `
    <div style="display:flex;justify-content:space-between;">
      <span>${esc(i.nama)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;color:#333;">
      <span>${i.qty} x ${formatRupiah(i.harga)}</span><span>${formatRupiah(i.subtotal)}</span>
    </div>`).join('<div style="border-top:1px dashed #999;margin:4px 0;"></div>');

  const html = `
  <html><head><title>Struk ${esc(sale.nomor)}</title>
  <style>
    @page { margin: 0mm; size: 58mm auto; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #111; width: 50mm; margin: 0 auto; padding: 12px 6px 6px 6px; }
    h2 { font-size: 14px; margin: 0 0 2px; text-align: center; }
    p { margin: 2px 0; text-align: center; }
    .line { border-top: 1px dashed #444; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .bold { font-weight: bold; }
    .foot { text-align: center; margin-top: 8px; font-style: italic; }
  </style></head>
  <body>
    <h2>${esc(s ? s.namaToko : 'Toko Saya')}</h2>
    <p>${esc(s ? s.alamat : '')}</p>
    <p>${esc(s ? s.telepon : '')}</p>
    <div class="line"></div>
    <div class="row"><span>${esc(sale.nomor)}</span><span>${fmtTanggal(sale.tanggal)}</span></div>
    <div class="row"><span>Kasir:</span><span>${esc(sale.kasir)}</span></div>
    <div class="line"></div>
    ${itemsHtml}
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>${formatRupiah(sale.subtotal)}</span></div>
    <div class="row"><span>Diskon</span><span>${formatRupiah(sale.diskon)}</span></div>
    <div class="row bold"><span>TOTAL</span><span>${formatRupiah(sale.total)}</span></div>
    <div class="row"><span>Bayar (${esc(sale.metode)})</span><span>${formatRupiah(sale.bayar)}</span></div>
    <div class="row"><span>Kembalian</span><span>${formatRupiah(sale.kembalian)}</span></div>
    <div class="line"></div>
    <p class="foot">${esc(s ? s.footer : 'Terima kasih')}</p>
  </body></html>`;

  const w = window.open('', '_blank', 'width=360,height=640');
  if (!w) { toast('Popup diblokir browser', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

/* ============================================================
   PEMBELIAN
   ============================================================ */
let pbCart = [];

async function renderPembelian() {
  const products = await dbGetAll('products');
  const sel = document.getElementById('pbProduk');
  if (!sel) return;
  sel.innerHTML = products.map(p => `<option value="${p.id}" data-harga="${p.hargaBeli}">${esc(p.kode)} — ${esc(p.nama)}</option>`).join('');
  renderPbCart();
}
renderers.pembelian = renderPembelian;

const pbProdukEl = document.getElementById('pbProduk');
if (pbProdukEl) {
  pbProdukEl.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const hargaEl = document.getElementById('pbHarga');
    if (opt && hargaEl) hargaEl.value = opt.dataset.harga || 0;
  });
}

const btnTambahItemBeliEl = document.getElementById('btnTambahItemBeli');
if (btnTambahItemBeliEl) {
  btnTambahItemBeliEl.addEventListener('click', async () => {
    const sel = document.getElementById('pbProduk');
    if (!sel || !sel.value) { toast('Belum ada barang untuk dipilih', 'error'); return; }
    const p = await dbGet('products', Number(sel.value));
    const qtyEl = document.getElementById('pbQty');
    const hargaEl = document.getElementById('pbHarga');
    const qty = qtyEl ? (Number(qtyEl.value) || 0) : 0;
    const harga = hargaEl ? (Number(hargaEl.value) || 0) : 0;
    if (qty <= 0) { toast('Qty harus lebih dari 0', 'error'); return; }
    const existing = pbCart.find(i => i.productId === p.id);
    if (existing) { existing.qty += qty; existing.harga = harga; }
    else { pbCart.push({ productId: p.id, kode: p.kode, nama: p.nama, qty, harga }); }
    renderPbCart();
  });
}

function renderPbCart() {
  const body = document.getElementById('pbCartBody');
  if (!body) return;
  if (pbCart.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada barang di daftar pembelian.</td></tr>';
  } else {
    body.innerHTML = pbCart.map(i => `
      <tr><td>${esc(i.nama)}</td><td>${i.qty}</td><td>${formatRupiah(i.harga)}</td><td>${formatRupiah(i.qty * i.harga)}</td>
      <td><button class="ci-remove" onclick="removePb(${i.productId})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></td></tr>
    `).join('');
  }
  const total = pbCart.reduce((a, i) => a + i.qty * i.harga, 0);
  const totalEl = document.getElementById('pbTotal');
  if (totalEl) totalEl.textContent = formatRupiah(total);
}

function removePb(id) { pbCart = pbCart.filter(i => i.productId !== id); renderPbCart(); }

const btnSimpanPembelianEl = document.getElementById('btnSimpanPembelian');
if (btnSimpanPembelianEl) {
  btnSimpanPembelianEl.addEventListener('click', async () => {
    if (pbCart.length === 0) { toast('Daftar pembelian masih kosong', 'error'); return; }
    const supEl = document.getElementById('pbSupplier');
    const telpEl = document.getElementById('pbTelp');
    const supplier = supEl ? (supEl.value.trim() || 'Umum') : 'Umum';
    const telp = telpEl ? telpEl.value.trim() : '';
    const total = pbCart.reduce((a, i) => a + i.qty * i.harga, 0);
    const purchase = {
      nomor: generateNomor('PB'),
      tanggal: new Date().toISOString(),
      supplier, telp,
      items: pbCart.map(i => ({ productId: i.productId, kode: i.kode, nama: i.nama, qty: i.qty, harga: i.harga, subtotal: i.qty * i.harga })),
      total,
      dicatatOleh: currentUser.nama,
    };
    try {
      for (const item of pbCart) {
        const p = await dbGet('products', item.productId);
        if (p) { p.stok = (p.stok || 0) + item.qty; p.hargaBeli = item.harga; await dbPut('products', p); }
      }
      await dbAdd('purchases', purchase);
      toast('Transaksi pembelian tersimpan, stok diperbarui', 'success');
      pbCart = [];
      if (supEl) supEl.value = '';
      if (telpEl) telpEl.value = '';
      renderPembelian();
    } catch (err) { toast('Gagal menyimpan: ' + err.message, 'error'); }
  });
}

/* ============================================================
   LAPORAN PENJUALAN
   ============================================================ */
async function renderLaporanPenjualan() {
  const dariEl = document.getElementById('lpDari');
  const sampaiEl = document.getElementById('lpSampai');
  if (dariEl && !dariEl.value) {
    dariEl.value = todayStr();
    if (sampaiEl) sampaiEl.value = todayStr();
  }
  await filterLaporanPenjualan();
}
renderers.laporanPenjualan = renderLaporanPenjualan;

async function filterLaporanPenjualan() {
  const dari = document.getElementById('lpDari') ? document.getElementById('lpDari').value : '';
  const sampai = document.getElementById('lpSampai') ? document.getElementById('lpSampai').value : '';
  const all = await dbGetAll('sales');
  const filtered = all.filter(s => {
    const tgl = s.tanggal.slice(0, 10);
    return (!dari || tgl >= dari) && (!sampai || tgl <= sampai);
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const totalOmzet = filtered.reduce((a, s) => a + s.total, 0);
  const jumlahTrx = filtered.length;
  const rata = jumlahTrx ? totalOmzet / jumlahTrx : 0;

  const statsEl = document.getElementById('lpStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card"><div class="label">Total Omzet</div><div class="value">${formatRupiah(totalOmzet)}</div></div>
      <div class="stat-card"><div class="label">Jumlah Transaksi</div><div class="value">${jumlahTrx}</div></div>
      <div class="stat-card"><div class="label">Rata-rata / Transaksi</div><div class="value">${formatRupiah(rata)}</div></div>
    `;
  }

  const body = document.getElementById('lpTableBody');
  if (!body) return;
  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada transaksi pada periode ini.</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(s => `
    <tr>
      <td style="font-family:var(--font-mono);">${esc(s.nomor)}</td>
      <td>${fmtTanggal(s.tanggal)}</td>
      <td>${esc(s.kasir)}</td>
      <td>${s.items.length} item</td>
      <td><span class="badge badge-admin">${esc(s.metode)}</span></td>
      <td style="font-weight:700;">${formatRupiah(s.total)}</td>
      <td><button class="btn btn-outline btn-sm" onclick='reprintStruk(${s.id})'>Cetak Ulang</button></td>
    </tr>`).join('');
}

const btnFilterLPEl = document.getElementById('btnFilterLP');
if (btnFilterLPEl) btnFilterLPEl.addEventListener('click', filterLaporanPenjualan);
async function reprintStruk(id) { const s = await dbGet('sales', id); if (s) printStruk(s); }

/* ============================================================
   LAPORAN PEMBELIAN
   ============================================================ */
async function renderLaporanPembelian() {
  const dariEl = document.getElementById('lbDari');
  const sampaiEl = document.getElementById('lbSampai');
  if (dariEl && !dariEl.value) {
    dariEl.value = todayStr();
    if (sampaiEl) sampaiEl.value = todayStr();
  }
  await filterLaporanPembelian();
}
renderers.laporanPembelian = renderLaporanPembelian;

async function filterLaporanPembelian() {
  const dari = document.getElementById('lbDari') ? document.getElementById('lbDari').value : '';
  const sampai = document.getElementById('lbSampai') ? document.getElementById('lbSampai').value : '';
  const all = await dbGetAll('purchases');
  const filtered = all.filter(s => {
    const tgl = s.tanggal.slice(0, 10);
    return (!dari || tgl >= dari) && (!sampai || tgl <= sampai);
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const totalBelanja = filtered.reduce((a, s) => a + s.total, 0);
  const jumlahTrx = filtered.length;

  const statsEl = document.getElementById('lbStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card"><div class="label">Total Pembelian</div><div class="value">${formatRupiah(totalBelanja)}</div></div>
      <div class="stat-card"><div class="label">Jumlah Transaksi</div><div class="value">${jumlahTrx}</div></div>
      <div class="stat-card"><div class="label">Rata-rata / Transaksi</div><div class="value">${formatRupiah(jumlahTrx ? totalBelanja / jumlahTrx : 0)}</div></div>
    `;
  }

  const body = document.getElementById('lbTableBody');
  if (!body) return;
  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Tidak ada transaksi pada periode ini.</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(s => `
    <tr>
      <td style="font-family:var(--font-mono);">${esc(s.nomor)}</td>
      <td>${fmtTanggal(s.tanggal)}</td>
      <td>${esc(s.supplier)}</td>
      <td>${s.items.length} item</td>
      <td style="font-weight:700;">${formatRupiah(s.total)}</td>
    </tr>`).join('');
}

const btnFilterLBEl = document.getElementById('btnFilterLB');
if (btnFilterLBEl) btnFilterLBEl.addEventListener('click', filterLaporanPembelian);

/* ============================================================
   PENGATURAN
   ============================================================ */
async function renderPengaturan() {
  const s = await dbGet('settings', 1);
  if (!s) return;
  const tokoEl = document.getElementById('setNamaToko');
  const alamatEl = document.getElementById('setAlamat');
  const telpEl = document.getElementById('setTelepon');
  const footEl = document.getElementById('setFooter');
  if (tokoEl) tokoEl.value = s.namaToko;
  if (alamatEl) alamatEl.value = s.alamat;
  if (telpEl) telpEl.value = s.telepon;
  if (footEl) footEl.value = s.footer;
}
renderers.pengaturan = renderPengaturan;

const btnSimpanSettingEl = document.getElementById('btnSimpanSetting');
if (btnSimpanSettingEl) {
  btnSimpanSettingEl.addEventListener('click', async () => {
    const obj = {
      id: 1,
      namaToko: document.getElementById('setNamaToko').value.trim() || 'Toko Saya',
      alamat: document.getElementById('setAlamat').value.trim(),
      telepon: document.getElementById('setTelepon').value.trim(),
      footer: document.getElementById('setFooter').value.trim(),
    };
    await dbPut('settings', obj);
    toast('Pengaturan tersimpan', 'success');
    refreshTopbarStore();
  });
}

/* ============================================================
   USER
   ============================================================ */
async function renderUser() {
  const users = await dbGetAll('users');
  const body = document.getElementById('userTableBody');
  if (!body) return;
  body.innerHTML = users.map(u => `
    <tr>
      <td>${esc(u.username)}</td>
      <td>${esc(u.nama)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-kasir'}">${esc(u.role)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-outline btn-sm" onclick="editUser(${u.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="hapusUser(${u.id})">Hapus</button>
      </td>
    </tr>`).join('');
}
renderers.user = renderUser;

function resetUserForm() {
  document.getElementById('usrId').value = '';
  document.getElementById('usrUsername').value = '';
  document.getElementById('usrNama').value = '';
  document.getElementById('usrRole').value = 'kasir';
  document.getElementById('usrPassword').value = '';
}

const btnTambahUserEl = document.getElementById('btnTambahUser');
if (btnTambahUserEl) {
  btnTambahUserEl.addEventListener('click', () => {
    resetUserForm();
    document.getElementById('modalUserTitle').textContent = 'Tambah User';
    openModal('modalUser');
  });
}

async function editUser(id) {
  const u = await dbGet('users', id);
  if (!u) return;
  document.getElementById('usrId').value = u.id;
  document.getElementById('usrUsername').value = u.username;
  document.getElementById('usrNama').value = u.nama;
  document.getElementById('usrRole').value = u.role;
  document.getElementById('usrPassword').value = '';
  document.getElementById('modalUserTitle').textContent = 'Edit User';
  openModal('modalUser');
}

async function hapusUser(id) {
  const users = await dbGetAll('users');
  const target = users.find(u => u.id === id);
  if (!target) return;
  if (target.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
    toast('Tidak bisa menghapus satu-satunya akun admin', 'error'); return;
  }
  tampilkanKonfirmasi({
    icon: '👤',
    title: 'Hapus User',
    text: `Apakah Anda yakin ingin menghapus user "${target.nama}"?`,
    textBtnYa: 'Ya, Hapus',
    isDanger: true,
    onYes: async () => {
      await dbDelete('users', id);
      toast('User dihapus', 'success');
      renderUser();
    }
  });
}

const btnSimpanUserEl = document.getElementById('btnSimpanUser');
if (btnSimpanUserEl) {
  btnSimpanUserEl.addEventListener('click', async () => {
    const id = document.getElementById('usrId').value;
    const username = document.getElementById('usrUsername').value.trim();
    const nama = document.getElementById('usrNama').value.trim();
    const role = document.getElementById('usrRole').value;
    const password = document.getElementById('usrPassword').value;
    if (!username || !nama) { toast('Username dan Nama wajib diisi', 'error'); return; }
    try {
      if (id) {
        const u = await dbGet('users', Number(id));
        u.username = username; u.nama = nama; u.role = role;
        if (password) { if (password.length < 4) { toast('Password minimal 4 karakter', 'error'); return; } u.password = password; }
        await dbPut('users', u);
        toast('User diperbarui', 'success');
      } else {
        if (!password || password.length < 4) { toast('Password minimal 4 karakter', 'error'); return; }
        const dup = await dbGetByIndex('users', 'username', username);
        if (dup) { toast('Username sudah digunakan', 'error'); return; }
        await dbAdd('users', { username, nama, role, password });
        toast('User ditambahkan', 'success');
      }
      closeModal('modalUser');
      renderUser();
    } catch (err) { toast('Gagal menyimpan: ' + err.message, 'error'); }
  });
}

/* ============================================================
   EVENT UMUM
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => goPage(btn.dataset.page));
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const backdrop = e.target.closest('.modal-backdrop');
    if (backdrop) backdrop.classList.remove('show');
  });
});

document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) bd.classList.remove('show'); });
});

const btnLogoutEl = document.getElementById('btnLogout');
if (btnLogoutEl) {
  btnLogoutEl.addEventListener('click', () => {
    doLogout();
  });
}

const hamburgerEl = document.getElementById('hamburger');
if (hamburgerEl) {
  hamburgerEl.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  });
}

const loginFormEl = document.getElementById('loginForm');
if (loginFormEl) {
  loginFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errBox = document.getElementById('loginError');
    if (errBox) errBox.classList.remove('show');
    const result = await doLogin(username, password);
    if (!result.ok) { 
      if (errBox) { errBox.textContent = result.msg; errBox.classList.add('show'); } 
      return; 
    }
    startApp();
  });
}

/* ============================================================
   INIT
   ============================================================ */
async function startApp() {
  const loginScreen = document.getElementById('loginScreen');
  const appShell = document.getElementById('appShell');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appShell) appShell.classList.add('show');
  initShellForUser();
  await refreshTopbarStore();
  goPage('dashboard');
  tickClock();
  setInterval(tickClock, 1000);
}

(async function init() {
  const izinJalan = await cekLisensiOnline();
  if (!izinJalan) return;

  await getDB();
  await seedIfEmpty();
  const restored = await tryRestoreSession();
  if (restored) { startApp(); }
})();

/* ============================================================
   NAVIGASI KEYBOARD POS
   ============================================================ */
document.addEventListener('keydown', function(e) {
  const pagePenjualan = document.getElementById('page-penjualan');
  if (!pagePenjualan || !pagePenjualan.classList.contains('active')) return;

  const activeEl = document.activeElement;

  // 1. Jika di kolom pencarian lalu menekan TAB atau Panah Bawah
  if ((e.key === 'Tab' || e.key === 'ArrowDown') && activeEl.id === 'posSearch') {
    e.preventDefault(); // Mencegah fungsi tab bawaan browser
    const firstRow = document.querySelector('.pos-item-row[tabindex="0"]');
    if (firstRow) firstRow.focus();
  }

  // 2. Jika sedang fokus memilih baris barang
  if (activeEl.classList.contains('pos-item-row')) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = activeEl.nextElementSibling;
      while (next && !next.hasAttribute('tabindex')) { next = next.nextElementSibling; } // Lewati barang habis
      if (next) next.focus();
    } 
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = activeEl.previousElementSibling;
      while (prev && !prev.hasAttribute('tabindex')) { prev = prev.previousElementSibling; }
      if (prev) {
        prev.focus();
      } else {
        // Jika sudah di paling atas, kembalikan kursor ke kolom pencarian
        const searchInput = document.getElementById('posSearch');
        if (searchInput) searchInput.focus();
      }
    } 
    else if (e.key === 'Enter') {
      e.preventDefault();
      activeEl.click(); // Otomatis memasukkan barang ke keranjang
    }
  }
});

/* ============================================================
   SISTEM SAKLAR LISENSI JARAK JAUH
   ============================================================ */
async function cekLisensiOnline() {
  const GIST_URL = 'https://raw.githubusercontent.com/ppure8/SolusiKasir/main/license.json';
  
  try {
    const response = await fetch(GIST_URL + '?t=' + new Date().getTime());
    const data = await response.json();
    
    if (data.status === 'blocked') {
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#EFEDE2; color:#20261D; text-align:center; padding:20px;">
          <div style="background:#fff; padding:35px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.15); max-width:400px; width:100%;">
            <h2 style="color:#B23B3B; margin-bottom:12px;">Akses Ditangguhkan</h2>
            <p style="font-size:14px; color:#5B6355; line-height:1.5;">${data.pesan || 'Akses ke aplikasi ini dihentikan sementara. Silakan hubungi administrator.'}</p>
            <div style="margin-top:20px; font-weight:bold; font-size:13px; color:#1F6E5C;">WhatsApp: 08xx-xxxx-xxxx</div>
          </div>
        </div>
      `;
      return false;
    }
  } catch (err) {
    console.warn("Gagal mengecek lisensi online, melanjutkan mode offline.");
  }
  return true;
}