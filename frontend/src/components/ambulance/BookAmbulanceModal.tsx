import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Truck, 
  MapPin, 
  Phone, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  Clock, 
  Navigation,
  Activity,
  PhoneCall
} from 'lucide-react';
import api from '../../api/instance';

interface Ambulance {
  ambulance_id: string;
  vehicle_type: string;
  operator: string;
  base_facility_name: string;
  distance_km?: number;
  status: string;
  equipment?: string[];
  emergency_phone?: string;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BookAmbulanceModal({ onClose, onSuccess }: Props) {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>('');
  const [pickupAddress, setPickupAddress] = useState('Sector 4, Central Station Corridor, Mumbai');
  const [emergencyType, setEmergencyType] = useState('Critical Medical Emergency');
  const [contactPhone, setContactPhone] = useState('+91 98200 00000');
  const [patientNotes, setPatientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  const fetchAmbulances = async () => {
    try {
      setLoading(true);
      const res = await api.get('/emergency/ambulances');
      const list = res.data.ambulances || [];
      setAmbulances(list);
      const available = list.find((a: Ambulance) => a.status === 'Available');
      if (available) {
        setSelectedAmbulanceId(available.ambulance_id);
      }
    } catch (e) {
      console.error("Failed to load ambulances", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmbulances();
  }, []);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmbulanceId) {
      setError('Please select an available ambulance from the fleet.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/emergency/ambulances/book', {
        ambulance_id: selectedAmbulanceId,
        pickup_address: pickupAddress,
        emergency_type: emergencyType,
        contact_phone: contactPhone,
        patient_notes: patientNotes
      });
      setBookingSuccess(res.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to book ambulance. Vehicle may be busy.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[var(--bg-card)] border border-rose-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        {!bookingSuccess ? (
          <form onSubmit={handleBook} className="space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">
                <ShieldAlert size={14} />
                <span>108 Emergency Dispatch Service</span>
              </div>
              <h3 className="text-2xl font-black text-[var(--text-primary)] flex items-center space-x-2">
                <span>Request Ambulance</span>
                <span className="text-xl">🚑</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                Real-time connection with State 108 Emergency Fleet & Hospital Units.
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

            {/* Helpline Banner */}
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-bold">
              <div className="flex items-center space-x-2">
                <PhoneCall size={16} className="animate-pulse" />
                <span>Immediate 24/7 Helpline: Dial 108 / 112</span>
              </div>
              <a href="tel:108" className="px-3 py-1 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">
                Call 108
              </a>
            </div>

            {/* Available Ambulances Fleet List */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                Select Nearest Available Ambulance
              </label>
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                  Scanning ambulance GPS nodes...
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {ambulances.map(amb => {
                    const isAvail = amb.status === 'Available';
                    const isSelected = selectedAmbulanceId === amb.ambulance_id;

                    return (
                      <div
                        key={amb.ambulance_id}
                        onClick={() => isAvail && setSelectedAmbulanceId(amb.ambulance_id)}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isAvail
                            ? isSelected
                              ? 'bg-rose-500/10 border-rose-500 shadow-sm cursor-pointer'
                              : 'bg-[var(--bg-primary)] border-[var(--border-main)] hover:border-slate-400 cursor-pointer'
                            : 'bg-slate-100 dark:bg-white/5 border-transparent opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <p className="font-bold text-xs text-[var(--text-primary)]">{amb.vehicle_type}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              isAvail ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              {amb.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {amb.base_facility_name} {amb.distance_km !== undefined ? `• ${amb.distance_km.toFixed(1)} km away` : ''}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-slate-500">{amb.ambulance_id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pickup Location & Emergency Type */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  Pickup Address / Landmark
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                  <input
                    required
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Enter precise building / street address..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                    Emergency Condition
                  </label>
                  <select
                    value={emergencyType}
                    onChange={(e) => setEmergencyType(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                  >
                    <option value="Severe Chest Pain">Severe Chest Pain / Heart Attack</option>
                    <option value="Road Accident & Trauma">Road Accident & Trauma</option>
                    <option value="Respiratory Distress">Respiratory Distress / Oxygen Loss</option>
                    <option value="Stroke / Neurological Emergency">Stroke / Neurological</option>
                    <option value="Maternal & Labor Emergency">Maternal & Labor</option>
                    <option value="General Critical Care">General Critical Care</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                    Emergency Contact Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98000 00000"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3 pl-10 pr-3 text-xs font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedAmbulanceId}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-50 text-sm uppercase tracking-wider"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
              <span>Confirm & Dispatch Ambulance</span>
            </button>
          </form>
        ) : (
          /* BOOKING CONFIRMED */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Truck size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[var(--text-primary)]">
                Ambulance Dispatched! 🚨
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Vehicle <span className="font-mono font-bold text-[var(--text-primary)]">{bookingSuccess.booking?.ambulance_id}</span> is responding to your location.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Dispatch ID:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{bookingSuccess.booking?.booking_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Operator:</span>
                <span className="font-bold text-[var(--text-primary)]">{bookingSuccess.booking?.operator}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-black uppercase text-[10px]">
                  Ambulance Requested • En Route
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pickup:</span>
                <span className="font-bold text-[var(--text-primary)] truncate max-w-[200px]">{bookingSuccess.booking?.pickup_address}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-wider"
            >
              Track in My Care Hub
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
