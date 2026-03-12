import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('[Supabase] Missing environment variables:', { 
      url: !!url, 
      anonKey: !!anonKey 
    });
  }

  return createBrowserClient(
    url || '',
    anonKey || '',
  );
}
