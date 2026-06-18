"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Trash } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"

interface BodegaItem {
  id: string
  itemId: number
  code: string
  name: string
  unit: string
  qty: number
  availableQty: number
}

interface InventoryItem {
  id: number
  code: string
  name: string
  unit: string
  availableQty: number
}

interface BodegaFormProps {
  warehouseId: number
}

export function BodegaForm({ warehouseId }: BodegaFormProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<BodegaItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printData, setPrintData] = useState<{
    customerName: string
    invoiceNotes: string
    items: BodegaItem[]
    submittedAt: Date
  } | null>(null)
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchResults = searchQuery.trim()
    ? allItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allItems

  const loadItems = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("items")
        .select("id, code, product_name, unit, item_stock!inner(quantity)")
        .eq("item_stock.warehouse_id", warehouseId)
        .gt("item_stock.quantity", 0)
        .is("deleted_at", null)
        .order("item_no", { ascending: true })

      if (error) {
        console.error("Load items error:", error.message)
      } else {
        setAllItems(
          (data || []).map((item: any) => ({
            id: item.id,
            code: item.code,
            name: item.product_name,
            unit: item.unit,
            availableQty: item.item_stock[0]?.quantity ?? 0,
          }))
        )
      }
    } catch (err) {
      console.error("Load items error:", err)
    }
  }, [warehouseId])

  useEffect(() => {
    loadItems()

    const supabase = createClient()
    const channel = supabase
      .channel(`item_stock_out_${warehouseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_stock", filter: `warehouse_id=eq.${warehouseId}` },
        () => loadItems()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadItems, warehouseId])

  const selectSearchItem = (item: InventoryItem) => {
    const alreadyAdded = selectedItems.some(i => i.itemId === item.id)
    if (alreadyAdded) return
    setSelectedItems(prev => [
      ...prev,
      {
        id: `select-${item.id}-${Date.now()}`,
        itemId: item.id,
        code: item.code,
        name: item.name,
        unit: item.unit,
        qty: 1,
        availableQty: item.availableQty,
      },
    ])
    setSearchQuery("")
    setHighlightedIndex(-1)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      selectSearchItem(searchResults[highlightedIndex])
    } else if (e.key === "Escape") {
      setHighlightedIndex(-1)
    }
  }

  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id))
  }

  const updateQty = (id: string, qty: number) => {
    setSelectedItems(prev =>
      prev.map(i => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
    )
  }

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault()
      if (currentIndex < selectedItems.length - 1) {
        const nextId = selectedItems[currentIndex + 1].id
        setTimeout(() => {
          const el = document.querySelector(`input[data-item-id="${nextId}"]`) as HTMLInputElement
          el?.focus()
        }, 0)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (currentIndex > 0) {
        const prevId = selectedItems[currentIndex - 1].id
        const el = document.querySelector(`input[data-item-id="${prevId}"]`) as HTMLInputElement
        el?.focus()
      }
    }
  }

  const handleSubmit = async () => {
    if (selectedItems.some(item => item.qty <= 0)) {
      setSubmitError("All items must have a quantity greater than 0")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const supabase = createClient()

      const { error } = await supabase.rpc("process_stock_out", {
        p_warehouse_id: warehouseId,
        p_customer_name: customerName || null,
        p_remarks: invoiceNotes || null,
        p_items: selectedItems.map(item => ({
          item_id: item.itemId,
          quantity: item.qty,
        })),
        p_idempotency_key: idempotencyKey,
      })

      if (error) {
        setSubmitError("Submission failed: " + error.message)
        return
      }

      setPrintData({ customerName, invoiceNotes, items: selectedItems, submittedAt: new Date() })
      setSelectedItems([])
      setCustomerName("")
      setInvoiceNotes("")
      setIdempotencyKey(crypto.randomUUID())
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
      loadItems()
      setShowPrintDialog(true)
    } catch {
      setSubmitError("Unexpected error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const warehouseName = warehouseId === 1 ? "Pawa" : "Zone 2"

  const printReceipt = async () => {
    if (!printData) return
    const { customerName, invoiceNotes, items, submittedAt } = printData
    const date = submittedAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })
    const time = submittedAt.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true })
    const divider = "-----------------------------------------------"

    try {
      const isElectron = (window as any).electronAPI?.isElectron

      if (isElectron) {
        const lines: { text: string; align: "left" | "center" | "right"; bold?: boolean }[] = [
          { text: "BODEGA OUT", align: "center", bold: true },
          { text: warehouseName, align: "center", bold: false },
          { text: divider, align: "center" },
          { text: `Date: ${date}`, align: "left" },
          { text: `Time: ${time}`, align: "left" },
          ...(customerName ? [{ text: `Customer: ${customerName}`, align: "left" as const }] : []),
          ...(invoiceNotes ? [{ text: `Ref: ${invoiceNotes}`, align: "left" as const }] : []),
          { text: divider, align: "center" },
          { text: "ITEMS", align: "left", bold: true },
          ...items.map(item => ({
            text: `${item.name.substring(0, 28).padEnd(28)} ${item.qty} ${item.unit}`,
            align: "left" as const,
          })),
          { text: divider, align: "center" },
          { text: `Total items: ${items.length}`, align: "left" },
          { text: divider, align: "center" },
          { text: "-- end of bodega out --", align: "center" },
          { text: "", align: "left" },
          { text: "", align: "left" },
          { text: "", align: "left" },
          { text: "", align: "left" },
          { text: "Approved by: ___________________", align: "left" },
        ]

        const result = await (window as any).electronAPI.printReceipt({ lines })
        if (!result.success) {
          console.error("[bodega] Electron print failed:", result.error)
        }
      } else {
        console.log("[bodega] Not in Electron environment, print skipped")
      }
    } catch (err) {
      console.error("[bodega] Print error:", err)
    }

    setShowPrintDialog(false)
  }

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Search Items */}
        <div className="border border-gray-200 p-6">
          <h3 className="text-lg font-medium tracking-wide mb-4">Bodega Out</h3>
          <p className="text-xs text-gray-500 font-mono tracking-wider uppercase mb-4">Add items</p>

          <div className="relative mb-4">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search items..."
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setHighlightedIndex(-1)
                  searchInputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Inline Results List */}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {searchQuery && searchResults.length === 0 ? (
              <p className="text-xs text-gray-400 font-mono tracking-wider text-center py-6">
                No items found
              </p>
            ) : (
              searchResults.map((item, index) => {
                const alreadyAdded = selectedItems.some(i => i.itemId === item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => !alreadyAdded && selectSearchItem(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-3 border text-left font-sans text-sm transition-colors ${
                      alreadyAdded
                        ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                        : highlightedIndex === index
                        ? "border-black bg-gray-100 text-gray-900"
                        : "border-gray-200 hover:bg-gray-100 hover:border-black text-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="px-1 py-0.5 border border-gray-200 text-[10px] rounded-full whitespace-nowrap flex-shrink-0 text-gray-500">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 flex-shrink-0">
                        <span className="font-medium text-sm text-gray-700">{item.availableQty}</span>
                        <span className="text-xs text-gray-500">{item.unit}</span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="border border-gray-200 p-6">
          {submitSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200">
              <p className="text-sm text-green-700 font-mono tracking-wide">
                Bodega Out submitted successfully
              </p>
            </div>
          )}

          {submitError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 font-mono tracking-wide">
                {submitError}
              </p>
            </div>
          )}

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

          {/* Desktop Table */}
          <div className="hidden md:block border border-gray-200">
            <div className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Code</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Product</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Unit</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Qty</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Action</span>
            </div>

            {selectedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider">
                No items selected
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-3 px-4 py-3 border-b border-gray-100 items-center last:border-b-0"
                >
                  <span className="px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600 whitespace-nowrap text-center">
                    {item.code || "-"}
                  </span>
                  <span className="font-mono text-sm text-gray-600 truncate">{item.name}</span>
                  <span className="font-mono text-sm text-gray-600">{item.unit || "pc"}</span>
                  <input
                    data-item-id={item.id}
                    ref={(el) => { if (el) qtyInputRefs.current[item.id] = el }}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => handleQtyKeyDown(e, index)}
                    onWheel={(e) => e.currentTarget.blur()}
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {selectedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider border border-gray-200">
                No items selected
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-mono text-sm text-gray-600 flex-1">{item.name}</p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border-t border-gray-200" />
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600">
                      {item.code || "-"}
                    </span>
                    <span className="inline-block px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600">
                      {item.unit || "pc"}
                    </span>
                  </div>
                  <div className="border-t border-gray-200" />
                  <div>
                    <p className="font-mono text-xs text-gray-500 tracking-wider uppercase mb-1">Quantity</p>
                    <input
                      data-item-id={item.id}
                      ref={(el) => { if (el) qtyInputRefs.current[item.id] = el }}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleQtyKeyDown(e, index)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-2 py-2 border border-gray-200 font-mono text-sm text-center focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedItems.length === 0 || isSubmitting}
            className="w-full mt-6 px-4 py-3 bg-black text-white font-mono text-sm tracking-widest uppercase disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Print Dialog */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-gray-200 p-8 w-80 shadow-lg">
            <h2 className="text-base font-medium tracking-wide mb-1">Print Receipt?</h2>
            <p className="text-xs text-gray-500 font-mono mb-6">
              Transaction recorded for {warehouseName}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={printReceipt}
                className="flex-1 px-4 py-2.5 bg-black text-white text-xs font-mono tracking-widest uppercase hover:bg-gray-900 transition-colors"
              >
                Yes, Print
              </button>
              <button
                onClick={() => setShowPrintDialog(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-xs font-mono tracking-widest uppercase hover:border-black transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
