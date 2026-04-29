"use client"

import { 
  ArrowLeft, 
  ShieldWarning, 
  CalendarBlank, 
  CurrencyDollar, 
  Receipt, 
  Wallet, 
  Check, 
  UsersThree, 
  House, 
  Bed, 
  Database,
  CaretRight
} from "@phosphor-icons/react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"

const adminMenuItems = [
  { name: "Daily", slug: "daily", icon: CalendarBlank, description: "Daily summaries" },
  { name: "Sales", slug: "sales", icon: CurrencyDollar, description: "Sales reports" },
  { name: "Expenses", slug: "expenses", icon: Receipt, description: "Expense tracking" },
  { name: "Deposits", slug: "deposits", icon: Wallet, description: "Deposit records" },
  { name: "Checks", slug: "checks", icon: Check, description: "Check management" },
  { name: "Customers", slug: "customers", icon: UsersThree, description: "Customer data" },
  { name: "Rentals", slug: "rentals", icon: House, description: "Rental management" },
  { name: "Boarders", slug: "boarders", icon: Bed, description: "Boarder records" },
  { name: "Databases", slug: "databases", icon: Database, description: "Database tools" },
]

export default function AdminPage() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="text-center">
          <ShieldWarning className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-medium tracking-wide mb-2">Access Denied</h1>
          <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">
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
          <h1 className="text-2xl font-medium tracking-wide">Admin</h1>
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Dashboard</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.slug}
                href={`/admin/${item.slug}`}
                className="group border border-gray-200 p-6 hover:border-black hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 group-hover:bg-white transition-colors">
                      <Icon className="w-6 h-6 text-gray-600 group-hover:text-black" />
                    </div>
                    <div>
                      <h3 className="font-medium tracking-wide">{item.name}</h3>
                      <p className="text-xs text-gray-400 font-mono tracking-wider mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <CaretRight className="w-5 h-5 text-gray-300 group-hover:text-black transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
