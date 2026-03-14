import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { useAuthStore } from './store/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
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

import { toast } from './components/ui/use-toast';

const swrFetcher = (url: string) => api.get(url);

const swrOnError = (error: Error) => {
  toast({
    variant: 'destructive',
    title: 'Erro',
    description: error.message || 'Falha ao carregar dados.',
  });
};

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
    <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: false, onError: swrOnError }}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/l/:code" element={<LinkRedirectPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/copiloto" replace />} />
            <Route element={<DashboardLayout />}>
              <Route path="/copiloto" element={<ErrorBoundary><CopilotPage /></ErrorBoundary>} />
              <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/whatsapp" element={<ErrorBoundary><WhatsAppPage /></ErrorBoundary>} />
              <Route path="/groups" element={<ErrorBoundary><GroupsPage /></ErrorBoundary>} />
              <Route path="/promos" element={<ErrorBoundary><PromosPage /></ErrorBoundary>} />
              <Route path="/promos/new" element={<ErrorBoundary><NewPromoPage /></ErrorBoundary>} />
              <Route path="/dispatches" element={<ErrorBoundary><DispatchesPage /></ErrorBoundary>} />
              <Route path="/commissions" element={<ErrorBoundary><CommissionsPage /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
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
