"use client"

import { ArrowLeft, Storefront, GasPump, Buildings, House, Users, CaretRight } from "@phosphor-icons/react"
import Link from "next/link"

const branches = [
  { name: "Hardware", slug: "hardware", icon: Storefront },
  { name: "Pawa Gas", slug: "pawa-gas", icon: GasPump },
  { name: "Matnog Gas", slug: "matnog-gas", icon: GasPump },
  { name: "Gotis Hotel", slug: "gotis-hotel", icon: Buildings },
  { name: "Rental", slug: "rental", icon: House },
  { name: "Boarders", slug: "boarders", icon: Users },
]

export default function CreditPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-wide">Credit</h1>
        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Dashboard</span>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => {
          const Icon = branch.icon
          return (
            <Link
              key={branch.slug}
              href={`/credit/${branch.slug}`}
              className="group border border-gray-200 p-6 hover:border-black hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 group-hover:bg-white transition-colors">
                    <Icon className="w-6 h-6 text-gray-600 group-hover:text-black" />
                  </div>
                  <div>
                    <h3 className="font-medium tracking-wide">{branch.name}</h3>
                    <p className="text-xs text-gray-400 font-mono tracking-wider mt-1">
                      View credit
                    </p>
                  </div>
                </div>
                <CaretRight className="w-5 h-5 text-gray-300 group-hover:text-black transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
