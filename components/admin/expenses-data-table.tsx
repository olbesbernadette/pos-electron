"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { ArrowUp, ArrowDown, Trash, CaretUpDown, Funnel, Check } from "@phosphor-icons/react"
import { useShift } from "@/contexts/shift-context"
import { createClient } from "@/lib/supabase/client"
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

import { toast } from "sonner"

// Types
interface ExpenseTransaction {
  id: number
  shift_id: number
  created_at: string
  branch_id: number
  payment_type: number
  details1: string | null
  amount: number
  status: number
}

interface Shift {
  id: number
}

// Expense type mapping (payment_type 5-10 for expenses)
const expenseTypeLabels: Record<number, string> = {
  5: "Payroll",
  6: "Deposit",
  7: "Repairs",
  8: "Utilities",
  9: "Port Fees",
  10: "Others",
}

// Branch mapping
const branchLabels: Record<number, string> = {
  1: "Hardware",
  2: "Pawa Gas",
  3: "Matnog Gas",
  4: "Gotis Hotel",
  5: "Rental",
  6: "Boarders",
}

// Status mapping (light background with opacity, dark muted text, matching border)
const statusLabels: Record<number, { label: string; bg: string; text: string; border: string }> = {
  1: { label: "Undeposited", bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  2: { label: "Deposited", bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
  3: { label: "Receivable", bg: "bg-sky-100/50", text: "text-sky-700", border: "border-sky-300" },
}

export function ExpensesDataTable() {
  const { currentShiftId } = useShift()
  
  const [data, setData] = useState<ExpenseTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  
  // Filter states
  const [shiftFilter, setShiftFilter] = useState<string>("all")
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>("all")
  const [shifts, setShifts] = useState<Shift[]>([])
  
  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<number | null>(null)
  
  // Reset delete confirmation when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (deletingId !== null && !target.closest('[data-delete-confirm]')) {
        setDeletingId(null)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [deletingId])

  // Fetch data - only show expenses from open shift
  useEffect(() => {
    const fetchData = async () => {
      if (!currentShiftId) {
        setData([])
        setShifts([])
        setLoading(false)
        return
      }
      
      const supabase = createClient()
      
      // Fetch transactions (transaction_type = 2 for expenses) from open shift only
      const { data: transactions, error } = await supabase
        .from("shift_transactions")
        .select("id, shift_id, created_at, branch_id, payment_type, details1, amount")
        .eq("transaction_type", 2)
        .eq("shift_id", currentShiftId)
        .order("created_at", { ascending: false })
      
      if (!error && transactions) {
        setData(transactions)
        
        // Get unique shift IDs
        const uniqueShifts = [...new Set(transactions.map(t => t.shift_id))]
          .map(id => ({ id }))
        setShifts(uniqueShifts)
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [currentShiftId])

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  // Helper function to show browser notification
  const showBrowserNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "jbj-expense",
      })
      
      setTimeout(() => notification.close(), 5000)
      
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
  }

  // Realtime subscription for live updates
  useEffect(() => {
    if (!currentShiftId) return
    
    const supabase = createClient()
    
    const channel = supabase
      .channel(`expenses-transactions-${currentShiftId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_transactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTransaction = payload.new as ExpenseTransaction
            // Only add if it's an expense transaction (type = 2) and matches current shift
            if (newTransaction.transaction_type === 2 && newTransaction.shift_id === currentShiftId) {
              setData(prev => [newTransaction, ...prev])
              toast.success("New expense added")
              
              // Show browser notification
              const branch = branchLabels[newTransaction.branch_id] || "Unknown"
              const amount = new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(newTransaction.amount)
              showBrowserNotification(
                "New Expense",
                `${branch}: ${amount}`
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTransaction = payload.old as ExpenseTransaction
            if (deletedTransaction.shift_id === currentShiftId) {
              setData(prev => prev.filter(t => t.id !== deletedTransaction.id))
            }
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentShiftId])

  // Filter data based on shift, branch, and expense type
  const filteredData = useMemo(() => {
    let filtered = data
    
    if (shiftFilter !== "all") {
      filtered = filtered.filter(item => item.shift_id === parseInt(shiftFilter))
    }
    
    if (branchFilter !== "all") {
      filtered = filtered.filter(item => item.branch_id === parseInt(branchFilter))
    }
    
    if (expenseTypeFilter !== "all") {
      filtered = filtered.filter(item => item.payment_type === parseInt(expenseTypeFilter))
    }
    
    return filtered
  }, [data, shiftFilter, branchFilter, expenseTypeFilter])

  const columns: ColumnDef<ExpenseTransaction>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
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
      accessorKey: "shift_id",
      header: "Shift ID",
      cell: ({ row }) => <span className="font-mono">{row.getValue("shift_id")}</span>,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Timestamp
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
        const date = new Date(row.getValue("created_at"))
        return (
          <span className="font-mono text-xs">
            {date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })} {date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
        )
      },
    },
    {
      accessorKey: "branch_id",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Branch
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => branchLabels[row.getValue("branch_id") as number] || "Unknown",
    },
    {
      accessorKey: "payment_type",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Expense Type
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="w-3 h-3" />
          ) : (
            <CaretUpDown className="w-3 h-3 text-gray-400" />
          )}
        </button>
      ),
      cell: ({ row }) => expenseTypeLabels[row.getValue("payment_type") as number] || "Unknown",
    },
    {
      accessorKey: "details1",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("details1") as string | null
        return <span className="text-sm">{description || "-"}</span>
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        return <span className="font-mono text-red-600">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isDeleting = deletingId === row.original.id
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              isDeleting ? confirmDelete(row.original) : setDeletingId(row.original.id)
            }}
            data-delete-confirm={isDeleting ? "true" : undefined}
            className={`p-1 transition-colors ${
              isDeleting
                ? "text-emerald-600 hover:text-emerald-700"
                : "text-gray-500 hover:text-red-600"
            }`}
            title={isDeleting ? "Click to confirm delete" : "Delete"}
          >
            {isDeleting ? <Check className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
          </button>
        )
      },
    },
  ]

  const confirmDelete = async (transaction: ExpenseTransaction) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("shift_transactions")
      .delete()
      .eq("id", transaction.id)
    
    if (error) {
      toast.error("Failed to delete expense")
    } else {
      toast.success("Expense deleted successfully")
      setData(prev => prev.filter(t => t.id !== transaction.id))
    }
    setDeletingId(null)
  }

  const table = useReactTable({
    data: filteredData,
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

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-md p-12 text-center">
        <p className="text-gray-400 text-sm tracking-wider">Loading expenses data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Funnel className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-mono text-gray-500 tracking-wider uppercase">Filters:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-500">Shift ID:</label>
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-auto h-9 text-xs font-mono">
              <SelectValue placeholder="All Shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              {shifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id.toString()}>
                  Shift {shift.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-500">Branch:</label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-auto h-9 text-xs font-mono">
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
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-500">Expense Type:</label>
          <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
            <SelectTrigger className="w-auto h-9 text-xs font-mono">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="5">Payroll</SelectItem>
              <SelectItem value="6">Deposit</SelectItem>
              <SelectItem value="7">Repairs</SelectItem>
              <SelectItem value="8">Utilities</SelectItem>
              <SelectItem value="9">Port Fees</SelectItem>
              <SelectItem value="10">Others</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table with scrollbar */}
      <div className="border border-gray-200 rounded-md max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-mono tracking-wider uppercase text-gray-500">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <p className="text-gray-400 text-sm tracking-wider">No expense transactions found</p>
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
          Total: {filteredData.length} expenses
        </div>
      </div>
    </div>
  )
}
