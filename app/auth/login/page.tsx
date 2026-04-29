'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { GoogleCardboardLogo } from '@phosphor-icons/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      window.location.href = '/'
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-center gap-2">
            <GoogleCardboardLogo className="h-8 w-8 text-black" weight="bold" />
            <span className="text-lg font-bold tracking-widest uppercase">JBJ TRADING</span>
          </div>
          
          <div className="border border-gray-200 p-8">
            <div className="mb-6">
              <h1 className="text-xl font-medium tracking-wide mb-1">Login</h1>
              <p className="text-xs text-gray-500 font-mono tracking-wider">
                Enter your email below to login to your account
              </p>
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-xs font-medium tracking-widest uppercase">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-gray-200 focus:border-black focus:ring-0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-xs font-medium tracking-widest uppercase">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-gray-200 focus:border-black focus:ring-0"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button 
                  type="submit" 
                  className="w-full bg-black text-white hover:bg-gray-800 text-xs font-medium tracking-widest uppercase" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </div>
              <div className="mt-6 text-center text-xs text-gray-500 font-mono tracking-wider">
                Don&apos;t have an account?{' '}
                <Link
                  href="/auth/sign-up"
                  className="text-black underline underline-offset-4 hover:text-gray-600"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
