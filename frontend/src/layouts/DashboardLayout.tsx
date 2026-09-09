import { useTheme } from '../context/ThemeContext';
import { 
  Sun, 
  Moon, 
  LogOut, 
  User, 
  LayoutDashboard, 
  FileUp, 
  ClipboardList, 
  Shield, 
  Settings, 
  Search, 
  Bell, 
  Menu, 
  X, 
  Lightbulb, 
  MessageSquare, 
  Database, 
  FlaskConical, 
  Map as MapIcon, 
  Stethoscope,
  Building2,
  Truck,
  Calendar,
  Bed,
  Activity,
  Sparkles,
  Syringe
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import ChatbotWidget from '../components/ChatbotWidget';
import LocationPermissionModal from '../components/disease/LocationPermissionModal';
import api from '../api/instance';
import AIAutocompleteInput from '../components/AIAutocompleteInput';

const SidebarItem = ({ to, icon: Icon, label, active, onClick }: any) => (
  <Link to={to} onClick={onClick}>
    <motion.div 
      whileHover={{ backgroundColor: active ? '' : 'rgba(37, 99, 235, 0.05)' }}
      className={`relative flex items-center space-x-3 p-3.5 rounded-xl transition-all duration-300 ${
        active 
          ? 'bg-blue-50 text-blue-600' 
          : 'text-slate-600 dark:text-slate-400'
      }`}
    >
      <Icon size={20} className={active ? 'text-blue-600' : 'text-slate-400'} />
      <span className={`font-semibold text-sm ${active ? 'text-blue-600' : ''}`}>{label}</span>
      {active && <div className="sidebar-indicator" />}
    </motion.div>
  </Link>
);

const BackgroundLayer = () => {
  const { theme } = useTheme();
  return (
    <div className="bg-layer">
      <div className="particle-grid" />
      {theme === 'dark' ? (
        <>
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.03, 0.08, 0.03] 
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[130px] rounded-full" 
          />
        </>
      ) : (
        <>
          <motion.div 
            animate={{ 
              y: [0, -30, 0],
              scale: [1, 1.05, 1] 
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] right-[-5%] w-[40%] h-[40%] bg-blue-100/40 blur-[120px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              y: [0, 30, 0],
              scale: [1.05, 1, 1.05] 
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: -5 }}
            className="absolute bottom-[10%] left-[-5%] w-[35%] h-[35%] bg-teal-50/50 blur-[120px] rounded-full" 
          />
        </>
      )}
    </div>
  );
};

const Footer = () => (
  <footer className="mt-auto py-8 px-6 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs font-medium space-y-4 md:space-y-0">
    <div className="flex items-center space-x-2">
      <Shield size={14} className="text-blue-500" />
      <span>© 2026 SwasthyaSetu AI • Secure Medical Framework</span>
    </div>
    <div className="flex space-x-6">
      <a href="#" className="hover:text-blue-500 transition-colors">Privacy Policy</a>
      <a href="#" className="hover:text-blue-500 transition-colors">Terms of Service</a>
      <a href="#" className="hover:text-blue-500 transition-colors">Contact Support</a>
    </div>
  </footer>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { logout, user } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setShowLocationModal(false);
        try {
          await api.post('/diseases/update-location', {
            latitude,
            longitude
          });
        } catch (error) {
          console.error("Error updating location:", error);
        }
      },
      (error) => {
        console.error("Location error:", error);
        setShowLocationModal(true);
      }
    );
  };

  const role = localStorage.getItem("userRole") || 'patient';

  const patientItems = [
    { to: '/', icon: LayoutDashboard, label: 'Health Center' },
    { to: '/follow-ups', icon: Calendar, label: 'Follow-Up & Care Plan' },
    { to: '/vaccinations', icon: Syringe, label: 'Vaccination Tracking' },
    { to: '/doctors', icon: Stethoscope, label: 'Find Doctors' },
    { to: '/hospitals', icon: Building2, label: 'Hospital Vacancies' },
    { to: '/triage', icon: Sparkles, label: 'AI Health Triage' },
    { to: '/upload', icon: FileUp, label: 'Vault Upload' },
    { to: '/reports', icon: ClipboardList, label: 'Medical Records' },
    { to: '/claims', icon: Shield, label: 'Clinical Audit' },
    { to: '/disease-hub', icon: MapIcon, label: 'Outbreak Radar' },
    { to: '/profile', icon: User, label: 'Patient Identity' },
    { type: 'divider', label: 'Innovation Engine' },
    { to: '/innovation/problems', icon: FlaskConical, label: 'Challenges' },
    { to: '/innovation/ideas', icon: Lightbulb, label: 'Clinical Ideas' },
    { to: '/innovation/threads', icon: MessageSquare, label: 'Collaboration' },
    { to: '/innovation/sandbox', icon: Database, label: 'Data Lab' },
    { to: '/settings', icon: Settings, label: 'Preferences' },
  ];

  const doctorItems = [
    { to: '/doctor', icon: LayoutDashboard, label: 'Clinic Overview' },
    { to: '/follow-ups', icon: Calendar, label: 'Follow-Up Management' },
    { to: '/doctors', icon: Stethoscope, label: 'Doctor Network' },
    { to: '/hospitals', icon: Building2, label: 'Hospital Network' },
    { to: '/triage', icon: Sparkles, label: 'AI Health Triage' },
    { to: '/reports', icon: ClipboardList, label: 'Case Folders' },
    { to: '/disease-hub', icon: MapIcon, label: 'Epidemiology' },
    { type: 'divider', label: 'Medical Intelligence' },
    { to: '/claims', icon: Shield, label: 'Claim Verification' },
    { to: '/innovation/problems', icon: FlaskConical, label: 'Clinical Research' },
    { to: '/settings', icon: Settings, label: 'Practice Profile' },
  ];

  const hospitalItems = [
    { to: '/hospital', icon: Building2, label: 'Hospital Command' },
    { to: '/follow-ups', icon: Calendar, label: 'Follow-Up & Referrals' },
    { to: '/hospitals', icon: Bed, label: 'Live Bed Matrix' },
    { to: '/doctors', icon: Stethoscope, label: 'Doctor Specialists' },
    { to: '/disease-hub', icon: MapIcon, label: 'Outbreak Radar' },
    { type: 'divider', label: 'Clinical Operations' },
    { to: '/claims', icon: Shield, label: 'Hospital Audit' },
    { to: '/settings', icon: Settings, label: 'Facility Profile' },
  ];

  const menuItems = role === 'doctor' ? doctorItems : role === 'hospital' ? hospitalItems : patientItems;


  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'dark text-white' : 'text-slate-900'}`}>
      <BackgroundLayer />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-72 z-50 
        transition-all duration-300 transform 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl lg:shadow-none
        bg-[var(--bg-sidebar)] border-r border-[var(--border-main)]
      `}>
        <div className="h-20 flex items-center px-8 border-b border-[var(--border-main)]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              SwasthyaSetu
            </h1>
          </div>
          <button className="lg:hidden ml-auto p-2" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>
        
        <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto pr-2 scrollbar-hide">
          {menuItems.map((item: any, i: number) => (
            item.type === 'divider' ? (
              <div key={i} className="pt-6 pb-2 px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {item.label}
              </div>
            ) : (
              <SidebarItem 
                key={item.to} 
                {...item} 
                active={location.pathname === item.to}
                onClick={() => setIsSidebarOpen(false)}
              />
            )
          ))}
        </nav>
        
        <div className="p-6 border-t border-slate-100 dark:border-white/5">
          <button 
            onClick={logout}
            className="flex items-center space-x-3 p-4 w-full hover:bg-red-50 text-red-600 rounded-xl transition-all group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm uppercase tracking-wider">Secure Terminate</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 flex justify-between items-center px-6 lg:px-10 backdrop-blur-md border-b border-[var(--border-main)] bg-[var(--glass-bg)] z-30 transition-all duration-300">
          <div className="flex items-center space-x-6">
            <button className="lg:hidden p-2 text-[var(--text-secondary)]" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center bg-[var(--bg-primary)] rounded-xl px-4 h-11 border border-[var(--border-main)] focus-within:border-[var(--accent-primary)] focus-within:bg-[var(--bg-card)] transition-all">
              <Search size={18} className="text-[var(--text-secondary)] mr-3" />
              <AIAutocompleteInput 
                value={globalSearch}
                onChange={setGlobalSearch}
                placeholder="Lookup clinical codes or records..."
                context="global_search"
                className="bg-transparent outline-none w-72 text-sm font-medium border-none p-0 focus:ring-0 text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white dark:border-slate-800" />
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-2" />
            
            <div className="flex items-center space-x-3 pl-2">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{user?.name || 'Authorized Guest'}</p>
                <div className="flex items-center justify-end space-x-1.5 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Verified Node</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-600 p-[2px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                <div className="w-full h-full rounded-[10px] bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                   <User size={22} className="text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 lg:p-10 max-w-[1600px] w-full mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {children}
            </motion.div>
          </div>
          
          <Footer />
        </div>
      </main>

      {showLocationModal && <LocationPermissionModal onEnable={requestLocation} />}
      <ChatbotWidget />
    </div>
  );
}
