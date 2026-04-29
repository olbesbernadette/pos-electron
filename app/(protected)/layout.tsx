"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { GoogleCardboardLogo } from "@phosphor-icons/react"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { SidebarProvider } from "@/contexts/sidebar-context"
import { ShiftProvider } from "@/contexts/shift-context"
import { AppLayout } from "@/components/app-layout"

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <GoogleCardboardLogo className="h-12 w-12 text-black mx-auto mb-4 animate-pulse" weight="bold" />
          <p className="text-xs text-gray-500 font-mono tracking-wider">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <ShiftProvider>
      <SidebarProvider>
        <AppLayout>{children}</AppLayout>
      </SidebarProvider>
    </ShiftProvider>
  )
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedContent>{children}</ProtectedContent>
    </AuthProvider>
  )
}
