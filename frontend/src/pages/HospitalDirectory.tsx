import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  MapPin, 
  Phone, 
  Bed, 
  Activity, 
  ShieldAlert, 
  Truck, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Loader2,
  Calendar,
  ExternalLink,
  Map as MapIcon,
  Syringe,
  Navigation,
  Check,
  Pill,
  Sparkles,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  FlaskConical
} from 'lucide-react';
import api from '../api/instance';
import medicineApi from '../api/medicineApi';
import diagnosticApi from '../api/diagnosticApi';
import { useTheme } from '../context/ThemeContext';
import BookHospitalModal from '../components/hospital/BookHospitalModal';
import BookAmbulanceModal from '../components/ambulance/BookAmbulanceModal';
import FacilityDetailModal from '../components/referral/FacilityDetailModal';
import MedicineAvailabilityMap from '../components/hospital/MedicineAvailabilityMap';
import MedicineExplainModal from '../components/hospital/MedicineExplainModal';
import { MedicineAvailabilityResult, MedicineSuggestion } from '../types/medicine';
import { DiagnosticAvailabilityResult, DiagnosticSuggestion } from '../types/diagnostic';

export default function HospitalDirectory() {
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();

  // URL query parameters (e.g. from Prescription "Check Medicine Availability" click)
  const initialMedicineParam = searchParams.get('medicine');
  const initialStrengthParam = searchParams.get('strength');
  const initialTabParam = searchParams.get('tab') || searchParams.get('view');
  const isInitialMedicineMode = initialTabParam === 'medicine' || initialTabParam === 'medicines' || !!initialMedicineParam;

  // Directory Mode: Facilities & Beds vs Medicine vs Diagnostics
  const isInitialDiagnosticsMode = initialTabParam === 'diagnostics' || initialTabParam === 'diagnostic';
  const [directoryMode, setDirectoryMode] = useState<'facilities' | 'medicines' | 'diagnostics'>(
    isInitialDiagnosticsMode ? 'diagnostics' : isInitialMedicineMode ? 'medicines' : 'facilities'
  );

  // Pre-filled test from URL (e.g. from patient dashboard "Find Diagnostic Centre")
  const initialTestParam = searchParams.get('test') || '';

  // Healthcare Facilities State
  const initialCategory = searchParams.get('facility_type') || searchParams.get('category') || searchParams.get('type') || 'All';
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory.toLowerCase().includes('vaccin') ? 'Vaccination Centre' : 
    initialCategory.toLowerCase().includes('phc') ? 'PHC' :
    initialCategory.toLowerCase().includes('chc') ? 'CHC' :
    initialCategory.toLowerCase().includes('sub') ? 'Sub-Centre' :
    initialCategory.toLowerCase().includes('hosp') ? 'Hospitals' : 'All'
  );
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Medicine Availability State
  const [medicineQuery, setMedicineQuery] = useState(initialMedicineParam || 'Paracetamol');
  const [medicineStatusFilter, setMedicineStatusFilter] = useState('ALL');
  const [medicineResults, setMedicineResults] = useState<MedicineAvailabilityResult[]>([]);
  const [medicineSummary, setMedicineSummary] = useState<{ total: number; available: number; low: number; out: number }>({
    total: 0, available: 0, low: 0, out: 0
  });
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [medicineViewType, setMedicineViewType] = useState<'cards' | 'map'>('cards');
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [explainingMedicine, setExplainingMedicine] = useState<{ name: string; strength?: string } | null>(null);
  const [selectedMedicineForDetail, setSelectedMedicineForDetail] = useState<MedicineAvailabilityResult | null>(null);

  // Modals State
  const [selectedHospitalForBooking, setSelectedHospitalForBooking] = useState<any | null>(null);
  const [selectedHospitalDetail, setSelectedHospitalDetail] = useState<any | null>(null);
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);

  // Diagnostics State
  const [diagnosticQuery, setDiagnosticQuery] = useState(initialTestParam || 'CBC');
  const [diagnosticStatusFilter, setDiagnosticStatusFilter] = useState('ALL');
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticAvailabilityResult[]>([]);
  const [diagnosticSummary, setDiagnosticSummary] = useState({ total: 0, available: 0, limited: 0, unavailable: 0 });
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagnosticSuggestions, setDiagnosticSuggestions] = useState<DiagnosticSuggestion[]>([]);
  const [showDiagnosticSuggestions, setShowDiagnosticSuggestions] = useState(false);

  // Fetch Facilities
  const fetchHospitals = async () => {
    try {
      setLoadingFacilities(true);
      const params: any = {};
      if (selectedCity !== 'All') params.city = selectedCity;
      if (emergencyOnly) params.emergency_only = true;
      if (selectedCategory !== 'All') {
        params.facility_type = selectedCategory === 'Hospitals' ? 'hospital' : selectedCategory.toLowerCase().replace(' ', '_');
      }
      if (userLocation) {
        params.user_lat = userLocation.lat;
        params.user_lon = userLocation.lon;
      }
      const res = await api.get('/hospitals', { params });
      setFacilities(res.data.facilities || []);
    } catch (e) {
      console.error("Failed to fetch healthcare facilities", e);
    } finally {
      setLoadingFacilities(false);
    }
  };

  // Fetch Medicine Availability
  const fetchMedicineAvailability = async (queryStr?: string) => {
    const term = queryStr !== undefined ? queryStr : medicineQuery;
    if (!term.trim()) return;

    try {
      setLoadingMedicines(true);
      const params: any = {
        query: term.trim(),
        status: medicineStatusFilter !== 'ALL' ? medicineStatusFilter : undefined,
        city: selectedCity !== 'All' ? selectedCity : undefined,
        user_lat: userLocation ? userLocation.lat : 19.0760,
        user_lon: userLocation ? userLocation.lon : 72.8777,
      };
      if (selectedCategory !== 'All') {
        params.facility_type = selectedCategory === 'Hospitals' ? 'hospital' : selectedCategory.toLowerCase().replace(' ', '_');
      }
      const data = await medicineApi.checkAvailability(params);
      setMedicineResults(data.results || []);
      setMedicineSummary({
        total: data.total_results || 0,
        available: data.available_count || 0,
        low: data.low_stock_count || 0,
        out: data.out_of_stock_count || 0
      });
    } catch (e) {
      console.error("Failed to fetch medicine availability", e);
    } finally {
      setLoadingMedicines(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, [selectedCity, selectedCategory, emergencyOnly, userLocation]);

  useEffect(() => {
    if (directoryMode === 'medicines') {
      fetchMedicineAvailability();
    }
  }, [directoryMode, medicineStatusFilter, selectedCity, userLocation]);

  // Fetch Diagnostic Availability
  const fetchDiagnosticAvailability = async (queryStr?: string) => {
    const term = queryStr !== undefined ? queryStr : diagnosticQuery;
    if (!term.trim()) return;
    try {
      setLoadingDiagnostics(true);
      const data = await diagnosticApi.checkAvailability({
        query: term.trim(),
        status: diagnosticStatusFilter !== 'ALL' ? diagnosticStatusFilter : undefined,
        city: selectedCity !== 'All' ? selectedCity : undefined,
        user_lat: userLocation ? userLocation.lat : 19.0760,
        user_lon: userLocation ? userLocation.lon : 72.8777,
      });
      setDiagnosticResults(data.results || []);
      setDiagnosticSummary({
        total: data.total_results || 0,
        available: data.available_count || 0,
        limited: data.limited_count || 0,
        unavailable: data.unavailable_count || 0,
      });
    } catch (e) { console.error('Diagnostic fetch error', e); }
    finally { setLoadingDiagnostics(false); }
  };

  useEffect(() => {
    if (directoryMode === 'diagnostics') {
      fetchDiagnosticAvailability();
    }
  }, [directoryMode, diagnosticStatusFilter, selectedCity, userLocation]);

  // Diagnostic autocomplete
  useEffect(() => {
    if (!diagnosticQuery || diagnosticQuery.length < 2) { setDiagnosticSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const s = await diagnosticApi.searchDiagnostics(diagnosticQuery);
        setDiagnosticSuggestions(s);
      } catch { }
    }, 250);
    return () => clearTimeout(timer);
  }, [diagnosticQuery]);

  // Autocomplete fetch
  useEffect(() => {
    if (!medicineQuery || medicineQuery.length < 2) {
      setMedicineSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const suggestions = await medicineApi.searchMedicines(medicineQuery);
        setMedicineSuggestions(suggestions);
      } catch (e) {
        // silent
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [medicineQuery]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        setUserLocation(coords);
        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocating(false);
        alert("Unable to fetch GPS location. Using default regional coordinates.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const filteredFacilities = facilities.filter(fac => {
    const q = searchQuery.toLowerCase();
    const matchesName = fac.name?.toLowerCase().includes(q);
    const matchesCity = fac.city?.toLowerCase().includes(q) || fac.district?.toLowerCase().includes(q);
    const matchesDept = fac.departments && fac.departments.some((d: string) => d.toLowerCase().includes(q));
    const matchesServices = fac.services && fac.services.some((s: string) => s.toLowerCase().includes(q));
    return matchesName || matchesCity || matchesDept || matchesServices;
  });

  const getBedCount = (fac: any, type: 'general' | 'icu' | 'emergency') => {
    const cap = fac.bed_capacity || {};
    if (type === 'general') return cap.general_available ?? fac.available_beds ?? 20;
    if (type === 'icu') return cap.icu_available ?? fac.icu_beds_available ?? 5;
    if (type === 'emergency') return cap.emergency_available ?? fac.emergency_beds ?? 3;
    return 0;
  };

  const facilityTypes = ['All', 'Hospitals', 'PHC', 'CHC', 'Sub-Centre', 'Vaccination Centre'];

  const popularMedicines = [
    'Paracetamol 500mg',
    'Amoxicillin 500mg',
    'Metformin 500mg',
    'Cetirizine 10mg',
    'ORS Sachet',
    'Azithromycin 500mg',
    'Amlodipine 5mg'
  ];

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-2">
            <Building2 size={13} />
            <span>Healthcare Access Directory</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Healthcare <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Access Directory</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Real-time verified District Hospitals, PHCs, CHCs, Sub-Centres, beds, and medicine stock.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center space-x-2 border border-indigo-500/20 transition-all"
          >
            {locating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
            <span>{userLocation ? '📍 Location Active' : '📍 Use My Location'}</span>
          </button>

          <button
            onClick={() => setShowAmbulanceModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-rose-500/20 transition-all active:scale-95"
          >
            <Truck size={15} />
            <span>Request Ambulance</span>
          </button>
        </div>
      </div>

      {/* Directory Mode Switcher: Facilities/Beds vs Medicine Availability */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
        <div className="flex items-center space-x-2 p-1.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-sm">
          <button
            onClick={() => setDirectoryMode('facilities')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              directoryMode === 'facilities'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Building2 size={14} />
            <span>🏥 Facilities & Beds Matrix</span>
          </button>

          <button
            onClick={() => {
              setDirectoryMode('medicines');
              if (medicineResults.length === 0) {
                fetchMedicineAvailability(medicineQuery);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              directoryMode === 'medicines'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Pill size={14} />
            <span>💊 Medicine Availability & Stock</span>
          </button>

          <button
            onClick={() => {
              setDirectoryMode('diagnostics');
              if (diagnosticResults.length === 0) fetchDiagnosticAvailability(diagnosticQuery);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              directoryMode === 'diagnostics'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <FlaskConical size={14} />
            <span>🔬 Diagnostic Services</span>
          </button>
        </div>

        {/* City Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">Region:</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-2 px-3 text-xs font-bold outline-none focus:border-indigo-500 text-[var(--text-primary)]"
          >
            <option value="All">All Cities / Districts</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Thane">Thane</option>
            <option value="Raigad">Raigad</option>
            <option value="Pune">Pune</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: MEDICINE AVAILABILITY & STOCK MANAGEMENT */}
      {/* ========================================================================= */}
      {directoryMode === 'medicines' && (
        <div className="space-y-6">
          {/* Active Search & Autocomplete Input */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={medicineQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setMedicineQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSuggestions(false);
                    fetchMedicineAvailability(medicineQuery);
                  }
                }}
                placeholder="Search prescribed medicine (e.g., Paracetamol, Amoxicillin, Metformin, ORS)..."
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-4 pl-12 pr-28 outline-none focus:border-emerald-500 text-sm font-bold text-[var(--text-primary)] shadow-md"
              />

              <button
                onClick={() => {
                  setShowSuggestions(false);
                  fetchMedicineAvailability(medicineQuery);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              >
                Search Stock
              </button>

              {/* Autocomplete Dropdown */}
              {showSuggestions && medicineSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Suggested Verified Medicines
                  </div>
                  {medicineSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMedicineQuery(`${sug.medicine_name} ${sug.strength}`.trim());
                        setShowSuggestions(false);
                        fetchMedicineAvailability(sug.medicine_name);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-500/10 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] transition"
                    >
                      <div className="flex items-center space-x-2">
                        <Pill size={14} className="text-emerald-500" />
                        <span>{sug.medicine_name} <span className="font-mono text-[11px] text-slate-400">{sug.strength}</span></span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">{sug.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Popular Quick Prescribed Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex-shrink-0">Common:</span>
              {popularMedicines.map((med) => (
                <button
                  key={med}
                  onClick={() => {
                    setMedicineQuery(med);
                    setShowSuggestions(false);
                    const cleanName = med.split(' ')[0];
                    fetchMedicineAvailability(cleanName);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center space-x-1.5 ${
                    medicineQuery.toLowerCase().includes(med.split(' ')[0].toLowerCase())
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-[var(--bg-card)] border-[var(--border-main)] text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <Pill size={12} />
                  <span>{med}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Filters & View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
              {[
                { id: 'ALL', label: 'All Statuses' },
                { id: 'AVAILABLE', label: '🟢 Available' },
                { id: 'LOW_STOCK', label: '🟡 Low Stock' },
                { id: 'OUT_OF_STOCK', label: '🔴 Out of Stock' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setMedicineStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    medicineStatusFilter === st.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-[var(--bg-primary)] border-[var(--border-main)] text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* View Switcher: Cards vs Map */}
            <div className="flex items-center space-x-2 bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-main)]">
              <button
                onClick={() => setMedicineViewType('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  medicineViewType === 'cards'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Layers size={13} />
                <span>Facility Cards</span>
              </button>

              <button
                onClick={() => setMedicineViewType('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  medicineViewType === 'map'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <MapIcon size={13} />
                <span>Interactive Map</span>
              </button>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2 text-xs">
            <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold">
              <span>💊 Availability for &ldquo;<b>{medicineQuery}</b>&rdquo;</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-semibold">{medicineResults.length} facilities within range (sorted by distance)</span>
            </div>

            <div className="flex items-center space-x-3 font-extrabold text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400">🟢 {medicineSummary.available} Available</span>
              <span className="text-amber-600 dark:text-amber-400">🟡 {medicineSummary.low} Low Stock</span>
              <span className="text-rose-600 dark:text-rose-400">🔴 {medicineSummary.out} Out of Stock</span>
            </div>
          </div>

          {/* RESULTS CONTENT */}
          {loadingMedicines ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-emerald-600" size={36} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Querying Real-Time Medicine Stock Across Healthcare Facilities...
              </p>
            </div>
          ) : medicineViewType === 'map' ? (
            /* MAP VIEW */
            <div className="space-y-4">
              <MedicineAvailabilityMap
                userLocation={userLocation || { lat: 19.0760, lon: 72.8777 }}
                results={medicineResults}
                onSelectFacility={(item) => {
                  setSelectedMedicineForDetail(item);
                  setSelectedHospitalDetail(item.facility);
                }}
              />
              <p className="text-xs text-slate-400 italic text-center">
                Interactive map: Markers indicate live stock reported by healthcare facilities. Click any marker for navigation directions.
              </p>
            </div>
          ) : medicineResults.length > 0 ? (
            /* CARDS VIEW (Matching exact prompt format) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {medicineResults.map((item, idx) => {
                const { facility, status, quantity, medicine_name, strength, form, distance_km, last_updated_text, batch_number, expiry_date, price_inr } = item;
                const isAvailable = status === 'AVAILABLE';
                const isLow = status === 'LOW_STOCK';
                const isOut = status === 'OUT_OF_STOCK';

                return (
                  <motion.div
                    key={item.inventory_id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`premium-card p-6 flex flex-col justify-between space-y-5 hover:shadow-xl transition-all border ${
                      isOut ? 'border-rose-500/30' : isLow ? 'border-amber-500/30' : 'border-emerald-500/20'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Header: Facility Name + Stock Status Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-inner ${
                            isAvailable ? 'bg-emerald-500/10 text-emerald-600' : isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {isAvailable ? '🟢' : isLow ? '🟡' : '🔴'}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{facility.name}</h4>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center mt-1">
                              <MapPin size={12} className="mr-1 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{facility.address || facility.city}</span>
                              <span className="ml-2 font-black text-indigo-600 dark:text-indigo-400">
                                • {distance_km < 1 ? `${Math.round(distance_km * 1000)}m` : `${distance_km.toFixed(1)} km`}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end space-y-1">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex-shrink-0 ${
                            isAvailable
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : isLow
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}>
                            {isAvailable ? '🟢 Available' : isLow ? '🟡 Low Stock' : '🔴 Out of Stock'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {facility.category || facility.type}
                          </span>
                        </div>
                      </div>

                      {/* Medicine Stock Details Box */}
                      <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-[var(--text-primary)]">💊 {medicine_name}</span>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                              {strength} • {form}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`text-base font-black ${
                              isAvailable ? 'text-emerald-600 dark:text-emerald-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {quantity} {item.unit || 'units'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border-main)] text-[10px] font-medium text-slate-500">
                          <div>
                            <span className="text-slate-400">Batch:</span> <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{batch_number}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Expiry:</span> <span className="font-bold text-slate-600 dark:text-slate-300">{expiry_date}</span>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-slate-400">Supply:</span> <span className="font-bold text-emerald-600">{price_inr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Last updated timestamp notice */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>Last updated: <b className="text-slate-600 dark:text-slate-300">{last_updated_text}</b></span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-slate-500">
                          Facility-reported data
                        </span>
                      </div>
                    </div>

                    {/* Card Action Buttons: View on Map + Get Directions + Book Slot + AI Info */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-main)]">
                      {/* Get Directions (Primary) */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 min-w-[130px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition"
                        title="Get Directions on Google Maps"
                      >
                        <Navigation size={13} />
                        <span>Get Directions</span>
                      </a>

                      {/* View on Map */}
                      <button
                        onClick={() => {
                          setSelectedMedicineForDetail(item);
                          setSelectedHospitalDetail(facility);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center space-x-1 border border-indigo-500/20 transition"
                        title="View Facility Details & Map"
                      >
                        <MapIcon size={14} />
                        <span>View on Map</span>
                      </button>

                      {/* Book Appointment */}
                      <button
                        onClick={() => setSelectedHospitalForBooking(facility)}
                        className="px-3 py-2.5 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs border border-[var(--border-main)] transition"
                        title="Book Appointment at Facility"
                      >
                        <Calendar size={13} />
                        <span>Book Visit</span>
                      </button>

                      {/* AI Medicine Info */}
                      <button
                        onClick={() => setExplainingMedicine({ name: medicine_name, strength })}
                        className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 transition"
                        title="Clinical Guidance & Usage Instructions"
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="premium-card p-12 text-center space-y-3">
              <Pill size={40} className="text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No Facilities Found for &ldquo;{medicineQuery}&rdquo;</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No nearby healthcare facilities reported stock matching this search. Try searching by generic name (e.g. Paracetamol, Amoxicillin, Metformin) or click one of the quick chips above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE: DIAGNOSTIC SERVICE AVAILABILITY */}
      {/* ========================================================================= */}
      {directoryMode === 'diagnostics' && (
        <div className="space-y-6">
          {/* Search Input */}
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FlaskConical size={16} className="text-violet-500" />
              </div>
              <input
                type="text"
                value={diagnosticQuery}
                onChange={e => { setDiagnosticQuery(e.target.value); setShowDiagnosticSuggestions(true); }}
                onFocus={() => setShowDiagnosticSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDiagnosticSuggestions(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter') { setShowDiagnosticSuggestions(false); fetchDiagnosticAvailability(diagnosticQuery); } }}
                placeholder="Search diagnostic test: CT Scan, MRI, CBC, X-Ray…"
                className="w-full pl-10 pr-28 py-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-[var(--text-primary)] placeholder-slate-400"
              />
              <button
                onClick={() => { setShowDiagnosticSuggestions(false); fetchDiagnosticAvailability(diagnosticQuery); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Search
              </button>
              {showDiagnosticSuggestions && diagnosticSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl max-h-56 overflow-y-auto">
                  {diagnosticSuggestions.map(s => (
                    <button key={s.service_name}
                      onMouseDown={() => { setDiagnosticQuery(s.service_name); setShowDiagnosticSuggestions(false); fetchDiagnosticAvailability(s.service_name); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-500/10 flex justify-between items-center border-b border-[var(--border-main)] last:border-0">
                      <div className="flex items-center gap-2">
                        <FlaskConical size={13} className="text-violet-500 shrink-0" />
                        <span className="font-medium">{s.service_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">{s.category}</span>
                        {s.facility_count > 0 && <span>{s.facility_count} facilities</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Test Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Quick:</span>
              {['CBC', 'X-Ray (Chest / Bone)', 'ECG (Electrocardiogram)', 'Blood Glucose (Fasting/PP)', 'CT Scan', 'Ultrasound (Abdomen/Pelvis)', 'MRI', 'Lipid Profile'].map(test => (
                <button key={test}
                  onClick={() => { setDiagnosticQuery(test); fetchDiagnosticAvailability(test); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                    diagnosticQuery === test ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
                  }`}>{test}</button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Availability:</span>
              {[['ALL', 'All'], ['AVAILABLE', '🟢 Available'], ['LIMITED', '🟡 Limited'], ['UNAVAILABLE', '🔴 Unavailable']].map(([val, label]) => (
                <button key={val} onClick={() => { setDiagnosticStatusFilter(val); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    diagnosticStatusFilter === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-card)] border-[var(--border-main)] text-slate-500 hover:border-violet-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          {diagnosticResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[['Total', diagnosticSummary.total, 'text-slate-500', 'bg-slate-500/10'], ['Available', diagnosticSummary.available, 'text-emerald-500', 'bg-emerald-500/10'], ['Limited', diagnosticSummary.limited, 'text-amber-500', 'bg-amber-500/10'], ['Unavailable', diagnosticSummary.unavailable, 'text-rose-500', 'bg-rose-500/10']].map(([label, count, textCls, bgCls]) => (
                <div key={label as string} className={`rounded-2xl p-3 text-center border border-[var(--border-main)] ${bgCls}`}>
                  <p className={`text-xl font-black ${textCls}`}>{count}</p>
                  <p className={`text-xs font-semibold ${textCls}`}>{label} Facilities</p>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {loadingDiagnostics ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-violet-600" size={36} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Finding Nearby Diagnostic Facilities…</p>
            </div>
          ) : diagnosticResults.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {diagnosticResults.map((item, idx) => {
                const { facility, availability, service_name, operating_hours, appointment_required, price_inr, last_updated_text, notes, distance_km } = item;
                const isAvail = availability === 'AVAILABLE';
                const isLimited = availability === 'LIMITED';

                return (
                  <motion.div key={item.service_id || idx}
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                    className={`premium-card p-6 flex flex-col justify-between space-y-5 hover:shadow-xl transition-all border ${
                      !isAvail && !isLimited ? 'border-rose-500/30' : isLimited ? 'border-amber-500/30' : 'border-violet-500/20'
                    }`}>
                    {/* Facility header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1.5 rounded-lg shrink-0 ${ isAvail ? 'bg-emerald-500/10 text-emerald-500' : isLimited ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500' }`}>
                            <FlaskConical size={14} />
                          </div>
                          <span className="font-black text-sm truncate">{service_name}</span>
                        </div>
                        <h3 className="font-bold text-base">{facility.name}</h3>
                        <p className="text-xs text-slate-500">{facility.type}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isAvail ? 'bg-emerald-500/10 text-emerald-500' : isLimited ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {isAvail ? '🟢' : isLimited ? '🟡' : '🔴'}
                          {isAvail ? 'Available' : isLimited ? 'Limited' : 'Unavailable'}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-semibold">{distance_km.toFixed(1)} km</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-xs">
                      {facility.address && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin size={11} className="shrink-0" /><span>{facility.address}</span>
                        </div>
                      )}
                      {operating_hours && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock size={11} className="shrink-0" /><span>{operating_hours}</span>
                          {appointment_required && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">Appt. Required</span>}
                        </div>
                      )}
                      {price_inr && price_inr !== 'N/A' && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="font-bold">Fee:</span><span>{price_inr}</span>
                        </div>
                      )}
                      {notes && (
                        <div className="flex items-start gap-1.5 text-slate-500">
                          <Info size={11} className="shrink-0 mt-0.5" /><span>{notes}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock size={10} /><span>Updated: {last_updated_text}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-main)]">
                      <a href={facility.directions_url} target="_blank" rel="noreferrer"
                        className="flex-1 min-w-[130px] bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 text-xs shadow-md shadow-violet-500/20 active:scale-[0.98] transition">
                        <Navigation size={13} /><span>Get Directions</span>
                      </a>
                      <button onClick={() => setSelectedHospitalDetail(facility)}
                        className="px-3 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center space-x-1 border border-indigo-500/20 transition">
                        <MapIcon size={14} /><span>View Details</span>
                      </button>
                      <button onClick={() => setSelectedHospitalForBooking(facility)}
                        className="px-3 py-2.5 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs border border-[var(--border-main)] transition">
                        <Calendar size={13} className="inline mr-1" /><span>Book Visit</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="premium-card p-12 text-center space-y-3">
              <FlaskConical size={40} className="text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold">No Facilities Found for &ldquo;{diagnosticQuery}&rdquo;</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No nearby facilities reported this diagnostic service. Try a different test name or select a quick chip above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: FACILITIES & BEDS DIRECTORY (EXISTING VIEW) */}
      {/* ========================================================================= */}
      {directoryMode === 'facilities' && (
        <div className="space-y-6">
          {/* Vaccination Filter Active Notice */}
          {selectedCategory === 'Vaccination Centre' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <Syringe size={20} />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-[var(--text-primary)]">Filtered by Government Vaccination Centres</p>
                  <p className="text-xs text-slate-500">Showing facilities offering National Immunization Schedule (NIS) vaccines & pediatric care.</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                Clear Filter
              </button>
            </motion.div>
          )}

          {/* Category Pills Filter */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-2 flex-shrink-0">Facility Type:</span>
            {facilityTypes.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                      : 'bg-[var(--bg-card)] border-[var(--border-main)] text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {cat === 'Vaccination Centre' && <Syringe size={14} />}
                  {cat === 'Hospitals' && <Building2 size={14} />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by facility name, district, vaccine service (BCG, Pentavalent)..."
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-indigo-500 text-sm font-bold text-[var(--text-primary)] shadow-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setEmergencyOnly(!emergencyOnly)}
                className={`w-full px-4 py-3.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                  emergencyOnly 
                    ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm' 
                    : 'bg-[var(--bg-card)] border-[var(--border-main)] text-slate-500 hover:border-slate-400'
                }`}
              >
                🚨 24/7 Trauma Emergency
              </button>
            </div>
          </div>

          {/* Hospital Cards Grid */}
          {loadingFacilities ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-indigo-600" size={36} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Loading Real-time Facilities from Healthcare Access Directory...
              </p>
            </div>
          ) : filteredFacilities.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredFacilities.map((fac, idx) => {
                const genBeds = getBedCount(fac, 'general');
                const icuBeds = getBedCount(fac, 'icu');
                const emgBeds = getBedCount(fac, 'emergency');

                const isVaccinationFacility = (fac.facility_type === 'vaccination_centre' || fac.category === 'Vaccination Centre' || (fac.services && fac.services.some((s: string) => s.toLowerCase().includes('vaccin') || s.toLowerCase().includes('immunization'))));

                return (
                  <motion.div
                    key={fac.facility_id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="premium-card p-6 flex flex-col justify-between space-y-5 hover:border-indigo-500/50 hover:shadow-xl transition-all"
                  >
                    <div className="space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-inner ${
                            isVaccinationFacility ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {isVaccinationFacility ? '💉' : '🏥'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{fac.name}</h4>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center mt-1">
                              <MapPin size={12} className="mr-1 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{fac.address || fac.district || `${fac.city || 'Mumbai'}`}</span>
                              {fac.distance_km !== undefined && (
                                <span className="ml-2 font-bold text-indigo-600 dark:text-indigo-400">
                                  • {fac.distance_km < 1 ? `${Math.round(fac.distance_km * 1000)}m` : `${fac.distance_km.toFixed(1)} km`}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end space-y-1">
                          <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] font-black uppercase flex-shrink-0">
                            {fac.category || fac.type || 'Healthcare Facility'}
                          </span>
                          {fac.emergency_24_7 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[9px] font-black uppercase flex-shrink-0">
                              24/7 Trauma
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bed Vacancy Stats Bar if applicable */}
                      {fac.total_beds > 0 ? (
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-center">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">General Beds</p>
                            <p className="text-lg font-extrabold text-teal-600 dark:text-teal-400">{genBeds}</p>
                          </div>
                          <div className="space-y-0.5 border-x border-[var(--border-main)]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ICU Beds</p>
                            <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{icuBeds}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emergency</p>
                            <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">{emgBeds}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs font-semibold text-teal-700 dark:text-teal-300 flex items-center space-x-2">
                          <Syringe size={16} className="text-teal-500" />
                          <span>Specialized Vaccination & Outpatient Immunization Facility</span>
                        </div>
                      )}

                      {/* Available Services */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {isVaccinationFacility ? '💉 Vaccination & Health Services' : 'Available Services'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(fac.services || ["General consultation", "Pharmacy"]).slice(0, 6).map((s: string) => (
                            <span key={s} className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                              {s.toLowerCase().includes('bcg') || s.toLowerCase().includes('penta') || s.toLowerCase().includes('vaccin') ? (
                                <Check size={11} className="text-teal-500" />
                              ) : null}
                              <span>{s}</span>
                            </span>
                          ))}
                          {(fac.services?.length || 0) > 6 && (
                            <span className="px-2 py-1 text-[11px] text-slate-400 font-bold">
                              +{(fac.services?.length || 0) - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-[var(--border-main)]">
                      <button
                        onClick={() => setSelectedHospitalForBooking(fac)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
                      >
                        <Calendar size={14} />
                        <span>Book Appointment</span>
                      </button>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${fac.latitude || 19.0760},${fac.longitude || 72.8777}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/20 text-xs flex items-center space-x-1 transition-colors"
                        title="Get Directions on Google Maps"
                      >
                        <Navigation size={14} />
                        <span>Directions</span>
                      </a>

                      <button
                        onClick={() => setSelectedHospitalDetail(fac)}
                        className="p-3 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-[var(--border-main)] transition-colors"
                        title="View Facility Details & Map"
                      >
                        <MapIcon size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="premium-card p-12 text-center space-y-3">
              <Building2 size={40} className="text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No Healthcare Facilities Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No facilities found matching your category filter. Try clearing filters or selecting another category.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Book Slot Modal */}
      <AnimatePresence>
        {selectedHospitalForBooking && (
          <BookHospitalModal
            facility={selectedHospitalForBooking}
            onClose={() => setSelectedHospitalForBooking(null)}
            onSuccess={() => {
              setSelectedHospitalForBooking(null);
              fetchHospitals();
            }}
          />
        )}
      </AnimatePresence>

      {/* Ambulance Dispatch Modal */}
      <AnimatePresence>
        {showAmbulanceModal && (
          <BookAmbulanceModal
            onClose={() => setShowAmbulanceModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Facility Detail & Map Modal */}
      {selectedHospitalDetail && (
        <FacilityDetailModal
          scoredFacility={{
            facility: selectedHospitalDetail,
            distance_km: selectedHospitalDetail.distance_km || 0,
            total_score: 95,
            rationale: selectedMedicineForDetail
              ? `Verified stock: ${selectedMedicineForDetail.medicine_name} (${selectedMedicineForDetail.strength}) status is ${selectedMedicineForDetail.status} with ${selectedMedicineForDetail.quantity} units reported in facility inventory.`
              : "Healthcare access directory verified facility node.",
            data_freshness_text: selectedMedicineForDetail?.last_updated_text || "Updated Live"
          } as any}
          onClose={() => {
            setSelectedHospitalDetail(null);
            setSelectedMedicineForDetail(null);
          }}
          onStartTelemedicine={() => {
            const fac = selectedHospitalDetail;
            setSelectedHospitalDetail(null);
            setSelectedHospitalForBooking(fac);
          }}
        />
      )}

      {/* AI Medicine Guidance Modal */}
      {explainingMedicine && (
        <MedicineExplainModal
          medicineName={explainingMedicine.name}
          strength={explainingMedicine.strength}
          onClose={() => setExplainingMedicine(null)}
        />
      )}
    </div>
  );
}
