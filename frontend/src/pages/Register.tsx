import { useState } from 'react';
import api from '../api/instance';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  ShieldCheck, 
  Loader2, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  User, 
  Phone, 
  Calendar, 
  Users, 
  Building2, 
  Stethoscope, 
  Clock, 
  Bed, 
  Truck, 
  Layers, 
  Award,
  MapPin
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';

const SPECIALIZATIONS = [
  "Cardiology",
  "General Medicine",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Gynecology",
  "Dermatology",
  "Emergency Medicine",
  "General Surgery",
  "Pulmonology",
  "Psychiatry",
  "ENT (Otolaryngology)",
  "Ophthalmology"
];

const DEPARTMENTS_LIST = [
  "General Medicine",
  "Emergency & Trauma",
  "Cardiology",
  "ICU / Critical Care",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Oncology",
  "Radiology & Imaging",
  "Pathology & Diagnostics",
  "Ambulance & Transport"
];

export default function Register() {
  const { theme } = useTheme();
  const [role, setRole] = useState<'patient' | 'doctor' | 'hospital'>('patient');
  
  // Patient / Common State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('Male');

  // Doctor Specific State
  const [specialization, setSpecialization] = useState('Cardiology');
  const [experienceYears, setExperienceYears] = useState('5');
  const [qualification, setQualification] = useState('MD, DM (Cardiology)');
  const [facilityName, setFacilityName] = useState('Sanjeevani District Civil Hospital');
  const [consultationMode, setConsultationMode] = useState('Both'); // Online Video, Clinic, Both
  const [workingDays, setWorkingDays] = useState('Mon-Fri');
  const [workingHours, setWorkingHours] = useState('09:00 - 17:00');

  // Hospital Specific State
  const [hospitalName, setHospitalName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [generalBeds, setGeneralBeds] = useState('40');
  const [icuBeds, setIcuBeds] = useState('10');
  const [emergencyBeds, setEmergencyBeds] = useState('5');
  const [emergency24x7, setEmergency24x7] = useState(true);
  const [ambulanceCount, setAmbulanceCount] = useState('3');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([
    "General Medicine", "Emergency & Trauma", "Cardiology", "ICU / Critical Care"
  ]);

  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Form, 2: OTP
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const payload: any = {
        name: role === 'hospital' ? hospitalName : name,
        email,
        phone,
        password,
        role
      };

      if (role === 'patient') {
        payload.age = parseInt(age) || 25;
        payload.gender = gender;
      } else if (role === 'doctor') {
        payload.specialization = specialization;
        payload.experience_years = parseInt(experienceYears) || 1;
        payload.qualification = qualification;
        payload.facility_name = facilityName;
        payload.consultation_mode = consultationMode;
        payload.availability = `${workingDays} ${workingHours}`;
      } else if (role === 'hospital') {
        payload.hospital_name = hospitalName;
        payload.address = address;
        payload.city = city;
        payload.departments = selectedDepartments;
        payload.general_beds = parseInt(generalBeds) || 20;
        payload.icu_beds = parseInt(icuBeds) || 5;
        payload.emergency_beds = parseInt(emergencyBeds) || 2;
        payload.emergency_24_7 = emergency24x7;
        payload.ambulance_count = parseInt(ambulanceCount) || 1;
      }

      await api.post('/auth/register', payload);
      setStep(2);
      setMessage('A security verification code has been dispatched to your email.');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Enrollment failed. Please verify your data.');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/verify-otp', { email, otp });
      setMessage('Account synthesized successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Verification failed.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500">
      <div className="w-full max-w-3xl">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="premium-card p-6 md:p-10 space-y-7 relative overflow-hidden"
        >
          <div className="space-y-1 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              {step === 1 ? 'Register Identity' : 'Verify Security Code'}
            </h2>
            <p className="text-[var(--text-secondary)] font-bold text-xs md:text-sm opacity-70">
              {step === 1 ? 'Join the SwasthyaSetu AI medical network as a Patient, Doctor, or Hospital' : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex items-start space-x-3 p-4 rounded-2xl text-xs font-bold ${
                  message.includes('successfully') || message.includes('dispatched') 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                }`}
              >
                <ShieldCheck size={16} className="mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 1 ? (
            <form onSubmit={handleRegister} className="space-y-6">
              {/* 3-Role Selection Tabs */}
              <div className="flex p-1.5 bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-2xl gap-1">
                <button 
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                    role === 'patient' 
                      ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-blue-500/20' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--accent-primary)] opacity-70 hover:opacity-100'
                  }`}
                >
                  <User size={16} />
                  <span>🧑 Patient</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('doctor')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                    role === 'doctor' 
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' 
                      : 'text-[var(--text-secondary)] hover:text-teal-600 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Stethoscope size={16} />
                  <span>🩺 Doctor</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('hospital')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all font-bold text-xs ${
                    role === 'hospital' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-[var(--text-secondary)] hover:text-indigo-600 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Building2 size={16} />
                  <span>🏥 Hospital</span>
                </button>
              </div>

              {/* COMMON CORE CONTACT FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {role !== 'hospital' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">
                      {role === 'doctor' ? 'Doctor Full Name' : 'Full Name'}
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                      <input 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={role === 'doctor' ? 'Dr. Siddharth Sharma' : 'Rahul Verma'}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">
                      Hospital / Facility Name
                    </label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                      <input 
                        required
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="Apex Specialty Multi-Care Hospital"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === 'doctor' ? 'doctor@hospital.org' : role === 'hospital' ? 'admin@hospital.org' : 'patient@email.com'}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Phone / Helpline</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                    <input 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98200 00000"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {role === 'patient' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Age</label>
                       <input 
                         type="number"
                         required
                         value={age}
                         onChange={(e) => setAge(e.target.value)}
                         placeholder="28"
                         className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 px-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                       />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 px-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                )}

                {role === 'doctor' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Specialization</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 px-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                    >
                      {SPECIALIZATIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {role === 'hospital' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">City / Region</label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                      <input 
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Mumbai"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DOCTOR SPECIFIC SECTION */}
              {role === 'doctor' && (
                <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-500/5 border border-teal-200 dark:border-teal-500/20 space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">Clinical Credentials & Availability</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Experience (Years)</label>
                      <input 
                        type="number"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Qualification</label>
                      <input 
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="MD, DM"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Consultation Mode</label>
                      <select
                        value={consultationMode}
                        onChange={(e) => setConsultationMode(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      >
                        <option value="Both">Both (Online + Clinic)</option>
                        <option value="Online Video">Online Video Only</option>
                        <option value="Clinic">Clinic In-Person Only</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Hospital/Clinic Affiliation</label>
                      <input 
                        value={facilityName}
                        onChange={(e) => setFacilityName(e.target.value)}
                        placeholder="District Civil Hospital"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Practice Hours</label>
                      <input 
                        value={workingHours}
                        onChange={(e) => setWorkingHours(e.target.value)}
                        placeholder="09:00 - 17:00"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* HOSPITAL SPECIFIC SECTION */}
              {role === 'hospital' && (
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Hospital Bed Capacity & Emergency Readiness</p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500">Facility Address</label>
                    <input 
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Opposite Central Station, Healthcare Corridor"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">General Beds</label>
                      <input 
                        type="number"
                        value={generalBeds}
                        onChange={(e) => setGeneralBeds(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ICU Beds</label>
                      <input 
                        type="number"
                        value={icuBeds}
                        onChange={(e) => setIcuBeds(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Emergency Beds</label>
                      <input 
                        type="number"
                        value={emergencyBeds}
                        onChange={(e) => setEmergencyBeds(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Ambulances</label>
                      <input 
                        type="number"
                        value={ambulanceCount}
                        onChange={(e) => setAmbulanceCount(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-2.5 px-3 text-sm font-bold mt-1"
                      />
                    </div>
                  </div>

                  {/* Department Tags */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500">Available Departments (Click to toggle)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEPARTMENTS_LIST.map(dept => {
                        const selected = selectedDepartments.includes(dept);
                        return (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => toggleDepartment(dept)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              selected 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-[var(--bg-primary)] border border-[var(--border-main)] text-slate-500 hover:border-indigo-400'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{dept}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PASSWORD FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 ml-1">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60" size={17} />
                    <input 
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[var(--accent-primary)] text-sm font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className={`w-full text-white flex items-center justify-center space-x-3 py-4 rounded-2xl text-base font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
                  role === 'doctor'
                    ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'
                    : role === 'hospital'
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                    : 'bg-[var(--accent-primary)] hover:bg-blue-700 shadow-blue-500/20'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : <ArrowRight size={22} />}
                <span className="uppercase tracking-widest text-xs md:text-sm">
                  Register as {role === 'doctor' ? 'Doctor' : role === 'hospital' ? 'Hospital' : 'Patient'}
                </span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="space-y-3 text-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Security Code</label>
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-main)] rounded-3xl py-7 text-center text-4xl font-black outline-none tracking-[0.4em] focus:border-[var(--accent-primary)] transition-all text-[var(--text-primary)]"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[var(--accent-primary)] text-white flex items-center justify-center space-x-3 py-4 rounded-2xl text-base font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={22} />}
                <span className="uppercase tracking-widest text-xs md:text-sm">Complete Enrollment</span>
              </button>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="w-full text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent-primary)] opacity-60 hover:opacity-100 transition-colors text-center"
              >
                Edit Registration Details
              </button>
            </form>
          )}

          <div className="text-center pt-2">
             <p className="text-[var(--text-secondary)] font-bold text-xs uppercase tracking-widest opacity-60">
               Existing member? <Link to="/login" className="text-[var(--accent-primary)] hover:underline ml-2">Secure Login</Link>
             </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
