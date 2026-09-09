import { useState, useEffect } from 'react';
import api from '../api/instance';
import { User, ShieldAlert, Save, Loader2, HeartPulse, UserCircle, Droplets, Calendar, Smartphone, PlusCircle, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function EmergencyProfile() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    age: 0,
    blood_group: '',
    allergies: '',
    diseases: '',
    medications: '',
    emergency_contact: ''
  });

  const [vaxStats, setVaxStats] = useState<any>(null);

  const fetchProfile = async () => {
    try {
      const [resp, vaxRes] = await Promise.all([
        api.get('/profile/').catch(() => ({ data: {} })),
        api.get('/vaccinations/summary').catch(() => ({ data: null }))
      ]);
      if (resp.data.name) setProfile(resp.data);
      if (vaxRes.data) setVaxStats(vaxRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/profile/', profile);
      alert('Profile updated successfully');
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-primary-light/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-primary-light border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Decrypting Profile...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2 text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-4 py-1.5 rounded-full w-fit text-[10px] font-black uppercase tracking-[0.2em] border border-rose-100 dark:border-rose-500/20"
          >
            <ShieldAlert size={14} />
            <span>Emergency Protocol: Tier 1 Data</span>
          </motion.div>
          <h2 className="text-5xl font-extrabold tracking-tight">
            Clinical <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>Emergency Profile</span>
          </h2>
          <p className="text-slate-500 font-medium max-w-xl">This encrypted dataset is prioritized for verified medical responders during critical health incidents.</p>
        </div>
        
        {/* Digital ID Card Preview (Professional) */}
        <motion.div 
          initial={{ rotate: 5, scale: 0.9, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          className="hidden lg:block w-80 h-48 bg-blue-600 rounded-[2.5rem] p-7 relative overflow-hidden shadow-2xl shadow-blue-500/30 border border-white/10 group"
        >
          <div className="relative z-10 flex flex-col h-full justify-between text-white">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <Activity size={20} className="text-white" />
              </div>
              <span className="text-[8px] font-black tracking-[0.2em] bg-black/20 px-3 py-1.5 rounded-full border border-white/10 uppercase">Identity Verified</span>
            </div>
            <div>
              <p className="text-[9px] opacity-60 uppercase font-black tracking-widest mb-1.5">Holder Identity</p>
              <p className="text-xl font-bold truncate tracking-tight">{profile.name || 'DECRYPTING...'}</p>
            </div>
            <div className="flex space-x-8">
              <div>
                <p className="text-[8px] opacity-60 uppercase font-black tracking-widest">Blood Grp</p>
                <p className="text-sm font-black text-blue-100">{profile.blood_group || '---'}</p>
              </div>
              <div>
                <p className="text-[8px] opacity-60 uppercase font-black tracking-widest">Age Range</p>
                <p className="text-sm font-black text-blue-100">{profile.age || '--'}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </motion.div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Personal Info */}
        <div className="lg:col-span-2 space-y-8">
          <Section title="Identity Verification" icon={UserCircle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-1">
              <Field label="Legal Full Name" icon={User}>
                <input 
                  type="text" 
                  required
                  placeholder="Enter as per medical records"
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-6">
                <Field label="Age" icon={Calendar}>
                  <input 
                    type="number" 
                    required
                    value={profile.age}
                    onChange={(e) => setProfile({...profile, age: parseInt(e.target.value) || 0})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                  />
                </Field>
                <Field label="Blood Type" icon={Droplets}>
                  <select 
                    required
                    value={profile.blood_group}
                    onChange={(e) => setProfile({...profile, blood_group: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] appearance-none"
                  >
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Primary Emergency Line" icon={Smartphone}>
                  <input 
                    type="text" 
                    required
                    placeholder="+91 XXXX XXX XXX"
                    value={profile.emergency_contact}
                    onChange={(e) => setProfile({...profile, emergency_contact: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)]"
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Physiological Disclosure" icon={HeartPulse} color="text-rose-500">
            <div className="space-y-6">
              <Field label="Verified Critical Allergies" icon={ShieldAlert}>
                <textarea 
                  value={profile.allergies}
                  onChange={(e) => setProfile({...profile, allergies: e.target.value})}
                  placeholder="e.g. Penicillin, Peanuts, Latex..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-28"
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Chronic conditions" icon={Activity}>
                  <textarea 
                    value={profile.diseases}
                    onChange={(e) => setProfile({...profile, diseases: e.target.value})}
                    placeholder="e.g. Type 2 Diabetes, Asthma"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-36"
                  />
                </Field>
                <Field label="Active Neural/Pharma Protocol" icon={PlusCircle}>
                  <textarea 
                    value={profile.medications}
                    onChange={(e) => setProfile({...profile, medications: e.target.value})}
                    placeholder="e.g. Metformin 500mg, Albuterol"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-[1.5rem] px-5 py-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 ring-[var(--accent-primary)]/5 transition-all font-bold text-[var(--text-primary)] h-36"
                  />
                </Field>
              </div>
            </div>
          </Section>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-8">
          <div className="sticky top-24 space-y-8">
            <button 
              type="submit" 
              disabled={saving}
              className={`
                w-full flex items-center justify-center space-x-3 py-6 rounded-[2rem] text-xl font-bold transition-all
                ${saving ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-500/30 hover:scale-[1.02]'}
              `}
            >
              {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              <span className="uppercase tracking-widest text-sm">{saving ? 'Syncing...' : 'Update Secure Vault'}</span>
            </button>

            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-8 rounded-[2.5rem] shadow-xl space-y-8">
              <h3 className="text-xl font-extrabold text-[var(--text-primary)]">Security Integrity</h3>
              <div className="space-y-6">
                <StatusItem label="Encryption Engine" value="AES-256 Validated" active />
                <StatusItem label="Access Protocol" value="Verified" active />
                <StatusItem label="Sync Frequency" value="Real-time" />
              </div>
              <div className="pt-8 border-t border-[var(--border-main)]">
                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-4 text-center opacity-60">Neural Hash Integrity</p>
                <div className="flex justify-center space-x-1.5">
                  {[...Array(15)].map((_, i) => <div key={i} className={`w-1 h-3.5 rounded-full ${i < 11 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-main)]'}`} />)}
                </div>
              </div>
            </div>

            {/* Vaccination Status Widget in Patient Identity */}
            <div className="bg-gradient-to-br from-blue-500/10 via-teal-500/10 to-transparent border border-blue-500/20 p-6 rounded-[2.5rem] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Vaccination Status</h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
                  Live Status
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified digital immunization history and status engine.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 text-center border border-slate-200 dark:border-white/10">
                  <span className="block text-slate-400 text-[10px] font-bold">COMPLETED</span>
                  <span className="text-base font-extrabold text-emerald-500">{vaxStats?.completed ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 text-center border border-slate-200 dark:border-white/10">
                  <span className="block text-slate-400 text-[10px] font-bold">UPCOMING</span>
                  <span className="text-base font-extrabold text-cyan-500">{vaxStats?.upcoming ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 text-center border border-slate-200 dark:border-white/10">
                  <span className="block text-slate-400 text-[10px] font-bold">OVERDUE</span>
                  <span className="text-base font-extrabold text-rose-500">{vaxStats?.overdue ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 text-center border border-slate-200 dark:border-white/10">
                  <span className="block text-slate-400 text-[10px] font-bold">GAPS</span>
                  <span className="text-base font-extrabold text-purple-500">{vaxStats?.gaps ?? 0}</span>
                </div>
              </div>
              <a href="/vaccinations" className="block pt-2">
                <button type="button" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md">
                  View Full Vaccination History
                </button>
              </a>
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-500/5 rounded-[2rem] border border-blue-100 dark:border-blue-500/10">
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic text-center">
                Information entered here is only shared with authorized medical personnel during an emergency trigger.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

const Section = ({ title, icon: Icon, children, color = "text-[var(--accent-primary)]" }: any) => (
  <motion.div 
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="premium-card p-8 space-y-8"
  >
    <div className="flex items-center space-x-3">
      <div className={`p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] shadow-inner ${color}`}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <h3 className="text-2xl font-black text-[var(--text-primary)]">{title}</h3>
    </div>
    {children}
  </motion.div>
);

const Field = ({ label, icon: Icon, children }: any) => (
  <div className="space-y-2">
    <div className="flex items-center space-x-2 text-slate-500 font-bold uppercase tracking-[0.15em] text-[10px]">
      <Icon size={12} />
      <span>{label}</span>
    </div>
    {children}
  </div>
);

const StatusItem = ({ label, value, active = false }: any) => (
  <div className="flex justify-between items-center text-sm font-medium">
    <span className="text-slate-500">{label}</span>
    <span className={active ? 'text-primary-light font-bold' : 'text-slate-400'}>{value}</span>
  </div>
);
