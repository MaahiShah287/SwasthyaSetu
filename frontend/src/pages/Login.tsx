import { useState } from 'react';
import api from '../api/instance';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck, User, Building2, Stethoscope, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { theme } = useTheme();
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'hospital'>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const Blobs = () => (
    <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-blue-500/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-teal-500/5 blur-[120px] rounded-full" />
    </div>
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/auth/login', { email, password });
      
      const { name, role, token, facility_id, doctor_id } = response.data;
      localStorage.setItem("userName", name);
      localStorage.setItem("userRole", role);
      localStorage.setItem("token", token);
      if (facility_id) localStorage.setItem("facilityId", facility_id);
      if (doctor_id) localStorage.setItem("doctorId", doctor_id);
      
      login();
      
      if (role === 'doctor') {
        navigate('/doctor');
      } else if (role === 'hospital') {
        navigate('/hospital');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    }
    setLoading(false);
  };

  const getRoleBadge = () => {
    switch (selectedRole) {
      case 'doctor':
        return { label: 'Doctor & Specialist Portal', color: 'text-teal-600 dark:text-teal-400 border-teal-500/20 bg-teal-500/10', icon: Stethoscope };
      case 'hospital':
        return { label: 'Hospital Administration Node', color: 'text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10', icon: Building2 };
      default:
        return { label: 'Patient & Family Portal', color: 'text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10', icon: User };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500">
      <Blobs />
      
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-4">
          <motion.div 
            key={selectedRole}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] mx-auto ${badge.color}`}
          >
            <badge.icon size={13} />
            <span>{badge.label}</span>
          </motion.div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            SwasthyaSetu <span className={theme === 'dark' ? 'gradient-text-dark' : 'gradient-text-light'}>AI</span>
          </h1>
          <p className="text-slate-500 font-medium">Unified Healthcare Intelligence & Clinical Ecosystem</p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="premium-card p-8 md:p-10 space-y-7 relative overflow-hidden"
        >
          {/* Role Switcher Tabs */}
          <div className="flex p-1.5 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setSelectedRole('patient')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                selectedRole === 'patient'
                  ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-blue-500/20'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-primary)] opacity-70 hover:opacity-100'
              }`}
            >
              <User size={16} />
              <span>Patient</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('doctor')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                selectedRole === 'doctor'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                  : 'text-[var(--text-secondary)] hover:text-teal-600 opacity-70 hover:opacity-100'
              }`}
            >
              <Stethoscope size={16} />
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('hospital')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                selectedRole === 'hospital'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-[var(--text-secondary)] hover:text-indigo-600 opacity-70 hover:opacity-100'
              }`}
            >
              <Building2 size={16} />
              <span>Hospital</span>
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {selectedRole === 'doctor' ? 'Doctor Access' : selectedRole === 'hospital' ? 'Hospital Command Login' : 'Sign In'}
            </h2>
            <p className="text-slate-400 font-medium text-xs md:text-sm">
              {selectedRole === 'doctor'
                ? 'Manage appointment queues, patient charts, and online video consultations.'
                : selectedRole === 'hospital'
                ? 'Manage live bed vacancies, emergency capacity, and ambulance dispatch.'
                : 'Access your health records, book doctors, hospital slots, and ambulances.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start space-x-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 text-xs font-bold"
              >
                <AlertCircle size={16} className="mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">
                {selectedRole === 'hospital' ? 'Hospital Admin Email' : 'Email Address'}
              </label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-primary)] transition-colors" size={20} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'doctor' 
                      ? 'dr.siddharth@swasthyasetu.org' 
                      : selectedRole === 'hospital' 
                      ? 'admin@sanjeevani.org' 
                      : 'patient@swasthyasetu.org'
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl py-4 md:py-5 pl-14 pr-6 outline-none focus:ring-4 ring-[var(--accent-primary)]/5 focus:border-[var(--accent-primary)]/50 transition-all text-base md:text-lg font-bold text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Password</label>
                <Link to="/forgot-password" className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-primary)] hover:underline">Reset?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-primary)] transition-colors" size={20} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl py-4 md:py-5 pl-14 pr-6 outline-none focus:ring-4 ring-[var(--accent-primary)]/5 focus:border-[var(--accent-primary)]/50 transition-all text-base md:text-lg font-bold text-[var(--text-primary)]"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full text-white flex items-center justify-center space-x-3 py-4 md:py-5 rounded-2xl text-base md:text-lg font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
                selectedRole === 'doctor'
                  ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'
                  : selectedRole === 'hospital'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  : 'bg-[var(--accent-primary)] hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={22} /> : <ArrowRight size={22} />}
              <span className="uppercase tracking-widest text-xs md:text-sm">Proceed to Dashboard</span>
            </button>
          </form>

          <div className="text-center pt-2">
             <p className="text-[var(--text-secondary)] font-bold text-xs uppercase tracking-widest opacity-70">
               New {selectedRole}? <Link to="/register" className="text-[var(--accent-primary)] hover:underline ml-2">Register Identity</Link>
             </p>
          </div>

          <div className="pt-6 border-t border-[var(--border-main)] text-center">
            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-40">
              Validated by HealthNet Role Matrix Security
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
