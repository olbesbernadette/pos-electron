import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hardcoded for Singapore project - JBJ Trading SG
const SUPABASE_URL = 'https://ujuxuvgtbwnzntmayfxw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdXh1dmd0Ynduem50bWF5Znh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODA1MjEsImV4cCI6MjA4ODM1NjUyMX0._lnEuAY7qcVudo72bLZJbX2aV3inWSAAh_hEh3Ck2Eo'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session cookies but don't do any redirects
  // Auth is handled client-side for better compatibility with v0 preview
  await supabase.auth.getUser()

  return supabaseResponse
}
