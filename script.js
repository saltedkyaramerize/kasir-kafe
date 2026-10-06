const BIN_ID = "6ac30946ac6210605a13e869"; 
const API_KEY = "$2a$10$/Wab0N9YUFAb/3ZGVwMHiOVsiXzU2IbLpFXj839OwQiIRXsD.bMiW"; 

let bahanList = [
  { id: "susu",    nama: "Susu UHT",           unit: "ml", awal: 1000, stok: 1000 },
  { id: "kopi",    nama: "Biji Kopi",          unit: "g",  awal: 1000, stok: 1000 },
  { id: "gula",    nama: "Gula Aren Cair",     unit: "ml", awal: 1000, stok: 1000 },
  { id: "creamer", nama: "Non-Dairy Creamer",  unit: "g",  awal: 1000, stok: 1000 },
];

let menuList = [
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

let riwayatList = []; 
const menuQty = {}; 
menuList.forEach((m) => (menuQty[m.id] = 1));



const ROLE = sessionStorage.getItem("role") === "admin" ? "admin" : "monitor";

function isAdmin() {
  return ROLE === "admin";
}

// Pengaman tambahan: mode monitoring tidak boleh mengubah data
function requireAdmin() {
  if (isAdmin()) return true;
  showToast("Mode monitoring hanya bisa melihat data", "error");
  return false;
}

function simpanKeCloud() {
  if (!isAdmin()) return; // monitoring tidak pernah menulis data
  if (BIN_ID === "MASUKKAN_BIN_ID_ANDA_DISINI") return; // Jangan kirim kalau belum diatur
  
  const dataCloud = {
    bahanList,
    menuList,
    riwayatList
  };

  fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY
    },
    body: JSON.stringify(dataCloud)
  }).catch(err => console.error("Gagal simpan online:", err));
}

function muatDariCloud(callback) {
  if (BIN_ID === "MASUKKAN_BIN_ID_ANDA_DISINI") {
    if (callback) callback();
    return;
  }

  fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: {
      "X-Master-Key": API_KEY
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data && data.record) {
      if (data.record.bahanList) bahanList = data.record.bahanList;
      if (data.record.menuList) {
        menuList = data.record.menuList;
        menuList.forEach((m) => {
          if (!menuQty[m.id]) menuQty[m.id] = 1;
        });
      }
      if (data.record.riwayatList) {
        riwayatList = data.record.riwayatList.map(r => ({
          ...r,
          id: r.id || "trx-" + new Date(r.waktu).getTime(),
          status: r.status || "selesai",
          waktu: new Date(r.waktu),
          waktuBatal: r.waktuBatal ? new Date(r.waktuBatal) : null
        }));
      }
    }
    if (callback) callback();
  })
  .catch(err => {
    console.error("Gagal memuat dari online:", err);
    if (callback) callback();
  });
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

function renderMenuGrid() {
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
    const bisaDibuat = bisaDibuatMenu(menu, qty);

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
          ${bisaDibuat ? "Buat Minuman" : "Stok Tidak Cukup"}
        </button>
      </div>
    `;
    grid.appendChild(row);
  });

  grid.querySelectorAll("button[data-menu-id]:not([data-qty-action])").forEach((btn) => {
    btn.addEventListener("click", () => buatMinuman(btn.dataset.menuId));
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
  simpanKeCloud();
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
  const bisaDibuat = bisaDibuatMenu(menu, qty);
  btn.disabled = !bisaDibuat;
  btn.textContent = bisaDibuat ? "Buat Minuman" : "Stok Tidak Cukup";
}



function buatMinuman(menuId) {
  if (!requireAdmin()) return;
  const menu = menuList.find((m) => m.id === menuId);
  if (!menu) return;

  const qty = menuQty[menuId] || 1;
  const kurang = menu.resep.filter((r) => {
    const bahan = getBahan(r.bahanId);
    return !bahan || bahan.stok < r.jumlah * qty;
  });

  if (kurang.length > 0) {
    const namaKurang = kurang.map((r) => (getBahan(r.bahanId) || { nama: r.bahanId }).nama).join(", ");
    showToast(`Stok tidak cukup untuk: ${namaKurang}`, "error");
    return;
  }

  const bahanTerpakai = menu.resep.map((r) => {
    const bahan = getBahan(r.bahanId);
    const totalPakai = r.jumlah * qty;
    bahan.stok -= totalPakai;
    return { bahanId: bahan.id, nama: bahan.nama, jumlah: totalPakai, unit: bahan.unit };
  });

  const harga = menu.harga || 0;
  riwayatList.unshift({
    id: "trx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    waktu: new Date(),
    menuNama: qty > 1 ? `${menu.nama} × ${qty}` : menu.nama,
    qty,
    harga,
    total: harga * qty,
    bahanTerpakai,
    status: "selesai",
    waktuBatal: null,
  });

  showToast(`${menu.nama} (${qty} porsi) berhasil dibuat`, "success");
  simpanKeCloud();
  renderAll();
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
  simpanKeCloud();
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
  simpanKeCloud();
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
  simpanKeCloud();
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
      resep,
    });
    menuQty[id] = 1;
    tutupModalMenu();
    showToast(`Menu "${nama}" berhasil ditambahkan`, "success");
  }

  simpanKeCloud();
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
  simpanKeCloud();
  renderAll();
}



function renderRiwayat() {
  const body = document.getElementById("riwayat-body");
  const emptyState = document.getElementById("riwayat-empty");
  body.innerHTML = "";

  if (riwayatList.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  riwayatList.forEach((trx) => {
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
      <td data-label="Waktu">${formatWaktu(new Date(trx.waktu))}</td>
      <td data-label="Menu">${trx.menuNama}</td>
      <td data-label="Bahan Terpakai">${bahanHtml}</td>
      <td data-label="Total" class="trx-total">${totalTeks}</td>
      <td data-label="Status">${statusHtml}</td>
      <td data-label="" class="trx-aksi no-print">${aksiHtml}</td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("button[data-batal-id]").forEach((btn) => {
    btn.addEventListener("click", () => batalkanPesanan(btn.dataset.batalId));
  });

  body.querySelectorAll("button[data-nota-id]").forEach((btn) => {
    btn.addEventListener("click", () => cetakNota(btn.dataset.notaId));
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
  simpanKeCloud();
  renderAll();
}

// ===== Cetak nota pembelian =====
function cetakNota(trxId) {
  const trx = riwayatList.find((t) => t.id === trxId);
  if (!trx) return;

  const qty = trx.qty || 1;
  const namaMenu = String(trx.menuNama).replace(/\s×\s\d+$/, "");
  const adaHarga = trx.harga > 0;
  const noNota = "#" + String(trx.id).replace(/^trx-/, "").slice(-8).toUpperCase();

  document.getElementById("nota-cetak").innerHTML = `
    <div class="nota">
      <div class="nota-head">
        <h2>Saung Inspirasi</h2>
        <p>Nota Pembelian</p>
      </div>
      <div class="nota-meta">
        <div><span>No. Nota</span><span>${noNota}</span></div>
        <div><span>Waktu</span><span>${formatWaktu(new Date(trx.waktu))}</span></div>
      </div>
      <hr class="nota-line" />
      <div class="nota-item">
        <div class="nota-item-name">${namaMenu}</div>
        <div class="nota-row">
          <span>${qty} × ${adaHarga ? formatRupiah(trx.harga) : "-"}</span>
          <span>${adaHarga ? formatRupiah(trx.total) : "-"}</span>
        </div>
      </div>
      <hr class="nota-line" />
      <div class="nota-row nota-total">
        <span>TOTAL</span>
        <span>${adaHarga ? formatRupiah(trx.total) : "-"}</span>
      </div>
      <hr class="nota-line" />
      <p class="nota-foot">Terima kasih atas kunjungan Anda</p>
    </div>
  `;

  document.body.classList.add("mode-nota");
  window.print();
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
  simpanKeCloud();
  renderAll();
}



function initAuth() {
  const badge = document.getElementById("role-badge");
  badge.textContent = isAdmin() ? "Admin" : "Monitoring (hanya lihat)";
  if (isAdmin()) badge.classList.add("is-admin");

  document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("role");
    location.replace("login.html");
  });
}



function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.dataset.tab).classList.add("active");
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

  document.getElementById("btn-tambah-bahan").addEventListener("click", bukaModalTambahBahan);
  document.getElementById("btn-reset-stok").addEventListener("click", resetStok);
  document.getElementById("btn-bersihkan-riwayat").addEventListener("click", bersihkanRiwayat);

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
  document.getElementById("modal-bahan-cancel").addEventListener("click", tutupModalBahan);
  document.getElementById("modal-bahan-confirm").addEventListener("click", simpanBahanBaru);
  document.getElementById("modal-bahan-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-bahan-overlay") tutupModalBahan();
  });
}



function renderAll() {
  renderStokGrid();
  renderMenuGrid();
  renderStatusList();
  renderRiwayat();
}



document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initTabs();
  initPrint();
  initModal();
  
  
  muatDariCloud(() => {
    renderAll();
  });

  
  setInterval(() => {
    muatDariCloud(() => {
      renderAll();
    });
  }, 5000);
});