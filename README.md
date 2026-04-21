# 📅 Sistem Penjadwalan Kuliah
### Optimasi dengan Algoritma Genetika & Greedy

---

## 📖 Deskripsi

**Sistem Penjadwalan Kuliah** adalah aplikasi web berbasis **Flask (Python)** yang menggunakan **Algoritma Genetika (GA)** dan **Greedy Post-processing** untuk menghasilkan jadwal kuliah yang optimal secara otomatis. Sistem ini mampu menjadwalkan mata kuliah untuk berbagai semester dengan mempertimbangkan berbagai constraint seperti ketersediaan ruangan, jadwal dosen, kapasitas kelas, dan waktu istirahat.

---

## 🗂️ Struktur Proyek

```
.
├── app.py                  # Entry point Flask, semua route API
├── scheduling_engine.py    # Inti algoritma GA & Greedy
├── db_handler.py           # Handler koneksi & operasi MongoDB
├── export_handler.py       # Export jadwal ke file Excel (.xlsx)
├── init_db.py              # Script inisialisasi & seeding database
├── requirements.txt        # Dependensi Python
├── .env.example            # Template konfigurasi environment
├── static/
│   └── js/
│       └── script.js       # Frontend JavaScript (CRUD, SSE, UI)
└── templates/
    └── index.html          # Halaman utama (Tailwind CSS)
```

---

## 🗄️ Database

Aplikasi menggunakan **MongoDB** sebagai database utama.

### Koleksi (Collections)

| Koleksi | Deskripsi |
|---|---|
| `rooms` | Data ruangan kuliah beserta kapasitasnya |
| `lecturers` | Data dosen beserta ketersediaan hari mengajar |
| `courses` | Data mata kuliah (semester, dosen, kapasitas, durasi, tipe) |
| `schedules` | Hasil jadwal yang telah di-generate dan di-simpan |

### Konfigurasi Database

Atur koneksi MongoDB di file `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=scheduling_db
```

---

## ⚙️ Instalasi

### Prasyarat

- Python **3.8+**
- MongoDB **4.4+** (lokal atau Atlas)
- pip (Python package manager)

---

### Langkah Instalasi

**1. Clone atau download repositori ini**

```bash
git clone <url-repositori>
cd sistem-penjadwalan-kuliah
```

**2. Buat virtual environment (direkomendasikan)**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

**3. Install semua dependensi**

```bash
pip install -r requirements.txt
```

Daftar dependensi utama:

| Package | Fungsi |
|---|---|
| `Flask` | Web framework |
| `pymongo` | Driver MongoDB |
| `python-dotenv` | Manajemen environment variable |
| `openpyxl` | Generate file Excel |
| `apscheduler` | Background scheduler (auto-delete) |

**4. Konfigurasi environment**

```bash
cp .env.example .env
```

Edit file `.env` sesuai kebutuhan:

```env
# Flask
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=True
FLASK_SECRET_KEY=ganti-dengan-secret-key-acak-yang-kuat

# MongoDB
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=scheduling_db

# Auto-Delete Jadwal Lama
AUTO_DELETE_ENABLED=true
AUTO_DELETE_DAYS=7
AUTO_DELETE_INTERVAL_HOURS=24
```

**5. Pastikan MongoDB berjalan**

```bash
# Linux
sudo systemctl start mongod

# macOS (Homebrew)
brew services start mongodb-community

# Windows
# Pastikan service MongoDB aktif di Services Manager
```

**6. Inisialisasi database dengan data default**

```bash
python init_db.py
```

Perintah ini akan memuat data default: **8 ruangan**, **20 dosen**, dan **30 mata kuliah** siap pakai.

**7. Jalankan aplikasi**

```bash
python app.py
```

Akses aplikasi di browser: **http://localhost:5000**

---

## 🚀 Fitur Utama

### 1. 🧬 Algoritma Genetika Murni (GA Only)
- Menggunakan operator **Seleksi → Crossover → Mutasi**
- Tanpa restart dan tanpa greedy post-processing
- Cocok untuk eksplorasi solusi yang beragam

### 2. 🔀 GA + Greedy (Restart Mechanism)
- Menggunakan operator **Seleksi → Mutasi → Restart** saat mengalami stagnasi
- Dilanjutkan dengan **Greedy Post-processing** untuk memoles hasil akhir
- Lebih efektif menghindari local optimum

### 3. 🔬 Mode Perbandingan (Hybrid)
- Menjalankan **kedua algoritma** secara bergantian
- Membandingkan hasil menggunakan **Multi-Aspek Tie-Breaking** bertingkat:
  - **Level 1** — Penalti (constraint keras): algoritma dengan penalti lebih kecil menang
  - **Level 2** — Skor kualitas total (rata-rata 3 aspek)
  - **Level 3** — Hierarki aspek per-aspek: distribusi hari → distribusi ruangan → kecepatan konvergensi
  - **Level 4** — Default ke GA+Greedy jika semua aspek identik
- Menampilkan visualisasi perbandingan lengkap di UI

### 4. ⚡ Real-time Progress via SSE (Server-Sent Events)
- Progress bar live yang diperbarui setiap 100 generasi
- Menampilkan estimasi waktu selesai (ETA) berbasis moving average
- Dua progress bar terpisah untuk mode hybrid (GA Murni & GA+Greedy)
- Tidak perlu polling manual — koneksi streaming otomatis

### 5. 📋 Manajemen Data (CRUD)

#### Ruangan
- Tambah, edit, dan hapus ruangan
- Validasi ID (2–10 karakter alfanumerik) dan kapasitas (20–500 orang)
- Pencarian real-time

#### Dosen
- Tambah, edit, dan hapus dosen
- Pengaturan **hari ketersediaan mengajar** (Senin–Jumat)
- Algoritma hanya menjadwalkan dosen pada hari yang tersedia

#### Mata Kuliah
- Tambah, edit, dan hapus mata kuliah
- Konfigurasi: semester, dosen pengajar, kapasitas kelas, durasi (jam), tipe kelas
- **Tipe Terpisah**: dijadwalkan dalam 2 kelas (A1 dan A2) secara terpisah
- **Tipe Gabungan**: dijadwalkan dalam 1 kelas besar (A1A2)
- Filter berdasarkan semester dan pencarian nama

### 6. 🗓️ Penjadwalan Semester Ganjil & Genap
- Filter otomatis mata kuliah berdasarkan jenis semester
- **Ganjil**: Semester 1, 3, 5, 7
- **Genap**: Semester 2, 4, 6, 8

### 7. 📊 Constraint yang Dijaga Otomatis

| Jenis | Constraint |
|---|---|
| **Hard Constraint** | Tidak ada konflik ruangan di waktu yang sama |
| **Hard Constraint** | Tidak ada konflik dosen mengajar dua kelas bersamaan |
| **Hard Constraint** | Tidak ada konflik kelas mahasiswa di waktu yang sama |
| **Hard Constraint** | Kapasitas ruangan mencukupi jumlah mahasiswa |
| **Hard Constraint** | Dosen hanya mengajar di hari yang tersedia |
| **Hard Constraint** | Jeda minimal 3 jam untuk mata kuliah yang sama di hari yang sama |
| **Soft Constraint** | Jeda minimal 30 menit antar sesi dosen di hari yang sama |
| **Soft Constraint** | Waktu istirahat dihormati (Senin–Kamis: 12.00–13.00, Jumat: 12.00–13.40) |

### 8. 📈 Analisis Kualitas Jadwal
- **Skor Distribusi Ruangan**: mengukur pemerataan penggunaan ruangan
- **Skor Distribusi Hari**: mengukur pemerataan jadwal antar hari
- **Skor Konvergensi Generasi**: mengukur efisiensi pencarian solusi
- Visualisasi utilisasi ruangan dengan progress bar

### 9. 📁 Riwayat Jadwal
- Semua hasil optimasi tersimpan otomatis di MongoDB
- Tabel riwayat 20 jadwal terbaru
- Fitur **Preview** jadwal langsung di browser tanpa download
- Fitur **Download Excel** on-demand dari database (tanpa file lokal)
- Fitur **Hapus** jadwal individual dari riwayat

### 10. 🗑️ Auto-Delete Jadwal Lama
- Background scheduler (APScheduler) menghapus jadwal lama secara otomatis
- Konfigurasi threshold hari (default: 7 hari)
- Konfigurasi interval pengecekan (default: setiap 24 jam)
- Panel pengaturan langsung dari UI tanpa restart server
- Tombol **"Bersihkan Sekarang"** untuk cleanup manual

### 11. 📥 Export ke Excel
- Download jadwal dalam format `.xlsx`
- Sheet **Summary**: ringkasan distribusi per semester
- Sheet per-semester: detail jadwal (hari, jam mulai/selesai, mata kuliah, dosen, ruangan)
- Mode hybrid menyediakan 3 tombol download: GA Murni, GA+Greedy, dan Terbaik

---

## 🖥️ Antarmuka Pengguna

- **Sidebar Konfigurasi**: manajemen ruangan, dosen, mata kuliah, pilihan algoritma, dan parameter GA
- **Area Hasil**: tabs per semester, overview statistik, perbandingan algoritma
- **Panel Riwayat**: tabel jadwal tersimpan dengan aksi preview, download, hapus
- **Modal CRUD**: form tambah/edit dengan validasi real-time dan preview data
- **Notifikasi**: toast notification untuk setiap aksi (sukses/error/peringatan)
- Desain responsif dengan **Tailwind CSS** dan ikon **Font Awesome**

---

## 🔌 API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/` | Halaman utama |
| `GET` | `/api/default-config` | Ambil semua data default dari DB |
| `GET/POST/PUT/DELETE` | `/api/rooms` | CRUD ruangan |
| `GET/POST/PUT/DELETE` | `/api/lecturers` | CRUD dosen |
| `GET/POST/PUT/DELETE` | `/api/courses` | CRUD mata kuliah |
| `POST` | `/api/optimize/start` | Mulai optimasi (async, kembalikan job_id) |
| `GET` | `/api/optimize/stream/<job_id>` | SSE stream progress optimasi |
| `POST` | `/api/optimize` | Optimasi sinkron (legacy) |
| `GET` | `/api/schedules/history` | Riwayat jadwal tersimpan |
| `GET` | `/api/schedules/<id>/preview` | Preview detail satu jadwal |
| `GET` | `/api/schedules/<id>/download` | Download jadwal sebagai Excel |
| `DELETE` | `/api/schedules/<id>` | Hapus satu jadwal |
| `POST` | `/api/schedules/cleanup` | Hapus jadwal lebih tua dari N hari |
| `GET/POST` | `/api/schedules/auto-delete-config` | Baca/simpan konfigurasi auto-delete |

---

## 📦 Parameter Algoritma

| Parameter | Default | Deskripsi |
|---|---|---|
| `POPULATION_SIZE` | 700 | Jumlah individu per generasi |
| `MAX_GENERATIONS` | 10000 | Batas maksimal generasi |
| `INITIAL_MUTATION_RATE` | 0.31 | Tingkat mutasi awal |
| `MIN_MUTATION_RATE` | 0.08 | Tingkat mutasi minimal |
| `HARD_CONSTRAINT_PENALTY` | 1000 | Bobot penalti constraint keras |
| `SOFT_CONSTRAINT_PENALTY` | 0.5 | Bobot penalti constraint lunak |

Semua parameter dapat disesuaikan langsung dari UI sebelum menjalankan optimasi.

---

## 📝 Catatan Penting

- File jadwal **tidak disimpan ke disk** — semua data tersimpan di MongoDB dan Excel di-generate on-demand saat download.
- Auto-delete scheduler membutuhkan package `apscheduler`. Jika tidak terinstall, fitur ini dinonaktifkan secara otomatis tetapi cleanup manual tetap bisa dilakukan.
- Perubahan konfigurasi interval scheduler memerlukan restart server agar berlaku penuh.
- Mode **Hybrid** menjalankan dua algoritma secara berurutan sehingga waktu eksekusi dua kali lebih lama dibanding mode tunggal.

---

## 🛠️ Troubleshooting

**MongoDB tidak bisa terhubung**
```
Pastikan service MongoDB aktif:
  Linux  : sudo systemctl status mongod
  macOS  : brew services list
  Windows: Cek MongoDB di Services Manager
```

**APScheduler tidak tersedia**
```bash
pip install apscheduler
```

**Port 5000 sudah digunakan**
```env
# Ubah di .env
FLASK_PORT=8080
```

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademik. Bebas digunakan dan dimodifikasi sesuai kebutuhan.
