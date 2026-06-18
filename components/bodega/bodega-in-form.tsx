"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, Trash, Plus, CaretDown, X, WarningCircle } from "@phosphor-icons/react"
import Papa from "papaparse"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parse } from "date-fns"
import { createClient } from "@/lib/supabase/client"

interface ReleaseItem {
  id: string
  itemId: number
  code: string
  product: string
  unit: string
  releasedQty: number
  cogs: number
}

interface InventoryItem {
  id: string | number
  code: string
  name: string
  unit: string
  cogs?: number
}

interface BodegaInFormProps {
  warehouseId: number
}

// Mock inventory items - fallback (replaced by Supabase search)
const mockInventoryItems: InventoryItem[] = []

export function BodegaInForm({ warehouseId }: BodegaInFormProps) {
  const [supplierName, setSupplierName] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false)
  const [releaseItems, setReleaseItems] = useState<ReleaseItem[]>([])
  const [newItemName, setNewItemName] = useState("")
  const [newItemCategory, setNewItemCategory] = useState<number | "">("")
  const [newItemUnit, setNewItemUnit] = useState("pc")
  const [newItemCogs, setNewItemCogs] = useState<number | "">(0)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [pendingFileData, setPendingFileData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addItemSuccess, setAddItemSuccess] = useState(false)
  const [addItemError, setAddItemError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>(null)
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const searchQueryRef = useRef(searchQuery)

  // Handle file import - parse on file selection
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Store file and display name
    setUploadedFile(file)
    setUploadedFileName(file.name)

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results: any) => {
          // Store the raw parsed data (array of arrays)
          setPendingFileData(results.data)
          setAddItemError(null)
          console.log("[v0] File attached with", results.data.length, "rows")
        },
        error: (error: any) => {
          console.error("[v0] CSV Parse Error:", error)
          setAddItemError("Error parsing CSV file")
          setUploadedFile(null)
          setUploadedFileName("")
          setPendingFileData(null)
        },
      })
    } else if (file.name.endsWith(".xlsx")) {
      setAddItemError("XLSX files require additional library. Please use CSV for now.")
      setUploadedFile(null)
      setUploadedFileName("")
    } else {
      setAddItemError("Please upload a CSV or XLSX file")
      setUploadedFile(null)
      setUploadedFileName("")
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Import the file data
  const handleImport = async () => {
    if (!pendingFileData || !Array.isArray(pendingFileData)) {
      setAddItemError("No valid file data to import")
      return
    }
    await parseCSVData(pendingFileData)
    setPendingFileData(null)
    setUploadedFile(null)
    setUploadedFileName("")
  }

  // Remove attached file
  const handleRemoveFile = () => {
    setUploadedFile(null)
    setUploadedFileName("")
    setPendingFileData(null)
  }

  // Parse CSV data and extract items for right panel + header info from row 1
  const parseCSVData = async (csvData: any[]): Promise<void> => {
    try {
      if (!csvData || csvData.length < 5) {
        setAddItemError("CSV must have header rows (rows 1-3) and item data (row 4+)")
        return
      }

      // Extract header info from row 1 (index 1): Request Number, Customer, Branch, etc.
      const headerRow = csvData[1]
      if (headerRow && Array.isArray(headerRow)) {
        const refNum = headerRow[0]?.toString().trim() || ""
        const supplier = headerRow[1]?.toString().trim() || "" // Customer/Supplier is column 1
        const delivery = headerRow[5]?.toString().trim() || "" // Request Date is column 5

        if (refNum) setReferenceNumber(refNum)
        if (supplier) setSupplierName(supplier)
        if (delivery) setDeliveryDate(delivery)
        
        console.log("[v0] Header extracted - Ref:", refNum, "Supplier:", supplier, "Date:", delivery)
      }

      // Process items from row 4 onwards (index 4+)
      // Skip: Row 0 (headers), Row 1 (data), Row 2 (empty), Row 3 (item headers)
      const itemRows = csvData.slice(4)
      
      if (itemRows.length === 0) {
        setAddItemError("No item rows found in CSV (expected data starting from row 4)")
        return
      }

      console.log("[v0] Found", itemRows.length, "item rows to process")
      console.log("[v0] First item row data:", itemRows[0])
      console.log("[v0] All item rows:", itemRows)

      // Extract codes from all rows (normalize: trim + lowercase)
      const codes = itemRows
        .map(row => row[0]?.toString().trim().toLowerCase())
        .filter((code): code is string => !!code && code.length > 0)

      if (codes.length === 0) {
        setAddItemError("No valid codes found in CSV item rows")
        return
      }

      console.log("[v0] CSV Codes extracted:", codes.slice(0, 5), "... (total:", codes.length, ")")

      // Batch query items table by codes - use lowercase to match CSV
      const supabase = createClient()
      
      console.log("[v0] Querying with lowercase codes:", codes.slice(0, 10))
      
      const { data: matchedItems, error: queryError } = await supabase
        .from("items")
        .select("id, code, cogs")
        .in("code", codes) // Query with lowercase as extracted from CSV

      if (queryError) {
        setAddItemError("Error querying items: " + queryError.message)
        console.error("Query error:", queryError)
        return
      }

      console.log("[v0] Matched items from database:", matchedItems?.length, "items found")
      console.log("[v0] Database codes found:", matchedItems?.map(m => m.code))

      // Build lookup map: normalized code → { id, cogs }
      const itemLookup = new Map<string, { id: number; cogs: number | null }>()
      ;(matchedItems || []).forEach(item => {
        itemLookup.set(item.code.toLowerCase(), { id: Number(item.id), cogs: item.cogs ?? null })
      })

      // Process and filter rows
      const validItems: ReleaseItem[] = []
      let totalProcessed = 0
      let totalSkipped = 0

      itemRows.forEach((row, index) => {
        totalProcessed++
        
        const code = row[0]?.toString().trim().toLowerCase() || ""
        const product = row[1]?.toString().trim() || ""
        const unit = row[2]?.toString().trim() || "pc"
        const releasedQty = parseInt(row[4]?.toString() || "0") || 0

        console.log(`[v0] Row ${index}: code="${code}", product="${product}", unit="${unit}", qty=${releasedQty}`)

        // Filter: code must exist in items table and qty > 0
        const lookup = itemLookup.get(code)
        if (!lookup) {
          console.log(`[v0]   -> Code "${code}" NOT found in database (lookup has ${itemLookup.size} items)`)
          console.log(`[v0]   -> Available in lookup: ${Array.from(itemLookup.keys()).slice(0, 5).join(", ")}...`)
          totalSkipped++
          return
        }

        if (releasedQty <= 0) {
          console.log(`[v0]   -> Qty is 0 or invalid, skipping`)
          totalSkipped++
          return
        }

        console.log(`[v0]   -> VALID ITEM ADDED`)

        // Create release item for right panel
        validItems.push({
          id: `import-${code}-${Date.now()}-${index}`,
          itemId: lookup.id,
          code: code, // Keep as-is from database (lowercase)
          product,
          unit,
          releasedQty,
          cogs: lookup.cogs ?? 0,
        })
      })

      // Add valid items to right panel
      setReleaseItems(prev => [...prev, ...validItems])

      // Show appropriate message
      if (validItems.length === 0) {
        setAddItemError(`No matching items found. Processed: ${totalProcessed}, Skipped: ${totalSkipped}`)
      } else {
        setAddItemSuccess(true)
        setAddItemError(null)
        setTimeout(() => setAddItemSuccess(false), 3000)
      }

      console.log(
        "[v0] CSV Import: Processed:", totalProcessed,
        "| Matched:", validItems.length,
        "| Skipped:", totalSkipped,
        "| Lookup map size:", itemLookup.size
      )
    } catch (error) {
      console.error("[v0] Parse error:", error)
      setAddItemError("Error parsing file: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  // Helper function to safely parse delivery date
  const getParsedDeliveryDate = (): Date | undefined => {
    if (!deliveryDate) return undefined
    try {
      return parse(deliveryDate, "yyyy-MM-dd", new Date())
    } catch {
      return undefined
    }
  }

  // Helper function to format delivery date for display
  const getFormattedDeliveryDate = (): string => {
    if (!deliveryDate) return "Date"
    try {
      const parsed = parse(deliveryDate, "yyyy-MM-dd", new Date())
      return format(parsed, "PPP")
    } catch {
      return deliveryDate
    }
  }

  // Add new item
  const addNewItem = async () => {
    if (!newItemName.trim() || !newItemCategory) {
      setAddItemError("Please fill in product name and select a category")
      return
    }

    try {
      const supabase = createClient()
      
      // Generate a simple code from product name
      const productPrefix = newItemName.substring(0, 3).toUpperCase()
      const timestamp = Date.now().toString().slice(-4)
      const generatedCode = `${productPrefix}${timestamp}`

      // Insert into items table
      const { data, error } = await supabase
        .from("items")
        .insert({
          code: generatedCode,
          product_name: newItemName,
          unit: newItemUnit,
          category_id: newItemCategory,
          cogs: newItemCogs !== "" ? newItemCogs : null,
        })
        .select()

      if (error) {
        setAddItemError("Error adding item: " + error.message)
        console.error("Insert error:", error)
        return
      }

      // Clear form
      setNewItemName("")
      setNewItemUnit("pc")
      setNewItemCogs(0)
      if (categories.length > 0) {
        setNewItemCategory(categories[0].id)
      }

      setAddItemSuccess(true)
      setAddItemError(null)
      // Hide success message after 3 seconds
      setTimeout(() => setAddItemSuccess(false), 3000)
    } catch (err) {
      console.error("Exception adding item:", err)
      setAddItemError("Error adding item to database")
    }
  }

  // Remove item
  const removeItem = (id: string) => {
    setReleaseItems(prev => prev.filter(item => item.id !== id))
  }

  // Update released qty
  const updateQty = (id: string, qty: number) => {
    setReleaseItems(prev =>
      prev.map(item => item.id === id ? { ...item, releasedQty: qty } : item)
    )
  }

  // Update COGS
  const updateCogs = (id: string, cogs: number) => {
    setReleaseItems(prev =>
      prev.map(item => item.id === id ? { ...item, cogs: Math.max(0, cogs) } : item)
    )
  }

  // Handle keyboard navigation for qty inputs
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (currentIndex < releaseItems.length - 1) {
        const nextId = releaseItems[currentIndex + 1].id
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-item-id="${nextId}"]`) as HTMLInputElement
          nextInput?.focus()
        }, 0)
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (currentIndex < releaseItems.length - 1) {
        const nextId = releaseItems[currentIndex + 1].id
        const nextInput = document.querySelector(`input[data-item-id="${nextId}"]`) as HTMLInputElement
        nextInput?.focus()
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (currentIndex > 0) {
        const prevId = releaseItems[currentIndex - 1].id
        const prevInput = document.querySelector(`input[data-item-id="${prevId}"]`) as HTMLInputElement
        prevInput?.focus()
      }
    }
  }

  // Handle keyboard navigation for COGS inputs
  const handleCogsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (currentIndex < releaseItems.length - 1) {
        const nextId = releaseItems[currentIndex + 1].id
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-cogs-id="${nextId}"]`) as HTMLInputElement
          nextInput?.focus()
        }, 0)
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (currentIndex < releaseItems.length - 1) {
        const nextId = releaseItems[currentIndex + 1].id
        const nextInput = document.querySelector(`input[data-cogs-id="${nextId}"]`) as HTMLInputElement
        nextInput?.focus()
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (currentIndex > 0) {
        const prevId = releaseItems[currentIndex - 1].id
        const prevInput = document.querySelector(`input[data-cogs-id="${prevId}"]`) as HTMLInputElement
        prevInput?.focus()
      }
    }
  }

  const handleSubmit = async () => {
    if (!referenceNumber.trim()) {
      setAddItemError("Reference number is required")
      return
    }
    if (releaseItems.some(item => item.releasedQty === 0)) {
      setAddItemError("All items must have a non-zero quantity")
      return
    }

    setIsSubmitting(true)
    setAddItemError(null)

    try {
      const supabase = createClient()

      const { error } = await supabase.rpc("process_stock_in", {
        p_warehouse_id: warehouseId,
        p_reference: referenceNumber,
        p_supplier_name: supplierName || null,
        p_delivery_date: deliveryDate || null,
        p_items: releaseItems.map(item => ({
          item_id: item.itemId,
          quantity: item.releasedQty,
          cogs: item.cogs || null,
        })),
        p_idempotency_key: idempotencyKey,
      })

      if (error) {
        setAddItemError("Submission failed: " + error.message)
        return
      }

      setReleaseItems([])
      setReferenceNumber("")
      setSupplierName("")
      setDeliveryDate("")
      setIdempotencyKey(crypto.randomUUID())
      setAddItemSuccess(true)
      setTimeout(() => setAddItemSuccess(false), 3000)
    } catch {
      setAddItemError("Unexpected error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const supabase = createClient()
      const searchPattern = `%${query}%`

      const { data, error } = await supabase
        .from("items")
        .select("id, code, product_name, unit, cogs")
        .or(`product_name.ilike.${searchPattern},code.ilike.${searchPattern}`)
        .is("deleted_at", null)
        .order("item_no", { ascending: true })
        .limit(20)

      if (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } else {
        const results: InventoryItem[] = (data || []).map(item => ({
          id: item.id,
          code: item.code,
          name: item.product_name,
          unit: item.unit,
          cogs: item.cogs ?? 0,
        }))
        setSearchResults(results)
      }
    } catch (err) {
      console.error("Search exception:", err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Keep ref in sync with searchQuery state
  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (searchQuery.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300)
    } else {
      setSearchResults([])
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery])

  // Realtime refresh for search results when item_stock changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("item_stock_in")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_stock" },
        () => {
          if (searchQueryRef.current.trim()) {
            performSearch(searchQueryRef.current)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Fetch categories from Supabase
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true })

        if (error) {
          console.error("Error fetching categories:", error)
        } else {
          setCategories(data || [])
          // Set first category as default if available
          if ((data || []).length > 0) {
            setNewItemCategory(data[0].id)
          }
        }
      } catch (err) {
        console.error("Exception fetching categories:", err)
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  // Handle item selection from search
  const selectSearchItem = (item: InventoryItem) => {
    const newItem: ReleaseItem = {
      id: `search-${item.id}-${Date.now()}`,
      itemId: Number(item.id),
      code: item.code,
      product: item.name,
      unit: item.unit,
      releasedQty: 0,
      cogs: item.cogs ?? 0,
    }
    setReleaseItems([...releaseItems, newItem])
    setSearchQuery("")
    setShowSearchDropdown(false)
    setHighlightedIndex(-1)
    // Keep focus on search input
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || searchResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      selectSearchItem(searchResults[highlightedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setShowSearchDropdown(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div className="px-6 pb-6">
      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Import and Add Items */}
        <div className="border border-gray-200 p-6">
          <h3 className="text-lg font-medium tracking-wide mb-6">Bodega In</h3>

          {/* File Import Section */}
          <div className="mb-8">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-3 block">
              Import from file
            </label>
            {uploadedFile ? (
              <div className="border border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-mono text-gray-600 truncate">
                      {uploadedFileName}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="ml-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    type="button"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    className="flex-1 px-4 py-3 bg-black text-white font-mono text-sm tracking-widest uppercase hover:bg-gray-900 transition-colors"
                    type="button"
                  >
                    Import
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-gray-300 rounded p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-mono text-gray-600 tracking-widest uppercase">
                  Click to upload CSV file
                </p>
                <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>

          {/* Search Item Section */}
          <div className="border-t border-gray-200 pt-6 pb-6">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-3 block">
              Search Item
            </label>
            <div className="relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by name or code"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchDropdown(true)
                    setHighlightedIndex(-1)
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full px-4 py-3 pr-10 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setShowSearchDropdown(false)
                      setHighlightedIndex(-1)
                      searchInputRef.current?.focus()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Search Dropdown */}
              {showSearchDropdown && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 bg-white z-50 shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs font-mono text-gray-400 text-center">
                      No items found
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => selectSearchItem(item)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`w-full px-4 py-3 border-b border-gray-100 last:border-b-0 text-left font-sans text-sm transition-colors ${
                            highlightedIndex === index
                              ? "bg-gray-100 text-gray-900"
                              : "hover:bg-gray-100 hover:border-black text-gray-700"
                          }`}
                          type="button"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.code}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-600">{item.unit}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add New Item Section */}
          <div className="border-t border-gray-200 pt-6 pb-6">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-3 block">
              Add New Item
            </label>

            {/* Success Message */}
            {addItemSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200">
                <p className="text-sm text-green-700 font-mono tracking-wide">
                  Item added successfully
                </p>
              </div>
            )}

            {/* Error Message */}
            {addItemError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 flex items-center gap-3">
                <WarningCircle className="w-5 h-5 text-red-600 flex-shrink-0" weight="fill" />
                <p className="text-sm text-red-700 font-mono tracking-wide">
                  {addItemError}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value ? parseInt(e.target.value) : "")}
                disabled={isLoadingCategories}
                className="px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors w-full sm:w-auto appearance-none bg-white pr-8 cursor-pointer disabled:opacity-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23666' d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value="">Select a category...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Product name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addNewItem()}
                  className="w-full px-4 py-3 pr-10 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
                />
                {newItemName && (
                  <button
                    onClick={() => setNewItemName("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                className="px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors w-full sm:w-auto appearance-none bg-white pr-8 cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23666' d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option>pc</option>
                <option>box</option>
                <option>bag</option>
                <option>roll</option>
                <option>gal</option>
                <option>ltr</option>
                <option>pail</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="COGS"
                value={newItemCogs}
                onChange={(e) => setNewItemCogs(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full sm:w-28 px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={addNewItem}
                className="px-4 py-3 bg-black text-white font-mono text-sm hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Form Fields and Items Table */}
        <div className="border border-gray-200 p-6">
          {/* Request Details */}
          <div className="mb-6">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-2 block">
              Reference Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Enter reference number"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-2 block">
              Supplier Name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Enter supplier name"
              className="w-full px-4 py-3 border border-gray-200 font-mono text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-2 block">
              Delivery Date
            </label>
            <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full px-4 py-3 border border-gray-200 font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"
                >
                  <span className={deliveryDate ? "text-black" : "text-gray-400"}>
                    {getFormattedDeliveryDate()}
                  </span>
                  <CaretDown className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={(() => {
                    try {
                      return deliveryDate ? parse(deliveryDate, "yyyy-MM-dd", new Date()) : undefined
                    } catch (e) {
                      return undefined
                    }
                  })()}
                  onSelect={(date) => {
                    if (date) setDeliveryDate(format(date, "yyyy-MM-dd"))
                    setDeliveryDateOpen(false)
                  }}
                  defaultMonth={new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Items Table / Cards */}
          <div className="hidden md:block border border-gray-200">
            {/* Desktop Table Header */}
            <div className="grid grid-cols-[80px_1fr_80px_80px_80px_60px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Code</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Product</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Unit</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Qty</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">COGS</span>
              <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Action</span>
            </div>

            {/* Desktop Table Body */}
            {releaseItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider">
                No items added
              </div>
            ) : (
              releaseItems.map((item, index) => (
                <div key={item.id} className={`grid grid-cols-[80px_1fr_80px_80px_80px_60px] gap-3 px-4 py-3 border-b border-gray-100 items-center last:border-b-0 ${item.releasedQty < 0 ? "bg-orange-50" : ""}`}>
                  <span className="px-1 py-0.5 bg-white border border-gray-200 text-[10px] font-mono rounded-full text-gray-600 whitespace-nowrap text-center">{item.code || "-"}</span>
                  <span className="font-mono text-sm text-gray-600 truncate">{item.product}</span>
                  <span className="font-mono text-sm text-gray-600">{item.unit || "pc"}</span>
                  <input
                    data-item-id={item.id}
                    ref={(el) => {
                      if (el) qtyInputRefs.current[item.id] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    defaultValue={item.releasedQty}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === "" || raw === "-") return
                      const parsed = parseInt(raw, 10)
                      if (!isNaN(parsed)) updateQty(item.id, parsed)
                    }}
                    onBlur={(e) => {
                      const parsed = parseInt(e.target.value, 10)
                      if (isNaN(parsed)) { updateQty(item.id, 0); e.target.value = "0" }
                    }}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => handleQtyKeyDown(e, index)}
                    className={`w-full px-2 py-1 border font-mono text-sm text-center focus:outline-none focus:border-black transition-colors ${item.releasedQty < 0 ? "border-orange-300 text-orange-700" : "border-gray-200"}`}
                  />
                  <input
                    data-cogs-id={item.id}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.cogs}
                    onChange={(e) => updateCogs(item.id, parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => handleCogsKeyDown(e, index)}
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

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {releaseItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-400 tracking-wider border border-gray-200">
                No items added
              </div>
            ) : (
              releaseItems.map((item, index) => (
                <div key={item.id} className={`border p-4 space-y-3 ${item.releasedQty < 0 ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-mono text-sm text-gray-600">{item.product}</p>
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
                    {item.releasedQty < 0 && (
                      <span className="inline-block px-1 py-0.5 bg-orange-100 border border-orange-300 text-[10px] font-mono rounded-full text-orange-700">deduction</span>
                    )}
                  </div>

                  <div className="border-t border-gray-200"></div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-mono text-gray-400 tracking-wider uppercase mb-1">Qty</p>
                      <input
                        data-item-id={item.id}
                        ref={(el) => {
                          if (el) qtyInputRefs.current[item.id] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        defaultValue={item.releasedQty}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === "" || raw === "-") return
                          const parsed = parseInt(raw, 10)
                          if (!isNaN(parsed)) updateQty(item.id, parsed)
                        }}
                        onBlur={(e) => {
                          const parsed = parseInt(e.target.value, 10)
                          if (isNaN(parsed)) { updateQty(item.id, 0); e.target.value = "0" }
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleQtyKeyDown(e, index)}
                        className={`w-full px-2 py-2 border font-mono text-sm text-center focus:outline-none focus:border-black transition-colors ${item.releasedQty < 0 ? "border-orange-300 text-orange-700" : "border-gray-200"}`}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-gray-400 tracking-wider uppercase mb-1">COGS</p>
                      <input
                        data-cogs-id={item.id}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.cogs}
                        onChange={(e) => updateCogs(item.id, parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCogsKeyDown(e, index)}
                        className="w-full px-2 py-2 border border-gray-200 font-mono text-sm text-center focus:outline-none focus:border-black transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={releaseItems.length === 0 || isSubmitting}
            className="w-full mt-6 px-4 py-3 bg-black text-white font-mono text-sm tracking-widest uppercase disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  )
}
