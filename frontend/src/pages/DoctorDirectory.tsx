import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Stethoscope, 
  Search, 
  Filter, 
  Calendar, 
  Video, 
  Building2, 
  Clock, 
  ShieldCheck, 
  Star, 
  MapPin, 
  Phone,
  Sparkles,
  ChevronRight,
  Loader2,
  Heart,
  Brain,
  Activity,
  UserCheck
} from 'lucide-react';
import api from '../api/instance';
import { useTheme } from '../context/ThemeContext';
import BookAppointmentModal from '../components/appointments/BookAppointmentModal';
import { useLocation } from 'react-router-dom';

const SPECIALTIES = [
  "All Specialties",
  "Cardiology",
  "General Medicine",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Gynecology",
  "Dermatology",
  "General Surgery",
  "Emergency Medicine"
];

export default function DoctorDirectory() {
  const { theme } = useTheme();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSpecialty = searchParams.get('specialty') || 'All Specialties';

  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [selectedMode, setSelectedMode] = useState<'All' | 'Online Video' | 'Clinic'>('All');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<any | null>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      let url = '/telemedicine/doctors';
      const params: any = {};
      if (selectedSpecialty && selectedSpecialty !== 'All Specialties') {
        params.specialization = selectedSpecialty;
      }
      if (selectedMode !== 'All') {
        params.mode = selectedMode;
      }
      const res = await api.get(url, { params });
      setDoctors(res.data);
    } catch (e) {
      console.error("Failed to load doctors", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [selectedSpecialty, selectedMode]);

  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.facility_name && doc.facility_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header & Specialty Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-teal-500/10 px-3 py-1.5 rounded-full border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-widest mb-2">
            <Stethoscope size={13} />
            <span>Clinical Specialists Registry</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Doctor <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Discovery</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Search, filter, and schedule appointments with verified doctors and hospital specialists.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-1.5">
          <button
            onClick={() => setSelectedMode('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedMode === 'All' 
                ? 'bg-[var(--accent-primary)] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            All Modes
          </button>
          <button
            onClick={() => setSelectedMode('Online Video')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              selectedMode === 'Online Video' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Video size={13} />
            <span>Online Video</span>
          </button>
          <button
            onClick={() => setSelectedMode('Clinic')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              selectedMode === 'Clinic' 
                ? 'bg-teal-600 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Building2 size={13} />
            <span>Clinic Visit</span>
          </button>
        </div>
      </div>

      {/* Search and Specialty Filter Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name, specialty (e.g. Cardiologist), or hospital..."
            className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)] shadow-sm"
          />
        </div>

        {/* Specialty Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {SPECIALTIES.map(spec => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedSpecialty === spec
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20 scale-105'
                  : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-slate-600 dark:text-slate-400 hover:border-teal-500/50'
              }`}
            >
              {spec === 'Cardiology' && '❤️ '}
              {spec === 'Neurology' && '🧠 '}
              {spec === 'General Medicine' && '🩺 '}
              {spec === 'Orthopedics' && '🦴 '}
              {spec === 'Emergency Medicine' && '🚨 '}
              {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-teal-600" size={36} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Syncing Doctor Registry from MongoDB...
          </p>
        </div>
      ) : filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc, idx) => (
            <motion.div
              key={doc.doctor_id || idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="premium-card p-6 flex flex-col justify-between space-y-5 group hover:border-teal-500/50 hover:shadow-xl transition-all"
            >
              <div className="space-y-4">
                {/* Doctor Head Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-blue-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-xl shadow-inner border border-teal-500/20">
                      🩺
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="font-bold text-lg text-[var(--text-primary)]">{doc.name}</h4>
                        <ShieldCheck size={16} className="text-blue-500 flex-shrink-0" />
                      </div>
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400">{doc.specialization}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{doc.qualification || 'MBBS, MD'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase">
                    {doc.status || 'ONLINE'}
                  </span>
                </div>

                {/* Affiliation & Hours */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-2 text-xs">
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Building2 size={13} className="text-slate-400 mr-2 flex-shrink-0" />
                    <span className="truncate">{doc.facility_name || 'District Civil Hospital'}</span>
                  </div>
                  <div className="flex items-center text-slate-500">
                    <Clock size={13} className="text-slate-400 mr-2 flex-shrink-0" />
                    <span>{doc.availability || 'Mon-Fri 09:00 - 17:00'}</span>
                  </div>
                </div>

                {/* Consultation Modes available */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center space-x-1">
                    <Video size={11} />
                    <span>Online Video</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold flex items-center space-x-1">
                    <Building2 size={11} />
                    <span>Clinic OPD</span>
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setSelectedDoctorForBooking(doc)}
                className="w-full bg-[var(--accent-primary)] hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all"
              >
                <Calendar size={14} />
                <span>Book Appointment</span>
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="premium-card p-12 text-center space-y-3">
          <Stethoscope size={40} className="text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No Doctors Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No doctors matched your search criteria for "{searchQuery || selectedSpecialty}". Try resetting filters or searching for another specialty.
          </p>
          <button
            onClick={() => { setSelectedSpecialty('All Specialties'); setSearchQuery(''); }}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedDoctorForBooking && (
          <BookAppointmentModal
            doctor={selectedDoctorForBooking}
            prefillSpecialty={selectedSpecialty !== 'All Specialties' ? selectedSpecialty : undefined}
            onClose={() => setSelectedDoctorForBooking(null)}
            onSuccess={() => {
              setSelectedDoctorForBooking(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
