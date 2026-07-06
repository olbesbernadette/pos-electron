"use client"

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useParams } from "next/navigation"
import { CustomerInvoiceList } from "@/components/admin/customer-invoice-list"
import { useBranch } from "@/hooks/use-branch"

export default function BranchCreditPage() {
  const params = useParams()
  const branch = params.branch as string
  const { branch: data, isLoading } = useBranch(branch)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm tracking-wider">Loading...</p>
      </div>
    )
  }

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
          href="/credit"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Credit</span>
        </Link>
      </div>
      {branch === "hardware" ? (
        <CustomerInvoiceList />
      ) : (
        <div className="border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm tracking-wider">
            {data.name} credit content coming soon
          </p>
        </div>
      )}
    </>
  )
}
