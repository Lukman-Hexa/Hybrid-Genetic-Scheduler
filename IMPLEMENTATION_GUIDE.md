# 📘 PANDUAN IMPLEMENTASI SISTEM PENJADWALAN KULIAH

## 🎯 Ringkasan Modifikasi

Sistem penjadwalan kuliah telah dimodifikasi dengan penambahan fitur-fitur berikut:

### ✨ Fitur Baru

1. **Hari Mengajar Dosen yang Fleksibel**
   - Setiap dosen dapat menentukan hari mana saja mereka bisa mengajar
   - Contoh: Dosen A hanya tersedia Senin, Rabu, Jumat (karena mengajar di fakultas lain)
   - Algoritma akan otomatis menghindari penjadwalan di hari yang tidak tersedia

2. **Pemisahan Semester Genap dan Ganjil**
   - Semester Ganjil: 1, 3, 5, 7
   - Semester Genap: 2, 4, 6, 8
   - Optimasi dapat dilakukan terpisah untuk setiap tipe semester
   - Memungkinkan penjadwalan yang lebih fokus dan optimal

3. **Integrasi Database MongoDB**
   - Semua data tersimpan di database (persistent)
   - CRUD operations untuk Ruangan, Dosen, dan Mata Kuliah
   - Riwayat jadwal yang pernah dibuat
   - Lebih scalable dan production-ready

---

## 📦 File-File yang Dimodifikasi/Ditambahkan

### File Baru:
1. **db_handler.py** - Handler untuk operasi MongoDB
2. **init_db.py** - Script inisialisasi database
3. **.env.example** - Template konfigurasi environment
4. **README.md** - Dokumentasi lengkap sistem
5. **MONGODB_INSTALLATION.md** - Panduan instalasi MongoDB
6. **QUICK_START.md** - Panduan cepat memulai
7. **IMPLEMENTATION_GUIDE.md** - File ini

### File yang Dimodifikasi:
1. **requirements.txt** - Ditambah dependency MongoDB (pymongo, python-dotenv)
2. **scheduling_engine.py** - Ditambah fitur hari mengajar & semester type
3. **app.py** - Ditambah endpoint CRUD & integrasi database
4. **export_handler.py** - Ditambah info semester type di export

---

## 🚀 Cara Implementasi Step-by-Step

### STEP 1: Persiapan Environment

```bash
# 1. Pastikan Python 3.8+ terinstall
python --version
# Output: Python 3.8.x atau lebih tinggi

# 2. Install MongoDB (lihat MONGODB_INSTALLATION.md untuk detail)
# Verifikasi MongoDB running:
mongosh
# atau
mongo

# 3. Buat virtual environment (recommended)
python -m venv venv

# Activate:
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### STEP 2: Install Dependencies

```bash
# Install semua package yang diperlukan
pip install -r requirements.txt

# Verifikasi instalasi
python -c "import pymongo; print('pymongo version:', pymongo.__version__)"
python -c "import flask; print('flask version:', flask.__version__)"
```

### STEP 3: Konfigurasi Database

```bash
# 1. Copy template environment
cp .env.example .env

# 2. Edit file .env sesuai konfigurasi Anda
nano .env  # atau text editor favorit
```

Isi `.env`:
```env
# Untuk MongoDB lokal (default)
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=scheduling_db

# Untuk MongoDB Atlas (cloud) - opsional
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

FLASK_SECRET_KEY=ganti-dengan-random-string-yang-aman
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
```

### STEP 4: Inisialisasi Database

```bash
# Jalankan script inisialisasi
python init_db.py
```

Output yang diharapkan:
```
🗄️  INISIALISASI DATABASE MONGODB
📡 Testing MongoDB connection...
✅ Koneksi MongoDB berhasil!

📦 Loading data default...
✅ INISIALISASI SELESAI!

📊 Data yang dimuat:
   • Ruangan: 8 items
   • Dosen: 20 items
   • Mata Kuliah: 29 items

🎯 Contoh data dosen dengan hari mengajar:
   • D1 (Dosen A): Senin, Selasa, Rabu, Kamis, Jumat
   • D3 (Dosen C): Senin, Rabu, Jumat
   • D4 (Dosen D): Selasa, Kamis
```

### STEP 5: Jalankan Aplikasi

```bash
python app.py
```

Output:
```
==================================================
🚀 SISTEM PENJADWALAN KULIAH
==================================================
📍 Server: http://0.0.0.0:5000
🗄️  Database: MongoDB
🔧 Debug Mode: True
==================================================

✓ Terhubung ke MongoDB: scheduling_db
 * Running on http://0.0.0.0:5000
```

### STEP 6: Akses Aplikasi

Buka browser: `http://localhost:5000`

---

## 💡 Contoh Penggunaan Fitur Baru

### 1. Menambah Dosen dengan Hari Mengajar Tertentu

#### Via Web Interface:
1. Klik tombol "Tambah Dosen"
2. Isi form:
   - ID Dosen: D21
   - Nama: Dr. Ahmad Hidayat
   - Centang hari mengajar: ☑ Senin ☑ Rabu ☑ Jumat
3. Klik "Simpan"

#### Via API:
```bash
curl -X POST http://localhost:5000/api/lecturers \
  -H "Content-Type: application/json" \
  -d '{
    "lecturer_id": "D21",
    "name": "Dr. Ahmad Hidayat",
    "available_days": ["Senin", "Rabu", "Jumat"]
  }'
```

Response:
```json
{
  "status": "success",
  "message": "Dosen berhasil ditambahkan"
}
```

### 2. Generate Jadwal untuk Semester Ganjil

#### Via Web Interface:
1. Pastikan data ruangan, dosen, dan mata kuliah sudah ada
2. Pilih "Tipe Semester": Ganjil
3. Atur parameter GA (atau gunakan default)
4. Klik "Mulai Optimasi"
5. Tunggu proses selesai (30-120 detik)
6. Download file Excel hasil jadwal

#### Via API:
```bash
curl -X POST http://localhost:5000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "rooms": {
      "R01": {"kapasitas": 150},
      "R02": {"kapasitas": 100},
      "R03": {"kapasitas": 80}
    },
    "dosen": {
      "D1": {
        "name": "Dosen A",
        "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
      },
      "D3": {
        "name": "Dosen C",
        "available_days": ["Senin", "Rabu", "Jumat"]
      }
    },
    "courses": {
      "KALKULUS_I": {
        "sem": 1,
        "dosen": "D1",
        "kapasitas_kelas": 63,
        "jam": 3,
        "tipe": "terpisah",
        "sesi": 1
      }
    },
    "semester_type": "ganjil",
    "ga_params": {
      "POPULATION_SIZE": 700,
      "MAX_GENERATIONS": 10000,
      "INITIAL_MUTATION_RATE": 0.31,
      "MIN_MUTATION_RATE": 0.08,
      "HARD_CONSTRAINT_PENALTY": 1000,
      "SOFT_CONSTRAINT_PENALTY": 0.5,
      "MIN_GAP_HOURS": 3
    }
  }'
```

### 3. Generate Jadwal untuk Semester Genap

Sama seperti semester ganjil, tapi ubah:
```json
"semester_type": "genap"
```

Sistem akan otomatis hanya mengambil mata kuliah semester 2, 4, 6, 8.

### 4. Melihat Riwayat Jadwal

```bash
curl http://localhost:5000/api/schedules/history?limit=5
```

Response:
```json
{
  "status": "success",
  "data": [
    {
      "_id": "65c1234567890abcdef12345",
      "semester_type": "ganjil",
      "penalty": 0.0,
      "metadata": {
        "total_courses": 19,
        "total_sessions": 24
      },
      "created_at": "2026-02-08T10:30:00"
    }
  ]
}
```

---

## 🔍 Validasi Fitur Hari Mengajar

### Test Case 1: Dosen Hanya Tersedia 3 Hari

```python
# Tambahkan dosen dengan keterbatasan hari
dosen_D22 = {
    "lecturer_id": "D22",
    "name": "Dr. Budi",
    "available_days": ["Selasa", "Rabu", "Kamis"]
}

# Tambahkan mata kuliah dengan dosen D22
course_X = {
    "course_id": "COURSE_X",
    "sem": 5,
    "dosen": "D22",
    "kapasitas_kelas": 40,
    "jam": 3,
    "tipe": "gabungan",
    "sesi": 1
}

# Generate jadwal
# HASIL: COURSE_X hanya akan dijadwalkan di Selasa/Rabu/Kamis
# TIDAK AKAN ADA jadwal di Senin atau Jumat
```

### Test Case 2: Verifikasi Constraint

```python
# Setelah generate jadwal, check hasilnya
schedule_result = {...}  # dari API response

# Filter jadwal untuk dosen D22
for session_id, (room, time) in schedule_result.items():
    if 'D22' in session_id:
        day = time.split(' ')[0]
        print(f"Session: {session_id}, Day: {day}")
        # Harus salah satu: Selasa, Rabu, atau Kamis
        assert day in ["Selasa", "Rabu", "Kamis"]
```

---

## 📊 Struktur Data di MongoDB

### Example Documents

#### Collection: lecturers
```javascript
{
  "_id": ObjectId("65c1234567890abcdef12345"),
  "lecturer_id": "D21",
  "name": "Dr. Ahmad Hidayat",
  "available_days": ["Senin", "Rabu", "Jumat"],
  "created_at": ISODate("2026-02-08T10:00:00Z"),
  "updated_at": ISODate("2026-02-08T10:00:00Z")
}
```

#### Collection: courses
```javascript
{
  "_id": ObjectId("65c2345678901bcdef123456"),
  "course_id": "KALKULUS_I",
  "sem": 1,  // Semester ganjil
  "dosen": "D1",
  "kapasitas_kelas": 63,
  "jam": 3,
  "tipe": "terpisah",
  "sesi": 1,
  "created_at": ISODate("2026-02-08T10:00:00Z"),
  "updated_at": ISODate("2026-02-08T10:00:00Z")
}
```

#### Collection: schedules
```javascript
{
  "_id": ObjectId("65c3456789012cdef1234567"),
  "schedule": {
    "KALKULUS_I_A1_S1": ["R01", "Senin 08:00"],
    "KALKULUS_I_A2_S1": ["R02", "Rabu 10:00"]
  },
  "semester_type": "ganjil",
  "penalty": 0.0,
  "metadata": {
    "total_courses": 19,
    "total_sessions": 24,
    "ga_params": {
      "POPULATION_SIZE": 700,
      "MAX_GENERATIONS": 10000
    }
  },
  "created_at": ISODate("2026-02-08T11:30:00Z")
}
```

---

## 🛠️ Kustomisasi dan Pengembangan

### 1. Menambah Constraint Baru

Edit `scheduling_engine.py`, function `calculate_fitness()`:

```python
def calculate_fitness(schedule, context):
    penalty = 0
    
    # ... existing constraints ...
    
    # Contoh: Tambah constraint baru
    # Misalnya: Dosen senior (ID dimulai D1-D5) hanya mengajar pagi
    for session in all_sessions_data:
        dosen_id = session['dosen']
        start_hour = session['start'].hour
        
        # Dosen senior (D1-D5)
        if dosen_id in ['D1', 'D2', 'D3', 'D4', 'D5']:
            if start_hour >= 13:  # Setelah jam 1 siang
                penalty += context.ga_params["SOFT_CONSTRAINT_PENALTY"] * 10
    
    return penalty
```

### 2. Mengubah Waktu Istirahat

Edit `scheduling_engine.py`:

```python
def is_break_time(day, hour, minute, duration_minutes):
    # Ubah waktu istirahat
    if day in ["Senin", "Selasa", "Rabu", "Kamis"]:
        break_start = datetime(2025, 1, 1, 11, 30)  # Ubah dari 12:00 ke 11:30
        break_end = datetime(2025, 1, 1, 12, 30)    # Ubah dari 13:00 ke 12:30
    # ...
```

### 3. Menambah Validasi Custom

Edit `app.py`:

```python
@app.route('/api/validate', methods=['POST'])
def validate_data():
    errors = []
    
    # ... existing validations ...
    
    # Tambah validasi: Minimal 2 hari tersedia per dosen
    for lecturer_id, lecturer_data in dosen.items():
        available_days = lecturer_data.get('available_days', [])
        if len(available_days) < 2:
            errors.append(f"Dosen {lecturer_id} harus tersedia minimal 2 hari")
    
    return jsonify({"status": "success" if not errors else "error", "errors": errors})
```

---

## 🔐 Production Deployment

### 1. Security Checklist

```bash
# Generate strong secret key
python -c "import secrets; print(secrets.token_hex(32))"

# Update .env
FLASK_SECRET_KEY=<generated-key>
FLASK_DEBUG=False
```

### 2. MongoDB Authentication

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "scheduleAdmin",
  pwd: "YOUR-STRONG-PASSWORD",
  roles: [
    { role: "readWrite", db: "scheduling_db" },
    { role: "dbAdmin", db: "scheduling_db" }
  ]
})

# Exit and update .env
```

Update `.env`:
```env
MONGODB_URI=mongodb://scheduleAdmin:YOUR-STRONG-PASSWORD@localhost:27017/scheduling_db?authSource=admin
```

### 3. Production Server

```bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# With logging
gunicorn -w 4 -b 0.0.0.0:5000 --access-logfile access.log --error-logfile error.log app:app
```

### 4. Systemd Service (Linux)

Create `/etc/systemd/system/scheduling.service`:

```ini
[Unit]
Description=Scheduling System
After=network.target mongod.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/project
Environment="PATH=/path/to/project/venv/bin"
ExecStart=/path/to/project/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
KillSignal=SIGTERM
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable scheduling
sudo systemctl start scheduling
sudo systemctl status scheduling
```

---

## 📋 Checklist Implementasi

### Pre-Implementation
- [ ] Python 3.8+ installed
- [ ] MongoDB installed dan running
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] `.env` file configured

### Implementation
- [ ] Database initialized (`python init_db.py`)
- [ ] Application running (`python app.py`)
- [ ] Web interface accessible
- [ ] Default data loaded

### Testing
- [ ] Tambah dosen dengan hari mengajar custom - works
- [ ] Generate jadwal semester ganjil - works
- [ ] Generate jadwal semester genap - works
- [ ] Verifikasi constraint hari mengajar - works
- [ ] Download Excel - works
- [ ] API endpoints - works

### Production (Optional)
- [ ] Security configured
- [ ] MongoDB authentication enabled
- [ ] Production server (gunicorn) configured
- [ ] Systemd service created
- [ ] Firewall rules configured
- [ ] Backup strategy implemented

---

## 🎓 Kesimpulan

Sistem penjadwalan kuliah telah berhasil dimodifikasi dengan fitur-fitur berikut:

✅ **Hari Mengajar Dosen**: Setiap dosen dapat memiliki jadwal ketersediaan yang berbeda
✅ **Semester Genap/Ganjil**: Optimasi terpisah untuk meningkatkan kualitas jadwal
✅ **MongoDB Integration**: Data persistent, scalable, production-ready
✅ **Full CRUD Operations**: Kelola data ruangan, dosen, mata kuliah via API atau web
✅ **History Tracking**: Semua jadwal yang pernah dibuat tersimpan dan dapat diakses

**Sistem siap digunakan untuk produksi dengan konfigurasi yang tepat!** 🚀

---

## 📞 Support & Troubleshooting

Jika mengalami masalah, check:
1. Console/terminal output untuk error messages
2. MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
3. Flask logs: Check terminal output
4. Browser console: Check JavaScript errors
5. README.md - Troubleshooting section

**Good luck with your implementation!** 🎉
