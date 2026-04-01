#!/usr/bin/env python3
"""
Script untuk inisialisasi database MongoDB
Menambahkan data default untuk testing dan development
"""

from db_handler import db_handler
import sys

def main():
    print("\n" + "="*60)
    print("🗄️  INISIALISASI DATABASE MONGODB")
    print("="*60 + "\n")
    
    try:
        # Test connection
        print("📡 Testing MongoDB connection...")
        if not db_handler.client:
            print("❌ Gagal terhubung ke MongoDB!")
            print("💡 Pastikan MongoDB sudah berjalan:")
            print("   - Windows: Check MongoDB service")
            print("   - Linux: sudo systemctl start mongod")
            print("   - macOS: brew services start mongodb-community")
            sys.exit(1)
        
        print("✅ Koneksi MongoDB berhasil!\n")
        
        # Load default data
        print("📦 Loading data default...")
        success = db_handler.load_default_data()
        
        if success:
            print("\n" + "="*60)
            print("✅ INISIALISASI SELESAI!")
            print("="*60)
            
            # Show statistics
            rooms = db_handler.get_all_rooms()
            lecturers = db_handler.get_all_lecturers()
            courses = db_handler.get_all_courses()
            
            print(f"\n📊 Data yang dimuat:")
            print(f"   • Ruangan: {len(rooms)} items")
            print(f"   • Dosen: {len(lecturers)} items")
            print(f"   • Mata Kuliah: {len(courses)} items")
            
            print(f"\n🎯 Contoh data dosen dengan hari mengajar:")
            for i, (lec_id, lec_data) in enumerate(list(lecturers.items())[:3]):
                days = lec_data.get('available_days', [])
                print(f"   • {lec_id} ({lec_data['name']}): {', '.join(days)}")
            
            print(f"\n📚 Distribusi mata kuliah per semester:")
            semester_dist = {}
            for course_id, course_data in courses.items():
                sem = course_data['sem']
                semester_dist[sem] = semester_dist.get(sem, 0) + 1
            
            for sem in sorted(semester_dist.keys()):
                sem_type = "Ganjil" if sem % 2 == 1 else "Genap"
                print(f"   • Semester {sem} ({sem_type}): {semester_dist[sem]} mata kuliah")
            
            print("\n🚀 Siap digunakan! Jalankan: python app.py")
            print("="*60 + "\n")
        else:
            print("\n❌ Gagal memuat data default!")
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Proses dibatalkan oleh user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db_handler.close()

if __name__ == "__main__":
    main()
