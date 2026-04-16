import os
from datetime import datetime

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError

load_dotenv()


class DatabaseHandler:
    def __init__(self):
        self.client = None
        self.db = None
        self.connect()

    def connect(self):
        """Koneksi ke MongoDB"""
        try:
            mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
            db_name = os.getenv("DATABASE_NAME", "scheduling_db")

            self.client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
            # Test koneksi
            self.client.admin.command("ping")
            self.db = self.client[db_name]

            # Buat index
            self._create_indexes()

            print(f"✓ Terhubung ke MongoDB: {db_name}")
            return True
        except ConnectionFailure as e:
            print(f"✗ Gagal terhubung ke MongoDB: {str(e)}")
            return False

    def _create_indexes(self):
        """Membuat index untuk performa optimal"""
        # Index untuk ruangan
        self.db.rooms.create_index([("room_id", ASCENDING)], unique=True)

        # Index untuk dosen
        self.db.lecturers.create_index([("lecturer_id", ASCENDING)], unique=True)

        # Index untuk mata kuliah
        self.db.courses.create_index([("course_id", ASCENDING)], unique=True)
        self.db.courses.create_index([("semester", ASCENDING)])

        # Index untuk jadwal
        self.db.schedules.create_index([("created_at", DESCENDING)])
        self.db.schedules.create_index([("semester_type", ASCENDING)])

    # ========== ROOM OPERATIONS ==========
    def add_room(self, room_id, capacity):
        """Menambah ruangan baru"""
        try:
            room_data = {
                "room_id": room_id,
                "kapasitas": capacity,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }
            result = self.db.rooms.insert_one(room_data)
            return True, result.inserted_id
        except DuplicateKeyError:
            return False, "Ruangan dengan ID tersebut sudah ada"
        except Exception as e:
            return False, str(e)

    def get_all_rooms(self):
        """Mengambil semua ruangan"""
        try:
            rooms = list(
                self.db.rooms.find({}, {"_id": 0, "room_id": 1, "kapasitas": 1})
            )
            return {room["room_id"]: {"kapasitas": room["kapasitas"]} for room in rooms}
        except Exception as e:
            print(f"Error getting rooms: {str(e)}")
            return {}

    def update_room(self, room_id, capacity):
        """Update ruangan"""
        try:
            result = self.db.rooms.update_one(
                {"room_id": room_id},
                {"$set": {"kapasitas": capacity, "updated_at": datetime.now()}},
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating room: {str(e)}")
            return False

    def delete_room(self, room_id):
        """Hapus ruangan"""
        try:
            result = self.db.rooms.delete_one({"room_id": room_id})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting room: {str(e)}")
            return False

    # ========== LECTURER OPERATIONS ==========
    def add_lecturer(self, lecturer_id, name, available_days):
        """Menambah dosen baru dengan hari mengajar"""
        try:
            lecturer_data = {
                "lecturer_id": lecturer_id,
                "name": name,
                "available_days": available_days,  # List hari yang bisa mengajar
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }
            result = self.db.lecturers.insert_one(lecturer_data)
            return True, result.inserted_id
        except DuplicateKeyError:
            return False, "Dosen dengan ID tersebut sudah ada"
        except Exception as e:
            return False, str(e)

    def get_all_lecturers(self):
        """Mengambil semua dosen"""
        try:
            lecturers = list(self.db.lecturers.find({}, {"_id": 0}))
            # Return format lama untuk kompatibilitas, tapi simpan available_days
            result = {}
            for lecturer in lecturers:
                result[lecturer["lecturer_id"]] = {
                    "name": lecturer["name"],
                    "available_days": lecturer.get(
                        "available_days", ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
                    ),
                }
            return result
        except Exception as e:
            print(f"Error getting lecturers: {str(e)}")
            return {}

    def update_lecturer(self, lecturer_id, name=None, available_days=None):
        """Update dosen"""
        try:
            update_fields = {"updated_at": datetime.now()}
            if name:
                update_fields["name"] = name
            if available_days is not None:
                update_fields["available_days"] = available_days

            result = self.db.lecturers.update_one(
                {"lecturer_id": lecturer_id}, {"$set": update_fields}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating lecturer: {str(e)}")
            return False

    def delete_lecturer(self, lecturer_id):
        """Hapus dosen"""
        try:
            result = self.db.lecturers.delete_one({"lecturer_id": lecturer_id})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting lecturer: {str(e)}")
            return False

    # ========== COURSE OPERATIONS ==========
    def add_course(self, course_id, course_data):
        """Menambah mata kuliah baru"""
        try:
            full_data = {
                "course_id": course_id,
                **course_data,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }
            result = self.db.courses.insert_one(full_data)
            return True, result.inserted_id
        except DuplicateKeyError:
            return False, "Mata kuliah dengan ID tersebut sudah ada"
        except Exception as e:
            return False, str(e)

    def get_all_courses(self):
        """Mengambil semua mata kuliah"""
        try:
            courses = list(
                self.db.courses.find({}, {"_id": 0, "created_at": 0, "updated_at": 0})
            )
            return {
                course["course_id"]: {
                    k: v for k, v in course.items() if k != "course_id"
                }
                for course in courses
            }
        except Exception as e:
            print(f"Error getting courses: {str(e)}")
            return {}

    def get_courses_by_semester(self, semester):
        """Mengambil mata kuliah berdasarkan semester"""
        try:
            courses = list(
                self.db.courses.find(
                    {"sem": semester}, {"_id": 0, "created_at": 0, "updated_at": 0}
                )
            )
            return {
                course["course_id"]: {
                    k: v for k, v in course.items() if k != "course_id"
                }
                for course in courses
            }
        except Exception as e:
            print(f"Error getting courses by semester: {str(e)}")
            return {}

    def update_course(self, course_id, course_data):
        """Update mata kuliah"""
        try:
            course_data["updated_at"] = datetime.now()
            result = self.db.courses.update_one(
                {"course_id": course_id}, {"$set": course_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating course: {str(e)}")
            return False

    def delete_course(self, course_id):
        """Hapus mata kuliah"""
        try:
            result = self.db.courses.delete_one({"course_id": course_id})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting course: {str(e)}")
            return False

    def _convert_keys_to_string(self, obj):
        """Recursively convert dict keys from int to string for MongoDB"""
        if isinstance(obj, dict):
            new_obj = {}
            for k, v in obj.items():
                new_key = str(k) if not isinstance(k, str) else k
                new_obj[new_key] = self._convert_keys_to_string(v)
            return new_obj
        elif isinstance(obj, list):
            return [self._convert_keys_to_string(item) for item in obj]
        else:
            return obj

    def save_schedule(
        self,
        schedule_data,
        semester_type,
        penalty,
        metadata=None,
        structured_result=None,
        extra_schedules=None,
    ):
        """Simpan hasil jadwal ke MongoDB."""
        try:
            schedule_doc = {
                "schedule": self._convert_keys_to_string(schedule_data),
                "semester_type": semester_type,
                "penalty": penalty,
                "metadata": self._convert_keys_to_string(metadata or {}),
                "created_at": datetime.now(),
            }

            if structured_result is not None:
                schedule_doc["structured_result"] = self._convert_keys_to_string(
                    structured_result
                )

            if extra_schedules:
                schedule_doc["extra_schedules"] = self._convert_keys_to_string(
                    extra_schedules
                )

            result = self.db.schedules.insert_one(schedule_doc)
            return True, str(result.inserted_id)
        except Exception as e:
            print(f"Error saving schedule: {str(e)}")
            return False, str(e)

    # ========== SCHEDULE OPERATIONS ==========
    # def save_schedule(
    #     self,
    #     schedule_data,
    #     semester_type,
    #     penalty,
    #     metadata=None,
    #     structured_result=None,
    #     extra_schedules=None,
    # ):
    #     """Simpan hasil jadwal ke MongoDB.
    #     - structured_result: data terstruktur per semester/hari untuk preview & download
    #     - extra_schedules: dict berisi ga_only/ga_greedy untuk mode hybrid
    #     """
    #     try:
    #         schedule_doc = {
    #             "schedule": schedule_data,
    #             "semester_type": semester_type,
    #             "penalty": penalty,
    #             "metadata": metadata or {},
    #             "created_at": datetime.now(),
    #         }
    #         if structured_result is not None:
    #             schedule_doc["structured_result"] = {
    #                 str(k): v for k, v in structured_result.items()
    #             }
    #         # Simpan jadwal ga_only & ga_greedy untuk hybrid mode download
    #         if extra_schedules:
    #             schedule_doc["extra_schedules"] = extra_schedules

    #         result = self.db.schedules.insert_one(schedule_doc)
    #         return True, str(result.inserted_id)
    #     except Exception as e:
    #         print(f"Error saving schedule: {str(e)}")
    #         return False, str(e)

    def get_latest_schedule(self, semester_type=None):
        """Mengambil jadwal terbaru"""
        try:
            query = {}
            if semester_type:
                query["semester_type"] = semester_type

            schedule = self.db.schedules.find_one(
                query, sort=[("created_at", DESCENDING)]
            )
            return schedule
        except Exception as e:
            print(f"Error getting latest schedule: {str(e)}")
            return None

    def get_schedule_history(self, limit=10):
        """Mengambil riwayat jadwal"""
        try:
            schedules = list(
                self.db.schedules.find(
                    {},
                    {"schedule": 0},  # Exclude schedule data untuk performa
                )
                .sort("created_at", DESCENDING)
                .limit(limit)
            )
            return schedules
        except Exception as e:
            print(f"Error getting schedule history: {str(e)}")
            return []

    def delete_schedule(self, schedule_id):
        """Hapus jadwal berdasarkan ID"""
        try:
            from bson.objectid import ObjectId

            result = self.db.schedules.delete_one({"_id": ObjectId(schedule_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting schedule: {str(e)}")
            return False

    def get_schedule_by_id(self, schedule_id):
        """Ambil satu jadwal lengkap berdasarkan ID (termasuk structured_result)"""
        try:
            from bson.objectid import ObjectId

            schedule = self.db.schedules.find_one({"_id": ObjectId(schedule_id)})
            return schedule
        except Exception as e:
            print(f"Error getting schedule by id: {str(e)}")
            return None

    def delete_old_schedules(self, days):
        """Hapus jadwal yang lebih tua dari X hari. Return jumlah yang dihapus."""
        try:
            from datetime import timedelta

            # Proteksi minimum: tidak boleh menghapus jadwal yang kurang dari 1 hari
            if days < 1:
                print(
                    f"⚠️  Auto-cleanup dibatalkan: nilai days={days} tidak valid (minimum 1)"
                )
                return 0

            cutoff = datetime.now() - timedelta(days=days)
            print(
                f"   Cutoff: hapus jadwal sebelum {cutoff.strftime('%Y-%m-%d %H:%M:%S')} (threshold: {days} hari)"
            )
            result = self.db.schedules.delete_many({"created_at": {"$lt": cutoff}})
            deleted = result.deleted_count
            print(
                f"✓ Auto-cleanup: {deleted} jadwal dihapus (lebih tua dari {days} hari)"
            )
            return deleted
        except Exception as e:
            print(f"Error deleting old schedules: {str(e)}")
            return 0

    # ========== BULK OPERATIONS ==========
    def load_default_data(self):
        """Load data default untuk testing"""
        try:
            # Hapus data lama
            self.db.rooms.delete_many({})
            self.db.lecturers.delete_many({})
            self.db.courses.delete_many({})

            # Rooms
            default_rooms = [
                {"room_id": "R01", "kapasitas": 150},
                {"room_id": "R02", "kapasitas": 100},
                {"room_id": "R03", "kapasitas": 80},
                {"room_id": "R04", "kapasitas": 70},
                {"room_id": "R05", "kapasitas": 80},
                {"room_id": "R06", "kapasitas": 60},
                {"room_id": "R07", "kapasitas": 55},
                {"room_id": "R08", "kapasitas": 45},
            ]

            for room in default_rooms:
                room["created_at"] = datetime.now()
                room["updated_at"] = datetime.now()
            self.db.rooms.insert_many(default_rooms)

            # Lecturers with available days
            default_lecturers = [
                {
                    "lecturer_id": "D1",
                    "name": "Dosen A",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D2",
                    "name": "Dosen B",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D3",
                    "name": "Dosen C",
                    "available_days": ["Senin", "Rabu", "Jumat"],
                },
                {
                    "lecturer_id": "D4",
                    "name": "Dosen D",
                    "available_days": ["Selasa", "Kamis"],
                },
                {
                    "lecturer_id": "D5",
                    "name": "Dosen E",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D6",
                    "name": "Dosen F",
                    "available_days": ["Senin", "Rabu", "Kamis"],
                },
                {
                    "lecturer_id": "D7",
                    "name": "Dosen G",
                    "available_days": ["Selasa", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D8",
                    "name": "Dosen H",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D9",
                    "name": "Dosen I",
                    "available_days": ["Senin", "Selasa", "Rabu"],
                },
                {
                    "lecturer_id": "D10",
                    "name": "Dosen J",
                    "available_days": ["Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D11",
                    "name": "Dosen K",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D12",
                    "name": "Dosen L",
                    "available_days": ["Selasa", "Rabu", "Kamis"],
                },
                {
                    "lecturer_id": "D13",
                    "name": "Dosen M",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D14",
                    "name": "Dosen N",
                    "available_days": ["Senin", "Rabu", "Jumat"],
                },
                {
                    "lecturer_id": "D15",
                    "name": "Dosen O",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D16",
                    "name": "Dosen P",
                    "available_days": ["Selasa", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D17",
                    "name": "Dosen Q",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D18",
                    "name": "Dosen R",
                    "available_days": ["Senin", "Rabu", "Kamis"],
                },
                {
                    "lecturer_id": "D19",
                    "name": "Dosen S",
                    "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
                },
                {
                    "lecturer_id": "D20",
                    "name": "Dosen T",
                    "available_days": ["Selasa", "Rabu", "Kamis"],
                },
            ]

            for lecturer in default_lecturers:
                lecturer["created_at"] = datetime.now()
                lecturer["updated_at"] = datetime.now()
            self.db.lecturers.insert_many(default_lecturers)

            # Courses
            default_courses = [
                # Semester 1 (Ganjil)
                {
                    "course_id": "KALKULUS_I",
                    "sem": 1,
                    "dosen": "D1",
                    "kapasitas_kelas": 63,
                    "jam": 3,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "ALGORITMA_I",
                    "sem": 1,
                    "dosen": "D2",
                    "kapasitas_kelas": 63,
                    "jam": 2,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "FISIKA",
                    "sem": 1,
                    "dosen": "D3",
                    "kapasitas_kelas": 125,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "PENGANTAR_ALGORITMA",
                    "sem": 1,
                    "dosen": "D4",
                    "kapasitas_kelas": 125,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "BAHASA_INDONESIA",
                    "sem": 1,
                    "dosen": "D5",
                    "kapasitas_kelas": 125,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "AGAMA_ISLAM",
                    "sem": 1,
                    "dosen": "D6",
                    "kapasitas_kelas": 63,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "AGAMA_KRISTEN",
                    "sem": 1,
                    "dosen": "D7",
                    "kapasitas_kelas": 63,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                # Semester 2 (Genap)
                {
                    "course_id": "KALKULUS_II",
                    "sem": 2,
                    "dosen": "D1",
                    "kapasitas_kelas": 63,
                    "jam": 3,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "ALGORITMA_II",
                    "sem": 2,
                    "dosen": "D2",
                    "kapasitas_kelas": 63,
                    "jam": 2,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "KIMIA_DASAR",
                    "sem": 2,
                    "dosen": "D3",
                    "kapasitas_kelas": 125,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                # Semester 3 (Ganjil)
                {
                    "course_id": "STATISTIKA",
                    "sem": 3,
                    "dosen": "D8",
                    "kapasitas_kelas": 93,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "SISTEM_DIGITAL",
                    "sem": 3,
                    "dosen": "D9",
                    "kapasitas_kelas": 45,
                    "jam": 2,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "M_DISKRIT",
                    "sem": 3,
                    "dosen": "D10",
                    "kapasitas_kelas": 93,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "IMK",
                    "sem": 3,
                    "dosen": "D4",
                    "kapasitas_kelas": 93,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "STRUKTUR_DATA",
                    "sem": 3,
                    "dosen": "D11",
                    "kapasitas_kelas": 45,
                    "jam": 3,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "PPKN",
                    "sem": 3,
                    "dosen": "D12",
                    "kapasitas_kelas": 93,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "BASIS_DATA",
                    "sem": 3,
                    "dosen": "D13",
                    "kapasitas_kelas": 45,
                    "jam": 2,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                # Semester 5 (Ganjil)
                {
                    "course_id": "JST",
                    "sem": 5,
                    "dosen": "D15",
                    "kapasitas_kelas": 40,
                    "jam": 3,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "APK_WEB",
                    "sem": 5,
                    "dosen": "D16",
                    "kapasitas_kelas": 80,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "SISTEM_INFO",
                    "sem": 5,
                    "dosen": "D17",
                    "kapasitas_kelas": 80,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "GRAFKOM",
                    "sem": 5,
                    "dosen": "D18",
                    "kapasitas_kelas": 80,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "SISTEM_OPERASI",
                    "sem": 5,
                    "dosen": "D14",
                    "kapasitas_kelas": 76,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "METODE",
                    "sem": 5,
                    "dosen": "D4",
                    "kapasitas_kelas": 80,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "JARKOM",
                    "sem": 5,
                    "dosen": "D18",
                    "kapasitas_kelas": 80,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                # Semester 7 (Ganjil)
                {
                    "course_id": "ETIKA",
                    "sem": 7,
                    "dosen": "D19",
                    "kapasitas_kelas": 76,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "SPK",
                    "sem": 7,
                    "dosen": "D13",
                    "kapasitas_kelas": 76,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "ML",
                    "sem": 7,
                    "dosen": "D20",
                    "kapasitas_kelas": 40,
                    "jam": 3,
                    "tipe": "terpisah",
                    "sesi": 1,
                },
                {
                    "course_id": "SOFT",
                    "sem": 7,
                    "dosen": "D16",
                    "kapasitas_kelas": 76,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "MPPL",
                    "sem": 7,
                    "dosen": "D19",
                    "kapasitas_kelas": 80,
                    "jam": 2,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
                {
                    "course_id": "KRIPTO",
                    "sem": 7,
                    "dosen": "D2",
                    "kapasitas_kelas": 76,
                    "jam": 3,
                    "tipe": "gabungan",
                    "sesi": 1,
                },
            ]

            for course in default_courses:
                course["created_at"] = datetime.now()
                course["updated_at"] = datetime.now()
            self.db.courses.insert_many(default_courses)

            print("✓ Data default berhasil dimuat")
            return True
        except Exception as e:
            print(f"✗ Error loading default data: {str(e)}")
            return False

    def close(self):
        """Tutup koneksi database"""
        if self.client:
            self.client.close()
            print("✓ Koneksi MongoDB ditutup")


# Singleton instance
db_handler = DatabaseHandler()
