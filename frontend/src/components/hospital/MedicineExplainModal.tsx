import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Pill, Loader2 } from 'lucide-react';
import medicineApi from '../../api/medicineApi';

interface MedicineExplainModalProps {
  medicineName: string;
  strength?: string;
  onClose: () => void;
}

export default function MedicineExplainModal({
  medicineName,
  strength,
  onClose
}: MedicineExplainModalProps) {
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchExplanation = async () => {
      try {
        setLoading(true);
        const res = await medicineApi.explainMedicine(medicineName, strength);
        if (isMounted) {
          setExplanation(res.explanation);
        }
      } catch (e) {
        if (isMounted) {
          setExplanation(
            `${medicineName} ${strength || ''} is a commonly prescribed therapeutic medicine. ` +
            `Always take as directed by your physician according to your clinical prescription. ` +
            `Consult your doctor or registered pharmacist for detailed dosage instructions.`
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchExplanation();
    return () => {
      isMounted = false;
    };
  }, [medicineName, strength]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl">
                💊
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
                    <Sparkles size={11} /> AI Clinical Explainer
                  </span>
                </div>
                <h3 className="text-xl font-black text-[var(--text-primary)] mt-1">
                  {medicineName} {strength}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Analyzing Clinical Drug Formulation...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line font-medium">
                {explanation}
              </div>

              {/* Disclaimer */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                <p>
                  <b>Clinical Disclaimer:</b> AI-assisted pharmacological summary for patient literacy only. Stock levels shown in the directory are verified directly from MongoDB facility records. Always adhere strictly to your healthcare provider's dosage directions.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
            >
              Understood
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
