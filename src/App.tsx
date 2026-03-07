import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import AuthPage from './features/auth/AuthPage';
import StaffPage from './features/staff/StaffPage';
import PreferencesPage from './features/preferences/PreferencesPage';
import SchedulePage from './features/schedule/SchedulePage';
import TimePatternsPage from './pages/settings/TimePatternsPage';
import RolesPage from './pages/settings/RolesPage';
import ClassesPage from './pages/settings/ClassesPage';
import AppearancePage from './pages/settings/AppearancePage';
import ShiftRequirementsPage from './pages/settings/ShiftRequirementsPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { loading, currentUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-indigo-600 dark:text-indigo-400 font-medium tracking-widest text-lg animate-pulse">
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/" /> : <AuthPage />}
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<SchedulePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="settings" element={<Navigate to="/settings/patterns" replace />} />
          <Route path="settings/patterns" element={<TimePatternsPage />} />
          <Route path="settings/roles" element={<RolesPage />} />
          <Route path="settings/classes" element={<ClassesPage />} />
          <Route path="settings/shift-requirements" element={<ShiftRequirementsPage />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
        </Route>
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
