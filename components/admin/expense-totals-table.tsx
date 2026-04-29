"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUp, ArrowDown, CaretUpDown, Funnel, Copy, Eye } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

// Types
interface ExpenseItem {
  transaction_id?: number
  details: string
  amount: number
  created_at?: string
}

interface ExpenseTotalItem {
  payment_type: number
  total_amount: number
}

interface ExpenseRow {
  shift_id: number
  shift_no: number
  branch_name: string
  shift_date: string
  closed_time: string | null
  shift_by: string | null
  total_expense: number
  expenses: ExpenseItem[]
  expense_totals: ExpenseTotalItem[]
}

// Branch badge colors (light background with opacity, dark muted text, matching border)
const branchBadgeColors: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-cyan-100/50", text: "text-cyan-700", border: "border-cyan-300" },
  2: { bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  3: { bg: "bg-rose-100/50", text: "text-rose-700", border: "border-rose-300" },
  4: { bg: "bg-violet-100/50", text: "text-violet-700", border: "border-violet-300" },
  5: { bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
}

// Currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function ExpenseTotalsTable() {
  const [data, setData] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // Filter states
  const [branchFilter, setBranchFilter] = useState<string>("all")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<ExpenseRow | null>(null)

  // Fetch data from Supabase RPC
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = createClient()
      
      const params: { p_branch_id?: number; p_date_from?: string; p_date_to?: string } = {}
      
      if (branchFilter !== "all") {
        params.p_branch_id = parseInt(branchFilter)
      }
      
      const { data: expenseData, error } = await supabase.rpc("get_expense_shifts", params)
      
      if (error) {
        console.error("Error fetching expense shifts:", error)
        toast.error(`Failed to load expense data: ${error.message}`)
        setData([])
      } else {
        // Ensure expenses and expense_totals are always arrays (handle null case)
        const normalizedData = (expenseData || []).map((row: ExpenseRow) => ({
          ...row,
          expenses: row.expenses || [],
          expense_totals: row.expense_totals || []
        }))
        setData(normalizedData)
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [branchFilter])

  // Branch name to ID mapping for badge colors
  const branchNameToId: Record<string, number> = {
    "Hardware": 1,
    "Pawa Gas": 2,
    "Matnog Gas": 3,
    "Gotis Hotel": 4,
    "Rental": 5,
    "Boarders": 6,
  }

  const columns: ColumnDef<ExpenseRow>[] = [
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
      enableHiding: false,
    },
    {
      accessorKey: "shift_no",
      header: "Shift No.",
      cell: ({ row }) => {
        const shiftNo = row.getValue("shift_no") as number
        const handleCopy = () => {
          navigator.clipboard.writeText(shiftNo.toString())
          toast.success("Shift number copied")
        }
        return (
          <div className="inline-flex items-stretch border border-gray-200 rounded-md h-8">
            <span className="font-mono text-sm px-2 flex items-center">{shiftNo}</span>
            <div className="w-px bg-gray-200" />
            <button
              onClick={handleCopy}
              className="px-2 flex items-center hover:bg-gray-50 transition-colors rounded-r-md"
              title="Copy shift number"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: "shift_date",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Shift Info
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
        const shiftDate = row.getValue("shift_date") as string
        const closedTime = row.original.closed_time
        const branchName = row.original.branch_name
        // Map branch name to colors
        const branchColorMap: Record<string, number> = {
          "Hardware": 1,
          "Pawa Gas": 2,
          "Matnog Gas": 3,
          "Agri": 4,
        }
        const branchId = branchColorMap[branchName] || 0
        const badgeColors = branchBadgeColors[branchId] || { bg: "bg-gray-100/50", text: "text-gray-700", border: "border-gray-300" }
        
        const date = new Date(shiftDate)
        
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            {/* Branch Badge */}
            <div className="px-3 py-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}>
                {branchName}
              </span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Shift Date */}
            <div className="px-3 py-2 font-mono text-xs">
              {date.toLocaleDateString("en-PH", { 
                year: "numeric", 
                month: "short", 
                day: "numeric",
              })}
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Closing Time */}
            <div className="px-3 py-2 font-mono text-xs text-gray-400">
              {closedTime 
                ? `Closed ${new Date(closedTime).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`
                : "Open"
              }
            </div>
          </div>
        )
      },
    },
    {
      id: "breakdown",
      header: "Breakdown",
      cell: ({ row }) => {
        const expenses = row.original.expenses || []
        
        if (expenses.length === 0) {
          return <span className="text-xs text-gray-400">No expenses</span>
        }
        
        return (
          <div className="flex flex-col gap-1">
            {expenses.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between w-full px-3 py-2 border border-gray-200 rounded-md text-left"
              >
                <span className="text-xs font-mono text-gray-500 tracking-wider">
                  {item.details}
                </span>
                <span className="text-sm font-mono font-medium">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: "total_expense",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Totals
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
        const expenseTotals = row.original.expense_totals || []
        const grandTotal = row.original.total_expense || 0
        const paymentTypeLabels: Record<number, string> = {
          5: "Payroll",
          6: "Deposit",
          7: "Repairs",
          8: "Utilities",
          9: "Port Fees",
          10: "Others",
        }
        
        if (expenseTotals.length === 0) {
          return <span className="text-xs text-gray-400">No totals</span>
        }
        
        const handleCopy = () => {
          navigator.clipboard.writeText(grandTotal.toString())
          toast.success("Total amount copied")
        }
        
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            {expenseTotals.map((item, index) => (
              <div key={index}>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 tracking-wider">
                    {paymentTypeLabels[item.payment_type] || `Type ${item.payment_type}`}
                  </span>
                  <span className="text-sm font-mono font-medium">
                    {formatCurrency(item.total_amount)}
                  </span>
                </div>
                {index < expenseTotals.length - 1 && <div className="h-px bg-gray-200" />}
              </div>
            ))}
            {/* Grand Total row */}
            <div className="h-px bg-gray-200" />
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Total</span>
              <span className="text-sm font-mono font-medium">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "shift_by",
      header: "Shift By",
      cell: ({ row }) => {
        const shiftBy = row.getValue("shift_by") as string | null
        return (
          <div className="text-xs font-mono text-gray-600">
            {shiftBy || "-"}
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return (
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 px-3"
            onClick={() => {
              setSelectedRow(row.original)
              setDialogOpen(true)
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Button>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Funnel className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-mono text-gray-500">Filters:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-500">Branch:</label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs font-mono">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              <SelectItem value="1">Hardware</SelectItem>
              <SelectItem value="2">Pawa Gas</SelectItem>
              <SelectItem value="3">Matnog Gas</SelectItem>
              <SelectItem value="4">Gotis Hotel</SelectItem>
              <SelectItem value="5">Rental</SelectItem>
              <SelectItem value="6">Boarders</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gray-50/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="text-gray-400 text-sm">Loading...</span>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-gray-50/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm py-4 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="text-gray-400 text-sm">No expenses found</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Row count */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-500">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected
        </div>
        <div className="text-xs font-mono text-gray-500">
          Total: {data.length} shifts
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">
              Expense Details - Shift #{selectedRow?.shift_no}
            </DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-mono text-gray-500 uppercase">Branch</span>
                  <p className="font-medium">{selectedRow.branch_name}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-gray-500 uppercase">Shift By</span>
                  <p className="font-medium">{selectedRow.shift_by || "-"}</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-gray-500 uppercase">Date</span>
                  <p className="font-mono text-sm">
                    {new Date(selectedRow.shift_date).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-mono text-gray-500 uppercase">Status</span>
                  <p className="font-medium">{selectedRow.closed_time ? "Closed" : "Open"}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <span className="text-xs font-mono text-gray-500 uppercase">Expense Breakdown</span>
                <div className="mt-2 space-y-2">
                  {(selectedRow.expenses || []).map((expense, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm">{expense.details}</span>
                      <span className="font-mono text-sm font-semibold">{formatCurrency(expense.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="text-sm font-medium">Total Expenses</span>
                <span className="font-mono text-lg font-bold">{formatCurrency(selectedRow.total_expense)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
