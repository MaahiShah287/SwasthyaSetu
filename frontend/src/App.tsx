import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import ClaimAnalyzer from './pages/ClaimAnalyzer';
import DashboardLayout from './layouts/DashboardLayout';
import { useAuth } from './hooks/useAuth';

import MyReports from './pages/MyReports';
import UploadReports from './pages/UploadReports';
import EmergencyProfile from './pages/EmergencyProfile';
import ProblemHub from './pages/innovation/ProblemHub';
import IdeaGenerator from './pages/innovation/IdeaGenerator';
import CollaborationThreads from './pages/innovation/CollaborationThreads';
import DataSandbox from './pages/innovation/DataSandbox';
import Settings from './pages/Settings';
import DiseaseHub from './pages/DiseaseHub';
import DoctorDashboard from './pages/DoctorDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import DoctorDirectory from './pages/DoctorDirectory';
import HospitalDirectory from './pages/HospitalDirectory';
import HealthTriage from './pages/HealthTriage';
import VaccinationHub from './pages/VaccinationHub';
import FollowUpDashboard from './pages/FollowUpDashboard';
import { OfflineSyncDashboard } from './pages/OfflineSyncDashboard';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;

  const userRole = localStorage.getItem("userRole") || "patient";
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    if (userRole === "doctor") return <Navigate to="/doctor" />;
    if (userRole === "hospital") return <Navigate to="/hospital" />;
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
      <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/follow-ups" element={
        <ProtectedRoute>
          <DashboardLayout>
            <FollowUpDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/vaccinations" element={
        <ProtectedRoute>
          <DashboardLayout>
            <VaccinationHub />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/doctors" element={

        <ProtectedRoute>
          <DashboardLayout>
            <DoctorDirectory />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/hospitals" element={
        <ProtectedRoute>
          <DashboardLayout>
            <HospitalDirectory />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/triage" element={
        <ProtectedRoute>
          <DashboardLayout>
            <HealthTriage />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/upload" element={
        <ProtectedRoute>
          <DashboardLayout>
            <UploadReports />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute>
          <DashboardLayout>
            <MyReports />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/claims" element={
        <ProtectedRoute>
          <DashboardLayout>
            <ClaimAnalyzer />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/disease-hub" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DiseaseHub />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <EmergencyProfile />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Innovation Lab */}
      <Route path="/innovation/problems" element={
        <ProtectedRoute>
          <DashboardLayout>
            <ProblemHub />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/innovation/ideas" element={
        <ProtectedRoute>
          <DashboardLayout>
            <IdeaGenerator />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/innovation/threads" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CollaborationThreads />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/innovation/sandbox" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DataSandbox />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/offline-sync" element={
        <ProtectedRoute>
          <DashboardLayout>
            <OfflineSyncDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Doctor Dashboard */}
      <Route path="/doctor" element={
        <ProtectedRoute allowedRoles={['doctor', 'admin']}>
          <DashboardLayout>
            <DoctorDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Hospital Dashboard */}
      <Route path="/hospital" element={
        <ProtectedRoute allowedRoles={['hospital', 'admin']}>
          <DashboardLayout>
            <HospitalDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
