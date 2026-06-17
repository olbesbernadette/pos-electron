"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, ShieldWarning, MagnifyingGlass, X } from "@phosphor-icons/react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { StocksTable } from "@/components/admin/stocks-table"
import { StockLogsTable } from "@/components/admin/stock-logs-table"
import { createClient } from "@/lib/supabase/client"

type StocksView = "stocks" | "in" | "out"

const WAREHOUSES = [
  { id: 1, name: "Pawa" },
  { id: 2, name: "Zone 2" },
]

export default function AdminStocksPage() {
  const { isAdmin } = useAuth()
  const [view, setView] = useState<StocksView>("stocks")

  const [stocksSearch, setStocksSearch] = useState("")
  const [stocksWarehouse, setStocksWarehouse] = useState<number | "all">("all")
  const [inSearch, setInSearch] = useState("")
  const [inWarehouse, setInWarehouse] = useState<number | "all">("all")
  const [outSearch, setOutSearch] = useState("")
  const [outWarehouse, setOutWarehouse] = useState<number | "all">("all")

  const [productNames, setProductNames] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchNames = async () => {
      const supabase = createClient()
      const all: string[] = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from("items")
          .select("product_name")
          .order("product_name")
          .range(from, from + pageSize - 1)
        if (error || !data || data.length === 0) break
        all.push(...data.map((i: any) => i.product_name))
        if (data.length < pageSize) break
        from += pageSize
      }
      setProductNames(all)
    }
    fetchNames()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const activeSearch =
    view === "stocks" ? stocksSearch : view === "in" ? inSearch : outSearch
  const setActiveSearch =
    view === "stocks" ? setStocksSearch : view === "in" ? setInSearch : setOutSearch
  const activeWarehouse =
    view === "stocks" ? stocksWarehouse : view === "in" ? inWarehouse : outWarehouse
  const setActiveWarehouse = (v: number | "all") => {
    if (view === "stocks") setStocksWarehouse(v)
    else if (view === "in") setInWarehouse(v)
    else setOutWarehouse(v)
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="text-center">
          <ShieldWarning className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-medium tracking-wide mb-2">Access Denied</h1>
          <p className="text-xs text-gray-500 font-mono tracking-wider mb-6">
            You do not have permission to access this page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Dashboard</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <Sidebar basePath="/admin" />
      <section className="flex-1 px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-medium tracking-wide">Stocks</h1>
          <Link
            href="/admin"
            className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-widest uppercase">Back to Admin</span>
          </Link>
        </div>

        {/* Tab Navigation + Filters Row */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          {/* Tabs */}
          <div className="flex gap-2">
            {([
              { key: "stocks", label: "STOCKS" },
              { key: "in", label: "STOCK IN" },
              { key: "out", label: "STOCK OUT" },
            ] as { key: StocksView; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`px-6 py-2.5 text-xs font-mono tracking-widest border transition-colors ${
                  view === tab.key
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-600 border-gray-200 hover:border-black"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + Warehouse filter */}
          <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative" ref={searchRef}>
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    view === "stocks" ? "Search by name or code..." :
                    view === "in" ? "Search product, code, reference..." :
                    "Search product, code, customer..."
                  }
                  value={activeSearch}
                  onChange={e => { setActiveSearch(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-9 pr-8 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors w-64"
                />
                {activeSearch && (
                  <button
                    onClick={() => { setActiveSearch(""); setShowSuggestions(false) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                {showSuggestions && activeSearch.trim() && (() => {
                  const matches = productNames
                    .filter(name => name.toLowerCase().includes(activeSearch.toLowerCase()))
                    .slice(0, 10)
                  return matches.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-md z-50 max-h-60 overflow-y-auto">
                      {matches.map(name => (
                        <button
                          key={name}
                          onMouseDown={e => {
                            e.preventDefault()
                            setActiveSearch(name)
                            setShowSuggestions(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-sans text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>

              {/* Warehouse buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveWarehouse("all")}
                  className={`px-4 py-2 text-xs font-mono tracking-widest border transition-colors ${
                    activeWarehouse === "all"
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-200 hover:border-black"
                  }`}
                >
                  ALL
                </button>
                {WAREHOUSES.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setActiveWarehouse(w.id)}
                    className={`px-4 py-2 text-xs font-mono tracking-widest border transition-colors ${
                      activeWarehouse === w.id
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-600 border-gray-200 hover:border-black"
                    }`}
                  >
                    {w.name.toUpperCase()}
                  </button>
                ))}
              </div>
          </div>
        </div>

        {/* Tab Content — always mounted to preserve state */}
        <div className={view === "stocks" ? "" : "hidden"}>
          <StocksTable searchQuery={stocksSearch} selectedWarehouseId={stocksWarehouse} />
        </div>
        <div className={view === "in" ? "" : "hidden"}>
          <StockLogsTable type="IN" searchQuery={inSearch} selectedWarehouseId={inWarehouse} />
        </div>
        <div className={view === "out" ? "" : "hidden"}>
          <StockLogsTable type="OUT" searchQuery={outSearch} selectedWarehouseId={outWarehouse} />
        </div>
      </section>
    </div>
  )
}
