import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fmajhzepqpnrzbtcdiix.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtYWpoemVwcXBucnpidGNkaWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTA0NzMsImV4cCI6MjA3NzE2NjQ3M30.ZKgWk7XUse_CRUUgDVwyZNBB-AO-rftkw4NjeKPRPFU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
