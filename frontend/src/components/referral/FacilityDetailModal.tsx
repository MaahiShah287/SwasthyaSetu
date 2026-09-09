import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  X, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Bed, 
  Activity, 
  Video, 
  Navigation, 
  UserCheck, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { ScoredFacility } from '../../types/referral';

interface FacilityDetailModalProps {
  scoredFacility: ScoredFacility | null;
  onClose: () => void;
  onStartTelemedicine?: (url?: string | null) => void;
}

export default function FacilityDetailModal({
  scoredFacility,
  onClose,
  onStartTelemedicine
}: FacilityDetailModalProps) {
  if (!scoredFacility) return null;

  const { facility, distance_km, total_score, rationale, data_freshness_text, is_stale, score_breakdown } = scoredFacility;

  const handleDirections = () => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {total_score}% Compatibility Match
                  </span>
                  {facility.is_24x7_emergency && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> 24/7 ER Ready
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {facility.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {facility.type} • {distance_km} km away
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

          {/* Stale Warning Banner */}
          {is_stale && (
            <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <b>Data Freshness Notice:</b> {data_freshness_text}. Availability numbers (beds/doctors) may not reflect guaranteed real-time status.
              </div>
            </div>
          )}

          {/* Selection Rationale */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-500" /> Why Selected
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {rationale}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <Bed className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500 dark:text-slate-400">Available Beds</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {facility.available_beds} <span className="text-xs text-slate-400 font-normal">/ {facility.total_beds}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <Activity className="w-5 h-5 text-rose-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500 dark:text-slate-400">ICU Beds</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {facility.icu_beds_available}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <Clock className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500 dark:text-slate-400">Operating Hours</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {facility.operating_hours}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <CheckCircle2 className="w-5 h-5 text-sky-500 mx-auto mb-1" />
              <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {facility.status}
              </div>
            </div>
          </div>

          {/* Detailed Score Breakdown */}
          <div className="mt-5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Transparent Score Breakdown (Total {total_score}/100)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">Service Match</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{score_breakdown.service_match} / 35 pts</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">Urgency Compatibility</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{score_breakdown.urgency_compatibility} / 25 pts</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">Distance Proximity</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{score_breakdown.distance_proximity} / 20 pts</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">Availability & Beds</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{score_breakdown.availability} / 10 pts</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">Facility Resources</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{score_breakdown.capability} / 10 pts</span>
              </div>
              {score_breakdown.stale_data_penalty > 0 && (
                <div className="flex justify-between items-center p-2 rounded-xl bg-amber-500/10">
                  <span className="text-amber-700 dark:text-amber-300">Stale Data Penalty</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">-{score_breakdown.stale_data_penalty} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Available Services */}
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Available Medical Services
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {facility.services.map((svc, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                >
                  {svc}
                </span>
              ))}
            </div>
          </div>

          {/* Specialists */}
          {facility.specialists && facility.specialists.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Available Specialists
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {facility.specialists.map((spec, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" /> {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Location & Contact Info */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{facility.address}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Phone: {facility.phone}</span>
            </div>
          </div>

          {/* Direct Actions & CTAs */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
            <button
              onClick={handleDirections}
              className="flex-1 min-w-[160px] px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition"
            >
              <Navigation className="w-4 h-4" /> Get Directions
            </button>

            {facility.has_telemedicine && (
              facility.telemedicine_url && !facility.telemedicine_url.includes('swasthyasetu.gov.in') ? (
                <button
                  onClick={() => {
                    onClose();
                    window.open(facility.telemedicine_url!, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 min-w-[160px] px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Video className="w-4 h-4" /> Start Telemedicine
                </button>
              ) : (
                <div className="flex-1 min-w-[160px] px-4 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs flex items-center justify-center gap-2">
                  <Video className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Telemedicine via Facility Desk ({facility.phone})</span>
                </div>
              )
            )}

            {facility.emergency_phone && (
              <a
                href={`tel:${facility.emergency_phone}`}
                className="px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-sm border border-red-500/30 flex items-center justify-center gap-2 transition"
              >
                <Phone className="w-4 h-4" /> Call {facility.emergency_phone}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
