"use client"

import { useState, useEffect } from "react"
import { Trash } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { format, parseISO } from "date-fns"

interface LogItem {
  product_name: string
  code: string
  unit: string
  quantity: number
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

  const fetchLogs = async () => {
    setLoading(true)
    const supabase = createClient()

    const [stockInRes, stockOutRes] = await Promise.all([
      supabase
        .from("stock_in")
        .select("id, reference, supplier_name, delivery_date, created_at, stock_in_items(quantity, items(product_name, code, unit))")
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

    const inLogs: LogEntry[] = (stockInRes.data || []).map((row: any) => ({
      id: row.id,
      type: "IN",
      created_at: row.created_at,
      reference: row.reference,
      supplier_name: row.supplier_name,
      delivery_date: row.delivery_date,
      customer_name: null,
      remarks: null,
      items: (row.stock_in_items || []).map((si: any) => ({
        product_name: si.items?.product_name ?? "",
        code: si.items?.code ?? "",
        unit: si.items?.unit ?? "",
        quantity: si.quantity,
      })),
    }))

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
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
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

  const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.type === filter)

  return (
    <div className="px-6 pb-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
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
          <div className="grid grid-cols-[44px_100px_160px_220px_1fr_140px_100px] bg-gray-50 border-b border-gray-200">
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

            return (
              <div
                key={key}
                className="grid grid-cols-[44px_100px_160px_220px_1fr_140px_100px] border-b border-gray-100 last:border-b-0"
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
                      ? format(parseISO(entry.delivery_date), "MMM d, yyyy")
                      : format(parseISO(entry.created_at), "MMM d, yyyy")}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">
                    {format(parseISO(entry.created_at), "h:mm a")}
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
                        {visibleItems.map((item, i) => (
                          <div key={i} className="flex justify-between items-center gap-4 px-4 py-1.5 border-b border-gray-100 last:border-b-0">
                            <span className="font-sans text-sm text-gray-700 truncate">{item.product_name}</span>
                            <span className="font-sans text-sm text-gray-600 flex-shrink-0">
                              {item.quantity} <span className="text-xs text-gray-400">{item.unit}</span>
                            </span>
                          </div>
                        ))}
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

                {/* Added at */}
                <div className="px-4 py-4">
                  <p className="font-mono text-sm text-gray-700">
                    {format(parseISO(entry.created_at), "MMM d, yyyy")}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">
                    {format(parseISO(entry.created_at), "h:mm a")}
                  </p>
                </div>

                {/* Actions */}
                <div className="pl-3 pr-4 py-4 flex flex-col items-center gap-1.5">
                  {isConfirming ? (
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
                    <button
                      onClick={() => setConfirmDeleteId(key)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete record"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
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
