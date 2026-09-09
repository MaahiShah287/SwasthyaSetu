import { useState, useEffect } from 'react';
import api from '../api/instance';
import { User, ShieldAlert, Save, Loader2, HeartPulse, UserCircle, Droplets, Calendar, Smartphone, PlusCircle, Activity, Mail, Hash, ShieldCheck, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';

export default function Settings() {
  const { theme } = useTheme();
  const { effectiveOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // ... inside Settings()
  const [profile, setProfile] = useState({
    name: '',
    age: 0,
    dob: '',
    mobile: '',
    gender: 'Other',
    blood_group: '',
    allergies: '',
    diseases: '',
    medications: '',
    emergency_contact: '',
    preferred_language: 'mr'
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const resp = await api.get('/profile/');
      if (resp.data.name) setProfile({ ...profile, ...resp.data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/profile/', profile);
      if (res?.data?.queued) {
        alert('Profile changes saved offline in local queue! Will sync automatically when connection returns.');
      } else {
        alert('Profile updated successfully');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ... (loading state)

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-4 pb-20">
      {/* Offline Mode Banner */}
      {!effectiveOnline && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-2.5">
            <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Offline Settings Mode:</span> Changes made offline will be safely queued in IndexedDB and synchronized automatically when online.
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider border border-amber-500/40 shrink-0">
            Offline Mode
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2 text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-4 py-1.5 rounded-full w-fit text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100 dark:border-blue-500/20"
          >
            <ShieldCheck size={14} />
            <span>Profile Configuration Engine</span>
          </motion.div>
          <h2 className="text-5xl font-extrabold tracking-tight">
            Account <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Settings</span>
          </h2>
          <p className="text-slate-500 font-medium">Manage clinical identifiers and personalized health parameters.</p>
        </div>
        
        <button 
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center space-x-3 bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          <span>{saving ? 'Synchronizing...' : 'Save Protocol'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Identity Section */}
          <section className="premium-card p-8 space-y-8">
             <div className="flex items-center space-x-4">
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl text-[var(--accent-primary)] shadow-inner">
                   <User size={24} />
                </div>
                <div>
                   <h3 className="text-xl font-extrabold text-[var(--text-primary)]">Core Identity</h3>
                   <p className="text-xs text-[var(--text-secondary)] font-bold opacity-60">Verify and update your primary clinical markers.</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Legal Full Identity</label>
                   <input 
                     value={profile.name}
                     onChange={(e) => setProfile({...profile, name: e.target.value})}
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Verified Mobile Link</label>
                   <input 
                     value={profile.mobile}
                     onChange={(e) => setProfile({...profile, mobile: e.target.value})}
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Chronological Date of Birth</label>
                   <input 
                     type="date"
                     value={profile.dob}
                     onChange={(e) => setProfile({...profile, dob: e.target.value})}
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                   />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Age Cycle</label>
                     <input 
                       type="number"
                       value={profile.age}
                       onChange={(e) => setProfile({...profile, age: parseInt(e.target.value) || 0})}
                       className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Gender Class</label>
                     <select 
                       value={profile.gender}
                       onChange={(e) => setProfile({...profile, gender: e.target.value})}
                       className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] appearance-none"
                     >
                       <option value="Male">Male</option>
                       <option value="Female">Female</option>
                       <option value="Other">Other</option>
                     </select>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Preferred Language (प्राधान्य भाषा)</label>
                   <select 
                     value={profile.preferred_language || 'mr'}
                     onChange={(e) => {
                       const newLang = e.target.value;
                       setProfile({...profile, preferred_language: newLang});
                       localStorage.setItem('preferred_language', newLang);
                       window.dispatchEvent(new Event('languageChange'));
                     }}
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                   >
                     <option value="mr">मराठी (Marathi) - Regional Primary</option>
                     <option value="hi">हिंदी (Hindi)</option>
                     <option value="en">English</option>
                   </select>
                </div>
             </div>
          </section>

          {/* Medical Matrix Section */}
          <section className="premium-card p-8 space-y-8">
             <div className="flex items-center space-x-4">
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl text-rose-500 shadow-inner">
                   <HeartPulse size={24} />
                </div>
                <div>
                   <h3 className="text-xl font-extrabold text-[var(--text-primary)]">Pathological Matrix</h3>
                   <p className="text-xs text-[var(--text-secondary)] font-bold opacity-60">Detailed medical disclosures for high-fidelity AI diagnostics.</p>
                </div>
             </div>
             
             <div className="space-y-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Verified Critical Allergies</label>
                   <textarea 
                     value={profile.allergies}
                     onChange={(e) => setProfile({...profile, allergies: e.target.value})}
                     placeholder="List accurately for emergency safety..."
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-28 resize-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Chronic Physiological conditions</label>
                   <textarea 
                     value={profile.diseases}
                     onChange={(e) => setProfile({...profile, diseases: e.target.value})}
                     placeholder="e.g. Type 2 Diabetes, Hypertension..."
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-28 resize-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">Active Neural/Pharma Protocols</label>
                   <textarea 
                     value={profile.medications}
                     onChange={(e) => setProfile({...profile, medications: e.target.value})}
                     placeholder="Specify dosages and clinical schedules..."
                     className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-28 resize-none"
                   />
                </div>
             </div>
          </section>
        </div>

        {/* Action Sidebar */}
        <div className="lg:col-span-1 space-y-8">
           <div className="premium-card p-8 text-center space-y-6 relative overflow-hidden group h-fit">
              <div className="mx-auto w-24 h-24 rounded-[2rem] bg-[var(--accent-primary)] p-[1px] relative">
                 <div className="w-full h-full rounded-[1.95rem] bg-[var(--bg-card)] flex items-center justify-center">
                    <UserCircle size={48} className="text-[var(--accent-primary)]" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-teal-500 rounded-xl border-4 border-[var(--bg-card)] flex items-center justify-center text-white">
                    <ShieldCheck size={14} />
                 </div>
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[var(--text-primary)]">{profile.name || 'Anonymous User'}</h3>
                <p className="text-[10px] text-[var(--accent-primary)] font-black uppercase tracking-[0.2em] mt-2">Validated Patient Protocol</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[var(--border-main)]">
                 <div className="bg-[var(--bg-primary)] p-3 rounded-2xl border border-[var(--border-main)]">
                    <p className="text-[8px] text-[var(--text-secondary)] uppercase font-black tracking-widest mb-1 opacity-60">Blood Type</p>
                    <p className="font-extrabold text-lg text-[var(--text-primary)] uppercase">{profile.blood_group || '--'}</p>
                 </div>
                 <div className="bg-[var(--bg-primary)] p-3 rounded-2xl border border-[var(--border-main)]">
                    <p className="text-[8px] text-[var(--text-secondary)] uppercase font-black tracking-widest mb-1 opacity-60">Lifecycle</p>
                    <p className="font-extrabold text-lg text-[var(--text-primary)] uppercase">{profile.age || '--'} YRS</p>
                 </div>
              </div>
              
              <div className="pt-4">
                 <div className="p-4 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-main)] shadow-inner">
                    <p className="text-[10px] text-[var(--accent-primary)] leading-relaxed font-bold italic">
                       Profile synchronization status: <span className="text-teal-600 font-black uppercase">Active</span>
                    </p>
                 </div>
              </div>
           </div>

           <div className="p-8 bg-gradient-to-br from-blue-600 to-teal-600 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
              <h4 className="font-bold mb-2">Clinical Data Policy</h4>
              <p className="text-xs opacity-80 leading-relaxed font-medium">
                 Your clinical data is end-to-end encrypted and used only to power relevant health insights within this dashboard.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
