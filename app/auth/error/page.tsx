"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GoogleCardboardLogo } from '@phosphor-icons/react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

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
              <h1 className="text-xl font-medium tracking-wide mb-1">Sorry, something went wrong.</h1>
            </div>
            
            {error ? (
              <p className="text-sm text-gray-600 mb-6">
                Code error: {error}
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-6">
                An unspecified error occurred.
              </p>
            )}
            
            <Link
              href="/auth/login"
              className="block w-full text-center bg-black text-white hover:bg-gray-800 text-xs font-medium tracking-widest uppercase py-2 px-4 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
