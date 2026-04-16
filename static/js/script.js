let currentSchedule = null;
let downloadUrl = null;
let downloadUrls = {};
let rooms = {};
let dosens = {};
let courses = {};

function $(id) {
  return document.getElementById(id);
}

function show(id) {
  $(id).classList.remove("hidden");
}

function hide(id) {
  $(id).classList.add("hidden");
}

// ===== STATE TRACKING =====
let _editingRoomId = null;
let _editingDosenId = null;
let _editingCourseName = null;
let _pendingDeleteFn = null;

// ===== DELETE CONFIRM MODAL =====
function openDeleteConfirm(message, onConfirm) {
  $("deleteConfirmText").textContent = message;
  $("deleteConfirmBtn").onclick = () => {
    onConfirm();
    closeDeleteConfirm();
  };
  show("deleteConfirmModal");
}
function closeDeleteConfirm() {
  hide("deleteConfirmModal");
  _pendingDeleteFn = null;
}

// ===== ENHANCED VALIDATION FUNCTIONS =====
function validateRoomId(id) {
  const errors = [];

  if (!id || id.trim() === "") {
    errors.push("ID Ruangan tidak boleh kosong");
    return errors;
  }

  id = id.trim().toUpperCase();

  if (id.length < 2 || id.length > 10) {
    errors.push("ID Ruangan harus 2-10 karakter");
  }

  if (!/^[A-Z0-9]+$/.test(id)) {
    errors.push("ID Ruangan hanya boleh huruf kapital dan angka");
  }

  if (!_editingRoomId) {
    const existing = Object.keys(rooms).find(
      (r) => r.toUpperCase() === id && r !== id,
    );
    if (existing) {
      errors.push(`Ruangan dengan ID mirip sudah ada: ${existing}`);
    }
  }

  return errors;
}

function validateRoomCapacity(capacity) {
  const errors = [];

  if (capacity === null || capacity === undefined || capacity === "") {
    errors.push("Kapasitas tidak boleh kosong");
    return errors;
  }

  const num = Number(capacity);

  if (isNaN(num)) {
    errors.push("Kapasitas harus angka");
  } else if (!Number.isInteger(num)) {
    errors.push("Kapasitas harus angka bulat");
  } else if (num < 20) {
    errors.push("Kapasitas minimal 20 orang");
  } else if (num > 500) {
    errors.push("Kapasitas maksimal 500 orang");
  }

  return errors;
}

function validateDosenId(id) {
  const errors = [];

  if (!id || id.trim() === "") {
    errors.push("ID Dosen tidak boleh kosong");
    return errors;
  }

  id = id.trim().toUpperCase();

  if (id.length < 2 || id.length > 10) {
    errors.push("ID Dosen harus 2-10 karakter");
  }

  if (!/^[A-Z0-9]+$/.test(id)) {
    errors.push("ID Dosen hanya boleh huruf kapital dan angka");
  }

  if (!_editingDosenId) {
    const existing = Object.keys(dosens).find(
      (d) => d.toUpperCase() === id && d !== id,
    );
    if (existing) {
      errors.push(`Dosen dengan ID mirip sudah ada: ${existing}`);
    }
  }

  return errors;
}

function validateDosenName(name) {
  const errors = [];

  if (!name || name.trim() === "") {
    errors.push("Nama Dosen tidak boleh kosong");
  } else if (name.trim().length < 3) {
    errors.push("Nama Dosen minimal 3 karakter");
  } else if (name.trim().length > 100) {
    errors.push("Nama Dosen maksimal 100 karakter");
  }

  return errors;
}

function validateAvailableDays(days) {
  const errors = [];

  if (!days || days.length === 0) {
    errors.push("Pilih minimal 1 hari mengajar");
  }

  return errors;
}

function validateCourseName(name) {
  const errors = [];

  if (!name || name.trim() === "") {
    errors.push("Nama Mata Kuliah tidak boleh kosong");
    return errors;
  }

  name = name.trim().toUpperCase();

  if (name.length < 3) {
    errors.push("Nama Mata Kuliah minimal 3 karakter");
  }

  if (name.length > 50) {
    errors.push("Nama Mata Kuliah maksimal 50 karakter");
  }

  if (!/^[A-Z0-9_]+$/.test(name)) {
    errors.push(
      "Nama Mata Kuliah hanya boleh huruf kapital, angka, dan underscore",
    );
  }

  if (!_editingCourseName) {
    if (courses[name]) {
      errors.push(`Mata Kuliah "${name}" sudah ada`);
    }
  }

  return errors;
}

function validateCourseSemester(sem) {
  const errors = [];

  const num = parseInt(sem);
  if (isNaN(num) || num < 1 || num > 8) {
    errors.push("Semester harus 1-8");
  }

  return errors;
}

function validateCourseCapacity(capacity) {
  const errors = [];

  if (capacity === null || capacity === undefined || capacity === "") {
    errors.push("Kapasitas tidak boleh kosong");
    return errors;
  }

  const num = Number(capacity);

  if (isNaN(num)) {
    errors.push("Kapasitas harus angka");
  } else if (!Number.isInteger(num)) {
    errors.push("Kapasitas harus angka bulat");
  } else if (num < 20) {
    errors.push("Kapasitas minimal 20 orang");
  } else if (num > 150) {
    errors.push("Kapasitas maksimal 150 orang");
  }

  return errors;
}

function validateCourseJam(jam) {
  const errors = [];

  if (jam === null || jam === undefined || jam === "") {
    errors.push("Durasi tidak boleh kosong");
    return errors;
  }

  const num = Number(jam);

  if (isNaN(num)) {
    errors.push("Durasi harus angka");
  } else if (!Number.isInteger(num)) {
    errors.push("Durasi harus angka bulat");
  } else if (num < 1) {
    errors.push("Durasi minimal 1 jam");
  } else if (num > 6) {
    errors.push("Durasi maksimal 6 jam");
  }

  return errors;
}

// ===== ENHANCED SHOW NOTIFICATION WITH ERROR DETAILS =====
function showEnhancedNotification(message, type = "info", details = null) {
  const notification = document.createElement("div");

  let bgColor = "bg-blue-500";
  let icon = "fas fa-info-circle";

  if (type === "success") {
    bgColor = "bg-green-500";
    icon = "fas fa-check-circle";
  } else if (type === "error") {
    bgColor = "bg-red-500";
    icon = "fas fa-exclamation-circle";
  } else if (type === "warning") {
    bgColor = "bg-yellow-500";
    icon = "fas fa-exclamation-triangle";
  }

  let detailsHtml = "";
  if (details) {
    if (Array.isArray(details)) {
      detailsHtml =
        '<div class="text-xs mt-2 border-t border-white border-opacity-30 pt-2">' +
        details.map((d) => `<div>• ${d}</div>`).join("") +
        "</div>";
    } else if (typeof details === "object") {
      detailsHtml =
        '<div class="text-xs mt-2 border-t border-white border-opacity-30 pt-2">' +
        Object.entries(details)
          .map(([k, v]) => `<div>${k}: ${v}</div>`)
          .join("") +
        "</div>";
    }
  }

  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white font-semibold ${bgColor} shadow-lg flex items-start gap-2 z-50 max-w-md`;
  notification.innerHTML = `
        <i class="${icon} mt-1"></i>
        <div class="flex-1">
            <div>${message}</div>
            ${detailsHtml}
        </div>
        <button onclick="this.parentElement.remove()" class="ml-2 text-white opacity-70 hover:opacity-100">
            <i class="fas fa-times"></i>
        </button>
    `;

  document.body.appendChild(notification);

  if (type !== "error") {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Override original showNotification
function showNotification(message, type = "info") {
  showEnhancedNotification(message, type);
}

// ===== ROOM FUNCTIONS (CRUD) =====
function openRoomModal(editId = null) {
  _editingRoomId = editId;

  if (editId) {
    const data = rooms[editId];
    $("roomModalTitle").innerHTML =
      `<i class="fas fa-edit text-yellow-400"></i> Edit Ruangan`;
    $("roomSaveBtnText").textContent = "Simpan Perubahan";
    $("roomSaveBtn").className =
      "flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";
    $("roomId").value = editId;
    $("roomId").disabled = true;
    $("roomId").classList.add("opacity-50", "cursor-not-allowed");
    $("roomCapacity").value = data.kapasitas;
    showRoomCapacityPreview(data.kapasitas);
  } else {
    $("roomModalTitle").innerHTML =
      `<i class="fas fa-door-open text-blue-400"></i> Tambah Ruangan`;
    $("roomSaveBtnText").textContent = "Simpan";
    $("roomSaveBtn").className =
      "flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";
    $("roomId").value = "";
    $("roomId").disabled = false;
    $("roomId").classList.remove("opacity-50", "cursor-not-allowed");
    $("roomCapacity").value = "";
    hide("roomCapacityPreview");
  }

  show("roomModal");
  setTimeout(() => {
    if (!editId) $("roomId").focus();
    else $("roomCapacity").focus();
  }, 50);
}

function showRoomCapacityPreview(val) {
  const num = parseInt(val);
  if (!isNaN(num) && num >= 20) {
    $("roomCapacityPreviewText").textContent = `Kapasitas: ${num} orang`;
    show("roomCapacityPreview");
  } else {
    hide("roomCapacityPreview");
  }
}

function closeRoomModal() {
  hide("roomModal");
  _editingRoomId = null;
  document.activeElement && document.activeElement.blur();
}

async function saveRoom() {
  const id = $("roomId").value.trim().toUpperCase();
  const capacity = $("roomCapacity").value;

  const idErrors = validateRoomId(id);
  const capErrors = validateRoomCapacity(capacity);
  const allErrors = [...idErrors, ...capErrors];

  if (allErrors.length > 0) {
    showEnhancedNotification("Validasi gagal", "error", allErrors);
    return;
  }

  const capNum = parseInt(capacity);

  try {
    if (_editingRoomId) {
      // ✅ Update ke MongoDB via API
      const res = await fetch("/api/rooms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: _editingRoomId, capacity: capNum }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal update ruangan");

      rooms[_editingRoomId].kapasitas = capNum;
      renderRoomList();
      closeRoomModal();
      showEnhancedNotification(
        `Ruangan ${_editingRoomId} berhasil diupdate!`,
        "success",
      );
    } else {
      // Cek duplikat lokal dulu sebelum hit API
      if (rooms[id]) {
        showEnhancedNotification("ID Ruangan sudah ada!", "error", [
          `Ruangan "${id}" sudah terdaftar`,
        ]);
        return;
      }
      // ✅ Simpan ke MongoDB via API
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: id, capacity: capNum }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal tambah ruangan");

      rooms[id] = { kapasitas: capNum };
      renderRoomList();
      closeRoomModal();
      showEnhancedNotification(`Ruangan ${id} ditambahkan!`, "success", [
        `Kapasitas: ${capNum} orang`,
      ]);
    }
  } catch (err) {
    showEnhancedNotification("Error: " + err.message, "error");
  }
}

function editRoom(id) {
  openRoomModal(id);
}

function deleteRoom(id) {
  openDeleteConfirm(
    `Hapus ruangan "${id}" (kapasitas: ${rooms[id]?.kapasitas} orang)? Tindakan ini tidak bisa dibatalkan.`,
    async () => {
      try {
        const res = await fetch("/api/rooms", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: id }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Gagal hapus ruangan");

        delete rooms[id];
        renderRoomList();
        showNotification(`Ruangan ${id} dihapus!`, "success");
      } catch (err) {
        showEnhancedNotification("Error: " + err.message, "error");
      }
    },
  );
}

function renderRoomList() {
  const list = $("roomsList");
  list.innerHTML = "";
  updateCounts();

  if (Object.keys(rooms).length === 0) {
    list.innerHTML =
      '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada ruangan. Klik "+ Tambah Ruangan"</div>';
    return;
  }

  Object.entries(rooms).forEach(([id, data]) => {
    const div = document.createElement("div");
    div.className =
      "flex justify-between items-center bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition";
    div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    <i class="fas fa-door-open"></i>
                </div>
                <div>
                    <div class="text-white font-bold text-sm">${id}</div>
                    <div class="text-gray-300 text-xs">Kapasitas: <span class="text-blue-300 font-semibold">${data.kapasitas} orang</span></div>
                </div>
            </div>
            <div class="flex gap-1">
                <button type="button" onclick="editRoom('${id}')" title="Edit"
                    class="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="deleteRoom('${id}')" title="Hapus"
                    class="text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    list.appendChild(div);
  });
}

// ===== DOSEN FUNCTIONS (CRUD) =====
function openDosenModal(editId = null) {
  _editingDosenId = editId;
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

  if (editId) {
    const data = dosens[editId];
    const name = typeof data === "string" ? data : data.name;
    const availDays =
      typeof data === "object" && data.available_days
        ? data.available_days
        : days;

    $("dosenModalTitle").innerHTML =
      `<i class="fas fa-user-edit text-yellow-400"></i> Edit Dosen`;
    $("dosenSaveBtnText").textContent = "Simpan Perubahan";
    $("dosenSaveBtn").className =
      "flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";

    $("dosenId").value = editId;
    $("dosenId").disabled = true;
    $("dosenId").classList.add("opacity-50", "cursor-not-allowed");
    $("dosenName").value = name;

    days.forEach((day) => {
      const cb = $(`day${day}`);
      if (cb) cb.checked = availDays.includes(day);
    });
  } else {
    $("dosenModalTitle").innerHTML =
      `<i class="fas fa-user-tie text-purple-400"></i> Tambah Dosen`;
    $("dosenSaveBtnText").textContent = "Simpan";
    $("dosenSaveBtn").className =
      "flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";

    $("dosenId").value = "";
    $("dosenId").disabled = false;
    $("dosenId").classList.remove("opacity-50", "cursor-not-allowed");
    $("dosenName").value = "";
    days.forEach((day) => {
      const cb = $(`day${day}`);
      if (cb) cb.checked = true;
    });
  }

  show("dosenModal");
  setTimeout(() => {
    if (!editId) $("dosenId").focus();
    else $("dosenName").focus();
  }, 50);
}

function closeDosenModal() {
  hide("dosenModal");
  _editingDosenId = null;
  document.activeElement && document.activeElement.blur();
}

async function saveDosen() {
  const id = $("dosenId").value.trim().toUpperCase();
  const name = $("dosenName").value.trim();
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
  const availableDays = days.filter((day) => {
    const cb = $(`day${day}`);
    return cb && cb.checked;
  });

  const idErrors = validateDosenId(id);
  const nameErrors = validateDosenName(name);
  const dayErrors = validateAvailableDays(availableDays);
  const allErrors = [...idErrors, ...nameErrors, ...dayErrors];

  if (allErrors.length > 0) {
    showEnhancedNotification("Validasi gagal", "error", allErrors);
    return;
  }

  try {
    if (_editingDosenId) {
      // ✅ Update ke MongoDB via API
      const res = await fetch("/api/lecturers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecturer_id: _editingDosenId,
          name,
          available_days: availableDays,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal update dosen");

      dosens[_editingDosenId] = { name, available_days: availableDays };
      renderDosenList();
      updateDosenDropdown();
      renderCourseList();
      closeDosenModal();
      showEnhancedNotification(`Dosen ${name} berhasil diupdate!`, "success");
    } else {
      // Cek duplikat lokal dulu sebelum hit API
      if (dosens[id]) {
        showEnhancedNotification("ID Dosen sudah ada!", "error", [
          `Dosen dengan ID "${id}" sudah terdaftar`,
        ]);
        return;
      }
      // ✅ Simpan ke MongoDB via API
      const res = await fetch("/api/lecturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecturer_id: id,
          name,
          available_days: availableDays,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal tambah dosen");

      dosens[id] = { name, available_days: availableDays };
      renderDosenList();
      updateDosenDropdown();
      closeDosenModal();
      showEnhancedNotification(`Dosen ${name} ditambahkan!`, "success", [
        `Hari mengajar: ${availableDays.join(", ")}`,
      ]);
    }
  } catch (err) {
    showEnhancedNotification("Error: " + err.message, "error");
  }
}

function editDosen(id) {
  openDosenModal(id);
}

function deleteDosen(id) {
  const name =
    typeof dosens[id] === "string" ? dosens[id] : dosens[id]?.name || id;
  const usedIn = Object.entries(courses)
    .filter(([, c]) => c.dosen === id)
    .map(([n]) => n);
  const warningText =
    usedIn.length > 0
      ? `Dosen "${name}" (${id}) masih dipakai di ${usedIn.length} mata kuliah: ${usedIn.slice(0, 3).join(", ")}${usedIn.length > 3 ? "..." : ""}. Tetap hapus?`
      : `Hapus dosen "${name}" (${id})? Tindakan ini tidak bisa dibatalkan.`;

  openDeleteConfirm(warningText, async () => {
    try {
      const res = await fetch("/api/lecturers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecturer_id: id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal hapus dosen");

      delete dosens[id];
      renderDosenList();
      updateDosenDropdown();
      renderCourseList();
      showNotification(`Dosen ${name} dihapus!`, "success");
    } catch (err) {
      showEnhancedNotification("Error: " + err.message, "error");
    }
  });
}

function renderDosenList() {
  const list = $("dosenList");
  list.innerHTML = "";
  updateCounts();

  if (Object.keys(dosens).length === 0) {
    list.innerHTML =
      '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada dosen. Klik "+ Tambah Dosen"</div>';
    return;
  }

  const dayColors = {
    Senin: "bg-blue-700",
    Selasa: "bg-purple-700",
    Rabu: "bg-green-700",
    Kamis: "bg-yellow-700",
    Jumat: "bg-red-700",
  };

  Object.entries(dosens).forEach(([id, data]) => {
    const name = typeof data === "string" ? data : data.name;
    const availableDays =
      typeof data === "object" && data.available_days
        ? data.available_days
        : ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

    const dayBadges = availableDays
      .map(
        (d) =>
          `<span class="text-xs px-1.5 py-0.5 rounded ${dayColors[d] || "bg-slate-600"} text-white">${d.slice(0, 3)}</span>`,
      )
      .join("");

    const div = document.createElement("div");
    div.className =
      "flex justify-between items-start bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition";
    div.innerHTML = `
            <div class="flex items-start gap-3 flex-1 min-w-0">
                <div class="w-8 h-8 bg-purple-700 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-white font-bold text-sm truncate">${id} — ${name}</div>
                    <div class="flex flex-wrap gap-1 mt-1">${dayBadges}</div>
                </div>
            </div>
            <div class="flex gap-1 flex-shrink-0 ml-2">
                <button type="button" onclick="editDosen('${id}')" title="Edit"
                    class="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="deleteDosen('${id}')" title="Hapus"
                    class="text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    list.appendChild(div);
  });
}

function updateDosenDropdown() {
  const select = $("courseDosen");
  const selected = select.value;
  select.innerHTML = '<option value="">-- Pilih Dosen --</option>';

  Object.entries(dosens).forEach(([id, data]) => {
    const name = typeof data === "string" ? data : data.name;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${id} - ${name}`;
    if (id === selected) option.selected = true;
    select.appendChild(option);
  });
}

// ===== COURSE FUNCTIONS (CRUD) =====
function openCourseModal(editName = null) {
  _editingCourseName = editName;
  updateDosenDropdown();

  if (editName) {
    const data = courses[editName];
    $("courseModalTitle").innerHTML =
      `<i class="fas fa-book-open text-yellow-400"></i> Edit Mata Kuliah`;
    $("courseSaveBtnText").textContent = "Simpan Perubahan";
    $("courseSaveBtn").className =
      "flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";

    $("courseName").value = editName;
    $("courseName").disabled = true;
    $("courseName").classList.add("opacity-50", "cursor-not-allowed");

    $("courseSem").value = data.sem;
    $("courseDosen").value = data.dosen;
    $("courseCapacity").value = data.kapasitas_kelas;
    $("courseJam").value = data.jam;
    $("courseTipe").value = data.tipe;

    updateCoursePreview();
  } else {
    $("courseModalTitle").innerHTML =
      `<i class="fas fa-book text-yellow-400"></i> Tambah Mata Kuliah`;
    $("courseSaveBtnText").textContent = "Simpan";
    $("courseSaveBtn").className =
      "flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2";

    $("courseName").value = "";
    $("courseName").disabled = false;
    $("courseName").classList.remove("opacity-50", "cursor-not-allowed");
    $("courseSem").value = "1";
    $("courseDosen").value = "";
    $("courseCapacity").value = "";
    $("courseJam").value = "";
    $("courseTipe").value = "gabungan";
    hide("coursePreview");
  }

  show("courseModal");
  setTimeout(() => {
    if (!editName) $("courseName").focus();
    else $("courseCapacity").focus();
  }, 50);
}

function updateCoursePreview() {
  const name = $("courseName").value.trim() || "?";
  const sem = $("courseSem").value;
  const dosenId = $("courseDosen").value;
  const dosenData = dosens[dosenId];
  const dosenName = dosenId
    ? typeof dosenData === "string"
      ? dosenData
      : dosenData?.name || dosenId
    : "-";
  const cap = $("courseCapacity").value;
  const jam = $("courseJam").value;
  const tipe = $("courseTipe").value;

  $("coursePreviewText").textContent =
    `${name} | Sem ${sem} | ${dosenId ? `${dosenId} (${dosenName})` : "-"} | ${cap || "?"} orang | ${jam || "?"} jam | Kelas: ${tipe}`;
  show("coursePreview");
}

function closeCourseModal() {
  hide("courseModal");
  _editingCourseName = null;
  document.activeElement && document.activeElement.blur();
}

async function saveCourse() {
  const name = $("courseName").value.trim().toUpperCase();
  const sem = parseInt($("courseSem").value);
  const dosenId = $("courseDosen").value;
  const capacity = parseInt($("courseCapacity").value);
  const jam = parseInt($("courseJam").value);
  const tipe = $("courseTipe").value;

  const nameErrors = validateCourseName(name);
  const semErrors = validateCourseSemester(sem);
  const capErrors = validateCourseCapacity(capacity);
  const jamErrors = validateCourseJam(jam);

  let dosenErrors = [];
  if (!dosenId) {
    dosenErrors.push("Pilih Dosen terlebih dahulu");
  }

  const allErrors = [
    ...nameErrors,
    ...semErrors,
    ...capErrors,
    ...jamErrors,
    ...dosenErrors,
  ];

  if (allErrors.length > 0) {
    showEnhancedNotification("Validasi gagal", "error", allErrors);
    return;
  }

  const courseData = {
    course_id: name,
    sem,
    dosen: dosenId,
    kapasitas_kelas: capacity,
    jam,
    tipe,
    sesi: 1,
  };

  try {
    if (_editingCourseName) {
      // ✅ Update ke MongoDB via API
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseData),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.message || "Gagal update mata kuliah");

      courses[_editingCourseName] = {
        sem,
        dosen: dosenId,
        kapasitas_kelas: capacity,
        jam,
        tipe,
        sesi: 1,
      };
      renderCourseList();
      closeCourseModal();
      showEnhancedNotification(
        `${_editingCourseName} berhasil diupdate!`,
        "success",
      );
    } else {
      // Cek duplikat lokal dulu sebelum hit API
      if (courses[name]) {
        showEnhancedNotification("Nama Mata Kuliah sudah ada!", "error", [
          `"${name}" sudah terdaftar`,
        ]);
        return;
      }
      // ✅ Simpan ke MongoDB via API
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseData),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.message || "Gagal tambah mata kuliah");

      courses[name] = {
        sem,
        dosen: dosenId,
        kapasitas_kelas: capacity,
        jam,
        tipe,
        sesi: 1,
      };
      renderCourseList();
      closeCourseModal();

      const dosenData = dosens[dosenId];
      const dosenName = dosenData
        ? typeof dosenData === "string"
          ? dosenData
          : dosenData.name
        : dosenId;

      showEnhancedNotification(`${name} ditambahkan!`, "success", [
        `Semester: ${sem}`,
        `Dosen: ${dosenName}`,
        `Kapasitas: ${capacity} orang`,
        `Durasi: ${jam} jam`,
        `Tipe: ${tipe}`,
      ]);
    }
  } catch (err) {
    showEnhancedNotification("Error: " + err.message, "error");
  }
}

function editCourse(name) {
  openCourseModal(name);
}

function deleteCourse(name) {
  const data = courses[name];
  const dosenData = dosens[data?.dosen];
  const dosenName = dosenData
    ? typeof dosenData === "string"
      ? dosenData
      : dosenData.name
    : data?.dosen;
  openDeleteConfirm(
    `Hapus mata kuliah "${name}" (Sem ${data?.sem}, ${dosenName})? Tindakan ini tidak bisa dibatalkan.`,
    async () => {
      try {
        const res = await fetch("/api/courses", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: name }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(result.message || "Gagal hapus mata kuliah");

        delete courses[name];
        renderCourseList();
        showNotification(`${name} dihapus!`, "success");
      } catch (err) {
        showEnhancedNotification("Error: " + err.message, "error");
      }
    },
  );
}

function renderCourseList(filterQuery = "", filterSem = "") {
  const list = $("coursesList");
  list.innerHTML = "";

  updateCounts();

  if (Object.keys(courses).length === 0) {
    list.innerHTML =
      '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada mata kuliah. Klik "+ Tambah Mata Kuliah"</div>';
    return;
  }

  const semColors = {
    1: "bg-blue-700",
    2: "bg-cyan-700",
    3: "bg-green-700",
    4: "bg-teal-700",
    5: "bg-yellow-700",
    6: "bg-orange-700",
    7: "bg-red-700",
    8: "bg-pink-700",
  };
  const q = filterQuery.toLowerCase();

  const grouped = {};
  Object.entries(courses).forEach(([name, data]) => {
    if (filterSem && String(data.sem) !== filterSem) return;
    if (q && !name.toLowerCase().includes(q)) return;
    if (!grouped[data.sem]) grouped[data.sem] = [];
    grouped[data.sem].push({ name, ...data });
  });

  if (Object.keys(grouped).length === 0) {
    list.innerHTML =
      '<div class="text-gray-400 text-sm text-center py-4 italic">Tidak ada hasil ditemukan.</div>';
    return;
  }

  Object.keys(grouped)
    .sort((a, b) => a - b)
    .forEach((sem) => {
      const semLabel = document.createElement("div");
      semLabel.className = `text-xs font-bold px-2 py-1 rounded mb-1 mt-2 first:mt-0 ${semColors[sem] || "bg-slate-600"} text-white inline-block`;
      semLabel.textContent = `Semester ${sem} (${parseInt(sem) % 2 === 1 ? "Ganjil" : "Genap"}) — ${grouped[sem].length} MK`;
      list.appendChild(semLabel);

      grouped[sem].forEach(({ name, dosen, kapasitas_kelas, jam, tipe }) => {
        const dosenData = dosens[dosen];
        const dosenName = dosenData
          ? typeof dosenData === "string"
            ? dosenData
            : dosenData.name
          : dosen;
        const tipeColor =
          tipe === "gabungan" ? "text-green-300" : "text-orange-300";

        const div = document.createElement("div");
        div.className =
          "flex justify-between items-start bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition mb-1";
        div.innerHTML = `
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class="w-8 h-8 ${semColors[parseInt(sem)] || "bg-slate-600"} bg-opacity-80 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                        ${jam}j
                    </div>
                    <div class="min-w-0">
                        <div class="text-white font-bold text-sm truncate">${name}</div>
                        <div class="text-gray-300 text-xs">
                            <span class="text-gray-400">${dosen}</span> · ${dosenName}
                        </div>
                        <div class="text-xs mt-0.5">
                            <span class="text-blue-300">${kapasitas_kelas} orang</span>
                            · <span class="${tipeColor}">${tipe}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-1 flex-shrink-0 ml-2">
                    <button type="button" onclick="editCourse('${name.replace(/'/g, "\\'")}')" title="Edit"
                        class="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="deleteCourse('${name.replace(/'/g, "\\'")}')" title="Hapus"
                        class="text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-30 p-2 rounded-lg transition text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        list.appendChild(div);
      });
    });
}

// ===== SEARCH / FILTER =====
function filterList(type) {
  if (type === "room") {
    const q = ($("roomSearch")?.value || "").toLowerCase();
    document.querySelectorAll("#roomsList > div").forEach((el) => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  } else if (type === "dosen") {
    const q = ($("dosenSearch")?.value || "").toLowerCase();
    document.querySelectorAll("#dosenList > div").forEach((el) => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  } else if (type === "course") {
    const q = ($("courseSearch")?.value || "").toLowerCase();
    const semFilter = $("courseFilterSem")?.value || "";
    renderCourseList(q, semFilter);
  }
}

function updateCounts() {
  const rc = $("roomCount");
  if (rc) rc.textContent = Object.keys(rooms).length;
  const dc = $("dosenCount");
  if (dc) dc.textContent = Object.keys(dosens).length;
  const cc = $("courseCount");
  if (cc) cc.textContent = Object.keys(courses).length;
}

// ===== LOAD DEFAULTS: Ambil dari MongoDB =====
async function loadDefaults() {
  try {
    const res = await fetch("/api/default-config");
    const result = await res.json();

    if (result.status === "success") {
      rooms = result.data.rooms || {};
      dosens = result.data.lecturers || {};
      courses = result.data.courses || {};

      renderRoomList();
      renderDosenList();
      renderCourseList();
      updateDosenDropdown();
      showNotification("Data berhasil dimuat dari database!", "success");
    } else {
      showNotification("Gagal memuat data dari database.", "error");
    }
  } catch (err) {
    showEnhancedNotification(
      "Gagal terhubung ke server: " + err.message,
      "error",
    );
  }
}

// ===== RIWAYAT JADWAL =====
async function loadScheduleHistory() {
  const container = $("scheduleHistoryList");
  if (!container) return;

  container.innerHTML =
    '<div class="text-gray-400 text-sm text-center py-4">Memuat riwayat...</div>';

  try {
    const res = await fetch("/api/schedules/history?limit=10");
    const result = await res.json();

    if (!res.ok || result.status !== "success") {
      container.innerHTML =
        '<div class="text-red-400 text-sm text-center py-4">Gagal memuat riwayat.</div>';
      return;
    }

    const history = result.data;
    if (history.length === 0) {
      container.innerHTML =
        '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada riwayat jadwal.</div>';
      return;
    }

    container.innerHTML = history
      .map((item) => {
        const date = new Date(item.created_at).toLocaleString("id-ID");
        const semType = (item.semester_type || "-").toUpperCase();
        const penalty =
          item.penalty !== undefined ? item.penalty.toFixed(2) : "-";
        const sessions = item.metadata?.total_sessions || "-";
        const method =
          item.metadata?.best_method || item.metadata?.algorithm_used || "-";
        const statusColor =
          item.penalty === 0 ? "text-green-400" : "text-yellow-400";
        const statusText = item.penalty === 0 ? "OPTIMAL" : "Sub-optimal";

        return `
        <div class="bg-slate-700 border border-slate-600 rounded-lg p-3 hover:border-blue-500 transition">
          <div class="flex justify-between items-start">
            <div>
              <span class="text-xs bg-blue-700 text-white px-2 py-0.5 rounded font-semibold">${semType}</span>
              <span class="ml-2 text-xs ${statusColor} font-bold">${statusText}</span>
            </div>
            <div class="text-xs text-gray-400">${date}</div>
          </div>
          <div class="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-300">
            <div>Penalti: <span class="text-white font-mono">${penalty}</span></div>
            <div>Sesi: <span class="text-white font-mono">${sessions}</span></div>
            <div class="truncate">Metode: <span class="text-blue-300">${method}</span></div>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<div class="text-red-400 text-sm text-center py-4">Error: ${err.message}</div>`;
  }
}

function toggleHistoryPanel() {
  const panel = $("historyPanel");
  if (!panel) return;
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    loadScheduleHistory();
  } else {
    panel.classList.add("hidden");
  }
}

// ===== API SUBMISSION — SSE-based =====
async function submitOptimization(data) {
  show("statusContainer");
  hide("resultsContainer");

  const isHybrid = data.algorithm_mode === "hybrid";

  // Render layout progress bar sesuai mode
  _renderProgressLayout(isHybrid);
  _updateBar("main", 0, "Validasi data...");

  // 1. Kirim payload ke /api/optimize/start — dapat job_id
  let jobId;
  try {
    _updateBar("main", 2, "Mengirim ke server...");
    const payload = {
      ga_params: data.ga_params,
      semester_type: data.semester_type,
      algorithm_mode: data.algorithm_mode,
    };
    const res = await fetch("/api/optimize/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok) {
      const msg = json.message || "Optimasi gagal";
      if (json.code === "ROOM_CAPACITY_INSUFFICIENT") {
        showEnhancedNotification("⚠️ " + msg, "warning", [
          `Kapasitas ruangan terbesar: ${json.details?.max_room_capacity}`,
          `Kapasitas mata kuliah terbesar: ${json.details?.max_course_capacity}`,
          json.details?.suggestion || "",
        ]);
      } else if (json.code === "DOSEN_NOT_FOUND") {
        showEnhancedNotification(msg, "error", [
          `Mata kuliah: ${json.details?.course}`,
          `Dosen ID: ${json.details?.dosen}`,
        ]);
      } else {
        showEnhancedNotification(msg, "error", json.details || null);
      }
      hide("statusContainer");
      return;
    }
    jobId = json.job_id;
  } catch (err) {
    showEnhancedNotification(
      "Gagal terhubung ke server: " + err.message,
      "error",
    );
    hide("statusContainer");
    return;
  }

  // 2. Subscribe ke SSE stream
  _updateBar("main", 5, "Algoritma diinisialisasi...");
  const evtSource = new EventSource(`/api/optimize/stream/${jobId}`);

  evtSource.onmessage = (e) => {
    let event;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    if (event.type === "keepalive") return;

    if (event.type === "status") {
      // mode hybrid: tampilkan pesan di area status umum
      const el = $("statusMessage");
      if (el) el.textContent = event.message;
    }

    if (event.type === "progress") {
      const pct = Math.min(Math.max(event.percent, 2), 99);
      const eta =
        event.eta_sec > 0
          ? ` | ETA ≈ ${Math.ceil(event.eta_sec / 60)} mnt`
          : "";
      const stag = event.stagnant > 200 ? ` | ⚠ stagnan ${event.stagnant}` : "";
      const label = `Gen ${event.generation} | Penalti: ${event.penalty.toFixed(2)}${eta}${stag}`;

      if (event.bar === "main") {
        _updateBar("main", pct, `${event.phase} — ${label}`);
      } else if (event.bar === "ga") {
        _updateBar("ga", pct, label);
      } else if (event.bar === "greedy") {
        _updateBar("greedy", pct, label);
      }
    }

    if (event.type === "phase_done") {
      // GA Murni selesai di hybrid — tandai bar-nya 100%
      if (event.bar === "ga") {
        _updateBar(
          "ga",
          100,
          `Selesai ✓ | Penalti: ${event.penalty.toFixed(2)}`,
        );
      }
    }

    if (event.type === "error") {
      evtSource.close();
      showEnhancedNotification("Error optimasi: " + event.message, "error");
      hide("statusContainer");
    }

    if (event.type === "result") {
      evtSource.close();
      const result = event.data;
      // Tandai semua bar selesai
      if (isHybrid) {
        _updateBar(
          "ga",
          100,
          `Selesai ✓ | Penalti: ${result.comparison?.ga_only?.penalty?.toFixed(2) ?? "-"}`,
        );
        _updateBar(
          "greedy",
          100,
          `Selesai ✓ | Penalti: ${result.comparison?.ga_greedy?.penalty?.toFixed(2) ?? "-"}`,
        );
      } else {
        _updateBar("main", 100, "Selesai!");
      }
      displayResults(result);
      showEnhancedNotification("Optimasi selesai!", "success", [
        `Total sesi: ${result.total_sessions}`,
        `Penalti: ${result.final_penalty.toFixed(2)}`,
        `Algoritma: ${getAlgorithmLabel(result.algorithm_mode)}`,
      ]);
      setTimeout(() => {
        hide("statusContainer");
        show("resultsContainer");
      }, 600);
    }
  };

  evtSource.onerror = () => {
    evtSource.close();
    showEnhancedNotification("Koneksi SSE terputus — coba lagi.", "error");
    hide("statusContainer");
  };
}

// ===== PROGRESS BAR HELPERS =====
function _renderProgressLayout(isHybrid) {
  const container = $("statusContainer");
  if (!container) return;

  if (isHybrid) {
    container.innerHTML = `
      <div class="space-y-4 p-4">
        <p class="text-center text-gray-300 font-semibold text-sm" id="statusMessage">Memulai optimasi...</p>

        <div>
          <div class="flex justify-between text-xs text-gray-400 mb-1">
            <span>🧬 Genetika Murni</span>
            <span id="gaBarLabel">0%</span>
          </div>
          <div class="w-full bg-slate-600 rounded-full h-4 overflow-hidden">
            <div id="gaProgressBar"
              class="h-4 rounded-full bg-blue-500 transition-all duration-300"
              style="width:0%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1 truncate" id="gaBarMsg">Menunggu...</p>
        </div>

        <div>
          <div class="flex justify-between text-xs text-gray-400 mb-1">
            <span>🔀 GA + Greedy</span>
            <span id="greedyBarLabel">0%</span>
          </div>
          <div class="w-full bg-slate-600 rounded-full h-4 overflow-hidden">
            <div id="greedyProgressBar"
              class="h-4 rounded-full bg-purple-500 transition-all duration-300"
              style="width:0%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1 truncate" id="greedyBarMsg">Menunggu...</p>
        </div>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="space-y-2 p-4">
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span id="statusMessage">Memulai...</span>
          <span id="progressText">0%</span>
        </div>
        <div class="w-full bg-slate-600 rounded-full h-4 overflow-hidden">
          <div id="progressBar"
            class="h-4 rounded-full bg-blue-500 transition-all duration-300"
            style="width:0%"></div>
        </div>
      </div>`;
  }
}

function _updateBar(bar, pct, msg) {
  if (bar === "main") {
    const pb = $("progressBar");
    const pt = $("progressText");
    const sm = $("statusMessage");
    if (pb) pb.style.width = pct + "%";
    if (pt) pt.textContent = pct + "%";
    if (sm) sm.textContent = msg;
  } else if (bar === "ga") {
    const pb = $("gaProgressBar");
    const lbl = $("gaBarLabel");
    const pm = $("gaBarMsg");
    if (pb) pb.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    if (pm) pm.textContent = msg;
    if (pb && pct >= 100) pb.classList.replace("bg-blue-500", "bg-green-500");
  } else if (bar === "greedy") {
    const pb = $("greedyProgressBar");
    const lbl = $("greedyBarLabel");
    const pm = $("greedyBarMsg");
    if (pb) pb.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    if (pm) pm.textContent = msg;
    if (pb && pct >= 100) pb.classList.replace("bg-purple-500", "bg-green-500");
  }
}

// ===== ALGORITHM MODE LABEL =====
function getAlgorithmLabel(mode) {
  const labels = {
    ga_only: "🧬 Genetika Murni",
    ga_greedy: "🔀 GA + Greedy (Restart)",
    hybrid: "🔬 Bandingkan Keduanya",
  };
  return labels[mode] || mode;
}

// ===== DISPLAY RESULTS =====
function displayResults(result) {
  currentSchedule = result;
  downloadUrl = result.download_url;
  downloadUrls = result.download_urls || { best: result.download_url };

  $("penaltyText").textContent =
    `Penalti Total: ${result.final_penalty.toFixed(2)} (${result.penalty_status})`;

  const badge = $("penaltyBadge");
  if (result.final_penalty === 0) {
    badge.textContent = "OPTIMAL ✓";
    badge.classList.remove("bg-white", "bg-opacity-20");
    badge.classList.add("bg-green-300", "bg-opacity-30");
  }

  updateDownloadButtons(result);

  const semesterTypeText =
    result.semester_type === "ganjil" ? "GANJIL" : "GENAP";
  const algorithmLabel = getAlgorithmLabel(result.algorithm_mode);

  let overviewHTML = `
        <div class="mb-4 grid grid-cols-2 gap-4">
            <div class="bg-blue-600 bg-opacity-20 border-2 border-blue-400 rounded-lg p-4 text-center">
                <div class="text-blue-300 text-sm font-semibold">Tipe Semester</div>
                <div class="text-white text-2xl font-bold">${semesterTypeText}</div>
            </div>
            <div class="bg-purple-600 bg-opacity-20 border-2 border-purple-400 rounded-lg p-4 text-center">
                <div class="text-purple-300 text-sm font-semibold">Algoritma Digunakan</div>
                <div class="text-white text-lg font-bold">${algorithmLabel}</div>
            </div>
        </div>`;

  if (result.room_utilization) {
    const util = result.room_utilization;
    const utilValues = Object.values(util);
    const avgUtil = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;
    const maxUtil = Math.max(...utilValues);
    const minUtil = Math.min(...utilValues);

    let utilStatus = "";
    let utilColor = "";

    if (maxUtil - minUtil > 40) {
      utilStatus = "Tidak Merata";
      utilColor = "text-yellow-400";
    } else if (avgUtil > 70) {
      utilStatus = "Padat";
      utilColor = "text-orange-400";
    } else if (avgUtil > 40) {
      utilStatus = "Optimal";
      utilColor = "text-green-400";
    } else {
      utilStatus = "Rendah";
      utilColor = "text-blue-400";
    }

    overviewHTML += `
        <div class="mb-4 bg-slate-700 p-4 rounded-lg">
            <h3 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <i class="fas fa-chart-pie text-green-400"></i> Utilisasi Ruangan
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div class="text-sm text-gray-400 mb-2">Rata-rata: <span class="text-white font-bold">${avgUtil.toFixed(1)}%</span></div>
                    <div class="text-sm text-gray-400 mb-2">Tertinggi: <span class="text-white">${maxUtil.toFixed(1)}%</span></div>
                    <div class="text-sm text-gray-400">Terendah: <span class="text-white">${minUtil.toFixed(1)}%</span></div>
                </div>
                <div>
                    <div class="text-sm text-gray-400 mb-2">Status: <span class="${utilColor} font-bold">${utilStatus}</span></div>
                    <div class="w-full bg-slate-600 h-2 rounded-full mt-2">
                        <div class="bg-green-500 h-2 rounded-full" style="width: ${avgUtil}%"></div>
                    </div>
                </div>
            </div>
            <div class="mt-3 text-xs text-gray-400">
                ${getRoomUtilizationSummary(util)}
            </div>
        </div>`;
  }

  if (result.dosen_conflicts && result.dosen_conflicts.length > 0) {
    overviewHTML += `
        <div class="mb-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
            <h3 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <i class="fas fa-exclamation-triangle text-red-400"></i>
                Konflik Dosen (${result.dosen_conflicts.length})
                <span class="text-xs bg-red-600 px-2 py-1 rounded">Perlu Perhatian</span>
            </h3>
            <div class="space-y-2 max-h-40 overflow-y-auto">
                ${result.dosen_conflicts
                  .map(
                    (conflict) => `
                    <div class="text-sm bg-red-800 bg-opacity-50 p-2 rounded">
                        <div class="text-red-200">${conflict.dosen} - ${conflict.day}</div>
                        <div class="text-xs text-red-300">
                            ${conflict.course1} (Sem ${conflict.semester1}): ${conflict.time1}
                            ↔ ${conflict.course2} (Sem ${conflict.semester2}): ${conflict.time2}
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>`;
  }

  if (result.comparison) {
    const comp = result.comparison;
    const penaltyImprovement = comp.penalty_improvement;
    const percentageImprovement = comp.penalty_improvement_percentage;
    const winner = comp.winner;

    // ── Ambil data tie-breaking dari backend ─────────────────────────────────
    const tiebreak = comp.tiebreak || {};
    const tbLevel = tiebreak.tiebreak_level || null; // "Level 1 - Penalti" dst.
    const tbNote = tiebreak.note || "";
    const tbMargin = tiebreak.margin ?? null;
    const tbWinner = tiebreak.tiebreak_winner || comp.best_method || "";

    // Skor kualitas per-aspek
    const qdGA = comp.ga_only?.quality_detail || {};
    const qdHyb = comp.ga_greedy?.quality_detail || {};
    const sqGA = comp.ga_only?.quality_score ?? null;
    const sqHyb = comp.ga_greedy?.quality_score ?? null;

    // ── Helper: baris tabel aspek ─────────────────────────────────────────────
    function aspectRow(label, vGA, vHyb) {
      if (vGA == null && vHyb == null) return "";
      const gaWins = vGA != null && vHyb != null && vGA > vHyb;
      const hybWins = vGA != null && vHyb != null && vHyb > vGA;
      const fmt = (v) => (v != null ? v.toFixed(1) : "—");
      const cls = (wins) =>
        wins ? "text-green-300 font-bold" : "text-gray-400";
      const badge = (wins) =>
        wins ? `<span class="ml-1 text-green-400 text-xs">▲</span>` : "";
      return `
        <tr class="border-t border-slate-700 text-xs">
          <td class="py-1.5 pr-3 text-gray-400 whitespace-nowrap">${label}</td>
          <td class="py-1.5 text-center font-mono ${cls(gaWins)}">${fmt(vGA)}${badge(gaWins)}</td>
          <td class="py-1.5 text-center font-mono ${cls(hybWins)}">${fmt(vHyb)}${badge(hybWins)}</td>
        </tr>`;
    }

    // ── Tentukan warna & teks berdasarkan level pemenang ──────────────────────
    // Level 1 = menang dari penalti (merah/tegas)
    // Level 2 = menang dari skor total (kuning)
    // Level 3 = menang dari aspek individu (biru)
    // Level 4 = default (abu)
    let levelNum = 1;
    if (tbLevel) {
      const m = tbLevel.match(/Level\s+(\d)/i);
      if (m) levelNum = parseInt(m[1]);
    }

    const levelMeta = {
      1: {
        bg: "bg-emerald-900",
        border: "border-emerald-500",
        badge: "bg-emerald-600",
        icon: "🥇",
        label: "Level 1 — Penalti Lebih Kecil",
        desc: "Pemenang ditentukan langsung dari nilai penalti (constraint keras). Penalti yang lebih kecil berarti lebih sedikit pelanggaran jadwal.",
      },
      2: {
        bg: "bg-yellow-900",
        border: "border-yellow-500",
        badge: "bg-yellow-600",
        icon: "⚖️",
        label: "Level 2 — Skor Kualitas Total",
        desc: "Penalti kedua algoritma identik. Pemenang ditentukan dari rata-rata skor 3 aspek kualitas jadwal (distribusi hari, ruangan, konvergensi).",
      },
      3: {
        bg: "bg-blue-900",
        border: "border-blue-500",
        badge: "bg-blue-600",
        icon: "🔍",
        label: `Level 3 — ${tbLevel ? tbLevel.replace(/^Level\s+3\s*[-–]\s*/i, "") : "Aspek Individu"}`,
        desc: "Skor total juga identik. Pemenang ditentukan dari aspek kualitas individual secara berurutan: distribusi hari → distribusi ruangan → kecepatan konvergensi.",
      },
      4: {
        bg: "bg-slate-700",
        border: "border-slate-500",
        badge: "bg-slate-600",
        icon: "🔄",
        label: "Level 4 — Default GA+Greedy",
        desc: "Semua aspek benar-benar identik. Sistem memilih GA+Greedy sebagai default karena memiliki mekanisme optimasi tambahan (greedy post-processing).",
      },
    };
    const lm = levelMeta[levelNum] || levelMeta[4];

    // ── Warna nama algoritma ──────────────────────────────────────────────────
    const winnerLabel =
      winner === "ga_only" ? "🧬 Genetika Murni" : "🔀 Genetika + Greedy";
    const loserLabel =
      winner === "ga_only" ? "🔀 Genetika + Greedy" : "🧬 Genetika Murni";
    const winnerColor =
      winner === "ga_only" ? "text-blue-300" : "text-purple-300";

    // ── Bangun tabel skor kualitas ────────────────────────────────────────────
    const hasQuality =
      Object.keys(qdGA).length > 0 || Object.keys(qdHyb).length > 0;
    const qualityTable = hasQuality
      ? `
      <div class="mt-4">
        <div class="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
          📐 Skor Kualitas Jadwal (0–100, makin tinggi makin baik)
        </div>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 border-b border-slate-600">
              <th class="text-left py-1 pr-3 font-normal">Aspek</th>
              <th class="text-center py-1 font-normal text-blue-400">🧬 GA Murni</th>
              <th class="text-center py-1 font-normal text-purple-400">🔀 GA+Greedy</th>
            </tr>
          </thead>
          <tbody>
            ${aspectRow("Distribusi Hari", qdGA.hari, qdHyb.hari)}
            ${aspectRow("Distribusi Ruangan", qdGA.ruangan, qdHyb.ruangan)}
            ${aspectRow("Konvergensi Generasi", qdGA.generasi, qdHyb.generasi)}
            <tr class="border-t-2 border-slate-500 font-bold text-xs">
              <td class="py-1.5 pr-3 text-gray-300">Total Skor</td>
              <td class="py-1.5 text-center font-mono ${sqGA != null && sqGA >= (sqHyb ?? -1) && winner === "ga_only" ? "text-green-300" : "text-gray-300"}">
                ${sqGA != null ? sqGA.toFixed(2) : "—"} ${winner === "ga_only" && levelNum >= 2 ? "▲" : ""}
              </td>
              <td class="py-1.5 text-center font-mono ${sqHyb != null && sqHyb >= (sqGA ?? -1) && winner === "ga_greedy" ? "text-green-300" : "text-gray-300"}">
                ${sqHyb != null ? sqHyb.toFixed(2) : "—"} ${winner === "ga_greedy" && levelNum >= 2 ? "▲" : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>`
      : "";

    // ── Penjelasan alasan pemenang ────────────────────────────────────────────
    // Buat kalimat spesifik berdasarkan level
    let reasonHTML = "";
    if (levelNum === 1) {
      const diff = Math.abs(penaltyImprovement);
      const pct = Math.abs(percentageImprovement).toFixed(1);
      const winPenalty =
        winner === "ga_only" ? comp.ga_only.penalty : comp.ga_greedy.penalty;
      const losePenalty =
        winner === "ga_only" ? comp.ga_greedy.penalty : comp.ga_only.penalty;
      reasonHTML = `
        <div class="text-sm text-gray-300 leading-relaxed">
          <span class="${winnerColor} font-semibold">${winnerLabel}</span> menghasilkan penalti
          <span class="font-mono text-white">${winPenalty.toFixed(2)}</span>,
          lebih rendah <span class="text-green-300 font-semibold">${diff.toFixed(2)} poin (${pct}%)</span>
          dibanding ${loserLabel}
          (<span class="font-mono text-white">${losePenalty.toFixed(2)}</span>).
          Penalti yang lebih kecil berarti lebih sedikit pelanggaran constraint jadwal
          (konflik ruangan, konflik dosen, kapasitas, dll).
        </div>`;
    } else if (levelNum === 2) {
      reasonHTML = `
        <div class="text-sm text-gray-300 leading-relaxed">
          Penalti kedua algoritma identik. Pemenang ditentukan dari
          <span class="text-yellow-300 font-semibold">skor kualitas total</span>:
          <span class="${winnerColor} font-semibold">${winnerLabel}</span>
          meraih skor <span class="font-mono text-white">${(winner === "ga_only" ? sqGA : sqHyb)?.toFixed(2) ?? "—"}</span>
          vs <span class="font-mono text-white">${(winner === "ga_only" ? sqHyb : sqGA)?.toFixed(2) ?? "—"}</span>
          (selisih <span class="text-green-300 font-semibold">${tbMargin != null ? tbMargin.toFixed(4) : "—"}</span>).
        </div>`;
    } else if (levelNum === 3) {
      const decidingAspect = tbLevel
        ? tbLevel.replace(/^Level\s+3\s*[-–]\s*/i, "")
        : "aspek individu";
      reasonHTML = `
        <div class="text-sm text-gray-300 leading-relaxed">
          Penalti dan skor total identik. Pemenang ditentukan dari aspek
          <span class="text-blue-300 font-semibold">"${decidingAspect}"</span>:
          <span class="${winnerColor} font-semibold">${winnerLabel}</span>
          unggul dengan selisih <span class="text-green-300 font-semibold">${tbMargin != null ? tbMargin.toFixed(4) : "—"}</span>.
        </div>`;
    } else {
      reasonHTML = `
        <div class="text-sm text-gray-300 leading-relaxed">
          Semua aspek identik. Sistem memilih
          <span class="text-purple-300 font-semibold">GA+Greedy</span>
          sebagai default karena memiliki tahap optimasi tambahan (greedy post-processing).
        </div>`;
    }

    overviewHTML += `
      <div class="mb-4 ${lm.bg} bg-opacity-40 border-2 ${lm.border} rounded-xl p-4">

        <!-- Header -->
        <h3 class="text-white text-base font-bold mb-4 flex items-center gap-2">
          <i class="fas fa-balance-scale text-purple-300"></i>
          Hasil Perbandingan Algoritma
        </h3>

        <!-- Kartu Kedua Algoritma -->
        <div class="grid grid-cols-2 gap-3 mb-4">

          <!-- GA Murni -->
          <div class="rounded-lg p-3 ${
            winner === "ga_only"
              ? "bg-blue-900 bg-opacity-60 border-2 border-yellow-400"
              : "bg-slate-700 bg-opacity-50 border border-slate-600"
          }">
            <div class="text-center mb-2">
              <div class="text-sm font-bold text-blue-300">🧬 Genetika Murni</div>
              ${
                winner === "ga_only"
                  ? `<span class="inline-block mt-1 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">🏆 PEMENANG</span>`
                  : `<span class="text-gray-500 text-xs">—</span>`
              }
            </div>
            <div class="space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-400">Penalti</span>
                <span class="font-mono font-bold ${winner === "ga_only" ? "text-green-300" : "text-white"}">${comp.ga_only.penalty.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Waktu</span>
                <span class="font-mono text-white">${comp.ga_only.time.toFixed(2)}s</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Generasi</span>
                <span class="font-mono text-white">${comp.ga_only.generations ?? "—"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Skor Kualitas</span>
                <span class="font-mono ${winner === "ga_only" && levelNum >= 2 ? "text-green-300 font-bold" : "text-white"}">${sqGA != null ? sqGA.toFixed(2) : "—"}</span>
              </div>
            </div>
          </div>

          <!-- GA + Greedy -->
          <div class="rounded-lg p-3 ${
            winner === "ga_greedy"
              ? "bg-purple-900 bg-opacity-60 border-2 border-yellow-400"
              : "bg-slate-700 bg-opacity-50 border border-slate-600"
          }">
            <div class="text-center mb-2">
              <div class="text-sm font-bold text-purple-300">🔀 Genetika + Greedy</div>
              ${
                winner === "ga_greedy"
                  ? `<span class="inline-block mt-1 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">🏆 PEMENANG</span>`
                  : `<span class="text-gray-500 text-xs">—</span>`
              }
            </div>
            <div class="space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-400">Penalti</span>
                <span class="font-mono font-bold ${winner === "ga_greedy" ? "text-green-300" : "text-white"}">${comp.ga_greedy.penalty.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Waktu</span>
                <span class="font-mono text-white">${comp.ga_greedy.time.toFixed(2)}s</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Generasi</span>
                <span class="font-mono text-white">${comp.ga_greedy.generations ?? "—"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Skor Kualitas</span>
                <span class="font-mono ${winner === "ga_greedy" && levelNum >= 2 ? "text-green-300 font-bold" : "text-white"}">${sqHyb != null ? sqHyb.toFixed(2) : "—"}</span>
              </div>
              ${
                comp.ga_greedy.improvements != null
                  ? `
              <div class="flex justify-between">
                <span class="text-gray-400">Perbaikan Greedy</span>
                <span class="font-mono text-cyan-300">${comp.ga_greedy.improvements}</span>
              </div>`
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- Selisih Penalti -->
        <div class="bg-slate-900 bg-opacity-60 rounded-lg px-4 py-3 text-center mb-4">
          <div class="text-xs text-gray-400 mb-1">Selisih Penalti (GA Murni − GA+Greedy)</div>
          <div class="text-2xl font-bold ${penaltyImprovement > 0 ? "text-green-400" : penaltyImprovement < 0 ? "text-red-400" : "text-gray-400"}">
            ${penaltyImprovement > 0 ? "−" : penaltyImprovement < 0 ? "+" : "±"}${Math.abs(penaltyImprovement).toFixed(2)}
            ${
              penaltyImprovement !== 0
                ? `<span class="text-sm font-normal text-gray-400 ml-1">(${Math.abs(percentageImprovement).toFixed(1)}%)</span>`
                : `<span class="text-sm font-normal text-yellow-400 ml-1">Identik</span>`
            }
          </div>
        </div>

        <!-- Tabel Skor Kualitas -->
        ${qualityTable}

        <!-- Kotak Alasan Pemenang -->
        <div class="mt-4 rounded-lg border ${lm.border} bg-black bg-opacity-30 p-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-base">${lm.icon}</span>
            <span class="text-xs font-bold text-white uppercase tracking-wide">${lm.label}</span>
          </div>
          <p class="text-xs text-gray-400 mb-3 leading-relaxed">${lm.desc}</p>
          ${reasonHTML}
          ${
            tbNote && levelNum > 1
              ? `<div class="mt-2 text-xs text-gray-500 italic">"${tbNote}"</div>`
              : ""
          }
        </div>

      </div>`;
  }

  overviewHTML += `
        <div class="grid grid-cols-3 gap-3">
            <div class="bg-slate-700 p-4 rounded text-center">
                <div class="text-2xl font-bold text-blue-400">${result.total_courses}</div>
                <div class="text-gray-400 text-sm">Mata Kuliah</div>
            </div>
            <div class="bg-slate-700 p-4 rounded text-center">
                <div class="text-2xl font-bold text-green-400">${result.total_sessions}</div>
                <div class="text-gray-400 text-sm">Total Sesi</div>
            </div>
            <div class="bg-slate-700 p-4 rounded text-center">
                <div class="text-2xl font-bold text-purple-400">${Object.keys(result.structured_result).length}</div>
                <div class="text-gray-400 text-sm">Semester</div>
            </div>
        </div>
    `;

  const overviewContent = $("overviewContent");
  overviewContent.innerHTML = overviewHTML;

  const semesters = Object.keys(result.structured_result)
    .map((s) => parseInt(s))
    .sort((a, b) => a - b);

  const tabsContainer = document.querySelector(".tabs-container");
  if (tabsContainer) {
    let tabsHTML =
      '<button onclick="switchTab(\'overview\')" class="tab-btn active px-4 py-2 bg-blue-500 text-white rounded font-semibold whitespace-nowrap text-sm transition"><i class="fas fa-chart-bar"></i> Overview</button>';

    semesters.forEach((sem) => {
      tabsHTML += `<button onclick="switchTab('sem${sem}')" class="tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">Semester ${sem}</button>`;
    });

    tabsContainer.innerHTML = tabsHTML;
  }

  semesters.forEach((sem) => {
    const semData = result.structured_result[sem];
    if (semData) {
      renderSemesterSchedule(sem, semData);
    }
  });

  if (result.comparison) {
    const gaOnlyContainer = document.createElement("div");
    gaOnlyContainer.id = "gaOnlyComparison";
    gaOnlyContainer.className =
      "tab-content hidden bg-slate-800 rounded-lg shadow-2xl p-6";
    gaOnlyContainer.innerHTML =
      '<h3 class="text-xl font-bold text-white mb-4">🧬 Hasil Genetika Murni</h3><div id="gaOnlyComparisonContent" class="space-y-3"></div>';

    const gaGreedyContainer = document.createElement("div");
    gaGreedyContainer.id = "gaGreedyComparison";
    gaGreedyContainer.className =
      "tab-content hidden bg-slate-800 rounded-lg shadow-2xl p-6";
    gaGreedyContainer.innerHTML =
      '<h3 class="text-xl font-bold text-white mb-4">🔀 Hasil Genetika + Greedy</h3><div id="gaGreedyComparisonContent" class="space-y-3"></div>';

    const resultsContainer = $("resultsContainer");
    resultsContainer.appendChild(gaOnlyContainer);
    resultsContainer.appendChild(gaGreedyContainer);

    tabsContainer.innerHTML += `
            <button onclick="switchTab('gaOnlyComparison')" class="tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">
                🧬 GA Murni
            </button>
            <button onclick="switchTab('gaGreedyComparison')" class="tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">
                🔀 GA+Greedy
            </button>
        `;

    renderComparisonSchedule(
      "gaOnlyComparisonContent",
      result.comparison.ga_only.structured_result,
    );
    renderComparisonSchedule(
      "gaGreedyComparisonContent",
      result.comparison.ga_greedy.structured_result,
    );
  }
}

function getRoomUtilizationSummary(utilization) {
  if (!utilization) return "";

  return Object.entries(utilization)
    .sort((a, b) => b[1] - a[1])
    .map(([room, util]) => {
      let barColor = "bg-green-500";
      if (util > 80) barColor = "bg-orange-500";
      if (util < 20) barColor = "bg-blue-500";

      return `
                <div class="flex items-center gap-2 mb-1">
                    <span class="w-12">${room}</span>
                    <div class="flex-1 bg-slate-600 h-2 rounded">
                        <div class="${barColor} h-2 rounded" style="width: ${util}%"></div>
                    </div>
                    <span class="w-12 text-right">${util.toFixed(0)}%</span>
                </div>
            `;
    })
    .join("");
}

function renderComparisonSchedule(containerId, structuredResult) {
  const container = $(containerId);
  if (!container) return;

  let html = "";
  const semesters = Object.keys(structuredResult)
    .map((s) => parseInt(s))
    .sort((a, b) => a - b);

  semesters.forEach((sem) => {
    html += `<div class="mb-6">`;
    html += `<h4 class="text-lg font-bold text-blue-300 mb-3">Semester ${sem}</h4>`;

    const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    dayOrder.forEach((day) => {
      if (structuredResult[sem] && structuredResult[sem][day]) {
        html += `<div class="mb-4">
                    <h5 class="text-md font-semibold text-purple-300 mb-2">
                        <i class="fas fa-calendar-day"></i> ${day}
                    </h5>
                    <div class="space-y-2">`;

        structuredResult[sem][day].forEach((session) => {
          html += `
                        <div class="bg-slate-700 p-3 rounded border-l-4 border-purple-400">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <div class="font-semibold text-white">${session.course}</div>
                                    <div class="text-sm text-gray-400">${session.dosen}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-green-400 font-mono">${session.start_time} - ${session.end_time}</div>
                                    <div class="text-sm text-gray-400">${session.room} | ${session.kelas}</div>
                                </div>
                            </div>
                        </div>
                    `;
        });

        html += `</div></div>`;
      }
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

function renderSemesterSchedule(semester, semesterData) {
  const contentDiv = $(`sem${semester}Content`);
  if (!contentDiv) {
    console.warn(`Content div for semester ${semester} not found`);
    return;
  }

  let html = "";

  const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
  dayOrder.forEach((day) => {
    if (semesterData[day]) {
      html += `<div class="mb-4">
                <h4 class="text-lg font-bold text-blue-300 mb-2">
                    <i class="fas fa-calendar-day"></i> ${day}
                </h4>
                <div class="space-y-2">`;

      semesterData[day].forEach((session) => {
        html += `
                    <div class="bg-slate-700 p-3 rounded border-l-4 border-blue-400">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-semibold text-white">${session.course}</div>
                                <div class="text-sm text-gray-400">${session.dosen}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-green-400 font-mono">${session.start_time} - ${session.end_time}</div>
                                <div class="text-sm text-gray-400">${session.room} | ${session.kelas}</div>
                            </div>
                        </div>
                    </div>
                `;
      });

      html += `</div></div>`;
    }
  });

  contentDiv.innerHTML = html;
}

// ===== TAB SWITCHING =====
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("bg-blue-500", "text-white");
    btn.classList.add("hover:bg-slate-700", "text-gray-300");
  });

  show(tabName);
  event.target.classList.remove("hover:bg-slate-700", "text-gray-300");
  event.target.classList.add("bg-blue-500", "text-white");
}

// ===== DOWNLOAD =====
function triggerDownload(url, label) {
  if (!url) {
    showNotification("File tidak tersedia!", "error");
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = url.split("/").pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showNotification(`${label} diunduh!`, "success");
}

async function downloadSchedule() {
  triggerDownload(downloadUrl, "Jadwal");
}

function updateDownloadButtons(result) {
  const container = $("downloadBtnContainer");
  if (!container) return;

  if (result.comparison && result.download_urls) {
    const urls = result.download_urls;
    const winner = result.comparison.winner;
    container.innerHTML = `
            <div class="flex flex-col gap-2">
                <div class="text-gray-400 text-xs text-center mb-1">Download hasil per algoritma:</div>
                <div class="grid grid-cols-1 gap-2">
                    <button type="button" onclick="triggerDownload('${urls.ga_only}', 'Jadwal GA Murni')"
                        class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm ${winner === "ga_only" ? "ring-2 ring-yellow-400" : ""}">
                        <i class="fas fa-download"></i>
                        🧬 Genetika Murni ${winner === "ga_only" ? "🏆" : ""}
                        <span class="text-blue-200 text-xs ml-auto">penalti: ${result.comparison.ga_only.penalty.toFixed(0)}</span>
                    </button>
                    <button type="button" onclick="triggerDownload('${urls.ga_greedy}', 'Jadwal GA + Greedy')"
                        class="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm ${winner === "ga_greedy" ? "ring-2 ring-yellow-400" : ""}">
                        <i class="fas fa-download"></i>
                        🔀 GA + Greedy ${winner === "ga_greedy" ? "🏆" : ""}
                        <span class="text-purple-200 text-xs ml-auto">penalti: ${result.comparison.ga_greedy.penalty.toFixed(0)}</span>
                    </button>
                    <button type="button" onclick="triggerDownload('${urls.best}', 'Jadwal Terbaik')"
                        class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition">
                        <i class="fas fa-trophy"></i> Download Terbaik (Excel)
                    </button>
                </div>
            </div>`;
  } else {
    container.innerHTML = `
            <button type="button" onclick="downloadSchedule()"
                class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-lg transition">
                <i class="fas fa-download"></i> Download Jadwal (Excel)
            </button>`;
  }
}

// ===== PROGRESS UPDATE =====
function updateProgress(percentage, message) {
  $("progressBar").style.width = percentage + "%";
  $("progressText").textContent = percentage + "%";
  $("statusMessage").textContent = message;
}

// ===== DEBOUNCE FUNCTION =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedFilterList = debounce(filterList, 300);

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Inject panel riwayat jadwal ke dalam DOM
  const historyHTML = `
    <div class="mt-4">
      <button type="button" onclick="toggleHistoryPanel()"
        class="w-full flex items-center justify-between bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition">
        <span><i class="fas fa-history mr-2 text-blue-400"></i> Riwayat Jadwal (MongoDB)</span>
        <i class="fas fa-chevron-down text-gray-400"></i>
      </button>
      <div id="historyPanel" class="hidden mt-2 bg-slate-800 border border-slate-600 rounded-lg p-3">
        <div class="flex justify-between items-center mb-3">
          <span class="text-sm font-semibold text-gray-300">10 Jadwal Terakhir</span>
          <button onclick="loadScheduleHistory()" class="text-xs text-blue-400 hover:text-blue-300 transition">
            <i class="fas fa-sync-alt mr-1"></i>Refresh
          </button>
        </div>
        <div id="scheduleHistoryList" class="space-y-2 max-h-80 overflow-y-auto"></div>
      </div>
    </div>`;

  // Cari container yang pas untuk inject panel history (di bawah results atau di sidebar)
  const resultsContainer = $("resultsContainer");
  if (resultsContainer) {
    const historyWrapper = document.createElement("div");
    historyWrapper.innerHTML = historyHTML;
    resultsContainer.parentNode.insertBefore(
      historyWrapper,
      resultsContainer.nextSibling,
    );
  }

  loadDefaults();

  const roomCapEl = $("roomCapacity");
  if (roomCapEl)
    roomCapEl.addEventListener("input", (e) =>
      showRoomCapacityPreview(e.target.value),
    );

  [
    "courseSem",
    "courseDosen",
    "courseCapacity",
    "courseJam",
    "courseTipe",
  ].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", updateCoursePreview);
  });
  ["courseName", "courseCapacity", "courseJam"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", updateCoursePreview);
  });

  const form = $("configForm");
  if (form) {
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const active = document.activeElement;
        const isSubmitBtn = active && active.type === "submit";
        if (!isSubmitBtn) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (Object.keys(rooms).length === 0) {
        showNotification("Minimal ada 1 ruangan!", "error");
        return;
      }
      if (Object.keys(dosens).length === 0) {
        showNotification("Minimal ada 1 dosen!", "error");
        return;
      }
      if (Object.keys(courses).length === 0) {
        showNotification("Minimal ada 1 mata kuliah!", "error");
        return;
      }

      const semesterType = $("semesterType")
        ? $("semesterType").value
        : "ganjil";
      const selectedAlgo = document.querySelector(
        'input[name="algorithmMode"]:checked',
      );
      const algorithmMode = selectedAlgo ? selectedAlgo.value : "hybrid";

      const ga_params = {
        POPULATION_SIZE: parseInt($("populationSize").value),
        MAX_GENERATIONS: parseInt($("maxGenerations").value),
        INITIAL_MUTATION_RATE: parseFloat($("mutationRate").value),
        MIN_MUTATION_RATE: 0.08,
        HARD_CONSTRAINT_PENALTY: 1000,
        SOFT_CONSTRAINT_PENALTY: 0.5,
        MIN_GAP_HOURS: 3,
      };

      await submitOptimization({
        rooms,
        dosen: dosens,
        courses,
        ga_params,
        semester_type: semesterType,
        algorithm_mode: algorithmMode, // BARU
      });
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeRoomModal();
      closeDosenModal();
      closeCourseModal();
      closeDeleteConfirm();
    }
  });

  ["roomModal", "dosenModal", "courseModal", "deleteConfirmModal"].forEach(
    (modalId) => {
      const el = $(modalId);
      if (el) {
        el.addEventListener("click", (e) => {
          if (e.target === el) {
            if (modalId === "roomModal") closeRoomModal();
            else if (modalId === "dosenModal") closeDosenModal();
            else if (modalId === "courseModal") closeCourseModal();
            else if (modalId === "deleteConfirmModal") closeDeleteConfirm();
          }
        });
      }
    },
  );

  const roomSearch = $("roomSearch");
  if (roomSearch) {
    roomSearch.oninput = () => debouncedFilterList("room");
  }

  const dosenSearch = $("dosenSearch");
  if (dosenSearch) {
    dosenSearch.oninput = () => debouncedFilterList("dosen");
  }

  const courseSearch = $("courseSearch");
  if (courseSearch) {
    courseSearch.oninput = () => debouncedFilterList("course");
  }
});

// ===================================================================
// =================== FITUR RIWAYAT JADWAL ==========================
// ===================================================================

let _historyPreviewDownloadUrl = null;

// ----- Load dan tampilkan tabel riwayat -----
async function loadHistory() {
  const tbody = $("historyTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">
    <i class="fas fa-spinner fa-spin mr-2"></i>Memuat riwayat...</td></tr>`;

  try {
    const res = await fetch("/api/schedules/history?limit=20");
    const json = await res.json();
    if (json.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">
        <i class="fas fa-exclamation-triangle mr-2"></i>Error dari server: ${json.message || "Unknown error"}</td></tr>`;
      return;
    }
    if (!json.data || !json.data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">
        <i class="fas fa-inbox mr-2"></i>Belum ada jadwal tersimpan.</td></tr>`;
      return;
    }
    tbody.innerHTML = json.data
      .map((item) => {
        const date = new Date(item.created_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const semBadge =
          item.semester_type === "ganjil"
            ? `<span class="bg-blue-700 text-blue-100 text-xs px-2 py-0.5 rounded-full">Ganjil</span>`
            : `<span class="bg-purple-700 text-purple-100 text-xs px-2 py-0.5 rounded-full">Genap</span>`;
        const penaltyColor =
          item.penalty === 0 ? "text-green-400" : "text-yellow-400";
        const methodLabel =
          item.best_method !== "-"
            ? item.best_method
            : item.algorithm_mode || "-";
        return `<tr class="hover:bg-slate-750 transition text-gray-200">
        <td class="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">${date}</td>
        <td class="px-4 py-3">${semBadge}</td>
        <td class="px-4 py-3 font-mono font-bold ${penaltyColor}">${Number(item.penalty).toFixed(2)}</td>
        <td class="px-4 py-3 text-xs text-gray-300">${methodLabel}</td>
        <td class="px-4 py-3 text-center text-gray-300">${item.total_sessions || "-"}</td>
        <td class="px-4 py-3">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <button type="button" onclick="openHistoryPreview('${item._id}')"
              class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded transition flex items-center gap-1">
              <i class="fas fa-eye"></i> Preview
            </button>
            <button type="button" onclick="deleteHistorySchedule('${item._id}', '${item.algorithm_mode}')"
              class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2.5 py-1 rounded transition flex items-center gap-1">
              <i class="fas fa-trash"></i> Hapus
            </button>
          </div>
        </td>
      </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">
      <i class="fas fa-exclamation-triangle mr-2"></i>Gagal memuat riwayat: ${e.message}</td></tr>`;
  }
}

// ----- Preview jadwal dari riwayat -----
let _previewData = null;
let _previewScheduleData = null; // simpan full data untuk download fallback

async function openHistoryPreview(scheduleId) {
  _historyPreviewDownloadUrl = null;
  _previewData = null;
  _previewScheduleData = null;
  $("previewModalTitle").innerHTML =
    `<i class="fas fa-spinner fa-spin text-blue-400"></i> Memuat...`;
  $("previewInfoBar").innerHTML = "";
  $("previewTabsBar").innerHTML = "";
  $("previewContent").innerHTML = `<div class="text-center py-12 text-gray-400">
    <i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p>Memuat data jadwal...</p></div>`;
  show("historyPreviewModal");

  try {
    const res = await fetch(`/api/schedules/${scheduleId}/preview`);
    const json = await res.json();
    if (json.status !== "success") throw new Error(json.message);
    const data = json.data;
    _previewScheduleData = data;

    const date = new Date(data.created_at).toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    $("previewModalTitle").innerHTML =
      `<i class="fas fa-calendar-check text-blue-400"></i> Jadwal ${(data.semester_type || "").toUpperCase()} — ${date}`;

    // Info bar
    const meta = data.metadata || {};
    const penalty = Number(data.penalty) || 0;
    const penaltyColor = penalty === 0 ? "text-green-400" : "text-yellow-400";
    const penaltyStatus = penalty === 0 ? "OPTIMAL ✓" : "Sub-optimal";
    $("previewInfoBar").innerHTML = `
      <span class="bg-slate-700 px-3 py-1 rounded-lg text-sm">
        Penalti: <b class="${penaltyColor}">${penalty.toFixed(2)}</b>
        <span class="text-xs text-gray-500 ml-1">${penaltyStatus}</span>
      </span>
      <span class="bg-slate-700 px-3 py-1 rounded-lg text-sm">
        Metode: <b class="text-white">${meta.best_method || "-"}</b>
      </span>
      <span class="bg-slate-700 px-3 py-1 rounded-lg text-sm">
        Sesi: <b class="text-blue-300">${meta.total_sessions || "-"}</b>
      </span>
      <span class="bg-slate-700 px-3 py-1 rounded-lg text-sm">
        Semester: <b class="text-purple-300">${(data.semester_type || "-").toUpperCase()}</b>
      </span>`;

    // Download URL langsung ke API — generate on-demand dari MongoDB
    _historyPreviewDownloadUrl = `/api/schedules/${data._id}/download`;

    // Render structured_result (atau hasil rebuild dari raw schedule)
    const sr = data.structured_result;
    if (sr && Object.keys(sr).length) {
      renderPreviewFull(sr, meta, data);
      // Tampilkan banner jika data di-rebuild dari raw schedule
      if (data._rebuilt) {
        // Hapus banner lama dulu sebelum insert baru
        document
          .querySelectorAll("#previewRebuiltBanner")
          .forEach((el) => el.remove());
        const banner = document.createElement("div");
        banner.id = "previewRebuiltBanner";
        banner.className =
          "mx-6 mb-0 mt-0 bg-yellow-900 bg-opacity-40 border border-yellow-600 text-yellow-300 text-xs px-4 py-2 rounded-lg flex items-center gap-2";
        banner.innerHTML = `<i class="fas fa-info-circle"></i> Data jadwal ini di-rekonstruksi dari format lama — tampilan mungkin sedikit berbeda dari jadwal baru.`;
        const infoBar = $("previewInfoBar");
        if (infoBar && infoBar.parentNode) {
          infoBar.parentNode.insertBefore(banner, infoBar.nextSibling);
        }
      }
    } else {
      $("previewContent").innerHTML =
        `<p class="text-gray-400 text-center py-8">
        <i class="fas fa-exclamation-circle mr-2 text-yellow-400"></i>
        Data jadwal kosong atau tidak tersedia.</p>`;
    }
  } catch (e) {
    $("previewContent").innerHTML =
      `<div class="text-center py-12 text-red-400">
      <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
      <p>Gagal memuat preview: ${e.message}</p></div>`;
  }
}

// Render preview IDENTIK dengan tampilan hasil jadwal asli (Overview + tabs semester)
function renderPreviewFull(sr, meta, data) {
  const semesters = Object.keys(sr)
    .map((s) => parseInt(s))
    .sort((a, b) => a - b);
  const tabsBar = $("previewTabsBar");
  const content = $("previewContent");

  // === BUILD OVERVIEW HTML (seperti displayResults) ===
  const semTypeLabel = (data.semester_type || "").toUpperCase() || "-";
  const methodLabel = meta.best_method || meta.algorithm_mode || "-";
  const totalSesi =
    meta.total_sessions ||
    Object.values(sr).reduce(
      (acc, days) =>
        acc +
        Object.values(days).reduce((a, sessions) => a + sessions.length, 0),
      0,
    );

  let overviewHTML = `
    <div class="mb-4 grid grid-cols-2 gap-4">
      <div class="bg-blue-600 bg-opacity-20 border-2 border-blue-400 rounded-lg p-4 text-center">
        <div class="text-blue-300 text-sm font-semibold">Tipe Semester</div>
        <div class="text-white text-2xl font-bold">${semTypeLabel}</div>
      </div>
      <div class="bg-purple-600 bg-opacity-20 border-2 border-purple-400 rounded-lg p-4 text-center">
        <div class="text-purple-300 text-sm font-semibold">Metode Terbaik</div>
        <div class="text-white text-lg font-bold">${methodLabel}</div>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-slate-700 p-4 rounded text-center">
        <div class="text-2xl font-bold text-blue-400">${meta.total_courses || "-"}</div>
        <div class="text-gray-400 text-sm">Mata Kuliah</div>
      </div>
      <div class="bg-slate-700 p-4 rounded text-center">
        <div class="text-2xl font-bold text-green-400">${totalSesi}</div>
        <div class="text-gray-400 text-sm">Total Sesi</div>
      </div>
      <div class="bg-slate-700 p-4 rounded text-center">
        <div class="text-2xl font-bold text-purple-400">${semesters.length}</div>
        <div class="text-gray-400 text-sm">Semester</div>
      </div>
    </div>`;

  // Distribusi per hari (summary)
  const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
  const dayCount = {};
  dayOrder.forEach((d) => {
    dayCount[d] = 0;
  });
  semesters.forEach((sem) => {
    dayOrder.forEach((day) => {
      if (sr[sem] && sr[sem][day]) dayCount[day] += sr[sem][day].length;
    });
  });
  overviewHTML += `
    <div class="bg-slate-700 p-4 rounded-lg mb-2">
      <h3 class="text-base font-bold text-white mb-3 flex items-center gap-2">
        <i class="fas fa-chart-bar text-blue-400"></i> Distribusi Sesi per Hari
      </h3>
      <div class="space-y-2">
        ${dayOrder
          .map((day) => {
            const count = dayCount[day];
            const maxCount = Math.max(...Object.values(dayCount), 1);
            const pct = Math.round((count / maxCount) * 100);
            return `<div class="flex items-center gap-3">
            <span class="w-16 text-sm text-gray-300">${day}</span>
            <div class="flex-1 bg-slate-600 h-3 rounded-full">
              <div class="bg-blue-500 h-3 rounded-full transition-all" style="width:${pct}%"></div>
            </div>
            <span class="w-8 text-right text-sm text-white font-mono">${count}</span>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;

  // === BUILD TABS ===
  let tabsHTML = `<button type="button" onclick="switchPreviewTab('overview')"
    id="prevTab_overview"
    class="prev-tab-btn tab-btn active px-4 py-2 bg-blue-500 text-white rounded font-semibold whitespace-nowrap text-sm transition flex items-center gap-1">
    <i class="fas fa-chart-bar"></i> Overview
  </button>`;
  semesters.forEach((sem) => {
    tabsHTML += `<button type="button" onclick="switchPreviewTab('sem${sem}')"
      id="prevTab_sem${sem}"
      class="prev-tab-btn tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">
      Semester ${sem}
    </button>`;
  });
  tabsBar.innerHTML = tabsHTML;

  // === BUILD SEMESTER CONTENTS ===
  // Overview panel
  let panelsHTML = `<div id="prevPanel_overview" class="prev-panel">${overviewHTML}</div>`;

  // Per-semester panels (render card style seperti renderSemesterSchedule asli)
  semesters.forEach((sem) => {
    const semData = sr[sem] || {};
    let semHTML = "";
    dayOrder.forEach((day) => {
      if (!semData[day] || !semData[day].length) return;
      semHTML += `<div class="mb-4">
        <h4 class="text-lg font-bold text-blue-300 mb-2">
          <i class="fas fa-calendar-day"></i> ${day}
        </h4>
        <div class="space-y-2">`;
      semData[day].forEach((session) => {
        semHTML += `
          <div class="bg-slate-700 p-3 rounded border-l-4 border-blue-400">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="font-semibold text-white">${session.course || "-"}</div>
                <div class="text-sm text-gray-400">${session.dosen || "-"}</div>
              </div>
              <div class="text-right">
                <div class="text-green-400 font-mono text-sm">${session.start_time || "-"} - ${session.end_time || "-"}</div>
                <div class="text-sm text-gray-400">${session.room || "-"} | ${session.kelas || "-"}</div>
              </div>
            </div>
          </div>`;
      });
      semHTML += `</div></div>`;
    });
    if (!semHTML)
      semHTML = `<p class="text-gray-500 text-center py-8">Tidak ada sesi untuk semester ${sem}.</p>`;
    panelsHTML += `<div id="prevPanel_sem${sem}" class="prev-panel hidden">${semHTML}</div>`;
  });

  _previewData = { sr, semesters };
  content.innerHTML = panelsHTML;
}

function switchPreviewTab(tabName) {
  // Update button styles
  document.querySelectorAll(".prev-tab-btn").forEach((btn) => {
    btn.classList.remove("bg-blue-500", "text-white", "active");
    btn.classList.add("text-gray-300", "hover:bg-slate-700");
  });
  const activeBtn = $(`prevTab_${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add("bg-blue-500", "text-white", "active");
    activeBtn.classList.remove("text-gray-300", "hover:bg-slate-700");
  }
  // Show panel
  document
    .querySelectorAll(".prev-panel")
    .forEach((p) => p.classList.add("hidden"));
  const panel = $(`prevPanel_${tabName}`);
  if (panel) panel.classList.remove("hidden");
}

function closeHistoryPreview() {
  hide("historyPreviewModal");
  _previewData = null;
  _previewScheduleData = null;
  _historyPreviewDownloadUrl = null;
  // Bersihkan banner rebuilt agar tidak numpuk saat buka lagi
  document
    .querySelectorAll("#previewRebuiltBanner")
    .forEach((el) => el.remove());
}

async function downloadFromPreview() {
  if (!_historyPreviewDownloadUrl) {
    showToast("Link download tidak tersedia.", "error");
    return;
  }
  // Download langsung — server generate Excel on-demand dari MongoDB
  window.location.href = _historyPreviewDownloadUrl;
}

// ----- Hapus satu jadwal dari riwayat -----
function deleteHistorySchedule(scheduleId, algorithmMode) {
  openDeleteConfirm(
    "Yakin ingin menghapus jadwal ini dari riwayat? Tindakan ini tidak bisa dibatalkan.",
    async () => {
      try {
        const res = await fetch(`/api/schedules/${scheduleId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (json.status === "success") {
          showToast("Jadwal berhasil dihapus", "success");
          loadHistory();
        } else {
          showToast("Gagal menghapus: " + json.message, "error");
        }
      } catch (e) {
        showToast("Error: " + e.message, "error");
      }
    },
  );
}

// ----- Settings panel toggle -----
function toggleAutoDeleteSettings() {
  const panel = $("autoDeleteSettings");
  if (!panel) return;
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    loadAutoDeleteConfig(); // refresh config from server when opening
  } else {
    panel.classList.add("hidden");
  }
}

// ----- Load auto-delete config dari server -----
let _autoDeleteEnabled = false;
async function loadAutoDeleteConfig() {
  try {
    const res = await fetch("/api/schedules/auto-delete-config");
    const json = await res.json();
    if (json.status !== "success") return;
    const cfg = json.data;
    _autoDeleteEnabled = cfg.enabled;

    // Update toggle UI
    applyAutoDeleteToggleUI(_autoDeleteEnabled);

    // Update input fields
    if ($("autoDeleteDays")) $("autoDeleteDays").value = cfg.days;
    if ($("autoDeleteInterval"))
      $("autoDeleteInterval").value = cfg.interval_hours;

    // Scheduler status badge
    const badge = $("schedulerStatusBadge");
    if (badge) {
      if (!cfg.scheduler_available) {
        badge.textContent = "APScheduler tidak terinstall";
        badge.className =
          "text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 ml-auto";
      } else if (cfg.enabled) {
        badge.textContent = `✓ Aktif — cek tiap ${cfg.interval_hours}j`;
        badge.className =
          "text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 ml-auto";
      } else {
        badge.textContent = "Nonaktif";
        badge.className =
          "text-xs px-2 py-0.5 rounded-full bg-slate-600 text-gray-400 ml-auto";
      }
    }
  } catch (e) {
    console.error("Gagal load auto-delete config:", e);
  }
}

function applyAutoDeleteToggleUI(enabled) {
  const toggle = $("autoDeleteToggle");
  const thumb = $("autoDeleteToggleThumb");
  const statusText = $("autoDeleteStatusText");
  if (!toggle || !thumb) return;
  if (enabled) {
    toggle.classList.remove("bg-slate-500");
    toggle.classList.add("bg-orange-500");
    thumb.style.transform = "translateX(20px)";
    if (statusText) {
      statusText.textContent = "Aktif";
      statusText.className = "text-sm text-orange-300 font-semibold";
    }
  } else {
    toggle.classList.remove("bg-orange-500");
    toggle.classList.add("bg-slate-500");
    thumb.style.transform = "translateX(0)";
    if (statusText) {
      statusText.textContent = "Nonaktif";
      statusText.className = "text-sm text-gray-400";
    }
  }
}

function toggleAutoDelete() {
  _autoDeleteEnabled = !_autoDeleteEnabled;
  applyAutoDeleteToggleUI(_autoDeleteEnabled);
}

// ----- Simpan config ke server -----
async function saveAutoDeleteConfig() {
  const days = parseInt($("autoDeleteDays")?.value) || 7;
  const interval = parseInt($("autoDeleteInterval")?.value) || 24;
  try {
    const res = await fetch("/api/schedules/auto-delete-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: _autoDeleteEnabled,
        days,
        interval_hours: interval,
      }),
    });
    const json = await res.json();
    if (json.status === "success") {
      showToast("Konfigurasi disimpan ✓", "success");
      loadAutoDeleteConfig();
    } else {
      showToast("Gagal simpan: " + json.message, "error");
    }
  } catch (e) {
    showToast("Error: " + e.message, "error");
  }
}

// ----- Hapus jadwal lama (cleanup manual) -----
async function cleanupOldSchedules() {
  const days = parseInt($("autoDeleteDays")?.value) || 7;
  openDeleteConfirm(
    `Yakin ingin menghapus semua jadwal yang lebih tua dari ${days} hari? Tindakan ini tidak bisa dibatalkan.`,
    async () => {
      try {
        const res = await fetch("/api/schedules/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
        const json = await res.json();
        if (json.status === "success") {
          showToast(json.message, "success");
          loadHistory();
        } else {
          showToast("Gagal cleanup: " + json.message, "error");
        }
      } catch (e) {
        showToast("Error: " + e.message, "error");
      }
    },
  );
}

// ----- Toast notification helper (jika belum ada) -----
function showToast(message, type = "success") {
  const existing = document.getElementById("toastNotif");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "toastNotif";
  const bg =
    type === "success"
      ? "bg-green-600"
      : type === "error"
        ? "bg-red-600"
        : "bg-blue-600";
  toast.className = `fixed bottom-6 right-6 ${bg} text-white px-5 py-3 rounded-xl shadow-2xl z-[999] flex items-center gap-2 text-sm font-semibold transition-all`;
  toast.innerHTML = `<i class="fas fa-${type === "success" ? "check-circle" : "exclamation-circle"}"></i> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Auto-load riwayat saat halaman siap
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(loadHistory, 800); // delay kecil biar DOMContentLoaded utama selesai dulu
});

// Tutup modal preview kalau klik di luar
document.addEventListener("DOMContentLoaded", () => {
  const modal = $("historyPreviewModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeHistoryPreview();
    });
  }
});
