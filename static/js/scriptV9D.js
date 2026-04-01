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
    $(id).classList.remove('hidden');
}

function hide(id) {
    $(id).classList.add('hidden');
}

// ===== STATE TRACKING =====
let _editingRoomId = null;
let _editingDosenId = null;
let _editingCourseName = null;
let _pendingDeleteFn = null;

// ===== DELETE CONFIRM MODAL =====
function openDeleteConfirm(message, onConfirm) {
    $('deleteConfirmText').textContent = message;
    $('deleteConfirmBtn').onclick = () => { onConfirm(); closeDeleteConfirm(); };
    show('deleteConfirmModal');
}
function closeDeleteConfirm() {
    hide('deleteConfirmModal');
    _pendingDeleteFn = null;
}

// ===== ROOM FUNCTIONS (CRUD) =====
function openRoomModal(editId = null) {
    _editingRoomId = editId;

    if (editId) {
        // MODE EDIT
        const data = rooms[editId];
        $('roomModalTitle').innerHTML = `<i class="fas fa-edit text-yellow-400"></i> Edit Ruangan`;
        $('roomSaveBtnText').textContent = 'Simpan Perubahan';
        $('roomSaveBtn').className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';
        $('roomId').value = editId;
        $('roomId').disabled = true;
        $('roomId').classList.add('opacity-50', 'cursor-not-allowed');
        $('roomCapacity').value = data.kapasitas;
        showRoomCapacityPreview(data.kapasitas);
    } else {
        // MODE TAMBAH
        $('roomModalTitle').innerHTML = `<i class="fas fa-door-open text-blue-400"></i> Tambah Ruangan`;
        $('roomSaveBtnText').textContent = 'Simpan';
        $('roomSaveBtn').className = 'flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';
        $('roomId').value = '';
        $('roomId').disabled = false;
        $('roomId').classList.remove('opacity-50', 'cursor-not-allowed');
        $('roomCapacity').value = '';
        hide('roomCapacityPreview');
    }

    show('roomModal');
    // Trap focus ke dalam modal agar Enter tidak tembus ke form di background
    setTimeout(() => {
        if (!editId) $('roomId').focus();
        else $('roomCapacity').focus();
    }, 50);
}

function showRoomCapacityPreview(val) {
    const num = parseInt(val);
    if (!isNaN(num) && num >= 20) {
        $('roomCapacityPreviewText').textContent = `Kapasitas: ${num} orang`;
        show('roomCapacityPreview');
    } else {
        hide('roomCapacityPreview');
    }
}

function closeRoomModal() {
    hide('roomModal');
    _editingRoomId = null;
    document.activeElement && document.activeElement.blur();
}

function saveRoom() {
    const id = $('roomId').value.trim();
    const capacity = parseInt($('roomCapacity').value);

    if (!id) { showNotification('ID Ruangan tidak boleh kosong!', 'error'); return; }
    if (isNaN(capacity) || capacity < 20) { showNotification('Kapasitas minimal 20 orang!', 'error'); return; }

    if (_editingRoomId) {
        // UPDATE
        rooms[_editingRoomId].kapasitas = capacity;
        renderRoomList();
        closeRoomModal();
        showNotification(`Ruangan ${_editingRoomId} berhasil diupdate!`, 'success');
    } else {
        // CREATE
        if (rooms[id]) { showNotification('ID Ruangan sudah ada!', 'error'); return; }
        rooms[id] = { kapasitas: capacity };
        renderRoomList();
        closeRoomModal();
        showNotification(`Ruangan ${id} ditambahkan!`, 'success');
    }
}

function editRoom(id) {
    openRoomModal(id);
}

function deleteRoom(id) {
    openDeleteConfirm(
        `Hapus ruangan "${id}" (kapasitas: ${rooms[id]?.kapasitas} orang)? Tindakan ini tidak bisa dibatalkan.`,
        () => {
            delete rooms[id];
            renderRoomList();
            showNotification(`Ruangan ${id} dihapus!`, 'success');
        }
    );
}

function renderRoomList() {
    const list = $('roomsList');
    list.innerHTML = '';
    updateCounts();

    if (Object.keys(rooms).length === 0) {
        list.innerHTML = '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada ruangan. Klik "+ Tambah Ruangan"</div>';
        return;
    }

    Object.entries(rooms).forEach(([id, data]) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition';
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
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    if (editId) {
        // MODE EDIT
        const data = dosens[editId];
        const name = typeof data === 'string' ? data : data.name;
        const availDays = typeof data === 'object' && data.available_days ? data.available_days : days;

        $('dosenModalTitle').innerHTML = `<i class="fas fa-user-edit text-yellow-400"></i> Edit Dosen`;
        $('dosenSaveBtnText').textContent = 'Simpan Perubahan';
        $('dosenSaveBtn').className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';

        $('dosenId').value = editId;
        $('dosenId').disabled = true;
        $('dosenId').classList.add('opacity-50', 'cursor-not-allowed');
        $('dosenName').value = name;

        days.forEach(day => {
            const cb = $(`day${day}`);
            if (cb) cb.checked = availDays.includes(day);
        });
    } else {
        // MODE TAMBAH
        $('dosenModalTitle').innerHTML = `<i class="fas fa-user-tie text-purple-400"></i> Tambah Dosen`;
        $('dosenSaveBtnText').textContent = 'Simpan';
        $('dosenSaveBtn').className = 'flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';

        $('dosenId').value = '';
        $('dosenId').disabled = false;
        $('dosenId').classList.remove('opacity-50', 'cursor-not-allowed');
        $('dosenName').value = '';
        days.forEach(day => { const cb = $(`day${day}`); if (cb) cb.checked = true; });
    }

    show('dosenModal');
    setTimeout(() => {
        if (!editId) $('dosenId').focus();
        else $('dosenName').focus();
    }, 50);
}

function closeDosenModal() {
    hide('dosenModal');
    _editingDosenId = null;
    document.activeElement && document.activeElement.blur();
}

function saveDosen() {
    const id = $('dosenId').value.trim();
    const name = $('dosenName').value.trim();

    if (!id) { showNotification('ID Dosen tidak boleh kosong!', 'error'); return; }
    if (!name) { showNotification('Nama Dosen tidak boleh kosong!', 'error'); return; }

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const availableDays = days.filter(day => { const cb = $(`day${day}`); return cb && cb.checked; });

    if (availableDays.length === 0) { showNotification('Pilih minimal 1 hari mengajar!', 'error'); return; }

    if (_editingDosenId) {
        // UPDATE
        dosens[_editingDosenId] = { name, available_days: availableDays };
        renderDosenList();
        updateDosenDropdown();
        renderCourseList(); // refresh karena nama dosen mungkin berubah
        closeDosenModal();
        showNotification(`Dosen ${name} berhasil diupdate!`, 'success');
    } else {
        // CREATE
        if (dosens[id]) { showNotification('ID Dosen sudah ada!', 'error'); return; }
        dosens[id] = { name, available_days: availableDays };
        renderDosenList();
        updateDosenDropdown();
        closeDosenModal();
        showNotification(`Dosen ${name} ditambahkan!`, 'success');
    }
}

function editDosen(id) {
    openDosenModal(id);
}

function deleteDosen(id) {
    const name = typeof dosens[id] === 'string' ? dosens[id] : dosens[id]?.name || id;
    // Cek apakah dosen masih dipakai di mata kuliah
    const usedIn = Object.entries(courses).filter(([, c]) => c.dosen === id).map(([n]) => n);
    const warningText = usedIn.length > 0
        ? `Dosen "${name}" (${id}) masih dipakai di ${usedIn.length} mata kuliah: ${usedIn.slice(0, 3).join(', ')}${usedIn.length > 3 ? '...' : ''}. Tetap hapus?`
        : `Hapus dosen "${name}" (${id})? Tindakan ini tidak bisa dibatalkan.`;

    openDeleteConfirm(warningText, () => {
        delete dosens[id];
        renderDosenList();
        updateDosenDropdown();
        renderCourseList();
        showNotification(`Dosen ${name} dihapus!`, 'success');
    });
}

function renderDosenList() {
    const list = $('dosenList');
    list.innerHTML = '';
    updateCounts();

    if (Object.keys(dosens).length === 0) {
        list.innerHTML = '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada dosen. Klik "+ Tambah Dosen"</div>';
        return;
    }

    const dayColors = { Senin: 'bg-blue-700', Selasa: 'bg-purple-700', Rabu: 'bg-green-700', Kamis: 'bg-yellow-700', Jumat: 'bg-red-700' };

    Object.entries(dosens).forEach(([id, data]) => {
        const name = typeof data === 'string' ? data : data.name;
        const availableDays = typeof data === 'object' && data.available_days
            ? data.available_days
            : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

        const dayBadges = availableDays.map(d =>
            `<span class="text-xs px-1.5 py-0.5 rounded ${dayColors[d] || 'bg-slate-600'} text-white">${d.slice(0, 3)}</span>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'flex justify-between items-start bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition';
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
    const select = $('courseDosen');
    const selected = select.value;
    select.innerHTML = '<option value="">-- Pilih Dosen --</option>';

    Object.entries(dosens).forEach(([id, data]) => {
        const name = typeof data === 'string' ? data : data.name;
        const option = document.createElement('option');
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
        // MODE EDIT
        const data = courses[editName];
        $('courseModalTitle').innerHTML = `<i class="fas fa-book-open text-yellow-400"></i> Edit Mata Kuliah`;
        $('courseSaveBtnText').textContent = 'Simpan Perubahan';
        $('courseSaveBtn').className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';

        $('courseName').value = editName;
        $('courseName').disabled = true;
        $('courseName').classList.add('opacity-50', 'cursor-not-allowed');

        $('courseSem').value = data.sem;
        $('courseDosen').value = data.dosen;
        $('courseCapacity').value = data.kapasitas_kelas;
        $('courseJam').value = data.jam;
        $('courseTipe').value = data.tipe;

        updateCoursePreview();
    } else {
        // MODE TAMBAH
        $('courseModalTitle').innerHTML = `<i class="fas fa-book text-yellow-400"></i> Tambah Mata Kuliah`;
        $('courseSaveBtnText').textContent = 'Simpan';
        $('courseSaveBtn').className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2';

        $('courseName').value = '';
        $('courseName').disabled = false;
        $('courseName').classList.remove('opacity-50', 'cursor-not-allowed');
        $('courseSem').value = '1';
        $('courseDosen').value = '';
        $('courseCapacity').value = '';
        $('courseJam').value = '';
        $('courseTipe').value = 'gabungan';
        hide('coursePreview');
    }

    show('courseModal');
    setTimeout(() => {
        if (!editName) $('courseName').focus();
        else $('courseCapacity').focus();
    }, 50);
}

function updateCoursePreview() {
    const name = $('courseName').value.trim() || '?';
    const sem = $('courseSem').value;
    const dosenId = $('courseDosen').value;
    const dosenData = dosens[dosenId];
    const dosenName = dosenId ? (typeof dosenData === 'string' ? dosenData : dosenData?.name || dosenId) : '-';
    const cap = $('courseCapacity').value;
    const jam = $('courseJam').value;
    const tipe = $('courseTipe').value;

    $('coursePreviewText').textContent =
        `${name} | Sem ${sem} | ${dosenId ? `${dosenId} (${dosenName})` : '-'} | ${cap || '?'} orang | ${jam || '?'} jam | Kelas: ${tipe}`;
    show('coursePreview');
}

function closeCourseModal() {
    hide('courseModal');
    _editingCourseName = null;
    document.activeElement && document.activeElement.blur();
}

function saveCourse() {
    const name = $('courseName').value.trim();
    const sem = parseInt($('courseSem').value);
    const dosenId = $('courseDosen').value;
    const capacity = parseInt($('courseCapacity').value);
    const jam = parseInt($('courseJam').value);
    const tipe = $('courseTipe').value;

    if (!name) { showNotification('Nama Mata Kuliah tidak boleh kosong!', 'error'); return; }
    if (!dosenId) { showNotification('Pilih Dosen terlebih dahulu!', 'error'); return; }
    if (isNaN(capacity) || capacity < 20 || capacity > 150) { showNotification('Kapasitas harus 20-150 orang!', 'error'); return; }
    if (isNaN(jam) || jam < 1 || jam > 6) { showNotification('Durasi harus 1-6 jam!', 'error'); return; }

    const courseData = { sem, dosen: dosenId, kapasitas_kelas: capacity, jam, tipe, sesi: 1 };

    if (_editingCourseName) {
        // UPDATE
        courses[_editingCourseName] = courseData;
        renderCourseList();
        closeCourseModal();
        showNotification(`${_editingCourseName} berhasil diupdate!`, 'success');
    } else {
        // CREATE
        if (courses[name]) { showNotification('Nama Mata Kuliah sudah ada!', 'error'); return; }
        courses[name] = courseData;
        renderCourseList();
        closeCourseModal();
        showNotification(`${name} ditambahkan!`, 'success');
    }
}

function editCourse(name) {
    openCourseModal(name);
}

function deleteCourse(name) {
    const data = courses[name];
    const dosenData = dosens[data?.dosen];
    const dosenName = dosenData ? (typeof dosenData === 'string' ? dosenData : dosenData.name) : data?.dosen;
    openDeleteConfirm(
        `Hapus mata kuliah "${name}" (Sem ${data?.sem}, ${dosenName})? Tindakan ini tidak bisa dibatalkan.`,
        () => {
            delete courses[name];
            renderCourseList();
            showNotification(`${name} dihapus!`, 'success');
        }
    );
}

function renderCourseList(filterQuery = '', filterSem = '') {
    const list = $('coursesList');
    list.innerHTML = '';

    updateCounts();

    if (Object.keys(courses).length === 0) {
        list.innerHTML = '<div class="text-gray-400 text-sm text-center py-4 italic">Belum ada mata kuliah. Klik "+ Tambah Mata Kuliah"</div>';
        return;
    }

    const semColors = { 1: 'bg-blue-700', 2: 'bg-cyan-700', 3: 'bg-green-700', 4: 'bg-teal-700', 5: 'bg-yellow-700', 6: 'bg-orange-700', 7: 'bg-red-700', 8: 'bg-pink-700' };
    const q = filterQuery.toLowerCase();

    // Kelompokkan per semester untuk tampilan rapi
    const grouped = {};
    Object.entries(courses).forEach(([name, data]) => {
        if (filterSem && String(data.sem) !== filterSem) return;
        if (q && !name.toLowerCase().includes(q)) return;
        if (!grouped[data.sem]) grouped[data.sem] = [];
        grouped[data.sem].push({ name, ...data });
    });

    if (Object.keys(grouped).length === 0) {
        list.innerHTML = '<div class="text-gray-400 text-sm text-center py-4 italic">Tidak ada hasil ditemukan.</div>';
        return;
    }

    Object.keys(grouped).sort((a, b) => a - b).forEach(sem => {
        const semLabel = document.createElement('div');
        semLabel.className = `text-xs font-bold px-2 py-1 rounded mb-1 mt-2 first:mt-0 ${semColors[sem] || 'bg-slate-600'} text-white inline-block`;
        semLabel.textContent = `Semester ${sem} (${parseInt(sem) % 2 === 1 ? 'Ganjil' : 'Genap'}) — ${grouped[sem].length} MK`;
        list.appendChild(semLabel);

        grouped[sem].forEach(({ name, dosen, kapasitas_kelas, jam, tipe }) => {
            const dosenData = dosens[dosen];
            const dosenName = dosenData ? (typeof dosenData === 'string' ? dosenData : dosenData.name) : dosen;
            const tipeColor = tipe === 'gabungan' ? 'text-green-300' : 'text-orange-300';

            const div = document.createElement('div');
            div.className = 'flex justify-between items-start bg-slate-600 hover:bg-slate-550 p-3 rounded-lg border border-slate-500 transition mb-1';
            div.innerHTML = `
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class="w-8 h-8 ${semColors[parseInt(sem)] || 'bg-slate-600'} bg-opacity-80 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
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
    if (type === 'room') {
        const q = ($('roomSearch')?.value || '').toLowerCase();
        document.querySelectorAll('#roomsList > div').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    } else if (type === 'dosen') {
        const q = ($('dosenSearch')?.value || '').toLowerCase();
        document.querySelectorAll('#dosenList > div').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    } else if (type === 'course') {
        const q = ($('courseSearch')?.value || '').toLowerCase();
        const semFilter = $('courseFilterSem')?.value || '';
        // Untuk course, kita re-render dengan filter agar label semester tidak ikut tersembunyi
        renderCourseList(q, semFilter);
    }
}

function updateCounts() {
    const rc = $('roomCount'); if (rc) rc.textContent = Object.keys(rooms).length;
    const dc = $('dosenCount'); if (dc) dc.textContent = Object.keys(dosens).length;
    const cc = $('courseCount'); if (cc) cc.textContent = Object.keys(courses).length;
}

// ===== LOAD DEFAULTS ===== (⭐ MODIFIED)
async function loadDefaults() {
    rooms = {
        'R01': { kapasitas: 150 },
        'R02': { kapasitas: 100 },
        'R03': { kapasitas: 80 },
        'R04': { kapasitas: 70 },
        'R05': { kapasitas: 80 },
        'R06': { kapasitas: 60 },
        'R07': { kapasitas: 55 },
        'R08': { kapasitas: 45 },
    };
    
    // ⭐ FITUR BARU: Dosen dengan hari mengajar
    dosens = {
        'D1': { name: 'Dosen A', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D2': { name: 'Dosen B', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D3': { name: 'Dosen C', available_days: ['Senin', 'Rabu', 'Jumat'] },
        'D4': { name: 'Dosen D', available_days: ['Selasa', 'Kamis'] },
        'D5': { name: 'Dosen E', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D6': { name: 'Dosen F', available_days: ['Senin', 'Rabu', 'Kamis'] },
        'D7': { name: 'Dosen G', available_days: ['Selasa', 'Kamis', 'Jumat'] },
        'D8': { name: 'Dosen H', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D9': { name: 'Dosen I', available_days: ['Senin', 'Selasa', 'Rabu'] },
        'D10': { name: 'Dosen J', available_days: ['Rabu', 'Kamis', 'Jumat'] },
        'D11': { name: 'Dosen K', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D12': { name: 'Dosen L', available_days: ['Selasa', 'Rabu', 'Kamis'] },
        'D13': { name: 'Dosen M', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D14': { name: 'Dosen N', available_days: ['Senin', 'Rabu', 'Jumat'] },
        'D15': { name: 'Dosen O', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D16': { name: 'Dosen P', available_days: ['Selasa', 'Kamis', 'Jumat'] },
        'D17': { name: 'Dosen Q', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D18': { name: 'Dosen R', available_days: ['Senin', 'Rabu', 'Kamis'] },
        'D19': { name: 'Dosen S', available_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] },
        'D20': { name: 'Dosen T', available_days: ['Selasa', 'Rabu', 'Kamis'] },
    };
    
    courses = {
        // Semester 1 (Ganjil)
        'KALKULUS_I': { sem: 1, dosen: 'D1', kapasitas_kelas: 63, jam: 3, tipe: 'terpisah', sesi: 1 },
        'ALGORITMA_I': { sem: 1, dosen: 'D2', kapasitas_kelas: 63, jam: 2, tipe: 'terpisah', sesi: 1 },
        'FISIKA': { sem: 1, dosen: 'D3', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'PENGANTAR_ALGORITMA': { sem: 1, dosen: 'D4', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'BAHASA_INDONESIA': { sem: 1, dosen: 'D5', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'AGAMA_ISLAM': { sem: 1, dosen: 'D6', kapasitas_kelas: 63, jam: 2, tipe: 'gabungan', sesi: 1 },
        'AGAMA_KRISTEN': { sem: 1, dosen: 'D7', kapasitas_kelas: 63, jam: 2, tipe: 'gabungan', sesi: 1 },

        // Semester 2 (Genap) - ⭐ ADDED
        'KALKULUS_II': { sem: 2, dosen: 'D1', kapasitas_kelas: 63, jam: 3, tipe: 'terpisah', sesi: 1 },
        'ALGORITMA_II': { sem: 2, dosen: 'D2', kapasitas_kelas: 63, jam: 2, tipe: 'terpisah', sesi: 1 },
        'KIMIA_DASAR': { sem: 2, dosen: 'D3', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },

        // Semester 3 (Ganjil)
        'STATISTIKA': { sem: 3, dosen: 'D8', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'SISTEM_DIGITAL': { sem: 3, dosen: 'D9', kapasitas_kelas: 45, jam: 2, tipe: 'terpisah', sesi: 1 },
        'M_DISKRIT': { sem: 3, dosen: 'D10', kapasitas_kelas: 93, jam: 3, tipe: 'gabungan', sesi: 1 },
        'IMK': { sem: 3, dosen: 'D4', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'STRUKTUR_DATA': { sem: 3, dosen: 'D11', kapasitas_kelas: 45, jam: 3, tipe: 'terpisah', sesi: 1 },
        'PPKN': { sem: 3, dosen: 'D12', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'BASIS_DATA': { sem: 3, dosen: 'D13', kapasitas_kelas: 45, jam: 2, tipe: 'terpisah', sesi: 1 },

        // Semester 5 (Ganjil)
        'JST': { sem: 5, dosen: 'D15', kapasitas_kelas: 40, jam: 3, tipe: 'terpisah', sesi: 1 },
        'APK_WEB': { sem: 5, dosen: 'D16', kapasitas_kelas: 80, jam: 3, tipe: 'gabungan', sesi: 1 },
        'SISTEM_INFO': { sem: 5, dosen: 'D17', kapasitas_kelas: 80, jam: 3, tipe: 'gabungan', sesi: 1 },
        'GRAFKOM': { sem: 5, dosen: 'D18', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
        'SISTEM_OPERASI': { sem: 5, dosen: 'D14', kapasitas_kelas: 76, jam: 2, tipe: 'gabungan', sesi: 1 },
        'METODE': { sem: 5, dosen: 'D4', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
        'JARKOM': { sem: 5, dosen: 'D18', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },

        // Semester 7 (Ganjil)
        'ETIKA': { sem: 7, dosen: 'D19', kapasitas_kelas: 76, jam: 2, tipe: 'gabungan', sesi: 1 },
        'SPK': { sem: 7, dosen: 'D13', kapasitas_kelas: 76, jam: 3, tipe: 'gabungan', sesi: 1 },
        'ML': { sem: 7, dosen: 'D20', kapasitas_kelas: 40, jam: 3, tipe: 'terpisah', sesi: 1 },
        'SOFT': { sem: 7, dosen: 'D16', kapasitas_kelas: 76, jam: 3, tipe: 'gabungan', sesi: 1 },
        'MPPL': { sem: 7, dosen: 'D19', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
        'KRIPTO': { sem: 7, dosen: 'D2', kapasitas_kelas: 76, jam: 3, tipe: 'gabungan', sesi: 1 },
    };
    
    renderRoomList();
    renderDosenList();
    renderCourseList();
    updateDosenDropdown();
    showNotification('Data default dimuat!', 'success');
}

// ===== API SUBMISSION =====
async function submitOptimization(data) {
    show('statusContainer');
    hide('resultsContainer');
    updateProgress(0, 'Validasi data...');
    
    try {
        updateProgress(10, 'Mengirim ke server...');
        
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Optimization failed: ' + response.statusText);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            updateProgress(100, 'Selesai!');
            displayResults(result);
            setTimeout(() => {
                hide('statusContainer');
                show('resultsContainer');
            }, 500);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        hide('statusContainer');
    }
}

// ===== DISPLAY RESULTS ===== (⭐ MODIFIED)
function displayResults(result) {
    currentSchedule = result;
    downloadUrl = result.download_url;
    downloadUrls = result.download_urls || { best: result.download_url };
    
    $('penaltyText').textContent = `Penalti Total: ${result.final_penalty.toFixed(2)} (${result.penalty_status})`;
    
    const badge = $('penaltyBadge');
    if (result.final_penalty === 0) {
        badge.textContent = 'OPTIMAL ✓';
        badge.classList.remove('bg-white', 'bg-opacity-20');
        badge.classList.add('bg-green-300', 'bg-opacity-30');
    }
    
    // Update tombol download sesuai mode
    updateDownloadButtons(result);
    
    // ⭐ Show semester type info
    const semesterTypeText = result.semester_type === 'ganjil' ? 'GANJIL' : 'GENAP';
    
    let overviewHTML = `
        <div class="mb-4 bg-blue-600 bg-opacity-20 border-2 border-blue-400 rounded-lg p-4 text-center">
            <div class="text-blue-300 text-sm font-semibold">Tipe Semester</div>
            <div class="text-white text-2xl font-bold">${semesterTypeText}</div>
        </div>`;
    
    // ⭐ Tampilkan perbandingan jika ada
    if (result.comparison) {
        const comp = result.comparison;
        const penaltyImprovement = comp.penalty_improvement;
        const percentageImprovement = comp.penalty_improvement_percentage;
        const winner = comp.winner;
        
        overviewHTML += `
        <div class="mb-4 bg-purple-900 bg-opacity-30 border-2 border-purple-400 rounded-lg p-4">
            <h3 class="text-purple-300 text-lg font-bold mb-3 flex items-center">
                <i class="fas fa-balance-scale mr-2"></i> Hasil Perbandingan Algoritma
            </h3>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <!-- Genetika Murni -->
                <div class="bg-slate-700 bg-opacity-50 p-4 rounded ${winner === 'ga_only' ? 'border-2 border-yellow-400' : ''}">
                    <div class="text-center mb-2">
                        <div class="text-sm text-gray-400">Genetika Murni</div>
                        ${winner === 'ga_only' ? '<div class="text-yellow-400 text-xs">🏆 TERBAIK</div>' : ''}
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Penalti:</span>
                            <span class="text-white font-mono">${comp.ga_only.penalty.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Waktu:</span>
                            <span class="text-white font-mono">${comp.ga_only.time.toFixed(2)}s</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Generasi:</span>
                            <span class="text-white font-mono">${comp.ga_only.generations}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Status:</span>
                            <span class="${comp.ga_only.status === 'optimal' ? 'text-green-400' : 'text-yellow-400'}">${comp.ga_only.status}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Genetika + Greedy -->
                <div class="bg-slate-700 bg-opacity-50 p-4 rounded ${winner === 'ga_greedy' ? 'border-2 border-yellow-400' : ''}">
                    <div class="text-center mb-2">
                        <div class="text-sm text-gray-400">Genetika + Greedy</div>
                        ${winner === 'ga_greedy' ? '<div class="text-yellow-400 text-xs">🏆 TERBAIK</div>' : ''}
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Penalti:</span>
                            <span class="text-white font-mono">${comp.ga_greedy.penalty.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Waktu Total:</span>
                            <span class="text-white font-mono">${comp.ga_greedy.time.toFixed(2)}s</span>
                        </div>
                        <div class="flex justify-between text-xs">
                            <span class="text-gray-500">• GA:</span>
                            <span class="text-gray-300 font-mono">${comp.ga_greedy.ga_time.toFixed(2)}s</span>
                        </div>
                        <div class="flex justify-between text-xs">
                            <span class="text-gray-500">• Greedy:</span>
                            <span class="text-gray-300 font-mono">${comp.ga_greedy.greedy_time.toFixed(2)}s</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Perbaikan:</span>
                            <span class="text-green-400 font-mono">${comp.ga_greedy.improvements}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Status:</span>
                            <span class="${comp.ga_greedy.status === 'optimal' ? 'text-green-400' : 'text-yellow-400'}">${comp.ga_greedy.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Summary -->
            <div class="bg-slate-800 bg-opacity-50 p-3 rounded text-center">
                <div class="text-sm text-gray-400 mb-1">Pengurangan Penalti</div>
                <div class="text-2xl font-bold ${penaltyImprovement > 0 ? 'text-green-400' : (penaltyImprovement < 0 ? 'text-red-400' : 'text-gray-400')}">
                    ${penaltyImprovement > 0 ? '-' : (penaltyImprovement < 0 ? '+' : '')}${Math.abs(penaltyImprovement).toFixed(2)}
                    ${penaltyImprovement !== 0 ? ` (${Math.abs(percentageImprovement).toFixed(1)}%)` : ''}
                </div>
                ${penaltyImprovement > 0 ? '<div class="text-xs text-green-300 mt-1">Greedy berhasil memperbaiki solusi!</div>' : ''}
                ${penaltyImprovement < 0 ? '<div class="text-xs text-red-300 mt-1">GA murni lebih baik</div>' : ''}
                ${penaltyImprovement === 0 ? '<div class="text-xs text-gray-400 mt-1">Hasil sama</div>' : ''}
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
    
    const overviewContent = $('overviewContent');
    overviewContent.innerHTML = overviewHTML;
    
    // ⭐ Dynamic semester rendering based on result
    const semesters = Object.keys(result.structured_result).map(s => parseInt(s)).sort((a, b) => a - b);
    
    // Update tabs dynamically
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        let tabsHTML = '<button onclick="switchTab(\'overview\')" class="tab-btn active px-4 py-2 bg-blue-500 text-white rounded font-semibold whitespace-nowrap text-sm transition"><i class="fas fa-chart-bar"></i> Overview</button>';
        
        semesters.forEach(sem => {
            tabsHTML += `<button onclick="switchTab('sem${sem}')" class="tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">Sem ${sem}</button>`;
        });
        
        tabsContainer.innerHTML = tabsHTML;
    }
    
    semesters.forEach(sem => {
        const semData = result.structured_result[sem];
        if (semData) {
            renderSemesterSchedule(sem, semData);
        }
    });
}

function renderSemesterSchedule(semester, semesterData) {
    const contentDiv = $(`sem${semester}Content`);
    if (!contentDiv) {
        console.warn(`Content div for semester ${semester} not found`);
        return;
    }
    
    let html = '';
    
    const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    dayOrder.forEach(day => {
        if (semesterData[day]) {
            html += `<div class="mb-4">
                <h4 class="text-lg font-bold text-blue-300 mb-2">
                    <i class="fas fa-calendar-day"></i> ${day}
                </h4>
                <div class="space-y-2">`;
            
            semesterData[day].forEach(session => {
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
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('hover:bg-slate-700', 'text-gray-300');
    });
    
    show(tabName);
    event.target.classList.remove('hover:bg-slate-700', 'text-gray-300');
    event.target.classList.add('bg-blue-500', 'text-white');
}

// ===== DOWNLOAD =====
function triggerDownload(url, label) {
    if (!url) { showNotification('File tidak tersedia!', 'error'); return; }
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`${label} diunduh!`, 'success');
}

async function downloadSchedule() {
    triggerDownload(downloadUrl, 'Jadwal');
}

function updateDownloadButtons(result) {
    const container = $('downloadBtnContainer');
    if (!container) return;
    
    if (result.comparison && result.download_urls) {
        const urls = result.download_urls;
        const winner = result.comparison.winner;
        container.innerHTML = `
            <div class="flex flex-col gap-2">
                <div class="text-gray-400 text-xs text-center mb-1">Download hasil per algoritma:</div>
                <div class="grid grid-cols-1 gap-2">
                    <button type="button" onclick="triggerDownload('${urls.ga_only}', 'Jadwal GA Murni')"
                        class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm ${winner === 'ga_only' ? 'ring-2 ring-yellow-400' : ''}">
                        <i class="fas fa-download"></i> 
                        🧬 Genetika Murni ${winner === 'ga_only' ? '🏆' : ''}
                        <span class="text-blue-200 text-xs ml-auto">penalti: ${result.comparison.ga_only.penalty.toFixed(0)}</span>
                    </button>
                    <button type="button" onclick="triggerDownload('${urls.ga_greedy}', 'Jadwal GA + Greedy')"
                        class="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm ${winner === 'ga_greedy' ? 'ring-2 ring-yellow-400' : ''}">
                        <i class="fas fa-download"></i>
                        🔀 GA + Greedy ${winner === 'ga_greedy' ? '🏆' : ''}
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
    $('progressBar').style.width = percentage + '%';
    $('progressText').textContent = percentage + '%';
    $('statusMessage').textContent = message;
}

// ===== NOTIFICATION =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    
    let bgColor = 'bg-blue-500';
    let icon = 'fas fa-info-circle';
    
    if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = 'fas fa-check-circle';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        icon = 'fas fa-exclamation-circle';
    }
    
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white font-semibold ${bgColor} shadow-lg flex items-center gap-2 z-50`;
    notification.innerHTML = `<i class="${icon}"></i> ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ===== INIT — semua listener DOM dipasang setelah DOM siap =====
document.addEventListener('DOMContentLoaded', () => {
    loadDefaults();

    // ── roomCapacity preview ──
    const roomCapEl = $('roomCapacity');
    if (roomCapEl) roomCapEl.addEventListener('input', e => showRoomCapacityPreview(e.target.value));

    // ── course field preview realtime ──
    ['courseSem', 'courseDosen', 'courseCapacity', 'courseJam', 'courseTipe'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('change', updateCoursePreview);
    });
    ['courseName', 'courseCapacity', 'courseJam'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', updateCoursePreview);
    });

    // ── Form submit (PALING KRITIS — harus di dalam DOMContentLoaded) ──
    const form = $('configForm');
    if (form) {
        // Guard: blokir Enter di semua elemen dalam form kecuali jika fokus
        // tepat di tombol submit. Ini mencegah optimasi tidak sengaja terpicu
        // saat user mengetik di search box atau field parameter.
        form.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const active = document.activeElement;
                const isSubmitBtn = active && active.type === 'submit';
                if (!isSubmitBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (Object.keys(rooms).length === 0) {
                showNotification('Minimal ada 1 ruangan!', 'error'); return;
            }
            if (Object.keys(dosens).length === 0) {
                showNotification('Minimal ada 1 dosen!', 'error'); return;
            }
            if (Object.keys(courses).length === 0) {
                showNotification('Minimal ada 1 mata kuliah!', 'error'); return;
            }

            const semesterType = $('semesterType') ? $('semesterType').value : 'ganjil';
            const compareMode  = $('compareMode')  ? $('compareMode').checked : false;

            const ga_params = {
                POPULATION_SIZE:      parseInt($('populationSize').value),
                MAX_GENERATIONS:      parseInt($('maxGenerations').value),
                INITIAL_MUTATION_RATE: parseFloat($('mutationRate').value),
                MIN_MUTATION_RATE:    0.08,
                HARD_CONSTRAINT_PENALTY: 1000,
                SOFT_CONSTRAINT_PENALTY: 0.5,
                MIN_GAP_HOURS: 3
            };

            await submitOptimization({
                rooms,
                dosen: dosens,
                courses,
                ga_params,
                semester_type: semesterType,
                compare_mode: compareMode
            });
        });
    }

    // ── ESC untuk menutup modal ──
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeRoomModal();
            closeDosenModal();
            closeCourseModal();
            closeDeleteConfirm();
        }
    });

    // ── Klik backdrop untuk menutup modal ──
    ['roomModal', 'dosenModal', 'courseModal', 'deleteConfirmModal'].forEach(modalId => {
        const el = $(modalId);
        if (el) {
            el.addEventListener('click', e => {
                if (e.target === el) {
                    if (modalId === 'roomModal')          closeRoomModal();
                    else if (modalId === 'dosenModal')    closeDosenModal();
                    else if (modalId === 'courseModal')   closeCourseModal();
                    else if (modalId === 'deleteConfirmModal') closeDeleteConfirm();
                }
            });
        }
    });
});