import { z } from 'zod';

/**
 * Environment variable validation with fallback defaults
 * Uses values from .env.example as defaults for public keys
 */

// Default values from .env.example (public keys - safe to hardcode)
const DEFAULTS = {
  VITE_SUPABASE_URL: 'https://fmajhzepqpnrzbtcdiix.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtYWpoemVwcXBucnpidGNkaWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTA0NzMsImV4cCI6MjA3NzE2NjQ3M30.ZKgWk7XUse_CRUUgDVwyZNBB-AO-rftkw4NjeKPRPFU',
  MODE: 'development' as const,
};

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  VITE_PAYSTACK_PUBLIC_KEY: z.string().optional(),
  MODE: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

// Validate environment variables on app start
export function validateEnv(): Env {
  try {
    return envSchema.parse({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || DEFAULTS.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULTS.VITE_SUPABASE_ANON_KEY,
      VITE_PAYSTACK_PUBLIC_KEY: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      MODE: import.meta.env.MODE || DEFAULTS.MODE,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => e.path.join('.'))
        .join(', ');
      
      console.error('❌ Environment variable validation failed:', missingVars);
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`
      );
    }
    throw error;
  }
}

// Export validated environment variables
export const env = validateEnv();
