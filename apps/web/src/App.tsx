import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { useAuthStore } from './store/auth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { CopilotPage } from './pages/CopilotPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { GroupsPage } from './pages/GroupsPage';
import { PromosPage } from './pages/PromosPage';
import { NewPromoPage } from './pages/NewPromoPage';
import { DispatchesPage } from './pages/DispatchesPage';
import { SettingsPage } from './pages/SettingsPage';
import { CommissionsPage } from './pages/CommissionsPage';
import { LinkRedirectPage } from './pages/LinkRedirectPage';

const swrFetcher = (url: string) => api.get(url);

function ProtectedRoute() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  return (
    <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: false }}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/l/:code" element={<LinkRedirectPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/copiloto" replace />} />
            <Route element={<DashboardLayout />}>
              <Route path="/copiloto" element={<CopilotPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/whatsapp" element={<WhatsAppPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/promos" element={<PromosPage />} />
              <Route path="/promos/new" element={<NewPromoPage />} />
              <Route path="/dispatches" element={<DispatchesPage />} />
              <Route path="/commissions" element={<CommissionsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </SWRConfig>
  );
}
