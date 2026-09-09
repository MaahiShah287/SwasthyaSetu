import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Stethoscope, 
  Building2, 
  FileText, 
  Video, 
  Filter, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  ArrowRight,
  Shield,
  Activity,
  Syringe,
  AlertCircle,
  MessageSquare,
  Sparkles,
  Loader2,
  WifiOff
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import api from '../api/instance';
import { followupApi } from '../api/followupApi';
import { useOffline } from '../context/OfflineContext';
import { 
  FollowUpRecord, 
  FollowUpSummary, 
  FollowUpType, 
  FollowUpStatus, 
  FollowUpPriority,
  CreateFollowUpInput 
} from '../types/followup';

export default function FollowUpDashboard() {
  const { theme } = useTheme();
  const { effectiveOnline } = useOffline();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<FollowUpSummary | null>(null);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'timeline' | 'all' | 'due' | 'overdue' | 'completed'>('timeline');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [explainItem, setExplainItem] = useState<FollowUpRecord | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainResult, setExplainResult] = useState<any | null>(null);
  const [showExplainModal, setShowExplainModal] = useState(false);

  // Form states
  const [completionNotes, setCompletionNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleExplainSimply = async (item: FollowUpRecord) => {
    setExplainItem(item);
    setShowExplainModal(true);
    setExplainLoading(true);
    setExplainResult(null);
    try {
      const userLang = localStorage.getItem('preferred_language') || 'mr';
      const textToExplain = item.description 
        ? `${item.title}: ${item.description}`
        : `${item.title} scheduled on ${item.due_date} with Dr. ${item.doctor_name || 'Assigned Physician'}`;
      const res = await api.post('/chatbot/explain-simply', {
        text: textToExplain,
        language: userLang
      });
      setExplainResult(res.data);
    } catch (e) {
      console.error('Explain simply error:', e);
    } finally {
      setExplainLoading(false);
    }
  };

  // Create form state
  const [newFollowUp, setNewFollowUp] = useState<CreateFollowUpInput>({
    title: '',
    description: '',
    follow_up_type: 'ROUTINE_CHECKUP',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '10:00',
    priority: 'NORMAL',
    doctor_name: '',
    hospital_name: '',
    reminder_enabled: true
  });

  const role = localStorage.getItem('userRole') || 'patient';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, listRes] = await Promise.all([
        followupApi.getSummary().catch(() => null),
        followupApi.list()
      ]);
      setSummary(sumRes);
      setFollowups(listRes);
    } catch (err: any) {
      console.error('Error fetching follow-ups:', err);
      setError(err.response?.data?.detail || 'Failed to load follow-up records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      fetchData();
    };
    window.addEventListener('swasthyasetu:sync_completed', handleSync);
    return () => window.removeEventListener('swasthyasetu:sync_completed', handleSync);
  }, []);

  // Filtered List
  const filteredFollowups = followups.filter((f) => {
    // Tab filter
    if (activeTab === 'due' && f.status !== 'DUE_TODAY') return false;
    if (activeTab === 'overdue' && f.status !== 'OVERDUE') return false;
    if (activeTab === 'completed' && f.status !== 'COMPLETED' && f.status !== 'CANCELLED') return false;

    // Type filter
    if (selectedType !== 'ALL' && f.follow_up_type !== selectedType) return false;

    // Priority filter
    if (selectedPriority !== 'ALL' && f.priority !== selectedPriority) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchDoc = (f.doctor_name || '').toLowerCase().includes(q);
      const matchHosp = (f.hospital_name || '').toLowerCase().includes(q);
      const matchDesc = (f.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDoc && !matchHosp && !matchDesc) return false;
    }

    return true;
  });

  const overdueList = followups.filter((f) => f.status === 'OVERDUE');

  // Handle Complete
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await followupApi.complete(selectedFollowUp.follow_up_id, completionNotes);
      setShowCompleteModal(false);
      setCompletionNotes('');
      setSelectedFollowUp(null);
      await fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to mark follow-up as complete.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reschedule
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp || !rescheduleDate) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await followupApi.reschedule(selectedFollowUp.follow_up_id, {
        new_due_date: rescheduleDate,
        new_due_time: rescheduleTime
      });
      setShowRescheduleModal(false);
      setSelectedFollowUp(null);
      await fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to reschedule follow-up.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel
  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this follow-up?')) return;
    try {
      await followupApi.cancel(id, 'Cancelled by user');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel follow-up.');
    }
  };

  // Handle Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await followupApi.create(newFollowUp);
      setShowCreateModal(false);
      setNewFollowUp({
        title: '',
        description: '',
        follow_up_type: 'ROUTINE_CHECKUP',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '10:00',
        priority: 'NORMAL',
        doctor_name: '',
        hospital_name: '',
        reminder_enabled: true
      });
      await fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to create follow-up.');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadge = (p: FollowUpPriority) => {
    switch (p) {
      case 'URGENT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">URGENT</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">HIGH</span>;
      case 'NORMAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">NORMAL</span>;
      case 'LOW':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/20">LOW</span>;
    }
  };

  const getStatusBadge = (s: FollowUpStatus) => {
    switch (s) {
      case 'DUE_TODAY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1"><Clock size={12} /> DUE TODAY</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm flex items-center gap-1"><AlertTriangle size={12} /> OVERDUE</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 size={12} /> COMPLETED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center gap-1"><XCircle size={12} /> CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1"><Calendar size={12} /> PENDING</span>;
    }
  };

  const getTypeIcon = (t: FollowUpType) => {
    switch (t) {
      case 'DOCTOR_VISIT':
        return <Stethoscope className="text-blue-500" size={18} />;
      case 'TELEMEDICINE':
        return <Video className="text-purple-500" size={18} />;
      case 'REFERRAL':
        return <ArrowRight className="text-indigo-500" size={18} />;
      case 'LAB_TEST':
      case 'DIAGNOSTIC_REVIEW':
        return <FileText className="text-emerald-500" size={18} />;
      case 'POST_DISCHARGE':
        return <Building2 className="text-rose-500" size={18} />;
      case 'TREATMENT_REVIEW':
      case 'MEDICATION_REVIEW':
        return <Activity className="text-cyan-500" size={18} />;
      default:
        return <Calendar className="text-blue-500" size={18} />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500">
              <Calendar size={28} />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Follow-Up & <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Care Plan</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Automated continuum of care: appointments, referrals, lab tests, and clinical reviews.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-300"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <Plus size={18} />
            <span>New Follow-Up</span>
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4 className="font-bold text-base">
                {overdueList.length} Follow-Up{overdueList.length > 1 ? 's' : ''} Overdue
              </h4>
              <p className="text-xs text-rose-400 dark:text-rose-300 mt-0.5">
                Attention required: Overdue clinical follow-ups may affect care continuity. Please contact your healthcare provider.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('overdue')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all shadow"
          >
            View Overdue Alerts
          </button>
        </motion.div>
      )}

      {/* Offline Mode Banner */}
      {!effectiveOnline && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-3">
            <WifiOff size={20} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Offline Care Plan Mode:</span> Showing locally cached snapshots. Changes and new notes are queued in IndexedDB and will auto-sync upon reconnection.
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider border border-amber-500/40 shrink-0">
            Local Cache
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Total', value: summary?.total ?? followups.length, icon: Calendar, color: 'text-blue-500' },
          { label: 'Due Today', value: summary?.due_today ?? 0, icon: Clock, color: 'text-amber-500' },
          { label: 'Upcoming', value: summary?.upcoming ?? 0, icon: Activity, color: 'text-cyan-500' },
          { label: 'Overdue', value: summary?.overdue ?? overdueList.length, icon: AlertTriangle, color: 'text-rose-500' },
          { label: 'Completed', value: summary?.completed ?? 0, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Referrals', value: summary?.pending_referrals ?? 0, icon: ArrowRight, color: 'text-indigo-500' },
          { label: 'Lab Reports', value: summary?.pending_reports ?? 0, icon: FileText, color: 'text-purple-500' },
          { label: 'Treatments', value: summary?.treatment_followups ?? 0, icon: Stethoscope, color: 'text-teal-500' }
        ].map((item, idx) => (
          <div 
            key={idx} 
            className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
              <item.icon size={16} className={item.color} />
            </div>
            <div className={`text-2xl font-black ${item.color}`}>
              {loading ? <Skeleton className="h-7 w-12" /> : item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-2 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-md">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'timeline', label: 'Care Timeline' },
            { id: 'all', label: 'All Follow-Ups' },
            { id: 'due', label: 'Due Today' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'History' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, doctor, facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="DOCTOR_VISIT">Doctor Visit</option>
            <option value="TREATMENT_REVIEW">Treatment Review</option>
            <option value="REFERRAL">Referral</option>
            <option value="LAB_TEST">Lab Test</option>
            <option value="DIAGNOSTIC_REVIEW">Diagnostic Review</option>
            <option value="TELEMEDICINE">Telemedicine</option>
            <option value="POST_DISCHARGE">Post Discharge</option>
            <option value="ROUTINE_CHECKUP">Routine Checkup</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-500">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-80" />
          <h4 className="font-bold text-lg">Unable to Load Follow-Ups</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : activeTab === 'timeline' ? (
        /* Visual Care Pathway Timeline View */
        <div className="space-y-6">
          <div className="p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl">
            <h3 className="text-lg font-bold flex items-center space-x-2 mb-6">
              <Activity className="text-blue-500" size={20} />
              <span>Care Pathway Sequence</span>
            </h3>

            {/* Stage Indicator Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">
              {[
                { stage: '1. Consultation', icon: Stethoscope, active: true },
                { stage: '2. Referral', icon: ArrowRight, active: true },
                { stage: '3. Diagnostic', icon: FileText, active: true },
                { stage: '4. Treatment', icon: Activity, active: true },
                { stage: '5. Follow-Up', icon: Calendar, active: true },
                { stage: '6. Completed', icon: CheckCircle2, active: true },
                { stage: '7. Next Plan', icon: Shield, active: true }
              ].map((st, i) => (
                <div 
                  key={i} 
                  className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center flex flex-col items-center justify-center space-y-1"
                >
                  <st.icon size={16} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{st.stage}</span>
                </div>
              ))}
            </div>

            {/* Timeline Cards */}
            {filteredFollowups.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Calendar size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">No follow-ups found in this pathway.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-blue-700 transition"
                >
                  Schedule New Follow-Up
                </button>
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-blue-500/30 space-y-6">
                {filteredFollowups.map((item) => (
                  <div key={item.follow_up_id} className="relative group">
                    {/* Circle bullet */}
                    <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${
                      item.status === 'COMPLETED' ? 'border-emerald-500 bg-emerald-500' :
                      item.status === 'OVERDUE' ? 'border-rose-500 bg-rose-500' :
                      item.status === 'DUE_TODAY' ? 'border-amber-500 bg-amber-500' : 'border-blue-500'
                    }`} />

                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
                            {getTypeIcon(item.follow_up_type)}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              {item.follow_up_type.replace('_', ' ')}
                            </span>
                            <h4 className="font-bold text-base text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {getPriorityBadge(item.priority)}
                          {getStatusBadge(item.status)}
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                          {item.description}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center space-x-1">
                          <Clock size={14} className="text-blue-500" />
                          <span>Due: <strong>{item.due_date}</strong> {item.due_time && `at ${item.due_time}`}</span>
                        </div>

                        {item.doctor_name && (
                          <div className="flex items-center space-x-1">
                            <Stethoscope size={14} className="text-purple-500" />
                            <span>Dr. {item.doctor_name}</span>
                          </div>
                        )}

                        {item.hospital_name && (
                          <div className="flex items-center space-x-1">
                            <Building2 size={14} className="text-teal-500" />
                            <span>{item.hospital_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Overdue Action Banner inside card */}
                      {item.status === 'OVERDUE' && (
                        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
                          <span className="font-semibold">Overdue by {item.days_overdue || 1} day(s). Please contact your provider.</span>
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                        <button
                          onClick={() => {
                            setSelectedFollowUp(item);
                            setShowDetailModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition"
                        >
                          View Details
                        </button>

                        <button
                          onClick={() => handleExplainSimply(item)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/30 text-xs font-bold hover:bg-blue-100 dark:hover:bg-cyan-500/20 transition flex items-center space-x-1"
                        >
                          <Sparkles size={12} />
                          <span>सोप्या भाषेत समजा (Explain Simply)</span>
                        </button>

                        {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedFollowUp(item);
                                setShowCompleteModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-sm"
                            >
                              Mark Completed
                            </button>

                            <button
                              onClick={() => {
                                setSelectedFollowUp(item);
                                setRescheduleDate(item.due_date);
                                setRescheduleTime(item.due_time || '10:00');
                                setShowRescheduleModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition shadow-sm"
                            >
                              Reschedule
                            </button>

                            <button
                              onClick={() => handleCancel(item.follow_up_id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-semibold hover:bg-rose-500/20 transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {/* Cross-module links */}
                        {(item.follow_up_type === 'TELEMEDICINE' || item.appointment_id) && (
                          <Link
                            to="/doctors"
                            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center space-x-1"
                          >
                            <Video size={12} />
                            <span>Open Telemedicine</span>
                          </Link>
                        )}

                        {item.medical_record_id && (
                          <Link
                            to="/reports"
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition flex items-center space-x-1"
                          >
                            <FileText size={12} />
                            <span>View Linked Report</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid View for All / Due / Overdue / History Tabs */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFollowups.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-white/10">
              <Calendar size={48} className="mx-auto mb-3 opacity-30" />
              <h4 className="font-bold text-base text-slate-600 dark:text-slate-300">No Records Found</h4>
              <p className="text-xs text-slate-400 mt-1">There are no follow-ups matching the selected criteria.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow hover:bg-blue-700 transition"
              >
                Create Follow-Up
              </button>
            </div>
          ) : (
            filteredFollowups.map((item) => (
              <div
                key={item.follow_up_id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
                        {getTypeIcon(item.follow_up_type)}
                      </div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        {item.follow_up_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getPriorityBadge(item.priority)}
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                    {item.title}
                  </h4>

                  {item.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <div className="flex items-center space-x-1">
                      <Clock size={13} className="text-blue-500" />
                      <span>Due: <strong>{item.due_date}</strong> {item.due_time}</span>
                    </div>

                    {item.doctor_name && (
                      <div className="flex items-center space-x-1">
                        <Stethoscope size={13} className="text-purple-500" />
                        <span>Doctor: Dr. {item.doctor_name}</span>
                      </div>
                    )}

                    {item.hospital_name && (
                      <div className="flex items-center space-x-1">
                        <Building2 size={13} className="text-teal-500" />
                        <span>Hospital: {item.hospital_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedFollowUp(item);
                      setShowDetailModal(true);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                  >
                    View Details →
                  </button>

                  {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedFollowUp(item);
                          setShowCompleteModal(true);
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-sm"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => {
                          setSelectedFollowUp(item);
                          setRescheduleDate(item.due_date);
                          setRescheduleTime(item.due_time || '10:00');
                          setShowRescheduleModal(true);
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition shadow-sm"
                      >
                        Reschedule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative"
            >
              <h3 className="text-xl font-extrabold mb-4">Create New Follow-Up</h3>

              {actionError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Post-Consultation Cardiology Review"
                    value={newFollowUp.title}
                    onChange={(e) => setNewFollowUp({ ...newFollowUp, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Type</label>
                    <select
                      value={newFollowUp.follow_up_type}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, follow_up_type: e.target.value as FollowUpType })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ROUTINE_CHECKUP">Routine Checkup</option>
                      <option value="DOCTOR_VISIT">Doctor Visit</option>
                      <option value="TREATMENT_REVIEW">Treatment Review</option>
                      <option value="REFERRAL">Referral Follow-Up</option>
                      <option value="LAB_TEST">Lab Test</option>
                      <option value="DIAGNOSTIC_REVIEW">Diagnostic Review</option>
                      <option value="TELEMEDICINE">Telemedicine</option>
                      <option value="POST_DISCHARGE">Post Discharge</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Priority</label>
                    <select
                      value={newFollowUp.priority}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, priority: e.target.value as FollowUpPriority })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Due Date</label>
                    <input
                      type="date"
                      required
                      value={newFollowUp.due_date}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, due_date: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Due Time</label>
                    <input
                      type="time"
                      value={newFollowUp.due_time}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, due_time: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Doctor Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Dr. Siddharth Sharma"
                      value={newFollowUp.doctor_name || ''}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, doctor_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Hospital Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Sanjeevani Civil Hospital"
                      value={newFollowUp.hospital_name || ''}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, hospital_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Description / Clinical Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Instructions, symptoms to monitor, or preparation details..."
                    value={newFollowUp.description || ''}
                    onChange={(e) => setNewFollowUp({ ...newFollowUp, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={newFollowUp.reminder_enabled}
                      onChange={(e) => setNewFollowUp({ ...newFollowUp, reminder_enabled: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enable Automated Reminders</span>
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow"
                  >
                    {actionLoading ? 'Saving...' : 'Create Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {showDetailModal && selectedFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedFollowUp.follow_up_type.replace('_', ' ')}</span>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{selectedFollowUp.title}</h3>
                </div>
                {getStatusBadge(selectedFollowUp.status)}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-400">Follow-Up ID:</span>
                  <span className="font-mono font-semibold">{selectedFollowUp.follow_up_id}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-400">Due Date & Time:</span>
                  <span className="font-semibold">{selectedFollowUp.due_date} at {selectedFollowUp.due_time || '10:00'}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-slate-400">Priority Level:</span>
                  {getPriorityBadge(selectedFollowUp.priority)}
                </div>

                {selectedFollowUp.doctor_name && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span className="text-slate-400">Assigned Doctor:</span>
                    <span className="font-semibold text-purple-400">Dr. {selectedFollowUp.doctor_name}</span>
                  </div>
                )}

                {selectedFollowUp.hospital_name && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span className="text-slate-400">Assigned Hospital:</span>
                    <span className="font-semibold text-teal-400">{selectedFollowUp.hospital_name}</span>
                  </div>
                )}

                {selectedFollowUp.description && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span className="text-slate-400 block mb-1 font-semibold">Clinical Description:</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedFollowUp.description}</p>
                  </div>
                )}

                {selectedFollowUp.completion_notes && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                    <span className="block mb-1 font-semibold">Completion Outcome / Notes:</span>
                    <p className="leading-relaxed">{selectedFollowUp.completion_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLETE MODAL */}
      <AnimatePresence>
        {showCompleteModal && selectedFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-xl font-extrabold mb-2">Complete Follow-Up</h3>
              <p className="text-xs text-slate-500 mb-4">
                Marking <strong>{selectedFollowUp.title}</strong> as completed.
              </p>

              {actionError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Outcome / Completion Notes</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter clinical notes, test outcome, or summary..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCompleteModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow"
                  >
                    {actionLoading ? 'Saving...' : 'Confirm Completion'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESCHEDULE MODAL */}
      <AnimatePresence>
        {showRescheduleModal && selectedFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-xl font-extrabold mb-2">Reschedule Follow-Up</h3>
              <p className="text-xs text-slate-500 mb-4">
                Update target date for <strong>{selectedFollowUp.title}</strong>.
              </p>

              {actionError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">New Due Date</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">New Due Time</label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow"
                  >
                    {actionLoading ? 'Saving...' : 'Confirm Reschedule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPLAIN SIMPLY MODAL */}
      <AnimatePresence>
        {showExplainModal && explainItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-500/20 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      सोप्या भाषेत स्पष्टीकरण (Explain Simply)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {explainItem.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExplainModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs">
                {explainLoading && (
                  <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                    <span>AI डॉक्टरांच्या सूचनांचे साध्या भाषेत रूपांतर करत आहे...</span>
                  </div>
                )}

                {explainResult && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-cyan-950/20 border border-blue-200 dark:border-cyan-500/30">
                      <h4 className="font-extrabold text-xs text-blue-900 dark:text-cyan-300 mb-1">
                        {explainResult.simplified_title || 'डॉक्टरांच्या सूचनांचा अर्थ:'}
                      </h4>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                        {explainResult.simplified_explanation}
                      </p>
                    </div>

                    {explainResult.what_you_need_to_do && explainResult.what_you_need_to_do.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-black text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          तुम्हाला काय करायचे आहे:
                        </p>
                        <ul className="space-y-1">
                          {explainResult.what_you_need_to_do.map((step: string, sIdx: number) => (
                            <li key={sIdx} className="flex items-start space-x-2">
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-slate-700 dark:text-slate-300">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explainResult.preserved_critical_details && explainResult.preserved_critical_details.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                          महत्त्वाचा तपशील (Unchanged Clinical Data):
                        </span>
                        <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
                          {explainResult.preserved_critical_details.join(', ')}
                        </span>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100 dark:border-white/5">
                      {explainResult.disclaimer}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowExplainModal(false)}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md hover:bg-blue-700 transition"
                >
                  समजले (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
