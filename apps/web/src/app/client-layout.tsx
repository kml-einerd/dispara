'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

const PUBLIC_ROUTES = ['/login', '/auth/callback'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (!loading && !session && !isPublicRoute) {
      console.log('[ClientLayout] No session found, redirecting to /login');
      router.push('/login');
    }
  }, [loading, session, isPublicRoute, router]);

  if (loading && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary,#6366f1)] border-t-transparent" />
      </div>
    );
  }

  if (!session && !isPublicRoute) {
    // Show a minimal placeholder while redirecting to avoid white screen
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]" />
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:pl-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
