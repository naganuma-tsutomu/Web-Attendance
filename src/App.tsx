import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { UnsavedChangesProvider } from './lib/UnsavedChangesContext';

const Layout = lazy(() => import('./components/Layout'));
const AuthPage = lazy(() => import('./features/auth/AuthPage'));
const StaffPage = lazy(() => import('./features/staff/StaffPage'));
const PreferencesPage = lazy(() => import('./features/preferences/PreferencesPage'));
const SchedulePage = lazy(() => import('./features/schedule/SchedulePage'));
const TimePatternsPage = lazy(() => import('./pages/settings/TimePatternsPage'));
const RolesPage = lazy(() => import('./pages/settings/RolesPage'));
const ClassesPage = lazy(() => import('./pages/settings/ClassesPage'));
const AppearancePage = lazy(() => import('./pages/settings/AppearancePage'));
const ExcelSettingsPage = lazy(() => import('./pages/settings/ExcelSettingsPage'));
const RotationPage = lazy(() => import('./pages/settings/RotationPage'));
const StaffLoginPage = lazy(() => import('./pages/StaffLoginPage'));
const StaffPreferencePage = lazy(() => import('./pages/StaffPreferencePage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const UserManualPage = lazy(() => import('./pages/UserManualPage'));
const UpdateHistoryPage = lazy(() => import('./pages/UpdateHistoryPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage'));

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
    <div className="text-indigo-600 dark:text-indigo-400 font-medium tracking-widest text-lg animate-pulse">
      読み込み中...
    </div>
  </div>
);

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { loading, currentUser } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <UnsavedChangesProvider>
        <ScrollToTop />
        <Suspense fallback={<LoadingScreen />}>
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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="settings" element={<Navigate to="/admin/settings/patterns" replace />} />
          <Route path="settings/patterns" element={<TimePatternsPage />} />
          <Route path="settings/roles" element={<RolesPage />} />
          <Route path="settings/classes" element={<ClassesPage />} />
          <Route path="settings/shift-requirements" element={<Navigate to="/admin/settings/classes" replace />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
          <Route path="settings/excel" element={<ExcelSettingsPage />} />
          <Route path="settings/rotation" element={<RotationPage />} />
          <Route path="manual" element={<UserManualPage />} />
          <Route path="update-history" element={<UpdateHistoryPage />} />
        </Route>
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/preference" element={<StaffPreferencePage />} />
          </Routes>
        </Suspense>
      </UnsavedChangesProvider>
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
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <PwaInstallPrompt />
    </QueryClientProvider>
  );
}

export default App;
