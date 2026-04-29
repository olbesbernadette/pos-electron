"use client"

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ExpensesForm } from "@/components/expenses/expenses-form"

const branchData: Record<string, { id: number; name: string }> = {
  "hardware": { id: 1, name: "Hardware" },
  "pawa-gas": { id: 2, name: "Pawa Gas" },
  "matnog-gas": { id: 3, name: "Matnog Gas" },
  "gotis-hotel": { id: 4, name: "Gotis Hotel" },
  "rental": { id: 5, name: "Rental" },
  "boarders": { id: 6, name: "Boarders" },
}

export default function BranchExpensesPage() {
  const params = useParams()
  const branch = params.branch as string
  const data = branchData[branch]

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm tracking-wider">Branch not found</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-wide">{data.name}</h1>
        <Link
          href="/expenses"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Expenses</span>
        </Link>
      </div>
      <ExpensesForm branchName={data.name} branchId={data.id} />
    </>
  )
}
