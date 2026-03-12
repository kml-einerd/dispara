import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  console.log('[AuthCallback] code:', !!code, 'next:', next);

  if (code) {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error('[AuthCallback] Missing environment variables:', { 
        url: !!url, 
        anonKey: !!anonKey 
      });
    }

    const supabase = createServerClient(
      url || '',
      anonKey || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options);
              }
            } catch (err) {
              console.error('[AuthCallback] Error setting cookies:', err);
            }
          },
        },
      },
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      console.log('[AuthCallback] Auth successful, syncing with backend...');
      
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
        const u = session.user;
        
        const syncRes = await fetch(`${API_BASE}/auth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            supabaseUserId: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
            avatarUrl: u.user_metadata?.avatar_url ?? null,
          }),
        });

        if (!syncRes.ok) {
          console.error('[AuthCallback] Backend sync failed:', syncRes.status);
        } else {
          console.log('[AuthCallback] Backend sync successful');
        }
      } catch (syncErr) {
        console.error('[AuthCallback] Backend sync exception:', syncErr);
      }

      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error('[AuthCallback] exchangeCodeForSession error:', error);
    }
  }

  // If no code or error, redirect to login
  console.log('[AuthCallback] Auth failed or no code, redirecting to /login');
  return NextResponse.redirect(`${origin}/login`);
}
