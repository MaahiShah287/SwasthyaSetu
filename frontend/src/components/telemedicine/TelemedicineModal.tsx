import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X, Calendar, Phone, AlertCircle, ExternalLink, CheckCircle2, User, Clock, Send, FileUp, Check } from 'lucide-react';
import api from '../../api/instance';
import { ScoredFacility } from '../../types/referral';

interface TelemedicineModalProps {
  scoredFacility: ScoredFacility | null;
  onClose: () => void;
}

export default function TelemedicineModal({ scoredFacility, onClose }: TelemedicineModalProps) {
  if (!scoredFacility) return null;
  const { facility } = scoredFacility;

  const [loading, setLoading] = useState(false);
  const [dbDoctors, setDbDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const [consultationType, setConsultationType] = useState('General Consultation');
  const [scheduledAt, setScheduledAt] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  
  // Vault Upload Reports Integration
  const [vaultReports, setVaultReports] = useState<any[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  
  const [bookingConfirmed, setBookingConfirmed] = useState<any | null>(null);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacilityDoctorsAndReports = async () => {
      try {
        const [docRes, repRes] = await Promise.all([
          api.get(`/telemedicine/doctors/${facility.facility_id}`),
          api.get('/reports')
        ]);

        if (docRes.data && docRes.data.doctors && docRes.data.doctors.length > 0) {
          setDbDoctors(docRes.data.doctors);
          setSelectedDoctorId(docRes.data.doctors[0].doctor_id);
          setSelectedDoctorName(docRes.data.doctors[0].name);
        } else if (docRes.data && docRes.data.specialists) {
          const formatted = docRes.data.specialists.map((s: string, idx: number) => ({
            doctor_id: `DOC-00${idx + 1}`,
            name: s.includes('👨‍⚕️') ? s : `Dr. ${s}`,
            specialization: s
          }));
          setDbDoctors(formatted);
          setSelectedDoctorId(formatted[0].doctor_id);
          setSelectedDoctorName(formatted[0].name);
        }

        if (repRes.data) {
          setVaultReports(repRes.data);
        }
      } catch (e) {
        console.error("Failed to load doctors/reports", e);
      }
    };
    fetchFacilityDoctorsAndReports();
  }, [facility.facility_id]);

  const toggleReportSelection = (id: string) => {
    setSelectedReportIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRequestConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        doctor_id: selectedDoctorId || "DOC-001",
        facility_id: facility.facility_id,
        consultation_type: consultationType,
        scheduled_at: scheduledAt || null,
        patient_notes: patientNotes,
        shared_report_ids: selectedReportIds,
        triage_urgency: "ROUTINE"
      };

      const res = await api.post('/telemedicine/consultations', payload);
      setBookingConfirmed(res.data);

      try {
        const roomRes = await api.post('/telemedicine/create-room', {
          facility_id: facility.facility_id,
          specialist_name: selectedDoctorName || "Attending Doctor",
          consultation_type: consultationType,
          patient_notes: patientNotes
        });
        setSessionData(roomRes.data);
      } catch (rErr) {
        // Silent fallback
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMsg(err.response?.data?.detail || "Doctor is already booked for this time slot. Please select another slot.");
      } else {
        setErrorMsg(err.response?.data?.detail || "Failed to submit consultation request.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Google Meet Telemedicine Consultation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {facility.name} • Remote OPD Care Desk
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!bookingConfirmed ? (
            <form onSubmit={handleRequestConsultation} className="space-y-5">
              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Available Doctor / Specialist <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    setSelectedDoctorId(e.target.value);
                    const doc = dbDoctors.find(d => d.doctor_id === e.target.value);
                    if (doc) setSelectedDoctorName(doc.name);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium outline-none focus:border-emerald-500"
                >
                  {dbDoctors.map((doc, idx) => (
                    <option key={idx} value={doc.doctor_id}>
                      👨‍⚕️ {doc.name} ({doc.specialization || 'Specialist'}) — {doc.availability || 'Available'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Consultation Category
                  </label>
                  <input
                    type="text"
                    value={consultationType}
                    onChange={(e) => setConsultationType(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Preferred Time Slot
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Vault Medical Reports Sharing */}
              {vaultReports.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileUp size={14} className="text-blue-500" />
                    <span>Share Vault Medical Reports with Doctor (Optional)</span>
                  </label>
                  <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                    {vaultReports.map((rep) => {
                      const isSelected = selectedReportIds.includes(rep._id);
                      return (
                        <div 
                          key={rep._id}
                          onClick={() => toggleReportSelection(rep._id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-medium transition ${
                            isSelected ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate max-w-[280px]">{rep.title} ({rep.report_type})</span>
                          {isSelected && <Check size={14} className="text-blue-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Patient Brief */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Brief Medical Problem / Notes for Attending Doctor
                </label>
                <textarea
                  rows={2}
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Describe your current symptoms or specific guidance required..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium outline-none focus:border-emerald-500"
                />
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Request Consultation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation View */
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-3">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <span>Consultation Request Dispatched</span>
                </div>
                <div className="text-xs space-y-1 opacity-90 leading-relaxed">
                  <div>Consultation ID: <b>{bookingConfirmed.consultation_id}</b></div>
                  <div>Doctor: <b>{bookingConfirmed.doctor_name}</b> ({bookingConfirmed.specialization})</div>
                  <div>Facility: <b>{bookingConfirmed.facility_name}</b></div>
                  <div>Scheduled Time: <b>{bookingConfirmed.scheduled_time}</b></div>
                  <div>Status: <span className="font-extrabold uppercase text-amber-600 dark:text-amber-400">PENDING DOCTOR ACCEPTANCE</span></div>
                </div>
              </div>

              {/* If Google Meet Link exists immediately */}
              {sessionData?.is_google_api_configured && sessionData?.meet_url ? (
                <div className="p-4 rounded-xl bg-emerald-600 text-white space-y-2">
                  <div className="font-bold text-xs">Direct Google Meet Link Ready</div>
                  <a
                    href={sessionData.meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 font-extrabold text-xs shadow hover:bg-slate-100 transition"
                  >
                    <span>Join Google Meet Consultation</span> <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                  <div className="font-bold">Google Meet Setup Notice</div>
                  <p className="leading-relaxed">
                    Once the attending physician approves the consultation, Google Calendar event & Google Meet link will be generated. You can check status on your dashboard.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
