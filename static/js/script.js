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

// ===== ENHANCED VALIDATION FUNCTIONS =====
function validateRoomId(id) {
    const errors = [];
    
    if (!id || id.trim() === '') {
        errors.push('ID Ruangan tidak boleh kosong');
        return errors;
    }
    
    id = id.trim().toUpperCase();
    
    if (id.length < 2 || id.length > 10) {
        errors.push('ID Ruangan harus 2-10 karakter');
    }
    
    if (!/^[A-Z0-9]+$/.test(id)) {
        errors.push('ID Ruangan hanya boleh huruf kapital dan angka');
    }
    
    if (!_editingRoomId) {
        const existing = Object.keys(rooms).find(
            r => r.toUpperCase() === id && r !== id
        );
        if (existing) {
            errors.push(`Ruangan dengan ID mirip sudah ada: ${existing}`);
        }
    }
    
    return errors;
}

function validateRoomCapacity(capacity) {
    const errors = [];
    
    if (capacity === null || capacity === undefined || capacity === '') {
        errors.push('Kapasitas tidak boleh kosong');
        return errors;
    }
    
    const num = Number(capacity);
    
    if (isNaN(num)) {
        errors.push('Kapasitas harus angka');
    } else if (!Number.isInteger(num)) {
        errors.push('Kapasitas harus angka bulat');
    } else if (num < 20) {
        errors.push('Kapasitas minimal 20 orang');
    } else if (num > 500) {
        errors.push('Kapasitas maksimal 500 orang');
    }
    
    return errors;
}

function validateDosenId(id) {
    const errors = [];
    
    if (!id || id.trim() === '') {
        errors.push('ID Dosen tidak boleh kosong');
        return errors;
    }
    
    id = id.trim().toUpperCase();
    
    if (id.length < 2 || id.length > 10) {
        errors.push('ID Dosen harus 2-10 karakter');
    }
    
    if (!/^[A-Z0-9]+$/.test(id)) {
        errors.push('ID Dosen hanya boleh huruf kapital dan angka');
    }
    
    if (!_editingDosenId) {
        const existing = Object.keys(dosens).find(
            d => d.toUpperCase() === id && d !== id
        );
        if (existing) {
            errors.push(`Dosen dengan ID mirip sudah ada: ${existing}`);
        }
    }
    
    return errors;
}

function validateDosenName(name) {
    const errors = [];
    
    if (!name || name.trim() === '') {
        errors.push('Nama Dosen tidak boleh kosong');
    } else if (name.trim().length < 3) {
        errors.push('Nama Dosen minimal 3 karakter');
    } else if (name.trim().length > 100) {
        errors.push('Nama Dosen maksimal 100 karakter');
    }
    
    return errors;
}

function validateAvailableDays(days) {
    const errors = [];
    
    if (!days || days.length === 0) {
        errors.push('Pilih minimal 1 hari mengajar');
    }
    
    return errors;
}

function validateCourseName(name) {
    const errors = [];
    
    if (!name || name.trim() === '') {
        errors.push('Nama Mata Kuliah tidak boleh kosong');
        return errors;
    }
    
    name = name.trim().toUpperCase();
    
    if (name.length < 3) {
        errors.push('Nama Mata Kuliah minimal 3 karakter');
    }
    
    if (name.length > 50) {
        errors.push('Nama Mata Kuliah maksimal 50 karakter');
    }
    
    if (!/^[A-Z0-9_]+$/.test(name)) {
        errors.push('Nama Mata Kuliah hanya boleh huruf kapital, angka, dan underscore');
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
        errors.push('Semester harus 1-8');
    }
    
    return errors;
}

function validateCourseCapacity(capacity) {
    const errors = [];
    
    if (capacity === null || capacity === undefined || capacity === '') {
        errors.push('Kapasitas tidak boleh kosong');
        return errors;
    }
    
    const num = Number(capacity);
    
    if (isNaN(num)) {
        errors.push('Kapasitas harus angka');
    } else if (!Number.isInteger(num)) {
        errors.push('Kapasitas harus angka bulat');
    } else if (num < 20) {
        errors.push('Kapasitas minimal 20 orang');
    } else if (num > 150) {
        errors.push('Kapasitas maksimal 150 orang');
    }
    
    return errors;
}

function validateCourseJam(jam) {
    const errors = [];
    
    if (jam === null || jam === undefined || jam === '') {
        errors.push('Durasi tidak boleh kosong');
        return errors;
    }
    
    const num = Number(jam);
    
    if (isNaN(num)) {
        errors.push('Durasi harus angka');
    } else if (!Number.isInteger(num)) {
        errors.push('Durasi harus angka bulat');
    } else if (num < 1) {
        errors.push('Durasi minimal 1 jam');
    } else if (num > 6) {
        errors.push('Durasi maksimal 6 jam');
    }
    
    return errors;
}

// ===== ENHANCED SHOW NOTIFICATION WITH ERROR DETAILS =====
function showEnhancedNotification(message, type = 'info', details = null) {
    const notification = document.createElement('div');
    
    let bgColor = 'bg-blue-500';
    let icon = 'fas fa-info-circle';
    
    if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = 'fas fa-check-circle';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        icon = 'fas fa-exclamation-circle';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = 'fas fa-exclamation-triangle';
    }
    
    let detailsHtml = '';
    if (details) {
        if (Array.isArray(details)) {
            detailsHtml = '<div class="text-xs mt-2 border-t border-white border-opacity-30 pt-2">' +
                details.map(d => `<div>• ${d}</div>`).join('') +
                '</div>';
        } else if (typeof details === 'object') {
            detailsHtml = '<div class="text-xs mt-2 border-t border-white border-opacity-30 pt-2">' +
                Object.entries(details).map(([k, v]) => `<div>${k}: ${v}</div>`).join('') +
                '</div>';
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
    
    if (type !== 'error') {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Override original showNotification
function showNotification(message, type = 'info') {
    showEnhancedNotification(message, type);
}

// ===== ROOM FUNCTIONS (CRUD) =====
function openRoomModal(editId = null) {
    _editingRoomId = editId;

    if (editId) {
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
    const id = $('roomId').value.trim().toUpperCase();
    const capacity = $('roomCapacity').value;
    
    const idErrors = validateRoomId(id);
    const capErrors = validateRoomCapacity(capacity);
    const allErrors = [...idErrors, ...capErrors];
    
    if (allErrors.length > 0) {
        showEnhancedNotification('Validasi gagal', 'error', allErrors);
        return;
    }
    
    const capNum = parseInt(capacity);
    
    if (_editingRoomId) {
        rooms[_editingRoomId].kapasitas = capNum;
        renderRoomList();
        closeRoomModal();
        showEnhancedNotification(`Ruangan ${_editingRoomId} berhasil diupdate!`, 'success');
    } else {
        if (rooms[id]) { 
            showEnhancedNotification('ID Ruangan sudah ada!', 'error', [`Ruangan "${id}" sudah terdaftar`]);
            return; 
        }
        rooms[id] = { kapasitas: capNum };
        renderRoomList();
        closeRoomModal();
        showEnhancedNotification(`Ruangan ${id} ditambahkan!`, 'success', [`Kapasitas: ${capNum} orang`]);
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
    const id = $('dosenId').value.trim().toUpperCase();
    const name = $('dosenName').value.trim();
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const availableDays = days.filter(day => { 
        const cb = $(`day${day}`); 
        return cb && cb.checked; 
    });
    
    const idErrors = validateDosenId(id);
    const nameErrors = validateDosenName(name);
    const dayErrors = validateAvailableDays(availableDays);
    const allErrors = [...idErrors, ...nameErrors, ...dayErrors];
    
    if (allErrors.length > 0) {
        showEnhancedNotification('Validasi gagal', 'error', allErrors);
        return;
    }
    
    if (_editingDosenId) {
        dosens[_editingDosenId] = { name, available_days: availableDays };
        renderDosenList();
        updateDosenDropdown();
        renderCourseList();
        closeDosenModal();
        showEnhancedNotification(`Dosen ${name} berhasil diupdate!`, 'success');
    } else {
        if (dosens[id]) { 
            showEnhancedNotification('ID Dosen sudah ada!', 'error', [`Dosen dengan ID "${id}" sudah terdaftar`]);
            return; 
        }
        dosens[id] = { name, available_days: availableDays };
        renderDosenList();
        updateDosenDropdown();
        closeDosenModal();
        showEnhancedNotification(`Dosen ${name} ditambahkan!`, 'success', [`Hari mengajar: ${availableDays.join(', ')}`]);
    }
}

function editDosen(id) {
    openDosenModal(id);
}

function deleteDosen(id) {
    const name = typeof dosens[id] === 'string' ? dosens[id] : dosens[id]?.name || id;
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
    const name = $('courseName').value.trim().toUpperCase();
    const sem = parseInt($('courseSem').value);
    const dosenId = $('courseDosen').value;
    const capacity = parseInt($('courseCapacity').value);
    const jam = parseInt($('courseJam').value);
    const tipe = $('courseTipe').value;
    
    const nameErrors = validateCourseName(name);
    const semErrors = validateCourseSemester(sem);
    const capErrors = validateCourseCapacity(capacity);
    const jamErrors = validateCourseJam(jam);
    
    let dosenErrors = [];
    if (!dosenId) {
        dosenErrors.push('Pilih Dosen terlebih dahulu');
    }
    
    const allErrors = [...nameErrors, ...semErrors, ...capErrors, ...jamErrors, ...dosenErrors];
    
    if (allErrors.length > 0) {
        showEnhancedNotification('Validasi gagal', 'error', allErrors);
        return;
    }
    
    const courseData = { 
        sem, 
        dosen: dosenId, 
        kapasitas_kelas: capacity, 
        jam, 
        tipe, 
        sesi: 1 
    };
    
    if (_editingCourseName) {
        courses[_editingCourseName] = courseData;
        renderCourseList();
        closeCourseModal();
        showEnhancedNotification(`${_editingCourseName} berhasil diupdate!`, 'success');
    } else {
        if (courses[name]) { 
            showEnhancedNotification('Nama Mata Kuliah sudah ada!', 'error', [`"${name}" sudah terdaftar`]);
            return; 
        }
        courses[name] = courseData;
        renderCourseList();
        closeCourseModal();
        
        const dosenData = dosens[dosenId];
        const dosenName = dosenData ? (typeof dosenData === 'string' ? dosenData : dosenData.name) : dosenId;
        
        showEnhancedNotification(`${name} ditambahkan!`, 'success', [
            `Semester: ${sem}`,
            `Dosen: ${dosenName}`,
            `Kapasitas: ${capacity} orang`,
            `Durasi: ${jam} jam`,
            `Tipe: ${tipe}`
        ]);
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
        renderCourseList(q, semFilter);
    }
}

function updateCounts() {
    const rc = $('roomCount'); if (rc) rc.textContent = Object.keys(rooms).length;
    const dc = $('dosenCount'); if (dc) dc.textContent = Object.keys(dosens).length;
    const cc = $('courseCount'); if (cc) cc.textContent = Object.keys(courses).length;
}

// ===== LOAD DEFAULTS =====
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
        'KALKULUS_I': { sem: 1, dosen: 'D1', kapasitas_kelas: 63, jam: 3, tipe: 'terpisah', sesi: 1 },
        'ALGORITMA_I': { sem: 1, dosen: 'D2', kapasitas_kelas: 63, jam: 2, tipe: 'terpisah', sesi: 1 },
        'FISIKA': { sem: 1, dosen: 'D3', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'PENGANTAR_ALGORITMA': { sem: 1, dosen: 'D4', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'BAHASA_INDONESIA': { sem: 1, dosen: 'D5', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'AGAMA_ISLAM': { sem: 1, dosen: 'D6', kapasitas_kelas: 63, jam: 2, tipe: 'gabungan', sesi: 1 },
        'AGAMA_KRISTEN': { sem: 1, dosen: 'D7', kapasitas_kelas: 63, jam: 2, tipe: 'gabungan', sesi: 1 },
        'KALKULUS_II': { sem: 2, dosen: 'D1', kapasitas_kelas: 63, jam: 3, tipe: 'terpisah', sesi: 1 },
        'ALGORITMA_II': { sem: 2, dosen: 'D2', kapasitas_kelas: 63, jam: 2, tipe: 'terpisah', sesi: 1 },
        'KIMIA_DASAR': { sem: 2, dosen: 'D3', kapasitas_kelas: 125, jam: 2, tipe: 'gabungan', sesi: 1 },
        'STATISTIKA': { sem: 3, dosen: 'D8', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'SISTEM_DIGITAL': { sem: 3, dosen: 'D9', kapasitas_kelas: 45, jam: 2, tipe: 'terpisah', sesi: 1 },
        'M_DISKRIT': { sem: 3, dosen: 'D10', kapasitas_kelas: 93, jam: 3, tipe: 'gabungan', sesi: 1 },
        'IMK': { sem: 3, dosen: 'D4', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'STRUKTUR_DATA': { sem: 3, dosen: 'D11', kapasitas_kelas: 45, jam: 3, tipe: 'terpisah', sesi: 1 },
        'PPKN': { sem: 3, dosen: 'D12', kapasitas_kelas: 93, jam: 2, tipe: 'gabungan', sesi: 1 },
        'BASIS_DATA': { sem: 3, dosen: 'D13', kapasitas_kelas: 45, jam: 2, tipe: 'terpisah', sesi: 1 },
        'JST': { sem: 5, dosen: 'D15', kapasitas_kelas: 40, jam: 3, tipe: 'terpisah', sesi: 1 },
        'APK_WEB': { sem: 5, dosen: 'D16', kapasitas_kelas: 80, jam: 3, tipe: 'gabungan', sesi: 1 },
        'SISTEM_INFO': { sem: 5, dosen: 'D17', kapasitas_kelas: 80, jam: 3, tipe: 'gabungan', sesi: 1 },
        'GRAFKOM': { sem: 5, dosen: 'D18', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
        'SISTEM_OPERASI': { sem: 5, dosen: 'D14', kapasitas_kelas: 76, jam: 2, tipe: 'gabungan', sesi: 1 },
        'METODE': { sem: 5, dosen: 'D4', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
        'JARKOM': { sem: 5, dosen: 'D18', kapasitas_kelas: 80, jam: 2, tipe: 'gabungan', sesi: 1 },
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
        
        const result = await response.json();
        
        if (!response.ok) {
            let errorMessage = result.message || 'Optimasi gagal';
            let errorDetails = result.details || null;
            
            if (result.code === 'ROOM_CAPACITY_INSUFFICIENT') {
                errorMessage = '⚠️ ' + errorMessage;
                showEnhancedNotification(errorMessage, 'warning', [
                    `Kapasitas ruangan terbesar: ${result.details?.max_room_capacity}`,
                    `Kapasitas mata kuliah terbesar: ${result.details?.max_course_capacity}`,
                    result.details?.suggestion || ''
                ]);
            } else if (result.code === 'DOSEN_NOT_FOUND') {
                showEnhancedNotification(errorMessage, 'error', [
                    `Mata kuliah: ${result.details?.course}`,
                    `Dosen ID: ${result.details?.dosen}`
                ]);
            } else {
                showEnhancedNotification(errorMessage, 'error', errorDetails);
            }
            
            hide('statusContainer');
            return;
        }
        
        if (result.status === 'success') {
            updateProgress(100, 'Selesai!');
            displayResults(result);
            
            showEnhancedNotification('Optimasi selesai!', 'success', [
                `Total sesi: ${result.total_sessions}`,
                `Penalti: ${result.final_penalty.toFixed(2)}`,
                result.room_utilization ? `Utilisasi rata-rata: ${(Object.values(result.room_utilization).reduce((a,b)=>a+b,0)/Object.keys(result.room_utilization).length).toFixed(1)}%` : ''
            ]);
            
            setTimeout(() => {
                hide('statusContainer');
                show('resultsContainer');
            }, 500);
        } else {
            throw new Error(result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Optimization error:', error);
        showEnhancedNotification('Error: ' + error.message, 'error');
        hide('statusContainer');
    }
}

// ===== DISPLAY RESULTS =====
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
    
    updateDownloadButtons(result);
    
    const semesterTypeText = result.semester_type === 'ganjil' ? 'GANJIL' : 'GENAP';
    
    let overviewHTML = `
        <div class="mb-4 bg-blue-600 bg-opacity-20 border-2 border-blue-400 rounded-lg p-4 text-center">
            <div class="text-blue-300 text-sm font-semibold">Tipe Semester</div>
            <div class="text-white text-2xl font-bold">${semesterTypeText}</div>
        </div>`;
    
    if (result.room_utilization) {
        const util = result.room_utilization;
        const utilValues = Object.values(util);
        const avgUtil = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;
        const maxUtil = Math.max(...utilValues);
        const minUtil = Math.min(...utilValues);
        
        let utilStatus = '';
        let utilColor = '';
        
        if (maxUtil - minUtil > 40) {
            utilStatus = 'Tidak Merata';
            utilColor = 'text-yellow-400';
        } else if (avgUtil > 70) {
            utilStatus = 'Padat';
            utilColor = 'text-orange-400';
        } else if (avgUtil > 40) {
            utilStatus = 'Optimal';
            utilColor = 'text-green-400';
        } else {
            utilStatus = 'Rendah';
            utilColor = 'text-blue-400';
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
                ${result.dosen_conflicts.map(conflict => `
                    <div class="text-sm bg-red-800 bg-opacity-50 p-2 rounded">
                        <div class="text-red-200">${conflict.dosen} - ${conflict.day}</div>
                        <div class="text-xs text-red-300">
                            ${conflict.course1} (Sem ${conflict.semester1}): ${conflict.time1} 
                            ↔ ${conflict.course2} (Sem ${conflict.semester2}): ${conflict.time2}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
    
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
                    </div>
                </div>
                
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
                            <span class="text-gray-400">Waktu:</span>
                            <span class="text-white font-mono">${comp.ga_greedy.time.toFixed(2)}s</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-slate-800 bg-opacity-50 p-3 rounded text-center">
                <div class="text-sm text-gray-400 mb-1">Pengurangan Penalti</div>
                <div class="text-2xl font-bold ${penaltyImprovement > 0 ? 'text-green-400' : (penaltyImprovement < 0 ? 'text-red-400' : 'text-gray-400')}">
                    ${penaltyImprovement > 0 ? '-' : (penaltyImprovement < 0 ? '+' : '')}${Math.abs(penaltyImprovement).toFixed(2)}
                    ${penaltyImprovement !== 0 ? ` (${Math.abs(percentageImprovement).toFixed(1)}%)` : ''}
                </div>
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
    
    const semesters = Object.keys(result.structured_result).map(s => parseInt(s)).sort((a, b) => a - b);
    
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        let tabsHTML = '<button onclick="switchTab(\'overview\')" class="tab-btn active px-4 py-2 bg-blue-500 text-white rounded font-semibold whitespace-nowrap text-sm transition"><i class="fas fa-chart-bar"></i> Overview</button>';
        
        semesters.forEach(sem => {
            tabsHTML += `<button onclick="switchTab('sem${sem}')" class="tab-btn px-4 py-2 hover:bg-slate-700 text-gray-300 rounded font-semibold whitespace-nowrap text-sm transition">Semester ${sem}</button>`;
        });
        
        tabsContainer.innerHTML = tabsHTML;
    }
    
    semesters.forEach(sem => {
        const semData = result.structured_result[sem];
        if (semData) {
            renderSemesterSchedule(sem, semData);
        }
    });
    
    if (result.comparison) {
        const gaOnlyContainer = document.createElement('div');
        gaOnlyContainer.id = 'gaOnlyComparison';
        gaOnlyContainer.className = 'tab-content hidden bg-slate-800 rounded-lg shadow-2xl p-6';
        gaOnlyContainer.innerHTML = '<h3 class="text-xl font-bold text-white mb-4">🧬 Hasil Genetika Murni</h3><div id="gaOnlyComparisonContent" class="space-y-3"></div>';
        
        const gaGreedyContainer = document.createElement('div');
        gaGreedyContainer.id = 'gaGreedyComparison';
        gaGreedyContainer.className = 'tab-content hidden bg-slate-800 rounded-lg shadow-2xl p-6';
        gaGreedyContainer.innerHTML = '<h3 class="text-xl font-bold text-white mb-4">🔀 Hasil Genetika + Greedy</h3><div id="gaGreedyComparisonContent" class="space-y-3"></div>';
        
        const resultsContainer = $('resultsContainer');
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
        
        renderComparisonSchedule('gaOnlyComparisonContent', result.comparison.ga_only.structured_result);
        renderComparisonSchedule('gaGreedyComparisonContent', result.comparison.ga_greedy.structured_result);
    }
}

function getRoomUtilizationSummary(utilization) {
    if (!utilization) return '';
    
    return Object.entries(utilization)
        .sort((a, b) => b[1] - a[1])
        .map(([room, util]) => {
            let barColor = 'bg-green-500';
            if (util > 80) barColor = 'bg-orange-500';
            if (util < 20) barColor = 'bg-blue-500';
            
            return `
                <div class="flex items-center gap-2 mb-1">
                    <span class="w-12">${room}</span>
                    <div class="flex-1 bg-slate-600 h-2 rounded">
                        <div class="${barColor} h-2 rounded" style="width: ${util}%"></div>
                    </div>
                    <span class="w-12 text-right">${util.toFixed(0)}%</span>
                </div>
            `;
        }).join('');
}

function renderComparisonSchedule(containerId, structuredResult) {
    const container = $(containerId);
    if (!container) return;
    
    let html = '';
    const semesters = Object.keys(structuredResult).map(s => parseInt(s)).sort((a, b) => a - b);
    
    semesters.forEach(sem => {
        html += `<div class="mb-6">`;
        html += `<h4 class="text-lg font-bold text-blue-300 mb-3">Semester ${sem}</h4>`;
        
        const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        dayOrder.forEach(day => {
            if (structuredResult[sem] && structuredResult[sem][day]) {
                html += `<div class="mb-4">
                    <h5 class="text-md font-semibold text-purple-300 mb-2">
                        <i class="fas fa-calendar-day"></i> ${day}
                    </h5>
                    <div class="space-y-2">`;
                
                structuredResult[sem][day].forEach(session => {
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadDefaults();

    const roomCapEl = $('roomCapacity');
    if (roomCapEl) roomCapEl.addEventListener('input', e => showRoomCapacityPreview(e.target.value));

    ['courseSem', 'courseDosen', 'courseCapacity', 'courseJam', 'courseTipe'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('change', updateCoursePreview);
    });
    ['courseName', 'courseCapacity', 'courseJam'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', updateCoursePreview);
    });

    const form = $('configForm');
    if (form) {
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

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeRoomModal();
            closeDosenModal();
            closeCourseModal();
            closeDeleteConfirm();
        }
    });

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

    const roomSearch = $('roomSearch');
    if (roomSearch) {
        roomSearch.oninput = () => debouncedFilterList('room');
    }
    
    const dosenSearch = $('dosenSearch');
    if (dosenSearch) {
        dosenSearch.oninput = () => debouncedFilterList('dosen');
    }
    
    const courseSearch = $('courseSearch');
    if (courseSearch) {
        courseSearch.oninput = () => debouncedFilterList('course');
    }
});