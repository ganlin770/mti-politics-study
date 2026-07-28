import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const quarkRootUrl =
  import.meta.env.VITE_QUARK_ROOT_URL?.trim() || 'https://pan.quark.cn/list';

export function authRedirectUrl() {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (configured) return configured;
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}
