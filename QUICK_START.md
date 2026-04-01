# Quick Start Guide 🚀

Panduan cepat untuk menjalankan sistem dalam 5 menit!

## Prasyarat

✅ Python 3.8+ installed
✅ MongoDB installed dan running
✅ pip installed

## Langkah-Langkah

### 1. Setup Environment (2 menit)

```bash
# Clone atau extract project
cd /path/to/project

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 2. Start MongoDB (30 detik)

```bash
# Linux/macOS
sudo systemctl start mongod

# macOS with Homebrew
brew services start mongodb-community@6.0

# Windows
net start MongoDB
```

### 3. Initialize Database (1 menit)

```bash
python init_db.py
```

Expected output:
```
🗄️  INISIALISASI DATABASE MONGODB
✅ Koneksi MongoDB berhasil!
📦 Loading data default...
✅ INISIALISASI SELESAI!

📊 Data yang dimuat:
   • Ruangan: 8 items
   • Dosen: 20 items
   • Mata Kuliah: 29 items
```

### 4. Run Application (30 detik)

```bash
python app.py
```

Expected output:
```
🚀 SISTEM PENJADWALAN KULIAH
📍 Server: http://0.0.0.0:5000
🗄️  Database: MongoDB
```

### 5. Open Browser (30 detik)

```
http://localhost:5000
```

## Fitur Utama yang Bisa Dicoba

### 1. Lihat Data Default ✅
- Klik tab "Ruangan", "Dosen", atau "Mata Kuliah"
- Data sudah terisi otomatis

### 2. Tambah Dosen dengan Hari Mengajar ⭐
```
Klik "Tambah Dosen"
ID: D21
Nama: Dr. Ahmad
Hari Tersedia: [x] Senin [x] Rabu [x] Jumat
Simpan
```

### 3. Generate Jadwal Semester Ganjil 📅
```
Pilih tab "Optimasi"
Tipe Semester: Ganjil
Klik "Mulai Optimasi"
Tunggu ~30-60 detik
Download Excel
```

### 4. Generate Jadwal Semester Genap 📅
```
Tipe Semester: Genap
Klik "Mulai Optimasi"
Download Excel
```

## Test via API (Optional)

### Get All Lecturers with Available Days
```bash
curl http://localhost:5000/api/lecturers | jq
```

Response:
```json
{
  "status": "success",
  "data": {
    "D1": {
      "name": "Dosen A",
      "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
    },
    "D3": {
      "name": "Dosen C",
      "available_days": ["Senin", "Rabu", "Jumat"]
    }
  }
}
```

### Add New Lecturer
```bash
curl -X POST http://localhost:5000/api/lecturers \
  -H "Content-Type: application/json" \
  -d '{
    "lecturer_id": "D21",
    "name": "Dr. Ahmad",
    "available_days": ["Senin", "Rabu", "Kamis"]
  }'
```

### Generate Schedule for Odd Semester
```bash
curl -X POST http://localhost:5000/api/optimize \
  -H "Content-Type: application/json" \
  -d @config_ganjil.json
```

## Troubleshooting Quick Fixes

### MongoDB Not Running
```bash
# Check status
sudo systemctl status mongod

# Start if not running
sudo systemctl start mongod
```

### Port 5000 Already in Use
Edit `.env`:
```env
FLASK_PORT=5001
```

### Import Error
```bash
pip install -r requirements.txt --force-reinstall
```

### Database Empty
```bash
python init_db.py
```

## Next Steps

✅ Baca [README.md](README.md) untuk dokumentasi lengkap
✅ Baca [MONGODB_INSTALLATION.md](MONGODB_INSTALLATION.md) untuk instalasi MongoDB detail
✅ Eksperimen dengan parameter algoritma genetika
✅ Tambah data ruangan, dosen, mata kuliah sendiri

## Quick Reference

### Default Credentials (Development)
- MongoDB: No authentication
- Flask: No login required

### Default Data
- 8 Ruangan (R01-R08)
- 20 Dosen (D1-D20)
- 29 Mata Kuliah
- Semester: 1, 2, 3, 5, 7

### Important URLs
- Web Interface: http://localhost:5000
- API Docs: http://localhost:5000/api/
- Download Folder: ./static/downloads/

### Default GA Parameters
```python
POPULATION_SIZE = 700       # Ukuran populasi
MAX_GENERATIONS = 10000     # Maksimal iterasi
INITIAL_MUTATION_RATE = 0.31  # Tingkat mutasi awal
MIN_MUTATION_RATE = 0.08    # Tingkat mutasi minimal
```

## Support

💬 Ada masalah? Check:
1. Console/terminal output untuk error messages
2. MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
3. Troubleshooting section di README.md

---

**Happy Scheduling!** 🎓
