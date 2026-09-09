import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, X, Search, Loader2, AlertTriangle, Send,
  ChevronDown, User, FileText, AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import diagnosticApi from '../../api/diagnosticApi';
import { CreateRecommendationPayload, RecommendationPriority, DiagnosticSuggestion } from '../../types/diagnostic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill patient email from active consultation */
  patientEmail?: string;
  patientName?: string;
  consultationId?: string;
  appointmentId?: string;
  onRecommended?: () => void;
}

const PRIORITY_CONFIG: Record<RecommendationPriority, { color: string; bg: string; label: string }> = {
  Routine: { label: 'Routine', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500' },
  Urgent: { label: 'Urgent', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500' },
  Emergency: { label: 'Emergency', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500' },
};

export default function DiagnosticRecommendPanel({ isOpen, onClose, patientEmail, patientName, consultationId, appointmentId, onRecommended }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [testQuery, setTestQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState('');
  const [suggestions, setSuggestions] = useState<DiagnosticSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [patientEmailInput, setPatientEmailInput] = useState(patientEmail || '');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<RecommendationPriority>('Routine');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (patientEmail) setPatientEmailInput(patientEmail);
  }, [patientEmail]);

  useEffect(() => {
    if (!testQuery || testQuery.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const results = await diagnosticApi.searchDiagnostics(testQuery);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
      finally { setLoadingSuggestions(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [testQuery]);

  const handleSelectTest = (name: string) => {
    setSelectedTest(name);
    setTestQuery(name);
    setShowSuggestions(false);
  };

  const handleSend = async () => {
    if (!selectedTest && !testQuery.trim()) { setError('Please enter or select a diagnostic test.'); return; }
    if (!patientEmailInput.trim()) { setError('Patient email is required.'); return; }
    if (!reason.trim()) { setError('Clinical reason is required.'); return; }
    setError(''); setSending(true);
    try {
      const payload: CreateRecommendationPayload = {
        patient_email: patientEmailInput.trim(),
        service_name: selectedTest || testQuery.trim(),
        reason: reason.trim(),
        priority,
        instructions: instructions.trim(),
        notes: notes.trim(),
        consultation_id: consultationId,
        appointment_id: appointmentId,
      };
      await diagnosticApi.createRecommendation(payload);
      setSuccess(`Diagnostic recommendation for "${payload.service_name}" sent to ${patientEmailInput}.`);
      setTestQuery(''); setSelectedTest(''); setReason(''); setInstructions(''); setNotes('');
      onRecommended?.();
      setTimeout(() => { setSuccess(''); onClose(); }, 2500);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to send recommendation. Please try again.');
    } finally { setSending(false); }
  };

  if (!isOpen) return null;

  const cardBg = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200';
  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-indigo-500`;
  const labelCls = `block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div className={`relative w-full max-w-lg rounded-3xl border shadow-2xl ${cardBg} p-6 z-10 max-h-[90vh] overflow-y-auto`}
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500/10 rounded-2xl text-violet-500"><FlaskConical size={20} /></div>
              <div>
                <h3 className="text-lg font-bold">Recommend Diagnostic Test</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Doctor-issued recommendation only</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}><X size={18} /></button>
          </div>

          {/* Success Banner */}
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm flex items-center gap-2">
              <AlertCircle size={16} />{success}
            </motion.div>
          )}

          <div className="space-y-4">
            {/* Patient */}
            <div>
              <label className={labelCls}><User size={11} className="inline mr-1" />Patient Email *</label>
              <input value={patientEmailInput} onChange={e => setPatientEmailInput(e.target.value)}
                disabled={!!patientEmail} placeholder="patient@example.com" className={`${inputCls} ${patientEmail ? 'opacity-70' : ''}`} />
              {patientName && <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{patientName}</p>}
            </div>

            {/* Test Search */}
            <div className="relative">
              <label className={labelCls}><Search size={11} className="inline mr-1" />Diagnostic Test *</label>
              <div className="relative">
                <input value={testQuery} onChange={e => { setTestQuery(e.target.value); setSelectedTest(''); }}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search: CBC, CT Scan, MRI, X-Ray…" className={inputCls} />
                {loadingSuggestions && <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500" />}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className={`absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border shadow-xl max-h-48 overflow-y-auto ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
                  {suggestions.map(s => (
                    <button key={s.service_name} onMouseDown={() => handleSelectTest(s.service_name)}
                      className={`w-full text-left px-3 py-2 text-sm flex justify-between items-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50'}`}>
                      <span>{s.service_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{s.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className={labelCls}><FileText size={11} className="inline mr-1" />Clinical Reason *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="e.g. Routine blood investigation, suspected anaemia…"
                className={`${inputCls} resize-none`} />
            </div>

            {/* Priority */}
            <div>
              <label className={labelCls}>Priority</label>
              <div className="flex gap-2">
                {(['Routine', 'Urgent', 'Emergency'] as RecommendationPriority[]).map(p => {
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <button key={p} onClick={() => setPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${priority === p ? `${cfg.bg} ${cfg.color} border-current` : isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className={labelCls}>Instructions for Patient (Optional)</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
                placeholder="e.g. Fasting 8 hours required. Bring previous reports."
                className={`${inputCls} resize-none`} />
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Doctor's Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Internal notes for record…"
                className={`${inputCls} resize-none`} />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-sm">
                <AlertTriangle size={16} />{error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                Cancel
              </button>
              <button onClick={handleSend} disabled={sending}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? 'Sending…' : 'Recommend Test'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
