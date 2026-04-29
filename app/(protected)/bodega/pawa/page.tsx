"use client"

import { ArrowLeft, Warehouse } from "@phosphor-icons/react"
import Link from "next/link"
import { useState } from "react"
import { BodegaForm } from "@/components/bodega/bodega-form"
import { BodegaInForm } from "@/components/bodega/bodega-in-form"

type BodegaAction = "out" | "in" | "logs"

export default function BodegaPawaPage() {
  const [selectedAction, setSelectedAction] = useState<BodegaAction>("out")

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Warehouse className="w-6 h-6 text-gray-400" />
          <h1 className="text-2xl font-medium tracking-wide">Pawa</h1>
        </div>
        <Link
          href="/bodega"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Bodega</span>
        </Link>
      </div>

      {/* Main Content Container with Border */}
      <div className="border border-gray-200">
        {/* Action Buttons - Inside Border */}
        <div className="grid grid-cols-3 gap-4 p-6">
          <button
            onClick={() => setSelectedAction("out")}
            className={`px-2 sm:px-4 md:px-6 py-4 font-mono text-xs sm:text-sm tracking-widest transition-colors text-center ${
              selectedAction === "out"
                ? "bg-black text-white"
                : "bg-white text-black border border-gray-200 hover:bg-gray-50"
            }`}
          >
            BODEGA OUT
          </button>
          <button
            onClick={() => setSelectedAction("in")}
            className={`px-2 sm:px-4 md:px-6 py-4 font-mono text-xs sm:text-sm tracking-widest transition-colors text-center ${
              selectedAction === "in"
                ? "bg-black text-white"
                : "bg-white text-black border border-gray-200 hover:bg-gray-50"
            }`}
          >
            BODEGA IN
          </button>
          <button
            onClick={() => setSelectedAction("logs")}
            className={`px-2 sm:px-4 md:px-6 py-4 font-mono text-xs sm:text-sm tracking-widest transition-colors text-center ${
              selectedAction === "logs"
                ? "bg-black text-white"
                : "bg-white text-black border border-gray-200 hover:bg-gray-50"
            }`}
          >
            VIEW LOGS
          </button>
        </div>

        {/* Content Area */}
        <div>
          {selectedAction === "out" && <BodegaForm branchName="Pawa" />}
          
          {selectedAction === "in" && <BodegaInForm branchName="Pawa" />}
          
          {selectedAction === "logs" && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm font-mono tracking-wider">View Logs content coming soon</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
