import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';
import { useOnboardingStore } from '../store/onboarding';
import { useAuthStore } from '../store/auth';
import useSWR from 'swr';
import type { WaSession } from '../types';

export function DashboardLayout() {
  const { session } = useAuthStore();
  const navigate = useNavigate();
  const { isOpen, open, isComplete, isSkipped } = useOnboardingStore();
  const { data, isLoading } = useSWR(session ? '/wa/sessions' : null);
  const sessions: WaSession[] = data?.sessions || [];
  const hasConnected = sessions.some((s) => s.status === 'CONNECTED');

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!isLoading && !hasConnected && !isComplete() && !isSkipped() && !isOpen && session) {
      open();
    }
  }, [isLoading, hasConnected, isOpen, session]);

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0 md:pl-64">
        <Outlet />
      </main>
      <OnboardingWizard />
    </div>
  );
}
