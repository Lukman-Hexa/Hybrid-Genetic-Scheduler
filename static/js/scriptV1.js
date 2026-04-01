let currentSchedule = null;
let downloadUrl = null;
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

// ===== ROOM FUNCTIONS =====
function openRoomModal() {
    $('roomId').value = '';
    $('roomCapacity').value = '';
    show('roomModal');
    $('roomId').focus();
}

function closeRoomModal() {
    hide('roomModal');
}

function saveRoom() {
    const id = $('roomId').value.trim();
    const capacity = parseInt($('roomCapacity').value);
    
    if (!id) {
        showNotification('ID Ruangan tidak boleh kosong!', 'error');
        return;
    }
    if (isNaN(capacity) || capacity < 20) {
        showNotification('Kapasitas minimal 20 orang!', 'error');
        return;
    }
    if (rooms[id]) {
        showNotification('ID Ruangan sudah ada!', 'error');
        return;
    }
    
    rooms[id] = { kapasitas: capacity };
    renderRoomList();
    closeRoomModal();
    showNotification(`Ruangan ${id} ditambahkan!`, 'success');
}

function deleteRoom(id) {
    delete rooms[id];
    renderRoomList();
    showNotification(`Ruangan ${id} dihapus!`, 'success');
}

function renderRoomList() {
    const list = $('roomsList');
    list.innerHTML = '';
    
    Object.entries(rooms).forEach(([id, data]) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-500 p-3 rounded';
        div.innerHTML = `
            <div>
                <div class="text-white font-bold">${id}</div>
                <div class="text-gray-300 text-sm">Kapasitas: ${data.kapasitas} orang</div>
            </div>
            <button onclick="deleteRoom('${id}')" class="text-red-400 hover:text-red-300 text-lg">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
}

// ===== DOSEN FUNCTIONS ===== (⭐ MODIFIED)
function openDosenModal() {
    $('dosenId').value = '';
    $('dosenName').value = '';
    
    // ⭐ Reset semua checkbox hari
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    days.forEach(day => {
        const checkbox = $(`day${day}`);
        if (checkbox) checkbox.checked = true; // Default: semua hari dicentang
    });
    
    show('dosenModal');
    $('dosenId').focus();
}

function closeDosenModal() {
    hide('dosenModal');
}

function saveDosen() {
    const id = $('dosenId').value.trim();
    const name = $('dosenName').value.trim();
    
    if (!id) {
        showNotification('ID Dosen tidak boleh kosong!', 'error');
        return;
    }
    if (!name) {
        showNotification('Nama Dosen tidak boleh kosong!', 'error');
        return;
    }
    if (dosens[id]) {
        showNotification('ID Dosen sudah ada!', 'error');
        return;
    }
    
    // ⭐ FITUR BARU: Ambil hari yang tersedia
    const availableDays = [];
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    days.forEach(day => {
        const checkbox = $(`day${day}`);
        if (checkbox && checkbox.checked) {
            availableDays.push(day);
        }
    });
    
    if (availableDays.length === 0) {
        showNotification('Pilih minimal 1 hari mengajar!', 'error');
        return;
    }
    
    // ⭐ Simpan dengan format baru (object dengan name dan available_days)
    dosens[id] = {
        name: name,
        available_days: availableDays
    };
    
    renderDosenList();
    updateDosenDropdown();
    closeDosenModal();
    showNotification(`Dosen ${name} ditambahkan!`, 'success');
}

function deleteDosen(id) {
    delete dosens[id];
    renderDosenList();
    updateDosenDropdown();
    showNotification('Dosen dihapus!', 'success');
}

function renderDosenList() {
    const list = $('dosenList');
    list.innerHTML = '';
    
    Object.entries(dosens).forEach(([id, data]) => {
        // ⭐ Handle both old format (string) and new format (object)
        const name = typeof data === 'string' ? data : data.name;
        const availableDays = typeof data === 'object' && data.available_days 
            ? data.available_days 
            : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-500 p-3 rounded';
        div.innerHTML = `
            <div>
                <div class="text-white font-bold">${id}</div>
                <div class="text-gray-300 text-sm">${name}</div>
                <div class="text-blue-300 text-xs mt-1">
                    <i class="fas fa-calendar"></i> ${availableDays.join(', ')}
                </div>
            </div>
            <button onclick="deleteDosen('${id}')" class="text-red-400 hover:text-red-300 text-lg">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
}

function updateDosenDropdown() {
    const select = $('courseDosen');
    const selected = select.value;
    select.innerHTML = '<option value="">-- Pilih Dosen --</option>';
    
    Object.entries(dosens).forEach(([id, data]) => {
        // ⭐ Handle both formats
        const name = typeof data === 'string' ? data : data.name;
        
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${id} - ${name}`;
        if (id === selected) option.selected = true;
        select.appendChild(option);
    });
}

// ===== COURSE FUNCTIONS =====
function openCourseModal() {
    $('courseName').value = '';
    $('courseSem').value = '1';
    $('courseDosen').value = '';
    $('courseCapacity').value = '';
    $('courseJam').value = '';
    $('courseTipe').value = 'gabungan';
    show('courseModal');
    $('courseName').focus();
}

function closeCourseModal() {
    hide('courseModal');
}

function saveCourse() {
    const name = $('courseName').value.trim();
    const sem = parseInt($('courseSem').value);
    const dosenId = $('courseDosen').value;
    const capacity = parseInt($('courseCapacity').value);
    const jam = parseInt($('courseJam').value);
    const tipe = $('courseTipe').value;
    
    if (!name) {
        showNotification('Nama Mata Kuliah tidak boleh kosong!', 'error');
        return;
    }
    if (!dosenId) {
        showNotification('Pilih Dosen terlebih dahulu!', 'error');
        return;
    }
    if (isNaN(capacity) || capacity < 20 || capacity > 150) {
        showNotification('Kapasitas harus 20-150 orang!', 'error');
        return;
    }
    if (isNaN(jam) || jam < 1 || jam > 6) {
        showNotification('Durasi harus 1-6 jam!', 'error');
        return;
    }
    if (courses[name]) {
        showNotification('Nama Mata Kuliah sudah ada!', 'error');
        return;
    }
    
    courses[name] = {
        sem: sem,
        dosen: dosenId,
        kapasitas_kelas: capacity,
        jam: jam,
        tipe: tipe,
        sesi: 1
    };
    
    renderCourseList();
    closeCourseModal();
    showNotification(`${name} ditambahkan!`, 'success');
}

function deleteCourse(name) {
    delete courses[name];
    renderCourseList();
    showNotification('Mata Kuliah dihapus!', 'success');
}

function renderCourseList() {
    const list = $('coursesList');
    list.innerHTML = '';
    
    Object.entries(courses).forEach(([name, data]) => {
        // ⭐ Handle dosen name from new format
        const dosenName = typeof dosens[data.dosen] === 'string' 
            ? dosens[data.dosen] 
            : (dosens[data.dosen]?.name || data.dosen);
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-500 p-3 rounded';
        div.innerHTML = `
            <div class="flex-1">
                <div class="text-white font-bold">${name}</div>
                <div class="text-gray-300 text-sm">
                    Sem ${data.sem} | ${dosenName} | ${data.kapasitas_kelas} orang | ${data.jam}jam | ${data.tipe}
                </div>
            </div>
            <button onclick="deleteCourse('${name}')" class="text-red-400 hover:text-red-300 text-lg ml-2">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
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

// ===== FORM SUBMISSION ===== (⭐ MODIFIED)
$('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (Object.keys(rooms).length === 0) {
        showNotification('Minimal ada 1 ruangan!', 'error');
        return;
    }
    if (Object.keys(dosens).length === 0) {
        showNotification('Minimal ada 1 dosen!', 'error');
        return;
    }
    if (Object.keys(courses).length === 0) {
        showNotification('Minimal ada 1 mata kuliah!', 'error');
        return;
    }
    
    // ⭐ FITUR BARU: Ambil semester type
    const semesterType = $('semesterType') ? $('semesterType').value : 'ganjil';
    
    // ⭐ FITUR PERBANDINGAN: Ambil mode perbandingan
    const compareMode = $('compareMode') ? $('compareMode').checked : false;
    
    const ga_params = {
        POPULATION_SIZE: parseInt($('populationSize').value),
        MAX_GENERATIONS: parseInt($('maxGenerations').value),
        INITIAL_MUTATION_RATE: parseFloat($('mutationRate').value),
        MIN_MUTATION_RATE: 0.08,
        HARD_CONSTRAINT_PENALTY: 1000,
        SOFT_CONSTRAINT_PENALTY: 0.5,
        MIN_GAP_HOURS: 3
    };
    
    await submitOptimization({ 
        rooms, 
        dosen: dosens, 
        courses, 
        ga_params,
        semester_type: semesterType,  // ⭐ PARAMETER BARU
        compare_mode: compareMode      // ⭐ PARAMETER PERBANDINGAN
    });
});

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
    
    $('penaltyText').textContent = `Penalti Total: ${result.final_penalty.toFixed(2)} (${result.penalty_status})`;
    
    const badge = $('penaltyBadge');
    if (result.final_penalty === 0) {
        badge.textContent = 'OPTIMAL ✓';
        badge.classList.remove('bg-white', 'bg-opacity-20');
        badge.classList.add('bg-green-300', 'bg-opacity-30');
    }
    
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
async function downloadSchedule() {
    if (!downloadUrl) return;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadUrl.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Jadwal diunduh!', 'success');
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadDefaults();
});