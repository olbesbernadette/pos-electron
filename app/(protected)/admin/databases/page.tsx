"use client"


import { Sidebar } from "@/components/sidebar"
import { SidebarProvider } from "@/contexts/sidebar-context"

export default function AdminDatabasesPage() {
  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-73px)]">
        <Sidebar basePath="/admin" />

        <main className="flex-1 p-8">
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-medium tracking-wide">Databases</h1>
            </div>

            <div className="border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm tracking-wider">
                Databases content coming soon
              </p>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
