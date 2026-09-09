import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Syringe, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  ShieldCheck, 
  Building2, 
  FileText, 
  Download, 
  Edit3, 
  Trash2, 
  Bell, 
  Stethoscope, 
  ExternalLink, 
  Info, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle,
  X,
  User,
  Sparkles,
  Baby,
  ChevronDown,
  Navigation,
  HelpCircle,
  MapPin,
  Bot
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/instance';
import vaccinationApi, { Child, ChildSchedule, VaccineItem } from '../api/vaccinationApi';
import Skeleton from '../components/ui/Skeleton';

export default function VaccinationHub() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Children State
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [schedule, setSchedule] = useState<ChildSchedule | null>(null);
  const [nextVaccine, setNextVaccine] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);

  // Loading States
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedVaccineForRecord, setSelectedVaccineForRecord] = useState<VaccineItem | null>(null);

  // Form States
  const [childForm, setChildForm] = useState({
    name: '',
    date_of_birth: new Date().toISOString().split('T')[0],
    gender: 'boy',
    location: '',
    district: '',
    state: '',
    is_je_endemic: false
  });

  const [recordForm, setRecordForm] = useState({
    administered_date: new Date().toISOString().split('T')[0],
    facility_name: '',
    facility_id: '',
    notes: '',
    dose: ''
  });

  // AI Assistant State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Active Milestone Accordion State
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);
      const list = await vaccinationApi.getChildren();
      setChildren(list);
      if (list.length > 0) {
        setSelectedChild(list[0]);
        loadChildSchedule(list[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch children list:", err);
    } finally {
      setLoadingChildren(false);
    }
  };

  const loadChildSchedule = async (childId: string) => {
    try {
      setLoadingSchedule(true);
      const [schedData, nextData, gapData] = await Promise.all([
        vaccinationApi.getChildSchedule(childId),
        vaccinationApi.getNextVaccination(childId),
        vaccinationApi.getChildGaps(childId)
      ]);

      setSchedule(schedData);
      setNextVaccine(nextData.has_next ? nextData.next_vaccination : null);
      setGaps(gapData.gaps || []);

      // Default expand milestones that have DUE or OVERDUE or AT_BIRTH
      const initialExpand: Record<string, boolean> = {};
      schedData.timeline.forEach(ms => {
        const hasDueOrOverdue = ms.vaccines.some(v => v.status === 'DUE' || v.status === 'OVERDUE' || (ms.milestone_id === 'AT_BIRTH' && schedData.age_info?.is_newborn));
        initialExpand[ms.milestone_id] = hasDueOrOverdue || ms.milestone_id === 'AT_BIRTH';
      });
      setExpandedMilestones(initialExpand);
    } catch (err) {
      console.error("Failed to load child schedule:", err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSelectChild = (child: Child) => {
    setSelectedChild(child);
    loadChildSchedule(child.id);
  };

  const handleAddChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childForm.name.trim()) return;
    try {
      setSubmitting(true);
      const newChild = await vaccinationApi.createChild(childForm);
      setIsAddChildModalOpen(false);
      setChildForm({
        name: '',
        date_of_birth: new Date().toISOString().split('T')[0],
        gender: 'boy',
        location: '',
        district: '',
        state: '',
        is_je_endemic: false
      });
      await fetchChildren();
      handleSelectChild(newChild);
    } catch (err) {
      console.error("Error creating child profile:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRecordModal = (vaccine: VaccineItem) => {
    setSelectedVaccineForRecord(vaccine);
    setRecordForm({
      administered_date: vaccine.administered_date || new Date().toISOString().split('T')[0],
      facility_name: vaccine.facility_name || '',
      facility_id: '',
      notes: vaccine.notes || '',
      dose: vaccine.dose || ''
    });
    setIsRecordModalOpen(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !selectedVaccineForRecord) return;
    try {
      setSubmitting(true);
      await vaccinationApi.recordVaccination(selectedChild.id, {
        vaccine_id: selectedVaccineForRecord.vaccine_id,
        vaccine_name: selectedVaccineForRecord.vaccine_name,
        administered_date: recordForm.administered_date,
        facility_name: recordForm.facility_name,
        notes: recordForm.notes,
        dose: recordForm.dose
      });
      setIsRecordModalOpen(false);
      loadChildSchedule(selectedChild.id);
    } catch (err) {
      console.error("Error recording vaccination:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetReminder = async (vaccine: VaccineItem) => {
    if (!selectedChild) return;
    try {
      await vaccinationApi.setReminder({
        child_id: selectedChild.id,
        vaccine_id: vaccine.vaccine_id,
        vaccine_name: vaccine.vaccine_name,
        reminder_date: vaccine.window_start
      });
      alert(`🔔 Vaccination reminder configured for ${vaccine.vaccine_name}!`);
    } catch (err) {
      console.error("Error setting reminder:", err);
    }
  };

  const handleFindNearbyCentre = () => {
    navigate('/hospitals?facility_type=vaccination_centre');
  };

  const handleAskAI = async (vaccineName?: string) => {
    const targetName = vaccineName || (selectedVaccineForRecord ? selectedVaccineForRecord.vaccine_name : "Childhood Immunization");
    setAiLoading(true);
    setIsAIModalOpen(true);
    setAiResponse(null);
    try {
      const res = await vaccinationApi.explainVaccine({
        vaccine_name: targetName,
        question: aiQuestion || undefined,
        child_age: selectedChild?.age_info?.formatted
      });
      setAiResponse(res.explanation);
    } catch (err) {
      console.error("AI explanation error:", err);
      setAiResponse("Vaccinations under the National Immunization Schedule (NIS) protect against preventable childhood diseases. Always consult your health centre ANM or pediatrician.");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleMilestone = (id: string) => {
    setExpandedMilestones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-teal-500/10 px-3 py-1.5 rounded-full border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-widest mb-2">
            <Syringe size={13} />
            <span>National Immunization Schedule (NIS)</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Child <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Vaccination Tracking</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Automated DOB-based immunization schedule, gap detection, and verified vaccination centre navigation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleAskAI()}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold text-xs flex items-center space-x-2 transition-all"
          >
            <Bot size={16} />
            <span>Ask AI Assistant</span>
          </button>

          <button
            onClick={() => setIsAddChildModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>+ Add Child</span>
          </button>
        </div>
      </div>

      {/* Safety Disclaimer Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center space-x-3 text-xs text-amber-800 dark:text-amber-300">
        <ShieldCheck size={18} className="text-amber-500 flex-shrink-0" />
        <p className="font-medium">
          <strong>Safety Note:</strong> Vaccination information is based on the configured Government Immunization Schedule. For medical questions or changes to vaccination plans, consult a qualified healthcare professional.
        </p>
      </div>

      {/* Child Selector Tabs Bar */}
      {loadingChildren ? (
        <div className="flex space-x-3 overflow-x-auto pb-2">
          {[1, 2].map(i => (
            <div key={i} className="w-48 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] animate-pulse" />
          ))}
        </div>
      ) : children.length > 0 ? (
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {children.map(child => {
            const isSelected = selectedChild?.id === child.id;
            return (
              <button
                key={child.id}
                onClick={() => handleSelectChild(child)}
                className={`p-3.5 rounded-2xl border transition-all text-left flex items-center space-x-3 min-w-[200px] ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/20'
                    : 'bg-[var(--bg-card)] border-[var(--border-main)] hover:border-slate-400 text-[var(--text-primary)]'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                }`}>
                  👶
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">{child.name}</p>
                  <p className={`text-[11px] font-semibold mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                    Age: {child.age_info?.formatted || 'Infant'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="premium-card p-8 text-center space-y-4">
          <Baby size={40} className="text-teal-500 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">No Children Profiles Registered</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Add your child's name and date of birth to automatically generate their Government National Immunization Schedule (NIS).
            </p>
          </div>
          <button
            onClick={() => setIsAddChildModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center space-x-2 shadow-lg shadow-teal-500/20 transition-all"
          >
            <Plus size={16} />
            <span>Add Child Profile Now</span>
          </button>
        </div>
      )}

      {/* Selected Child Dashboard View */}
      {selectedChild && schedule && (
        <div className="space-y-8">
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="premium-card p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <CheckCircle2 size={12} className="text-teal-500" />
                <span>Completed</span>
              </p>
              <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">
                {schedule.metrics.completed} <span className="text-xs text-slate-400 font-normal">/ {schedule.metrics.total}</span>
              </p>
            </div>

            <div className="premium-card p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Clock size={12} className="text-blue-500" />
                <span>Upcoming</span>
              </p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {schedule.metrics.upcoming}
              </p>
            </div>

            <div className="premium-card p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <AlertCircle size={12} className="text-amber-500" />
                <span>Due Now</span>
              </p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {schedule.metrics.due}
              </p>
            </div>

            <div className="premium-card p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <AlertTriangle size={12} className="text-rose-500" />
                <span>Overdue Gaps</span>
              </p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {schedule.metrics.overdue}
              </p>
            </div>
          </div>

          {/* Progress Bar Component */}
          <div className="premium-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm text-[var(--text-primary)]">
                  Immunization Progress for {selectedChild.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Age: <span className="font-bold text-teal-600 dark:text-teal-400">{selectedChild.age_info?.formatted}</span> • DOB: {selectedChild.date_of_birth}
                </p>
              </div>
              <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
                {schedule.metrics.progress_percentage}%
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${schedule.metrics.progress_percentage}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full"
              />
            </div>
          </div>

          {/* Newborn Immediate Flow Banner */}
          {selectedChild.age_info?.is_newborn && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 space-y-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-2xl">
                  👶
                </div>
                <div>
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase">
                    🔴 Immediate Requirements
                  </div>
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)] mt-1">
                    At Birth Vaccination Requirement for {selectedChild.name}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                The following 3 vaccinations should be administered immediately at birth or within the first 14 days:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {schedule.timeline.find(m => m.milestone_id === 'AT_BIRTH')?.vaccines.map(v => (
                  <div key={v.vaccine_id} className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-[var(--text-primary)]">{v.vaccine_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        v.status === 'COMPLETED' ? 'bg-teal-500/10 text-teal-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{v.full_name}</p>
                    <button
                      onClick={() => handleOpenRecordModal(v)}
                      className="w-full mt-1 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                    >
                      {v.status === 'COMPLETED' ? '✓ Completed' : 'Mark Administered'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* NEXT VACCINATION HERO CARD */}
          {nextVaccine ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="premium-card p-6 border-2 border-teal-500/40 space-y-5 bg-gradient-to-br from-teal-500/5 to-transparent"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-2xl flex-shrink-0">
                    📅
                  </div>
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-wider mb-1">
                      <span>NEXT VACCINATION</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                      {nextVaccine.vaccine_name} <span className="text-sm text-slate-400 font-semibold">({nextVaccine.full_name})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Recommended Age: <span className="font-bold text-[var(--text-primary)]">{nextVaccine.recommended_age}</span> • Window: {nextVaccine.scheduled_window}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider ${
                    nextVaccine.status === 'OVERDUE' 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                      : nextVaccine.status === 'DUE'
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  }`}>
                    {nextVaccine.status === 'OVERDUE' ? `⚠️ OVERDUE BY ${nextVaccine.days_offset} DAYS` :
                     nextVaccine.status === 'DUE' ? `🔴 DUE NOW` :
                     `DUE IN ${nextVaccine.days_offset} DAYS`}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-main)]">
                <button
                  onClick={() => handleOpenRecordModal(nextVaccine)}
                  className="py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-teal-500/10"
                >
                  <CheckCircle2 size={15} />
                  <span>Record Vaccine</span>
                </button>

                <button
                  onClick={() => handleSetReminder(nextVaccine)}
                  className="py-3 px-4 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 border border-[var(--border-main)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center space-x-2"
                >
                  <Bell size={15} className="text-amber-500" />
                  <span>Set Reminder</span>
                </button>

                <button
                  onClick={handleFindNearbyCentre}
                  className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-indigo-500/10"
                >
                  <Navigation size={15} />
                  <span>Find Nearby Centre</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="premium-card p-6 text-center space-y-2">
              <CheckCircle2 size={32} className="text-teal-500 mx-auto" />
              <h4 className="font-bold text-sm text-[var(--text-primary)]">All Immunizations Up to Date!</h4>
              <p className="text-xs text-slate-500">No overdue or immediate upcoming vaccinations for {selectedChild.name}.</p>
            </div>
          )}

          {/* Immunization Timeline Milestones */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center space-x-2">
                <Calendar size={20} className="text-teal-500" />
                <span>National Immunization Schedule Timeline</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold">Government of India NIS</p>
            </div>

            <div className="space-y-4">
              {schedule.timeline.map((milestone) => {
                const isExpanded = expandedMilestones[milestone.milestone_id] ?? false;
                const completedInMs = milestone.vaccines.filter(v => v.status === 'COMPLETED').length;
                const totalInMs = milestone.vaccines.length;

                return (
                  <div 
                    key={milestone.milestone_id}
                    className="premium-card overflow-hidden transition-all border border-[var(--border-main)]"
                  >
                    {/* Milestone Accordion Header */}
                    <button
                      onClick={() => toggleMilestone(milestone.milestone_id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-extrabold text-sm">
                          {milestone.milestone_label.slice(0, 4)}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base text-[var(--text-primary)]">{milestone.milestone_label}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {completedInMs} of {totalInMs} vaccines completed
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          completedInMs === totalInMs ? 'bg-teal-500/10 text-teal-600' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                        }`}>
                          {completedInMs === totalInMs ? '✓ Completed' : `${totalInMs - completedInMs} Remaining`}
                        </span>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Milestone Vaccines Grid */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-[var(--border-main)] p-4 space-y-3 bg-[var(--bg-primary)]/50"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {milestone.vaccines.map((v) => {
                              const isCompleted = v.status === 'COMPLETED';
                              const isOverdue = v.status === 'OVERDUE';
                              const isDue = v.status === 'DUE';
                              const isNotApplicable = v.status === 'NOT_APPLICABLE';

                              return (
                                <div
                                  key={v.vaccine_id}
                                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                                    isCompleted 
                                      ? 'bg-teal-500/5 border-teal-500/30' 
                                      : isOverdue 
                                      ? 'bg-rose-500/5 border-rose-500/30' 
                                      : isDue 
                                      ? 'bg-amber-500/5 border-amber-500/30'
                                      : 'bg-[var(--bg-card)] border-[var(--border-main)]'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h5 className="font-extrabold text-base text-[var(--text-primary)]">{v.vaccine_name}</h5>
                                        <p className="text-xs text-slate-500 font-medium">{v.full_name}</p>
                                      </div>
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                        isCompleted ? 'bg-teal-500 text-white' :
                                        isOverdue ? 'bg-rose-500 text-white' :
                                        isDue ? 'bg-amber-500 text-white' :
                                        isNotApplicable ? 'bg-slate-300 text-slate-600' :
                                        'bg-blue-500/10 text-blue-600'
                                      }`}>
                                        {v.status}
                                      </span>
                                    </div>

                                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                                      <p><span className="font-semibold text-slate-400">Dose & Route:</span> {v.dose} ({v.route})</p>
                                      <p><span className="font-semibold text-slate-400">Scheduled Window:</span> {v.scheduled_window}</p>

                                      {isCompleted && v.administered_date && (
                                        <p className="font-bold text-teal-600 dark:text-teal-400 mt-1">
                                          ✓ Administered on: {v.administered_date} {v.facility_name ? `@ ${v.facility_name}` : ''}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Vaccine Item Footer Actions */}
                                  <div className="flex items-center space-x-2 pt-2 border-t border-[var(--border-main)]/60">
                                    <button
                                      onClick={() => handleOpenRecordModal(v)}
                                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 transition-all ${
                                        isCompleted 
                                          ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20' 
                                          : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                                      }`}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>{isCompleted ? 'Edit Date' : 'Record Vaccination'}</span>
                                    </button>

                                    {!isCompleted && (
                                      <button
                                        onClick={handleFindNearbyCentre}
                                        className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                                        title="Find Nearby Vaccination Centre"
                                      >
                                        <Navigation size={14} />
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleAskAI(v.vaccine_name)}
                                      className="p-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                                      title="Ask AI about this vaccine"
                                    >
                                      <HelpCircle size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      <AnimatePresence>
        {isAddChildModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="premium-card w-full max-w-lg p-6 space-y-5 bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                <div className="flex items-center space-x-2">
                  <Baby className="text-teal-500" size={24} />
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)]">Add Child Profile</h3>
                </div>
                <button 
                  onClick={() => setIsAddChildModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddChildSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Child's Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={childForm.name}
                    onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-sm font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={childForm.date_of_birth}
                      onChange={(e) => setChildForm({ ...childForm, date_of_birth: e.target.value })}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Gender
                    </label>
                    <select
                      value={childForm.gender}
                      onChange={(e) => setChildForm({ ...childForm, gender: e.target.value })}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                    >
                      <option value="boy">Boy 👦</option>
                      <option value="girl">Girl 👧</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      District / City
                    </label>
                    <input
                      type="text"
                      value={childForm.district}
                      onChange={(e) => setChildForm({ ...childForm, district: e.target.value })}
                      placeholder="e.g. Mumbai / Thane"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={childForm.state}
                      onChange={(e) => setChildForm({ ...childForm, state: e.target.value })}
                      placeholder="e.g. Maharashtra"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-[var(--text-primary)]">JE Endemic Region</p>
                    <p className="text-[11px] text-slate-500">Enable Japanese Encephalitis vaccine requirement</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={childForm.is_je_endemic}
                    onChange={(e) => setChildForm({ ...childForm, is_je_endemic: e.target.checked })}
                    className="w-4 h-4 accent-teal-600 rounded"
                  />
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddChildModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-500 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-500/20"
                  >
                    {submitting ? 'Creating Profile...' : 'Save Child Profile'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Vaccine Modal */}
      <AnimatePresence>
        {isRecordModalOpen && selectedVaccineForRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="premium-card w-full max-w-md p-6 space-y-5 bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                <div className="flex items-center space-x-2">
                  <Syringe className="text-teal-500" size={22} />
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)]">Record Vaccination</h3>
                </div>
                <button 
                  onClick={() => setIsRecordModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs">
                <p className="font-extrabold text-teal-700 dark:text-teal-300">{selectedVaccineForRecord.vaccine_name}</p>
                <p className="text-slate-500 mt-0.5">{selectedVaccineForRecord.full_name}</p>
              </div>

              <form onSubmit={handleRecordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Actual Date of Vaccination *
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={recordForm.administered_date}
                    onChange={(e) => setRecordForm({ ...recordForm, administered_date: e.target.value })}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Vaccination Centre / Facility Name
                  </label>
                  <input
                    type="text"
                    value={recordForm.facility_name}
                    onChange={(e) => setRecordForm({ ...recordForm, facility_name: e.target.value })}
                    placeholder="e.g. PHC Badlapur / Urban Immunization Centre"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-teal-500 text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Notes / Batch Info (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                    placeholder="e.g. Administered at Government Health Centre, Batch #992"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl p-3 outline-none focus:border-teal-500 text-xs font-medium text-[var(--text-primary)]"
                  />
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-500 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-500/20"
                  >
                    {submitting ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="premium-card w-full max-w-lg p-6 space-y-5 bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                <div className="flex items-center space-x-2">
                  <Bot className="text-indigo-500" size={24} />
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)]">SwasthyaSetu AI Vaccine Helper</h3>
                </div>
                <button 
                  onClick={() => setIsAIModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    Ask any question about child vaccines:
                  </label>
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="e.g. Why is Pentavalent vaccine given? What are normal side effects?"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3.5 outline-none focus:border-indigo-500 text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <button
                  onClick={() => handleAskAI()}
                  disabled={aiLoading}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-2"
                >
                  {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{aiLoading ? 'Asking AI Assistant...' : 'Get AI Explanation'}</span>
                </button>

                {aiResponse && (
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-2 text-[var(--text-primary)] leading-relaxed max-h-60 overflow-y-auto">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">🤖 AI Educational Explanation:</p>
                    <p className="whitespace-pre-line">{aiResponse}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsAIModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-500 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
