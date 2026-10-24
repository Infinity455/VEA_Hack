import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase keys. Check that .env exists next to package.json and restart the dev server.'
  )
}

// Created ONE client and reuse it everywhere. Storing it on globalThis stops Vite hot reloads from creating a second one to avoid NavigatorLockAcquireTimeoutError.
export const supabase =
  globalThis.__keylusionSupabase ??
  (globalThis.__keylusionSupabase = createClient(supabaseUrl, supabaseKey))