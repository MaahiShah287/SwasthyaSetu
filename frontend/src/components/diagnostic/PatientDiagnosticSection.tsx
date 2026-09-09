import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FlaskConical, Search, MapPin, Clock, CheckCircle2,
  AlertTriangle, XCircle, ChevronRight, ExternalLink,
  Loader2, RefreshCw, Calendar, Sparkles
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import diagnosticApi from '../../api/diagnosticApi';
import { DiagnosticRecommendation, RecommendationStatus } from '../../types/diagnostic';

const STATUS_CONFIG: Record<RecommendationStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  PENDING: { label: 'Pending', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertTriangle },
  SCHEDULED: { label: 'Scheduled', color: 'text-sky-500', bg: 'bg-sky-500/10', icon: Calendar },
  COMPLETED: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: XCircle },
};

const PRIORITY_COLOR: Record<string, string> = {
  Routine: 'text-sky-500 bg-sky-500/10',
  Urgent: 'text-amber-500 bg-amber-500/10',
  Emergency: 'text-rose-500 bg-rose-500/10',
};

interface Props {
  compact?: boolean;
}

export default function PatientDiagnosticSection({ compact = false }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [recs, setRecs] = useState<DiagnosticRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRecs = async () => {
    try {
      setLoading(true);
      const data = await diagnosticApi.getMyRecommendations();
      setRecs(data);
    } catch { setRecs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecs(); }, []);

  const handleMarkScheduled = async (rec: DiagnosticRecommendation) => {
    setUpdatingId(rec.recommendation_id);
    try {
      await diagnosticApi.updateRecommendationStatus(rec.recommendation_id, 'SCHEDULED');
      setRecs(prev => prev.map(r => r.recommendation_id === rec.recommendation_id ? { ...r, status: 'SCHEDULED' } : r));
    } catch { } finally { setUpdatingId(null); }
  };

  const handleMarkCompleted = async (rec: DiagnosticRecommendation) => {
    setUpdatingId(rec.recommendation_id);
    try {
      await diagnosticApi.updateRecommendationStatus(rec.recommendation_id, 'COMPLETED');
      setRecs(prev => prev.map(r => r.recommendation_id === rec.recommendation_id ? { ...r, status: 'COMPLETED' } : r));
    } catch { } finally { setUpdatingId(null); }
  };

  const filteredRecs = statusFilter === 'ALL' ? recs : recs.filter(r => r.status === statusFilter);
  const pendingCount = recs.filter(r => r.status === 'PENDING').length;

  const cardBg = isDark ? 'bg-slate-800/60 border-white/10' : 'bg-white border-slate-200';
  const badgeCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-bold transition-all ${active
      ? 'bg-indigo-600 text-white'
      : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
    }`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 rounded-2xl text-violet-500">
            <FlaskConical size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Diagnostic Services</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {pendingCount > 0 ? `${pendingCount} pending recommendation${pendingCount > 1 ? 's' : ''}` : 'Doctor-recommended tests'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRecs} className={`p-2 rounded-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            to="/hospitals?tab=diagnostics"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors"
          >
            <Search size={13} />Find Diagnostic Centre
          </Link>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={badgeCls(statusFilter === s)}>
            {s === 'ALL' ? 'All' : STATUS_CONFIG[s as RecommendationStatus]?.label || s}
            {s === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : filteredRecs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`text-center py-10 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <FlaskConical size={32} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {statusFilter === 'ALL' ? 'No diagnostic recommendations yet' : `No ${statusFilter.toLowerCase()} recommendations`}
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Your doctor will recommend tests when needed during consultation.
          </p>
          <Link to="/hospitals?tab=diagnostics"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            <MapPin size={13} />Browse Diagnostic Centres
          </Link>
        </motion.div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {filteredRecs.map((rec, idx) => {
              const statusCfg = STATUS_CONFIG[rec.status];
              const StatusIcon = statusCfg.icon;
              const isUpdating = updatingId === rec.recommendation_id;
              const priorityStyle = PRIORITY_COLOR[rec.priority] || PRIORITY_COLOR.Routine;

              return (
                <motion.div key={rec.recommendation_id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className={`rounded-2xl border p-4 ${cardBg}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Test + Status */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-500 shrink-0">
                          <FlaskConical size={14} />
                        </div>
                        <span className="font-bold text-sm">{rec.service_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${priorityStyle}`}>
                          {rec.priority}
                        </span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon size={11} />{statusCfg.label}
                        </span>
                      </div>

                      {/* Doctor + Reason */}
                      <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="font-semibold">By: </span>{rec.doctor_name}
                        {rec.category && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>{rec.category}</span>}
                      </p>
                      <p className={`text-xs mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <span className="font-semibold">Reason: </span>{rec.reason}
                      </p>
                      {rec.instructions && (
                        <div className={`flex items-start gap-1.5 text-xs rounded-lg p-2 mb-2 ${isDark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                          <Sparkles size={12} className="mt-0.5 shrink-0" />
                          <span><strong>Instructions:</strong> {rec.instructions}</span>
                        </div>
                      )}
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <Clock size={10} className="inline mr-1" />{rec.created_at_text || 'Recently'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {(rec.status === 'PENDING' || rec.status === 'SCHEDULED') && (
                        <Link
                          to={`/hospitals?tab=diagnostics&test=${encodeURIComponent(rec.service_name)}`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors whitespace-nowrap"
                        >
                          <MapPin size={12} />Find Centre
                        </Link>
                      )}
                      {rec.status === 'PENDING' && (
                        <button onClick={() => handleMarkScheduled(rec)} disabled={isUpdating}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${isDark ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200'}`}>
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                          Mark Scheduled
                        </button>
                      )}
                      {rec.status === 'SCHEDULED' && (
                        <button onClick={() => handleMarkCompleted(rec)} disabled={isUpdating}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${isDark ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Mark Completed
                        </button>
                      )}
                      {rec.status === 'COMPLETED' && (
                        <Link to="/upload"
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          <ExternalLink size={12} />Upload Report
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
