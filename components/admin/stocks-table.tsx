"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Checkbox } from "@/components/ui/checkbox"

interface StockItem {
  id: number
  item_no: number | null
  code: string
  product_name: string
  unit: string
  category: string
  stock: number
}

interface StocksTableProps {
  searchQuery: string
  selectedWarehouseId: number | "all"
}

export function StocksTable({ searchQuery, selectedWarehouseId }: StocksTableProps) {
  const [items, setItems] = useState<StockItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("items")
        .select("id, item_no, code, product_name, unit, categories(name), item_stock(warehouse_id, quantity)")
        .is("deleted_at", null)
        .order("item_no", { ascending: true, nullsFirst: false })

      if (!error) {
        const result: StockItem[] = (data || []).map((item: any) => {
          let stock = 0
          if (selectedWarehouseId === "all") {
            stock = (item.item_stock || []).reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
          } else {
            const match = (item.item_stock || []).find((s: any) => s.warehouse_id === selectedWarehouseId)
            stock = match?.quantity ?? 0
          }
          return {
            id: item.id,
            item_no: item.item_no,
            code: item.code,
            product_name: item.product_name,
            unit: item.unit,
            category: (item.categories as any)?.name ?? "—",
            stock,
          }
        })
        setItems(result)
      }

      setLoading(false)
    }
    fetchItems()
  }, [selectedWarehouseId])

  const displayedItems = items
    .filter(item => item.stock > 0)
    .filter(item => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return item.product_name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
    })

  return (
    <div>
      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm font-mono text-gray-400 tracking-wider">Loading...</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[44px_80px_160px_140px_1fr_80px_100px] bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center py-3">
              <Checkbox
                checked={displayedItems.length > 0 && displayedItems.every(i => selectedIds.has(i.id))}
                onCheckedChange={checked => setSelectedIds(
                  checked ? new Set(displayedItems.map(i => i.id)) : new Set()
                )}
                aria-label="Select all"
              />
            </div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">ID</div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">Category</div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">Code</div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">Product Name</div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">Unit</div>
            <div className="px-4 py-3 text-xs font-mono text-gray-500 tracking-wider uppercase">Stock</div>
          </div>

          {displayedItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-mono text-gray-400 tracking-wider">No items found</p>
            </div>
          ) : (
            displayedItems.map(item => (
              <div
                key={item.id}
                className="grid grid-cols-[44px_80px_160px_140px_1fr_80px_100px] border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-center py-3">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={checked => setSelectedIds(prev => {
                      const next = new Set(prev)
                      checked ? next.add(item.id) : next.delete(item.id)
                      return next
                    })}
                    aria-label="Select row"
                  />
                </div>
                <div className="px-4 py-3">
                  <span className="font-mono text-sm text-gray-500">#{item.id}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-sans text-sm text-gray-600">{item.category}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-mono text-xs text-gray-600 px-1.5 py-0.5 border border-gray-200 rounded-full whitespace-nowrap">
                    {item.code}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-sans text-sm text-gray-800">{item.product_name}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-sans text-sm text-gray-500">{item.unit}</span>
                </div>
                <div className="px-4 py-3">
                  <span className={`font-mono text-sm font-medium ${
                    item.stock === 0 ? "text-red-400" : "text-gray-800"
                  }`}>
                    {item.stock}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
