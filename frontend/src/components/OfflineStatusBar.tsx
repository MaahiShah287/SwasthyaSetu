import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export const OfflineStatusBar: React.FC = () => {
  const navigate = useNavigate();
  const {
    effectiveOnline,
    isOnline,
    isSimulatedOffline,
    toggleSimulatedOffline,
    isSyncing,
    pendingCount,
    conflictCount,
    lastSynced,
    syncNow,
  } = useOffline();

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveOnline || isSyncing) return;
    await syncNow();
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Not synced yet';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-3 py-2 transition-all duration-300 select-none z-30">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Status Badge & Connectivity */}
        <div className="flex items-center space-x-2.5">
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-medium transition-all ${
              effectiveOnline
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
            }`}
          >
            {effectiveOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold tracking-wide">Online Mode</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold tracking-wide">
                  {isSimulatedOffline ? 'Simulated Field Offline' : 'Offline Mode'}
                </span>
              </>
            )}
          </div>

          {/* Pending Queue Counter */}
          {pendingCount > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="font-semibold">
                {pendingCount} {pendingCount === 1 ? 'record' : 'records'} queued locally
              </span>
            </div>
          )}

          {/* Conflict Counter */}
          {conflictCount > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold">{conflictCount} conflict needs review</span>
            </div>
          )}

          {pendingCount === 0 && conflictCount === 0 && effectiveOnline && (
            <div className="hidden sm:flex items-center space-x-1 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All records synced · {formatLastSync(lastSynced)}</span>
            </div>
          )}
        </div>

        {/* Right: Actions & Hub link */}
        <div className="flex items-center space-x-2">
          {/* Quick toggle to simulate offline for demonstration */}
          <button
            onClick={toggleSimulatedOffline}
            title={
              isSimulatedOffline
                ? 'Resume normal network connection'
                : 'Simulate field worker offline mode without disconnecting Wi-Fi'
            }
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              isSimulatedOffline
                ? 'bg-amber-600/30 border-amber-500/50 text-amber-200 hover:bg-amber-600/40'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span className="hidden md:inline">
              {isSimulatedOffline ? 'End Offline Sim' : 'Simulate Offline'}
            </span>
          </button>

          {/* Sync Now Button */}
          <button
            onClick={handleSyncClick}
            disabled={!effectiveOnline || isSyncing}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium text-xs transition-all ${
              !effectiveOnline
                ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                : isSyncing
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 cursor-wait'
                : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 hover:shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-300' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          {/* Offline Sync Hub Button */}
          <button
            onClick={() => navigate('/offline-sync')}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 font-medium text-xs transition-all"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};
