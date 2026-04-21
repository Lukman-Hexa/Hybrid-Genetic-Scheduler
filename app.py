import json
import os
import queue
import threading
import traceback
import uuid
from datetime import datetime
from functools import wraps
from io import BytesIO

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, send_file

from db_handler import db_handler
from export_handler import export_to_excel, export_to_excel_buffer
from scheduling_engine import (
    COURSE_CONFIG,
    SEMESTER_GANJIL,
    SEMESTER_GENAP,
    ConstraintViolationError,
    SchedulingError,
    ValidationError,
    run_genetic_algorithm,
)

load_dotenv()

# ===== AUTO-DELETE SCHEDULER =====
try:
    from apscheduler.schedulers.background import BackgroundScheduler

    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    print("⚠️  APScheduler tidak terinstall. Auto-delete nonaktif.")
    print("   Jalankan: pip install apscheduler")


# ===== MULTI-ASPECT TIE-BREAKING =====
def calculate_schedule_quality_score(schedule, metrics):
    """
    Menghitung skor kualitas jadwal berdasarkan 3 aspek dengan bobot sama (33% masing-masing):
    1. Distribusi ruangan → pemakaian ruang lebih merata
    2. Jumlah generasi    → konvergen lebih cepat lebih baik (baseline relatif antar kedua metode)
    3. Distribusi hari   → jadwal tersebar merata per hari

    Catatan:
    - Aspek waktu komputasi DIHAPUS dari skor kualitas karena GA+Greedy
      selalu lebih lambat akibat fase greedy tambahan — bukan cerminan kualitas jadwal.
    - Baseline generasi menggunakan "max_generations_ref" yang diisi dari luar
      (nilai generasi terbesar di antara kedua metode) agar perbandingan relatif
      dan tidak menguntungkan metode yang restart lebih sering.

    Semua aspek dinormalisasi ke rentang 0–100, lalu dirata-rata.
    """
    scores = {}

    # --- Aspek 1: Distribusi Ruangan ---
    room_usage = {}
    for session_id, (room, _) in schedule.items():
        room_usage[room] = room_usage.get(room, 0) + 1

    if len(room_usage) > 1:
        values = list(room_usage.values())
        mean_usage = sum(values) / len(values)
        variance = sum((v - mean_usage) ** 2 for v in values) / len(values)
        std_dev = variance**0.5
        scores["ruangan"] = max(0, 100 - (std_dev / max(mean_usage, 1)) * 100)
    else:
        scores["ruangan"] = 100.0

    # --- Aspek 2: Jumlah Generasi (baseline relatif) ---
    # max_generations_ref diisi dari luar berdasarkan generasi terbesar
    # di antara kedua metode, sehingga perbandingan tidak bias.
    generations = metrics.get("ga_generations", metrics.get("generations", 10000))
    max_gen_ref = metrics.get("max_generations_ref", 10000)
    scores["generasi"] = max(0, 100 - (generations / max(max_gen_ref, 1)) * 100)

    # --- Aspek 3: Distribusi Hari ---
    day_usage = {}
    for _, (_, time_slot) in schedule.items():
        day = time_slot.split(" ")[0]
        day_usage[day] = day_usage.get(day, 0) + 1

    if len(day_usage) > 1:
        values = list(day_usage.values())
        mean_day = sum(values) / len(values)
        variance = sum((v - mean_day) ** 2 for v in values) / len(values)
        std_dev = variance**0.5
        scores["hari"] = max(0, 100 - (std_dev / max(mean_day, 1)) * 100)
    else:
        scores["hari"] = 100.0

    # --- Skor Akhir ---
    final_score = sum(scores.values()) / len(scores)
    return round(final_score, 4), scores


def determine_winner(
    penalty_ga,
    penalty_hybrid,
    schedule_ga,
    schedule_hybrid,
    metrics_ga,
    metrics_hybrid,
    score_ga=None,
    scores_ga=None,
    score_hybrid=None,
    scores_hybrid=None,
):
    """
    Menentukan pemenang dengan logika multi-aspek tie-breaking bertingkat:

    Level 1 — Penalti (hard constraint): pemenang dengan penalti lebih kecil.
    Level 2 — Skor kualitas total (rata-rata 3 aspek): jika penalti sama.
    Level 3 — Hierarki aspek per-aspek (jika skor total juga sama):
               (a) Distribusi hari  → jadwal paling merata antar hari
               (b) Distribusi ruangan → pemakaian ruang paling merata
               (c) Jumlah generasi  → konvergen lebih cepat
    Level 4 — Default ke GA+Greedy jika semua aspek benar-benar identik.

    Parameter score_ga/scores_ga/score_hybrid/scores_hybrid bersifat opsional.
    Jika tidak diisi, fungsi menghitungnya sendiri (hindari duplikasi bila
    pemanggil sudah menghitung sebelumnya).

    Mengembalikan: (best_method, tiebreak_detail, winner_flag, score_ga, score_hybrid, quality_scores)
    """
    # Hitung skor kualitas jika belum dihitung oleh pemanggil
    if score_ga is None or scores_ga is None:
        score_ga, scores_ga = calculate_schedule_quality_score(schedule_ga, metrics_ga)
    if score_hybrid is None or scores_hybrid is None:
        score_hybrid, scores_hybrid = calculate_schedule_quality_score(
            schedule_hybrid, metrics_hybrid
        )

    quality_scores = {"ga_only": scores_ga, "ga_greedy": scores_hybrid}
    tiebreak_detail = None

    # ===== Level 1: Penalti =====
    if penalty_ga < penalty_hybrid:
        tiebreak_detail = {
            "note": f"GA Murni menang di Level 1 (penalti): {penalty_ga:.2f} < {penalty_hybrid:.2f}"
        }
        return (
            "Genetika Murni",
            tiebreak_detail,
            "ga_only",
            score_ga,
            score_hybrid,
            quality_scores,
        )
    elif penalty_hybrid < penalty_ga:
        tiebreak_detail = {
            "note": f"GA+Greedy menang di Level 1 (penalti): {penalty_hybrid:.2f} < {penalty_ga:.2f}"
        }
        return (
            "Genetika + Greedy",
            tiebreak_detail,
            "ga_greedy",
            score_ga,
            score_hybrid,
            quality_scores,
        )

    # ===== Level 2: Skor kualitas total =====
    EPSILON = 0.01  # toleransi agar skor yang hampir sama dianggap seri
    tiebreak_detail = {
        "note": "Penalti identik — masuk tie-breaking multi-aspek",
        "ga_only": {
            "total_score": score_ga,
            "ruangan_score": round(scores_ga["ruangan"], 2),
            "generasi_score": round(scores_ga["generasi"], 2),
            "hari_score": round(scores_ga["hari"], 2),
        },
        "ga_greedy": {
            "total_score": score_hybrid,
            "ruangan_score": round(scores_hybrid["ruangan"], 2),
            "generasi_score": round(scores_hybrid["generasi"], 2),
            "hari_score": round(scores_hybrid["hari"], 2),
        },
    }

    if abs(score_ga - score_hybrid) > EPSILON:
        if score_ga > score_hybrid:
            winner_flag, best_method = "ga_only", "Genetika Murni"
            margin = score_ga - score_hybrid
        else:
            winner_flag, best_method = "ga_greedy", "Genetika + Greedy"
            margin = score_hybrid - score_ga
        tiebreak_detail["tiebreak_level"] = "Level 2 - Skor kualitas total"
        tiebreak_detail["tiebreak_winner"] = best_method
        tiebreak_detail["margin"] = round(margin, 4)
        return (
            best_method,
            tiebreak_detail,
            winner_flag,
            score_ga,
            score_hybrid,
            quality_scores,
        )

    # ===== Level 3: Hierarki aspek per-aspek =====
    # Urutan prioritas: (a) hari, (b) ruangan, (c) generasi
    for aspect_key, aspect_label in [
        ("hari", "Distribusi hari"),
        ("ruangan", "Distribusi ruangan"),
        ("generasi", "Konvergensi generasi"),
    ]:
        val_ga = scores_ga[aspect_key]
        val_hybrid = scores_hybrid[aspect_key]
        if abs(val_ga - val_hybrid) > EPSILON:
            if val_ga > val_hybrid:
                winner_flag, best_method = "ga_only", "Genetika Murni"
                margin = val_ga - val_hybrid
            else:
                winner_flag, best_method = "ga_greedy", "Genetika + Greedy"
                margin = val_hybrid - val_ga
            tiebreak_detail["tiebreak_level"] = f"Level 3 - {aspect_label}"
            tiebreak_detail["tiebreak_winner"] = best_method
            tiebreak_detail["margin"] = round(margin, 4)
            return (
                best_method,
                tiebreak_detail,
                winner_flag,
                score_ga,
                score_hybrid,
                quality_scores,
            )

    # ===== Level 4: Default ke GA+Greedy =====
    tiebreak_detail["tiebreak_level"] = "Level 4 - Default (semua aspek identik)"
    tiebreak_detail["tiebreak_winner"] = "Genetika + Greedy"
    tiebreak_detail["note"] += " | Semua aspek identik -> default ke GA+Greedy"
    tiebreak_detail["margin"] = 0.0
    return (
        "Genetika + Greedy",
        tiebreak_detail,
        "ga_greedy",
        score_ga,
        score_hybrid,
        quality_scores,
    )


app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["DOWNLOAD_FOLDER"] = "static/downloads"

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["DOWNLOAD_FOLDER"], exist_ok=True)

# ===== JOB STORE untuk SSE progress =====
# { job_id: {"queue": Queue, "result": dict|None, "error": str|None, "done": bool} }
_jobs: dict = {}
_jobs_lock = threading.Lock()


# ===== ERROR HANDLER DECORATOR =====
def handle_errors(f):
    """Decorator untuk menangani error secara konsisten"""

    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            print(f"Validation Error: {e.message}")
            return jsonify(
                {
                    "status": "error",
                    "code": e.code,
                    "message": e.message,
                    "details": e.details,
                }
            ), 400
        except ConstraintViolationError as e:
            print(f"Constraint Error: {e.message}")
            return jsonify(
                {
                    "status": "error",
                    "code": e.code,
                    "message": e.message,
                    "details": e.details,
                    "suggestion": "Coba kurangi jumlah mata kuliah atau tambah ruangan",
                }
            ), 422
        except SchedulingError as e:
            print(f"Scheduling Error: {e.message}")
            return jsonify(
                {
                    "status": "error",
                    "code": e.code,
                    "message": e.message,
                    "details": e.details,
                }
            ), 500
        except Exception as e:
            print(f"Unexpected Error: {str(e)}")
            traceback.print_exc()
            return jsonify(
                {
                    "status": "error",
                    "code": "INTERNAL_ERROR",
                    "message": "Terjadi kesalahan internal server",
                    "details": {"error": str(e)} if app.debug else {},
                }
            ), 500

    return wrapper


# ===== VALIDATION FUNCTIONS =====
def validate_room_data(room_id, capacity):
    """Validasi data ruangan"""
    errors = []

    if not room_id or not room_id.strip():
        errors.append("ID Ruangan tidak boleh kosong")

    room_id = room_id.strip().upper()
    if not room_id or len(room_id) < 2 or len(room_id) > 10:
        errors.append("ID Ruangan harus 2-10 karakter")

    if not room_id.isalnum():
        errors.append("ID Ruangan hanya boleh huruf dan angka")

    if capacity is None:
        errors.append("Kapasitas harus diisi")
    else:
        try:
            cap = int(capacity)
            if cap < 20:
                errors.append("Kapasitas minimal 20 orang")
            if cap > 500:
                errors.append("Kapasitas maksimal 500 orang")
            if not isinstance(cap, int) or cap != float(capacity):
                errors.append("Kapasitas harus angka bulat")
        except (ValueError, TypeError):
            errors.append("Kapasitas harus angka valid")

    return errors


def validate_dosen_data(dosen_id, name, available_days):
    """Validasi data dosen"""
    errors = []

    if not dosen_id or not dosen_id.strip():
        errors.append("ID Dosen tidak boleh kosong")

    dosen_id = dosen_id.strip().upper()
    if not dosen_id or len(dosen_id) < 2 or len(dosen_id) > 10:
        errors.append("ID Dosen harus 2-10 karakter")

    if not dosen_id.isalnum():
        errors.append("ID Dosen hanya boleh huruf dan angka")

    if not name or not name.strip():
        errors.append("Nama Dosen tidak boleh kosong")

    if len(name.strip()) < 3:
        errors.append("Nama Dosen minimal 3 karakter")

    if not available_days or len(available_days) == 0:
        errors.append("Pilih minimal 1 hari mengajar")

    valid_days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
    for day in available_days:
        if day not in valid_days:
            errors.append(f"Hari tidak valid: {day}")

    return errors


def validate_course_data(name, sem, dosen_id, capacity, jam, tipe):
    """Validasi data mata kuliah"""
    errors = []

    if not name or not name.strip():
        errors.append("Nama Mata Kuliah tidak boleh kosong")

    name = name.strip().upper()
    if not name or len(name) < 3:
        errors.append("Nama Mata Kuliah minimal 3 karakter")

    if len(name) > 50:
        errors.append("Nama Mata Kuliah maksimal 50 karakter")

    if not name.replace("_", "").isalnum():
        errors.append("Nama Mata Kuliah hanya boleh huruf, angka, dan underscore")

    try:
        sem_int = int(sem)
        if sem_int < 1 or sem_int > 8:
            errors.append("Semester harus 1-8")
    except (ValueError, TypeError):
        errors.append("Semester harus angka valid")

    if not dosen_id:
        errors.append("Pilih dosen pengajar")

    try:
        cap_int = int(capacity)
        if cap_int < 20 or cap_int > 150:
            errors.append("Kapasitas harus 20-150 orang")
        if not isinstance(cap_int, int) or cap_int != float(capacity):
            errors.append("Kapasitas harus angka bulat")
    except (ValueError, TypeError):
        errors.append("Kapasitas harus angka valid")

    try:
        jam_int = int(jam)
        if jam_int < 1 or jam_int > 6:
            errors.append("Durasi harus 1-6 jam")
    except (ValueError, TypeError):
        errors.append("Durasi harus angka valid")

    if tipe not in ["terpisah", "gabungan"]:
        errors.append("Tipe kelas tidak valid")

    return errors


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/default-config", methods=["GET"])
def get_default_config():
    """Return konfigurasi default dari database atau hardcoded"""
    try:
        rooms = db_handler.get_all_rooms()
        lecturers = db_handler.get_all_lecturers()
        courses = db_handler.get_all_courses()

        if not rooms or not lecturers or not courses:
            db_handler.load_default_data()
            rooms = db_handler.get_all_rooms()
            lecturers = db_handler.get_all_lecturers()
            courses = db_handler.get_all_courses()

        config = {
            "rooms": rooms,
            "lecturers": lecturers,
            "courses": courses,
            "semester_ganjil": SEMESTER_GANJIL,
            "semester_genap": SEMESTER_GENAP,
            "days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
        }
        return jsonify({"status": "success", "data": config})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/rooms", methods=["GET", "POST", "PUT", "DELETE"])
@handle_errors
def manage_rooms():
    """CRUD operations untuk ruangan dengan validasi"""
    try:
        if request.method == "GET":
            rooms = db_handler.get_all_rooms()
            return jsonify({"status": "success", "data": rooms})

        elif request.method == "POST":
            data = request.get_json()
            room_id = data.get("room_id", "").strip().upper()
            capacity = data.get("capacity")

            errors = validate_room_data(room_id, capacity)
            if errors:
                raise ValidationError(
                    message="Validasi ruangan gagal",
                    code="ROOM_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            existing_rooms = db_handler.get_all_rooms()
            for existing_id in existing_rooms.keys():
                if existing_id.upper() == room_id.upper() and existing_id != room_id:
                    raise ValidationError(
                        message=f"Ruangan dengan ID mirip sudah ada: {existing_id}",
                        code="ROOM_DUPLICATE",
                        details={"existing": existing_id, "requested": room_id},
                    )

            success, result = db_handler.add_room(room_id, int(capacity))
            if success:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Ruangan {room_id} berhasil ditambahkan",
                        "data": {"room_id": room_id, "capacity": capacity},
                    }
                )
            else:
                raise ValidationError(message=result, code="ROOM_ADD_FAILED")

        elif request.method == "PUT":
            data = request.get_json()
            room_id = data.get("room_id", "").strip().upper()
            capacity = data.get("capacity")

            errors = validate_room_data(room_id, capacity)
            if errors:
                raise ValidationError(
                    message="Validasi ruangan gagal",
                    code="ROOM_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            success = db_handler.update_room(room_id, int(capacity))
            if success:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Ruangan {room_id} berhasil diupdate",
                    }
                )
            else:
                raise ValidationError(
                    message="Gagal update ruangan", code="ROOM_UPDATE_FAILED"
                )

        elif request.method == "DELETE":
            data = request.get_json()
            room_id = data.get("room_id", "").strip().upper()

            if not room_id:
                raise ValidationError(
                    message="ID Ruangan tidak boleh kosong", code="ROOM_ID_EMPTY"
                )

            success = db_handler.delete_room(room_id)
            if success:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Ruangan {room_id} berhasil dihapus",
                    }
                )
            else:
                raise ValidationError(
                    message="Gagal hapus ruangan", code="ROOM_DELETE_FAILED"
                )

    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(message=str(e), code="ROOM_OPERATION_FAILED")


@app.route("/api/lecturers", methods=["GET", "POST", "PUT", "DELETE"])
@handle_errors
def manage_lecturers():
    """CRUD operations untuk dosen dengan validasi"""
    try:
        if request.method == "GET":
            lecturers = db_handler.get_all_lecturers()
            return jsonify({"status": "success", "data": lecturers})

        elif request.method == "POST":
            data = request.get_json()
            lecturer_id = data.get("lecturer_id", "").strip().upper()
            name = data.get("name", "").strip()
            available_days = data.get("available_days", [])

            errors = validate_dosen_data(lecturer_id, name, available_days)
            if errors:
                raise ValidationError(
                    message="Validasi dosen gagal",
                    code="DOSEN_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            existing = db_handler.get_all_lecturers()
            for existing_id in existing.keys():
                if (
                    existing_id.upper() == lecturer_id.upper()
                    and existing_id != lecturer_id
                ):
                    raise ValidationError(
                        message=f"Dosen dengan ID mirip sudah ada: {existing_id}",
                        code="DOSEN_DUPLICATE",
                        details={"existing": existing_id, "requested": lecturer_id},
                    )

            success, result = db_handler.add_lecturer(lecturer_id, name, available_days)
            if success:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Dosen {name} berhasil ditambahkan",
                    }
                )
            else:
                raise ValidationError(message=result, code="DOSEN_ADD_FAILED")

        elif request.method == "PUT":
            data = request.get_json()
            lecturer_id = data.get("lecturer_id", "").strip().upper()
            name = data.get("name", "").strip()
            available_days = data.get("available_days")

            errors = validate_dosen_data(lecturer_id, name, available_days or [])
            if errors:
                raise ValidationError(
                    message="Validasi dosen gagal",
                    code="DOSEN_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            success = db_handler.update_lecturer(lecturer_id, name, available_days)
            if success:
                return jsonify(
                    {"status": "success", "message": f"Dosen {name} berhasil diupdate"}
                )
            else:
                raise ValidationError(
                    message="Gagal update dosen", code="DOSEN_UPDATE_FAILED"
                )

        elif request.method == "DELETE":
            data = request.get_json()
            lecturer_id = data.get("lecturer_id", "").strip().upper()

            if not lecturer_id:
                raise ValidationError(
                    message="ID Dosen tidak boleh kosong", code="DOSEN_ID_EMPTY"
                )

            success = db_handler.delete_lecturer(lecturer_id)
            if success:
                return jsonify(
                    {"status": "success", "message": f"Dosen berhasil dihapus"}
                )
            else:
                raise ValidationError(
                    message="Gagal hapus dosen", code="DOSEN_DELETE_FAILED"
                )

    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(message=str(e), code="DOSEN_OPERATION_FAILED")


@app.route("/api/courses", methods=["GET", "POST", "PUT", "DELETE"])
@handle_errors
def manage_courses():
    """CRUD operations untuk mata kuliah dengan validasi"""
    try:
        if request.method == "GET":
            semester = request.args.get("semester", type=int)
            if semester:
                courses = db_handler.get_courses_by_semester(semester)
            else:
                courses = db_handler.get_all_courses()
            return jsonify({"status": "success", "data": courses})

        elif request.method == "POST":
            data = request.get_json()
            course_id = data.get("course_id", "").strip().upper()

            errors = validate_course_data(
                course_id,
                data.get("sem"),
                data.get("dosen"),
                data.get("kapasitas_kelas"),
                data.get("jam"),
                data.get("tipe"),
            )

            if errors:
                raise ValidationError(
                    message="Validasi mata kuliah gagal",
                    code="COURSE_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            course_data = {
                "sem": int(data.get("sem")),
                "dosen": data.get("dosen"),
                "kapasitas_kelas": int(data.get("kapasitas_kelas")),
                "jam": int(data.get("jam")),
                "tipe": data.get("tipe"),
                "sesi": data.get("sesi", 1),
            }

            dosens = db_handler.get_all_lecturers()
            if data.get("dosen") not in dosens:
                raise ValidationError(
                    message="Dosen tidak ditemukan",
                    code="DOSEN_NOT_FOUND",
                    details={"dosen_id": data.get("dosen")},
                )

            success, result = db_handler.add_course(course_id, course_data)
            if success:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Mata kuliah {course_id} berhasil ditambahkan",
                    }
                )
            else:
                raise ValidationError(message=result, code="COURSE_ADD_FAILED")

        elif request.method == "PUT":
            data = request.get_json()
            course_id = data.get("course_id", "").strip().upper()

            errors = validate_course_data(
                course_id,
                data.get("sem"),
                data.get("dosen"),
                data.get("kapasitas_kelas"),
                data.get("jam"),
                data.get("tipe"),
            )

            if errors:
                raise ValidationError(
                    message="Validasi mata kuliah gagal",
                    code="COURSE_VALIDATION_ERROR",
                    details={"errors": errors},
                )

            course_data = {k: v for k, v in data.items() if k != "course_id"}
            if "sem" in course_data:
                course_data["sem"] = int(course_data["sem"])
            if "kapasitas_kelas" in course_data:
                course_data["kapasitas_kelas"] = int(course_data["kapasitas_kelas"])
            if "jam" in course_data:
                course_data["jam"] = int(course_data["jam"])

            success = db_handler.update_course(course_id, course_data)
            if success:
                return jsonify(
                    {"status": "success", "message": f"Mata kuliah berhasil diupdate"}
                )
            else:
                raise ValidationError(
                    message="Gagal update mata kuliah", code="COURSE_UPDATE_FAILED"
                )

        elif request.method == "DELETE":
            data = request.get_json()
            course_id = data.get("course_id", "").strip().upper()

            if not course_id:
                raise ValidationError(
                    message="ID Mata Kuliah tidak boleh kosong", code="COURSE_ID_EMPTY"
                )

            success = db_handler.delete_course(course_id)
            if success:
                return jsonify(
                    {"status": "success", "message": f"Mata kuliah berhasil dihapus"}
                )
            else:
                raise ValidationError(
                    message="Gagal hapus mata kuliah", code="COURSE_DELETE_FAILED"
                )

    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(message=str(e), code="COURSE_OPERATION_FAILED")


@app.route("/api/optimize/start", methods=["POST"])
@handle_errors
def optimize_start():
    """
    Terima payload optimasi, jalankan GA di background thread,
    kembalikan job_id untuk di-poll via SSE.
    """
    data = request.get_json()
    if not data:
        raise ValidationError(message="Data kosong", code="EMPTY_REQUEST")

    ga_params = data.get("ga_params", {})
    semester_type = data.get("semester_type", "ganjil")
    algorithm_mode = data.get("algorithm_mode", "hybrid")

    # Validasi awal (sama seperti /api/optimize)
    rooms = db_handler.get_all_rooms()
    dosen = db_handler.get_all_lecturers()
    all_courses = db_handler.get_all_courses()

    if semester_type == "ganjil":
        courses = {k: v for k, v in all_courses.items() if v.get("sem", 0) % 2 == 1}
    else:
        courses = {k: v for k, v in all_courses.items() if v.get("sem", 0) % 2 == 0}

    if not rooms:
        raise ValidationError(message="Tidak ada ruangan di database.", code="NO_ROOMS")
    if not dosen:
        raise ValidationError(message="Tidak ada dosen di database.", code="NO_DOSEN")
    if not courses:
        raise ValidationError(
            message=f"Tidak ada mata kuliah untuk semester {semester_type}.",
            code="NO_COURSES",
        )
    if algorithm_mode not in ["ga_only", "ga_greedy", "hybrid"]:
        raise ValidationError(
            message="Mode algoritma tidak valid", code="INVALID_ALGORITHM_MODE"
        )

    max_course_capacity = max(c["kapasitas_kelas"] for c in courses.values())
    max_room_capacity = max(rooms[r]["kapasitas"] for r in rooms)
    if max_course_capacity > max_room_capacity:
        raise ConstraintViolationError(
            message=f"Tidak ada ruangan yang cukup besar untuk mata kuliah kapasitas {max_course_capacity}",
            code="ROOM_CAPACITY_INSUFFICIENT",
            details={
                "max_course_capacity": max_course_capacity,
                "max_room_capacity": max_room_capacity,
            },
        )

    for course_id, course_data in courses.items():
        dosen_id = course_data.get("dosen")
        if dosen_id not in dosen:
            raise ValidationError(
                message=f"Dosen {dosen_id} untuk mata kuliah {course_id} tidak ditemukan",
                code="DOSEN_NOT_FOUND",
                details={"course": course_id, "dosen": dosen_id},
            )

    job_id = str(uuid.uuid4())
    job_queue = queue.Queue()

    with _jobs_lock:
        _jobs[job_id] = {
            "queue": job_queue,
            "result": None,
            "error": None,
            "done": False,
        }

    def run_job():
        try:
            # ── helper: kirim event ke queue ──────────────────────────────
            def make_callback(bar="main"):
                """
                bar="main"   → single mode (ga_only / ga_greedy): update 1 progress bar
                bar="ga"     → hybrid mode: update progress bar GA Murni
                bar="greedy" → hybrid mode: update progress bar GA+Greedy
                """

                def cb(info):
                    pct = round(
                        (info["generation"] / max(info["max_generations"], 1)) * 100, 1
                    )
                    job_queue.put(
                        {
                            "type": "progress",
                            "bar": bar,
                            "percent": pct,
                            "generation": info["generation"],
                            "max_gen": info["max_generations"],
                            "penalty": info["penalty"],
                            "phase": info["phase"],
                            "eta_sec": info.get("eta_sec", 0),
                            "stagnant": info.get("stagnant", 0),
                        }
                    )

                return cb

            # ── jalankan algoritma ─────────────────────────────────────────
            if algorithm_mode == "ga_only":
                job_queue.put({"type": "status", "message": "Menjalankan GA Murni..."})
                final_schedule, final_penalty, structured_result, metrics = (
                    run_genetic_algorithm(
                        rooms=rooms,
                        dosen=dosen,
                        courses=courses,
                        ga_params=ga_params,
                        semester_type=semester_type,
                        use_greedy=False,
                        progress_callback=make_callback("main"),
                    )
                )
                comparison = None
                metadata = {
                    "total_courses": len(courses),
                    "total_sessions": len(final_schedule),
                    "ga_params": ga_params,
                    "metrics": metrics,
                    "algorithm_used": "Genetika Murni",
                    "algorithm_mode": "ga_only",
                }

            elif algorithm_mode == "ga_greedy":
                job_queue.put(
                    {"type": "status", "message": "Menjalankan GA + Greedy..."}
                )
                final_schedule, final_penalty, structured_result, metrics = (
                    run_genetic_algorithm(
                        rooms=rooms,
                        dosen=dosen,
                        courses=courses,
                        ga_params=ga_params,
                        semester_type=semester_type,
                        use_greedy=True,
                        progress_callback=make_callback("main"),
                    )
                )
                comparison = None
                metadata = {
                    "total_courses": len(courses),
                    "total_sessions": len(final_schedule),
                    "ga_params": ga_params,
                    "metrics": metrics,
                    "algorithm_used": "GA + Greedy (Restart + Greedy Post-processing)",
                    "algorithm_mode": "ga_greedy",
                }

            else:  # hybrid — 2 progress bar terpisah
                job_queue.put(
                    {
                        "type": "status",
                        "message": "Menjalankan kedua algoritma...",
                        "mode": "hybrid",
                    }
                )

                # Baru seed yang sama untuk Kedua algoritma fair comparasion
                # tanpa seed identik, satu algoritma bisa "menang" hanya karena
                # keberuntungan populasi awal yg lebih menguntungkan
                HYBRID_SEED = 42

                schedule_ga, penalty_ga, structured_ga, metrics_ga = (
                    run_genetic_algorithm(
                        rooms=rooms,
                        dosen=dosen,
                        courses=courses,
                        ga_params=ga_params,
                        semester_type=semester_type,
                        use_greedy=False,
                        progress_callback=make_callback("ga"),
                        seed=HYBRID_SEED,  # seed harus sama
                    )
                )

                job_queue.put(
                    {"type": "phase_done", "bar": "ga", "penalty": penalty_ga}
                )
                schedule_hybrid, penalty_hybrid, structured_hybrid, metrics_hybrid = (
                    run_genetic_algorithm(
                        rooms=rooms,
                        dosen=dosen,
                        courses=courses,
                        ga_params=ga_params,
                        semester_type=semester_type,
                        use_greedy=True,
                        progress_callback=make_callback("greedy"),
                        seed=HYBRID_SEED,  # Seed sama dengan ga murni
                    )
                )

                # Tie-breaking (sama seperti /api/optimize)
                max_gen_ref = max(
                    metrics_ga.get("ga_generations", 10000),
                    metrics_hybrid.get("ga_generations", 10000),
                )
                metrics_ga["max_generations_ref"] = max_gen_ref
                metrics_hybrid["max_generations_ref"] = max_gen_ref

                score_ga, scores_ga = calculate_schedule_quality_score(
                    schedule_ga, metrics_ga
                )
                score_hybrid, scores_hybrid = calculate_schedule_quality_score(
                    schedule_hybrid, metrics_hybrid
                )

                best_method, tiebreak_detail, winner_flag, _, _, quality_scores = (
                    determine_winner(
                        penalty_ga,
                        penalty_hybrid,
                        schedule_ga,
                        schedule_hybrid,
                        metrics_ga,
                        metrics_hybrid,
                    )
                )

                # ── Cetak hasil tie-breaking ke terminal ──────────────────
                print(f"\n{'=' * 60}")
                print(f"  HASIL TIE-BREAKING ALGORITMA")
                print(f"{'=' * 60}")
                print(f"  Penalti GA Murni    : {penalty_ga:.2f}")
                print(f"  Penalti GA + Greedy : {penalty_hybrid:.2f}")
                if tiebreak_detail:
                    tb_level = tiebreak_detail.get(
                        "tiebreak_level", "Level 1 - Penalti"
                    )
                    tb_note = tiebreak_detail.get("note", "")
                    tb_margin = tiebreak_detail.get("margin")
                    print(f"  Metode keputusan    : {tb_level}")
                    if tb_note:
                        print(f"  Keterangan          : {tb_note}")
                    if tb_margin is not None:
                        print(f"  Selisih skor        : {tb_margin:.4f}")
                qs_ga = quality_scores.get("ga_only", {})
                qs_hyb = quality_scores.get("ga_greedy", {})
                if qs_ga or qs_hyb:
                    print(f"  {'Aspek':<22} {'GA Murni':>10} {'GA+Greedy':>10}")
                    print(f"  {'-' * 44}")
                    for asp, label in [
                        ("hari", "Distribusi Hari"),
                        ("ruangan", "Distribusi Ruangan"),
                        ("generasi", "Konvergensi Generasi"),
                    ]:
                        v_ga = qs_ga.get(asp)
                        v_hyb = qs_hyb.get(asp)
                        ga_str = f"{v_ga:.2f}" if v_ga is not None else "-"
                        hyb_str = f"{v_hyb:.2f}" if v_hyb is not None else "-"
                        mark_ga = (
                            " ◀"
                            if (v_ga is not None and v_hyb is not None and v_ga > v_hyb)
                            else ""
                        )
                        mark_hyb = (
                            " ◀"
                            if (v_ga is not None and v_hyb is not None and v_hyb > v_ga)
                            else ""
                        )
                        print(
                            f"  {label:<22} {ga_str + mark_ga:>10} {hyb_str + mark_hyb:>10}"
                        )
                print(f"{'=' * 60}")
                print(f"  🏆 PEMENANG : {best_method} ({winner_flag})")
                print(f"{'=' * 60}\n")
                # ─────────────────────────────────────────────────────────

                if winner_flag == "ga_only":
                    final_schedule, final_penalty, structured_result = (
                        schedule_ga,
                        penalty_ga,
                        structured_ga,
                    )
                else:
                    final_schedule, final_penalty, structured_result = (
                        schedule_hybrid,
                        penalty_hybrid,
                        structured_hybrid,
                    )

                comparison = {
                    "ga_only": {
                        "penalty": penalty_ga,
                        "time": metrics_ga.get("total_time", 0),
                        "generations": metrics_ga.get("ga_generations", 0),
                        "status": "optimal" if penalty_ga == 0 else "sub-optimal",
                        "structured_result": structured_ga,
                        "total_sessions": len(schedule_ga),
                        "quality_score": score_ga,
                        "quality_detail": {
                            k: round(v, 2) for k, v in scores_ga.items()
                        },
                    },
                    "ga_greedy": {
                        "penalty": penalty_hybrid,
                        "time": metrics_hybrid.get("total_time", 0),
                        "generations": metrics_hybrid.get("ga_generations", 0),
                        "ga_time": metrics_hybrid.get("ga_time", 0),
                        "greedy_time": metrics_hybrid.get("greedy_time", 0),
                        "improvements": metrics_hybrid.get("improvements", 0),
                        "penalty_reduction": metrics_hybrid.get("penalty_reduction", 0),
                        "status": "optimal" if penalty_hybrid == 0 else "sub-optimal",
                        "structured_result": structured_hybrid,
                        "total_sessions": len(schedule_hybrid),
                        "quality_score": score_hybrid,
                        "quality_detail": {
                            k: round(v, 2) for k, v in scores_hybrid.items()
                        },
                    },
                    "winner": winner_flag,
                    "best_method": best_method,
                    "penalty_improvement": penalty_ga - penalty_hybrid,
                    "penalty_improvement_percentage": (
                        (penalty_ga - penalty_hybrid) / max(penalty_ga, 1) * 100
                    )
                    if penalty_ga > 0
                    else 0,
                    "tiebreak": tiebreak_detail,
                }
                metadata = {
                    "total_courses": len(courses),
                    "total_sessions": len(final_schedule),
                    "ga_params": ga_params,
                    "best_method": best_method,
                    "tiebreak": tiebreak_detail,
                }

            # ── simpan ke DB ──────────────────────────────────────────────
            extra_schedules = {}
            if algorithm_mode == "hybrid":
                extra_schedules = {
                    "ga_only": {
                        "schedule": schedule_ga,
                        "structured_result": structured_ga,
                    },
                    "ga_greedy": {
                        "schedule": schedule_hybrid,
                        "structured_result": structured_hybrid,
                    },
                }

            db_success, schedule_id = db_handler.save_schedule(
                final_schedule,
                semester_type,
                final_penalty,
                metadata,
                structured_result=structured_result,
                extra_schedules=extra_schedules,
            )

            download_url = (
                f"/api/schedules/{schedule_id}/download" if db_success else None
            )
            download_urls = {"best": download_url}
            if algorithm_mode == "hybrid" and db_success:
                download_urls["ga_only"] = (
                    f"/api/schedules/{schedule_id}/download?variant=ga_only"
                )
                download_urls["ga_greedy"] = (
                    f"/api/schedules/{schedule_id}/download?variant=ga_greedy"
                )

            result = {
                "status": "success",
                "final_penalty": final_penalty,
                "penalty_status": "optimal" if final_penalty == 0 else "sub-optimal",
                "schedule": final_schedule,
                "structured_result": structured_result,
                "download_url": download_url,
                "download_urls": download_urls,
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "semester_type": semester_type,
                "schedule_id": schedule_id if db_success else None,
                "algorithm_mode": algorithm_mode,
                "comparison": comparison,
            }

            with _jobs_lock:
                _jobs[job_id]["result"] = result
                _jobs[job_id]["done"] = True
            job_queue.put({"type": "done"})

        except Exception as exc:
            traceback.print_exc()
            with _jobs_lock:
                _jobs[job_id]["error"] = str(exc)
                _jobs[job_id]["done"] = True
            job_queue.put({"type": "error", "message": str(exc)})

    threading.Thread(target=run_job, daemon=True).start()
    return jsonify({"status": "ok", "job_id": job_id})


@app.route("/api/optimize/stream/<job_id>", methods=["GET"])
def optimize_stream(job_id):
    """SSE endpoint — stream progress dari job GA yang berjalan di background."""
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Job tidak ditemukan"}), 404

    def generate():
        q = job["queue"]
        while True:
            try:
                event = q.get(timeout=30)
            except queue.Empty:
                # keepalive agar koneksi tidak di-drop browser/proxy
                yield "event: keepalive\ndata: {}\n\n"
                continue

            payload = json.dumps(event)
            yield f"data: {payload}\n\n"

            if event.get("type") in ("done", "error"):
                # Sertakan result lengkap di event terakhir
                with _jobs_lock:
                    final = _jobs[job_id].get("result")
                if final:
                    yield f"data: {json.dumps({'type': 'result', 'data': final})}\n\n"

                # Bersihkan job dari store setelah 60 detik (biarkan thread lain cleanup)
                def _cleanup(jid=job_id):
                    import time

                    time.sleep(60)
                    with _jobs_lock:
                        _jobs.pop(jid, None)

                threading.Thread(target=_cleanup, daemon=True).start()
                break

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/optimize", methods=["POST"])
@handle_errors
def optimize_schedule():
    """Menerima konfigurasi dan menjalankan algoritma genetika"""
    try:
        data = request.get_json()

        if not data:
            raise ValidationError(message="Data kosong", code="EMPTY_REQUEST")

        ga_params = data.get("ga_params", {})
        semester_type = data.get("semester_type", "ganjil")
        algorithm_mode = data.get("algorithm_mode", "hybrid")

        # ✅ FIX: Ambil data dari MongoDB, bukan dari request body
        # Sehingga perubahan (tambah/edit/hapus) ruangan, dosen, dan matkul
        # lewat UI benar-benar tercermin saat proses optimasi dijalankan.
        rooms = db_handler.get_all_rooms()
        dosen = db_handler.get_all_lecturers()
        all_courses = db_handler.get_all_courses()

        # Filter mata kuliah sesuai tipe semester yang dipilih
        if semester_type == "ganjil":
            courses = {k: v for k, v in all_courses.items() if v.get("sem", 0) % 2 == 1}
        else:
            courses = {k: v for k, v in all_courses.items() if v.get("sem", 0) % 2 == 0}

        if not rooms:
            raise ValidationError(
                message="Tidak ada ruangan di database. Tambahkan ruangan terlebih dahulu.",
                code="NO_ROOMS",
            )

        if not dosen:
            raise ValidationError(
                message="Tidak ada dosen di database. Tambahkan dosen terlebih dahulu.",
                code="NO_DOSEN",
            )

        if not courses:
            raise ValidationError(
                message=f"Tidak ada mata kuliah untuk semester {semester_type} di database.",
                code="NO_COURSES",
            )

        if algorithm_mode not in ["ga_only", "ga_greedy", "hybrid"]:
            raise ValidationError(
                message="Mode algoritma tidak valid",
                code="INVALID_ALGORITHM_MODE",
                details={"allowed": ["ga_only", "ga_greedy", "hybrid"]},
            )

        room_capacities = {r: rooms[r]["kapasitas"] for r in rooms}
        max_course_capacity = max(c["kapasitas_kelas"] for c in courses.values())
        max_room_capacity = max(room_capacities.values())

        if max_course_capacity > max_room_capacity:
            raise ConstraintViolationError(
                message=f"Tidak ada ruangan yang cukup besar untuk mata kuliah dengan kapasitas {max_course_capacity}",
                code="ROOM_CAPACITY_INSUFFICIENT",
                details={
                    "max_course_capacity": max_course_capacity,
                    "max_room_capacity": max_room_capacity,
                    "suggestion": "Tambah ruangan dengan kapasitas lebih besar",
                },
            )

        for course_id, course_data in courses.items():
            dosen_id = course_data.get("dosen")
            if dosen_id not in dosen:
                raise ValidationError(
                    message=f"Dosen {dosen_id} untuk mata kuliah {course_id} tidak ditemukan",
                    code="DOSEN_NOT_FOUND",
                    details={"course": course_id, "dosen": dosen_id},
                )

        print(f"\n{'=' * 70}")
        print(
            f"Memulai optimasi untuk semester {semester_type} dengan {len(courses)} mata kuliah..."
        )
        print(f"Mode: {algorithm_mode.upper()}")
        print(f"{'=' * 70}\n")

        # ===== LOGIC BERDASARKAN algorithm_mode =====
        if algorithm_mode == "ga_only":
            # Gunakan GA Murni saja
            print("🧬 GENETIKA MURNI")
            print("=" * 70)

            final_schedule, final_penalty, structured_result, metrics = (
                run_genetic_algorithm(
                    rooms=rooms,
                    dosen=dosen,
                    courses=courses,
                    ga_params=ga_params,
                    semester_type=semester_type,
                    use_greedy=False,
                )
            )

            if final_schedule is None:
                return jsonify(
                    {"status": "error", "message": "Gagal menghasilkan jadwal"}
                ), 500

            metadata = {
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "ga_params": ga_params,
                "metrics": metrics,
                "algorithm_used": "Genetika Murni",
                "algorithm_mode": "ga_only",
            }
            comparison = None

        elif algorithm_mode == "ga_greedy":
            # Gunakan GA + Greedy dengan mekanisme Restart
            print("🔀 GA + GREEDY (RESTART)")
            print("=" * 70)

            final_schedule, final_penalty, structured_result, metrics = (
                run_genetic_algorithm(
                    rooms=rooms,
                    dosen=dosen,
                    courses=courses,
                    ga_params=ga_params,
                    semester_type=semester_type,
                    use_greedy=True,
                )
            )

            if final_schedule is None:
                return jsonify(
                    {"status": "error", "message": "Gagal menghasilkan jadwal"}
                ), 500

            metadata = {
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "ga_params": ga_params,
                "metrics": metrics,
                "algorithm_used": "GA + Greedy (Restart + Greedy Post-processing)",
                "algorithm_mode": "ga_greedy",
            }
            comparison = None

        elif algorithm_mode == "hybrid":
            # Jalankan keduanya dan bandingkan dengan multi-aspek tie-breaking
            print("🔬 PERBANDINGAN ALGORITMA (Dengan Multi-Aspek Tie-Breaking)")
            print("=" * 70)

            # Seed identik untuk kedua algoritma fair comparison
            HYBRID_SEED = 42

            # Jalankan GA Murni
            schedule_ga, penalty_ga, structured_ga, metrics_ga = run_genetic_algorithm(
                rooms=rooms,
                dosen=dosen,
                courses=courses,
                ga_params=ga_params,
                semester_type=semester_type,
                use_greedy=False,
                seed=HYBRID_SEED,  # Baru
            )

            # Jalankan GA + Greedy
            schedule_hybrid, penalty_hybrid, structured_hybrid, metrics_hybrid = (
                run_genetic_algorithm(
                    rooms=rooms,
                    dosen=dosen,
                    courses=courses,
                    ga_params=ga_params,
                    semester_type=semester_type,
                    use_greedy=True,
                    seed=HYBRID_SEED,  # Baru seed yg sama dengan ga murni
                )
            )

            if schedule_ga is None or schedule_hybrid is None:
                return jsonify(
                    {"status": "error", "message": "Gagal menghasilkan jadwal"}
                ), 500

            # Fix fairness: baseline generasi relatif (terbesar di antara kedua metode)
            # agar skor generasi tidak bias terhadap metode yang restart lebih sering.
            max_gen_ref = max(
                metrics_ga.get("ga_generations", 10000),
                metrics_hybrid.get("ga_generations", 10000),
            )
            metrics_ga["max_generations_ref"] = max_gen_ref
            metrics_hybrid["max_generations_ref"] = max_gen_ref

            # Hitung skor kualitas untuk masing-masing
            score_ga, scores_ga = calculate_schedule_quality_score(
                schedule_ga, metrics_ga
            )
            score_hybrid, scores_hybrid = calculate_schedule_quality_score(
                schedule_hybrid, metrics_hybrid
            )

            # Tentukan pemenang dengan multi-aspek tie-breaking bertingkat.
            # Skor yang sudah dihitung diteruskan agar tidak dihitung ulang di dalam fungsi.
            best_method, tiebreak_detail, winner_flag, _, _, quality_scores = (
                determine_winner(
                    penalty_ga,
                    penalty_hybrid,
                    schedule_ga,
                    schedule_hybrid,
                    metrics_ga,
                    metrics_hybrid,
                    score_ga=score_ga,
                    scores_ga=scores_ga,
                    score_hybrid=score_hybrid,
                    scores_hybrid=scores_hybrid,
                )
            )

            # Pilih hasil terbaik
            if winner_flag == "ga_only":
                final_schedule = schedule_ga
                final_penalty = penalty_ga
                structured_result = structured_ga
            else:
                final_schedule = schedule_hybrid
                final_penalty = penalty_hybrid
                structured_result = structured_hybrid

            # Siapkan data perbandingan lengkap
            comparison = {
                "ga_only": {
                    "penalty": penalty_ga,
                    "time": metrics_ga.get("total_time", 0),
                    "generations": metrics_ga.get("ga_generations", 0),
                    "status": "optimal" if penalty_ga == 0 else "sub-optimal",
                    "structured_result": structured_ga,
                    "total_sessions": len(schedule_ga),
                    "quality_score": score_ga,
                    "quality_detail": {
                        "ruangan": round(scores_ga["ruangan"], 2),
                        "generasi": round(scores_ga["generasi"], 2),
                        "hari": round(scores_ga["hari"], 2),
                    },
                },
                "ga_greedy": {
                    "penalty": penalty_hybrid,
                    "time": metrics_hybrid.get("total_time", 0),
                    "generations": metrics_hybrid.get("ga_generations", 0),
                    "ga_time": metrics_hybrid.get("ga_time", 0),
                    "greedy_time": metrics_hybrid.get("greedy_time", 0),
                    "improvements": metrics_hybrid.get("improvements", 0),
                    "penalty_reduction": metrics_hybrid.get("penalty_reduction", 0),
                    "status": "optimal" if penalty_hybrid == 0 else "sub-optimal",
                    "structured_result": structured_hybrid,
                    "total_sessions": len(schedule_hybrid),
                    "quality_score": score_hybrid,
                    "quality_detail": {
                        "ruangan": round(scores_hybrid["ruangan"], 2),
                        "generasi": round(scores_hybrid["generasi"], 2),
                        "hari": round(scores_hybrid["hari"], 2),
                    },
                },
                "winner": winner_flag,
                "best_method": best_method,
                "penalty_improvement": penalty_ga - penalty_hybrid,
                "penalty_improvement_percentage": (
                    (penalty_ga - penalty_hybrid) / max(penalty_ga, 1)
                )
                * 100
                if penalty_ga > 0
                else 0,
                "tiebreak": tiebreak_detail,
            }

            print(f"\n{'=' * 70}")
            print(f"📊 HASIL PERBANDINGAN & TIE-BREAKING")
            print(f"{'=' * 70}")
            print(f"")
            print(
                f"  {'Kriteria':<24} {'GA Murni':>12} {'GA+Greedy':>12}  {'Unggul':>12}"
            )
            print(f"  {'-' * 24} {'-' * 12} {'-' * 12}  {'-' * 12}")

            pen_winner = (
                "GA Murni"
                if penalty_ga < penalty_hybrid
                else ("GA+Greedy" if penalty_hybrid < penalty_ga else "SERI")
            )
            print(
                f"  {'Penalti (hard)':<24} {penalty_ga:>12.2f} {penalty_hybrid:>12.2f}  {pen_winner:>12}"
            )

            tot_winner = (
                "GA Murni"
                if score_ga > score_hybrid
                else ("GA+Greedy" if score_hybrid > score_ga else "SERI")
            )
            print(
                f"  {'Skor Kualitas Total':<24} {score_ga:>12.2f} {score_hybrid:>12.2f}  {tot_winner:>12}"
            )

            for aspek_key, aspek_label in [
                ("hari", "Distribusi Hari"),
                ("ruangan", "Distribusi Ruangan"),
                ("generasi", "Konvergensi Generasi"),
            ]:
                val_ga = scores_ga[aspek_key]
                val_hyb = scores_hybrid[aspek_key]
                asp_winner = (
                    "GA Murni"
                    if val_ga > val_hyb
                    else ("GA+Greedy" if val_hyb > val_ga else "SERI")
                )
                print(
                    f"  {'  + ' + aspek_label:<24} {val_ga:>12.1f} {val_hyb:>12.1f}  {asp_winner:>12}"
                )

            print(f"")
            if tiebreak_detail:
                level = tiebreak_detail.get("tiebreak_level", "Level 1 - Penalti")
                margin = tiebreak_detail.get("margin", 0)
                note = tiebreak_detail.get("note", "")
                print(f"  Tie-Breaking Aktif:")
                print(f"  | Catatan  : {note}")
                print(f"  | Level    : {level}")
                print(f"  | Margin   : {margin:.4f}")
                print(
                    f"  | Pemenang : {tiebreak_detail.get('tiebreak_winner', best_method)}"
                )
            else:
                print(
                    f"  Pemenang ditentukan langsung dari penalti (tidak perlu tie-breaking)"
                )

            print(f"")
            print(f"  PEMENANG AKHIR : {best_method}")
            print(f"{'=' * 70}")

            metadata = {
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "ga_params": ga_params,
                "comparison": {
                    k: v
                    for k, v in comparison.items()
                    if k not in ["ga_only", "ga_greedy", "structured_result"]
                },
                "best_method": best_method,
                "tiebreak": tiebreak_detail,
            }

        # ===== SAVE TO DATABASE =====
        # Semua data disimpan ke MongoDB — tidak ada file lokal
        # Download Excel dibuat on-demand dari data DB saat user klik download
        extra_schedules = {}
        if algorithm_mode == "hybrid":
            extra_schedules = {
                "ga_only": {
                    "schedule": schedule_ga,
                    "structured_result": structured_ga,
                },
                "ga_greedy": {
                    "schedule": schedule_hybrid,
                    "structured_result": structured_hybrid,
                },
            }

        db_success, schedule_id = db_handler.save_schedule(
            final_schedule,
            semester_type,
            final_penalty,
            metadata,
            structured_result=structured_result,
            extra_schedules=extra_schedules,
        )

        # ===== RESPONSE =====
        # download_url sekarang on-demand dari DB via /api/schedules/<id>/download
        download_url = f"/api/schedules/{schedule_id}/download" if db_success else None
        download_urls_api = {"best": download_url}
        if algorithm_mode == "hybrid" and db_success:
            download_urls_api["ga_only"] = (
                f"/api/schedules/{schedule_id}/download?variant=ga_only"
            )
            download_urls_api["ga_greedy"] = (
                f"/api/schedules/{schedule_id}/download?variant=ga_greedy"
            )

        response = {
            "status": "success",
            "final_penalty": final_penalty,
            "penalty_status": "optimal" if final_penalty == 0 else "sub-optimal",
            "schedule": final_schedule,
            "structured_result": structured_result,
            "download_url": download_url,
            "download_urls": download_urls_api,
            "total_courses": len(courses),
            "total_sessions": len(final_schedule),
            "semester_type": semester_type,
            "schedule_id": schedule_id if db_success else None,
            "algorithm_mode": algorithm_mode,
            "comparison": comparison,
        }

        return jsonify(response), 200

    except (ValidationError, ConstraintViolationError):
        raise
    except Exception as e:
        print(f"Error in optimize_schedule: {str(e)}")
        traceback.print_exc()
        raise SchedulingError(
            message=f"Optimasi gagal: {str(e)}",
            code="OPTIMIZATION_FAILED",
            details={"error": str(e)},
        )


@app.route("/api/schedules/history", methods=["GET"])
def get_schedule_history():
    """Get schedule history dengan info ringkas — kompatibel dengan data lama"""
    try:
        limit = request.args.get("limit", 20, type=int)
        history = db_handler.get_schedule_history(limit)
        result = []
        for item in history:
            try:
                # _id selalu ada di MongoDB
                item["_id"] = str(item["_id"])

                # created_at: data lama mungkin tidak punya field ini
                created_at = item.get("created_at")
                item["created_at"] = created_at.isoformat() if created_at else "-"

                # metadata: data lama mungkin None atau tidak ada
                meta = item.get("metadata") or {}
                item["total_sessions"] = meta.get("total_sessions", "-")

                # Baca algorithm_mode dari root metadata (bukan dari dalam ga_params)
                item["algorithm_mode"] = meta.get("algorithm_mode", "-")

                # Baca label metode:
                # - hybrid      -> pakai best_method (nama pemenang, contoh: Genetika Murni)
                # - ga_only     -> pakai algorithm_used (contoh: Genetika Murni)
                # - ga_greedy   -> pakai algorithm_used (contoh: GA + Greedy ...)
                item["best_method"] = (
                    meta.get("best_method") or meta.get("algorithm_used") or "-"
                )

                result.append(item)
            except Exception as item_err:
                # Jangan biarkan 1 item rusak membuat seluruh history gagal
                print(f"[history] skip item error: {item_err}")
                continue

        return jsonify({"status": "success", "data": result})
    except Exception as e:
        print(f"[history] fatal error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/schedules/<schedule_id>/preview", methods=["GET"])
def preview_schedule(schedule_id):
    """Ambil detail satu jadwal untuk preview.
    Jika structured_result tidak ada (data lama), rebuild dari raw schedule + courses DB.
    """
    try:
        schedule = db_handler.get_schedule_by_id(schedule_id)
        if not schedule:
            return jsonify(
                {"status": "error", "message": "Jadwal tidak ditemukan"}
            ), 404

        schedule["_id"] = str(schedule["_id"])
        created_at = schedule.get("created_at")
        schedule["created_at"] = created_at.isoformat() if created_at else "-"

        # Jika structured_result sudah ada, langsung return
        if schedule.get("structured_result") and len(schedule["structured_result"]) > 0:
            return jsonify({"status": "success", "data": schedule})

        # ===== REBUILD structured_result dari raw schedule =====
        raw_schedule = schedule.get("schedule", {})
        if not raw_schedule:
            return jsonify({"status": "success", "data": schedule})

        # Ambil data courses dari DB untuk mapping session_id → info
        courses = (
            db_handler.get_all_courses()
        )  # {course_id: {sem, dosen, kelas, jam, ...}}
        lecturers = db_handler.get_all_lecturers()  # {lecturer_id: {name, ...}}

        structured = {}
        for session_id, slot_info in raw_schedule.items():
            try:
                # slot_info bisa berupa list [room, "Senin 08:00"] atau dict
                if isinstance(slot_info, list):
                    room, time_str = slot_info[0], slot_info[1]
                elif isinstance(slot_info, dict):
                    room = slot_info.get("room", "-")
                    time_str = slot_info.get("time", slot_info.get("time_slot", "- -"))
                else:
                    continue

                # Parse hari & jam
                parts = time_str.split(" ", 1)
                if len(parts) != 2:
                    continue
                day, start_time = parts[0], parts[1]

                # Cari course_id: session_id format biasanya "COURSE_ID_kelasX_sesiY"
                # Coba match dari yang paling panjang ke pendek
                course_info = None
                course_id_matched = None
                tokens = session_id.rsplit("_", 1)
                candidate = tokens[0] if len(tokens) > 1 else session_id
                while candidate:
                    if candidate in courses:
                        course_info = courses[candidate]
                        course_id_matched = candidate
                        break
                    # potong suffix terakhir
                    parts2 = candidate.rsplit("_", 1)
                    if len(parts2) < 2:
                        break
                    candidate = parts2[0]

                if not course_info:
                    # fallback: pakai session_id langsung sebagai nama
                    course_id_matched = session_id
                    course_info = {}

                semester = course_info.get("sem", "?")
                dosen_id = course_info.get("dosen", "-")
                kelas = course_info.get("kelas", course_info.get("tipe", "-"))
                jam = course_info.get("jam", 2)

                # Hitung end_time dari durasi jam (1 jam = 60 menit)
                try:
                    from datetime import datetime as dt2
                    from datetime import timedelta as td2

                    start_dt = dt2.strptime(start_time, "%H:%M")
                    end_dt = start_dt + td2(minutes=int(jam) * 60)
                    end_time = end_dt.strftime("%H:%M")
                except Exception:
                    end_time = start_time

                # Nama dosen
                dosen_info = lecturers.get(dosen_id, {})
                if isinstance(dosen_info, dict):
                    dosen_name = dosen_info.get("name", dosen_id)
                else:
                    dosen_name = str(dosen_info)
                dosen_label = f"{dosen_name} ({dosen_id})" if dosen_id != "-" else "-"

                sem_key = str(semester)
                if sem_key not in structured:
                    structured[sem_key] = {}
                if day not in structured[sem_key]:
                    structured[sem_key][day] = []

                structured[sem_key][day].append(
                    {
                        "course": course_id_matched or session_id,
                        "kelas": kelas,
                        "dosen": dosen_label,
                        "room": room,
                        "start_time": start_time,
                        "end_time": end_time,
                    }
                )
            except Exception as e:
                print(f"[preview rebuild] skip session {session_id}: {e}")
                continue

        # Sort per hari
        for sem_data in structured.values():
            for day_sessions in sem_data.values():
                day_sessions.sort(key=lambda x: x["start_time"])

        schedule["structured_result"] = structured
        schedule["_rebuilt"] = True  # flag bahwa ini hasil rebuild

        return jsonify({"status": "success", "data": schedule})
    except Exception as e:
        print(f"[preview] error: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/schedules/<schedule_id>", methods=["DELETE"])
def delete_schedule_by_id(schedule_id):
    """Hapus jadwal dari MongoDB — tidak ada file lokal yang perlu diurus"""
    try:
        success = db_handler.delete_schedule(schedule_id)
        if success:
            return jsonify({"status": "success", "message": "Jadwal berhasil dihapus"})
        return jsonify({"status": "error", "message": "Jadwal tidak ditemukan"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/schedules/cleanup", methods=["POST"])
def cleanup_schedules():
    """Hapus jadwal lama dari MongoDB. Body: { days: int }"""
    try:
        data = request.get_json() or {}
        days = int(data.get("days", 7))
        if days < 1:
            return jsonify({"status": "error", "message": "Minimal 1 hari"}), 400
        deleted = db_handler.delete_old_schedules(days)
        return jsonify(
            {
                "status": "success",
                "message": f"{deleted} jadwal lama (>{days} hari) berhasil dihapus",
                "deleted_count": deleted,
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/schedules/auto-delete-config", methods=["GET", "POST"])
def auto_delete_config():
    """
    GET  → baca konfigurasi auto-delete saat ini dari env
    POST → update config { enabled: bool, days: int, interval_hours: int }
           (update ke os.environ saja, tidak persisten ke .env file)
    """
    if request.method == "GET":
        return jsonify(
            {
                "status": "success",
                "data": {
                    "enabled": os.getenv("AUTO_DELETE_ENABLED", "true").lower()
                    == "true",
                    "days": int(os.getenv("AUTO_DELETE_DAYS", "7")),
                    "interval_hours": int(
                        os.getenv("AUTO_DELETE_INTERVAL_HOURS", "24")
                    ),
                    "scheduler_available": SCHEDULER_AVAILABLE,
                },
            }
        )
    else:
        data = request.get_json() or {}
        if "enabled" in data:
            os.environ["AUTO_DELETE_ENABLED"] = "true" if data["enabled"] else "false"
        if "days" in data:
            days = int(data["days"])
            if days < 1:
                return jsonify({"status": "error", "message": "Minimal 1 hari"}), 400
            os.environ["AUTO_DELETE_DAYS"] = str(days)
        if "interval_hours" in data:
            hours = int(data["interval_hours"])
            if hours < 1:
                return jsonify({"status": "error", "message": "Minimal 1 jam"}), 400
            os.environ["AUTO_DELETE_INTERVAL_HOURS"] = str(hours)
        return jsonify(
            {
                "status": "success",
                "message": "Konfigurasi auto-delete diperbarui (berlaku setelah restart untuk scheduler)",
                "data": {
                    "enabled": os.getenv("AUTO_DELETE_ENABLED") == "true",
                    "days": int(os.getenv("AUTO_DELETE_DAYS", "7")),
                    "interval_hours": int(
                        os.getenv("AUTO_DELETE_INTERVAL_HOURS", "24")
                    ),
                },
            }
        )


@app.route("/api/schedules/latest", methods=["GET"])
def get_latest_schedule():
    """Get latest schedule"""
    try:
        semester_type = request.args.get("semester_type")
        schedule = db_handler.get_latest_schedule(semester_type)

        if schedule:
            schedule["_id"] = str(schedule["_id"])
            schedule["created_at"] = schedule["created_at"].isoformat()
            return jsonify({"status": "success", "data": schedule})
        else:
            return jsonify(
                {"status": "error", "message": "Tidak ada jadwal ditemukan"}
            ), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/schedules/<schedule_id>/download", methods=["GET"])
def download_schedule_excel(schedule_id):
    """Generate dan download Excel dari data MongoDB — tanpa file lokal"""
    try:
        variant = request.args.get("variant", "best")  # best | ga_only | ga_greedy

        schedule = db_handler.get_schedule_by_id(schedule_id)
        if not schedule:
            return jsonify(
                {"status": "error", "message": "Jadwal tidak ditemukan"}
            ), 404

        semester_type = schedule.get("semester_type", "ganjil")
        created_at = schedule.get("created_at")
        ts = created_at.strftime("%Y%m%d_%H%M%S") if created_at else "unknown"

        # Pilih data sesuai variant
        if variant in ("ga_only", "ga_greedy"):
            extra = (schedule.get("extra_schedules") or {}).get(variant, {})
            final_schedule = extra.get("schedule") or schedule.get("schedule", {})
            structured = extra.get("structured_result") or schedule.get(
                "structured_result", {}
            )
            suffix = "ga_murni" if variant == "ga_only" else "ga_greedy"
        else:
            final_schedule = schedule.get("schedule", {})
            structured = schedule.get("structured_result", {})
            suffix = "terbaik"

        if not structured:
            return jsonify(
                {"status": "error", "message": "Data jadwal tidak tersedia"}
            ), 404

        # Generate Excel ke memory (BytesIO) — tidak simpan ke disk
        buffer = BytesIO()
        export_to_excel_buffer(final_schedule, structured, buffer, semester_type)
        buffer.seek(0)

        filename = f"jadwal_{semester_type}_{ts}_{suffix}.xlsx"
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        print(f"[download] error: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/validate", methods=["POST"])
def validate_data():
    """Validasi data sebelum optimasi"""
    try:
        data = request.get_json()
        errors = []

        # ✅ Cek dari MongoDB, bukan dari request body
        rooms = db_handler.get_all_rooms()
        if not rooms:
            errors.append("Tidak ada ruangan di database")

        dosen = db_handler.get_all_lecturers()
        if not dosen:
            errors.append("Tidak ada dosen di database")

        courses = db_handler.get_all_courses()
        if not courses:
            errors.append("Tidak ada mata kuliah di database")

        semester_type = data.get("semester_type", "ganjil")
        if semester_type not in ["ganjil", "genap"]:
            errors.append("Tipe semester harus 'ganjil' atau 'genap'")

        if errors:
            return jsonify({"status": "error", "errors": errors}), 400

        return jsonify({"status": "success", "message": "Data valid"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/db/load-defaults", methods=["POST"])
def load_default_data():
    """Load default data into database"""
    try:
        success = db_handler.load_default_data()
        if success:
            return jsonify(
                {
                    "status": "success",
                    "message": "Data default berhasil dimuat ke database",
                }
            )
        else:
            return jsonify(
                {"status": "error", "message": "Gagal memuat data default"}
            ), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ===== AUTO-DELETE SCHEDULER SETUP =====
def start_auto_delete_scheduler():
    """
    Jalankan background scheduler untuk auto-delete jadwal lama.
    Interval dan threshold dikonfigurasi via .env:
      AUTO_DELETE_ENABLED=true      (default: true)
      AUTO_DELETE_DAYS=7            (hapus jadwal lebih tua dari X hari, default: 7)
      AUTO_DELETE_INTERVAL_HOURS=24 (cek setiap X jam, default: 24)
    """
    if not SCHEDULER_AVAILABLE:
        return None

    enabled = os.getenv("AUTO_DELETE_ENABLED", "true").lower() == "true"
    if not enabled:
        print("ℹ️  Auto-delete scheduler dinonaktifkan (AUTO_DELETE_ENABLED=false)")
        return None

    days = int(os.getenv("AUTO_DELETE_DAYS", "7"))
    interval_hours = int(os.getenv("AUTO_DELETE_INTERVAL_HOURS", "24"))

    def auto_delete_job():
        print(f"\n🕐 [Auto-Delete] Menjalankan cleanup jadwal > {days} hari...")
        deleted = db_handler.delete_old_schedules(days)
        if deleted > 0:
            print(f"✅ [Auto-Delete] {deleted} jadwal dihapus.")
        else:
            print(f"ℹ️  [Auto-Delete] Tidak ada jadwal yang perlu dihapus.")

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        auto_delete_job,
        trigger="interval",
        hours=interval_hours,
        id="auto_delete_schedules",
        replace_existing=True,
        next_run_time=datetime.now(),  # langsung jalankan sekali saat startup
    )
    scheduler.start()
    print(
        f"✅ Auto-delete scheduler aktif: hapus jadwal >{days} hari, cek setiap {interval_hours} jam"
    )
    return scheduler


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    print("\n" + "=" * 50)
    print("🚀 SISTEM PENJADWALAN KULIAH")
    print("=" * 50)
    print(f"📍 Server: http://{host}:{port}")
    print(f"🗄️  Database: MongoDB")
    print(f"🔧 Debug Mode: {debug}")
    print("=" * 50 + "\n")

    # Start auto-delete scheduler (berjalan di background thread)
    scheduler = start_auto_delete_scheduler()

    try:
        app.run(debug=debug, host=host, port=port, use_reloader=False)
    finally:
        if scheduler and scheduler.running:
            scheduler.shutdown(wait=False)
            print("🛑 Scheduler dihentikan.")
