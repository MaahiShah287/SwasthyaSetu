import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  FileText, 
  Upload, 
  Plus, 
  ArrowUpRight, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  Stethoscope,
  Calendar,
  Video,
  Building2,
  Truck,
  CheckCircle2,
  ExternalLink,
  Lock,
  ChevronRight,
  PhoneCall,
  Sparkles,
  MapPin,
  Syringe,
  Pill,
  FlaskConical
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import { useState, useEffect } from 'react';
import api from '../api/instance';
import PatientDiagnosticSection from '../components/diagnostic/PatientDiagnosticSection';

const Widget = ({ children, className = "" }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02, y: -5 }}
    className={`premium-card p-6 relative overflow-hidden group ${className}`}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/5 blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--accent-primary)]/10 transition-colors" />
    {children}
  </motion.div>
);

export default function Dashboard() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [hospitalBookings, setHospitalBookings] = useState<any[]>([]);
  const [ambulanceRequests, setAmbulanceRequests] = useState<any[]>([]);
  const [vaxSummary, setVaxSummary] = useState<any>(null);
  const [followUpSummary, setFollowUpSummary] = useState<any>(null);
  const [activeCareTab, setActiveCareTab] = useState<'appointments' | 'hospitals' | 'ambulances'>('appointments');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activityRes, apptRes, hospRes, ambRes, vaxRes, followUpRes] = await Promise.all([
          api.get('/dashboard/stats').catch(() => ({ data: null })),
          api.get('/dashboard/activity').catch(() => ({ data: [] })),
          api.get('/telemedicine/appointments/my-appointments').catch(() => ({ data: [] })),
          api.get('/hospitals/bookings/list').catch(() => ({ data: [] })),
          api.get('/emergency/ambulances/my-requests').catch(() => ({ data: [] })),
          api.get('/vaccinations/summary').catch(() => ({ data: null })),
          api.get('/follow-ups/summary').catch(() => ({ data: null }))
        ]);
        setDashboardData(statsRes.data);
        setActivities(activityRes.data || []);
        setAppointments(apptRes.data || []);
        setHospitalBookings(hospRes.data || []);
        setAmbulanceRequests(ambRes.data || []);
        setVaxSummary(vaxRes.data);
        setFollowUpSummary(followUpRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    { label: 'Health Score', value: dashboardData?.health_score || '92', sub: '+4% improvement', icon: Activity, color: theme === 'dark' ? 'text-cyan-400' : 'text-emerald-500' },
    { label: 'Care Bookings', value: appointments.length + hospitalBookings.length, sub: 'Active requests', icon: Calendar, color: theme === 'dark' ? 'text-violet-400' : 'text-blue-500' },
    { label: 'Claim Status', value: dashboardData?.status || 'Active', sub: 'AI Audited', icon: Shield, color: 'text-purple-500' },
  ];

  const userName = localStorage.getItem("userName") || "User";

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>{userName}</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Your unified clinical care ecosystem: appointments, hospital beds, emergency fleet, and immunizations.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-slate-400 bg-white/5 dark:bg-black/20 rounded-full px-4 py-2 border border-white/10">
          <Clock size={14} className="text-blue-500" />
          <span>Live Mesh Active</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="glass-light dark:glass-dark p-6 h-32 flex flex-col justify-between rounded-2xl">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : (
          stats.map((stat, i) => (
            <Widget key={i}>
              <div className="flex items-start justify-between">
                <div className="space-y-2 text-left">
                  <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">{stat.label}</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">{stat.value}</p>
                    {stat.label === 'Health Score' && <span className="text-base font-bold text-[var(--text-secondary)]">%</span>}
                  </div>
                  <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${stat.color} bg-[var(--bg-primary)] px-3 py-1 rounded-full w-fit border border-[var(--border-main)] shadow-sm`}>
                     <TrendingUp size={12} className="mr-1.5" />
                     {stat.sub}
                  </div>
                </div>
                <div className={`p-4 rounded-[1.5rem] bg-[var(--bg-primary)] border border-[var(--border-main)] shadow-inner ${stat.color}`}>
                  <stat.icon size={26} strokeWidth={2.5} />
                </div>
              </div>
            </Widget>
          ))
        )}
      </div>

      {/* CARE FOLLOW-UPS CARD */}
      <div className="p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600/10 via-purple-500/10 to-transparent backdrop-blur-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md">
                <Calendar size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  CARE FOLLOW-UPS
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated care continuity: doctor reviews, referrals, lab tests, and post-consultation tracking.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Upcoming</span>
                <span className="text-xl font-extrabold text-cyan-500">{followUpSummary?.upcoming ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Due Today</span>
                <span className="text-xl font-extrabold text-amber-500">{followUpSummary?.due_today ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Overdue</span>
                <span className="text-xl font-extrabold text-rose-500">{followUpSummary?.overdue ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Completed</span>
                <span className="text-xl font-extrabold text-emerald-500">{followUpSummary?.completed ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link to="/follow-ups">
              <button className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all hover:scale-[1.02]">
                <span>View Follow-Ups</span>
                <ChevronRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* VACCINATION STATUS CARD */}
      <div className="p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-teal-500/10 to-transparent backdrop-blur-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
                <Syringe size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Vaccination Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live database metrics & verified immunization tracking.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Completed</span>
                <span className="text-xl font-extrabold text-emerald-500">{vaxSummary?.completed ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Upcoming</span>
                <span className="text-xl font-extrabold text-cyan-500">{vaxSummary?.upcoming ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Due Soon</span>
                <span className="text-xl font-extrabold text-amber-500">{vaxSummary?.due_soon ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Overdue</span>
                <span className="text-xl font-extrabold text-rose-500">{vaxSummary?.overdue ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center col-span-2 sm:col-span-1">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Gaps</span>
                <span className="text-xl font-extrabold text-purple-500">{vaxSummary?.gaps ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link to="/vaccinations">
              <button className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 transition-all hover:scale-[1.02]">
                <span>View Vaccination Tracking</span>
                <ChevronRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </div>


      {/* MEDICINE AVAILABILITY & STOCK DIRECTORY CARD */}
      <div className="p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-transparent backdrop-blur-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md">
                <Pill size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  MEDICINE AVAILABILITY & STOCK
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Search prescribed medicines across nearby Primary Health Centres, CHCs, and District Hospitals.
                </p>
              </div>
            </div>

            {/* Quick Prescribed Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 mr-1">Quick Check:</span>
              {[
                { name: 'Paracetamol 500mg', query: 'Paracetamol' },
                { name: 'Amoxicillin 500mg', query: 'Amoxicillin' },
                { name: 'Metformin 500mg', query: 'Metformin' },
                { name: 'Cetirizine 10mg', query: 'Cetirizine' },
                { name: 'ORS Sachet', query: 'ORS' }
              ].map(med => (
                <Link
                  key={med.name}
                  to={`/hospitals?medicine=${encodeURIComponent(med.query)}&view=medicine`}
                  className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-colors flex items-center space-x-1"
                >
                  <Pill size={11} className="text-emerald-500" />
                  <span>{med.name}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link to="/hospitals?tab=medicines">
              <button className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition-all hover:scale-[1.02]">
                <Pill size={15} />
                <span>Check Medicine Availability</span>
                <ChevronRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* "MY CARE" ECOSYSTEM HUB */}
      {/* ========================================================================= */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
              <Stethoscope size={14} />
              <span>Patient Ecosystem Hub</span>
            </div>
            <h3 className="text-2xl font-extrabold text-[var(--text-primary)]">
              My Care
            </h3>
          </div>

          {/* Sub-tabs for Care Hub */}
          <div className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-1.5">
            <button
              onClick={() => setActiveCareTab('appointments')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeCareTab === 'appointments'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Stethoscope size={13} />
              <span>Doctor Visits ({appointments.length})</span>
            </button>

            <button
              onClick={() => setActiveCareTab('hospitals')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeCareTab === 'hospitals'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Building2 size={13} />
              <span>Hospitals ({hospitalBookings.length})</span>
            </button>

            <button
              onClick={() => setActiveCareTab('ambulances')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeCareTab === 'ambulances'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Truck size={13} />
              <span>Ambulances ({ambulanceRequests.length})</span>
            </button>
          </div>
        </div>

        {/* 1. DOCTOR APPOINTMENTS TAB */}
        {activeCareTab === 'appointments' && (
          <div className="space-y-4">
            {appointments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map((appt) => {
                  const isApproved = appt.status === 'APPROVED' || appt.status === 'ACCEPTED' || appt.status === 'CONFIRMED';
                  const isUnlocked = appt.is_meeting_unlocked;

                  return (
                    <motion.div
                      key={appt.consultation_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="premium-card p-5 space-y-4 hover:border-teal-500/50 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                              🩺
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-[var(--text-primary)]">{appt.doctor_name}</h4>
                              <p className="text-xs font-bold text-teal-600 dark:text-teal-400">{appt.specialization || 'Specialist'}</p>
                              <p className="text-[11px] text-slate-400">{appt.facility_name || 'Medical Center'}</p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isApproved
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : appt.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}>
                            {appt.status}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400 font-medium">Scheduled Time:</span>
                            <span className="font-bold">{appt.scheduled_time}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400 font-medium">Consultation Type:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{appt.consultation_type || appt.consultation_mode}</span>
                          </div>
                          {appt.patient_notes && (
                            <div className="pt-1 text-[11px] text-slate-400 border-t border-[var(--border-main)]">
                              Notes: {appt.patient_notes}
                            </div>
                          )}
                        </div>

                        {/* Doctor Advice / Prescription Section */}
                        {(appt.doctor_advice || appt.status === 'COMPLETED' || appt.status === 'APPROVED') && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Pill size={12} /> Prescribed Advice & Care
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">Rx Advice</span>
                            </div>
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {appt.doctor_advice || "Clinical Recommendation: Tab Paracetamol 500mg (as needed), Tab Cetirizine 10mg"}
                            </p>
                            <div className="pt-1">
                              <Link
                                to={`/hospitals?medicine=${encodeURIComponent(
                                  appt.doctor_advice?.includes('Amoxicillin') ? 'Amoxicillin' :
                                  appt.doctor_advice?.includes('Metformin') ? 'Metformin' :
                                  appt.doctor_advice?.includes('Cetirizine') ? 'Cetirizine' : 'Paracetamol'
                                )}&view=medicine`}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition"
                              >
                                <Pill size={12} />
                                <span>Check Medicine Availability</span>
                                <ArrowUpRight size={12} />
                              </Link>
                            </div>
                          </div>
                        )}

                        {/* Meeting Link Status Display */}
                        {appt.is_online && (
                          <div className="space-y-1.5">
                            {!isApproved ? (
                              <p className="text-[11px] text-amber-600 font-medium flex items-center">
                                <Clock size={12} className="mr-1" />
                                Waiting for doctor to review and confirm time slot.
                              </p>
                            ) : isUnlocked ? (
                              <a
                                href={appt.jitsi_meet_url || appt.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                              >
                                <Video size={15} />
                                <span>🎥 Join Consultation</span>
                              </a>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-500 font-medium flex items-center space-x-2">
                                <Lock size={14} className="text-slate-400 flex-shrink-0" />
                                <span>🔒 Meeting link will be available 30 minutes before your appointment.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="premium-card p-10 text-center space-y-3">
                <Stethoscope size={36} className="text-slate-400 mx-auto" />
                <h4 className="font-bold text-base text-[var(--text-primary)]">No Doctor Appointments Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Search by specialty (Cardiology, General Medicine, Neurology) and book an appointment online or at a clinic.
                </p>
                <Link
                  to="/doctors"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20"
                >
                  <span>Discover Doctors</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 2. HOSPITAL BOOKINGS TAB */}
        {activeCareTab === 'hospitals' && (
          <div className="space-y-4">
            {hospitalBookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitalBookings.map((b) => (
                  <motion.div
                    key={b.booking_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="premium-card p-5 space-y-3 hover:border-indigo-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                          🏥
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-[var(--text-primary)]">{b.facility_name}</h4>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{b.booking_type}</p>
                          <p className="text-[11px] text-slate-400">Dept: {b.department || 'General'}</p>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase">
                        {b.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Preferred Date:</span>
                        <span className="font-bold text-[var(--text-primary)]">{b.preferred_date} ({b.preferred_time || 'Morning'})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Booking ID:</span>
                        <span className="font-mono text-slate-500">{b.booking_id}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="premium-card p-10 text-center space-y-3">
                <Building2 size={36} className="text-slate-400 mx-auto" />
                <h4 className="font-bold text-base text-[var(--text-primary)]">No Hospital Bookings</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  View live bed vacancy numbers and book OPD or emergency admission slots across nearby hospitals.
                </p>
                <Link
                  to="/hospitals"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  <span>Explore Hospital Network</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 3. AMBULANCE REQUESTS TAB */}
        {activeCareTab === 'ambulances' && (
          <div className="space-y-4">
            {ambulanceRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ambulanceRequests.map((req) => (
                  <motion.div
                    key={req.booking_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="premium-card p-5 space-y-3 border-rose-500/30 hover:border-rose-500 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-lg flex-shrink-0 animate-pulse">
                          🚑
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-[var(--text-primary)]">{req.vehicle_type}</h4>
                          <p className="font-mono text-xs text-slate-400">{req.ambulance_id}</p>
                          <p className="text-[11px] text-slate-400">{req.operator}</p>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-black uppercase">
                        {req.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Pickup Location:</span>
                        <span className="font-bold text-[var(--text-primary)] truncate max-w-[200px]">{req.pickup_address}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Emergency Type:</span>
                        <span className="font-bold text-rose-600">{req.emergency_type}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="premium-card p-10 text-center space-y-3">
                <Truck size={36} className="text-slate-400 mx-auto" />
                <h4 className="font-bold text-base text-[var(--text-primary)]">No Active Ambulance Requests</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  In case of an emergency, call 108 or request an advanced GPS-tracked ambulance unit.
                </p>
                <Link
                  to="/hospitals"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20"
                >
                  <span>Request Emergency Unit</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Diagnostic Timeline & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Reports Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center space-x-2 text-slate-800 dark:text-white">
              <FileText size={20} className="text-blue-600" />
              <span>Diagnostic Timeline & History</span>
            </h3>
            <Link to="/reports" className="text-sm font-bold text-blue-600 flex items-center hover:underline transition-all">
              Detailed Vault <ArrowUpRight size={16} className="ml-1" />
            </Link>
          </div>
          <div className="space-y-4">
            {loading ? (
              [1, 2].map(i => (
                <div key={i} className="glass-light dark:glass-dark p-6 flex items-center justify-between rounded-2xl">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              ))
            ) : activities.length > 0 ? (
              activities.map((activity, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 flex items-center justify-between group hover:border-[var(--accent-primary)] hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer rounded-2xl transition-all"
                >
                  <div className="flex items-center space-x-5">
                    <div className="p-4 bg-[var(--bg-primary)] text-[var(--accent-primary)] rounded-2xl group-hover:scale-110 transition-all shadow-inner border border-[var(--border-main)]">
                      <FileText size={22} />
                    </div>
                    <div className="text-left">
                      <p className="font-extrabold text-lg text-[var(--text-primary)]">{activity.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">{activity.description} • {new Date(activity.timestamp * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="hidden sm:block px-4 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {activity.status}
                    </div>
                    <ChevronRight size={22} className="text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-12 rounded-2xl text-center">
                <p className="text-[var(--text-secondary)] font-bold">No activity history yet.</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Upload a medical report or book a doctor to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Clinic Actions */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center space-x-2 text-slate-800 dark:text-white">
            <Plus size={20} className="text-teal-600" />
            <span>Healthcare Services</span>
          </h3>
          <div className="space-y-4">
            <Link to="/doctors" className="block">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 border border-teal-500/30 p-4 rounded-2xl flex items-center space-x-4 hover:shadow-xl hover:shadow-teal-500/20 transition-all group text-white">
                <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white group-hover:text-teal-600 transition-all">
                  <Stethoscope size={22} />
                </div>
                <div>
                  <p className="font-bold">Find & Book Doctors</p>
                  <p className="text-xs text-white/80 font-medium">Cardiology, Neuro, General & more</p>
                </div>
              </div>
            </Link>

            <Link to="/hospitals" className="block">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center space-x-4 hover:border-indigo-500/50 hover:shadow-lg transition-all group">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">Hospital Bed Vacancies</p>
                  <p className="text-xs text-slate-500 font-medium">Live Beds, ICU & Trauma Centers</p>
                </div>
              </div>
            </Link>

            <Link to="/triage" className="block">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center space-x-4 hover:border-blue-500/50 hover:shadow-lg transition-all group">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Sparkles size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">AI Health Triage</p>
                  <p className="text-xs text-slate-500 font-medium">Evaluate Symptoms & Recommendations</p>
                </div>
              </div>
            </Link>

            <Link to="/upload" className="block">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center space-x-4 hover:border-blue-500/50 hover:shadow-lg transition-all group">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">Vault Upload</p>
                  <p className="text-xs text-slate-500 font-medium">Capture Medical Data</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ===================== DIAGNOSTIC SERVICES SECTION ===================== */}
      <div className="premium-card p-6 space-y-5">
        <PatientDiagnosticSection />
      </div>
    </div>
  );
}
