"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUp, ArrowDown, CaretUpDown, MagnifyingGlass } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

interface CustomerSummaryRow {
  customer_id: number
  customer_name: string
  total_sales: number
  total_payments: number
  running_balance: number
}

export function CustomerCreditSummary() {
  const [data, setData] = useState<CustomerSummaryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "running_balance", desc: true }])
  const [search, setSearch] = useState("")
  const [rowSelection, setRowSelection] = useState({})

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from("customer_credit_summary")
        .select("*")

      if (error) {
        toast.error("Failed to load customer summary")
        console.error(error)
      } else if (rows) {
        setData(rows)
      }
      setIsLoading(false)
    }
    fetchSummary()
  }, [])

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row => row.customer_name.toLowerCase().includes(q))
  }, [data, search])

  const totals = useMemo(() => ({
    total_sales: filteredData.reduce((sum, r) => sum + r.total_sales, 0),
    total_payments: filteredData.reduce((sum, r) => sum + r.total_payments, 0),
    running_balance: filteredData.reduce((sum, r) => sum + r.running_balance, 0),
  }), [filteredData])

  const columns: ColumnDef<CustomerSummaryRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-sans text-sm font-medium">{row.getValue("customer_name")}</span>
      ),
    },
    {
      accessorKey: "total_sales",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Sales
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-sans text-sm">{formatCurrency(row.getValue("total_sales"))}</span>
      ),
    },
    {
      accessorKey: "total_payments",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Payments
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-sans text-sm">{formatCurrency(row.getValue("total_payments"))}</span>
      ),
    },
    {
      accessorKey: "running_balance",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Balance
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => {
        const balance = row.getValue("running_balance") as number
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-sans font-medium border ${
              balance <= 0
                ? "bg-green-100/50 text-green-700 border-green-300"
                : "bg-red-100/50 text-red-700 border-red-300"
            }`}
          >
            {formatCurrency(balance)}
          </span>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative w-64">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-sans tracking-wider uppercase text-gray-500">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400 font-sans text-sm">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-gray-50 border-t-2 border-gray-200 font-medium">
                  <TableCell className="py-3" />
                  <TableCell className="font-sans text-xs tracking-wider uppercase text-gray-500 py-3">
                    Total ({filteredData.length})
                  </TableCell>
                  <TableCell className="font-sans text-sm py-3">
                    {formatCurrency(totals.total_sales)}
                  </TableCell>
                  <TableCell className="font-sans text-sm py-3">
                    {formatCurrency(totals.total_payments)}
                  </TableCell>
                  <TableCell className="py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-sans font-medium border ${
                        totals.running_balance <= 0
                          ? "bg-green-100/50 text-green-700 border-green-300"
                          : "bg-red-100/50 text-red-700 border-red-300"
                      }`}
                    >
                      {formatCurrency(totals.running_balance)}
                    </span>
                  </TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">
                  No customer credit records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
