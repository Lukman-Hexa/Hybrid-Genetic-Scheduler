from flask import Flask, render_template, request, jsonify, send_file
from scheduling_engine import run_genetic_algorithm, COURSE_CONFIG, SEMESTER_GANJIL, SEMESTER_GENAP
from scheduling_engine import SchedulingError, ValidationError, ConstraintViolationError
from export_handler import export_to_excel
from db_handler import db_handler
import json
import os
import traceback
from datetime import datetime
from dotenv import load_dotenv
from functools import wraps

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DOWNLOAD_FOLDER'] = 'static/downloads'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

# ===== ERROR HANDLER DECORATOR =====
def handle_errors(f):
    """Decorator untuk menangani error secara konsisten"""
    @wraps(f)  # ← TAMBAHKAN INI!
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            print(f"Validation Error: {e.message}")
            return jsonify({
                "status": "error",
                "code": e.code,
                "message": e.message,
                "details": e.details
            }), 400
        except ConstraintViolationError as e:
            print(f"Constraint Error: {e.message}")
            return jsonify({
                "status": "error",
                "code": e.code,
                "message": e.message,
                "details": e.details,
                "suggestion": "Coba kurangi jumlah mata kuliah atau tambah ruangan"
            }), 422
        except SchedulingError as e:
            print(f"Scheduling Error: {e.message}")
            return jsonify({
                "status": "error",
                "code": e.code,
                "message": e.message,
                "details": e.details
            }), 500
        except Exception as e:
            print(f"Unexpected Error: {str(e)}")
            traceback.print_exc()
            return jsonify({
                "status": "error",
                "code": "INTERNAL_ERROR",
                "message": "Terjadi kesalahan internal server",
                "details": {"error": str(e)} if app.debug else {}
            }), 500
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
    
    valid_days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
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
    
    if not name.replace('_', '').isalnum():
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
    
    if tipe not in ['terpisah', 'gabungan']:
        errors.append("Tipe kelas tidak valid")
    
    return errors

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/default-config', methods=['GET'])
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

@app.route('/api/rooms', methods=['GET', 'POST', 'PUT', 'DELETE'])
@handle_errors
def manage_rooms():
    """CRUD operations untuk ruangan dengan validasi"""
    try:
        if request.method == 'GET':
            rooms = db_handler.get_all_rooms()
            return jsonify({"status": "success", "data": rooms})
        
        elif request.method == 'POST':
            data = request.get_json()
            room_id = data.get('room_id', '').strip().upper()
            capacity = data.get('capacity')
            
            errors = validate_room_data(room_id, capacity)
            if errors:
                raise ValidationError(
                    message="Validasi ruangan gagal",
                    code="ROOM_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            existing_rooms = db_handler.get_all_rooms()
            for existing_id in existing_rooms.keys():
                if existing_id.upper() == room_id.upper() and existing_id != room_id:
                    raise ValidationError(
                        message=f"Ruangan dengan ID mirip sudah ada: {existing_id}",
                        code="ROOM_DUPLICATE",
                        details={"existing": existing_id, "requested": room_id}
                    )
            
            success, result = db_handler.add_room(room_id, int(capacity))
            if success:
                return jsonify({
                    "status": "success", 
                    "message": f"Ruangan {room_id} berhasil ditambahkan",
                    "data": {"room_id": room_id, "capacity": capacity}
                })
            else:
                raise ValidationError(
                    message=result,
                    code="ROOM_ADD_FAILED"
                )
        
        elif request.method == 'PUT':
            data = request.get_json()
            room_id = data.get('room_id', '').strip().upper()
            capacity = data.get('capacity')
            
            errors = validate_room_data(room_id, capacity)
            if errors:
                raise ValidationError(
                    message="Validasi ruangan gagal",
                    code="ROOM_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            success = db_handler.update_room(room_id, int(capacity))
            if success:
                return jsonify({
                    "status": "success", 
                    "message": f"Ruangan {room_id} berhasil diupdate"
                })
            else:
                raise ValidationError(
                    message="Gagal update ruangan",
                    code="ROOM_UPDATE_FAILED"
                )
        
        elif request.method == 'DELETE':
            data = request.get_json()
            room_id = data.get('room_id', '').strip().upper()
            
            if not room_id:
                raise ValidationError(
                    message="ID Ruangan tidak boleh kosong",
                    code="ROOM_ID_EMPTY"
                )
            
            success = db_handler.delete_room(room_id)
            if success:
                return jsonify({
                    "status": "success", 
                    "message": f"Ruangan {room_id} berhasil dihapus"
                })
            else:
                raise ValidationError(
                    message="Gagal hapus ruangan",
                    code="ROOM_DELETE_FAILED"
                )
    
    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(
            message=str(e),
            code="ROOM_OPERATION_FAILED"
        )

@app.route('/api/lecturers', methods=['GET', 'POST', 'PUT', 'DELETE'])
@handle_errors
def manage_lecturers():
    """CRUD operations untuk dosen dengan validasi"""
    try:
        if request.method == 'GET':
            lecturers = db_handler.get_all_lecturers()
            return jsonify({"status": "success", "data": lecturers})
        
        elif request.method == 'POST':
            data = request.get_json()
            lecturer_id = data.get('lecturer_id', '').strip().upper()
            name = data.get('name', '').strip()
            available_days = data.get('available_days', [])
            
            errors = validate_dosen_data(lecturer_id, name, available_days)
            if errors:
                raise ValidationError(
                    message="Validasi dosen gagal",
                    code="DOSEN_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            existing = db_handler.get_all_lecturers()
            for existing_id in existing.keys():
                if existing_id.upper() == lecturer_id.upper() and existing_id != lecturer_id:
                    raise ValidationError(
                        message=f"Dosen dengan ID mirip sudah ada: {existing_id}",
                        code="DOSEN_DUPLICATE",
                        details={"existing": existing_id, "requested": lecturer_id}
                    )
            
            success, result = db_handler.add_lecturer(lecturer_id, name, available_days)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Dosen {name} berhasil ditambahkan"
                })
            else:
                raise ValidationError(
                    message=result,
                    code="DOSEN_ADD_FAILED"
                )
        
        elif request.method == 'PUT':
            data = request.get_json()
            lecturer_id = data.get('lecturer_id', '').strip().upper()
            name = data.get('name', '').strip()
            available_days = data.get('available_days')
            
            errors = validate_dosen_data(lecturer_id, name, available_days or [])
            if errors:
                raise ValidationError(
                    message="Validasi dosen gagal",
                    code="DOSEN_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            success = db_handler.update_lecturer(lecturer_id, name, available_days)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Dosen {name} berhasil diupdate"
                })
            else:
                raise ValidationError(
                    message="Gagal update dosen",
                    code="DOSEN_UPDATE_FAILED"
                )
        
        elif request.method == 'DELETE':
            data = request.get_json()
            lecturer_id = data.get('lecturer_id', '').strip().upper()
            
            if not lecturer_id:
                raise ValidationError(
                    message="ID Dosen tidak boleh kosong",
                    code="DOSEN_ID_EMPTY"
                )
            
            success = db_handler.delete_lecturer(lecturer_id)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Dosen berhasil dihapus"
                })
            else:
                raise ValidationError(
                    message="Gagal hapus dosen",
                    code="DOSEN_DELETE_FAILED"
                )
    
    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(
            message=str(e),
            code="DOSEN_OPERATION_FAILED"
        )

@app.route('/api/courses', methods=['GET', 'POST', 'PUT', 'DELETE'])
@handle_errors
def manage_courses():
    """CRUD operations untuk mata kuliah dengan validasi"""
    try:
        if request.method == 'GET':
            semester = request.args.get('semester', type=int)
            if semester:
                courses = db_handler.get_courses_by_semester(semester)
            else:
                courses = db_handler.get_all_courses()
            return jsonify({"status": "success", "data": courses})
        
        elif request.method == 'POST':
            data = request.get_json()
            course_id = data.get('course_id', '').strip().upper()
            
            errors = validate_course_data(
                course_id,
                data.get('sem'),
                data.get('dosen'),
                data.get('kapasitas_kelas'),
                data.get('jam'),
                data.get('tipe')
            )
            
            if errors:
                raise ValidationError(
                    message="Validasi mata kuliah gagal",
                    code="COURSE_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            course_data = {
                'sem': int(data.get('sem')),
                'dosen': data.get('dosen'),
                'kapasitas_kelas': int(data.get('kapasitas_kelas')),
                'jam': int(data.get('jam')),
                'tipe': data.get('tipe'),
                'sesi': data.get('sesi', 1)
            }
            
            dosens = db_handler.get_all_lecturers()
            if data.get('dosen') not in dosens:
                raise ValidationError(
                    message="Dosen tidak ditemukan",
                    code="DOSEN_NOT_FOUND",
                    details={"dosen_id": data.get('dosen')}
                )
            
            success, result = db_handler.add_course(course_id, course_data)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Mata kuliah {course_id} berhasil ditambahkan"
                })
            else:
                raise ValidationError(
                    message=result,
                    code="COURSE_ADD_FAILED"
                )
        
        elif request.method == 'PUT':
            data = request.get_json()
            course_id = data.get('course_id', '').strip().upper()
            
            errors = validate_course_data(
                course_id,
                data.get('sem'),
                data.get('dosen'),
                data.get('kapasitas_kelas'),
                data.get('jam'),
                data.get('tipe')
            )
            
            if errors:
                raise ValidationError(
                    message="Validasi mata kuliah gagal",
                    code="COURSE_VALIDATION_ERROR",
                    details={"errors": errors}
                )
            
            course_data = {k: v for k, v in data.items() if k != 'course_id'}
            if 'sem' in course_data:
                course_data['sem'] = int(course_data['sem'])
            if 'kapasitas_kelas' in course_data:
                course_data['kapasitas_kelas'] = int(course_data['kapasitas_kelas'])
            if 'jam' in course_data:
                course_data['jam'] = int(course_data['jam'])
            
            success = db_handler.update_course(course_id, course_data)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Mata kuliah berhasil diupdate"
                })
            else:
                raise ValidationError(
                    message="Gagal update mata kuliah",
                    code="COURSE_UPDATE_FAILED"
                )
        
        elif request.method == 'DELETE':
            data = request.get_json()
            course_id = data.get('course_id', '').strip().upper()
            
            if not course_id:
                raise ValidationError(
                    message="ID Mata Kuliah tidak boleh kosong",
                    code="COURSE_ID_EMPTY"
                )
            
            success = db_handler.delete_course(course_id)
            if success:
                return jsonify({
                    "status": "success",
                    "message": f"Mata kuliah berhasil dihapus"
                })
            else:
                raise ValidationError(
                    message="Gagal hapus mata kuliah",
                    code="COURSE_DELETE_FAILED"
                )
    
    except ValidationError:
        raise
    except Exception as e:
        raise SchedulingError(
            message=str(e),
            code="COURSE_OPERATION_FAILED"
        )

@app.route('/api/optimize', methods=['POST'])
@handle_errors
def optimize_schedule():
    """Menerima konfigurasi dan menjalankan algoritma genetika"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError(
                message="Data kosong",
                code="EMPTY_REQUEST"
            )
        
        rooms = data.get('rooms', {})
        dosen = data.get('dosen', {})
        courses = data.get('courses', {})
        ga_params = data.get('ga_params', {})
        semester_type = data.get('semester_type', 'ganjil')
        compare_mode = data.get('compare_mode', False)
        
        if not rooms:
            raise ValidationError(
                message="Minimal ada 1 ruangan",
                code="NO_ROOMS"
            )
        
        if not dosen:
            raise ValidationError(
                message="Minimal ada 1 dosen",
                code="NO_DOSEN"
            )
        
        if not courses:
            raise ValidationError(
                message="Minimal ada 1 mata kuliah",
                code="NO_COURSES"
            )
        
        room_capacities = {r: rooms[r]['kapasitas'] for r in rooms}
        max_course_capacity = max(c['kapasitas_kelas'] for c in courses.values())
        max_room_capacity = max(room_capacities.values())
        
        if max_course_capacity > max_room_capacity:
            raise ConstraintViolationError(
                message=f"Tidak ada ruangan yang cukup besar untuk mata kuliah dengan kapasitas {max_course_capacity}",
                code="ROOM_CAPACITY_INSUFFICIENT",
                details={
                    "max_course_capacity": max_course_capacity,
                    "max_room_capacity": max_room_capacity,
                    "suggestion": "Tambah ruangan dengan kapasitas lebih besar"
                }
            )
        
        for course_id, course_data in courses.items():
            dosen_id = course_data.get('dosen')
            if dosen_id not in dosen:
                raise ValidationError(
                    message=f"Dosen {dosen_id} untuk mata kuliah {course_id} tidak ditemukan",
                    code="DOSEN_NOT_FOUND",
                    details={"course": course_id, "dosen": dosen_id}
                )
        
        print(f"\n{'='*70}")
        print(f"Memulai optimasi untuk semester {semester_type} dengan {len(courses)} mata kuliah...")
        print(f"Mode: {'Perbandingan' if compare_mode else 'Single Run'}")
        print(f"{'='*70}\n")
        
        if compare_mode:
            print("🔬 PERBANDINGAN ALGORITMA")
            print("="*70)
            
            schedule_ga, penalty_ga, structured_ga, metrics_ga = run_genetic_algorithm(
                rooms=rooms, dosen=dosen, courses=courses, ga_params=ga_params, 
                semester_type=semester_type, use_greedy=False
            )
            
            schedule_hybrid, penalty_hybrid, structured_hybrid, metrics_hybrid = run_genetic_algorithm(
                rooms=rooms, dosen=dosen, courses=courses, ga_params=ga_params, 
                semester_type=semester_type, use_greedy=True
            )
            
            if schedule_ga is None or schedule_hybrid is None:
                return jsonify({"status": "error", "message": "Gagal menghasilkan jadwal"}), 500
            
            winner = "ga_greedy" if penalty_hybrid < penalty_ga else ("ga_only" if penalty_ga < penalty_hybrid else "draw")
            comparison = {
                "ga_only": {
                    "penalty": penalty_ga,
                    "time": metrics_ga.get('total_time', 0),
                    "generations": metrics_ga.get('ga_generations', 0),
                    "status": "optimal" if penalty_ga == 0 else "sub-optimal",
                    "structured_result": structured_ga,
                    "total_sessions": len(schedule_ga)
                },
                "ga_greedy": {
                    "penalty": penalty_hybrid,
                    "time": metrics_hybrid.get('total_time', 0),
                    "generations": metrics_hybrid.get('ga_generations', 0),
                    "ga_time": metrics_hybrid.get('ga_time', 0),
                    "greedy_time": metrics_hybrid.get('greedy_time', 0),
                    "improvements": metrics_hybrid.get('improvements', 0),
                    "penalty_reduction": metrics_hybrid.get('penalty_reduction', 0),
                    "status": "optimal" if penalty_hybrid == 0 else "sub-optimal",
                    "structured_result": structured_hybrid,
                    "total_sessions": len(schedule_hybrid)
                },
                "winner": winner,
                "penalty_improvement": penalty_ga - penalty_hybrid,
                "penalty_improvement_percentage": ((penalty_ga - penalty_hybrid) / max(penalty_ga, 1)) * 100 if penalty_ga > 0 else 0
            }
            
            if penalty_hybrid <= penalty_ga:
                final_schedule = schedule_hybrid
                final_penalty = penalty_hybrid
                structured_result = structured_hybrid
                best_method = "Genetika + Greedy"
            else:
                final_schedule = schedule_ga
                final_penalty = penalty_ga
                structured_result = structured_ga
                best_method = "Genetika Murni"
            
            print(f"\n{'='*70}")
            print(f"📊 HASIL PERBANDINGAN")
            print(f"{'='*70}")
            print(f"GA Murni: Penalti {penalty_ga:.2f}")
            print(f"GA+Greedy: Penalti {penalty_hybrid:.2f}")
            print(f"🏆 Pemenang: {best_method}")
            
            metadata = {
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "ga_params": ga_params,
                "comparison": {k: v for k, v in comparison.items() if k not in ['ga_only', 'ga_greedy']},
                "best_method": best_method
            }
            
        else:
            final_schedule, final_penalty, structured_result, metrics = run_genetic_algorithm(
                rooms=rooms, dosen=dosen, courses=courses, ga_params=ga_params, 
                semester_type=semester_type, use_greedy=True
            )
            
            if final_schedule is None:
                return jsonify({"status": "error", "message": "Gagal menghasilkan jadwal"}), 500
            
            metadata = {
                "total_courses": len(courses),
                "total_sessions": len(final_schedule),
                "ga_params": ga_params,
                "metrics": metrics
            }
            comparison = None
        
        db_success, schedule_id = db_handler.save_schedule(
            final_schedule, semester_type, final_penalty, metadata
        )
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        download_urls = {}
        
        if compare_mode:
            from scheduling_engine import SchedulingContext
            context = SchedulingContext(rooms, dosen, courses, ga_params, semester_type)
            
            filename_ga = f"jadwal_{semester_type}_{timestamp}_ga_murni.xlsx"
            filepath_ga = os.path.join(app.config['DOWNLOAD_FOLDER'], filename_ga)
            export_to_excel(schedule_ga, structured_ga, filepath_ga, semester_type)
            
            filename_hybrid = f"jadwal_{semester_type}_{timestamp}_ga_greedy.xlsx"
            filepath_hybrid = os.path.join(app.config['DOWNLOAD_FOLDER'], filename_hybrid)
            export_to_excel(schedule_hybrid, structured_hybrid, filepath_hybrid, semester_type)
            
            filename_best = f"jadwal_{semester_type}_{timestamp}_terbaik.xlsx"
            filepath_best = os.path.join(app.config['DOWNLOAD_FOLDER'], filename_best)
            export_to_excel(final_schedule, structured_result, filepath_best, semester_type)
            
            download_urls = {
                "ga_only": f"/download/{filename_ga}",
                "ga_greedy": f"/download/{filename_hybrid}",
                "best": f"/download/{filename_best}"
            }
            filename = filename_best
        else:
            filename = f"jadwal_{semester_type}_{timestamp}.xlsx"
            filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
            export_to_excel(final_schedule, structured_result, filepath, semester_type)
            download_urls = {"best": f"/download/{filename}"}
        
        response = {
            "status": "success",
            "final_penalty": final_penalty,
            "penalty_status": "optimal" if final_penalty == 0 else "sub-optimal",
            "schedule": final_schedule,
            "structured_result": structured_result,
            "download_url": f"/download/{filename}",
            "download_urls": download_urls,
            "total_courses": len(courses),
            "total_sessions": len(final_schedule),
            "semester_type": semester_type,
            "schedule_id": schedule_id if db_success else None,
            "comparison": comparison
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
            details={"error": str(e)}
        )

@app.route('/api/schedules/history', methods=['GET'])
def get_schedule_history():
    """Get schedule history"""
    try:
        limit = request.args.get('limit', 10, type=int)
        history = db_handler.get_schedule_history(limit)
        
        for item in history:
            item['_id'] = str(item['_id'])
            item['created_at'] = item['created_at'].isoformat()
        
        return jsonify({"status": "success", "data": history})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/latest', methods=['GET'])
def get_latest_schedule():
    """Get latest schedule"""
    try:
        semester_type = request.args.get('semester_type')
        schedule = db_handler.get_latest_schedule(semester_type)
        
        if schedule:
            schedule['_id'] = str(schedule['_id'])
            schedule['created_at'] = schedule['created_at'].isoformat()
            return jsonify({"status": "success", "data": schedule})
        else:
            return jsonify({"status": "error", "message": "Tidak ada jadwal ditemukan"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Download file jadwal"""
    try:
        filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({"status": "error", "message": "File tidak ditemukan"}), 404
        
        return send_file(filepath, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/validate', methods=['POST'])
def validate_data():
    """Validasi data sebelum optimasi"""
    try:
        data = request.get_json()
        errors = []
        
        rooms = data.get('rooms', {})
        if not rooms:
            errors.append("Minimal ada 1 ruangan")
        
        dosen = data.get('dosen', {})
        if not dosen:
            errors.append("Minimal ada 1 dosen")
        
        courses = data.get('courses', {})
        if not courses:
            errors.append("Minimal ada 1 mata kuliah")
        
        semester_type = data.get('semester_type', 'ganjil')
        if semester_type not in ['ganjil', 'genap']:
            errors.append("Tipe semester harus 'ganjil' atau 'genap'")
        
        if errors:
            return jsonify({"status": "error", "errors": errors}), 400
        
        return jsonify({"status": "success", "message": "Data valid"}), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/db/load-defaults', methods=['POST'])
def load_default_data():
    """Load default data into database"""
    try:
        success = db_handler.load_default_data()
        if success:
            return jsonify({"status": "success", "message": "Data default berhasil dimuat ke database"})
        else:
            return jsonify({"status": "error", "message": "Gagal memuat data default"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    print("\n" + "="*50)
    print("🚀 SISTEM PENJADWALAN KULIAH")
    print("="*50)
    print(f"📍 Server: http://{host}:{port}")
    print(f"🗄️  Database: MongoDB")
    print(f"🔧 Debug Mode: {debug}")
    print("="*50 + "\n")
    
    app.run(debug=debug, host=host, port=port, use_reloader=False)