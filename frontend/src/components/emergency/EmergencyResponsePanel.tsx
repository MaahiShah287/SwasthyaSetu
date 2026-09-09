import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, ShieldAlert, Navigation, MapPin, Truck, AlertTriangle, X, CheckCircle2, Activity } from 'lucide-react';
import api from '../../api/instance';

interface EmergencyResponsePanelProps {
  onClose?: () => void;
  userLocation?: [number, number];
}

export default function EmergencyResponsePanel({ onClose, userLocation }: EmergencyResponsePanelProps) {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmergencyData = async () => {
      setLoading(true);
      try {
        const lat = userLocation ? userLocation[0] : 19.0760;
        const lon = userLocation ? userLocation[1] : 72.8777;

        const [ambRes, facRes] = await Promise.all([
          api.get(`/emergency/ambulances?user_lat=${lat}&user_lon=${lon}`),
          api.get(`/emergency/facilities?user_lat=${lat}&user_lon=${lon}`)
        ]);

        if (ambRes.data && ambRes.data.ambulances) {
          setAmbulances(ambRes.data.ambulances);
        }
        if (facRes.data && facRes.data.emergency_facilities) {
          setFacilities(facRes.data.emergency_facilities);
        }
      } catch (err) {
        console.error("Failed to load emergency coordination data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmergencyData();
  }, [userLocation]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-red-500/30 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-white"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-500/30">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Emergency Response & Ambulance Dispatch
                </h2>
                <p className="text-xs text-red-300 font-medium">
                  State 108 EMRI Emergency Network • 24/7 Acute Care Coordination
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Top Urgent Helplines Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="tel:108"
              className="p-5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shadow-xl shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition"
            >
              <div className="flex items-center gap-3">
                <PhoneCall className="w-7 h-7 animate-bounce" />
                <div>
                  <div className="text-xs font-black uppercase tracking-widest opacity-90">State Medical Ambulance</div>
                  <div className="text-2xl font-black">DIAL 108 NOW</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase">Free 24/7</span>
            </a>

            <a
              href="tel:112"
              className="p-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between shadow-xl shadow-amber-600/20 hover:scale-[1.02] active:scale-95 transition"
            >
              <div className="flex items-center gap-3">
                <PhoneCall className="w-7 h-7" />
                <div>
                  <div className="text-xs font-black uppercase tracking-widest opacity-90">National Emergency Helpline</div>
                  <div className="text-2xl font-black">DIAL 112 NOW</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase">All Services</span>
            </a>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Querying 108 Emergency Fleet & Hospital Database...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ambulance Fleet Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-red-400 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-red-500" />
                  <span>Verified Database Ambulances (State 108 Fleet)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ambulances.map((amb, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                            {amb.ambulance_id}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1">{amb.vehicle_type}</h4>
                          <p className="text-xs text-slate-400">{amb.base_facility_name} • {amb.distance_km} km away</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${amb.status === 'Available' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {amb.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {amb.equipment?.map((eq: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-700 text-slate-300">
                            {eq}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-between items-center border-t border-slate-700/60">
                        <span className="text-[11px] text-slate-400 font-medium">Operator: {amb.operator}</span>
                        <a
                          href="tel:108"
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Call 108
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nearby Emergency Hospitals */}
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>Nearest 24/7 Emergency Hospitals (MongoDB Sourced)</span>
                </h3>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {facilities.map((fac, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{fac.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                            ICU Beds: {fac.icu_beds_available}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fac.type} • {fac.distance_km} km away • {fac.address}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`, '_blank')}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Get Directions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-xs text-slate-400 leading-relaxed">
                <strong className="text-white">Emergency Disclaimer:</strong> Ambulance fleet status and hospital ICU bed counts are sourced from verified database records. For immediate emergency dispatch, dial <b>108</b> or <b>112</b> directly without delay.
              </div>
            </div>
          )}

          {/* Footer Close */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-200 transition"
            >
              Close Panel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
