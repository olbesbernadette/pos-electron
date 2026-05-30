"use client"

import { useState, useEffect, useRef } from "react"
import { X, MagnifyingGlass } from "@phosphor-icons/react"
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

interface Warehouse {
  id: number
  name: string
}

interface Category {
  id: number
  name: string
}

export function StocksTable() {
  const [items, setItems] = useState<StockItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | "all">("all")

  const warehouses: Warehouse[] = [
    { id: 1, name: "Pawa" },
    { id: 2, name: "Zone 2" },
  ]
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all")
  const [categorySearch, setCategorySearch] = useState("")
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const categoryRef = useRef<HTMLDivElement>(null)

  // Fetch warehouses and categories on mount
  useEffect(() => {
    const fetchFilters = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true })
      if (data) setCategories(data)
    }
    fetchFilters()
  }, [])

  // Fetch items whenever warehouse filter changes
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("items")
        .select("id, item_no, code, product_name, unit, category_id, categories(name), item_stock(warehouse_id, quantity)")
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

  // Close category dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredCategories = categorySearch.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : categories

  const selectedCategoryName = selectedCategoryId === "all"
    ? null
    : categories.find(c => c.id === selectedCategoryId)?.name

  const displayedItems = items
    .filter(item => item.stock > 0)
    .filter(item => selectedCategoryId === "all" || item.category === selectedCategoryName)
    .filter(item => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return item.product_name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
    })

  return (
    <div>
      {/* Filters Row */}
      <div className="flex items-start gap-4 mb-6 flex-wrap justify-between">
        <div className="flex items-start gap-4 flex-wrap">

        {/* Warehouse Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedWarehouseId("all")}
            className={`px-4 py-2 text-xs font-mono tracking-widest border transition-colors ${
              selectedWarehouseId === "all"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-200 hover:border-black"
            }`}
          >
            ALL
          </button>
          {warehouses.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWarehouseId(w.id)}
              className={`px-4 py-2 text-xs font-mono tracking-widest border transition-colors capitalize ${
                selectedWarehouseId === w.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-black"
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="relative" ref={categoryRef}>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by category..."
                value={categorySearch}
                onChange={e => {
                  setCategorySearch(e.target.value)
                  setShowCategoryDropdown(true)
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                className="px-4 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors w-48"
              />
              {(categorySearch || selectedCategoryId !== "all") && (
                <button
                  onClick={() => {
                    setCategorySearch("")
                    setSelectedCategoryId("all")
                    setShowCategoryDropdown(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {selectedCategoryId !== "all" && (
              <span className="px-2 py-1 text-xs font-mono bg-black text-white">
                {selectedCategoryName}
              </span>
            )}
          </div>

          {showCategoryDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 border border-gray-200 bg-white z-50 shadow-lg max-h-52 overflow-y-auto">
              {filteredCategories.length === 0 ? (
                <div className="px-3 py-2 text-xs font-mono text-gray-400">No categories found</div>
              ) : (
                filteredCategories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(c.id === selectedCategoryId ? "all" : c.id)
                      setCategorySearch("")
                      setShowCategoryDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-sans border-b border-gray-100 last:border-b-0 transition-colors ${
                      selectedCategoryId === c.id
                        ? "bg-black text-white"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        </div>

        {/* Search — rightmost */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
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
