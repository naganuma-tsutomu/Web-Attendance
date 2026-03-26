import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useRef } from 'react';
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
import StaffLoginPage from './pages/StaffLoginPage';
import StaffPreferencePage from './pages/StaffPreferencePage';
import LandingPage from './pages/LandingPage';

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
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/admin" /> : <AuthPage />}
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<SchedulePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="settings" element={<Navigate to="/admin/settings/patterns" replace />} />
          <Route path="settings/patterns" element={<TimePatternsPage />} />
          <Route path="settings/roles" element={<RolesPage />} />
          <Route path="settings/classes" element={<ClassesPage />} />
          <Route path="settings/shift-requirements" element={<ShiftRequirementsPage />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
        </Route>
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/preference" element={<StaffPreferencePage />} />
      </Routes>
    </Router>
  );
};

const queryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
};

function App() {
  // モジュールスコープではなくコンポーネント内で管理することで
  // HMR や将来的な SSR でのリークを防ぐ
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient(queryClientConfig);
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <Toaster position="top-right" richColors />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
