import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Clock, 
  Video, 
  Building2, 
  Stethoscope, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FileText,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import api from '../../api/instance';

interface Doctor {
  doctor_id: string;
  name: string;
  email: string;
  specialization: string;
  qualification?: string;
  facility_id?: string;
  facility_name?: string;
  consultation_mode?: string;
  availability?: string;
  working_days?: string[];
  start_time?: string;
  end_time?: string;
}

interface Props {
  doctor: Doctor | null;
  onClose: () => void;
  onSuccess?: (appointment: any) => void;
  prefillSpecialty?: string;
  prefillNotes?: string;
}

export default function BookAppointmentModal({
  doctor,
  onClose,
  onSuccess,
  prefillSpecialty,
  prefillNotes
}: Props) {
  if (!doctor) return null;

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [consultationMode, setConsultationMode] = useState<'Online Video' | 'Clinic Visit'>(
    doctor.consultation_mode === 'Clinic' ? 'Clinic Visit' : 'Online Video'
  );
  const [patientNotes, setPatientNotes] = useState(prefillNotes || '');
  const [triageUrgency, setTriageUrgency] = useState('ROUTINE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
  ];

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const scheduled_time = `${selectedDate} ${selectedTime}`;
      const payload = {
        doctor_id: doctor.doctor_id,
        facility_id: doctor.facility_id || 'FAC-001',
        specialization: prefillSpecialty || doctor.specialization,
        consultation_mode: consultationMode,
        consultation_type: consultationMode,
        scheduled_time,
        patient_notes: patientNotes,
        triage_urgency: triageUrgency
      };

      const res = await api.post('/telemedicine/appointments', payload);
      setSuccessData(res.data);
      if (onSuccess) onSuccess(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit appointment request. Please choose another time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        {!successData ? (
          <form onSubmit={handleBooking} className="space-y-6">
            <div>
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-1">
                <Stethoscope size={14} />
                <span>Appointment Booking</span>
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                Book Consultation
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                Submit an appointment request. Doctor will review and confirm your slot.
              </p>
            </div>

            {/* Doctor Card Brief */}
            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                🩺
              </div>
              <div className="space-y-0.5 text-left">
                <p className="font-bold text-base text-[var(--text-primary)]">{doctor.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-teal-600 dark:text-teal-400">{doctor.specialization}</span>
                  <span>•</span>
                  <span>{doctor.qualification || 'MBBS, MD'}</span>
                </div>
                <p className="text-xs text-slate-400 flex items-center pt-1">
                  <Building2 size={12} className="mr-1" />
                  {doctor.facility_name || 'SwasthyaSetu Medical Center'}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start space-x-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 text-xs font-bold"
                >
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Consultation Mode Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                Consultation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConsultationMode('Online Video')}
                  className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                    consultationMode === 'Online Video'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'border-[var(--border-main)] text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <Video size={18} />
                  <div>
                    <p className="font-bold text-xs">🎥 Online Video</p>
                    <p className="text-[10px] opacity-70">Jitsi Meet Room</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationMode('Clinic Visit')}
                  className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                    consultationMode === 'Clinic Visit'
                      ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'border-[var(--border-main)] text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <Building2 size={18} />
                  <div>
                    <p className="font-bold text-xs">🏥 Clinic Visit</p>
                    <p className="text-[10px] opacity-70">In-Person OPD</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Date & Time Slot Picker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  Preferred Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="date"
                    required
                    min={today}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  Preferred Time Slot
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-[var(--accent-primary)]"
                  >
                    {timeSlots.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Patient Symptoms & Notes */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                Symptoms / Consultation Reason
              </label>
              <textarea 
                rows={3}
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                placeholder="Describe your health symptoms, medical history, or questions for the doctor..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl p-3 text-xs font-medium outline-none focus:border-[var(--accent-primary)] resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent-primary)] hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                <span>Send Appointment Request</span>
              </button>
            </div>
          </form>
        ) : (
          /* SUCCESS STATE */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[var(--text-primary)]">
                Appointment Requested!
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Your consultation request has been dispatched to <span className="font-bold text-[var(--text-primary)]">{doctor.name}</span>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Appointment ID:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{successData.consultation_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scheduled Time:</span>
                <span className="font-bold text-[var(--text-primary)]">{successData.scheduled_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-black uppercase text-[10px]">
                  Pending Doctor Approval
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Video Consultation:</span>
                <span className="text-slate-500 font-medium">🔒 Unlocks 30m before confirmed time</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-[var(--accent-primary)] hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-wider"
            >
              View in My Care Hub
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
