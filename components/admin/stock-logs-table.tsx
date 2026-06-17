"use client"

import { useState, useEffect, useMemo } from "react"
import { Trash, PencilSimple, CaretUp, CaretDown } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"

const WAREHOUSES = [
  { id: 1, name: "Pawa" },
  { id: 2, name: "Zone 2" },
]

const getWarehouseName = (id: number) => WAREHOUSES.find(w => w.id === id)?.name ?? `WH${id}`

const toManila = (dateStr: string) => new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z")
const manilaDate = (dateStr: string) =>
  toManila(dateStr).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
  })

interface RawItem {
  stock_in_item_id?: number
  product_name: string
  code: string
  unit: string
  quantity: number
  cogs: number | null
  total: number | null
}

interface RawLogEntry {
  id: number
  warehouse_id: number
  created_at: string
  delivery_date?: string | null
  reference?: string | null
  supplier_name?: string | null
  customer_name?: string | null
  remarks?: string | null
  items: RawItem[]
}

interface FlatRow {
  rowKey: string
  rowNum: number
  transactionId: number
  warehouse_id: number
  created_at: string
  delivery_date: string | null
  reference: string | null
  supplier_name: string | null
  customer_name: string | null
  remarks: string | null
  stock_in_item_id?: number
  product_name: string
  code: string
  unit: string
  quantity: number
  cogs: number | null
  total: number | null
}

interface StockLogsTableProps {
  type: "IN" | "OUT"
  searchQuery: string
  selectedWarehouseId: number | "all"
}

export function StockLogsTable({ type, searchQuery, selectedWarehouseId }: StockLogsTableProps) {
  const [logs, setLogs] = useState<RawLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingCogsValue, setEditingCogsValue] = useState<number | "">("")
  const [isSaving, setIsSaving] = useState(false)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      if (type === "IN") {
        const { data, error } = await supabase
          .from("stock_in")
          .select("id, warehouse_id, reference, supplier_name, delivery_date, created_at, stock_in_items(id, quantity, cogs, total, items(product_name, code, unit))")
          .order("created_at", { ascending: false })
          .limit(200)

        if (error) { console.error("stock_in query error:", error.message); return }

        setLogs((data || []).map((row: any) => ({
          id: row.id,
          warehouse_id: row.warehouse_id,
          created_at: row.created_at,
          reference: row.reference ?? null,
          supplier_name: row.supplier_name ?? null,
          delivery_date: row.delivery_date ?? null,
          customer_name: null,
          remarks: null,
          items: (row.stock_in_items || []).map((si: any) => ({
            stock_in_item_id: si.id,
            product_name: si.items?.product_name ?? "",
            code: si.items?.code ?? "",
            unit: si.items?.unit ?? "",
            quantity: si.quantity,
            cogs: si.cogs ?? null,
            total: si.total ?? null,
          })),
        })))
      } else {
        const { data, error } = await supabase
          .from("stock_out")
          .select("id, warehouse_id, customer_name, remarks, created_at, stock_out_items(quantity, items(product_name, code, unit))")
          .order("created_at", { ascending: false })
          .limit(200)

        if (error) { console.error("stock_out query error:", error.message); return }

        setLogs((data || []).map((row: any) => ({
          id: row.id,
          warehouse_id: row.warehouse_id,
          created_at: row.created_at,
          reference: null,
          supplier_name: null,
          delivery_date: null,
          customer_name: row.customer_name ?? null,
          remarks: row.remarks ?? null,
          items: (row.stock_out_items || []).map((so: any) => ({
            product_name: so.items?.product_name ?? "",
            code: so.items?.code ?? "",
            unit: so.items?.unit ?? "",
            quantity: so.quantity,
            cogs: null,
            total: null,
          })),
        })))
      }
    } catch (err) {
      console.error("fetchLogs error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [type])

  const flatRows = useMemo<FlatRow[]>(() => {
    const warehouseFiltered = selectedWarehouseId === "all"
      ? logs
      : logs.filter(l => l.warehouse_id === selectedWarehouseId)

    const sorted = [...warehouseFiltered].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortDir === "asc" ? ta - tb : tb - ta
    })

    const q = searchQuery.trim().toLowerCase()

    let n = 0
    return sorted.flatMap(entry =>
      entry.items
        .filter(item => {
          if (!q) return true
          return (
            item.product_name.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q) ||
            (entry.reference ?? "").toLowerCase().includes(q) ||
            (entry.supplier_name ?? "").toLowerCase().includes(q) ||
            (entry.customer_name ?? "").toLowerCase().includes(q) ||
            (entry.remarks ?? "").toLowerCase().includes(q)
          )
        })
        .map(item => {
          n++
          return {
          rowKey: `${entry.id}-${item.stock_in_item_id ?? n}`,
          rowNum: n,
          transactionId: entry.id,
          warehouse_id: entry.warehouse_id,
          created_at: entry.created_at,
          delivery_date: entry.delivery_date ?? null,
          reference: entry.reference ?? null,
          supplier_name: entry.supplier_name ?? null,
          customer_name: entry.customer_name ?? null,
          remarks: entry.remarks ?? null,
          stock_in_item_id: item.stock_in_item_id,
          product_name: item.product_name,
          code: item.code,
          unit: item.unit,
          quantity: item.quantity,
          cogs: item.cogs,
          total: item.total,
        }
      })
    )
  }, [logs, selectedWarehouseId, searchQuery, sortDir])

  const handleDelete = async (transactionId: number) => {
    setDeletingId(transactionId)
    try {
      const supabase = createClient()
      const rpcName = type === "IN" ? "delete_stock_in" : "delete_stock_out"
      const paramName = type === "IN" ? "p_stock_in_id" : "p_stock_out_id"
      const { error } = await supabase.rpc(rpcName, { [paramName]: transactionId })
      if (!error) setLogs(prev => prev.filter(l => l.id !== transactionId))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const handleSaveCogs = async (itemId: number) => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from("stock_in_items")
        .update({ cogs: editingCogsValue === "" ? null : editingCogsValue })
        .eq("id", itemId)
      setEditingItemId(null)
      setEditingCogsValue("")
      fetchLogs()
    } catch (err) {
      console.error("Save error:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const allSelected = flatRows.length > 0 && flatRows.every(r => selectedKeys.has(r.rowKey))

  // ── Stock In layout ────────────────────────────────────────────────────────────
  // [chk][#][code][qty][unit][product][cogs][total][date][reference][supplier][warehouse][actions]
  const inGrid = "grid-cols-[44px_44px_120px_52px_56px_1fr_100px_100px_auto_130px_130px_80px_68px]"

  // ── Stock Out layout ───────────────────────────────────────────────────────────
  // [chk][#][code][qty][unit][product][date][customer][remarks][warehouse][actions]
  const outGrid = "grid-cols-[44px_44px_120px_52px_56px_1fr_auto_130px_130px_80px_68px]"

  const gridCols = type === "IN" ? inGrid : outGrid

  return (
    <div>
      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm font-sans text-gray-400 tracking-wider">Loading...</p>
        </div>
      ) : flatRows.length === 0 ? (
        <div className="py-16 text-center border border-gray-200 rounded-xl">
          <p className="text-sm font-sans text-gray-400 tracking-wider">No records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ minWidth: type === "IN" ? "1340px" : "1180px" }}>

            {/* Header */}
            <div className={`grid ${gridCols} bg-gray-50 border-b border-gray-200`}>
              <div className="flex items-center justify-center py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={checked =>
                    setSelectedKeys(checked ? new Set(flatRows.map(r => r.rowKey)) : new Set())
                  }
                  aria-label="Select all"
                />
              </div>
              <div className="px-3 py-3 text-xs font-sans text-gray-400 tracking-wider">#</div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">Code</div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase text-right">Qty</div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">Unit</div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">Product</div>
              {type === "IN" && (
                <>
                  <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">COGS</div>
                  <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">Total</div>
                </>
              )}
              <button
                onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase flex items-center gap-1 hover:text-black transition-colors whitespace-nowrap"
              >
                Date
                {sortDir === "asc" ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
              </button>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">
                {type === "IN" ? "Reference" : "Customer"}
              </div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">
                {type === "IN" ? "Supplier" : "Remarks"}
              </div>
              <div className="px-3 py-3 text-xs font-sans text-gray-500 tracking-wider uppercase">Warehouse</div>
              <div />
            </div>

            {/* Rows */}
            {flatRows.map(row => {
              const isEditingThis = editingItemId === (row.stock_in_item_id ?? -1)
              const isConfirming = confirmDeleteId === row.transactionId
              const isDeleting = deletingId === row.transactionId

              const liveTotal = isEditingThis && editingCogsValue !== ""
                ? Number(editingCogsValue) * row.quantity
                : row.total

              return (
                <div
                  key={row.rowKey}
                  className={`grid ${gridCols} border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors items-center`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center py-3">
                    <Checkbox
                      checked={selectedKeys.has(row.rowKey)}
                      onCheckedChange={checked => {
                        setSelectedKeys(prev => {
                          const next = new Set(prev)
                          checked ? next.add(row.rowKey) : next.delete(row.rowKey)
                          return next
                        })
                      }}
                      aria-label="Select row"
                    />
                  </div>

                  {/* Row # */}
                  <div className="px-3 py-3">
                    <span className="font-sans text-sm text-gray-400">{row.rowNum}</span>
                  </div>

                  {/* Code */}
                  <div className="px-3 py-3">
                    <span className="inline-block px-2 py-0.5 border border-gray-200 rounded-full text-xs font-sans text-gray-600 whitespace-nowrap">
                      {row.code || "—"}
                    </span>
                  </div>

                  {/* Qty */}
                  <div className="px-3 py-3 text-right">
                    <span className="font-sans text-sm font-bold text-black">{row.quantity}</span>
                  </div>

                  {/* Unit */}
                  <div className="px-3 py-3">
                    <span className="font-sans text-sm text-gray-500">{row.unit}</span>
                  </div>

                  {/* Product name */}
                  <div className="px-3 py-3 min-w-0">
                    <p className="font-sans text-sm text-gray-800 truncate">{row.product_name}</p>
                  </div>

                  {type === "IN" && (
                    <>
                      {/* COGS */}
                      <div className="px-3 py-3 text-right">
                        {isEditingThis ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            value={editingCogsValue}
                            onChange={e =>
                              setEditingCogsValue(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
                            }
                            onFocus={e => e.target.select()}
                            onKeyDown={e => {
                              if (e.key === "Enter" && row.stock_in_item_id != null) handleSaveCogs(row.stock_in_item_id)
                              if (e.key === "Escape") { setEditingItemId(null); setEditingCogsValue("") }
                            }}
                            className="w-24 px-2 py-0.5 border border-black font-sans text-xs text-right focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="font-sans text-sm text-gray-600">
                            {row.cogs != null ? row.cogs.toLocaleString() : "—"}
                          </span>
                        )}
                      </div>

                      {/* Total */}
                      <div className="px-3 py-3 text-right">
                        <span className={`font-sans text-sm font-medium ${liveTotal != null && liveTotal > 0 ? "text-orange-500" : "text-gray-300"}`}>
                          {liveTotal != null && liveTotal > 0 ? liveTotal.toLocaleString() : "—"}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Date */}
                  <div className="px-3 py-3">
                    <p className="font-sans text-xs text-gray-600 whitespace-nowrap">{manilaDate(row.created_at)}</p>
                  </div>

                  {/* Column 1: Reference or Customer */}
                  <div className="px-3 py-3 min-w-0">
                    <p className="font-sans text-xs text-gray-600 truncate">
                      {(type === "IN" ? row.reference : row.customer_name) || <span className="text-gray-300">—</span>}
                    </p>
                  </div>

                  {/* Column 2: Supplier or Remarks */}
                  <div className="px-3 py-3 min-w-0">
                    <p className="font-sans text-xs text-gray-600 truncate">
                      {(type === "IN" ? row.supplier_name : row.remarks) || <span className="text-gray-300">—</span>}
                    </p>
                  </div>

                  {/* Warehouse */}
                  <div className="px-3 py-3">
                    <span className="inline-block px-2 py-0.5 border border-gray-200 rounded-full text-xs font-sans text-gray-600 whitespace-nowrap">
                      {getWarehouseName(row.warehouse_id)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="px-3 py-3 flex items-center justify-end gap-0.5">
                    {isConfirming ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(row.transactionId)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-[10px] font-sans border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 rounded"
                        >
                          {isDeleting ? "..." : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-[10px] font-sans border border-gray-200 hover:border-black transition-colors rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : isEditingThis ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => row.stock_in_item_id != null && handleSaveCogs(row.stock_in_item_id)}
                          disabled={isSaving}
                          className="px-2 py-1 text-[10px] font-sans border border-black text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 rounded"
                        >
                          {isSaving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditingItemId(null); setEditingCogsValue("") }}
                          className="px-2 py-1 text-[10px] font-sans border border-gray-200 hover:border-black transition-colors rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        {type === "IN" && row.stock_in_item_id != null && (
                          <button
                            onClick={() => { setEditingItemId(row.stock_in_item_id!); setEditingCogsValue(row.cogs ?? "") }}
                            className="p-1.5 text-gray-300 hover:text-gray-700 transition-colors"
                            title="Edit COGS"
                          >
                            <PencilSimple className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(row.transactionId)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
