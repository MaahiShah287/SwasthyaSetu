import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Bed, 
  Truck, 
  Users, 
  Stethoscope, 
  ShieldAlert, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Save, 
  Plus, 
  Minus, 
  Loader2, 
  AlertCircle, 
  Phone, 
  MapPin,
  RefreshCw,
  UserCheck,
  Calendar,
  Syringe,
  X,
  Pill,
  AlertTriangle,
  Trash2,
  Edit3,
  Search,
  Filter,
  FlaskConical
} from 'lucide-react';
import api from '../api/instance';
import { useTheme } from '../context/ThemeContext';
import medicineApi from '../api/medicineApi';
import diagnosticApi from '../api/diagnosticApi';
import { MedicineInventoryItem, FacilityInventoryStats } from '../types/medicine';
import { DiagnosticService, FacilityDiagnosticResponse } from '../types/diagnostic';
import AddMedicineModal from '../components/hospital/AddMedicineModal';
import DiagnosticServiceModal from '../components/hospital/DiagnosticServiceModal';

export default function HospitalDashboard() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [facility, setFacility] = useState<any>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [ambulanceRequests, setAmbulanceRequests] = useState<any[]>([]);
  const [hospitalFollowups, setHospitalFollowups] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'diagnostics' | 'beds' | 'bookings' | 'ambulances' | 'departments' | 'followups'>('overview');

  // Diagnostics State
  const [diagnosticServices, setDiagnosticServices] = useState<DiagnosticService[]>([]);
  const [diagnosticStats, setDiagnosticStats] = useState<FacilityDiagnosticResponse['stats'] | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagSearch, setDiagSearch] = useState('');
  const [diagAvailFilter, setDiagAvailFilter] = useState('ALL');
  const [showAddDiagnosticModal, setShowAddDiagnosticModal] = useState(false);
  const [editingDiagnostic, setEditingDiagnostic] = useState<DiagnosticService | null>(null);
  const [deletingDiagnosticId, setDeletingDiagnosticId] = useState<string | null>(null);

  // Medicine Inventory State
  const [inventoryItems, setInventoryItems] = useState<MedicineInventoryItem[]>([]);
  const [inventoryStats, setInventoryStats] = useState<FacilityInventoryStats | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  const [showAddMedicineModal, setShowAddMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<MedicineInventoryItem | null>(null);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);

  // Vaccination Modal State for Hospital Staff
  const [vaxModalPatient, setVaxModalPatient] = useState<any>(null);
  const [patientVaxSummary, setPatientVaxSummary] = useState<any>(null);
  const [loadingVax, setLoadingVax] = useState(false);

  // Bed Vacancy Form State
  const [generalBeds, setGeneralBeds] = useState(30);
  const [icuBeds, setIcuBeds] = useState(8);
  const [emergencyBeds, setEmergencyBeds] = useState(4);
  const [emergency24x7, setEmergency24x7] = useState(true);

  // Departments State
  const [departments, setDepartments] = useState<string[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [profRes, bookRes, ambReqRes, flpRes] = await Promise.all([
        api.get('/hospitals/admin/me'),
        api.get('/hospitals/bookings/list'),
        api.get('/emergency/ambulances/requests'),
        api.get('/follow-ups').catch(() => ({ data: [] }))
      ]);

      const fac = profRes.data.facility;
      setFacility(fac);
      setAmbulances(profRes.data.ambulances || []);
      setDoctors(profRes.data.doctors || []);
      setBookings(bookRes.data || []);
      setAmbulanceRequests(ambReqRes.data || []);
      setHospitalFollowups(flpRes.data || []);

      if (fac?.bed_capacity) {
        setGeneralBeds(fac.bed_capacity.general_available ?? 30);
        setIcuBeds(fac.bed_capacity.icu_available ?? 8);
        setEmergencyBeds(fac.bed_capacity.emergency_available ?? 4);
      }
      if (fac?.emergency_24_7 !== undefined) setEmergency24x7(fac.emergency_24_7);
      if (fac?.departments) setDepartments(fac.departments);

      // Fetch medicine inventory for this facility
      if (fac?.facility_id) {
        fetchInventory(fac.facility_id);
        fetchDiagnosticServices();
      }
    } catch (e) {
      console.error("Failed to load hospital dashboard", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async (facId?: string) => {
    const id = facId || facility?.facility_id;
    if (!id) return;
    try {
      setLoadingInventory(true);
      const res = await medicineApi.getFacilityInventory(id);
      setInventoryItems(res.items || []);
      setInventoryStats(res.stats || null);
    } catch (e) {
      console.error("Failed to load medicine inventory", e);
    } finally {
      setLoadingInventory(false);
    }
  };

  const fetchDiagnosticServices = async () => {
    try {
      setLoadingDiagnostics(true);
      const res = await diagnosticApi.getFacilityServices();
      setDiagnosticServices(res.services || []);
      setDiagnosticStats(res.stats || null);
    } catch (e) {
      console.error("Failed to load diagnostic services", e);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleDeleteDiagnostic = async (svc: DiagnosticService) => {
    if (!window.confirm(`Remove "${svc.service_name}" from your facility's diagnostic services?`)) return;
    setDeletingDiagnosticId(svc.service_id);
    try {
      await diagnosticApi.deleteService(svc.service_id);
      setDiagnosticServices(prev => prev.filter(s => s.service_id !== svc.service_id));
      fetchDiagnosticServices();
    } catch (e) { console.error("Failed to delete diagnostic service", e); }
    finally { setDeletingDiagnosticId(null); }
  };

  const handleQuickQuantity = async (item: MedicineInventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    setUpdatingQuantityId(item.inventory_id);
    try {
      const updated = await medicineApi.updateQuantity(item.inventory_id, newQty);
      setInventoryItems(prev => prev.map(i => i.inventory_id === item.inventory_id ? updated : i));
      if (facility?.facility_id) fetchInventory(facility.facility_id);
    } catch (e) {
      console.error("Failed to update quantity", e);
    } finally {
      setUpdatingQuantityId(null);
    }
  };

  const handleDeleteMedicine = async (item: MedicineInventoryItem) => {
    if (!window.confirm(`Are you sure you want to remove ${item.medicine_name} (${item.strength}) from the inventory?`)) {
      return;
    }
    try {
      await medicineApi.deleteMedicine(item.inventory_id);
      setInventoryItems(prev => prev.filter(i => i.inventory_id !== item.inventory_id));
      if (facility?.facility_id) fetchInventory(facility.facility_id);
    } catch (e) {
      console.error("Failed to delete medicine", e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSaveAvailability = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/hospitals/admin/availability', {
        general_available: generalBeds,
        icu_available: icuBeds,
        emergency_available: emergencyBeds,
        emergency_24_7: emergency24x7,
        departments
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchDashboardData();
    } catch (e) {
      console.error("Failed to update availability", e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await api.put(`/hospitals/bookings/${bookingId}/status`, { status });
      setBookings(prev => prev.map(b => b.booking_id === bookingId ? { ...b, status } : b));
      fetchDashboardData();
    } catch (e) {
      console.error("Failed to update booking", e);
    }
  };

  const handleUpdateAmbulanceStatus = async (ambulanceId: string, status: string) => {
    try {
      await api.put(`/emergency/ambulances/${ambulanceId}/status`, { status });
      setAmbulances(prev => prev.map(a => a.ambulance_id === ambulanceId ? { ...a, status } : a));
    } catch (e) {
      console.error("Failed to update ambulance", e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Loading Hospital Administration Command Hub...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hospital Top Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-2">
            <Building2 size={13} />
            <span>Hospital Command Center</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {facility?.name || 'Hospital Administration'}
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1 flex items-center">
            <MapPin size={13} className="mr-1 text-slate-400" />
            {facility?.address || 'Central District'}, {facility?.city || 'Mumbai'} • Phone: {facility?.phone || '+91 22 2410 7000'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] text-slate-500 hover:text-indigo-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleSaveAvailability}
            disabled={saving}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>Save Bed Matrix</span>
          </button>
        </div>
      </div>

      {/* Save Notification */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center space-x-2"
          >
            <CheckCircle2 size={16} />
            <span>Hospital availability matrix and bed vacancies synchronized to live network!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="premium-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">General Beds</span>
            <Bed size={18} className="text-teal-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">{generalBeds}</span>
            <span className="text-xs text-slate-400 font-semibold">Vacant</span>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => setGeneralBeds(Math.max(0, generalBeds - 1))}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => setGeneralBeds(generalBeds + 1)}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="premium-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">ICU Beds</span>
            <Activity size={18} className="text-blue-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{icuBeds}</span>
            <span className="text-xs text-slate-400 font-semibold">Available</span>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => setIcuBeds(Math.max(0, icuBeds - 1))}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => setIcuBeds(icuBeds + 1)}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="premium-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Emergency Beds</span>
            <ShieldAlert size={18} className="text-rose-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">{emergencyBeds}</span>
            <span className="text-xs text-slate-400 font-semibold">Ready</span>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => setEmergencyBeds(Math.max(0, emergencyBeds - 1))}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => setEmergencyBeds(emergencyBeds + 1)}
              className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="premium-card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Ambulances</span>
            <Truck size={18} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {ambulances.filter(a => a.status === 'Available').length} / {ambulances.length}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Active</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-2 font-medium">
            {ambulances.filter(a => a.status === 'Requested' || a.status === 'En Route').length} In Dispatch
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-[var(--border-main)] pb-3 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: '📥 Patient Requests', count: bookings.length },
          { id: 'inventory', label: '💊 Medicine Inventory', count: inventoryStats?.total_medicines },
          { id: 'diagnostics', label: '🔬 Diagnostic Services', count: diagnosticStats?.total },
          { id: 'followups', label: '📋 Follow-Ups & Referrals', count: hospitalFollowups.length },
          { id: 'ambulances', label: '🚑 Ambulance Fleet', count: ambulances.length },
          { id: 'beds', label: '🛏️ Bed Vacancy Controls' },
          { id: 'departments', label: '🩺 Departments & Services', count: departments.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--bg-primary)] text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* ============================= DIAGNOSTICS TAB ============================= */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
              <div>
                <h3 className="text-xl font-extrabold">Diagnostic Services</h3>
                <p className="text-xs text-[var(--text-secondary)]">Manage the diagnostic tests and services your facility provides.</p>
              </div>
              <button
                onClick={() => { setEditingDiagnostic(null); setShowAddDiagnosticModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition-all"
              >
                <Plus size={14} />Add Service
              </button>
            </div>

            {/* Stats */}
            {diagnosticStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Total', diagnosticStats.total, 'text-slate-500', 'bg-slate-500/10'], ['Available', diagnosticStats.available, 'text-emerald-500', 'bg-emerald-500/10'], ['Limited', diagnosticStats.limited, 'text-amber-500', 'bg-amber-500/10'], ['Unavailable', diagnosticStats.unavailable, 'text-rose-500', 'bg-rose-500/10']].map(([label, count, textCls, bgCls]) => (
                  <div key={label as string} className={`rounded-2xl p-3 text-center ${bgCls} border border-[var(--border-main)]`}>
                    <p className={`text-2xl font-black ${textCls}`}>{count}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${textCls}`}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search & Filter */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={diagSearch} onChange={e => setDiagSearch(e.target.value)}
                  placeholder="Search services…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border text-xs bg-[var(--bg-primary)] border-[var(--border-main)] outline-none focus:border-violet-500" />
              </div>
              {['ALL', 'AVAILABLE', 'LIMITED', 'UNAVAILABLE'].map(s => (
                <button key={s} onClick={() => setDiagAvailFilter(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    diagAvailFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-primary)] border-[var(--border-main)] text-slate-500 hover:border-violet-400'
                  }`}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}</button>
              ))}
              <button onClick={fetchDiagnosticServices} className="p-2 rounded-xl border border-[var(--border-main)] text-slate-500 hover:text-violet-500 transition-colors">
                <RefreshCw size={14} className={loadingDiagnostics ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Services List */}
            {loadingDiagnostics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-violet-500" />
              </div>
            ) : (() => {
              const filtered = diagnosticServices.filter(s => {
                const matchSearch = !diagSearch || s.service_name.toLowerCase().includes(diagSearch.toLowerCase());
                const matchAvail = diagAvailFilter === 'ALL' || s.availability === diagAvailFilter;
                return matchSearch && matchAvail;
              });
              return filtered.length === 0 ? (
                <div className="text-center py-12">
                  <FlaskConical size={36} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-bold text-slate-500">{diagSearch || diagAvailFilter !== 'ALL' ? 'No matching services' : 'No diagnostic services added yet'}</p>
                  <p className="text-xs text-slate-400 mt-1">Click "Add Service" to add the diagnostic tests your facility provides.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(svc => {
                    const isAvail = svc.availability === 'AVAILABLE';
                    const isLim = svc.availability === 'LIMITED';
                    const isDeleting = deletingDiagnosticId === svc.service_id;
                    return (
                      <div key={svc.service_id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${ isAvail ? 'bg-emerald-500/10 text-emerald-500' : isLim ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500' }`}>
                            <FlaskConical size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{svc.service_name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400">{svc.category}</span>
                              {svc.operating_hours && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={9} />{svc.operating_hours}</span>}
                              {svc.appointment_required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">Appt. Required</span>}
                              {svc.price_inr && svc.price_inr !== 'N/A' && <span className="text-[10px] text-slate-400">{svc.price_inr}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ isAvail ? 'bg-emerald-500/10 text-emerald-500' : isLim ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500' }`}>
                            {isAvail ? '🟢' : isLim ? '🟡' : '🔴'} {isAvail ? 'Available' : isLim ? 'Limited' : 'Unavailable'}
                          </span>
                          <button onClick={() => { setEditingDiagnostic(svc); setShowAddDiagnosticModal(true); }}
                            className="p-2 rounded-xl hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-500 transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDeleteDiagnostic(svc)} disabled={isDeleting}
                            className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-40">
                            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Diagnostic Service Modal */}
          <DiagnosticServiceModal
            isOpen={showAddDiagnosticModal}
            onClose={() => { setShowAddDiagnosticModal(false); setEditingDiagnostic(null); }}
            onSaved={fetchDiagnosticServices}
            editingService={editingDiagnostic}
          />
        </div>
      )}

      {/* Follow-Ups & Referral Monitoring Tab */}
      {activeTab === 'followups' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                  Follow-Up & Referral Monitoring
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Post-discharge tracking, referral progress, diagnostic report follow-ups, and facility care continuity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
                <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Post-Discharge</span>
                <span className="text-2xl font-black text-rose-500">
                  {hospitalFollowups.filter(f => f.follow_up_type === 'POST_DISCHARGE').length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
                <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Pending Referrals</span>
                <span className="text-2xl font-black text-indigo-500">
                  {hospitalFollowups.filter(f => f.follow_up_type === 'REFERRAL' && f.status !== 'COMPLETED').length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
                <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Overdue Tracking</span>
                <span className="text-2xl font-black text-amber-500">
                  {hospitalFollowups.filter(f => f.status === 'OVERDUE').length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
                <span className="block text-[10px] font-extrabold uppercase text-[var(--text-secondary)]">Completed Care</span>
                <span className="text-2xl font-black text-emerald-500">
                  {hospitalFollowups.filter(f => f.status === 'COMPLETED').length}
                </span>
              </div>
            </div>

            {hospitalFollowups.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Calendar size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">No hospital follow-up records found for this facility.</p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {hospitalFollowups.map((flp: any) => (
                  <div key={flp.follow_up_id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{flp.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {flp.follow_up_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-slate-400">Patient: {flp.patient_id} • Due: {flp.due_date} at {flp.due_time || '10:00'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        flp.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                        flp.status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-500' :
                        flp.status === 'DUE_TODAY' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {flp.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Patient Bookings / Admissions */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Incoming Patient Slot & Bed Requests
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              {bookings.filter(b => b.status === 'PENDING').length} Pending Review
            </span>
          </div>

          {bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.booking_id}
                  className="premium-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-500/40 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-base text-[var(--text-primary)]">{booking.patient_name}</span>
                      <span className="font-mono text-xs text-slate-400">({booking.booking_id})</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        booking.status === 'APPROVED' || booking.status === 'ADMITTED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : booking.status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{booking.booking_type}</span>
                      <span>•</span>
                      <span>Dept: {booking.department || 'General Medicine'}</span>
                      <span>•</span>
                      <span>Preferred: {booking.preferred_date} ({booking.preferred_time || 'Morning'})</span>
                    </div>

                    {booking.medical_reason && (
                      <p className="text-xs text-slate-400 pt-1">
                        Reason: <span className="text-slate-600 dark:text-slate-300 font-medium">{booking.medical_reason}</span>
                      </p>
                    )}
                  </div>

                    {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                      onClick={async () => {
                        setVaxModalPatient(booking.patient_name);
                        setLoadingVax(true);
                        try {
                          const res = await api.get('/vaccinations/summary', { params: { patient_id: booking.patient_email } });
                          setPatientVaxSummary(res.data);
                        } catch {
                          setPatientVaxSummary(null);
                        } finally {
                          setLoadingVax(false);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold text-xs hover:bg-blue-500/20 transition-all flex items-center gap-1"
                    >
                      <Syringe size={14} />
                      <span>Vaccination Status</span>
                    </button>

                    {booking.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(booking.booking_id, 'APPROVED')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all"
                        >
                          Approve Slot
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(booking.booking_id, 'REJECTED')}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {booking.status === 'APPROVED' && (
                      <button
                        onClick={() => handleUpdateBookingStatus(booking.booking_id, 'ADMITTED')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
                      >
                        Admit to Bed
                      </button>
                    )}

                    {booking.status === 'ADMITTED' && (
                      <button
                        onClick={() => handleUpdateBookingStatus(booking.booking_id, 'DISCHARGED')}
                        className="px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition-all"
                      >
                        Discharge Patient
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="premium-card p-12 text-center text-slate-400 text-xs font-bold">
              No hospital bookings or admission requests yet.
            </div>
          )}
        </div>
      )}

      {/* 2. Ambulance Fleet Manager */}
      {activeTab === 'ambulances' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Hospital Ambulance Fleet & Status Control
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{ambulances.length} Registered Units</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ambulances.map(amb => (
              <div key={amb.ambulance_id} className="premium-card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-lg">
                      🚑
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{amb.vehicle_type}</h4>
                      <p className="font-mono text-xs text-slate-400">{amb.ambulance_id}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    amb.status === 'Available'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : amb.status === 'En Route' || amb.status === 'Requested'
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}>
                    {amb.status}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>Operator: <span className="font-medium text-[var(--text-primary)]">{amb.operator}</span></p>
                  <p>Helpline: <span className="font-medium text-[var(--text-primary)]">{amb.emergency_phone || '108'}</span></p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(amb.equipment || ["Oxygen Unit", "Paramedic Crew"]).map((eq: string) => (
                      <span key={eq} className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-main)] text-[10px]">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="pt-2 border-t border-[var(--border-main)] flex items-center space-x-1.5">
                  {['Available', 'Requested', 'En Route', 'Offline'].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateAmbulanceStatus(amb.ambulance_id, st)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        amb.status === st 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-500 hover:border-indigo-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Bed Vacancy Controls */}
      {activeTab === 'beds' && (
        <div className="premium-card p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              Hospital Vacancy & Bed Management
            </h3>
            <p className="text-xs text-slate-400">
              Update your live vacant bed counts. Patients and emergency triage dispatchers will see these counts in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-teal-600">General Ward Beds</label>
              <input 
                type="number"
                value={generalBeds}
                onChange={(e) => setGeneralBeds(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl py-3 px-4 text-2xl font-black text-teal-600 outline-none"
              />
              <p className="text-[10px] text-slate-400">Available general admission beds</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-blue-600">ICU & Critical Beds</label>
              <input 
                type="number"
                value={icuBeds}
                onChange={(e) => setIcuBeds(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl py-3 px-4 text-2xl font-black text-blue-600 outline-none"
              />
              <p className="text-[10px] text-slate-400">Ventilator & ICU ready beds</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-rose-600">Emergency / Trauma Beds</label>
              <input 
                type="number"
                value={emergencyBeds}
                onChange={(e) => setEmergencyBeds(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl py-3 px-4 text-2xl font-black text-rose-600 outline-none"
              />
              <p className="text-[10px] text-slate-400">24/7 Red-flag emergency beds</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)]">
            <div>
              <p className="font-bold text-sm text-[var(--text-primary)]">24/7 Emergency Trauma Center Active</p>
              <p className="text-xs text-slate-400">Enables high-priority triage referral routing</p>
            </div>
            <button
              onClick={() => setEmergency24x7(!emergency24x7)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                emergency24x7 ? 'bg-rose-600 text-white' : 'bg-slate-300 text-slate-600'
              }`}
            >
              {emergency24x7 ? 'Enabled (24/7)' : 'Disabled'}
            </button>
          </div>

          <button
            onClick={handleSaveAvailability}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider shadow-xl shadow-indigo-500/20"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>Save Bed Availability Matrix</span>
          </button>
        </div>
      )}

      {/* 4. Departments & Services */}
      {activeTab === 'departments' && (
        <div className="premium-card p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              Hospital Departments & Clinical Specialties
            </h3>
            <p className="text-xs text-slate-400">
              Configured departments dictate which specialist searches match your facility.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <span
                key={dept}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs"
              >
                ✓ {dept}
              </span>
            ))}
          </div>

          <div className="pt-4 border-t border-[var(--border-main)]">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">Affiliated Doctors in Facility</h4>
            {doctors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doctors.map(d => (
                  <div key={d.doctor_id} className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">🩺</div>
                    <div>
                      <p className="font-bold text-xs text-[var(--text-primary)]">{d.name}</p>
                      <p className="text-[11px] text-teal-600 font-semibold">{d.specialization}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No doctors registered under this facility ID yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Medicine Inventory Tab Content */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* 5 Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="premium-card p-4 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Medicines</span>
              <div className="text-2xl font-black text-[var(--text-primary)]">
                {inventoryStats?.total_medicines ?? inventoryItems.length}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Tracked SKU items</span>
            </div>

            <div className="premium-card p-4 space-y-1 border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Available</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {inventoryStats?.available_count ?? inventoryItems.filter(i => i.status === 'AVAILABLE').length}
              </div>
              <span className="text-[10px] text-emerald-600/70 font-semibold">&gt; Minimum stock</span>
            </div>

            <div className="premium-card p-4 space-y-1 border-amber-500/20 bg-amber-500/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Low Stock</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {inventoryStats?.low_stock_count ?? inventoryItems.filter(i => i.status === 'LOW_STOCK').length}
              </div>
              <span className="text-[10px] text-amber-600/70 font-semibold">&le; Threshold alert</span>
            </div>

            <div className="premium-card p-4 space-y-1 border-rose-500/20 bg-rose-500/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Out of Stock</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {inventoryStats?.out_of_stock_count ?? inventoryItems.filter(i => i.status === 'OUT_OF_STOCK').length}
              </div>
              <span className="text-[10px] text-rose-600/70 font-semibold">0 units remaining</span>
            </div>

            <div className="premium-card p-4 space-y-1 border-purple-500/20 bg-purple-500/5 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Expiring Soon</span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {inventoryStats?.expiring_soon_count ?? 0}
              </div>
              <span className="text-[10px] text-purple-600/70 font-semibold">&lt; 90 days validity</span>
            </div>
          </div>

          {/* Search, Filter & Add Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Filter by medicine name, generic name, batch..."
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              <select
                value={inventoryStatusFilter}
                onChange={(e) => setInventoryStatusFilter(e.target.value)}
                className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-2.5 px-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-indigo-500 shadow-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">🟢 Available Only</option>
                <option value="LOW_STOCK">🟡 Low Stock Only</option>
                <option value="OUT_OF_STOCK">🔴 Out of Stock Only</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingMedicine(null);
                setShowAddMedicineModal(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>Add New Medicine</span>
            </button>
          </div>

          {/* Inventory Items List */}
          {loadingInventory ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Loading Verified Medicine Inventory...
              </p>
            </div>
          ) : (
            (() => {
              const filtered = inventoryItems.filter(item => {
                const q = inventorySearch.toLowerCase();
                const matchesQ = !q || item.medicine_name.toLowerCase().includes(q) ||
                  (item.generic_name && item.generic_name.toLowerCase().includes(q)) ||
                  (item.batch_number && item.batch_number.toLowerCase().includes(q));
                const matchesStatus = inventoryStatusFilter === 'ALL' || item.status === inventoryStatusFilter;
                return matchesQ && matchesStatus;
              });

              if (filtered.length === 0) {
                return (
                  <div className="premium-card p-12 text-center space-y-3">
                    <Pill size={36} className="text-slate-400 mx-auto" />
                    <h4 className="font-bold text-base text-[var(--text-primary)]">No Medicine Records Found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {inventorySearch ? 'No items match your filter.' : 'Your facility inventory is currently empty. Click "Add New Medicine" to record stock.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((item) => {
                    const isAvailable = item.status === 'AVAILABLE';
                    const isLow = item.status === 'LOW_STOCK';
                    const isOut = item.status === 'OUT_OF_STOCK';
                    const isUpdating = updatingQuantityId === item.inventory_id;

                    return (
                      <motion.div
                        key={item.inventory_id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`premium-card p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all border ${
                          isOut ? 'border-rose-500/30' : isLow ? 'border-amber-500/30' : 'border-[var(--border-main)]'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Top row: Medicine name + status badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-extrabold text-base text-[var(--text-primary)]">{item.medicine_name}</h4>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                                  {item.strength}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">{item.generic_name || item.form}</p>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex-shrink-0 ${
                              isAvailable
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : isLow
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              {isAvailable ? '🟢 Available' : isLow ? '🟡 Low Stock' : '🔴 Out of Stock'}
                            </span>
                          </div>

                          {/* Category & Form Badge */}
                          <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-600 dark:text-slate-300">
                              {item.form}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-600 dark:text-slate-300">
                              {item.category || 'General'}
                            </span>
                            {item.is_expiring_soon && (
                              <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center gap-1">
                                <AlertTriangle size={10} /> Expiring soon
                              </span>
                            )}
                          </div>

                          {/* Current Stock Bar with +/- controls */}
                          <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Stock</span>
                              <div className="flex items-baseline space-x-1.5">
                                <span className={`text-2xl font-black ${
                                  isAvailable ? 'text-emerald-600 dark:text-emerald-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {item.quantity}
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">{item.unit || 'units'}</span>
                              </div>
                            </div>

                            {/* Quick Increment/Decrement */}
                            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-main)]">
                              <span className="text-[10px] text-slate-400 font-bold">
                                Min threshold: <span className="text-slate-600 dark:text-slate-300">{item.minimum_stock}</span>
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleQuickQuantity(item, -10)}
                                  disabled={isUpdating || item.quantity <= 0}
                                  className="px-1.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40"
                                  title="Quick decrement -10"
                                >
                                  -10
                                </button>
                                <button
                                  onClick={() => handleQuickQuantity(item, -1)}
                                  disabled={isUpdating || item.quantity <= 0}
                                  className="p-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40"
                                  title="Decrement -1"
                                >
                                  <Minus size={12} />
                                </button>
                                <button
                                  onClick={() => handleQuickQuantity(item, 1)}
                                  disabled={isUpdating}
                                  className="p-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                                  title="Increment +1"
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  onClick={() => handleQuickQuantity(item, 10)}
                                  disabled={isUpdating}
                                  className="px-1.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                                  title="Quick increment +10"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Batch & Expiry footer */}
                          <div className="text-[10px] text-slate-400 font-medium space-y-0.5">
                            <div className="flex justify-between">
                              <span>Batch: <span className="font-mono text-slate-600 dark:text-slate-300">{item.batch_number}</span></span>
                              <span>Exp: <span className="font-semibold text-slate-600 dark:text-slate-300">{item.expiry_date}</span></span>
                            </div>
                            <div className="flex justify-between pt-0.5">
                              <span>Supply: {item.price_inr || 'Govt Free'}</span>
                              <span>🕒 {item.last_updated_text || 'Recently'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--border-main)]">
                          <button
                            onClick={() => {
                              setEditingMedicine(item);
                              setShowAddMedicineModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center space-x-1.5 transition"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDeleteMedicine(item)}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition"
                            title="Remove Medicine"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      {showAddMedicineModal && (
        <AddMedicineModal
          facilityId={facility?.facility_id || 'FAC-001'}
          editItem={editingMedicine}
          onClose={() => {
            setShowAddMedicineModal(false);
            setEditingMedicine(null);
          }}
          onSuccess={() => {
            if (facility?.facility_id) fetchInventory(facility.facility_id);
          }}
        />
      )}

      {/* Hospital Staff Patient Vaccination Inspector Modal */}
      <AnimatePresence>
        {vaxModalPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <div>
                  <h4 className="font-extrabold text-base text-[var(--text-primary)]">Patient Immunization Record</h4>
                  <p className="text-xs text-slate-400">{vaxModalPatient.patient_name} ({vaxModalPatient.patient_email})</p>
                </div>
                <button onClick={() => setVaxModalPatient(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              {loadingVax ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                </div>
              ) : patientVaxSummary ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="block text-[10px] text-slate-400 font-bold">COMPLETED</span>
                      <span className="text-lg font-extrabold text-emerald-500">{patientVaxSummary.completed}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="block text-[10px] text-slate-400 font-bold">UPCOMING</span>
                      <span className="text-lg font-extrabold text-cyan-500">{patientVaxSummary.upcoming}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="block text-[10px] text-slate-400 font-bold">OVERDUE</span>
                      <span className="text-lg font-extrabold text-rose-500">{patientVaxSummary.overdue}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold flex justify-between">
                    <span>Immunization Gaps Count:</span>
                    <span>{patientVaxSummary.gaps}</span>
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-slate-400 italic">
                  No active vaccination records found for this patient.
                </p>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => setVaxModalPatient(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs"
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
