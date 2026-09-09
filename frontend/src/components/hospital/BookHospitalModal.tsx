import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Building2, 
  Calendar, 
  Clock, 
  Bed, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Phone,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import api from '../../api/instance';

interface Facility {
  facility_id: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  departments?: string[];
  bed_capacity?: {
    general_available?: number;
    icu_available?: number;
    emergency_available?: number;
  };
  available_beds?: number;
  icu_beds_available?: number;
  emergency_beds?: number;
  emergency_24_7?: boolean;
}

interface Props {
  facility: Facility | null;
  onClose: () => void;
  onSuccess?: () => void;
  prefillBookingType?: string;
}

export default function BookHospitalModal({
  facility,
  onClose,
  onSuccess,
  prefillBookingType
}: Props) {
  if (!facility) return null;

  const today = new Date().toISOString().split('T')[0];
  const [bookingType, setBookingType] = useState(prefillBookingType || 'OPD Appointment');
  const [department, setDepartment] = useState(
    facility.departments && facility.departments.length > 0 ? facility.departments[0] : 'General Medicine'
  );
  const [preferredDate, setPreferredDate] = useState(today);
  const [preferredTime, setPreferredTime] = useState('10:00 AM');
  const [medicalReason, setMedicalReason] = useState('');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        facility_id: facility.facility_id,
        booking_type: bookingType,
        department,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        medical_reason: medicalReason || 'Clinical Evaluation',
        urgency: bookingType.includes('Emergency') ? 'EMERGENCY' : urgency
      };

      const res = await api.post('/hospitals/book-slot', payload);
      setSuccessData(res.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit hospital slot reservation. Please check availability.');
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
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">
                <Building2 size={14} />
                <span>Hospital Admission & OPD Reservation</span>
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                Book Hospital Slot
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                Reserve an outpatient consultation or emergency bed at {facility.name}.
              </p>
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

            {/* Booking Type Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                Reservation Category
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'OPD Appointment', label: '🩺 OPD Consultation', sub: 'Scheduled visit' },
                  { id: 'Emergency Bed Admission', label: '🚨 Emergency Bed', sub: 'Immediate triage' },
                  { id: 'ICU Reservation', label: '🛏️ ICU Bed Slot', sub: 'Critical care' },
                  { id: 'Diagnostic Test', label: '🔬 Diagnostic Lab', sub: 'Pathology & Scan' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBookingType(cat.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      bookingType === cat.id
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'border-[var(--border-main)] text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    <p className="font-bold text-xs">{cat.label}</p>
                    <p className="text-[10px] opacity-70">{cat.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Department Selection */}
            {facility.departments && facility.departments.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  Target Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 px-3.5 text-xs font-bold outline-none focus:border-indigo-500"
                >
                  {facility.departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date & Time */}
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
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-indigo-500"
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
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '04:00 PM', 'Emergency Arrival'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Medical Reason */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                Medical Reason / Admission Notes
              </label>
              <textarea 
                rows={3}
                value={medicalReason}
                onChange={(e) => setMedicalReason(e.target.value)}
                placeholder="Reason for consultation or admission request..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl p-3 text-xs font-medium outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              <span>Confirm Hospital Reservation</span>
            </button>
          </form>
        ) : (
          /* SUCCESS STATE */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[var(--text-primary)]">
                Slot Reserved!
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Your hospital request at <span className="font-bold text-[var(--text-primary)]">{facility.name}</span> has been processed.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Booking ID:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{successData.booking?.booking_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{successData.booking?.booking_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Department:</span>
                <span className="font-bold text-[var(--text-primary)]">{successData.booking?.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date:</span>
                <span className="font-bold text-[var(--text-primary)]">{successData.booking?.preferred_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black uppercase text-[10px]">
                  Confirmed & Notified
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
