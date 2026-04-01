# Panduan Instalasi MongoDB Lengkap

## 📋 Daftar Isi
1. [Windows](#windows)
2. [Linux (Ubuntu/Debian)](#linux-ubuntudebian)
3. [macOS](#macos)
4. [Verifikasi Instalasi](#verifikasi-instalasi)
5. [Konfigurasi Dasar](#konfigurasi-dasar)
6. [Troubleshooting](#troubleshooting)

---

## Windows

### Metode 1: Installer (Recommended)

1. **Download MongoDB**
   - Kunjungi: https://www.mongodb.com/try/download/community
   - Pilih version: 6.0 atau terbaru
   - Platform: Windows
   - Package: MSI
   - Klik Download

2. **Install MongoDB**
   ```
   - Double-click file .msi yang didownload
   - Pilih "Complete" installation
   - Centang "Install MongoDB as a Service"
   - Pilih "Run service as Network Service user"
   - Install MongoDB Compass (GUI tool) - Optional tapi recommended
   - Klik Install
   ```

3. **Verifikasi Service**
   ```cmd
   # Buka Command Prompt as Administrator
   # Check service status
   sc query MongoDB
   
   # Jika service tidak berjalan:
   net start MongoDB
   ```

4. **Tambahkan ke PATH (Opsional)**
   ```cmd
   # Buka System Environment Variables
   # Tambahkan ke PATH:
   C:\Program Files\MongoDB\Server\6.0\bin
   ```

### Metode 2: Manual Installation

1. **Download ZIP**
   - Download MongoDB Community Server (ZIP)
   - Extract ke `C:\mongodb`

2. **Buat Folder Data**
   ```cmd
   mkdir C:\mongodb\data
   mkdir C:\mongodb\log
   ```

3. **Jalankan MongoDB**
   ```cmd
   cd C:\mongodb\bin
   mongod --dbpath C:\mongodb\data --logpath C:\mongodb\log\mongo.log
   ```

4. **Install sebagai Service**
   ```cmd
   # Buat file config: C:\mongodb\mongod.cfg
   systemLog:
     destination: file
     path: C:\mongodb\log\mongod.log
   storage:
     dbPath: C:\mongodb\data
   
   # Install service
   mongod --config C:\mongodb\mongod.cfg --install
   net start MongoDB
   ```

---

## Linux (Ubuntu/Debian)

### Ubuntu 20.04 / 22.04

1. **Import GPG Key**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   ```

2. **Add Repository**
   ```bash
   # Ubuntu 20.04 (Focal)
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   
   # Ubuntu 22.04 (Jammy)
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   ```

3. **Update & Install**
   ```bash
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   ```

4. **Start Service**
   ```bash
   # Start MongoDB
   sudo systemctl start mongod
   
   # Enable auto-start on boot
   sudo systemctl enable mongod
   
   # Check status
   sudo systemctl status mongod
   ```

### Debian 10 / 11

1. **Install Dependencies**
   ```bash
   sudo apt-get install gnupg curl
   ```

2. **Import Key**
   ```bash
   curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
   ```

3. **Add Repository**
   ```bash
   # Debian 11
   echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   
   # Debian 10
   echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/6.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   ```

4. **Install**
   ```bash
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

### CentOS / RHEL

1. **Create Repo File**
   ```bash
   sudo nano /etc/yum.repos.d/mongodb-org-6.0.repo
   ```

2. **Add Content**
   ```ini
   [mongodb-org-6.0]
   name=MongoDB Repository
   baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/6.0/x86_64/
   gpgcheck=1
   enabled=1
   gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
   ```

3. **Install**
   ```bash
   sudo yum install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

---

## macOS

### Metode 1: Homebrew (Recommended)

1. **Install Homebrew** (jika belum ada)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install MongoDB**
   ```bash
   # Tap MongoDB formulae
   brew tap mongodb/brew
   
   # Install MongoDB Community Edition
   brew install mongodb-community@6.0
   ```

3. **Start MongoDB**
   ```bash
   # Start as service
   brew services start mongodb-community@6.0
   
   # Or run in foreground
   mongod --config /usr/local/etc/mongod.conf
   ```

4. **Check Status**
   ```bash
   brew services list
   ```

### Metode 2: Manual Download

1. **Download**
   - Visit: https://www.mongodb.com/try/download/community
   - Select macOS
   - Download TGZ

2. **Extract & Setup**
   ```bash
   tar -zxvf mongodb-macos-*.tgz
   sudo mv mongodb-macos-* /usr/local/mongodb
   
   # Create data directory
   sudo mkdir -p /usr/local/var/mongodb
   sudo mkdir -p /usr/local/var/log/mongodb
   
   # Set permissions
   sudo chown $(whoami) /usr/local/var/mongodb
   sudo chown $(whoami) /usr/local/var/log/mongodb
   ```

3. **Run MongoDB**
   ```bash
   /usr/local/mongodb/bin/mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb/mongo.log --fork
   ```

---

## Verifikasi Instalasi

### 1. Check Service Status

**Linux:**
```bash
sudo systemctl status mongod
# Expected output: active (running)
```

**macOS:**
```bash
brew services list | grep mongodb
# Expected: mongodb-community started
```

**Windows:**
```cmd
sc query MongoDB
# Expected: STATE: RUNNING
```

### 2. Connect to MongoDB

```bash
# Try to connect
mongosh
# atau
mongo

# Expected output:
# Current Mongosh Log ID: ...
# Connecting to: mongodb://127.0.0.1:27017
# Using MongoDB: 6.0.x
# >
```

### 3. Test Basic Commands

```javascript
// In MongoDB shell
show dbs
use test
db.testCollection.insertOne({name: "test"})
db.testCollection.find()
```

### 4. Check Port

```bash
# Linux/macOS
sudo netstat -tlnp | grep 27017

# Windows
netstat -an | findstr 27017

# Expected: 127.0.0.1:27017 LISTENING
```

---

## Konfigurasi Dasar

### 1. File Konfigurasi

**Linux:** `/etc/mongod.conf`
**macOS:** `/usr/local/etc/mongod.conf`
**Windows:** `C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg`

### 2. Konfigurasi Minimal

```yaml
# Storage
storage:
  dbPath: /var/lib/mongodb  # atau path lain
  journal:
    enabled: true

# Logging
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Network
net:
  port: 27017
  bindIp: 127.0.0.1  # Hanya localhost (aman untuk development)
  # bindIp: 0.0.0.0  # All interfaces (untuk production dengan firewall)

# Security
security:
  authorization: disabled  # Development
  # authorization: enabled  # Production
```

### 3. Enable Authentication (Production)

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "strongPassword123",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Create app user
use scheduling_db
db.createUser({
  user: "scheduleApp",
  pwd: "appPassword123",
  roles: [ { role: "readWrite", db: "scheduling_db" } ]
})

# Exit and edit config
# Change: authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod
```

Update `.env`:
```env
MONGODB_URI=mongodb://scheduleApp:appPassword123@localhost:27017/scheduling_db
```

---

## Troubleshooting

### Problem 1: MongoDB Won't Start

**Linux:**
```bash
# Check logs
sudo tail -f /var/log/mongodb/mongod.log

# Common issues:
# 1. Port already in use
sudo lsof -i :27017
sudo kill -9 <PID>

# 2. Permission issues
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown mongodb:mongodb /tmp/mongodb-27017.sock

# 3. Lock file exists
sudo rm /var/lib/mongodb/mongod.lock
sudo mongod --repair --dbpath /var/lib/mongodb
```

**Windows:**
```cmd
# Check Event Viewer
# Open: Event Viewer > Windows Logs > Application
# Look for MongoDB errors

# Remove lock file
del C:\mongodb\data\mongod.lock

# Repair
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --repair
```

### Problem 2: Connection Refused

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Check network binding
sudo netstat -tlnp | grep 27017

# Try different connection methods
mongosh
mongosh mongodb://localhost:27017
mongosh --host localhost --port 27017
```

### Problem 3: Access Denied

```bash
# If authentication is enabled but you forgot password:
# 1. Stop MongoDB
sudo systemctl stop mongod

# 2. Start without auth
sudo mongod --dbpath /var/lib/mongodb --noauth --port 27017

# 3. In another terminal, connect and reset password
mongosh
use admin
db.updateUser("admin", {pwd: "newPassword"})

# 4. Stop and restart normally
sudo systemctl start mongod
```

### Problem 4: Slow Performance

```bash
# Check disk space
df -h

# Check memory
free -m

# MongoDB logs
sudo tail -100 /var/log/mongodb/mongod.log

# Compact database (if needed)
use scheduling_db
db.runCommand({ compact: 'collectionName' })
```

### Problem 5: Python Can't Connect

```python
# Test connection manually
from pymongo import MongoClient
import pymongo

try:
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("✓ Connected to MongoDB!")
    print(f"Version: {client.server_info()['version']}")
except Exception as e:
    print(f"✗ Error: {e}")
```

---

## Useful Commands

### Service Management

```bash
# Linux
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod
sudo systemctl status mongod
sudo systemctl enable mongod   # Auto-start on boot
sudo systemctl disable mongod  # Disable auto-start

# macOS
brew services start mongodb-community@6.0
brew services stop mongodb-community@6.0
brew services restart mongodb-community@6.0

# Windows (as Administrator)
net start MongoDB
net stop MongoDB
sc query MongoDB
```

### MongoDB Shell

```javascript
// Show databases
show dbs

// Use database
use scheduling_db

// Show collections
show collections

// Stats
db.stats()
db.serverStatus()

// Collection stats
db.rooms.stats()

// Backup
mongodump --db scheduling_db --out /backup

// Restore
mongorestore --db scheduling_db /backup/scheduling_db
```

---

## GUI Tools (Optional)

### 1. MongoDB Compass (Official)
- Download: https://www.mongodb.com/products/compass
- Best for: Visual exploration, query building

### 2. Studio 3T
- Download: https://studio3t.com/
- Best for: Advanced queries, data migration

### 3. Robo 3T
- Download: https://robomongo.org/
- Best for: Lightweight, simple interface

---

**Selesai!** MongoDB sudah siap digunakan untuk sistem penjadwalan. 🎉
