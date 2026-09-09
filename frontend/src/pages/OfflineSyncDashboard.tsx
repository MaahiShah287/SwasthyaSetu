import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  RotateCcw,
  Database,
  PlusCircle,
  FileText,
  UserCheck,
  ShieldAlert,
  Send,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  Activity,
  HeartHandshake,
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext';
import {
  getAllQueueItems,
  deleteQueueItem,
  clearSyncedItems,
  getCachedSnapshot,
  SyncQueueItem,
  OfflineRecordType,
} from '../utils/offlineDB';

export const OfflineSyncDashboard: React.FC = () => {
  const {
    isOnline,
    effectiveOnline,
    isSimulatedOffline,
    toggleSimulatedOffline,
    isSyncing,
    pendingCount,
    conflictCount,
    syncedCount,
    failedCount,
    lastSynced,
    syncNow,
    retryRecord,
    resolveConflict,
    queueRecord,
    refreshCounts,
  } = useOffline();

  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedConflict, setSelectedConflict] = useState<SyncQueueItem | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'field_forms' | 'cached_data'>('queue');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Field Forms State
  const [fieldFormType, setFieldFormType] = useState<OfflineRecordType>('visit_note');
  const [visitName, setVisitName] = useState('');
  const [visitObs, setVisitObs] = useState('');
  const [visitVitalsBP, setVisitVitalsBP] = useState('120/80');
  const [visitVitalsPulse, setVisitVitalsPulse] = useState('72');

  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('2024-01-15');
  const [childGender, setChildGender] = useState('Female');

  const [vacChildId, setVacChildId] = useState('');
  const [vacName, setVacName] = useState('BCG');
  const [vacDate, setVacDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [refSpecialty, setRefSpecialty] = useState('Cardiology');
  const [refFacility, setRefFacility] = useState('District Civil Hospital');
  const [refReason, setRefReason] = useState('Requires secondary evaluation for persistent chest tightness.');

  // Cached data state
  const [cachedProfile, setCachedProfile] = useState<any>(null);
  const [cachedVaccinations, setCachedVaccinations] = useState<any>(null);
  const [cachedFollowups, setCachedFollowups] = useState<any>(null);

  const loadQueueData = async () => {
    try {
      const items = await getAllQueueItems();
      setQueueItems(items);

      // Check for first conflict if not selected
      const firstConflict = items.find((i) => i.sync_status === 'CONFLICT');
      if (firstConflict && !selectedConflict) {
        setSelectedConflict(firstConflict);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  const loadCachedSnapshots = async () => {
    const userEmail = localStorage.getItem('userEmail') || 'patient@swasthyasetu.org';
    const prof = await getCachedSnapshot('profile_data', userEmail);
    const vac = await getCachedSnapshot('vaccinations_data', userEmail);
    const flp = await getCachedSnapshot('followups_data', userEmail);

    if (prof) setCachedProfile(prof);
    if (vac) setCachedVaccinations(vac);
    if (flp) setCachedFollowups(flp);
  };

  useEffect(() => {
    loadQueueData();
    loadCachedSnapshots();

    const handleSyncEvent = () => {
      loadQueueData();
      loadCachedSnapshots();
    };

    window.addEventListener('swasthyasetu:sync_completed', handleSyncEvent);
    return () => {
      window.removeEventListener('swasthyasetu:sync_completed', handleSyncEvent);
    };
  }, []);

  const handleManualSync = async () => {
    setStatusNotice('Starting synchronization with SwasthyaSetu backend...');
    const res = await syncNow();
    await loadQueueData();
    await refreshCounts();
    setStatusNotice(`Sync complete: ${res.synced} synced, ${res.conflicts} conflicts, ${res.failed} failed.`);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleRetry = async (localId: string) => {
    try {
      setStatusNotice(`Retrying record ${localId}...`);
      await retryRecord(localId);
      await loadQueueData();
      setStatusNotice(`Record retried successfully.`);
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      setStatusNotice(`Retry failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleDelete = async (localId: string) => {
    if (window.confirm('Are you sure you want to remove this record from local storage?')) {
      await deleteQueueItem(localId);
      await loadQueueData();
      await refreshCounts();
    }
  };

  const handleClearSynced = async () => {
    const count = await clearSyncedItems();
    await loadQueueData();
    await refreshCounts();
    setStatusNotice(`Cleared ${count} completed records.`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleCreateFieldRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (fieldFormType === 'visit_note') {
        if (!visitName.trim()) return alert('Please enter patient or resident name');
        await queueRecord('visit_note', {
          patient_name: visitName,
          observations: visitObs || 'Routine home assessment conducted in rural field sector.',
          vitals: { blood_pressure: visitVitalsBP, pulse: visitVitalsPulse },
          visit_date: new Date().toISOString().split('T')[0],
          priority: 'NORMAL',
        });
        setVisitName('');
        setVisitObs('');
      } else if (fieldFormType === 'child_registration') {
        if (!childName.trim()) return alert('Please enter child name');
        await queueRecord('child_registration', {
          name: childName,
          date_of_birth: childDob,
          gender: childGender,
          blood_group: 'O+',
        });
        setChildName('');
      } else if (fieldFormType === 'vaccination_record') {
        await queueRecord('vaccination_record', {
          child_id: vacChildId || undefined,
          vaccine_id: vacName,
          vaccine_name: vacName,
          administered_date: vacDate,
          dose: 'Dose 1',
          notes: 'Administered at village immunization post.',
        });
      } else if (fieldFormType === 'referral_draft') {
        await queueRecord('referral_draft', {
          specialty: refSpecialty,
          facility_name: refFacility,
          reason: refReason,
          urgency: 'NORMAL',
        });
        setRefReason('');
      }

      await loadQueueData();
      await refreshCounts();
      setStatusNotice(`Record saved locally in offline sync queue!`);
      setTimeout(() => setStatusNotice(null), 4000);
      setActiveTab('queue');
    } catch (err: any) {
      alert(`Failed to save record: ${err?.message}`);
    }
  };

  const filteredQueue = queueItems.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.sync_status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO & STATUS HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                IndexedDB Persistent Storage
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 ${
                  effectiveOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                }`}
              >
                {effectiveOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {effectiveOnline ? 'Online Connected' : isSimulatedOffline ? 'Simulated Field Offline' : 'Offline'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Offline Healthcare Sync Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Enable uninterrupted community healthcare work without internet. Data is securely saved to your
              device's IndexedDB and automatically synchronized with the SwasthyaSetu backend upon reconnection.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleSimulatedOffline}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-lg ${
                isSimulatedOffline
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20 hover:bg-amber-400'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{isSimulatedOffline ? 'End Offline Simulation' : 'Simulate Offline Mode'}</span>
            </button>

            <button
              onClick={handleManualSync}
              disabled={!effectiveOnline || isSyncing}
              className={`px-5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-lg ${
                !effectiveOnline
                  ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                  : isSyncing
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/40 hover:brightness-110 shadow-cyan-500/25'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Toast Banner */}
        {statusNotice && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STAT CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition-all hover:border-cyan-500/30">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Local Records</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-cyan-400 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Queued in IndexedDB</div>
        </div>

        {/* Synced Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition-all hover:border-emerald-500/30">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Synced Successfully</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">{syncedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Written to server MongoDB</div>
        </div>

        {/* Conflicts Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition-all hover:border-rose-500/30">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Conflicts Requiring Review</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-black text-rose-400 mt-2">{conflictCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Protected from silent overwrite</div>
        </div>

        {/* Failed Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition-all hover:border-amber-500/30">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Failed Records</span>
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400 mt-2">{failedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Auto-retries on reconnection</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Local Sync Queue ({queueItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('field_forms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'field_forms'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record Field Work Offline</span>
        </button>

        <button
          onClick={() => setActiveTab('cached_data')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'cached_data'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <HardDriveIcon className="w-4 h-4" />
          <span>Cached Snapshots Inspector</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB CONTENT 1: QUEUE TABLE & CONFLICT RESOLUTION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Conflict Resolution Banner (if any conflict exists) */}
          {selectedConflict && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center space-x-2 text-rose-300 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>Conflict Resolution Required for Local ID: {selectedConflict.local_id}</span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-500/50 uppercase font-bold">
                  {selectedConflict.record_type}
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-4">
                The server document was updated after you created this offline snapshot. Please decide which
                version to keep to prevent data overwrites:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                {/* Client Version */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
                  <div className="font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>Your Offline Version (Client)</span>
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto p-2 bg-black/40 rounded-lg max-h-48">
                    {JSON.stringify(selectedConflict.client_data || selectedConflict.payload, null, 2)}
                  </pre>
                </div>

                {/* Server Version */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
                  <div className="font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>Current Server Version</span>
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto p-2 bg-black/40 rounded-lg max-h-48">
                    {JSON.stringify(selectedConflict.server_data, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={async () => {
                    await resolveConflict(selectedConflict.local_id, 'USE_SERVER');
                    setSelectedConflict(null);
                    await loadQueueData();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                >
                  Discard Local & Keep Server
                </button>
                <button
                  onClick={async () => {
                    await resolveConflict(selectedConflict.local_id, 'USE_CLIENT');
                    setSelectedConflict(null);
                    await loadQueueData();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all"
                >
                  Apply My Version to Server
                </button>
              </div>
            </div>
          )}

          {/* Queue Filters & Batch Clear */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-white/5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium mr-1">Filter:</span>
              {['ALL', 'PENDING', 'SYNCED', 'FAILED', 'CONFLICT'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    filterStatus === st
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {syncedCount > 0 && (
              <button
                onClick={handleClearSynced}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 text-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Synced ({syncedCount})</span>
              </button>
            )}
          </div>

          {/* Queue Items Table */}
          {filteredQueue.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Sync Queue is Clear</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                All records have been synchronized or no records match your filter. You can record field data
                offline using the "Record Field Work" tab.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Record Type</th>
                      <th className="p-3.5">Payload Summary</th>
                      <th className="p-3.5">Created</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredQueue.map((item) => {
                      const payloadDesc =
                        item.payload?.name ||
                        item.payload?.patient_name ||
                        item.payload?.title ||
                        item.payload?.vaccine_name ||
                        item.payload?.reason ||
                        JSON.stringify(item.payload).substring(0, 45);

                      return (
                        <tr key={item.local_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                item.sync_status === 'SYNCED'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : item.sync_status === 'PENDING'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                  : item.sync_status === 'SYNCING'
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse'
                                  : item.sync_status === 'CONFLICT'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {item.sync_status}
                            </span>
                          </td>

                          <td className="p-3.5 whitespace-nowrap font-medium text-slate-200">
                            {item.record_type.replace('_', ' ').toUpperCase()}
                          </td>

                          <td className="p-3.5 text-slate-300 max-w-xs truncate" title={JSON.stringify(item.payload)}>
                            {payloadDesc}
                          </td>

                          <td className="p-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                            {new Date(item.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {new Date(item.created_at).toLocaleDateString()}
                          </td>

                          <td className="p-3.5 whitespace-nowrap text-right space-x-2">
                            {item.sync_status === 'FAILED' && (
                              <button
                                onClick={() => handleRetry(item.local_id)}
                                disabled={!effectiveOnline}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-all"
                              >
                                Retry
                              </button>
                            )}

                            {item.sync_status === 'CONFLICT' && (
                              <button
                                onClick={() => setSelectedConflict(item)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30 transition-all font-bold"
                              >
                                Resolve
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(item.local_id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-all"
                              title="Delete local record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB CONTENT 2: FIELD FORMS (OFFLINE-SUPPORTED WORKFLOWS) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'field_forms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Selector sidebar */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Field Workflow
            </h3>

            <button
              onClick={() => setFieldFormType('visit_note')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                fieldFormType === 'visit_note'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-md'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <HeartHandshake className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <div className="font-bold text-xs text-white">Community / Home Visit</div>
                <div className="text-[11px] text-slate-400">Record field vitals & visit notes</div>
              </div>
            </button>

            <button
              onClick={() => setFieldFormType('child_registration')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                fieldFormType === 'child_registration'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-md'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-xs text-white">Register Child Profile</div>
                <div className="text-[11px] text-slate-400">Add child to immunization registry</div>
              </div>
            </button>

            <button
              onClick={() => setFieldFormType('vaccination_record')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                fieldFormType === 'vaccination_record'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-md'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <Activity className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="font-bold text-xs text-white">Vaccine Administration</div>
                <div className="text-[11px] text-slate-400">Log dose, batch, and date</div>
              </div>
            </button>

            <button
              onClick={() => setFieldFormType('referral_draft')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                fieldFormType === 'referral_draft'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-md'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <FileText className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <div className="font-bold text-xs text-white">Referral Draft</div>
                <div className="text-[11px] text-slate-400">Draft care pathway for facility</div>
              </div>
            </button>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs mt-4">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Info className="w-4 h-4 text-amber-400" />
                <span>Offline Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Any record submitted here will be immediately written to IndexedDB. If internet is down, it
                waits safely until connection returns.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-6">
            <form onSubmit={handleCreateFieldRecord} className="space-y-4">
              <div className="border-b border-white/10 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>
                    {fieldFormType === 'visit_note' && 'New Community Health Visit Record'}
                    {fieldFormType === 'child_registration' && 'Register Child Immunization Record'}
                    {fieldFormType === 'vaccination_record' && 'Record Field Vaccination Dose'}
                    {fieldFormType === 'referral_draft' && 'Create Offline Referral Draft'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Records created here are assigned unique UUIDs and deduplicated automatically on sync.
                </p>
              </div>

              {/* Form 1: Visit Note */}
              {fieldFormType === 'visit_note' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Resident / Patient Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sunita Patil"
                      value={visitName}
                      onChange={(e) => setVisitName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Blood Pressure (mmHg)</label>
                      <input
                        type="text"
                        value={visitVitalsBP}
                        onChange={(e) => setVisitVitalsBP(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Pulse (bpm)</label>
                      <input
                        type="text"
                        value={visitVitalsPulse}
                        onChange={(e) => setVisitVitalsPulse(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Observations & Field Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Vitals stable, instructed on maternal nutrition and hydration..."
                      value={visitObs}
                      onChange={(e) => setVisitObs(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form 2: Child Registration */}
              {fieldFormType === 'child_registration' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Child Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={childDob}
                        onChange={(e) => setChildDob(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                      <select
                        value={childGender}
                        onChange={(e) => setChildGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Form 3: Vaccine Record */}
              {fieldFormType === 'vaccination_record' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Vaccine Name</label>
                    <select
                      value={vacName}
                      onChange={(e) => setVacName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="BCG">BCG (Bacillus Calmette-Guérin)</option>
                      <option value="OPV-0">OPV 0 (Oral Polio Vaccine)</option>
                      <option value="Hepatitis B-0">Hepatitis B (Birth Dose)</option>
                      <option value="Pentavalent-1">Pentavalent 1 (DPT, Hep B, Hib)</option>
                      <option value="Rotavirus-1">Rotavirus Dose 1</option>
                      <option value="PCV-1">Pneumococcal Conjugate 1</option>
                      <option value="MR-1">Measles & Rubella Dose 1</option>
                      <option value="DPT-Booster">DPT Booster</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Date Administered</label>
                    <input
                      type="date"
                      required
                      value={vacDate}
                      onChange={(e) => setVacDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form 4: Referral Draft */}
              {fieldFormType === 'referral_draft' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Referred Specialty</label>
                      <input
                        type="text"
                        value={refSpecialty}
                        onChange={(e) => setRefSpecialty(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Target Facility</label>
                      <input
                        type="text"
                        value={refFacility}
                        onChange={(e) => setRefFacility(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Referral</label>
                    <textarea
                      rows={3}
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Send className="w-4 h-4" />
                <span>Save Offline to Device Queue</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB CONTENT 3: CACHED SNAPSHOTS INSPECTOR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cached_data' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              These snapshots were automatically cached during your last active online session. They allow you to
              inspect previous medical history without internet access.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Snapshot */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Patient Emergency & Profile Snapshot</span>
                </h4>
                {cachedProfile && (
                  <span className="text-[10px] text-slate-400">
                    Cached {new Date(cachedProfile.cached_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {cachedProfile ? (
                <div className="text-xs space-y-1.5 text-slate-300">
                  <div>
                    <span className="text-slate-500">Name:</span> {cachedProfile.data?.name || 'N/A'}
                  </div>
                  <div>
                    <span className="text-slate-500">Blood Group:</span>{' '}
                    <span className="text-rose-400 font-bold">{cachedProfile.data?.blood_group || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Emergency Contact:</span>{' '}
                    {cachedProfile.data?.emergency_contact || 'N/A'}
                  </div>
                  <div>
                    <span className="text-slate-500">Allergies:</span>{' '}
                    {cachedProfile.data?.allergies || 'None listed'}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No cached profile snapshot yet. Visit Settings while online.</p>
              )}
            </div>

            {/* Vaccinations Snapshot */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Vaccination Summary Snapshot</span>
                </h4>
                {cachedVaccinations && (
                  <span className="text-[10px] text-slate-400">
                    Cached {new Date(cachedVaccinations.cached_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {cachedVaccinations ? (
                <div className="text-xs space-y-1.5 text-slate-300">
                  <div>
                    <span className="text-slate-500">Completed Doses:</span>{' '}
                    <span className="text-emerald-400 font-bold">
                      {cachedVaccinations.data?.completed ?? cachedVaccinations.data?.total ?? 'Available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Upcoming Doses:</span>{' '}
                    {cachedVaccinations.data?.upcoming ?? 0}
                  </div>
                  <div>
                    <span className="text-slate-500">Immunization Status:</span> Active Field Record
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No cached vaccination snapshot yet. Visit Vaccinations while online.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function HardDriveIcon(props: any) {
  return <Database {...props} />;
}
