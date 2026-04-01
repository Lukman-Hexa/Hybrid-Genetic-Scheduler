import random
from datetime import datetime, timedelta
import traceback

SLOT_DURATION_MINUTES = 10
START_HOUR = 8
END_HOUR = 16
DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]

# Semester mapping
SEMESTER_GANJIL = [1, 3, 5, 7]
SEMESTER_GENAP = [2, 4, 6, 8]

ROOMS = {
    "R01": {"kapasitas": 70},
    "R02": {"kapasitas": 70},
    "R03": {"kapasitas": 70},
    "R04": {"kapasitas": 50},
    "R05": {"kapasitas": 50},
    "R06": {"kapasitas": 50},
    "R07": {"kapasitas": 35},
    "R08": {"kapasitas": 25},
}

DOSEN_DATABASE = {
    f"D{i}": {
        "name": f"Dosen {chr(64+i)}",
        "available_days": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
    } for i in range(1, 21)
}

COURSE_CONFIG = {
    "KALKULUS_I": {"sem": 1, "dosen": "D1", "kapasitas_kelas": 63, "jam": 3, "tipe": "terpisah", "sesi": 1},
    "ALGORITMA_I": {"sem": 1, "dosen": "D2", "kapasitas_kelas": 63, "jam": 2, "tipe": "terpisah", "sesi": 1},
    "FISIKA": {"sem": 1, "dosen": "D3", "kapasitas_kelas": 63, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "PENGANTAR_ALGORITMA": {"sem": 1, "dosen": "D4", "kapasitas_kelas": 63, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "BAHASA_INDONESIA": {"sem": 1, "dosen": "D5", "kapasitas_kelas": 25, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "AGAMA_ISLAM": {"sem": 1, "dosen": "D6", "kapasitas_kelas": 33, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "AGAMA_KRISTEN": {"sem": 1, "dosen": "D7", "kapasitas_kelas": 33, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "STATISTIKA": {"sem": 3, "dosen": "D8", "kapasitas_kelas": 63, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "SISTEM_DIGITAL": {"sem": 3, "dosen": "D9", "kapasitas_kelas": 45, "jam": 2, "tipe": "terpisah", "sesi": 1},
    "M_DISKRIT": {"sem": 3, "dosen": "D10", "kapasitas_kelas": 63, "jam": 3, "tipe": "gabungan", "sesi": 1},
    "IMK": {"sem": 3, "dosen": "D4", "kapasitas_kelas": 63, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "STRUKTUR_DATA": {"sem": 3, "dosen": "D11", "kapasitas_kelas": 45, "jam": 3, "tipe": "terpisah", "sesi": 1},
    "PPKN": {"sem": 3, "dosen": "D12", "kapasitas_kelas": 63, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "BASIS_DATA": {"sem": 3, "dosen": "D13", "kapasitas_kelas": 45, "jam": 2, "tipe": "terpisah", "sesi": 1},
    "JST": {"sem": 5, "dosen": "D15", "kapasitas_kelas": 20, "jam": 3, "tipe": "terpisah", "sesi": 1},
    "APK_WEB": {"sem": 5, "dosen": "D16", "kapasitas_kelas": 40, "jam": 3, "tipe": "gabungan", "sesi": 1},
    "SISTEM_INFO": {"sem": 5, "dosen": "D17", "kapasitas_kelas": 40, "jam": 3, "tipe": "gabungan", "sesi": 1},
    "GRAFKOM": {"sem": 5, "dosen": "D18", "kapasitas_kelas": 40, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "SISTEM_OPERASI": {"sem": 5, "dosen": "D14", "kapasitas_kelas": 38, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "METODE": {"sem": 5, "dosen": "D4", "kapasitas_kelas": 40, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "JARKOM": {"sem": 5, "dosen": "D18", "kapasitas_kelas": 40, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "ETIKA": {"sem": 7, "dosen": "D19", "kapasitas_kelas": 38, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "SPK": {"sem": 7, "dosen": "D13", "kapasitas_kelas": 38, "jam": 3, "tipe": "gabungan", "sesi": 1},
    "ML": {"sem": 7, "dosen": "D20", "kapasitas_kelas": 40, "jam": 3, "tipe": "terpisah", "sesi": 1},
    "SOFT": {"sem": 7, "dosen": "D16", "kapasitas_kelas": 38, "jam": 3, "tipe": "gabungan", "sesi": 1},
    "MPPL": {"sem": 7, "dosen": "D19", "kapasitas_kelas": 40, "jam": 2, "tipe": "gabungan", "sesi": 1},
    "KRIPTO": {"sem": 7, "dosen": "D2", "kapasitas_kelas": 38, "jam": 3, "tipe": "gabungan", "sesi": 1},
}

GA_PARAMS = {
    "POPULATION_SIZE": 700,
    "MAX_GENERATIONS": 10000,
    "INITIAL_MUTATION_RATE": 0.31,
    "MIN_MUTATION_RATE": 0.08,
    "HARD_CONSTRAINT_PENALTY": 1000,
    "SOFT_CONSTRAINT_PENALTY": 0.5,
    "MIN_GAP_HOURS": 3,
}

# ===== CUSTOM EXCEPTIONS =====
class SchedulingError(Exception):
    """Base exception for scheduling errors"""
    def __init__(self, message, code, details=None):
        self.message = message
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.now()
        super().__init__(self.message)

class ValidationError(SchedulingError):
    """Error for data validation"""
    pass

class ConstraintViolationError(SchedulingError):
    """Error for constraint violations"""
    pass

def is_break_time(day, hour, minute, duration_minutes):
    """Check if slot overlaps with break time"""
    start_time = datetime(2025, 1, 1, hour, minute)
    end_time = start_time + timedelta(minutes=duration_minutes)
    
    if day in ["Senin", "Selasa", "Rabu", "Kamis"]:
        break_start = datetime(2025, 1, 1, 12, 0)
        break_end = datetime(2025, 1, 1, 13, 0)
    elif day == "Jumat":
        break_start = datetime(2025, 1, 1, 12, 0)
        break_end = datetime(2025, 1, 1, 13, 40)
    else:
        return False
    
    if start_time < break_end and end_time > break_start:
        return True
    
    return False

def is_class_conflict(kelas1, kelas2):
    """Check if two classes conflict for students"""
    if kelas1 == kelas2:
        return True
    if kelas1 == "A1A2" or kelas2 == "A1A2":
        return True
    return False

def time_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap"""
    return start1 < end2 and start2 < end1

def get_dosen_available_days(dosen_id, dosen_data):
    """Get available days for a lecturer"""
    if isinstance(dosen_data.get(dosen_id), dict):
        return dosen_data[dosen_id].get('available_days', DAYS)
    else:
        return DAYS

# ===== ROOM UTILIZATION FUNCTIONS =====
def calculate_room_utilization(schedule, rooms, context):
    """
    Menghitung utilisasi ruangan dan memberikan penalty jika tidak merata
    Returns: (utilization_percentage, penalty)
    """
    if not schedule or not rooms:
        return {}, 0
    
    # Hitung total slot yang tersedia per hari
    # 5 hari * (8 jam * 6 slot/jam) = 240 slot per minggu per ruangan
    total_slots_per_room = 5 * 8 * 6  # 240 slot
    
    # Inisialisasi counter untuk setiap ruangan
    room_usage = {room_id: 0 for room_id in rooms.keys()}
    
    # Hitung penggunaan setiap ruangan
    for session_id, (room, time_slot) in schedule.items():
        if room in room_usage:
            course_full_id = '_'.join(session_id.split('_')[:-1])
            course_data = context.courses.get(course_full_id, {})
            duration_slots = course_data.get("duration_slots", 1)
            room_usage[room] += duration_slots
    
    # Hitung persentase utilisasi
    utilization = {}
    for room_id, used_slots in room_usage.items():
        utilization[room_id] = (used_slots / total_slots_per_room) * 100
    
    # Hitung penalty untuk ketidakmerataan
    if len(utilization) > 1:
        util_values = list(utilization.values())
        max_util = max(util_values)
        min_util = min(util_values)
        
        # Jika ada ruangan dengan selisih utilisasi > 40%, beri penalty
        if max_util - min_util > 40:
            # Penalty proporsional dengan tingkat ketidakmerataan
            imbalance_penalty = (max_util - min_util) * 2
            return utilization, imbalance_penalty
    
    return utilization, 0

def get_room_utilization_summary(utilization):
    """Membuat summary utilisasi ruangan untuk ditampilkan"""
    if not utilization:
        return "Tidak ada data utilisasi"
    
    summary = []
    sorted_rooms = sorted(utilization.items(), key=lambda x: x[1], reverse=True)
    
    for room, util in sorted_rooms:
        if util >= 80:
            status = "🔥 Padat"
        elif util >= 50:
            status = "📊 Normal"
        elif util >= 20:
            status = "💤 Rendah"
        else:
            status = "⚠️ Sangat Rendah"
        
        summary.append(f"{room}: {util:.1f}% {status}")
    
    return "\n".join(summary)

# ===== DOSEN CONFLICT ACROSS SEMESTERS =====
def check_dosen_conflict_across_semesters(sessions_data):
    """
    Memeriksa konflik dosen antar semester
    Returns: (conflict_count, conflict_details)
    """
    conflicts = 0
    conflict_details = []
    
    # Kelompokkan berdasarkan (dosen_id, day)
    dosen_schedule = {}
    
    for session in sessions_data:
        key = (session['dosen'], session['day'])
        if key not in dosen_schedule:
            dosen_schedule[key] = []
        dosen_schedule[key].append({
            'start': session['start'],
            'end': session['end'],
            'course': session.get('course_full_id', 'Unknown'),
            'semester': session.get('semester', 0)
        })
    
    # Cek overlap untuk setiap dosen di hari yang sama
    for (dosen_id, day), schedules in dosen_schedule.items():
        # Urutkan berdasarkan waktu mulai
        schedules.sort(key=lambda x: x['start'])
        
        for i in range(len(schedules) - 1):
            current = schedules[i]
            next_session = schedules[i + 1]
            
            # Cek overlap
            if current['end'] > next_session['start']:
                conflicts += 1
                conflict_details.append({
                    'dosen': dosen_id,
                    'day': day,
                    'semester1': current['semester'],
                    'semester2': next_session['semester'],
                    'course1': current['course'],
                    'course2': next_session['course'],
                    'time1': f"{current['start'].strftime('%H:%M')}-{current['end'].strftime('%H:%M')}",
                    'time2': f"{next_session['start'].strftime('%H:%M')}-{next_session['end'].strftime('%H:%M')}"
                })
    
    return conflicts, conflict_details

class SchedulingContext:
    def __init__(self, rooms, dosen, courses, ga_params, semester_type='ganjil'):
        self.rooms = rooms
        self.dosen = dosen
        self.semester_type = semester_type
        self.courses = self._build_courses(courses)
        self.all_sessions = self._build_sessions()
        self.time_slots = self._build_time_slots()
        self.ga_params = ga_params
        self.dosen_conflicts = []  # Untuk menyimpan detail konflik
        self.room_utilization = {}  # Untuk menyimpan data utilisasi
    
    def _build_courses(self, courses):
        """Build courses filtered by semester type"""
        result = {}
        
        if self.semester_type == 'ganjil':
            valid_semesters = SEMESTER_GANJIL
        else:
            valid_semesters = SEMESTER_GENAP
        
        for course_id, data in sorted(courses.items()):
            sem = data.get("sem")
            if sem not in valid_semesters:
                continue
            
            jam = data.get("jam", 2)
            tipe = data.get("tipe", "terpisah")
            duration_slots = jam * 6
            
            if tipe == "gabungan":
                result[f"{course_id}_A1A2"] = {**data, "duration_slots": duration_slots, "kelas": "A1A2"}
            else:
                for kelas in ["A1", "A2"]:
                    result[f"{course_id}_{kelas}"] = {**data, "duration_slots": duration_slots, "kelas": kelas}
        return result
    
    def _build_sessions(self):
        sessions = []
        for course_full_id in self.courses.keys():
            sessions.append(f"{course_full_id}_S1")
        return sessions
    
    def _build_time_slots(self):
        """Generate valid time slots excluding break times"""
        all_slots = {}
        for day in DAYS:
            day_slots = []
            current_time = datetime(2025, 1, 1, START_HOUR, 0)
            end_time = datetime(2025, 1, 1, END_HOUR, 0)
            
            while current_time < end_time:
                hour = current_time.hour
                minute = current_time.minute
                
                is_break = False
                if day in ["Senin", "Selasa", "Rabu", "Kamis"]:
                    if hour >= 12 and hour < 13:
                        is_break = True
                elif day == "Jumat":
                    if hour >= 12 and hour < 14:
                        is_break = True
                    elif hour == 14 and minute < 40:
                        is_break = True
                
                if not is_break:
                    slot_key = f"{day} {current_time.strftime('%H:%M')}"
                    day_slots.append(slot_key)
                
                current_time += timedelta(minutes=SLOT_DURATION_MINUTES)
            
            all_slots[day] = day_slots
        
        all_slots_flat = [slot for day_slots in all_slots.values() for slot in day_slots]
        return all_slots_flat, all_slots

def get_session_time_slots(context, day, start_time_str, num_slots):
    """Get consecutive time slots for a session"""
    slots_in_day = context.time_slots[1].get(day, [])
    full_start_slot = f"{day} {start_time_str}"
    
    try:
        start_index = slots_in_day.index(full_start_slot)
    except ValueError:
        return []
    
    slots_to_check = slots_in_day[start_index : start_index + num_slots]
    
    if len(slots_to_check) < num_slots:
        return []
    
    # Validate consecutive slots
    for i in range(num_slots - 1):
        time1_str = slots_to_check[i].split(' ')[1]
        time2_str = slots_to_check[i+1].split(' ')[1]
        dt1 = datetime.strptime(time1_str, "%H:%M")
        dt2 = datetime.strptime(time2_str, "%H:%M")
        if dt2 - dt1 > timedelta(minutes=SLOT_DURATION_MINUTES):
            return []
    
    return slots_to_check

def get_valid_slots_for_session(context, session_id):
    """Get all valid time slots for a session considering lecturer's available days"""
    course_full_id = '_'.join(session_id.split('_')[:-1])
    course_data = context.courses.get(course_full_id)
    
    if not course_data:
        return context.time_slots[0]
    
    num_slots = course_data["duration_slots"]
    dosen_id = course_data.get("dosen")
    
    available_days = get_dosen_available_days(dosen_id, context.dosen)
    
    valid_slots = []
    
    for day in available_days:
        if day not in DAYS:
            continue
            
        slots_in_day = context.time_slots[1].get(day, [])
        for i in range(len(slots_in_day)):
            start_slot = slots_in_day[i]
            start_time_str = start_slot.split(' ')[1]
            
            slots_to_check = get_session_time_slots(context, day, start_time_str, num_slots)
            if slots_to_check:
                valid_slots.append(start_slot)
    
    return valid_slots if valid_slots else context.time_slots[0]

def count_conflicts(context, schedule, new_session_id):
    """Count conflicts for a new session"""
    if new_session_id not in schedule:
        return 0
    
    conflicts = 0
    new_room, new_time = schedule[new_session_id]
    new_course_full_id = '_'.join(new_session_id.split('_')[:-1])
    new_course_data = context.courses.get(new_course_full_id, {})
    
    if not new_course_data:
        return 1000
    
    new_day = new_time.split(' ')[0]
    new_start_str = new_time.split(' ')[1]
    new_slots = get_session_time_slots(context, new_day, new_start_str, new_course_data['duration_slots'])
    
    if not new_slots:
        return 1000
    
    dosen_id = new_course_data.get('dosen')
    available_days = get_dosen_available_days(dosen_id, context.dosen)
    if new_day not in available_days:
        conflicts += 100
    
    for other_session_id, (other_room, other_time) in schedule.items():
        if other_session_id == new_session_id:
            continue
        
        other_course_full_id = '_'.join(other_session_id.split('_')[:-1])
        other_course_data = context.courses.get(other_course_full_id, {})
        
        if not other_course_data:
            continue
        
        other_day = other_time.split(' ')[0]
        other_start_str = other_time.split(' ')[1]
        other_slots = get_session_time_slots(context, other_day, other_start_str, other_course_data['duration_slots'])
        
        if not other_slots:
            continue
        
        overlap = set(new_slots) & set(other_slots)
        if overlap:
            if new_room == other_room:
                conflicts += 1
            if new_course_data['dosen'] == other_course_data['dosen']:
                conflicts += 1
            if new_course_data['sem'] == other_course_data['sem'] and \
               is_class_conflict(new_course_data['kelas'], other_course_data['kelas']):
                conflicts += 1
    
    return conflicts

def create_schedule_greedy(context):
    """Create schedule using greedy approach"""
    schedule = {}
    sessions_sorted = sorted(context.all_sessions, 
                           key=lambda s: context.courses['_'.join(s.split('_')[:-1])]['duration_slots'], 
                           reverse=True)
    
    for session_id in sessions_sorted:
        valid_slots = get_valid_slots_for_session(context, session_id)
        if not valid_slots:
            valid_slots = context.time_slots[0]
        
        best_slot = None
        best_room = None
        min_conflicts = float('inf')
        
        sample_size = min(10, len(valid_slots))
        sampled_slots = random.sample(valid_slots, sample_size)
        sampled_rooms = random.sample(list(context.rooms.keys()), min(3, len(context.rooms)))
        
        for test_slot in sampled_slots:
            for test_room in sampled_rooms:
                temp_schedule = schedule.copy()
                temp_schedule[session_id] = (test_room, test_slot)
                conflicts = count_conflicts(context, temp_schedule, session_id)
                
                if conflicts < min_conflicts:
                    min_conflicts = conflicts
                    best_slot = test_slot
                    best_room = test_room
        
        if best_slot and best_room:
            schedule[session_id] = (best_room, best_slot)
        else:
            schedule[session_id] = (random.choice(list(context.rooms.keys())), random.choice(valid_slots))
    
    return schedule

def create_schedule(context):
    """Create random or greedy schedule"""
    if random.random() < 0.3:
        return create_schedule_greedy(context)
    
    schedule = {}
    for session_id in context.all_sessions:
        valid_slots = get_valid_slots_for_session(context, session_id)
        time = random.choice(valid_slots) if valid_slots else random.choice(context.time_slots[0])
        room = random.choice(list(context.rooms.keys()))
        schedule[session_id] = (room, time)
    return schedule

def calculate_fitness(schedule, context):
    """Calculate fitness score with room utilization and cross-semester checks"""
    penalty = 0
    all_sessions_data = []
    
    # Build all session data with time ranges
    for session_id, (room, time_start) in schedule.items():
        course_full_id = '_'.join(session_id.split('_')[:-1])
        course_data = context.courses.get(course_full_id, {})
        
        if not course_data:
            penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"] * 10
            continue
        
        day, start_time_only = time_start.split(' ')
        num_slots = course_data.get("duration_slots", 1)
        
        slots_to_check = get_session_time_slots(context, day, start_time_only, num_slots)
        if not slots_to_check:
            penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"] * 10
            continue
        
        dosen_id = course_data.get('dosen')
        available_days = get_dosen_available_days(dosen_id, context.dosen)
        if day not in available_days:
            penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"] * 5
        
        start_dt = datetime.strptime(start_time_only, "%H:%M")
        end_dt = start_dt + timedelta(minutes=num_slots * SLOT_DURATION_MINUTES)
        
        all_sessions_data.append({
            'session_id': session_id,
            'course_full_id': course_full_id,
            'room': room,
            'day': day,
            'start': start_dt,
            'end': end_dt,
            'dosen': dosen_id,
            'semester': course_data.get("sem"),
            'kelas': course_data.get("kelas"),
            'kapasitas': course_data.get("kapasitas_kelas", 0),
            'slots': slots_to_check
        })
    
    # Check hard constraints: Room, Dosen, Semester-Class overlaps
    for i, session_i in enumerate(all_sessions_data):
        for j, session_j in enumerate(all_sessions_data):
            if i >= j:
                continue
            
            if session_i['day'] == session_j['day'] and time_overlap(session_i['start'], session_i['end'], 
                                                                     session_j['start'], session_j['end']):
                if session_i['room'] == session_j['room']:
                    penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"]
                
                if session_i['dosen'] == session_j['dosen']:
                    penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"]
                
                if session_i['semester'] == session_j['semester'] and \
                   is_class_conflict(session_i['kelas'], session_j['kelas']):
                    penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"]
    
    # Check dosen conflicts ACROSS semesters
    dosen_conflicts, conflict_details = check_dosen_conflict_across_semesters(all_sessions_data)
    if dosen_conflicts > 0:
        penalty += dosen_conflicts * context.ga_params["HARD_CONSTRAINT_PENALTY"] * 2
        if not hasattr(context, 'dosen_conflicts'):
            context.dosen_conflicts = []
        context.dosen_conflicts.extend(conflict_details)
    
    # Check room capacity
    for session in all_sessions_data:
        room = session['room']
        kapasitas = session['kapasitas']
        room_cap = context.rooms.get(room, {}).get("kapasitas", 0)
        if kapasitas > room_cap:
            penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"]
    
    # Soft constraint: Dosen 30 menit gap
    dosen_by_day = {}
    for session in all_sessions_data:
        dosen_id = session['dosen']
        day = session['day']
        key = (dosen_id, day)
        if key not in dosen_by_day:
            dosen_by_day[key] = []
        dosen_by_day[key].append(session)
    
    for sessions_list in dosen_by_day.values():
        sessions_list.sort(key=lambda x: x['start'])
        for i in range(len(sessions_list) - 1):
            current_end = sessions_list[i]['end']
            next_start = sessions_list[i+1]['start']
            gap = (next_start - current_end).total_seconds() / 60
            if 0 < gap < 30:
                penalty += context.ga_params["SOFT_CONSTRAINT_PENALTY"] * (30 - gap)
    
    # Hard constraint: Same course min 3 hours gap on same day
    course_by_key = {}
    for session in all_sessions_data:
        course_full_id = session['course_full_id']
        kelas = session['kelas']
        base_course = '_'.join(course_full_id.split('_')[:-1]) if '_' in course_full_id else course_full_id
        key = (base_course, kelas)
        if key not in course_by_key:
            course_by_key[key] = []
        course_by_key[key].append(session)
    
    for sessions_list in course_by_key.values():
        if len(sessions_list) > 1:
            for i in range(len(sessions_list)):
                for j in range(i + 1, len(sessions_list)):
                    if sessions_list[i]['day'] == sessions_list[j]['day']:
                        if sessions_list[i]['end'] <= sessions_list[j]['start']:
                            gap_hours = (sessions_list[j]['start'] - sessions_list[i]['end']).total_seconds() / 3600
                        elif sessions_list[j]['end'] <= sessions_list[i]['start']:
                            gap_hours = (sessions_list[i]['start'] - sessions_list[j]['end']).total_seconds() / 3600
                        else:
                            gap_hours = 0
                        
                        if gap_hours < 3:
                            penalty += context.ga_params["HARD_CONSTRAINT_PENALTY"] * (3 - gap_hours)
    
    # Room utilization penalty
    utilization, util_penalty = calculate_room_utilization(schedule, context.rooms, context)
    penalty += util_penalty
    
    # Simpan utilization untuk ditampilkan nanti
    if not hasattr(context, 'room_utilization'):
        context.room_utilization = utilization
    
    return penalty

def mutate(schedule, context, mutation_rate):
    """Mutate schedule"""
    if random.random() < mutation_rate:
        num_mutations = random.randint(1, min(5, max(1, len(context.all_sessions) // 4)))
        sessions_to_mutate = random.sample(context.all_sessions, min(num_mutations, len(context.all_sessions)))
        
        for session_id in sessions_to_mutate:
            mutation_type = random.random()
            
            if mutation_type < 0.5:
                current_room, current_time = schedule.get(session_id, (None, None))
                if current_room:
                    new_room = random.choice(list(context.rooms.keys()))
                    schedule[session_id] = (new_room, current_time)
            elif mutation_type < 0.9:
                valid_slots = get_valid_slots_for_session(context, session_id)
                if valid_slots:
                    new_time = random.choice(valid_slots)
                    current_room, _ = schedule.get(session_id, (None, None))
                    if current_room:
                        schedule[session_id] = (current_room, new_time)
            else:
                valid_slots = get_valid_slots_for_session(context, session_id)
                if valid_slots:
                    new_time = random.choice(valid_slots)
                    new_room = random.choice(list(context.rooms.keys()))
                    schedule[session_id] = (new_room, new_time)
    
    return schedule

def crossover(parent1, parent2, context, crossover_rate=0.7):
    """
    Single-point crossover antara dua jadwal induk.
    """
    if random.random() > crossover_rate:
        return {k: v for k, v in parent1.items()}, {k: v for k, v in parent2.items()}
    
    sessions = list(context.all_sessions)
    if len(sessions) < 2:
        return {k: v for k, v in parent1.items()}, {k: v for k, v in parent2.items()}
    
    crossover_point = random.randint(1, len(sessions) - 1)
    
    offspring1 = {}
    offspring2 = {}
    
    for i, session_id in enumerate(sessions):
        if i < crossover_point:
            offspring1[session_id] = parent1.get(session_id, parent2.get(session_id))
            offspring2[session_id] = parent2.get(session_id, parent1.get(session_id))
        else:
            offspring1[session_id] = parent2.get(session_id, parent1.get(session_id))
            offspring2[session_id] = parent1.get(session_id, parent2.get(session_id))
    
    return offspring1, offspring2

def greedy_optimize(schedule, context, max_iterations=100):
    """Apply greedy optimization with better error handling"""
    try:
        current_schedule = {k: v for k, v in schedule.items()}
        current_penalty = calculate_fitness(current_schedule, context)
        
        improvements = []
        
        for iteration in range(max_iterations):
            improved = False
            
            for session_id in context.all_sessions:
                if session_id not in current_schedule:
                    continue
                
                current_room, current_time = current_schedule[session_id]
                best_room = current_room
                best_time = current_time
                best_penalty = current_penalty
                
                valid_slots = get_valid_slots_for_session(context, session_id)
                slots_to_check = valid_slots[:20] if len(valid_slots) > 20 else valid_slots
                
                for room in context.rooms.keys():
                    for time_slot in slots_to_check:
                        try:
                            test_schedule = {k: v for k, v in current_schedule.items()}
                            test_schedule[session_id] = (room, time_slot)
                            
                            test_penalty = calculate_fitness(test_schedule, context)
                            
                            if test_penalty < best_penalty:
                                best_penalty = test_penalty
                                best_room = room
                                best_time = time_slot
                                improved = True
                        except Exception as e:
                            print(f"Error checking {session_id}: {str(e)}")
                            continue
                
                if improved and best_penalty < current_penalty:
                    current_schedule[session_id] = (best_room, best_time)
                    current_penalty = best_penalty
                    improvements.append({
                        'iteration': iteration,
                        'session': session_id,
                        'penalty': current_penalty,
                        'improvement': current_penalty - best_penalty
                    })
            
            if not improved:
                break
        
        return current_schedule, current_penalty, improvements
    
    except Exception as e:
        print(f"Error in greedy_optimize: {str(e)}")
        traceback.print_exc()
        return schedule, calculate_fitness(schedule, context), []

def run_ga_pure(context, ga_params):
    """
    GA Murni — menggunakan komponen GA lengkap: seleksi, CROSSOVER, dan mutasi.
    """
    print(f"\n{'='*60}")
    print(f"Menjalankan GA MURNI (dengan Crossover)")
    print(f"{'='*60}")
    print(f"Komponen: Seleksi → Crossover → Mutasi (tanpa Restart, tanpa Greedy)")
    print(f"Populasi: {ga_params['POPULATION_SIZE']} | Generasi: {ga_params['MAX_GENERATIONS']}")
    print(f"Total courses: {len(context.courses)}")
    
    ga_start_time = datetime.now()
    population = []
    for _ in range(ga_params["POPULATION_SIZE"]):
        sched = create_schedule(context)
        fitness = calculate_fitness(sched, context)
        population.append({"schedule": sched, "fitness": fitness})
    
    best_overall = min(population, key=lambda p: p['fitness'])
    print(f"Initial best fitness: {best_overall['fitness']:.2f}")
    
    CROSSOVER_RATE = 0.75
    ELITE_RATIO = 0.1
    TOURNAMENT_SIZE = 5
    
    for generation in range(ga_params["MAX_GENERATIONS"]):
        progress = generation / ga_params["MAX_GENERATIONS"]
        mutation_rate = ga_params["INITIAL_MUTATION_RATE"] - (
            (ga_params["INITIAL_MUTATION_RATE"] - ga_params["MIN_MUTATION_RATE"]) * progress
        )
        
        population.sort(key=lambda p: p['fitness'])
        current_best = population[0]
        
        if current_best['fitness'] < best_overall['fitness']:
            best_overall = current_best
            if generation % 100 == 0:
                print(f"Gen {generation}: Penalti = {best_overall['fitness']:.2f} | MutRate = {mutation_rate:.3f}")
        
        if best_overall['fitness'] == 0:
            print(f"Solusi optimal ditemukan di generasi {generation}!")
            break
        
        elite_count = max(1, int(ga_params["POPULATION_SIZE"] * ELITE_RATIO))
        new_pop = [{"schedule": {k: v for k, v in ind['schedule'].items()}, "fitness": ind['fitness']}
                   for ind in population[:elite_count]]
        
        def tournament_select(pop):
            candidates = random.sample(pop, min(TOURNAMENT_SIZE, len(pop)))
            return min(candidates, key=lambda p: p['fitness'])
        
        while len(new_pop) < ga_params["POPULATION_SIZE"]:
            parent1 = tournament_select(population)
            parent2 = tournament_select(population)
            
            offspring1_sched, offspring2_sched = crossover(
                parent1['schedule'], parent2['schedule'], context, CROSSOVER_RATE
            )
            
            offspring1_sched = mutate(offspring1_sched, context, mutation_rate)
            offspring2_sched = mutate(offspring2_sched, context, mutation_rate)
            
            for offspring_sched in [offspring1_sched, offspring2_sched]:
                if len(new_pop) < ga_params["POPULATION_SIZE"]:
                    f = calculate_fitness(offspring_sched, context)
                    new_pop.append({"schedule": offspring_sched, "fitness": f})
        
        population = new_pop
    
    ga_end_time = datetime.now()
    ga_duration = (ga_end_time - ga_start_time).total_seconds()
    
    print(f"GA Murni selesai: Penalti = {best_overall['fitness']:.2f} | Waktu = {ga_duration:.2f}s | Generasi = {generation+1}")
    
    metrics = {
        'ga_penalty': best_overall['fitness'],
        'ga_time': ga_duration,
        'ga_generations': generation + 1,
        'total_time': ga_duration,
        'method': 'GA Murni (Crossover + Mutasi)'
    }
    
    return best_overall['schedule'], best_overall['fitness'], metrics

def run_ga_greedy(context, ga_params):
    """
    GA + Greedy — menggunakan mekanisme Restart (bukan Crossover) untuk menghindari local optimum.
    """
    print(f"\n{'='*60}")
    print(f"Menjalankan GA + GREEDY (Restart Mechanism)")
    print(f"{'='*60}")
    print(f"Komponen: Seleksi → Mutasi → Restart → Greedy Optimization")
    print(f"Populasi: {ga_params['POPULATION_SIZE']} | Generasi: {ga_params['MAX_GENERATIONS']}")
    print(f"Total courses: {len(context.courses)}")
    
    ga_start_time = datetime.now()
    population = []
    for _ in range(ga_params["POPULATION_SIZE"]):
        sched = create_schedule(context)
        fitness = calculate_fitness(sched, context)
        population.append({"schedule": sched, "fitness": fitness})
    
    best_overall = min(population, key=lambda p: p['fitness'])
    print(f"Initial best fitness: {best_overall['fitness']:.2f}")
    
    generations_without_improvement = 0
    stagnation_threshold = 300
    
    for generation in range(ga_params["MAX_GENERATIONS"]):
        progress = generation / ga_params["MAX_GENERATIONS"]
        mutation_rate = ga_params["INITIAL_MUTATION_RATE"] - (
            (ga_params["INITIAL_MUTATION_RATE"] - ga_params["MIN_MUTATION_RATE"]) * progress
        )
        
        population.sort(key=lambda p: p['fitness'])
        current_best = population[0]
        
        if current_best['fitness'] < best_overall['fitness']:
            best_overall = current_best
            generations_without_improvement = 0
            if generation % 100 == 0:
                print(f"Gen {generation}: Penalti = {best_overall['fitness']:.2f} | MutRate = {mutation_rate:.3f}")
        else:
            generations_without_improvement += 1
        
        if best_overall['fitness'] == 0:
            print(f"Solusi optimal ditemukan di generasi {generation}!")
            break
        
        if generations_without_improvement > stagnation_threshold:
            print(f"Restart: Stagnan {stagnation_threshold} generasi | Best: {best_overall['fitness']:.2f}")
            elite_keep = int(ga_params["POPULATION_SIZE"] * 0.1)
            new_population = population[:elite_keep]
            for _ in range(ga_params["POPULATION_SIZE"] - elite_keep):
                new_schedule = create_schedule(context)
                new_fitness = calculate_fitness(new_schedule, context)
                new_population.append({"schedule": new_schedule, "fitness": new_fitness})
            population = new_population
            generations_without_improvement = 0
            stagnation_threshold = min(500, stagnation_threshold + 50)
        
        new_pop = population[:int(ga_params["POPULATION_SIZE"] * 0.2)]
        
        while len(new_pop) < ga_params["POPULATION_SIZE"]:
            parent = random.choice(population[:50])
            offspring_schedule = {k: v for k, v in parent['schedule'].items()}
            offspring_schedule = mutate(offspring_schedule, context, mutation_rate)
            offspring_fitness = calculate_fitness(offspring_schedule, context)
            new_pop.append({"schedule": offspring_schedule, "fitness": offspring_fitness})
        
        population = new_pop
    
    ga_end_time = datetime.now()
    ga_duration = (ga_end_time - ga_start_time).total_seconds()
    
    print(f"GA (fase 1) selesai: Penalti = {best_overall['fitness']:.2f} | Waktu = {ga_duration:.2f}s")
    
    print(f"\n{'='*60}")
    print(f"Menjalankan Greedy Optimization (post-processing)")
    print(f"{'='*60}")
    greedy_start_time = datetime.now()
    
    optimized_schedule, optimized_penalty, improvements = greedy_optimize(
        best_overall['schedule'], context, max_iterations=50
    )
    
    greedy_end_time = datetime.now()
    greedy_duration = (greedy_end_time - greedy_start_time).total_seconds()
    
    print(f"Greedy selesai: {best_overall['fitness']:.2f} → {optimized_penalty:.2f}")
    print(f"Waktu greedy: {greedy_duration:.2f}s | Total: {ga_duration + greedy_duration:.2f}s")
    print(f"Perbaikan: {len(improvements)} perubahan")
    
    metrics = {
        'ga_penalty': best_overall['fitness'],
        'ga_time': ga_duration,
        'ga_generations': generation + 1,
        'greedy_penalty': optimized_penalty,
        'greedy_time': greedy_duration,
        'total_time': ga_duration + greedy_duration,
        'improvements': len(improvements),
        'penalty_reduction': best_overall['fitness'] - optimized_penalty,
        'method': 'GA + Greedy (Restart + Greedy Post-processing)'
    }
    
    return optimized_schedule, optimized_penalty, metrics

def run_genetic_algorithm(rooms=None, dosen=None, courses=None, ga_params=None, semester_type='ganjil', use_greedy=False):
    """
    Entry point utama algoritma penjadwalan.
    """
    if rooms is None:
        rooms = ROOMS
    if dosen is None:
        dosen = DOSEN_DATABASE
    if courses is None:
        courses = COURSE_CONFIG
    if ga_params is None:
        ga_params = GA_PARAMS
    
    try:
        context = SchedulingContext(rooms, dosen, courses, ga_params, semester_type)
        
        if len(context.courses) == 0:
            print(f"⚠ Tidak ada mata kuliah untuk semester {semester_type}")
            return None, 0, {}, None
        
        if use_greedy:
            final_schedule, final_penalty, metrics = run_ga_greedy(context, ga_params)
        else:
            final_schedule, final_penalty, metrics = run_ga_pure(context, ga_params)
        
        structured_result = format_schedule_by_semester(final_schedule, context)
        return final_schedule, final_penalty, structured_result, metrics
    
    except Exception as e:
        print(f"ERROR in run_genetic_algorithm: {str(e)}")
        raise

def format_schedule_by_semester(final_schedule, context):
    """Format schedule by semester"""
    structured = {}
    
    for session, (room, time) in final_schedule.items():
        try:
            course_full_id = '_'.join(session.split('_')[:-1])
            course_info = context.courses.get(course_full_id, {})
            
            if not course_info:
                continue
            
            semester = course_info.get("sem")
            dosen_id = course_info.get("dosen")
            
            if isinstance(context.dosen.get(dosen_id), dict):
                dosen_name = context.dosen[dosen_id].get('name', dosen_id)
            else:
                dosen_name = context.dosen.get(dosen_id, dosen_id)
            
            day, start_time = time.split(' ')
            num_slots = course_info.get("duration_slots", 1)
            
            start_dt = datetime.strptime(start_time, "%H:%M")
            end_dt = start_dt + timedelta(minutes=num_slots * 10)
            end_time = end_dt.strftime("%H:%M")
            
            if semester not in structured:
                structured[semester] = {}
            if day not in structured[semester]:
                structured[semester][day] = []
            
            structured[semester][day].append({
                "course": course_full_id,
                "kelas": course_info.get("kelas"),
                "dosen": f"{dosen_name} ({dosen_id})",
                "room": room,
                "start_time": start_time,
                "end_time": end_time
            })
        except Exception as e:
            print(f"Error formatting session {session}: {str(e)}")
            continue
    
    for sem in structured.values():
        for day in sem.values():
            day.sort(key=lambda x: x['start_time'])
    
    return structured