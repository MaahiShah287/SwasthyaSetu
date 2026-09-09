import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Save, Loader2, Pill, AlertTriangle } from 'lucide-react';
import medicineApi from '../../api/medicineApi';
import { MedicineInventoryItem, AddMedicinePayload } from '../../types/medicine';

interface AddMedicineModalProps {
  facilityId: string;
  editItem?: MedicineInventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMedicineModal({
  facilityId,
  editItem,
  onClose,
  onSuccess
}: AddMedicineModalProps) {
  const isEditing = !!editItem;

  const [medicineName, setMedicineName] = useState(editItem?.medicine_name || '');
  const [genericName, setGenericName] = useState(editItem?.generic_name || '');
  const [strength, setStrength] = useState(editItem?.strength || '500mg');
  const [form, setForm] = useState(editItem?.form || 'Tablet');
  const [category, setCategory] = useState(editItem?.category || 'Antipyretic / Analgesic');
  const [quantity, setQuantity] = useState<number>(editItem?.quantity ?? 100);
  const [minimumStock, setMinimumStock] = useState<number>(editItem?.minimum_stock ?? 30);
  const [batchNumber, setBatchNumber] = useState(editItem?.batch_number || `BAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [expiryDate, setExpiryDate] = useState(editItem?.expiry_date ? editItem.expiry_date.slice(0, 10) : '2027-12-31');
  const [unit, setUnit] = useState(editItem?.unit || 'Tablets');
  const [priceInr, setPriceInr] = useState(editItem?.price_inr || '₹0 (Govt Free Supply)');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim() || !strength.trim()) {
      setError('Medicine name and strength are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEditing && editItem) {
        await medicineApi.updateMedicineDetails(editItem.inventory_id, {
          medicine_name: medicineName,
          generic_name: genericName || medicineName,
          strength,
          form,
          category,
          quantity: Number(quantity),
          minimum_stock: Number(minimumStock),
          batch_number: batchNumber,
          expiry_date: expiryDate,
          unit,
          price_inr: priceInr
        });
      } else {
        const payload: AddMedicinePayload = {
          facility_id: facilityId,
          medicine_name: medicineName,
          generic_name: genericName || medicineName,
          strength,
          form,
          category,
          quantity: Number(quantity),
          minimum_stock: Number(minimumStock),
          batch_number: batchNumber,
          expiry_date: expiryDate,
          unit,
          price_inr: priceInr
        };
        await medicineApi.addMedicine(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save medicine:', err);
      setError(err.response?.data?.detail || 'Failed to save medicine record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dosageForms = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Sachet', 'Inhaler', 'Drops', 'Ointment'];
  const categories = [
    'Antipyretic / Analgesic',
    'Antibiotic',
    'Antidiabetic',
    'Antihistamine / Allergy',
    'Essential Pediatric / Hydration',
    'Cardiovascular / Antihypertensive',
    'Gastrointestinal',
    'Respiratory',
    'Maternal Health'
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl shadow-2xl p-6 md:p-8 space-y-5"
        >
          {/* Top Header */}
          <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
                <Pill size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)]">
                  {isEditing ? 'Edit Medicine Stock' : 'Add Medicine to Inventory'}
                </h3>
                <p className="text-xs text-slate-500">
                  Facility-reported medicine stock & minimum threshold configuration.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Medicine Brand / Name *
                </label>
                <input
                  type="text"
                  required
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  placeholder="e.g. Paracetamol, Amoxicillin"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Generic Formulation
                </label>
                <input
                  type="text"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder="e.g. Acetaminophen, Amoxicillin Trihydrate"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Strength *
                </label>
                <input
                  type="text"
                  required
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  placeholder="500mg, 10mg, 250mg/5ml"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Dosage Form
                </label>
                <select
                  value={form}
                  onChange={(e) => setForm(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                >
                  {dosageForms.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Unit Metric
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                >
                  <option value="Tablets">Tablets</option>
                  <option value="Capsules">Capsules</option>
                  <option value="Strips">Strips</option>
                  <option value="Bottles">Bottles</option>
                  <option value="Vials">Vials</option>
                  <option value="Sachets">Sachets</option>
                  <option value="Puffs">Puffs (Inhaler)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                Therapeutic Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Quantity & Minimum Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Current In-Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-lg font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 font-normal mt-1">
                  Status auto-calculated: 0 = Out of Stock, &le; min = Low Stock
                </p>
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Minimum Stock Threshold *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(Number(e.target.value))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-lg font-black text-amber-600 dark:text-amber-400 outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 font-normal mt-1">
                  Triggers automatic in-app alerts when quantity falls below this level
                </p>
              </div>
            </div>

            {/* Batch & Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Batch / Lot Number
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. PCM-2026-09A"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1.5">
                Supply / Price Specification
              </label>
              <input
                type="text"
                value={priceInr}
                onChange={(e) => setPriceInr(e.target.value)}
                placeholder="e.g. ₹0 (Jan Aushadhi / Govt Free) or ₹15.00"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-[var(--text-primary)]"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[var(--border-main)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-main)] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center space-x-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : isEditing ? <Save size={15} /> : <Plus size={15} />}
                <span>{isEditing ? 'Save Changes' : 'Add Medicine'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
