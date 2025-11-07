import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'edupay-auth-token',
    flowType: 'pkce', // More secure PKCE auth flow
  },
  global: {
    headers: {
      'X-Client-Info': 'edupay-connect-web',
    },
  },
});

// Session timeout management (24 hours of inactivity)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
let sessionTimeout: NodeJS.Timeout;

export const resetSessionTimeout = () => {
  if (sessionTimeout) clearTimeout(sessionTimeout);
  
  sessionTimeout = setTimeout(async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth?session=expired';
  }, SESSION_TIMEOUT);
};

// Track user activity to reset session timeout
if (typeof window !== 'undefined') {
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach((event) => {
    document.addEventListener(event, resetSessionTimeout, { passive: true });
  });
}
