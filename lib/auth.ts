import { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'user'

export function getUserRole(user: User | null): UserRole {
  if (!user) return 'user'
  return (user.user_metadata?.role as UserRole) || 'user'
}

export function isAdmin(user: User | null): boolean {
  return getUserRole(user) === 'admin'
}
