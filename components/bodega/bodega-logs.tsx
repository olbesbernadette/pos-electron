"use client"

import { useState, useEffect } from "react"
import { Trash, PencilSimple } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
const toManila = (dateStr: string) => new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z")
const manilaDate = (dateStr: string) =>
  toManila(dateStr).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })
const manilaTime = (dateStr: string) =>
  toManila(dateStr).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true })

interface LogItem {
  stock_in_item_id?: number
  product_name: string
  code: string
  unit: string
  quantity: number
  cogs?: number | null
  total?: number | null
}

interface LogEntry {
  id: number
  type: "IN" | "OUT"
  created_at: string
  reference: string | null
  supplier_name: string | null
  delivery_date: string | null
  customer_name: string | null
  remarks: string | null
  items: LogItem[]
  overall_total?: number | null
}

interface BodegaLogsProps {
  warehouseId: number
}

type FilterType = "ALL" | "IN" | "OUT"

export function BodegaLogs({ warehouseId }: BodegaLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("ALL")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedCogs, setEditedCogs] = useState<Record<number, number | "">>({})
  const [isSaving, setIsSaving] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      const [stockInRes, stockOutRes] = await Promise.all([
        supabase
          .from("stock_in")
          .select("id, reference, supplier_name, delivery_date, created_at, stock_in_items(id, quantity, cogs, total, items(product_name, code, unit))")
          .eq("warehouse_id", warehouseId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("stock_out")
          .select("id, customer_name, remarks, created_at, stock_out_items(quantity, items(product_name, code, unit))")
          .eq("warehouse_id", warehouseId)
          .order("created_at", { ascending: false })
          .limit(100),
      ])

      if (stockInRes.error) console.error("stock_in query error:", stockInRes.error.message)
      if (stockOutRes.error) console.error("stock_out query error:", stockOutRes.error.message)

      const inLogs: LogEntry[] = (stockInRes.data || []).map((row: any) => {
        const items: LogItem[] = (row.stock_in_items || []).map((si: any) => ({
          stock_in_item_id: si.id,
          product_name: si.items?.product_name ?? "",
          code: si.items?.code ?? "",
          unit: si.items?.unit ?? "",
          quantity: si.quantity,
          cogs: si.cogs ?? null,
          total: si.total ?? null,
        }))
        const overall_total = items.reduce((sum, i) => sum + (i.total ?? 0), 0)
        return {
          id: row.id,
          type: "IN",
          created_at: row.created_at,
          reference: row.reference,
          supplier_name: row.supplier_name,
          delivery_date: row.delivery_date,
          customer_name: null,
          remarks: null,
          items,
          overall_total,
        }
      })

      const outLogs: LogEntry[] = (stockOutRes.data || []).map((row: any) => ({
        id: row.id,
        type: "OUT",
        created_at: row.created_at,
        reference: null,
        supplier_name: null,
        delivery_date: null,
        customer_name: row.customer_name,
        remarks: row.remarks,
        items: (row.stock_out_items || []).map((so: any) => ({
          product_name: so.items?.product_name ?? "",
          code: so.items?.code ?? "",
          unit: so.items?.unit ?? "",
          quantity: so.quantity,
        })),
      }))

      const combined = [...inLogs, ...outLogs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setLogs(combined)
    } catch (err) {
      console.error("fetchLogs error:", err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()

    const supabase = createClient()
    const channel = supabase
      .channel(`bodega_logs_${warehouseId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_in", filter: `warehouse_id=eq.${warehouseId}` }, () => fetchLogs())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_out", filter: `warehouse_id=eq.${warehouseId}` }, () => fetchLogs())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [warehouseId])

  const handleDelete = async (entry: LogEntry) => {
    const key = `${entry.type}-${entry.id}`
    setDeletingId(key)

    try {
      const supabase = createClient()
      const rpcName = entry.type === "IN" ? "delete_stock_in" : "delete_stock_out"
      const paramName = entry.type === "IN" ? "p_stock_in_id" : "p_stock_out_id"

      const { error } = await supabase.rpc(rpcName, { [paramName]: entry.id })

      if (!error) {
        setLogs(prev => prev.filter(l => !(l.type === entry.type && l.id === entry.id)))
      }
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const startEdit = (entry: LogEntry) => {
    const key = `${entry.type}-${entry.id}`
    const initial: Record<number, number | ""> = {}
    entry.items.forEach(item => {
      if (item.stock_in_item_id != null) {
        initial[item.stock_in_item_id] = item.cogs ?? ""
      }
    })
    setEditedCogs(initial)
    setEditingId(key)
  }

  const handleSave = async (entry: LogEntry) => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      await Promise.all(
        entry.items
          .filter(item => item.stock_in_item_id != null)
          .map(item =>
            supabase
              .from("stock_in_items")
              .update({ cogs: editedCogs[item.stock_in_item_id!] === "" ? null : editedCogs[item.stock_in_item_id!] })
              .eq("id", item.stock_in_item_id!)
          )
      )
      setEditingId(null)
      setEditedCogs({})
      fetchLogs()
    } catch (err) {
      console.error("Save error:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const [searchQuery, setSearchQuery] = useState("")

  const filteredLogs = logs
    .filter(l => filter === "ALL" || l.type === filter)
    .filter(l => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        String(l.id).includes(q) ||
        (l.reference ?? "").toLowerCase().includes(q) ||
        (l.supplier_name ?? "").toLowerCase().includes(q) ||
        (l.customer_name ?? "").toLowerCase().includes(q) ||
        (l.remarks ?? "").toLowerCase().includes(q) ||
        l.items.some(item => item.product_name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q))
      )
    })

  return (
    <div className="px-6 pb-6">
      {/* Filter Tabs + Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-2">
          {(["ALL", "IN", "OUT"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-mono tracking-widest border transition-colors ${
                filter === f
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-black"
              }`}
            >
              {f === "ALL" ? "ALL" : f === "IN" ? "STOCK IN" : "STOCK OUT"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by reference, supplier, customer, product..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm font-mono text-gray-400 tracking-wider">Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center border border-gray-200">
          <p className="text-sm font-mono text-gray-400 tracking-wider">No logs found</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[44px_100px_160px_220px_1fr_160px_140px_100px] bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center py-3">
              <Checkbox
                checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(`${l.type}-${l.id}`))}
                onCheckedChange={checked => {
                  setSelectedIds(checked
                    ? new Set(filteredLogs.map(l => `${l.type}-${l.id}`))
                    : new Set()
                  )
                }}
                aria-label="Select all"
              />
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              ID
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Delivery Date
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Details
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Breakdown
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Total
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Added at
            </div>
            <div className="pl-4 pr-6 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">
              Actions
            </div>
          </div>

          {/* Table Rows */}
          {filteredLogs.map(entry => {
            const key = `${entry.type}-${entry.id}`
            const isConfirming = confirmDeleteId === key
            const isDeleting = deletingId === key
            const isEditing = editingId === key

            return (
              <div
                key={key}
                className="grid grid-cols-[44px_100px_160px_220px_1fr_160px_140px_100px] border-b border-gray-100 last:border-b-0"
              >
                {/* Selection */}
                <div className="flex items-center justify-center py-4">
                  <Checkbox
                    checked={selectedIds.has(key)}
                    onCheckedChange={checked => {
                      setSelectedIds(prev => {
                        const next = new Set(prev)
                        checked ? next.add(key) : next.delete(key)
                        return next
                      })
                    }}
                    aria-label="Select row"
                  />
                </div>

                {/* Movement ID */}
                <div className="px-4 py-4">
                  <p className="font-mono text-sm text-gray-700">#{entry.id}</p>
                  <p className="font-mono text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">
                    {entry.type === "IN" ? "Stock In" : "Stock Out"}
                  </p>
                </div>

                {/* Delivery Date */}
                <div className="px-4 py-4">
                  <p className="font-mono text-sm text-gray-700">
                    {entry.delivery_date
                      ? manilaDate(entry.delivery_date)
                      : manilaDate(entry.created_at)}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">
                    {manilaTime(entry.created_at)}
                  </p>
                </div>

                {/* Details — card with rounded corners and horizontal dividers */}
                <div className="px-4 py-4">
                  <div className="border border-gray-200 rounded-lg">
                    <div className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-mono rounded-full border ${
                        entry.type === "IN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {entry.type === "IN" ? "STOCK IN" : "STOCK OUT"}
                      </span>
                    </div>
                    <div className="mx-3 border-t border-gray-100" />
                    <div className="px-3 py-2">
                      <p className="text-sm text-gray-800">
                        {entry.type === "IN"
                          ? (entry.reference || "—")
                          : (entry.customer_name || "—")}
                      </p>
                    </div>
                    {((entry.type === "IN" && entry.supplier_name) || (entry.type === "OUT" && entry.remarks)) && (
                      <>
                        <div className="mx-3 border-t border-gray-100" />
                        <div className="px-3 py-2">
                          <p className="text-xs text-gray-400">
                            {entry.type === "IN" ? entry.supplier_name : entry.remarks}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="py-4">
                  {entry.items.length === 0 ? (
                    <p className="text-xs text-gray-400 font-mono px-4">No items</p>
                  ) : (() => {
                    const isExpanded = expandedIds.has(key)
                    const visibleItems = isExpanded ? entry.items : entry.items.slice(0, 10)
                    const hasMore = entry.items.length > 10
                    return (
                      <>
                        {visibleItems.map((item, i) => {
                          const itemCogs = item.stock_in_item_id != null ? editedCogs[item.stock_in_item_id] : undefined
                          const liveTotal = itemCogs !== undefined && itemCogs !== ""
                            ? Number(itemCogs) * item.quantity
                            : item.total
                          return (
                            <div key={i} className="grid grid-cols-[1fr_64px_96px_72px] gap-x-3 items-center px-4 py-1.5 border-b border-gray-100 last:border-b-0">
                              <span className="font-sans text-sm text-gray-700 truncate">{item.product_name}</span>
                              <span className="font-sans text-sm text-gray-600 text-right whitespace-nowrap">
                                {item.quantity} <span className="text-xs text-gray-400">{item.unit}</span>
                              </span>
                              {isEditing && item.stock_in_item_id != null ? (
                                <div className="flex justify-end">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editedCogs[item.stock_in_item_id] ?? ""}
                                    onChange={e => setEditedCogs(prev => ({
                                      ...prev,
                                      [item.stock_in_item_id!]: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                                    }))}
                                    onFocus={e => e.target.select()}
                                    className="w-20 px-2 py-0.5 border border-gray-300 font-mono text-xs text-center focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                              ) : (
                                <span className="font-mono text-xs text-gray-400 text-left block overflow-hidden">
                                  {item.cogs != null ? `@${item.cogs.toLocaleString()}` : ""}
                                </span>
                              )}
                              <span className={`font-mono text-sm text-right ${liveTotal != null ? (isEditing ? "text-black font-medium" : "text-gray-700") : ""}`}>
                                {liveTotal != null ? liveTotal.toLocaleString() : ""}
                              </span>
                            </div>
                          )
                        })}
                        {hasMore && (
                          <button
                            onClick={() => setExpandedIds(prev => {
                              const next = new Set(prev)
                              isExpanded ? next.delete(key) : next.add(key)
                              return next
                            })}
                            className="text-xs font-mono text-gray-400 hover:text-black transition-colors mt-2 px-4"
                          >
                            {isExpanded ? "Show less" : `+${entry.items.length - 10} more`}
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Total */}
                <div className="px-4 py-4">
                  {entry.type === "IN" ? (() => {
                    const displayTotal = isEditing
                      ? entry.items.reduce((sum, item) => {
                          if (item.stock_in_item_id == null) return sum
                          const c = editedCogs[item.stock_in_item_id]
                          return sum + (c === "" || c == null ? 0 : Number(c)) * item.quantity
                        }, 0)
                      : (entry.overall_total ?? 0)
                    return (
                      <div className={`border rounded-lg ${isEditing ? "border-black" : "border-gray-200"}`}>
                        <div className="px-3 py-2">
                          <p className="text-xs font-mono text-gray-400 tracking-wider uppercase">Overall</p>
                        </div>
                        <div className="mx-3 border-t border-gray-100" />
                        <div className="px-3 py-2">
                          <p className={`font-mono text-sm font-medium ${isEditing ? "text-black" : "text-gray-800"}`}>
                            {displayTotal.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )
                  })() : (
                    <span className="text-xs text-gray-300 font-mono">—</span>
                  )}
                </div>

                {/* Added at */}
                <div className="px-4 py-4">
                  <p className="font-mono text-sm text-gray-700">
                    {manilaDate(entry.created_at)}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">
                    {manilaTime(entry.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="pl-3 pr-4 py-4 flex flex-col items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSave(entry)}
                        disabled={isSaving}
                        className="w-full px-2 py-1.5 text-[10px] font-mono border border-black text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 rounded"
                      >
                        {isSaving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditedCogs({}) }}
                        className="w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 hover:border-black transition-colors rounded"
                      >
                        Cancel
                      </button>
                    </>
                  ) : isConfirming ? (
                    <>
                      <button
                        onClick={() => handleDelete(entry)}
                        disabled={isDeleting}
                        className="w-full px-2 py-1.5 text-[10px] font-mono border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 rounded"
                      >
                        {isDeleting ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 hover:border-black transition-colors rounded"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1">
                      {entry.type === "IN" && (
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 text-gray-400 hover:text-black transition-colors"
                          title="Edit COGS"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(key)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete record"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
