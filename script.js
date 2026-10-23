
const DEFAULT_BAHAN = [
  { id: "susu",    nama: "Susu UHT",           unit: "ml", awal: 1000, stok: 1000 },
  { id: "kopi",    nama: "Biji Kopi",          unit: "g",  awal: 1000, stok: 1000 },
  { id: "gula",    nama: "Gula Aren Cair",     unit: "ml", awal: 1000, stok: 1000 },
  { id: "creamer", nama: "Non-Dairy Creamer",  unit: "g",  awal: 1000, stok: 1000 },
];

const DEFAULT_MENU = [
  {
    id: "kopi-inspirasi",
    nama: "Kopi Inspirasi",
    deskripsi: "Perpaduan kopi, susu, dan gula aren dengan rasa creamy yang seimbang.",
    resep: [
      { bahanId: "susu", jumlah: 120 },
      { bahanId: "kopi", jumlah: 15 },
      { bahanId: "gula", jumlah: 20 },
      { bahanId: "creamer", jumlah: 15 },
    ],
  },
];




let bahanList = [];
let menuList = [];
let riwayatList = [];
const menuQty = {};


let keranjang = []; // { menuId, qty }
let pesananProses = []; // pesanan terkonfirmasi, menunggu pembayaran
const METODE_LABEL = { cash: "Cash", qris: "QRIS", kasbon: "Kasbon" };



const ROLE = sessionStorage.getItem("role") === "admin" ? "admin" : "monitor";

function isAdmin() {
  return ROLE === "admin";
}
function requireAdmin() {
  if (isAdmin()) return true;
  showToast("Mode monitoring hanya bisa melihat data", "error");
  return false;
}

function getBahan(id) {
  return bahanList.find((b) => b.id === id);
}

function hitungPersentase(bahan) {
  return Math.max(0, (bahan.stok / bahan.awal) * 100);
}

function getTone(persen) {
  if (persen <= 30) return "danger";
  if (persen <= 50) return "warning";
  return "normal";
}

function formatAngka(n) {
  return Number(n.toFixed(1)).toString();
}

function formatRupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function formatWaktu(date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJam(date) {
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}


function kunciHari(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHari(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function teksPembayaran(trx) {
  if (!trx.metode) return "-";
  const label = METODE_LABEL[trx.metode] || trx.metode;
  return trx.metode === "kasbon" && trx.pelanggan ? `${label} - ${trx.pelanggan}` : label;
}

function slugify(text, existingIds) {
  let base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (!base) base = "item";

  let id = base;
  let i = 1;
  while (existingIds.includes(id)) {
    id = `${base}-${i}`;
    i++;
  }
  return id;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}



function renderStokGrid() {
  const grid = document.getElementById("stok-grid");
  grid.innerHTML = "";

  bahanList.forEach((bahan) => {
    const persen = hitungPersentase(bahan);
    const tone = getTone(persen);

    const row = document.createElement("div");
    row.className = `stok-row tone-${tone}`;
    row.innerHTML = `
      <div class="stok-row-top">
        <h3>${bahan.nama}</h3>
        <span class="stok-pct">${formatAngka(persen)}%</span>
      </div>
      <p class="stok-amount">${formatAngka(bahan.stok)} ${bahan.unit} dari ${bahan.awal} ${bahan.unit}</p>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.min(100, persen)}%"></div>
      </div>
    `;
    grid.appendChild(row);
  });
}



function bisaDibuatMenu(menu, qty) {
  return menu.resep.every((r) => {
    const bahan = getBahan(r.bahanId);
    return bahan && bahan.stok >= r.jumlah * qty;
  });
}

// ===== Tampilan kartu menu (khusus admin) =====
function renderMenuKartu() {
  const grid = document.getElementById("menu-grid");
  grid.className = "menu-cards";
  grid.innerHTML = menuList
    .map((menu) => {
      const bisa = bisaDitambah(menu.id, 1);
      const jml = qtyDiKeranjang(menu.id);
      const gambar = menu.gambar
        ? `<img src="${esc(menu.gambar)}" alt="${esc(menu.nama)}" />`
        : `<div class="mcard-noimg" aria-hidden="true">☕</div>`;
      return `
      <article class="mcard">
        <div class="mcard-head">
          <h3 class="mcard-name">${esc(menu.nama)}</h3>
          <p class="mcard-price">${menu.harga > 0 ? formatRupiah(menu.harga) : "Harga belum diatur"}</p>
        </div>
        <div class="mcard-body">
          <div class="mcard-img">
            ${gambar}
            ${jml > 0 ? `<span class="mcard-badge" title="Jumlah di keranjang">${jml}</span>` : ""}
          </div>
          <button type="button" class="mcard-plus" data-mk="tambah" data-id="${esc(menu.id)}" ${bisa ? "" : "disabled"}
            aria-label="Tambah ${esc(menu.nama)} ke keranjang" title="${bisa ? "Tambah ke keranjang" : "Stok tidak cukup"}">+</button>
        </div>
        <div class="mcard-foot">
          <button type="button" class="btn btn-outline btn-small" data-mk="ubah" data-id="${esc(menu.id)}">Ubah</button>
          <button type="button" class="btn btn-outline btn-small" data-mk="bahan" data-id="${esc(menu.id)}">Bahan</button>
        </div>
      </article>`;
    })
    .join("");
}

function initMenuKartu() {
  document.getElementById("menu-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mk]");
    if (!btn || !isAdmin()) return;
    const id = btn.dataset.id;
    if (btn.dataset.mk === "tambah") tambahKeKeranjang(id);
    else if (btn.dataset.mk === "ubah") bukaModalMenu(id);
    else if (btn.dataset.mk === "bahan") bukaModalResep(id);
  });
}

function bukaModalResep(menuId) {
  const menu = menuList.find((m) => m.id === menuId);
  if (!menu) return;
  document.getElementById("modal-resep-title").textContent = `Bahan — ${menu.nama}`;
  document.getElementById("modal-resep-list").innerHTML = menu.resep
    .map((r) => {
      const b = getBahan(r.bahanId);
      return `<li><span>${esc(b ? b.nama : r.bahanId)}</span><strong>${formatAngka(Number(r.jumlah))} ${esc(b ? b.unit : "")}</strong></li>`;
    })
    .join("");
  document.getElementById("modal-resep-overlay").classList.add("open");
}

function tutupModalResep() {
  document.getElementById("modal-resep-overlay").classList.remove("open");
}

// ===== Gambar menu: impor + kompres =====
let gambarModal = "";
const BATAS_GAMBAR = 40000; // panjang teks data-URL (batas sel spreadsheet 50.000 karakter)

function bacaGambar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    img.src = url;
  });
}

// Potong persegi dari tengah, kecilkan, simpan sebagai JPEG sampai cukup ringan
async function kompresGambar(file) {
  const img = await bacaGambar(file);
  const sisi = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - sisi) / 2;
  const sy = (img.naturalHeight - sisi) / 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let hasil = "";
  for (const ukuran of [320, 280, 240, 200, 160]) {
    canvas.width = canvas.height = ukuran;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ukuran, ukuran);
    ctx.drawImage(img, sx, sy, sisi, sisi, 0, 0, ukuran, ukuran);
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      hasil = canvas.toDataURL("image/jpeg", q);
      if (hasil.length <= BATAS_GAMBAR) return hasil;
    }
  }
  return hasil.length <= BATAS_GAMBAR ? hasil : "";
}

function renderPreviewGambar(info) {
  const kotak = document.getElementById("menu-gambar-preview");
  kotak.innerHTML = gambarModal ? `<img src="${esc(gambarModal)}" alt="Pratinjau" />` : "<span>Belum ada gambar</span>";
  document.getElementById("btn-hapus-gambar").hidden = !gambarModal;
  document.getElementById("gambar-info").textContent =
    info || (gambarModal ? `Ukuran tersimpan ± ${Math.round((gambarModal.length * 0.75) / 1024)} KB` : "");
}

function initGambarMenu() {
  const input = document.getElementById("menu-gambar-input");
  document.getElementById("btn-pilih-gambar").addEventListener("click", () => input.click());
  document.getElementById("btn-hapus-gambar").addEventListener("click", () => {
    gambarModal = "";
    renderPreviewGambar();
  });
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar", "error");
      return;
    }
    document.getElementById("gambar-info").textContent = "Mengompres gambar…";
    try {
      const hasil = await kompresGambar(file);
      if (!hasil) throw new Error("Terlalu besar");
      gambarModal = hasil;
      renderPreviewGambar("Gambar berhasil dikompres ± " + Math.round((hasil.length * 0.75) / 1024) + " KB");
    } catch (err) {
      console.error(err);
      renderPreviewGambar();
      showToast("Gagal memproses gambar, coba file lain", "error");
    }
  });

  document.getElementById("modal-menu-hapus").addEventListener("click", () => {
    const id = menuAktifEdit;
    if (!id) return;
    hapusMenu(id);
    if (!menuList.some((m) => m.id === id)) tutupModalMenu();
  });
}

function renderMenuGrid() {
  if (isAdmin()) {
    renderMenuKartu();
    return;
  }
  const grid = document.getElementById("menu-grid");
  grid.innerHTML = "";

  menuList.forEach((menu) => {
    const resepHtml = menu.resep
      .map((r) => {
        const bahan = getBahan(r.bahanId);
        return `<li>${bahan ? bahan.nama : r.bahanId} — ${r.jumlah}${bahan ? bahan.unit : ""}</li>`;
      })
      .join("");

    const qty = menuQty[menu.id] || 1;
    const bisaDibuat = bisaDitambah(menu.id, qty);

    const row = document.createElement("div");
    row.className = "menu-row";
    row.innerHTML = `
      <div class="menu-row-head">
        <div>
          <h3>${menu.nama}</h3>
          <p class="menu-desc">${menu.deskripsi}</p>
          <p class="menu-price">${menu.harga > 0 ? formatRupiah(menu.harga) : "Harga belum diatur"}</p>
        </div>
        <div class="menu-row-actions admin-only">
          <button type="button" class="btn btn-outline btn-small" data-ubah-menu="${menu.id}">Ubah</button>
          <button type="button" class="btn-icon-danger" data-hapus-menu="${menu.id}" title="Hapus menu">✕</button>
        </div>
      </div>
      <ul class="recipe-list">${resepHtml}</ul>
      <div class="menu-row-footer admin-only">
        <div class="qty-control">
          <button type="button" class="qty-btn" data-qty-action="minus" data-menu-id="${menu.id}">−</button>
          <input type="number" class="qty-input" min="1" step="1" value="${qty}" data-qty-input="${menu.id}" />
          <button type="button" class="qty-btn" data-qty-action="plus" data-menu-id="${menu.id}">+</button>
        </div>
        <button class="btn btn-primary btn-small" data-menu-id="${menu.id}" ${bisaDibuat ? "" : "disabled"}>
          ${bisaDibuat ? "+ Keranjang" : "Stok Tidak Cukup"}
        </button>
      </div>
    `;
    grid.appendChild(row);
  });

  grid.querySelectorAll("button[data-menu-id]:not([data-qty-action])").forEach((btn) => {
    btn.addEventListener("click", () => tambahKeKeranjang(btn.dataset.menuId));
  });

  grid.querySelectorAll("button[data-qty-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.menuId;
      const delta = btn.dataset.qtyAction === "plus" ? 1 : -1;
      menuQty[id] = Math.max(1, (menuQty[id] || 1) + delta);
      updateMenuCardState(id);
    });
  });

  grid.querySelectorAll("input[data-qty-input]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.qtyInput;
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      menuQty[id] = val;
      updateMenuCardState(id);
    });
  });

  grid.querySelectorAll("button[data-hapus-menu]").forEach((btn) => {
    btn.addEventListener("click", () => hapusMenu(btn.dataset.hapusMenu));
  });

  grid.querySelectorAll("button[data-ubah-menu]").forEach((btn) => {
    btn.addEventListener("click", () => bukaModalMenu(btn.dataset.ubahMenu));
  });
}

function hapusMenu(menuId) {
  if (!requireAdmin()) return;
  const menu = menuList.find((m) => m.id === menuId);
  if (!menu) return;

  const yakin = confirm(`Hapus menu "${menu.nama}" dari katalog?`);
  if (!yakin) return;

  const index = menuList.findIndex((m) => m.id === menuId);
  menuList.splice(index, 1);
  delete menuQty[menuId];

  showToast(`Menu "${menu.nama}" telah dihapus`, "success");
  renderAll();
}

function updateMenuCardState(menuId) {
  const menu = menuList.find((m) => m.id === menuId);
  if (!menu) return;
  const qty = menuQty[menuId] || 1;

  const input = document.querySelector(`input[data-qty-input="${menuId}"]`);
  if (input) input.value = qty;

  const btn = document.querySelector(`button[data-menu-id="${menuId}"]:not([data-qty-action])`);
  if (!btn) return;
  const bisaDibuat = bisaDitambah(menu.id, qty);
  btn.disabled = !bisaDibuat;
  btn.textContent = bisaDibuat ? "+ Keranjang" : "Stok Tidak Cukup";
}



// ===== Keranjang & pembayaran =====
function kebutuhanBahan(items) {
  const perlu = {};
  items.forEach((it) => {
    const menu = menuList.find((m) => m.id === it.menuId);
    if (!menu) return;
    menu.resep.forEach((r) => {
      perlu[r.bahanId] = (perlu[r.bahanId] || 0) + r.jumlah * it.qty;
    });
  });
  return perlu;
}

// Nama bahan yang stoknya tidak cukup untuk seluruh isi "items" (digabung antar menu)
function kebutuhanProses() {
  const perlu = {};
  pesananProses.forEach((p) => {
    p.resep.forEach((r) => {
      perlu[r.bahanId] = (perlu[r.bahanId] || 0) + r.jumlah * p.qty;
    });
  });
  return perlu;
}

function bahanKurang(items) {
  const perlu = kebutuhanBahan(items);
  const dipesan = kebutuhanProses();
  Object.keys(dipesan).forEach((id) => {
    perlu[id] = (perlu[id] || 0) + dipesan[id];
  });
  return Object.keys(perlu)
    .filter((id) => {
      const b = getBahan(id);
      return !b || b.stok < perlu[id];
    })
    .map((id) => (getBahan(id) || { nama: id }).nama);
}

function qtyDiKeranjang(menuId) {
  const it = keranjang.find((i) => i.menuId === menuId);
  return it ? it.qty : 0;
}

function itemsDenganTambahan(menuId, qty) {
  const items = keranjang.filter((i) => i.menuId !== menuId);
  items.push({ menuId, qty: qtyDiKeranjang(menuId) + qty });
  return items;
}

function bisaDitambah(menuId, qty) {
  return bahanKurang(itemsDenganTambahan(menuId, qty)).length === 0;
}

function tambahKeKeranjang(menuId) {
  if (!requireAdmin()) return;
  const menu = menuList.find((m) => m.id === menuId);
  if (!menu) return;

  const qty = menuQty[menuId] || 1;
  const kurang = bahanKurang(itemsDenganTambahan(menuId, qty));
  if (kurang.length > 0) {
    showToast(`Stok tidak cukup untuk: ${kurang.join(", ")}`, "error");
    return;
  }

  const item = keranjang.find((i) => i.menuId === menuId);
  if (item) item.qty += qty;
  else keranjang.push({ menuId, qty });
  menuQty[menuId] = 1;

  showToast(`${menu.nama} × ${qty} masuk keranjang`, "success");
  renderMenuGrid();
  renderKeranjang();
}

function ubahQtyKeranjang(menuId, delta) {
  const item = keranjang.find((i) => i.menuId === menuId);
  if (!item) return;
  if (delta > 0) {
    const kurang = bahanKurang(itemsDenganTambahan(menuId, delta));
    if (kurang.length > 0) {
      showToast(`Stok tidak cukup untuk: ${kurang.join(", ")}`, "error");
      return;
    }
  }
  item.qty = Math.max(1, item.qty + delta);
  renderMenuGrid();
  renderKeranjang();
}

function hapusDariKeranjang(menuId) {
  keranjang = keranjang.filter((i) => i.menuId !== menuId);
  renderMenuGrid();
  renderKeranjang();
}

function kosongkanKeranjang() {
  if (keranjang.length === 0) return;
  keranjang = [];
  renderMenuGrid();
  renderKeranjang();
}

function totalKeranjang() {
  return keranjang.reduce((sum, i) => {
    const menu = menuList.find((m) => m.id === i.menuId);
    return sum + (menu ? (menu.harga || 0) * i.qty : 0);
  }, 0);
}

function renderKeranjang() {
  const wadah = document.getElementById("cart-items");
  if (!wadah) return;

  // Buang item yang menunya sudah dihapus
  keranjang = keranjang.filter((i) => menuList.some((m) => m.id === i.menuId));

  wadah.innerHTML = keranjang
    .map((i) => {
      const menu = menuList.find((m) => m.id === i.menuId);
      const harga = menu.harga || 0;
      return `
      <div class="cart-item">
        <div class="cart-item-top">
          <div>
            <div class="cart-item-name">${menu.nama}</div>
            <div class="cart-item-price">${harga > 0 ? formatRupiah(harga) : "Harga belum diatur"}</div>
          </div>
          <button type="button" class="btn-icon-danger" data-cart-act="hapus" data-cart-id="${menu.id}" title="Hapus dari keranjang">✕</button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-control">
            <button type="button" class="qty-btn" data-cart-act="minus" data-cart-id="${menu.id}" ${i.qty <= 1 ? "disabled" : ""}>−</button>
            <span class="cart-qty">${i.qty}</span>
            <button type="button" class="qty-btn" data-cart-act="plus" data-cart-id="${menu.id}">+</button>
          </div>
          <span class="cart-subtotal">${harga > 0 ? formatRupiah(harga * i.qty) : "-"}</span>
        </div>
      </div>`;
    })
    .join("");

  const jumlah = keranjang.reduce((n, i) => n + i.qty, 0);
  const total = totalKeranjang();

  document.getElementById("cart-empty").style.display = keranjang.length ? "none" : "block";
  document.getElementById("cart-count").textContent = jumlah;
  document.getElementById("cart-total").textContent = formatRupiah(total);
  document.getElementById("btn-checkout").disabled = keranjang.length === 0;

  const fab = document.getElementById("cart-fab");
  fab.hidden = keranjang.length === 0;
  document.getElementById("cart-fab-count").textContent = jumlah;
  document.getElementById("cart-fab-total").textContent = formatRupiah(total);
}

function checkout() {
  if (!requireAdmin()) return;
  if (keranjang.length === 0) {
    showToast("Keranjang masih kosong", "error");
    return;
  }

  // Cek stok untuk seluruh keranjang (sudah termasuk pesanan yang sedang diproses)
  const kurang = bahanKurang(keranjang);
  if (kurang.length > 0) {
    showToast(`Stok tidak cukup untuk: ${kurang.join(", ")}`, "error");
    renderMenuGrid();
    renderKeranjang();
    return;
  }

  const waktu = new Date();
  const orderId = "ord-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let jumlah = 0;

  keranjang.forEach((item) => {
    const menu = menuList.find((m) => m.id === item.menuId);
    if (!menu) return;
    jumlah += item.qty;
    pesananProses.push({
      id: "prs-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      orderId,
      waktu,
      menuId: menu.id,
      menuNama: menu.nama,
      harga: menu.harga || 0,
      qty: item.qty,
      resep: menu.resep.map((r) => ({ bahanId: r.bahanId, jumlah: r.jumlah })),
      metode: "cash",
      pelanggan: "",
    });
  });

  keranjang = [];
  showToast(`${jumlah} item masuk ke Proses Pesanan`, "success");
  renderAll();
}

// ===== Proses Pesanan =====
// Disimpan di localStorage browser agar tidak hilang saat halaman di-refresh.
// (Kunci sengaja tidak diawali "saung" supaya tidak ikut terhapus oleh pembersihan cache saat keluar/masuk.)
const KUNCI_PROSES = "kasir-proses-pesanan";

function simpanProsesLokal() {
  if (!isAdmin()) return;
  try {
    localStorage.setItem(KUNCI_PROSES, JSON.stringify(pesananProses));
  } catch (e) {}
}

function muatProsesLokal() {
  try {
    const raw = localStorage.getItem(KUNCI_PROSES);
    if (raw === null) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.filter((p) => p && p.id && Array.isArray(p.resep)).map((p) => ({ ...p, waktu: new Date(p.waktu) }));
  } catch (e) {
    return null;
  }
}

function renderProses() {
  const wadah = document.getElementById("proses-list");
  if (!wadah) return;

  document.getElementById("proses-empty").style.display = pesananProses.length ? "none" : "block";

  const badge = document.getElementById("proses-count");
  badge.textContent = pesananProses.length;
  badge.hidden = pesananProses.length === 0;

  wadah.innerHTML = pesananProses
    .map((p) => {
      const subtotal = p.harga > 0 ? formatRupiah(p.harga * p.qty) : "-";
      const opsi = ["cash", "qris", "kasbon"]
        .map(
          (m) => `
          <label class="pay-opt">
            <input type="radio" name="metode-${p.id}" value="${m}" data-proses-metode="${p.id}" ${p.metode === m ? "checked" : ""} />
            <span>${METODE_LABEL[m]}</span>
          </label>`
        )
        .join("");
      return `
      <div class="proses-card" data-proses-id="${p.id}">
        <div class="proses-top">
          <div>
            <div class="proses-name">${esc(p.menuNama)} × ${p.qty}</div>
            <div class="proses-meta">${formatJam(p.waktu)} · ${p.harga > 0 ? formatRupiah(p.harga) + " / porsi" : "Harga belum diatur"}</div>
          </div>
          <strong class="proses-total">${subtotal}</strong>
        </div>
        <div class="proses-pay">
          <span class="modal-label">Metode pembayaran</span>
          <div class="pay-options" role="radiogroup" aria-label="Metode pembayaran">${opsi}</div>
          <div class="kasbon-wrap" ${p.metode === "kasbon" ? "" : "hidden"}>
            <label class="modal-label">Nama pelanggan (wajib untuk kasbon)</label>
            <input type="text" maxlength="60" placeholder="Contoh: Pak Budi" value="${esc(p.pelanggan)}" data-proses-nama="${p.id}" />
          </div>
        </div>
        <div class="proses-actions">
          <button type="button" class="btn btn-outline btn-small btn-danger-outline" data-proses-act="batal" data-proses-id="${p.id}">Batalkan</button>
          <button type="button" class="btn btn-primary" data-proses-act="bayar" data-proses-id="${p.id}">Konfirmasi Pembayaran</button>
        </div>
      </div>`;
    })
    .join("");
}

function batalkanProses(id) {
  if (!requireAdmin()) return;
  const p = pesananProses.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Batalkan pesanan "${p.menuNama} × ${p.qty}"?`)) return;
  pesananProses = pesananProses.filter((x) => x.id !== id);
  showToast("Pesanan dibatalkan", "success");
  renderAll();
}

function konfirmasiPembayaran(id) {
  if (!requireAdmin()) return;
  const p = pesananProses.find((x) => x.id === id);
  if (!p) return;

  const metode = p.metode || "cash";
  const pelanggan = (p.pelanggan || "").trim();
  if (metode === "kasbon" && !pelanggan) {
    showToast("Isi nama pelanggan untuk kasbon", "error");
    const input = document.querySelector(`input[data-proses-nama="${id}"]`);
    if (input) input.focus();
    return;
  }

  // Pastikan stok nyata masih cukup untuk pesanan ini
  const kurang = p.resep
    .filter((r) => {
      const b = getBahan(r.bahanId);
      return !b || b.stok < r.jumlah * p.qty;
    })
    .map((r) => (getBahan(r.bahanId) || { nama: r.bahanId }).nama);
  if (kurang.length > 0) {
    showToast(`Stok tidak cukup untuk: ${kurang.join(", ")}`, "error");
    return;
  }

  const bahanTerpakai = p.resep.map((r) => {
    const bahan = getBahan(r.bahanId);
    const totalPakai = r.jumlah * p.qty;
    bahan.stok -= totalPakai;
    return { bahanId: bahan.id, nama: bahan.nama, jumlah: totalPakai, unit: bahan.unit };
  });

  riwayatList.unshift({
    id: "trx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    orderId: p.orderId,
    waktu: new Date(),
    menuNama: p.qty > 1 ? `${p.menuNama} × ${p.qty}` : p.menuNama,
    qty: p.qty,
    harga: p.harga,
    total: p.harga * p.qty,
    metode,
    pelanggan: metode === "kasbon" ? pelanggan : "",
    bahanTerpakai,
    status: "selesai",
    waktuBatal: null,
  });

  pesananProses = pesananProses.filter((x) => x.id !== id);

  const info = p.harga > 0 ? ` · ${formatRupiah(p.harga * p.qty)}` : "";
  if (metode === "kasbon") {
    showToast(`Dicatat sebagai kasbon atas nama ${pelanggan}${info}`, "success");
  } else {
    showToast(`Dibayar via ${METODE_LABEL[metode]}${info}, masuk ke Riwayat`, "success");
  }
  renderAll();
}

function initProses() {
  const wadah = document.getElementById("proses-list");

  wadah.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-proses-act]");
    if (!btn) return;
    if (btn.dataset.prosesAct === "bayar") konfirmasiPembayaran(btn.dataset.prosesId);
    else if (btn.dataset.prosesAct === "batal") batalkanProses(btn.dataset.prosesId);
  });

  // Simpan pilihan di memori tanpa render ulang, agar isian tidak hilang
  wadah.addEventListener("change", (e) => {
    const radio = e.target.closest("input[data-proses-metode]");
    if (!radio || !radio.checked) return;
    const p = pesananProses.find((x) => x.id === radio.dataset.prosesMetode);
    if (!p) return;
    p.metode = radio.value;
    simpanProsesLokal();
    jadwalSimpan();
    const kartu = radio.closest(".proses-card");
    const wrap = kartu.querySelector(".kasbon-wrap");
    wrap.hidden = p.metode !== "kasbon";
    if (p.metode === "kasbon") kartu.querySelector("input[data-proses-nama]").focus();
  });

  wadah.addEventListener("input", (e) => {
    const input = e.target.closest("input[data-proses-nama]");
    if (!input) return;
    const p = pesananProses.find((x) => x.id === input.dataset.prosesNama);
    if (p) {
      p.pelanggan = input.value;
      simpanProsesLokal();
      jadwalSimpan();
    }
  });
}

function initCart() {
  document.getElementById("cart-items").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cart-act]");
    if (!btn || !requireAdmin()) return;
    const id = btn.dataset.cartId;
    const act = btn.dataset.cartAct;
    if (act === "plus") ubahQtyKeranjang(id, 1);
    else if (act === "minus") ubahQtyKeranjang(id, -1);
    else if (act === "hapus") hapusDariKeranjang(id);
  });

  document.getElementById("btn-checkout").addEventListener("click", checkout);
  document.getElementById("btn-kosongkan-keranjang").addEventListener("click", kosongkanKeranjang);
  document.getElementById("cart-fab").addEventListener("click", () => {
    document.getElementById("cart-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderStatusList() {
  const list = document.getElementById("status-list");
  list.innerHTML = "";

  const labelStatus = {
    normal: "Normal",
    warning: "Menipis",
    danger: "Kritis",
  };

  bahanList.forEach((bahan) => {
    const persen = hitungPersentase(bahan);
    const tone = getTone(persen);

    const row = document.createElement("div");
    row.className = `status-row tone-${tone}`;
    row.innerHTML = `
      <div class="status-main">
        <h3>${bahan.nama}</h3>
        <p>${formatAngka(bahan.stok)} ${bahan.unit} tersisa dari ${bahan.awal} ${bahan.unit} (${formatAngka(persen)}%)</p>
      </div>
      <span class="badge tone-${tone}">${labelStatus[tone]}</span>
      <div class="status-actions admin-only">
        <button class="btn btn-outline btn-small" data-add-id="${bahan.id}">Tambah Stok</button>
        <button class="btn btn-outline btn-small btn-danger-outline" data-hapus-bahan="${bahan.id}">Hapus</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("button[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", () => bukaModalTambahStok(btn.dataset.addId));
  });

  list.querySelectorAll("button[data-hapus-bahan]").forEach((btn) => {
    btn.addEventListener("click", () => hapusBahan(btn.dataset.hapusBahan));
  });
}

function resetStok() {
  if (!requireAdmin()) return;
  if (bahanList.length === 0) {
    showToast("Tidak ada bahan untuk direset", "error");
    return;
  }

  document.getElementById("reset-list").innerHTML = bahanList
    .map(
      (b) => `
      <label class="check-row">
        <input type="checkbox" class="reset-check" value="${b.id}" />
        <span class="check-name">${b.nama}</span>
        <span class="check-info">${formatAngka(b.stok)} ${b.unit}</span>
      </label>`
    )
    .join("");
  document.getElementById("reset-semua").checked = false;
  document.getElementById("modal-reset-overlay").classList.add("open");
}

function tutupModalReset() {
  document.getElementById("modal-reset-overlay").classList.remove("open");
}

function konfirmasiReset() {
  if (!requireAdmin()) return;
  const terpilih = Array.from(document.querySelectorAll("#reset-list .reset-check:checked")).map((c) => c.value);

  if (terpilih.length === 0) {
    showToast("Pilih minimal satu bahan yang akan direset", "error");
    return;
  }

  const target = bahanList.filter((b) => terpilih.includes(b.id));
  const yakin = confirm(`Reset stok menjadi 0 untuk: ${target.map((b) => b.nama).join(", ")}?`);
  if (!yakin) return;

  target.forEach((b) => (b.stok = 0));

  tutupModalReset();
  showToast(`Stok ${target.length} bahan telah dikosongkan`, "success");
  renderAll();
}

function hapusBahan(bahanId) {
  if (!requireAdmin()) return;
  const bahan = getBahan(bahanId);
  if (!bahan) return;

  const menuTerdampak = menuList.filter((m) => m.resep.some((r) => r.bahanId === bahanId));
  const menuAkanHilang = menuTerdampak.filter((m) => m.resep.length === 1);

  let pesan = `Hapus bahan "${bahan.nama}"?`;
  if (menuTerdampak.length > 0) {
    pesan += `\n\nBahan ini akan dihapus dari resep: ${menuTerdampak.map((m) => m.nama).join(", ")}.`;
  }
  if (menuAkanHilang.length > 0) {
    pesan += `\nMenu berikut ikut dihapus karena resepnya jadi kosong: ${menuAkanHilang.map((m) => m.nama).join(", ")}.`;
  }
  if (!confirm(pesan)) return;

  bahanList = bahanList.filter((b) => b.id !== bahanId);

  menuList.forEach((m) => {
    m.resep = m.resep.filter((r) => r.bahanId !== bahanId);
  });
  menuList = menuList.filter((m) => {
    if (m.resep.length === 0) {
      delete menuQty[m.id];
      return false;
    }
    return true;
  });

  showToast(`Bahan "${bahan.nama}" telah dihapus`, "success");
  renderAll();
}



let bahanAktifModal = null;

function bukaModalTambahStok(bahanId) {
  if (!requireAdmin()) return;
  bahanAktifModal = bahanId;
  const bahan = getBahan(bahanId);
  document.getElementById("modal-title").textContent = `Tambah Stok — ${bahan.nama}`;
  document.getElementById("modal-unit").textContent = bahan.unit;
  const input = document.getElementById("modal-input");
  input.value = "";
  document.getElementById("modal-overlay").classList.add("open");
  input.focus();
}

function tutupModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  bahanAktifModal = null;
}

function konfirmasiTambahStok() {
  if (!requireAdmin()) return;
  const input = document.getElementById("modal-input");
  const jumlah = parseFloat(input.value);

  if (!bahanAktifModal || isNaN(jumlah) || jumlah <= 0) {
    showToast("Masukkan jumlah yang valid", "error");
    return;
  }

  const bahan = getBahan(bahanAktifModal);
  bahan.stok += jumlah;
  showToast(`${bahan.nama} bertambah ${formatAngka(jumlah)} ${bahan.unit}`, "success");
  tutupModal();
  renderAll();
}



let menuAktifEdit = null;

function bukaModalMenu(menuId = null) {
  if (!requireAdmin()) return;
  if (bahanList.length === 0) {
    showToast("Tambahkan bahan terlebih dahulu di tab Status", "error");
    return;
  }
  const menu = menuId ? menuList.find((m) => m.id === menuId) : null;
  if (menuId && !menu) return;

  menuAktifEdit = menu ? menu.id : null;
  document.getElementById("modal-menu-title").textContent = menu ? `Ubah Menu — ${menu.nama}` : "Tambah Menu Baru";
  document.getElementById("modal-menu-confirm").textContent = menu ? "Simpan Perubahan" : "Simpan Menu";
  document.getElementById("menu-nama-input").value = menu ? menu.nama : "";
  document.getElementById("menu-deskripsi-input").value = menu ? menu.deskripsi : "";
  document.getElementById("menu-harga-input").value = menu && menu.harga > 0 ? menu.harga : "";

  gambarModal = menu && menu.gambar ? menu.gambar : "";
  renderPreviewGambar();
  document.getElementById("modal-menu-hapus").hidden = !menu;

  document.getElementById("resep-rows").innerHTML = "";
  if (menu) {
    menu.resep.forEach((r) => tambahBarisResep(r));
  } else {
    tambahBarisResep();
  }
  document.getElementById("modal-menu-overlay").classList.add("open");
  document.getElementById("menu-nama-input").focus();
}

function bukaModalTambahMenu() {
  bukaModalMenu(null);
}

function tutupModalMenu() {
  document.getElementById("modal-menu-overlay").classList.remove("open");
  menuAktifEdit = null;
  gambarModal = "";
}

function tambahBarisResep(data) {
  if (bahanList.length === 0) {
    showToast("Tambahkan bahan terlebih dahulu di tab Status", "error");
    return;
  }
  const container = document.getElementById("resep-rows");
  const options = bahanList.map((b) => `<option value="${b.id}">${b.nama}</option>`).join("");

  const row = document.createElement("div");
  row.className = "resep-row";
  row.innerHTML = `
    <select class="resep-bahan-select">${options}</select>
    <input type="number" class="resep-jumlah-input" min="0.1" step="0.1" placeholder="Jumlah" />
    <span class="resep-unit-label"></span>
    <button type="button" class="resep-row-remove" title="Hapus bahan">✕</button>
  `;
  container.appendChild(row);

  const select = row.querySelector(".resep-bahan-select");
  const unitLabel = row.querySelector(".resep-unit-label");

  // data terisi saat mode "Ubah Menu"
  if (data && data.bahanId && getBahan(data.bahanId)) {
    select.value = data.bahanId;
    row.querySelector(".resep-jumlah-input").value = data.jumlah;
  }
  unitLabel.textContent = getBahan(select.value).unit;

  select.addEventListener("change", () => {
    unitLabel.textContent = getBahan(select.value).unit;
  });

  row.querySelector(".resep-row-remove").addEventListener("click", () => {
    if (container.children.length > 1) {
      row.remove();
    } else {
      showToast("Resep minimal harus punya satu bahan", "error");
    }
  });
}

function simpanMenuBaru() {
  if (!requireAdmin()) return;
  const nama = document.getElementById("menu-nama-input").value.trim();
  const deskripsi = document.getElementById("menu-deskripsi-input").value.trim();
  const hargaRaw = document.getElementById("menu-harga-input").value.trim();
  const harga = hargaRaw === "" ? 0 : parseFloat(hargaRaw);

  if (!nama) {
    showToast("Nama menu tidak boleh kosong", "error");
    return;
  }
  if (isNaN(harga) || harga < 0) {
    showToast("Harga tidak valid", "error");
    return;
  }

  const rows = Array.from(document.querySelectorAll("#resep-rows .resep-row"));
  const resep = [];
  const idTerpakai = new Set();

  for (const row of rows) {
    const bahanId = row.querySelector(".resep-bahan-select").value;
    const jumlah = parseFloat(row.querySelector(".resep-jumlah-input").value);

    if (isNaN(jumlah) || jumlah <= 0) continue;

    if (idTerpakai.has(bahanId)) {
      showToast(`Bahan "${getBahan(bahanId).nama}" tidak boleh dobel dalam satu resep`, "error");
      return;
    }
    idTerpakai.add(bahanId);
    resep.push({ bahanId, jumlah });
  }

  if (resep.length === 0) {
    showToast("Tambahkan minimal satu bahan dengan jumlah yang valid", "error");
    return;
  }

  const menuLama = menuAktifEdit ? menuList.find((m) => m.id === menuAktifEdit) : null;

  if (menuLama) {
    menuLama.nama = nama;
    menuLama.deskripsi = deskripsi || "Menu racikan baru.";
    menuLama.harga = harga;
    menuLama.gambar = gambarModal;
    menuLama.resep = resep;
    tutupModalMenu();
    showToast(`Menu "${nama}" berhasil diperbarui`, "success");
  } else {
    const id = slugify(nama, menuList.map((m) => m.id));
    menuList.push({
      id,
      nama,
      deskripsi: deskripsi || "Menu racikan baru.",
      harga,
      gambar: gambarModal,
      resep,
    });
    menuQty[id] = 1;
    tutupModalMenu();
    showToast(`Menu "${nama}" berhasil ditambahkan`, "success");
  }

  renderAll();
}

function bukaModalTambahBahan() {
  if (!requireAdmin()) return;
  document.getElementById("bahan-nama-input").value = "";
  document.getElementById("bahan-unit-input").value = "ml";
  document.getElementById("bahan-stok-input").value = "";
  document.getElementById("modal-bahan-overlay").classList.add("open");
  document.getElementById("bahan-nama-input").focus();
}

function tutupModalBahan() {
  document.getElementById("modal-bahan-overlay").classList.remove("open");
}

function simpanBahanBaru() {
  if (!requireAdmin()) return;
  const nama = document.getElementById("bahan-nama-input").value.trim();
  const unit = document.getElementById("bahan-unit-input").value;
  const stok = parseFloat(document.getElementById("bahan-stok-input").value);

  if (!nama) {
    showToast("Nama bahan tidak boleh kosong", "error");
    return;
  }
  if (isNaN(stok) || stok <= 0) {
    showToast("Masukkan stok awal yang valid", "error");
    return;
  }

  const id = slugify(nama, bahanList.map((b) => b.id));
  bahanList.push({ id, nama, unit, awal: stok, stok });

  tutupModalBahan();
  showToast(`Bahan "${nama}" berhasil ditambahkan`, "success");
  renderAll();
}



function renderRiwayat() {
  const body = document.getElementById("riwayat-body");
  const emptyState = document.getElementById("riwayat-empty");
  body.innerHTML = "";

  // Monitoring tidak melihat pesanan yang dibatalkan
  const sumber = isAdmin() ? riwayatList : riwayatList.filter((t) => t.status !== "dibatalkan");

  if (sumber.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // Urutkan terbaru dulu, lalu kelompokkan per hari
  const urut = [...sumber].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  const ringkasan = {};
  urut.forEach((trx) => {
    const k = kunciHari(trx.waktu);
    if (!ringkasan[k]) ringkasan[k] = { selesai: 0, batal: 0, total: 0 };
    if (trx.status === "dibatalkan") {
      ringkasan[k].batal += 1;
    } else {
      ringkasan[k].selesai += 1;
      ringkasan[k].total += Number(trx.total) || 0;
    }
  });

  const kunciHariIni = kunciHari(new Date());
  let kunciTerakhir = null;

  urut.forEach((trx) => {
    const kunci = kunciHari(trx.waktu);
    if (kunci !== kunciTerakhir) {
      kunciTerakhir = kunci;
      const r = ringkasan[kunci];
      let info = `${r.selesai} transaksi`;
      if (r.total > 0) info += ` · ${formatRupiah(r.total)}`;
      if (r.batal > 0) info += ` · ${r.batal} dibatalkan`;

      const head = document.createElement("tr");
      head.className = "hari-row";
      head.innerHTML = `
        <td colspan="7">
          <div class="hari-head">
            <div class="hari-title">${formatHari(trx.waktu)}${
              kunci === kunciHariIni ? ' <span class="hari-badge">Hari ini</span>' : ""
            }</div>
            <div class="hari-right">
              <span class="hari-sum">${info}</span>
              ${r.selesai > 0 ? `<button type="button" class="btn btn-outline btn-small no-print" data-nota-hari="${kunci}">Cetak Nota</button>` : ""}
            </div>
          </div>
        </td>
      `;
      body.appendChild(head);
    }

    const batal = trx.status === "dibatalkan";
    const bahanHtml = trx.bahanTerpakai
      .map((b) => `<span class="used-item">${b.nama} -${formatAngka(Number(b.jumlah))}${b.unit}</span>`)
      .join("");
    const totalTeks = trx.harga > 0 ? formatRupiah(trx.total) : "-";

    const statusHtml = batal
      ? `<span class="badge tone-danger">Dibatalkan</span>${
          trx.waktuBatal ? `<div class="trx-note">${formatWaktu(new Date(trx.waktuBatal))}</div>` : ""
        }`
      : `<span class="badge tone-normal">Selesai</span>`;

    const aksiHtml = batal
      ? `<span class="trx-note">Stok dikembalikan</span>`
      : `<button class="btn btn-outline btn-small" data-nota-id="${trx.id}">Cetak Nota</button>
         <button class="btn btn-outline btn-small btn-danger-outline admin-only" data-batal-id="${trx.id}">Batalkan</button>`;


    const row = document.createElement("tr");
    if (batal) row.className = "trx-batal";
    row.innerHTML = `
      <td data-label="Waktu">${formatJam(trx.waktu)}</td>
      <td data-label="Menu">${trx.menuNama}</td>
      <td data-label="Bahan Terpakai">${bahanHtml}</td>
      <td data-label="Total" class="trx-total">${totalTeks}</td>
      <td data-label="Pembayaran">${esc(teksPembayaran(trx))}</td>
      <td data-label="Status">${statusHtml}</td>
      <td data-label="" class="trx-aksi no-print">${aksiHtml}</td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("button[data-batal-id]").forEach((btn) => {
    btn.addEventListener("click", () => batalkanPesanan(btn.dataset.batalId));
  });

  body.querySelectorAll("button[data-nota-id]").forEach((btn) => {
    btn.addEventListener("click", () => cetakNota([btn.dataset.notaId]));
  });

  body.querySelectorAll("button[data-nota-hari]").forEach((btn) => {
    btn.addEventListener("click", () => bukaModalNota(btn.dataset.notaHari));
  });
}

function batalkanPesanan(trxId) {
  if (!requireAdmin()) return;
  const trx = riwayatList.find((t) => t.id === trxId);
  if (!trx || trx.status === "dibatalkan") return;

  const yakin = confirm(`Batalkan pesanan "${trx.menuNama}"? Bahan yang terpakai akan dikembalikan ke stok.`);
  if (!yakin) return;

  const tidakAda = [];
  trx.bahanTerpakai.forEach((b) => {
    // pesanan lama belum menyimpan bahanId, jadi cocokkan lewat nama
    const bahan = (b.bahanId && getBahan(b.bahanId)) || bahanList.find((x) => x.nama === b.nama);
    if (bahan) {
      bahan.stok += Number(b.jumlah);
    } else {
      tidakAda.push(b.nama);
    }
  });

  trx.status = "dibatalkan";
  trx.waktuBatal = new Date();

  showToast(`Pesanan "${trx.menuNama}" dibatalkan, stok dikembalikan`, "success");
  if (tidakAda.length > 0) {
    showToast(`Bahan sudah dihapus dan tidak bisa dikembalikan: ${tidakAda.join(", ")}`, "error");
  }
  renderAll();
}

// ===== Cetak nota pembelian =====
function buatHtmlNota(daftar) {
  const urut = [...daftar].sort((x, y) => new Date(x.waktu) - new Date(y.waktu));
  const terakhir = urut[urut.length - 1];
  const noNota = "#" + String(urut[0].id).replace(/^trx-/, "").slice(-8).toUpperCase();

  const adaHargaApaPun = urut.some((t) => t.harga > 0);
  const totalSemua = urut.reduce((sum, t) => sum + (t.harga > 0 ? Number(t.total) || 0 : 0), 0);

  const itemHtml = urut
    .map((trx) => {
      const qty = trx.qty || 1;
      const namaMenu = String(trx.menuNama).replace(/\s×\s\d+$/, "");
      const adaHarga = trx.harga > 0;
      return `
      <div class="nota-item">
        <div class="nota-item-name">${namaMenu}</div>
        <div class="nota-row">
          <span>${qty} × ${adaHarga ? formatRupiah(trx.harga) : "-"}</span>
          <span>${adaHarga ? formatRupiah(trx.total) : "-"}</span>
        </div>
      </div>`;
    })
    .join("");

  const metodeSet = new Set(urut.map((t) => t.metode).filter(Boolean));
  let metaBayarHtml = "";
  if (metodeSet.size === 1) {
    const m = [...metodeSet][0];
    metaBayarHtml = `<div><span>Pembayaran</span><span>${esc(METODE_LABEL[m] || m)}</span></div>`;
    if (m === "kasbon") {
      const p = urut.find((t) => t.pelanggan);
      if (p) metaBayarHtml += `<div><span>Pelanggan</span><span>${esc(p.pelanggan)}</span></div>`;
    }
  }

  return `
    <div class="nota">
      <div class="nota-head">
        <h2>Saung Inspirasi</h2>
        <p>Nota Pembelian</p>
      </div>
      <div class="nota-meta">
        <div><span>No. Nota</span><span>${noNota}</span></div>
        <div><span>Waktu</span><span>${formatWaktu(new Date(terakhir.waktu))}</span></div>
        ${metaBayarHtml}
      </div>
      <hr class="nota-line" />
      ${itemHtml}
      <hr class="nota-line" />
      <div class="nota-row nota-total">
        <span>TOTAL</span>
        <span>${adaHargaApaPun ? formatRupiah(totalSemua) : "-"}</span>
      </div>
      <hr class="nota-line" />
      <p class="nota-foot">Terima kasih atas kunjungan Anda</p>
    </div>
  `;
}

// Cetak satu nota yang berisi satu atau beberapa transaksi (array id)
function cetakNota(trxIds) {
  const ids = Array.isArray(trxIds) ? trxIds : [trxIds];
  const daftar = ids
    .map((id) => riwayatList.find((t) => t.id === id))
    .filter(Boolean);
  if (daftar.length === 0) return;

  document.getElementById("nota-cetak").innerHTML = buatHtmlNota(daftar);
  document.body.classList.add("mode-nota");
  window.print();
}

// ===== Pilih nota yang dicetak per hari =====
let hariAktifNota = null;

function transaksiNotaHari(kunci) {
  return riwayatList
    .filter((t) => t.status !== "dibatalkan" && kunciHari(t.waktu) === kunci)
    .sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
}

function bukaModalNota(kunci) {
  const daftar = transaksiNotaHari(kunci);
  if (daftar.length === 0) {
    showToast("Tidak ada transaksi untuk dicetak pada hari ini", "error");
    return;
  }
  hariAktifNota = kunci;

  document.getElementById("modal-nota-judul").textContent = `Cetak Nota — ${formatHari(daftar[0].waktu)}`;
  document.getElementById("nota-list").innerHTML = daftar
    .map((t) => {
      const total = t.harga > 0 ? formatRupiah(t.total) : "-";
      return `
      <label class="check-row">
        <input type="checkbox" class="nota-check" value="${t.id}" checked />
        <span class="check-name">${t.menuNama}<br /><small class="check-info">${formatJam(t.waktu)}</small></span>
        <span class="check-info">${total}</span>
      </label>`;
    })
    .join("");
  document.getElementById("nota-semua").checked = true;
  document.getElementById("modal-nota-overlay").classList.add("open");
}

function tutupModalNota() {
  document.getElementById("modal-nota-overlay").classList.remove("open");
  hariAktifNota = null;
}

function konfirmasiCetakNota() {
  const terpilih = Array.from(document.querySelectorAll("#nota-list .nota-check:checked")).map((c) => c.value);
  if (terpilih.length === 0) {
    showToast("Pilih minimal satu minuman yang akan dicetak notanya", "error");
    return;
  }
  tutupModalNota();
  cetakNota(terpilih);
}

// ===== Ekspor riwayat ke Excel =====
function eksporExcel() {
  if (!requireAdmin()) return;

  // Pesanan yang dibatalkan tidak dihitung sebagai penjualan
  const aktif = riwayatList.filter((t) => t.status !== "dibatalkan");
  if (aktif.length === 0) {
    showToast("Tidak ada transaksi untuk diekspor", "error");
    return;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const teksWaktu = (v) => {
    const d = new Date(v);
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Satu tabel berisi seluruh riwayat (terbaru dulu)
  const header = ["Waktu", "Item", "Harga", "Jumlah", "Pembayaran"];
  const baris = [...aktif]
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
    .map((t) => [
      teksWaktu(t.waktu),
      String(t.menuNama).replace(/\s×\s\d+$/, ""),
      Number(t.harga) || 0,
      Number(t.qty) || 1,
      teksPembayaran(t),
    ]);

  const stempel = kunciHari(new Date());

  if (typeof XLSX === "undefined") {
    // Cadangan bila pustaka Excel gagal dimuat (mis. offline): CSV yang bisa dibuka di Excel
    const esc2 = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "\ufeff" + [header, ...baris].map((r) => r.map(esc2).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Riwayat-Saung-Inspirasi-${stempel}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("Pustaka Excel tidak termuat, riwayat diekspor sebagai CSV", "error");
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...baris]);
  ws["!cols"] = [{ wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 24 }];
  for (let i = 2; i <= baris.length + 1; i++) {
    const cell = ws["C" + i];
    if (cell) cell.z = "#,##0";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat");
  XLSX.writeFile(wb, `Riwayat-Saung-Inspirasi-${stempel}.xlsx`);
  showToast("Riwayat berhasil diekspor ke Excel", "success");
}

function bersihkanRiwayat() {
  if (!requireAdmin()) return;
  if (riwayatList.length === 0) {
    showToast("Riwayat sudah kosong", "error");
    return;
  }

  const yakin = confirm("Bersihkan seluruh riwayat transaksi? Tindakan ini tidak bisa dibatalkan.");
  if (!yakin) return;

  riwayatList = [];

  showToast("Riwayat transaksi telah dibersihkan", "success");
  renderAll();
}



// Hapus sisa data lama (session/local storage & cache data dari database) agar tidak tampil di sesi berikutnya.
async function bersihkanCacheData() {
  try { sessionStorage.clear(); } catch (e) {}
  try {
    Object.keys(localStorage)
      .filter((k) => k.indexOf("saung") === 0)
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map(async (n) => {
        const c = await caches.open(n);
        const reqs = await c.keys();
        await Promise.all(reqs
          .filter((r) => {
            const host = new URL(r.url).hostname;
            return host === "script.google.com" || host.endsWith("googleusercontent.com");
          })
          .map((r) => c.delete(r)));
      }));
    }
  } catch (e) {}
}

function initAuth() {
  const badge = document.getElementById("role-badge");
  badge.textContent = isAdmin() ? "Admin" : "Monitoring (hanya lihat)";
  if (isAdmin()) badge.classList.add("is-admin");

  document.getElementById("btn-logout").addEventListener("click", async () => {
    keranjang = [];
    await bersihkanCacheData();
    location.replace("login.html");
  });
}



function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  function aktifkan(btn) {
    tabButtons.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    panels.forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById(btn.dataset.tab).classList.add("active");

    // Tab monitoring "Dashboard" (stok) dan "Menu" memakai panel Dashboard dengan sub-panel berbeda
    if (btn.dataset.sub) {
      document.querySelectorAll(".subpanel").forEach((p) => p.classList.toggle("active", p.id === btn.dataset.sub));
    }
  }

  tabButtons.forEach((btn) => btn.addEventListener("click", () => aktifkan(btn)));

  // Monitoring: mulai dari "Dashboard" yang menampilkan stok bahan
  if (!isAdmin()) aktifkan(document.querySelector('.tab-btn.monitor-only[data-sub="sub-stok"]'));
}

function initSubtabs() {
  const buttons = document.querySelectorAll(".subnav-btn");
  const panels = document.querySelectorAll(".subpanel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.dataset.subtab).classList.add("active");
    });
  });
}

function initPrint() {
  window.addEventListener("afterprint", () => document.body.classList.remove("mode-nota"));
  document.getElementById("btn-print").addEventListener("click", () => {
    document.body.classList.remove("mode-nota");
    document.getElementById("print-date").textContent =
      "Dicetak pada: " + formatWaktu(new Date());
    window.print();
  });
}



function initModal() {
  document.getElementById("modal-cancel").addEventListener("click", tutupModal);
  document.getElementById("modal-confirm").addEventListener("click", konfirmasiTambahStok);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") tutupModal();
  });
  document.getElementById("modal-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") konfirmasiTambahStok();
  });

  document.getElementById("btn-tambah-menu").addEventListener("click", bukaModalTambahMenu);
  document.getElementById("btn-tambah-baris-resep").addEventListener("click", () => tambahBarisResep());
  document.getElementById("modal-menu-cancel").addEventListener("click", tutupModalMenu);
  document.getElementById("modal-menu-confirm").addEventListener("click", simpanMenuBaru);
  document.getElementById("modal-menu-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-menu-overlay") tutupModalMenu();
  });

  document.getElementById("modal-resep-close").addEventListener("click", tutupModalResep);
  document.getElementById("modal-resep-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-resep-overlay") tutupModalResep();
  });

  document.getElementById("btn-tambah-bahan").addEventListener("click", bukaModalTambahBahan);
  document.getElementById("btn-reset-stok").addEventListener("click", resetStok);
  document.getElementById("btn-bersihkan-riwayat").addEventListener("click", bersihkanRiwayat);
  document.getElementById("btn-export-excel").addEventListener("click", eksporExcel);

  document.getElementById("modal-reset-cancel").addEventListener("click", tutupModalReset);
  document.getElementById("modal-reset-confirm").addEventListener("click", konfirmasiReset);
  document.getElementById("modal-reset-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-reset-overlay") tutupModalReset();
  });
  document.getElementById("reset-semua").addEventListener("change", (e) => {
    document.querySelectorAll("#reset-list .reset-check").forEach((c) => (c.checked = e.target.checked));
  });
  document.getElementById("reset-list").addEventListener("change", () => {
    const semua = document.querySelectorAll("#reset-list .reset-check");
    const aktif = document.querySelectorAll("#reset-list .reset-check:checked");
    document.getElementById("reset-semua").checked = semua.length > 0 && semua.length === aktif.length;
  });
  document.getElementById("modal-nota-cancel").addEventListener("click", tutupModalNota);
  document.getElementById("modal-nota-confirm").addEventListener("click", konfirmasiCetakNota);
  document.getElementById("modal-nota-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-nota-overlay") tutupModalNota();
  });
  document.getElementById("nota-semua").addEventListener("change", (e) => {
    document.querySelectorAll("#nota-list .nota-check").forEach((c) => (c.checked = e.target.checked));
  });
  document.getElementById("nota-list").addEventListener("change", () => {
    const semua = document.querySelectorAll("#nota-list .nota-check");
    const aktif = document.querySelectorAll("#nota-list .nota-check:checked");
    document.getElementById("nota-semua").checked = semua.length > 0 && semua.length === aktif.length;
  });
  document.getElementById("modal-bahan-cancel").addEventListener("click", tutupModalBahan);
  document.getElementById("modal-bahan-confirm").addEventListener("click", simpanBahanBaru);
  document.getElementById("modal-bahan-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-bahan-overlay") tutupModalBahan();
  });
}



function renderSemua() {
  renderStokGrid();
  renderMenuGrid();
  renderKeranjang();
  renderProses();
  renderStatusList();
  renderRiwayat();
}

function renderAll() {
  renderSemua();
  simpanProsesLokal();
  jadwalSimpan();
}

// ===== Database spreadsheet (Google Sheets via Apps Script) =====
// Isi dengan URL aplikasi web hasil Deploy Apps Script (berakhiran /exec)
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwGbKuKQNH4Rg1kn8svWbhbSyC0wQBhSz0EAFq0V0wzQri9TzfIlEIMruc_Kcd-NweN/exec";
// Harus sama dengan KUNCI di Code.gs
const SHEET_KEY = "saung-inspirasi-2026";

let siapSimpan = false;
let timerSimpan = null;
let sedangSimpan = false;
let simpanUlang = false;

function sheetAktif() {
  return SHEET_URL && !SHEET_URL.startsWith("PASTE");
}

function terapkanData(d) {
  bahanList = d.bahan;
  menuList = d.menu;
  // Daftar pesanan diproses: spreadsheet jadi acuan utama (sinkron antar perangkat).
  // Pilihan metode/nama kasbon yang baru diubah dan belum sempat tersimpan diambil dari data lokal.
  // Bila spreadsheet belum punya sheet "Proses" (field tidak ada), pakai data lokal saja.
  const lokal = isAdmin() ? muatProsesLokal() : null;
  if (Array.isArray(d.proses)) {
    pesananProses = d.proses.map((p) => {
      const base = { ...p, waktu: new Date(p.waktu) };
      const l = lokal && lokal.find((x) => x.id === p.id);
      return l ? { ...base, metode: l.metode || base.metode, pelanggan: l.pelanggan != null ? l.pelanggan : base.pelanggan } : base;
    });
  } else {
    pesananProses = lokal || [];
  }
  riwayatList = d.riwayat.map((t) => ({ ...t, waktu: new Date(t.waktu), waktuBatal: t.waktuBatal ? new Date(t.waktuBatal) : null }));
  Object.keys(menuQty).forEach((k) => delete menuQty[k]);
  menuList.forEach((m) => (menuQty[m.id] = 1));
}

function dataAwal() {
  return {
    bahan: JSON.parse(JSON.stringify(DEFAULT_BAHAN)),
    menu: JSON.parse(JSON.stringify(DEFAULT_MENU)),
    riwayat: [],
  };
}

async function ambilDariSpreadsheet() {
  // Parameter unik + no-store agar tidak pernah memakai respons dari cache
  const sep = SHEET_URL.indexOf("?") === -1 ? "?" : "&";
  const res = await fetch(`${SHEET_URL}${sep}_=${Date.now()}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Gagal membaca");
  return json.data;
}

// Memuat data terbaru lalu merender. Melempar error bila gagal (tidak merender data lama/bawaan).
async function muatDariSpreadsheet() {
  if (!sheetAktif()) {
    terapkanData(dataAwal());
    renderSemua();
    showToast("URL spreadsheet belum diisi, data hanya tersimpan sementara", "error");
    return;
  }

  const data = await ambilDariSpreadsheet();

  if (data.kosong) {
    // Pertama kali dipakai: isi spreadsheet dengan data awal
    terapkanData(dataAwal());
    siapSimpan = true;
    renderSemua();
    if (isAdmin()) await simpanSekarang();
    return;
  }
  terapkanData(data);
  siapSimpan = true;
  renderSemua();
}

// ===== Loader "Mohon tunggu sebentar" =====
function setLoader(state) {
  const el = document.getElementById("app-loader");
  el.classList.remove("done");
  el.classList.toggle("error", state === "error");
  document.getElementById("loader-text").textContent =
    state === "error" ? "Gagal memuat data terbaru" : "Mohon tunggu sebentar";
  document.getElementById("loader-sub").textContent =
    state === "error" ? "Periksa koneksi internet Anda, lalu coba lagi." : "Mengambil data terbaru…";
  document.getElementById("loader-retry").hidden = state !== "error";
}

function sembunyiLoader() {
  document.getElementById("app-loader").classList.add("done");
}

let pollingJalan = false;
let pollingAktif = false;

function mulaiPolling() {
  if (pollingAktif) return;
  pollingAktif = true;
  // Mode monitoring: segarkan data dari spreadsheet tiap 15 detik
  setInterval(async () => {
    if (pollingJalan) return;
    pollingJalan = true;
    try {
      await muatDariSpreadsheet();
    } catch (err) {
      console.error(err);
    } finally {
      pollingJalan = false;
    }
  }, 15000);
}

async function muatAwal() {
  setLoader("loading");
  try {
    await muatDariSpreadsheet();
    sembunyiLoader();
    if (!isAdmin() && sheetAktif()) mulaiPolling();
  } catch (err) {
    console.error(err);
    setLoader("error");
  }
}

function jadwalSimpan() {
  if (!sheetAktif() || !siapSimpan || !isAdmin()) return;
  clearTimeout(timerSimpan);
  timerSimpan = setTimeout(simpanSekarang, 600);
}

async function simpanSekarang() {
  if (sedangSimpan) {
    simpanUlang = true;
    return;
  }
  sedangSimpan = true;
  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kunci: SHEET_KEY, data: { bahan: bahanList, menu: menuList, riwayat: riwayatList, proses: pesananProses } }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Gagal menyimpan");
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan ke spreadsheet", "error");
  } finally {
    sedangSimpan = false;
    if (simpanUlang) {
      simpanUlang = false;
      simpanSekarang();
    }
  }
}




document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initTabs();
  initSubtabs();
  initPrint();
  initModal();
  initCart();
  initProses();
  initMenuKartu();
  initGambarMenu();
  document.getElementById("loader-retry").addEventListener("click", muatAwal);

  // Jangan render apa pun sebelum data terbaru dari database selesai dimuat.
  muatAwal();
});

// Halaman dipulihkan dari cache browser (tombol Kembali): muat ulang agar tidak menampilkan data lama.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
