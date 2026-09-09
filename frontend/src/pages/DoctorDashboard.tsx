import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Calendar, 
  Activity, 
  Clock, 
  Stethoscope, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Video, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  AlertTriangle, 
  FileText, 
  ExternalLink,
  Info,
  Check,
  X,
  UserCheck,
  MessageSquare,
  FileUp,
  Save,
  Send,
  Syringe,
  Plus,
  Pill,
  FlaskConical
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/instance';
import { useTheme } from '../context/ThemeContext';
import diagnosticApi from '../api/diagnosticApi';
import { DiagnosticRecommendation } from '../types/diagnostic';
import DiagnosticRecommendPanel from '../components/diagnostic/DiagnosticRecommendPanel';

interface SharedReport {
  _id: string;
  title: string;
  report_type: string;
  cloudinary_url: string;
  upload_date: number;
}

interface Consultation {
  consultation_id: string;
  patient_name: string;
  patient_email: string;
  patient_age: number;
  doctor_name: string;
  facility_name: string;
  consultation_type: string;
  scheduled_time: string;
  triage_urgency: string;
  triage_summary?: string;
  patient_notes?: string;
  doctor_notes?: string;
  doctor_advice?: string;
  follow_up_recommendation?: string;
  follow_up_date?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED' | 'APPROVED' | 'CONFIRMED';
  google_meet_url?: string;
  jitsi_meet_url?: string;
  meeting_link?: string;
  is_meeting_unlocked?: boolean;
  is_google_api_configured?: boolean;
  status_note?: string;
  shared_reports?: SharedReport[];
}

interface Message {
  sender_name: string;
  sender_role: string;
  message: string;
  timestamp: number;
}

export default function DoctorDashboard() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Doctor Schedule & Profile Management State
  const [isManagingSchedule, setIsManagingSchedule] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Clinical Notes State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [clinicalAdvice, setClinicalAdvice] = useState('');
  const [followUpRec, setFollowUpRec] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [patientVaxSummary, setPatientVaxSummary] = useState<any>(null);
  const [doctorFollowups, setDoctorFollowups] = useState<any[]>([]);

  // Diagnostic Recommendations State
  const [showRecommendPanel, setShowRecommendPanel] = useState(false);
  const [myDiagnosticRecs, setMyDiagnosticRecs] = useState<DiagnosticRecommendation[]>([]);
  const [loadingDiagRecs, setLoadingDiagRecs] = useState(false);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const [res, flpRes] = await Promise.all([
        api.get('/telemedicine/consultations/doctor-list'),
        api.get('/follow-ups').catch(() => ({ data: [] }))
      ]);
      setConsultations(res.data || []);
      setDoctorFollowups(flpRes.data || []);
    } catch (e) {
      console.error("Failed to load doctor consultations", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnosticRecs = async () => {
    try {
      setLoadingDiagRecs(true);
      const recs = await diagnosticApi.getDoctorRecommendations();
      setMyDiagnosticRecs(recs);
    } catch { setMyDiagnosticRecs([]); }
    finally { setLoadingDiagRecs(false); }
  };

  useEffect(() => {
    fetchConsultations();
    fetchDiagnosticRecs();
  }, []);

  const loadConsultationDetails = async (id: string) => {
    try {
      const [res, msgRes] = await Promise.all([
        api.get(`/telemedicine/consultations/${id}`),
        api.get(`/telemedicine/consultations/${id}/messages`)
      ]);
      setSelectedConsultation(res.data);
      setMessages(msgRes.data);
      if (res.data.doctor_notes) setClinicalNotes(res.data.doctor_notes);
      if (res.data.doctor_advice) setClinicalAdvice(res.data.doctor_advice);
      if (res.data.follow_up_recommendation) setFollowUpRec(res.data.follow_up_recommendation);
      if (res.data.follow_up_date) setFollowUpDate(res.data.follow_up_date);

      if (res.data.patient_email) {
        api.get('/vaccinations/summary', { params: { patient_id: res.data.patient_email } })
          .then(vRes => setPatientVaxSummary(vRes.data))
          .catch(() => setPatientVaxSummary(null));
      }
    } catch (e) {
      console.error("Failed to load details", e);
    }
  };

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    setStatusMessage(null);
    try {
      const res = await api.post(`/telemedicine/consultations/${id}/accept`);
      setConsultations(prev => prev.map(c => c.consultation_id === id ? res.data : c));
      setStatusMessage(res.data.status_note || "Consultation accepted successfully.");
    } catch (err: any) {
      console.error("Accept failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.post(`/telemedicine/consultations/${id}/reject`);
      setConsultations(prev => prev.map(c => c.consultation_id === id ? res.data : c));
    } catch (err: any) {
      console.error("Reject failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedConsultation) return;
    setSavingNotes(true);
    try {
      const payload = {
        notes: clinicalNotes,
        advice: clinicalAdvice,
        follow_up_recommendation: followUpRec,
        follow_up_date: followUpDate
      };
      const res = await api.post(`/telemedicine/consultations/${selectedConsultation.consultation_id}/notes`, payload);
      setSelectedConsultation(res.data);
      setConsultations(prev => prev.map(c => c.consultation_id === res.data.consultation_id ? res.data : c));
      setStatusMessage("Consultation notes & follow-up saved successfully.");
    } catch (e) {
      console.error("Failed to save notes", e);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConsultation) return;
    try {
      const res = await api.post(`/telemedicine/consultations/${selectedConsultation.consultation_id}/messages`, {
        message: newMessage
      });
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await api.post('/telemedicine/doctor/schedule', {
        working_days: workingDays,
        start_time: startTime,
        end_time: endTime,
        telemedicine_enabled: true
      });
      setStatusMessage("Weekly availability schedule updated successfully.");
      setIsManagingSchedule(false);
    } catch (e) {
      console.error("Failed to save schedule", e);
    }
  };

  const pendingRequests = consultations.filter(c => c.status === 'PENDING');
  const acceptedConsultations = consultations.filter(c => c.status === 'ACCEPTED');
  const totalPatients = new Set(consultations.map(c => c.patient_email)).size;

  const stats = [
    { label: "Today's Consultations", value: consultations.length, sub: 'All Scheduled', icon: Calendar, color: 'text-blue-500' },
    { label: 'Pending Requests', value: pendingRequests.length, sub: 'Action Required', icon: Clock, color: 'text-amber-500' },
    { label: 'Upcoming Telemedicine', value: acceptedConsultations.length, sub: 'Confirmed Sessions', icon: Video, color: 'text-emerald-500' },
    { label: 'Total Patients', value: totalPatients, sub: 'Assigned Registry', icon: Users, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center space-x-2 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest"
          >
            <ShieldCheck size={14} />
            <span>Authenticated Doctor Node • Dr. Siddharth Sharma (MD, DM)</span>
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Good morning, <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Dr. {localStorage.getItem("userName") || "Siddharth Sharma"}</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            Specialty: <b>Cardiologist / General Surgery</b> • Facility: <b>Sanjeevani District Civil Hospital</b> • Status: <span className="text-emerald-500 font-bold">ONLINE (Verified ✅)</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsManagingSchedule(!isManagingSchedule)}
            className="px-5 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] text-xs font-bold hover:border-blue-500 transition shadow-sm flex items-center gap-2"
          >
            <Clock size={16} />
            <span>Manage Availability</span>
          </button>
          <button
            onClick={() => setShowRecommendPanel(true)}
            className="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-500/20 transition flex items-center gap-2"
          >
            <FlaskConical size={16} />
            <span>Recommend Diagnostic</span>
          </button>
          <button 
            onClick={fetchConsultations}
            className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-md"
          >
            Refresh Pipeline
          </button>
        </div>
      </div>

      {/* Doctor Schedule Management Modal/Panel */}
      <AnimatePresence>
        {isManagingSchedule && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] space-y-4 shadow-xl"
          >
            <h3 className="font-extrabold text-sm text-[var(--text-primary)] uppercase tracking-wider">
              Manage Doctor Weekly Availability & Working Hours
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Working Start Time</label>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Working End Time</label>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSaveSchedule}
                  className="w-full p-3 rounded-xl bg-emerald-600 text-white font-extrabold shadow hover:bg-emerald-700 transition"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-main)] shadow-xl relative overflow-hidden space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{stat.label}</p>
                <p className="text-3xl font-extrabold text-[var(--text-primary)]">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] ${stat.color}`}>
                <stat.icon size={22} />
              </div>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-300 text-xs font-medium flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-blue-500/20 rounded-lg"><X size={14} /></button>
        </div>
      )}

      {/* AI Triage Medical Disclaimer */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start space-x-3 text-xs leading-relaxed font-medium">
        <Info size={20} className="shrink-0 text-amber-500 mt-0.5" />
        <div>
          <strong>Clinical Disclaimer:</strong> AI-generated triage information is preliminary guidance only and does NOT constitute a formal medical diagnosis. Final clinical assessment, diagnosis, and prescription must be performed by a qualified healthcare professional.
        </div>
      </div>

      {/* DIAGNOSTIC RECOMMENDATIONS PANEL */}
      <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500 border border-violet-500/20">
              <FlaskConical size={22} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold">Diagnostic Recommendations</h3>
              <p className="text-xs text-[var(--text-secondary)]">Tests you have recommended to patients. Track their status and view uploaded reports.</p>
            </div>
          </div>
          <button
            onClick={() => setShowRecommendPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition-all"
          >
            <Plus size={14} />New Recommendation
          </button>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Pending', 'PENDING', 'text-amber-500', 'bg-amber-500/10'], ['Scheduled', 'SCHEDULED', 'text-sky-500', 'bg-sky-500/10'], ['Completed', 'COMPLETED', 'text-emerald-500', 'bg-emerald-500/10'], ['Cancelled', 'CANCELLED', 'text-slate-400', 'bg-slate-500/10']].map(([label, status, textCls, bgCls]) => (
            <div key={status} className={`p-3 rounded-2xl ${bgCls} border border-[var(--border-main)] text-center`}>
              <p className={`text-2xl font-black ${textCls}`}>{myDiagnosticRecs.filter(r => r.status === status).length}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${textCls}`}>{label}</p>
            </div>
          ))}
        </div>

        {loadingDiagRecs ? (
          <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500"></div></div>
        ) : myDiagnosticRecs.length === 0 ? (
          <div className="text-center py-10">
            <FlaskConical size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No diagnostic recommendations yet</p>
            <p className="text-xs text-slate-400 mt-1">Recommendations you issue will appear here for tracking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myDiagnosticRecs.slice(0, 8).map(rec => {
              const statusColor = { PENDING: 'text-amber-500 bg-amber-500/10', SCHEDULED: 'text-sky-500 bg-sky-500/10', COMPLETED: 'text-emerald-500 bg-emerald-500/10', CANCELLED: 'text-slate-400 bg-slate-500/10' }[rec.status] || 'text-slate-400 bg-slate-500/10';
              const priorityColor = { Routine: 'text-sky-500', Urgent: 'text-amber-500', Emergency: 'text-rose-500' }[rec.priority] || 'text-slate-400';
              return (
                <div key={rec.recommendation_id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-primary)]">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500 shrink-0"><FlaskConical size={14} /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{rec.service_name}</p>
                      <p className="text-xs text-slate-400 truncate">{rec.patient_name} • {rec.reason}</p>
                      <p className={`text-[10px] font-semibold ${priorityColor}`}>{rec.priority} • {rec.created_at_text || 'Recently'}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusColor}`}>{rec.status.charAt(0) + rec.status.slice(1).toLowerCase()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diagnostic Recommend Panel Modal */}
      <DiagnosticRecommendPanel
        isOpen={showRecommendPanel}
        onClose={() => setShowRecommendPanel(false)}
        patientEmail={selectedConsultation?.patient_email}
        patientName={selectedConsultation?.patient_name}
        consultationId={selectedConsultation?.consultation_id}
        onRecommended={fetchDiagnosticRecs}
      />

      {/* DOCTOR FOLLOW-UP MANAGEMENT PANEL */}
      <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 border border-indigo-500/20">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                Follow-Up Management
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Monitor authorized patient follow-ups, pending referrals, diagnostic reviews, and treatment outcomes.
              </p>
            </div>
          </div>

          <Link to="/follow-ups">
            <button className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow flex items-center space-x-2 transition">
              <span>Open Follow-Up Workspace</span>
              <ExternalLink size={14} />
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
            <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Today's Follow-Ups</span>
            <span className="text-2xl font-black text-amber-500">
              {doctorFollowups.filter(f => f.status === 'DUE_TODAY').length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
            <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Upcoming Reviews</span>
            <span className="text-2xl font-black text-cyan-500">
              {doctorFollowups.filter(f => f.status === 'PENDING').length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
            <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Overdue Alerts</span>
            <span className="text-2xl font-black text-rose-500">
              {doctorFollowups.filter(f => f.status === 'OVERDUE').length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
            <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Completed</span>
            <span className="text-2xl font-black text-emerald-500">
              {doctorFollowups.filter(f => f.status === 'COMPLETED').length}
            </span>
          </div>
        </div>

        {doctorFollowups.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Recent Patient Follow-Up Queue
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {doctorFollowups.slice(0, 5).map((flp: any) => (
                <div key={flp.follow_up_id} className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{flp.title}</span>
                    <p className="text-[10px] text-[var(--text-secondary)]">Patient: {flp.patient_id} • Due: {flp.due_date}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    flp.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                    flp.status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-500' :
                    flp.status === 'DUE_TODAY' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {flp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Pending & Upcoming Consultations */}
        <div className="lg:col-span-2 space-y-8">
          {/* Pending Consultation Requests */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <h3 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>Pending Consultation Requests</span>
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {pendingRequests.length} Pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No pending consultation requests at this moment.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((c) => (
                  <div key={c.consultation_id} className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-base text-[var(--text-primary)]">{c.patient_name}</h4>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          Age: {c.patient_age} • Category: {c.consultation_type} • Scheduled: {c.scheduled_time}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        c.triage_urgency === 'EMERGENCY' ? 'bg-red-500/10 text-red-600 border-red-500/30' :
                        c.triage_urgency === 'URGENT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                        'bg-blue-500/10 text-blue-600 border-blue-500/30'
                      }`}>
                        {c.triage_urgency} Risk
                      </span>
                    </div>

                    {c.triage_summary && (
                      <p className="text-xs text-[var(--text-secondary)] italic bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-main)]">
                        "{c.triage_summary}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => loadConsultationDetails(c.consultation_id)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} /> Review Patient Info
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReject(c.consultation_id)}
                          disabled={actionLoading === c.consultation_id}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 font-bold text-xs hover:bg-red-500/20 transition flex items-center gap-1"
                        >
                          <X size={14} /> Reject
                        </button>
                        <button
                          onClick={() => handleAccept(c.consultation_id)}
                          disabled={actionLoading === c.consultation_id}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoading === c.consultation_id ? (
                            <span>Creating Meeting...</span>
                          ) : (
                            <>
                              <Check size={14} /> Accept & Create Meet
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmed / Upcoming Telemedicine Consultations */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <h3 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-500" />
                <span>Confirmed Upcoming Consultations</span>
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {acceptedConsultations.length} Active
              </span>
            </div>

            {acceptedConsultations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No active confirmed consultations yet.
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedConsultations.map((c) => (
                  <div key={c.consultation_id} className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-emerald-500/30 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-base text-[var(--text-primary)]">{c.patient_name}</h4>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          Scheduled: {c.scheduled_time} • {c.consultation_type}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                        CONFIRMED
                      </span>
                    </div>

                    {(c.jitsi_meet_url || c.meeting_link || c.google_meet_url) ? (
                      <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                        <div className="text-xs font-bold text-teal-700 dark:text-teal-300">
                          Video Consultation Room Ready
                        </div>
                        <a
                          href={c.jitsi_meet_url || c.meeting_link || c.google_meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-teal-600 text-white font-extrabold text-xs shadow-md hover:bg-teal-700 transition flex items-center gap-1.5"
                        >
                          <Video size={14} /> Join Consultation Room <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium">
                        Clinic OPD Consultation Scheduled.
                      </div>
                    )}


                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => loadConsultationDetails(c.consultation_id)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} /> View Full Patient Record & Chat
                      </button>
                      <Link
                        to={`/follow-ups?patient_id=${c.patient_email}&doctor_name=${encodeURIComponent(c.doctor_name || '')}&consultation_id=${c.consultation_id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Plus size={14} /> <span>Create Follow-Up</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Authorized Patient Information & Secure Chat/Notes */}
        <div className="space-y-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 space-y-6 shadow-xl sticky top-6">
            <h3 className="text-lg font-extrabold text-[var(--text-primary)] border-b border-[var(--border-main)] pb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span>Authorized Patient Folder & Chat</span>
            </h3>

            {selectedConsultation ? (
              <div className="space-y-5 text-xs">
                {/* Patient Summary */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-2">
                  <div className="font-extrabold text-sm text-[var(--text-primary)]">
                    {selectedConsultation.patient_name}
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    Email: <b>{selectedConsultation.patient_email}</b>
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    Age: <b>{selectedConsultation.patient_age}</b>
                  </div>
                </div>

                {/* AI Triage Details */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-2">
                  <div className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[10px]">
                    AI Health Triage Summary
                  </div>
                  <div>
                    Urgency Level: <span className="font-bold text-blue-600">{selectedConsultation.triage_urgency}</span>
                  </div>
                  {selectedConsultation.triage_summary && (
                    <p className="text-[var(--text-secondary)] leading-relaxed mt-1">
                      {selectedConsultation.triage_summary}
                    </p>
                  )}
                </div>

                {/* Patient Vaccination Status for Doctor */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-transparent border border-blue-500/20 space-y-3">
                  <div className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Syringe size={14} /> Authorized Patient Vaccination Status</span>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-blue-500/10 rounded-full">Live DB</span>
                  </div>

                  {patientVaxSummary ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                        <span className="block text-[9px] text-[var(--text-secondary)] font-bold">COMPLETED</span>
                        <span className="font-extrabold text-emerald-500">{patientVaxSummary.completed}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                        <span className="block text-[9px] text-[var(--text-secondary)] font-bold">UPCOMING</span>
                        <span className="font-extrabold text-cyan-500">{patientVaxSummary.upcoming}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                        <span className="block text-[9px] text-[var(--text-secondary)] font-bold">OVERDUE</span>
                        <span className="font-extrabold text-rose-500">{patientVaxSummary.overdue}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">No vaccination records on file for patient.</p>
                  )}
                </div>

                {/* Shared Vault Medical Reports */}
                {selectedConsultation.shared_reports && selectedConsultation.shared_reports.length > 0 && (
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                    <div className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <FileUp size={12} /> Shared Vault Medical Reports ({selectedConsultation.shared_reports.length})
                    </div>
                    <div className="space-y-2">
                      {selectedConsultation.shared_reports.map((rep) => (
                        <div key={rep._id} className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)] truncate max-w-[140px]">{rep.title}</span>
                          <a 
                            href={rep.cloudinary_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                          >
                            <span>View</span> <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secure Consultation Chat Stream */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-3">
                  <div className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <MessageSquare size={12} /> Secure Consultation Messages
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {messages.length === 0 ? (
                      <p className="text-slate-400 italic text-[10px]">No chat messages exchanged yet.</p>
                    ) : (
                      messages.map((m, idx) => (
                        <div key={idx} className={`p-2 rounded-xl text-[11px] ${m.sender_role === 'doctor' ? 'bg-blue-600 text-white ml-4' : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-primary)] mr-4'}`}>
                          <div className="font-bold text-[9px] opacity-80">{m.sender_name}</div>
                          <div>{m.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type secure advice or message..."
                      className="flex-1 p-2 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none text-xs"
                    />
                    <button type="submit" className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                      <Send size={14} />
                    </button>
                  </form>
                </div>

                {/* Doctor Consultation Notes & Follow-up Form */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-3">
                  <div className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[10px]">
                    Doctor Clinical Notes & Follow-Up
                  </div>
                  <textarea
                    rows={2}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter clinical examination notes..."
                    className="w-full p-2.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none text-xs"
                  />
                  <input
                    type="text"
                    value={clinicalAdvice}
                    onChange={(e) => setClinicalAdvice(e.target.value)}
                    placeholder="Prescription / Advice summary (e.g. Tab Paracetamol 500mg TDS x 3d)..."
                    className="w-full p-2.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none text-xs"
                  />
                  {/* Quick Rx Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Quick Rx:</span>
                    {['Paracetamol 500mg', 'Amoxicillin 500mg', 'Metformin 500mg', 'Cetirizine 10mg', 'ORS Sachet'].map(med => (
                      <button
                        key={med}
                        type="button"
                        onClick={() => {
                          setClinicalAdvice(prev => prev ? `${prev}, ${med}` : med);
                        }}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 transition"
                      >
                        + {med}
                      </button>
                    ))}
                    <Link
                      to="/hospitals?tab=medicines"
                      target="_blank"
                      className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Pill size={11} /> Check Local Stock
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={followUpRec}
                      onChange={(e) => setFollowUpRec(e.target.value)}
                      placeholder="Follow-up rec (e.g. 7 days)..."
                      className="p-2 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[10px]"
                    />
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="p-2 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[10px]"
                    />
                  </div>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Save size={14} /> <span>Save Clinical Notes & Complete</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] text-slate-500 font-medium">
                  Privacy Enforced: Doctor is authorized to inspect this clinical record for remote consultation purposes only.
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-500 font-medium space-y-2">
                <UserCheck className="w-8 h-8 text-slate-400 mx-auto" />
                <p>Select any consultation request to inspect authorized patient AI triage details & clinical history.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
