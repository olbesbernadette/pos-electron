"use client"

import { ArrowLeft, Warehouse, MapPin, Wrench, CaretRight } from "@phosphor-icons/react"
import Link from "next/link"

const bodegaLocations = [
  { name: "Pawa", slug: "pawa", icon: Warehouse },
  { name: "Zone 2", slug: "zone-2", icon: MapPin },
  { name: "Hardware", slug: "hardware", icon: Wrench },
]

export default function BodegaPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-wide">Bodega</h1>
        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Dashboard</span>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bodegaLocations.map((location) => {
          const Icon = location.icon
          return (
            <Link
              key={location.slug}
              href={`/bodega/${location.slug}`}
              className="group border border-gray-200 p-6 hover:border-black hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 group-hover:bg-white transition-colors">
                    <Icon className="w-6 h-6 text-gray-600 group-hover:text-black" />
                  </div>
                  <div>
                    <h3 className="font-medium tracking-wide">{location.name}</h3>
                    <p className="text-xs text-gray-400 font-mono tracking-wider mt-1">
                      Bodega location
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
