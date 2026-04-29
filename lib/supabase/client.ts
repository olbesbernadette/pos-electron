import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Hardcoded for Singapore project - JBJ Trading SG
const SUPABASE_URL = 'https://ujuxuvgtbwnzntmayfxw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdXh1dmd0Ynduem50bWF5Znh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODA1MjEsImV4cCI6MjA4ODM1NjUyMX0._lnEuAY7qcVudo72bLZJbX2aV3inWSAAh_hEh3Ck2Eo'

// Singleton pattern to ensure session persistence
let supabaseClient: SupabaseClient | null = null

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storageKey: 'jbj-trading-auth',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  }
  return supabaseClient
}
