import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Hardcoded for Singapore project - JBJ Trading SG
const SUPABASE_URL = 'https://ujuxuvgtbwnzntmayfxw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdXh1dmd0Ynduem50bWF5Znh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODA1MjEsImV4cCI6MjA4ODM1NjUyMX0._lnEuAY7qcVudo72bLZJbX2aV3inWSAAh_hEh3Ck2Eo'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
