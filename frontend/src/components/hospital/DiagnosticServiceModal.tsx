import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FlaskConical, Clock, DollarSign, CheckCircle2,
  AlertTriangle, XCircle, Calendar, Info, Plus, Save, Loader2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import diagnosticApi from '../../api/diagnosticApi';
import {
  DiagnosticService,
  DiagnosticAvailability,
  AddDiagnosticServicePayload,
  UpdateDiagnosticServicePayload
} from '../../types/diagnostic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingService?: DiagnosticService | null;
}

const COMMON_TESTS = [
  'Complete Blood Count (CBC)', 'Blood Glucose (Fasting/PP)', 'Lipid Profile',
  'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Thyroid Profile (T3/T4/TSH)',
  'Urine Routine Examination', 'HbA1c', 'Malaria Test (RDT/Smear)', 'Dengue NS1 / IgM / IgG',
  'X-Ray (Chest / Bone)', 'Ultrasound (Abdomen/Pelvis)', 'CT Scan', 'MRI',
  'Echocardiography (ECHO)', 'ECG (Electrocardiogram)', 'Stress Test (TMT)',
  'Spirometry (Lung Function)', 'Endoscopy (Upper GI)', 'Eye Examination (Retinoscopy)',
];

const CATEGORIES = ['Pathology', 'Radiology', 'Cardiology', 'Pulmonology', 'Gastroenterology', 'Ophthalmology', 'General'];

const STATUS_CONFIG: Record<DiagnosticAvailability, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  AVAILABLE: { label: 'Available', color: 'text-emerald-500', icon: CheckCircle2 },
  LIMITED: { label: 'Limited', color: 'text-amber-500', icon: AlertTriangle },
  UNAVAILABLE: { label: 'Unavailable', color: 'text-rose-500', icon: XCircle },
};

export default function DiagnosticServiceModal({ isOpen, onClose, onSaved, editingService }: Props) {
  const { theme } = useTheme();
  const isEdit = !!editingService;

  const [serviceName, setServiceName] = useState(editingService?.service_name || '');
  const [category, setCategory] = useState(editingService?.category || 'Pathology');
  const [availability, setAvailability] = useState<DiagnosticAvailability>(editingService?.availability || 'AVAILABLE');
  const [appointmentRequired, setAppointmentRequired] = useState(editingService?.appointment_required ?? false);
  const [operatingHours, setOperatingHours] = useState(editingService?.operating_hours || '09:00 - 17:00');
  const [priceInr, setPriceInr] = useState(editingService?.price_inr || 'N/A');
  const [notes, setNotes] = useState(editingService?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = COMMON_TESTS.filter(t =>
    serviceName.length > 0 && t.toLowerCase().includes(serviceName.toLowerCase()) && t !== serviceName
  );

  const handleSave = async () => {
    if (!serviceName.trim()) { setError('Service name is required.'); return; }
    setError(''); setSaving(true);
    try {
      if (isEdit && editingService) {
        const payload: UpdateDiagnosticServicePayload = { availability, appointment_required: appointmentRequired, operating_hours: operatingHours, price_inr: priceInr, notes };
        await diagnosticApi.updateService(editingService.service_id, payload);
      } else {
        const payload: AddDiagnosticServicePayload = { service_name: serviceName.trim(), category, availability, appointment_required: appointmentRequired, operating_hours: operatingHours, price_inr: priceInr, notes };
        await diagnosticApi.addService(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200';
  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`;
  const labelCls = `block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className={`relative w-full max-w-lg rounded-3xl border shadow-2xl ${cardBg} p-6 z-10 max-h-[90vh] overflow-y-auto`}
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-500">
                <FlaskConical size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{isEdit ? 'Edit Diagnostic Service' : 'Add Diagnostic Service'}</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isEdit ? 'Update service availability and details' : 'Add a service your facility provides'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Service Name */}
            {!isEdit && (
              <div className="relative">
                <label className={labelCls}>Diagnostic Test Name *</label>
                <input
                  value={serviceName}
                  onChange={e => { setServiceName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="e.g. CT Scan, CBC, MRI…"
                  className={inputCls}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border shadow-xl max-h-52 overflow-y-auto ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                    {filteredSuggestions.map(s => (
                      <button key={s} onMouseDown={() => { setServiceName(s); setShowSuggestions(false); }}
                        className={`w-full text-left px-3 py-2 text-sm ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50'}`}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isEdit && (
              <div>
                <label className={labelCls}>Diagnostic Test</label>
                <div className={`px-3 py-2 rounded-xl border text-sm font-semibold ${isDark ? 'bg-slate-800 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  {editingService?.service_name}
                </div>
              </div>
            )}

            {/* Category */}
            {!isEdit && (
              <div>
                <label className={labelCls}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Availability */}
            <div>
              <label className={labelCls}>Availability Status</label>
              <div className="flex gap-2">
                {(['AVAILABLE', 'LIMITED', 'UNAVAILABLE'] as DiagnosticAvailability[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  const active = availability === s;
                  return (
                    <button key={s} onClick={() => setAvailability(s)}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${active
                        ? s === 'AVAILABLE' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                          : s === 'LIMITED' ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                            : 'border-rose-500 bg-rose-500/10 text-rose-500'
                        : isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}>
                      <Icon size={16} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Appointment Required */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                <label className="text-sm font-semibold">Appointment Required</label>
              </div>
              <button onClick={() => setAppointmentRequired(p => !p)}
                className={`relative w-12 h-6 rounded-full transition-colors ${appointmentRequired ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow ${appointmentRequired ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Operating Hours */}
            <div>
              <label className={labelCls}><Clock size={12} className="inline mr-1" />Operating Hours</label>
              <input value={operatingHours} onChange={e => setOperatingHours(e.target.value)} placeholder="e.g. 08:00 - 18:00" className={inputCls} />
            </div>

            {/* Price */}
            <div>
              <label className={labelCls}><DollarSign size={12} className="inline mr-1" />Price / Charges</label>
              <input value={priceInr} onChange={e => setPriceInr(e.target.value)} placeholder="e.g. ₹500 or Free (Govt)" className={inputCls} />
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}><Info size={12} className="inline mr-1" />Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special requirements, preparation notes…"
                className={`${inputCls} resize-none`} />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-sm">
                <AlertTriangle size={16} />{error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : isEdit ? <Save size={16} /> : <Plus size={16} />}
                {saving ? 'Saving…' : isEdit ? 'Update Service' : 'Add Service'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
