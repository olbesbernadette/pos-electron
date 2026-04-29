"use client"

import { useState, useRef } from "react"
import { X, MagnifyingGlass, Trash } from "@phosphor-icons/react"

interface BodegaItem {
  id: string
  code?: string
  name: string
  unit?: string
  qty: number
}

type BodegaAction = "out" | "in" | "logs"

interface InventoryItem {
  id: string
  code: string
  name: string
  unit: string
  qty: number
}

const mockItems: InventoryItem[] = [
  { id: "1", code: "ab1/4x11/2o", name: "Angle Bar 1/4 x 1 1/2 4mm O", unit: "pc", qty: 56 },
  { id: "2", code: "ab1/4x2o", name: "Angle Bar 1/4 x 2 4mm O", unit: "pc", qty: 80 },
  { id: "3", code: "ab1/4x3br", name: "Angle Bar 1/4 x 3 6mm BR", unit: "pc", qty: 10 },
  { id: "4", code: "ab1/4x21/2w", name: "Angle Bar 1/4 x 2 1/2 5mm W", unit: "pc", qty: 44 },
  { id: "5", code: "ab1/4x11/2w", name: "Angle Bar 1/4 x 1 1/2 5mm W", unit: "pc", qty: 50 },
  { id: "6", code: "fb3/16x1", name: "Flat Bar 3/16 x 1 3mm W", unit: "pc", qty: 60 },
  { id: "7", code: "fb3/16x1/2o", name: "Flat Bar 3/16 x 1/2 2.5mm O", unit: "pc", qty: 25 },
  { id: "8", code: "rb10", name: "Round Bar 10mm Pink", unit: "pc", qty: 50 },
  { id: "9", code: "cb2x3", name: "Channel Bar LD 3 Y", unit: "pc", qty: 15 },
  { id: "10", code: "sm4.5", name: "GI Steel Matting (4.0) #6", unit: "pc", qty: 50 },
  { id: "11", code: "2b", name: "CWN 2 x 25kg", unit: "box", qty: 15 },
  { id: "12", code: "3b", name: "CWN 3 x 25kg", unit: "box", qty: 20 },
  { id: "13", code: "unb", name: "Umbrella Nail x 25kg", unit: "box", qty: 15 },
  { id: "14", code: "gis12g", name: "GI Sht Green 12' x 0.4", unit: "pc", qty: 30 },
  { id: "15", code: "gif.4", name: "GI Plain RED 0.25", unit: "pc", qty: 85 },
  { id: "16", code: "gisf.4", name: "GI Plain GREEN 0.25", unit: "pc", qty: 100 },
  { id: "17", code: "bp2m", name: "Moldex Blue Pipe 2\"", unit: "pc", qty: 30 },
  { id: "18", code: "bbgdbig", name: "Golden Dragon Bowl White Big", unit: "pc", qty: 20 },
  { id: "19", code: "bbgd", name: "GD/Uleya Bowl White Medium", unit: "pc", qty: 55 },
  { id: "20", code: "gis8mg", name: "GI Sheet MAGNUM GREEN 8ft", unit: "pc", qty: 100 },
  { id: "21", code: "hg.9", name: "Heavy Gauge 20 Fuji 0.9mm", unit: "pc", qty: 20 },
  { id: "22", code: "pvce3e", name: "Emerald PVC Elbow 3\" 90 deg", unit: "pc", qty: 100 },
  { id: "23", code: "cp2x1.4", name: "C-Purlins 2x3 - 1.5 (G.I) Y/G", unit: "pc", qty: 50 },
  { id: "24", code: "cs500g", name: "CS-Latex Flat White Gal", unit: "gal", qty: 20 },
  { id: "25", code: "cs525l", name: "CS-Latex Gloss White Ltr", unit: "ltr", qty: 60 },
  { id: "26", code: "dv515p", name: "Megacryl Semi-Gloss White pail", unit: "pail", qty: 5 },
  { id: "27", code: "dv4676l", name: "DV - Gloss QDE Orange Ltr", unit: "ltr", qty: 24 },
  { id: "28", code: "T-LGb", name: "Lacquer Thinner Gal x 6/1", unit: "box", qty: 10 },
  { id: "29", code: "3/4z", name: "Mar Plywood 16mm RM", unit: "pc", qty: 70 },
]

interface BodegaFormProps {
  branchName: string
}

export function BodegaForm({ branchName }: BodegaFormProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<BodegaItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // Filter items based on search query
  const searchResults = mockItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Add item to selected items
  const addItem = (item: typeof mockItems[0]) => {
    const existingItem = selectedItems.find(i => i.id === item.id)
    if (existingItem) {
      setSelectedItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      )
    } else {
      setSelectedItems(prev => [...prev, { id: item.id, code: item.code, name: item.name, unit: item.unit, qty: 1 }])
    }
  }

  // Remove item from selected items
  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id))
  }

  // Update item quantity
  const updateQty = (id: string, qty: number) => {
    setSelectedItems(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i)
    )
  }

  // Handle keyboard navigation in qty inputs
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      // Move to next item's qty field
      if (currentIndex < selectedItems.length - 1) {
        const nextId = selectedItems[currentIndex + 1].id
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-item-id="${nextId}"]`) as HTMLInputElement
          nextInput?.focus()
        }, 0)
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      // Move to next item
      if (currentIndex < selectedItems.length - 1) {
        const nextId = selectedItems[currentIndex + 1].id
        const nextInput = document.querySelector(`input[data-item-id="${nextId}"]`) as HTMLInputElement
        nextInput?.focus()
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      // Move to previous item
      if (currentIndex > 0) {
        const prevId = selectedItems[currentIndex - 1].id
        const prevInput = document.querySelector(`input[data-item-id="${prevId}"]`) as HTMLInputElement
        prevInput?.focus()
      }
    }
  }

  return (
    <div className="px-6 pb-6">
      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Add Items */}
        <div className="border border-gray-200 p-6">
          <h3 className="text-lg font-medium tracking-wide mb-4">Bodega Out</h3>

          {/* Add Items Label */}
          <p className="text-xs text-gray-500 font-mono tracking-wider uppercase mb-4">Add items</p>

          {/* Search Box */}
          <div className="relative mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-xs text-gray-400 font-mono tracking-wider text-center py-6">
                No items found
              </p>
            ) : (
              searchResults.map(item => {
                const isSelected = selectedItems.some(i => i.id === item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isSelected}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      addItem(item)
                    }}
                    className={`w-full px-4 py-3 border font-sans text-sm transition-colors ${
                      isSelected
                        ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                        : "border-gray-200 text-left hover:bg-gray-50 hover:border-black"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="flex flex-col gap-1 md:gap-2 flex-1">
                        <div className="flex md:flex-row flex-col items-start md:items-center gap-1 md:gap-2">
                          <span className="font-medium text-xs md:text-sm">{item.name}</span>
                          <span className="px-1 py-0.5 bg-white border border-gray-200 text-[9px] md:text-[10px] font-mono rounded-full text-gray-600 whitespace-nowrap">
                            {item.code}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center items-end gap-1">
                        <span className="font-medium text-xs md:text-sm">{item.qty}</span>
                        <span className="text-[11px] md:text-xs text-gray-600 leading-none">{item.unit}</span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel - Item Details */}
        <div className="border border-gray-200 p-6">
          {/* Customer Name */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Invoice Number or Notes */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Invoice Number or Notes
            </label>
            <input
              type="text"
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Enter invoice number or notes"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Items Table / Cards */}
          <div className="hidden md:block border border-gray-200">
            {/* Desktop Table Header */}
            <div className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Code</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Product</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Unit</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Qty</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Action</span>
            </div>

            {/* Desktop Table Body */}
            {selectedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider">
                No items selected
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-3 px-4 py-3 border-b border-gray-100 items-center last:border-b-0">
                  <span className="px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600 whitespace-nowrap text-center">{item.code || "-"}</span>
                  <span className="font-mono text-sm text-gray-600 truncate">{item.name}</span>
                  <span className="font-mono text-sm text-gray-600">{item.unit || "pc"}</span>
                  <input
                    data-item-id={item.id}
                    ref={(el) => {
                      if (el) qtyInputRefs.current[item.id] = el
                    }}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => handleQtyKeyDown(e, index)}
                    className="w-full px-2 py-1 border border-gray-200 font-mono text-sm text-center focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {selectedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider border border-gray-200">
                No items selected
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-mono text-sm text-gray-600">{item.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-200"></div>
                  
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600">{item.code || "-"}</span>
                    <span className="inline-block px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600">{item.unit || "pc"}</span>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  <div>
                    <p className="font-mono text-xs text-gray-500 tracking-wider uppercase mb-1">Quantity</p>
                    <input
                      data-item-id={item.id}
                      ref={(el) => {
                        if (el) qtyInputRefs.current[item.id] = el
                      }}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleQtyKeyDown(e, index)}
                      className="w-full px-2 py-2 border border-gray-200 font-mono text-sm text-center focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => console.log("[v0] Form data:", { customerName, invoiceNotes, items: selectedItems })}
            disabled={selectedItems.length === 0}
            className="w-full mt-6 px-4 py-3 bg-black text-white font-mono text-sm tracking-widest uppercase disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
