# Sistem Penjadwalan Kuliah dengan Algoritma Genetika

Sistem penjadwalan otomatis untuk mata kuliah menggunakan algoritma genetika dengan integrasi MongoDB.

## 🎯 Fitur Utama

### ✅ Fitur yang Sudah Diimplementasikan

1. **Hari Mengajar Dosen**
   - Setiap dosen dapat memiliki hari mengajar yang berbeda
   - Contoh: Dosen A hanya mengajar Senin, Rabu, Jumat
   - Algoritma akan memastikan jadwal hanya dibuat pada hari yang tersedia

2. **Semester Genap dan Ganjil**
   - Semester Ganjil: 1, 3, 5, 7
   - Semester Genap: 2, 4, 6, 8
   - Dapat mengoptimasi jadwal berdasarkan tipe semester

3. **Integrasi MongoDB**
   - Penyimpanan data ruangan, dosen, dan mata kuliah
   - Riwayat jadwal yang telah dibuat
   - Operasi CRUD lengkap untuk semua entitas

4. **Constraint Handling**
   - Hard constraints (tidak boleh dilanggar):
     * Tidak ada bentrok ruangan
     * Tidak ada bentrok dosen
     * Tidak ada bentrok mahasiswa (per kelas/semester)
     * Kapasitas ruangan memadai
     * Dosen hanya dijadwalkan di hari yang tersedia
     * Minimal gap 3 jam untuk mata kuliah yang sama di hari yang sama
   
   - Soft constraints (diusahakan):
     * Gap minimal 30 menit antar sesi dosen

## 📋 Prasyarat

### 1. Software yang Diperlukan

```bash
# Python 3.8 atau lebih tinggi
python --version

# MongoDB 4.4 atau lebih tinggi
mongod --version

# pip (package installer)
pip --version
```

### 2. Install MongoDB

#### Windows:
1. Download MongoDB dari https://www.mongodb.com/try/download/community
2. Install dengan default settings
3. MongoDB akan berjalan sebagai service secara otomatis

#### Linux (Ubuntu/Debian):
```bash
# Import MongoDB public GPG Key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
```

#### macOS:
```bash
# Install via Homebrew
brew tap mongodb/brew
brew install mongodb-community@6.0

# Start MongoDB
brew services start mongodb-community@6.0

# Verify
brew services list
```

### 3. Verifikasi MongoDB Berjalan

```bash
# Connect to MongoDB shell
mongosh

# Atau
mongo

# Output yang diharapkan:
# MongoDB shell version...
# connecting to: mongodb://127.0.0.1:27017
```

## 🚀 Instalasi dan Setup

### 1. Clone atau Extract Project

```bash
cd /path/to/project
```

### 2. Buat Virtual Environment (Recommended)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Konfigurasi Environment

Buat file `.env` dari template:

```bash
cp .env.example .env
```

Edit file `.env`:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=scheduling_db

# Jika menggunakan MongoDB Atlas (Cloud):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Flask Configuration
FLASK_SECRET_KEY=your-random-secret-key-here
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
```

### 5. Inisialisasi Database

```bash
python init_db.py
```

Atau gunakan endpoint API setelah server berjalan:

```bash
curl -X POST http://localhost:5000/api/db/load-defaults
```

### 6. Jalankan Aplikasi

```bash
python app.py
```

Output yang diharapkan:
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

### 7. Akses Aplikasi

Buka browser dan akses:
```
http://localhost:5000
```

## 📊 Struktur Database MongoDB

### Collections

1. **rooms** - Ruangan kuliah
```javascript
{
  "_id": ObjectId("..."),
  "room_id": "R01",
  "kapasitas": 150,
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

2. **lecturers** - Data dosen
```javascript
{
  "_id": ObjectId("..."),
  "lecturer_id": "D1",
  "name": "Dosen A",
  "available_days": ["Senin", "Rabu", "Jumat"],
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

3. **courses** - Mata kuliah
```javascript
{
  "_id": ObjectId("..."),
  "course_id": "KALKULUS_I",
  "sem": 1,
  "dosen": "D1",
  "kapasitas_kelas": 63,
  "jam": 3,
  "tipe": "terpisah",  // atau "gabungan"
  "sesi": 1,
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

4. **schedules** - Hasil penjadwalan
```javascript
{
  "_id": ObjectId("..."),
  "schedule": { /* data jadwal */ },
  "semester_type": "ganjil",  // atau "genap"
  "penalty": 0.0,
  "metadata": {
    "total_courses": 26,
    "total_sessions": 32,
    "ga_params": { /* parameter GA */ }
  },
  "created_at": ISODate("...")
}
```

## 🔧 Penggunaan API

### 1. Manajemen Ruangan

#### Get All Rooms
```bash
curl http://localhost:5000/api/rooms
```

#### Add Room
```bash
curl -X POST http://localhost:5000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "R09",
    "capacity": 100
  }'
```

#### Update Room
```bash
curl -X PUT http://localhost:5000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "R09",
    "capacity": 120
  }'
```

#### Delete Room
```bash
curl -X DELETE http://localhost:5000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "R09"
  }'
```

### 2. Manajemen Dosen

#### Get All Lecturers
```bash
curl http://localhost:5000/api/lecturers
```

#### Add Lecturer (dengan hari mengajar)
```bash
curl -X POST http://localhost:5000/api/lecturers \
  -H "Content-Type: application/json" \
  -d '{
    "lecturer_id": "D21",
    "name": "Dr. Ahmad",
    "available_days": ["Senin", "Rabu", "Kamis"]
  }'
```

#### Update Lecturer
```bash
curl -X PUT http://localhost:5000/api/lecturers \
  -H "Content-Type: application/json" \
  -d '{
    "lecturer_id": "D21",
    "name": "Prof. Ahmad",
    "available_days": ["Senin", "Selasa", "Rabu", "Kamis"]
  }'
```

### 3. Manajemen Mata Kuliah

#### Get All Courses
```bash
curl http://localhost:5000/api/courses
```

#### Get Courses by Semester
```bash
curl "http://localhost:5000/api/courses?semester=1"
```

#### Add Course
```bash
curl -X POST http://localhost:5000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": "DATA_MINING",
    "sem": 5,
    "dosen": "D15",
    "kapasitas_kelas": 40,
    "jam": 3,
    "tipe": "gabungan",
    "sesi": 1
  }'
```

### 4. Optimasi Jadwal

#### Untuk Semester Ganjil
```bash
curl -X POST http://localhost:5000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "rooms": {...},
    "dosen": {...},
    "courses": {...},
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

#### Untuk Semester Genap
```bash
curl -X POST http://localhost:5000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "semester_type": "genap",
    ...
  }'
```

### 5. Riwayat Jadwal

#### Get Schedule History
```bash
curl "http://localhost:5000/api/schedules/history?limit=10"
```

#### Get Latest Schedule
```bash
curl "http://localhost:5000/api/schedules/latest?semester_type=ganjil"
```

## 💻 Penggunaan via Interface Web

### 1. Tambah Dosen dengan Hari Mengajar

1. Klik tombol "Tambah Dosen"
2. Isi ID Dosen (contoh: D21)
3. Isi Nama Dosen (contoh: Dr. Ahmad)
4. Pilih hari mengajar (checkbox untuk setiap hari)
5. Klik "Simpan"

### 2. Generate Jadwal Semester Ganjil/Genap

1. Pilih tab "Konfigurasi"
2. Pilih tipe semester (Ganjil atau Genap)
3. Atur parameter algoritma jika perlu
4. Klik "Mulai Optimasi"
5. Tunggu proses selesai
6. Download hasil dalam format Excel

## 🔍 Troubleshooting

### 1. MongoDB Connection Error

**Error:** `ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused`

**Solusi:**
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# If not running, start it
sudo systemctl start mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### 2. Port Already in Use

**Error:** `Address already in use`

**Solusi:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or change port in .env
FLASK_PORT=5001
```

### 3. Import Error

**Error:** `ModuleNotFoundError: No module named 'pymongo'`

**Solusi:**
```bash
# Reinstall requirements
pip install -r requirements.txt --force-reinstall
```

### 4. Database Empty After Restart

**Solusi:**
```bash
# Reload default data
curl -X POST http://localhost:5000/api/db/load-defaults
```

## 📁 Struktur File Project

```
project/
├── app.py                  # Main Flask application
├── scheduling_engine.py    # Algoritma genetika
├── export_handler.py       # Export ke Excel
├── db_handler.py          # MongoDB operations
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables
├── .env.example          # Template environment
├── README.md             # Dokumentasi ini
├── static/
│   ├── js/
│   │   └── script.js     # Frontend JavaScript
│   └── downloads/        # Generated Excel files
├── templates/
│   └── index.html        # Web interface
└── uploads/              # Upload folder
```

## 🎓 Cara Kerja Algoritma

### 1. Inisialisasi
- Generate populasi awal (700 individu)
- Setiap individu adalah satu jadwal lengkap
- 30% menggunakan greedy approach, 70% random

### 2. Fitness Calculation
- Hitung penalty untuk setiap constraint yang dilanggar
- Penalty 0 = jadwal optimal (tidak ada constraint yang dilanggar)

### 3. Selection & Breeding
- Pilih 20% individu terbaik (elite)
- Generate offspring dengan mutasi
- Mutation rate: 0.31 → 0.08 (adaptive)

### 4. Restart Mechanism
- Jika stuck 300 generasi tanpa perbaikan
- Restart dengan 10% elite + 90% populasi baru
- Increase stagnation threshold

### 5. Termination
- Penalty = 0 (optimal), atau
- Mencapai MAX_GENERATIONS (10000)

## 🔒 Keamanan

### Production Deployment

1. **Ganti Secret Key**
```env
FLASK_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
```

2. **Disable Debug Mode**
```env
FLASK_DEBUG=False
```

3. **Gunakan Production Server**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

4. **Setup MongoDB Authentication**
```javascript
// In MongoDB shell
use admin
db.createUser({
  user: "scheduleAdmin",
  pwd: "strongPassword123",
  roles: [ { role: "readWrite", db: "scheduling_db" } ]
})
```

Update `.env`:
```env
MONGODB_URI=mongodb://scheduleAdmin:strongPassword123@localhost:27017/scheduling_db
```

## 📈 Monitoring

### Check Database Stats

```javascript
// MongoDB shell
use scheduling_db

// Collection stats
db.rooms.stats()
db.lecturers.stats()
db.courses.stats()
db.schedules.stats()

// Count documents
db.rooms.count()
db.lecturers.count()
db.courses.count()
db.schedules.count()

// View recent schedules
db.schedules.find().sort({created_at: -1}).limit(5).pretty()
```

## 🤝 Contributing

Untuk berkontribusi:
1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📝 License

MIT License - feel free to use for academic or commercial purposes.

## 👨‍💻 Support

Jika ada pertanyaan atau masalah:
1. Check dokumentasi ini
2. Check troubleshooting section
3. Create issue di repository
4. Email: support@example.com

## 🎉 Fitur Mendatang

- [ ] Export ke PDF
- [ ] Multi-prodi support
- [ ] Dashboard analytics
- [ ] Email notification
- [ ] REST API documentation (Swagger)
- [ ] Docker support
- [ ] Cloud deployment guide

---

**Selamat menggunakan Sistem Penjadwalan Kuliah!** 🎓
