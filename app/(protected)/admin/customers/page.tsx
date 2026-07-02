"use client"

import { ArrowLeft, ShieldWarning } from "@phosphor-icons/react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CustomerCreditSummary } from "@/components/admin/customer-credit-summary"
import { CustomerInvoiceList } from "@/components/admin/customer-invoice-list"

export default function AdminCustomersPage() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="text-center">
          <ShieldWarning className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-medium tracking-wide mb-2">Access Denied</h1>
          <p className="text-xs text-gray-500 font-sans tracking-wider mb-6">
            You do not have permission to access this page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Dashboard</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <Sidebar basePath="/admin" />
      <section className="flex-1 px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-medium tracking-wide">Customers</h1>
          <Link
            href="/admin"
            className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Admin</span>
          </Link>
        </div>

        <Tabs defaultValue="summary">
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="invoices">Invoice List</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <CustomerCreditSummary />
          </TabsContent>
          <TabsContent value="invoices">
            <CustomerInvoiceList />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
