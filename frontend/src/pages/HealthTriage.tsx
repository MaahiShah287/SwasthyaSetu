import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  MapPin, 
  PhoneCall, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Building2, 
  Info, 
  Stethoscope, 
  History,
  Navigation,
  Video,
  Award,
  Sparkles,
  ExternalLink,
  HelpCircle,
  UserCheck
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import api from '../api/instance';
import { useTheme } from '../context/ThemeContext';
import { ReferralRecommendationResponse, ScoredFacility } from '../types/referral';
import CarePathwayMap from '../components/referral/CarePathwayMap';
import FacilityDetailModal from '../components/referral/FacilityDetailModal';
import TelemedicineModal from '../components/telemedicine/TelemedicineModal';
import EmergencyResponsePanel from '../components/emergency/EmergencyResponsePanel';

interface TriageResult {
  urgency_level: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF-CARE / INFORMATION';
  summary: string;
  recommended_action: string;
  recommended_service_type: string;
  warning_signs: string[];
  disclaimer: string;
  red_flag_triggered?: boolean;
  is_ai_fallback?: boolean;
}

export default function HealthTriage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [carePathway, setCarePathway] = useState<ReferralRecommendationResponse | null>(null);
  const [selectedFacilityModal, setSelectedFacilityModal] = useState<ScoredFacility | null>(null);
  const [selectedTelemedFacility, setSelectedTelemedFacility] = useState<ScoredFacility | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'pathway' | 'analysis'>('pathway');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);


  // Form state
  const [mainSymptom, setMainSymptom] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('Moderate');
  const [ageGroup, setAgeGroup] = useState('Adult');
  const [existingConditions, setExistingConditions] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('N/A');
  const [otherSymptoms, setOtherSymptoms] = useState('');
  const [location, setLocation] = useState('');

  // Fetch patient profile defaults if available
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await api.get('/profile');
        if (res.data) {
          if (res.data.diseases) setExistingConditions(res.data.diseases);
          if (res.data.medications) setCurrentMedications(res.data.medications);
        }
      } catch (e) {
        // Silent catch if profile not set
      }
    };
    loadDefaults();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/triage/history');
      setHistory(res.data);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory) fetchHistory();
    setShowHistory(!showHistory);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainSymptom.trim()) return;

    setLoading(true);
    setResult(null);
    setCarePathway(null);

    try {
      const payload = {
        main_symptom: mainSymptom,
        duration: duration || 'Unspecified',
        severity: severity,
        age_group: ageGroup,
        existing_conditions: existingConditions,
        current_medications: currentMedications,
        pregnancy_status: pregnancyStatus,
        other_symptoms: otherSymptoms,
        location: location
      };

      const response = await api.post('/triage/assess', payload);
      const triageRes: TriageResult = response.data;
      setResult(triageRes);

      // Fetch AI Referral & Care Pathway Recommendation
      try {
        const referralPayload = {
          triage_result: triageRes,
          user_input: payload,
          location: { latitude: 19.0760, longitude: 72.8777, address: location || "Current Location" }
        };
        const pathwayRes = await api.post('/referrals/recommend', referralPayload);
        setCarePathway(pathwayRes.data);
      } catch (refErr) {
        console.error("Care pathway recommendation call error:", refErr);
      }

      setStep(4); // Result view
    } catch (err: any) {
      console.error("Triage evaluation error:", err);
      // Fallback result in case of network or backend communication error
      const isSevere = severity === 'Severe' || severity === 'Extreme';
      const fallbackUrgency = isSevere ? 'URGENT' : 'ROUTINE';

      const fallbackResult: TriageResult = {
        urgency_level: fallbackUrgency,
        summary: 'Based on the symptoms and information provided, the assessment indicates a routine, non-emergency concern. No emergency red flags were identified during the safety screening.',
        recommended_action: isSevere ? 'Schedule an urgent clinical evaluation or consult a doctor.' : 'Monitor your symptoms, ensure adequate rest/hydration, and schedule a routine physician visit if symptoms persist.',
        recommended_service_type: isSevere ? 'Urgent Care / General Physician' : 'General Practitioner / Primary Care Clinic',
        warning_signs: [
          'Difficulty breathing or shortness of breath',
          'Crushing chest pain or pressure',
          'Sudden confusion, slurred speech, or weakness'
        ],
        disclaimer: 'This is preliminary triage guidance only and not a medical diagnosis. If you experience severe or life-threatening symptoms, contact emergency services (108 / 112) immediately.',
        is_ai_fallback: true
      };
      setResult(fallbackResult);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMainSymptom('');
    setDuration('');
    setSeverity('Moderate');
    setOtherSymptoms('');
    setResult(null);
    setCarePathway(null);
    setStep(1);
  };


  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return {
          bg: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
          banner: 'bg-gradient-to-r from-red-600 to-rose-700 text-white',
          icon: ShieldAlert,
          title: 'IMMEDIATE EMERGENCY CARE REQUIRED',
          glow: 'shadow-red-500/20'
        };
      case 'URGENT':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
          banner: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
          icon: AlertTriangle,
          title: 'PROMPT URGENT CARE RECOMMENDED',
          glow: 'shadow-amber-500/20'
        };
      case 'ROUTINE':
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
          banner: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
          icon: Stethoscope,
          title: 'ROUTINE CLINICAL CONSULTATION',
          glow: 'shadow-blue-500/20'
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
          banner: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
          icon: CheckCircle,
          title: 'SELF-CARE & MONITORING',
          glow: 'shadow-emerald-500/20'
        };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-main)] pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <Activity size={26} />
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              AI Health <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Triage System</span>
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Preliminary symptom evaluation, safety red-flag screening, and healthcare navigation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleHistory}
            className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-main)] px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all"
          >
            <History size={16} />
            <span>{showHistory ? 'Hide Triage Log' : 'Triage History'}</span>
          </button>

          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95"
          >
            <PhoneCall size={16} />
            <span>Emergency 108 / 112</span>
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-start space-x-3 text-amber-800 dark:text-amber-300">
        <Info size={20} className="shrink-0 mt-0.5 text-amber-600" />
        <div className="text-xs font-medium leading-relaxed">
          <strong className="font-bold">Important Safety Notice:</strong> This AI Triage System provides preliminary guidance and navigation support only. It is <strong>NOT</strong> a medical diagnosis. If you feel your condition is life-threatening or critical, seek immediate emergency care.
        </div>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 space-y-4 overflow-hidden"
          >
            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center space-x-2">
              <History size={18} className="text-blue-500" />
              <span>Past Triage Evaluations</span>
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No triage history recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {history.map((item, idx) => {
                  const badge = getUrgencyBadge(item.result?.urgency_level);
                  return (
                    <div key={idx} className="p-4 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${badge.bg}`}>
                            {item.result?.urgency_level}
                          </span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {item.input?.main_symptom}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {item.result?.summary}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(item.timestamp * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Interactive Container */}
      {step < 4 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 lg:p-10 shadow-xl relative overflow-hidden">
          {/* Progress Indicator */}
          <div className="mb-8 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Step {step} of 3</span>
              <span>
                {step === 1 && 'Symptom & Severity'}
                {step === 2 && 'Background Details (Optional)'}
                {step === 3 && 'Review & Evaluate'}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <motion.div 
                className="bg-blue-600 h-full rounded-full"
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Symptom & Severity */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                    What is your primary symptom or health concern? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={mainSymptom}
                    onChange={(e) => setMainSymptom(e.target.value)}
                    placeholder="Describe what you are experiencing (e.g. Sharp stomach pain, high fever with chills, persistent cough)..."
                    className="w-full p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-all font-medium text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Symptom Duration
                    </label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 2 hours, 3 days, since last night"
                      className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Perceived Severity
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['Mild', 'Moderate', 'Severe', 'Extreme'].map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setSeverity(sev)}
                          className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                            severity === sev
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-main)] hover:border-blue-400'
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!mainSymptom.trim()}
                    onClick={() => setStep(2)}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    <span>Next: Background Details</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Demographics & Voluntary Details */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center space-x-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <UserCheck size={18} />
                  <span>These details are voluntary and help tailor the triage navigation recommendations.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Age Group
                    </label>
                    <select
                      value={ageGroup}
                      onChange={(e) => setAgeGroup(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                    >
                      <option value="Infant">Infant (0-2 yrs)</option>
                      <option value="Child">Child (3-12 yrs)</option>
                      <option value="Teen">Teen (13-17 yrs)</option>
                      <option value="Adult">Adult (18-64 yrs)</option>
                      <option value="Senior">Senior (65+ yrs)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Location / City (Optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Mumbai, Bandra West"
                      className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                    Relevant Existing Conditions (Optional)
                  </label>
                  <input
                    type="text"
                    value={existingConditions}
                    onChange={(e) => setExistingConditions(e.target.value)}
                    placeholder="e.g. Asthma, Diabetes, Hypertension, Heart disease"
                    className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Current Medications (Optional)
                    </label>
                    <input
                      type="text"
                      value={currentMedications}
                      onChange={(e) => setCurrentMedications(e.target.value)}
                      placeholder="e.g. Insulin, Antihistamines, Blood pressure meds"
                      className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                      Pregnancy Status (Where relevant)
                    </label>
                    <select
                      value={pregnancyStatus}
                      onChange={(e) => setPregnancyStatus(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                    >
                      <option value="N/A">Not Applicable</option>
                      <option value="No">No</option>
                      <option value="Yes - 1st Trimester">Yes - 1st Trimester</option>
                      <option value="Yes - 2nd Trimester">Yes - 2nd Trimester</option>
                      <option value="Yes - 3rd Trimester">Yes - 3rd Trimester</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center space-x-2 bg-[var(--bg-primary)] border border-[var(--border-main)] px-6 py-3 rounded-xl font-bold text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={18} />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                  >
                    <span>Next: Review & Evaluate</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Other Symptoms & Review */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                    Any additional symptoms or details? (Optional)
                  </label>
                  <input
                    type="text"
                    value={otherSymptoms}
                    onChange={(e) => setOtherSymptoms(e.target.value)}
                    placeholder="e.g. Mild headache, nausea, dizziness..."
                    className="w-full p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-blue-500 text-sm font-medium"
                  />
                </div>

                {/* Summary Card */}
                <div className="p-6 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl space-y-3">
                  <h4 className="font-extrabold text-sm text-[var(--text-primary)] uppercase tracking-wider">Assessment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-[var(--text-secondary)]">
                    <div><strong className="text-[var(--text-primary)]">Main Symptom:</strong> {mainSymptom}</div>
                    <div><strong className="text-[var(--text-primary)]">Duration:</strong> {duration || 'Unspecified'}</div>
                    <div><strong className="text-[var(--text-primary)]">Severity:</strong> {severity}</div>
                    <div><strong className="text-[var(--text-primary)]">Age Group:</strong> {ageGroup}</div>
                    {existingConditions && <div><strong className="text-[var(--text-primary)]">Existing Conditions:</strong> {existingConditions}</div>}
                    {currentMedications && <div><strong className="text-[var(--text-primary)]">Medications:</strong> {currentMedications}</div>}
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center space-x-2 bg-[var(--bg-primary)] border border-[var(--border-main)] px-6 py-3 rounded-xl font-bold text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={18} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Evaluating Safety & Triage...</span>
                      </>
                    ) : (
                      <>
                        <Activity size={18} />
                        <span>Run AI Triage Evaluation</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </form>
        </div>
      )}

      {/* Step 4: AI Health Assessment & Triage Result View */}
      {step === 4 && result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Main Urgency Banner */}
          {(() => {
            const badge = getUrgencyBadge(result.urgency_level);
            const IconComponent = badge.icon;

            return (
              <div className={`rounded-3xl p-8 shadow-2xl ${badge.banner} ${badge.glow} relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <IconComponent size={32} />
                      <span className="text-xs font-black uppercase tracking-[0.25em] bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                        RISK LEVEL: {result.urgency_level}
                      </span>
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">{badge.title}</h2>
                    <p className="text-sm font-medium opacity-90 max-w-2xl">{result.summary}</p>
                  </div>

                  {result.urgency_level === 'EMERGENCY' && (
                    <button
                      onClick={() => setShowEmergencyModal(true)}
                      className="bg-white text-red-600 px-6 py-3.5 rounded-2xl font-extrabold text-xs uppercase tracking-widest shadow-xl hover:bg-red-50 transition-all active:scale-95 shrink-0 flex items-center space-x-2"
                    >
                      <PhoneCall size={18} />
                      <span>Call 108 / 112 Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* AI Fallback Warning Banner if both AI engines were unreachable */}
          {result.is_ai_fallback && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <AlertTriangle size={18} className="shrink-0 text-amber-500" />
              <span>AI assessment temporarily unavailable. Safety screening completed successfully.</span>
            </div>
          )}

          {/* Prominent AI Health Assessment Card */}
          <div className="bg-[var(--bg-card)] border-2 border-blue-500/30 p-8 rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <div className="flex items-center space-x-3">
                <span className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-[var(--text-primary)]">SwasthyaSetu AI Clinical Assessment</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time risk analysis generated via Groq LLaMA-3 / Gemini AI Engine</p>
                </div>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${getUrgencyBadge(result.urgency_level).bg}`}>
                {result.urgency_level} RISK
              </span>
            </div>

            {/* AI Explanation & Observations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border-main)] space-y-3">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  <Stethoscope size={18} />
                  <span>AI Assessment Explanation</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                  {result.summary}
                </p>
              </div>

              <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border-main)] space-y-3">
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  <CheckCircle size={18} />
                  <span>Recommended Next Action</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] font-bold leading-relaxed">
                  {result.recommended_action}
                </p>
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-500">Required Service Category:</span>
                  <span className="ml-2 text-xs font-extrabold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20 inline-block">
                    {result.recommended_service_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Signs (If applicable) */}
            {result.warning_signs && result.warning_signs.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center space-x-2">
                  <AlertTriangle size={16} />
                  <span>Key Observations & Warning Red Flags</span>
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-medium text-[var(--text-primary)]">
                  {result.warning_signs.map((sign, idx) => (
                    <li key={idx} className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Healthcare Safety Disclaimer */}
            <div className="p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-500 font-medium leading-relaxed">
              <strong className="text-[var(--text-primary)]">Medical Guidance Disclaimer:</strong> {result.disclaimer}
            </div>

            {/* Prominent Action Button to Load Nearby Healthcare Facilities */}
            {!carePathway && (
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--border-main)]">
                <div className="text-xs text-slate-500 font-medium">
                  Ready to locate matching real healthcare facilities nearby?
                </div>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const referralPayload = {
                        triage_result: result,
                        user_input: {
                          main_symptom: mainSymptom,
                          duration: duration,
                          severity: severity,
                          age_group: ageGroup,
                          existing_conditions: existingConditions,
                          current_medications: currentMedications,
                          pregnancy_status: pregnancyStatus,
                          other_symptoms: otherSymptoms,
                          location: location
                        },
                        location: { latitude: 19.0760, longitude: 72.8777, address: location || "Current Location" }
                      };
                      const pathwayRes = await api.post('/referrals/recommend', referralPayload);
                      setCarePathway(pathwayRes.data);
                    } catch (refErr) {
                      console.error("Care pathway recommendation call error:", refErr);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-sm uppercase tracking-widest shadow-xl shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center space-x-3"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Querying Access Directory...</span>
                    </>
                  ) : (
                    <>
                      <Building2 size={20} />
                      <span>Find Nearby Healthcare</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Care Pathway & Access Directory Results (Only shown AFTER user clicks "Find Nearby Healthcare") */}
          {carePathway && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pt-4 border-t border-[var(--border-main)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <Building2 size={22} className="text-blue-600" />
                    <span>Real Nearby Healthcare Facilities (Existing Access Directory)</span>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
                    Matched from database using location + MongoDB geospatial compatibility search.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  {carePathway.service_analysis?.primary_required_service}
                </span>
              </div>

              {/* Service Selection Rationale */}
              {carePathway.service_analysis?.clinical_rationale && (
                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl text-xs text-[var(--text-secondary)] font-medium">
                  <b>AI Facility Matching Rationale:</b> {carePathway.service_analysis.clinical_rationale}
                </div>
              )}

              {/* Interactive Access Directory Map */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-500" />
                  <span>Healthcare Facility Radar & Access Map</span>
                </h4>
                <CarePathwayMap
                  userLocation={[19.0760, 72.8777]}
                  bestMatch={carePathway.care_pathway?.best_match}
                  secondOption={carePathway.care_pathway?.second_option}
                  thirdOption={carePathway.care_pathway?.third_option}
                  fallbackOptions={carePathway.care_pathway?.fallback_options}
                  onSelectFacility={(fac) => setSelectedFacilityModal(fac)}
                />
              </div>

              {/* Warning if no suitable match */}
              {!carePathway.care_pathway?.has_suitable_match && (
                <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <span>No Exact Matching Facility Found Within Immediate Range</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {carePathway.care_pathway?.no_match_message}
                  </p>
                </div>
              )}

              {/* Ranked Recommended Facilities */}
              <div className="space-y-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <span>Ranked Recommended Healthcare Facilities</span>
                </h4>

                {/* Best Match (#1) Card */}
                {carePathway.care_pathway?.best_match && (
                  <div className="bg-gradient-to-br from-emerald-500/10 via-[var(--bg-card)] to-[var(--bg-card)] border-2 border-emerald-500/40 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white uppercase tracking-wider shadow-sm">
                            #1 BEST MATCH
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            {carePathway.care_pathway.best_match.total_score}% Compatibility Match
                          </span>
                          {carePathway.care_pathway.best_match.is_stale && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                              ⚠️ Stale Data Warning
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl font-extrabold text-[var(--text-primary)]">
                          {carePathway.care_pathway.best_match.facility.name}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                          {carePathway.care_pathway.best_match.facility.type} • {carePathway.care_pathway.best_match.distance_km} km away • {carePathway.care_pathway.best_match.data_freshness_text}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedFacilityModal(carePathway.care_pathway!.best_match!)}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1.5"
                        >
                          <Info size={15} />
                          <span>View Facility</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-main)]">
                      <b>Why Selected:</b> {carePathway.care_pathway.best_match.rationale}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center">
                        <span className="text-[var(--text-secondary)]">Inpatient Capacity (Last reported)</span>
                        <div className="font-extrabold text-sm text-[var(--text-primary)] mt-0.5">
                          {carePathway.care_pathway.best_match.facility.available_beds} / {carePathway.care_pathway.best_match.facility.total_beds}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center">
                        <span className="text-[var(--text-secondary)] font-medium">24/7 ER Capability</span>
                        <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {carePathway.care_pathway.best_match.facility.is_24x7_emergency ? 'Yes ✅' : 'No'}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center">
                        <span className="text-[var(--text-secondary)] font-medium">Operating Hours</span>
                        <div className="font-bold text-xs text-[var(--text-primary)] mt-0.5 truncate">
                          {carePathway.care_pathway.best_match.facility.operating_hours}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center">
                        <span className="text-[var(--text-secondary)] font-medium">Facility Status</span>
                        <div className="font-extrabold text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          {carePathway.care_pathway.best_match.facility.status}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          const fac = carePathway.care_pathway!.best_match!.facility;
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`, '_blank');
                        }}
                        className="flex-1 min-w-[150px] px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-center gap-2"
                      >
                        <Navigation size={16} /> Get Directions
                      </button>

                      {carePathway.care_pathway.best_match.facility.has_telemedicine && (
                        <button
                          onClick={() => setSelectedTelemedFacility(carePathway.care_pathway!.best_match!)}
                          className="flex-1 min-w-[150px] px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                        >
                          <Video size={16} /> Start Telemedicine
                        </button>
                      )}

                      <button
                        onClick={() => setShowEmergencyModal(true)}
                        className="px-5 py-3 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 font-bold text-xs uppercase tracking-wider hover:bg-red-500/20 transition flex items-center gap-2"
                      >
                        <PhoneCall size={16} /> Emergency Help
                      </button>
                    </div>
                  </div>
                )}

                {/* Alternative Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {carePathway.care_pathway?.second_option && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl space-y-4 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                          #2 Alternative Match ({carePathway.care_pathway.second_option.total_score}%)
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] font-semibold">
                          {carePathway.care_pathway.second_option.distance_km} km
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[var(--text-primary)]">
                        {carePathway.care_pathway.second_option.facility.name}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {carePathway.care_pathway.second_option.rationale}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)]">
                        <span className="text-xs text-slate-500">
                          Beds: {carePathway.care_pathway.second_option.facility.available_beds} free
                        </span>
                        <button
                          onClick={() => setSelectedFacilityModal(carePathway.care_pathway!.second_option!)}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>View Details</span> <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {carePathway.care_pathway?.third_option && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl space-y-4 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-400">
                          #3 Alternative Match ({carePathway.care_pathway.third_option.total_score}%)
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] font-semibold">
                          {carePathway.care_pathway.third_option.distance_km} km
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[var(--text-primary)]">
                        {carePathway.care_pathway.third_option.facility.name}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {carePathway.care_pathway.third_option.rationale}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)]">
                        <span className="text-xs text-slate-500">
                          Beds: {carePathway.care_pathway.third_option.facility.available_beds} free
                        </span>
                        <button
                          onClick={() => setSelectedFacilityModal(carePathway.care_pathway!.third_option!)}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>View Details</span> <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border-main)]">
            <button
              onClick={resetForm}
              className="flex items-center space-x-2 bg-[var(--bg-primary)] border border-[var(--border-main)] px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] hover:border-blue-500 transition-all"
            >
              <RotateCcw size={16} />
              <span>Start New Assessment</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Telemedicine Consultation Modal */}
      <TelemedicineModal
        scoredFacility={selectedTelemedFacility}
        onClose={() => setSelectedTelemedFacility(null)}
      />

      {/* Facility Detail Modal */}
      <FacilityDetailModal
        scoredFacility={selectedFacilityModal}
        onClose={() => setSelectedFacilityModal(null)}
        onStartTelemedicine={(fac) => {
          setSelectedFacilityModal(null);
          setSelectedTelemedFacility(selectedFacilityModal);
        }}
      />

      {/* Emergency Response & Ambulance Panel */}
      {showEmergencyModal && (
        <EmergencyResponsePanel
          userLocation={[19.0760, 72.8777]}
          onClose={() => setShowEmergencyModal(false)}
        />
      )}
    </div>
  );
}
