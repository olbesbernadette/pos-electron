"use client"

import { ArrowLeft } from "@phosphor-icons/react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"

export default function CustomersPage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <Sidebar />
      <section className="flex-1 px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-medium tracking-wide">Customers</h1>
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Dashboard</span>
          </Link>
        </div>
        <div className="border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm tracking-wider">Customers content coming soon</p>
        </div>
      </section>
    </div>
  )
}
