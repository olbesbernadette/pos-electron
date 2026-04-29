"use client"

import Link from 'next/link'
import { GoogleCardboardLogo } from '@phosphor-icons/react'

export default function SignUpSuccessPage() {
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
              <h1 className="text-xl font-medium tracking-wide mb-1">Thank you for signing up!</h1>
              <p className="text-xs text-gray-500 font-mono tracking-wider">
                Check your email to confirm
              </p>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              You&apos;ve successfully signed up. Please check your email to
              confirm your account before signing in.
            </p>
            
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
