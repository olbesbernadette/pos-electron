"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
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
import { ArrowUp, ArrowDown, Trash, CaretUpDown, Funnel, Check, Play, Stop } from "@phosphor-icons/react"
import { useShift } from "@/contexts/shift-context"
import { useAuth } from "@/contexts/auth-context"
import { CloseShiftDialog } from "@/components/close-shift-dialog"
import { Button } from "@/components/ui/button"
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
interface SalesTransaction {
  id: number
  shift_id: number
  created_at: string
  branch_id: number
  payment_type: number
  amount: number
  payment_amount: number
  change: number
  status: number
  customer_id: number | null
}

interface Branch {
  id: number
  name: string
}

interface Shift {
  id: number
}

// Status mapping (light background with opacity, dark muted text, matching border)
const statusLabels: Record<number, { label: string; bg: string; text: string; border: string }> = {
  1: { label: "Undeposited", bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  2: { label: "Deposited", bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
  3: { label: "Receivable", bg: "bg-sky-100/50", text: "text-sky-700", border: "border-sky-300" },
}

// Payment type mapping
const paymentTypeLabels: Record<number, string> = {
  1: "Cash",
  2: "GCash",
  3: "Check",
  4: "Credit",
}

// Currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
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

export function SalesDataTable() {
  const { user } = useAuth()
  const { hasOpenShift, isLoading: shiftLoading, openShift, refreshShift, currentShiftId, showCloseShiftDialog, setShowCloseShiftDialog } = useShift()
  
  const [data, setData] = useState<SalesTransaction[]>([])
  const [customerNames, setCustomerNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  
  // Filter states
  const [shiftFilter, setShiftFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("all")
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

  // Fetch data - only show transactions from open shift
  useEffect(() => {
    const fetchData = async () => {
      if (!currentShiftId) {
        setData([])
        setShifts([])
        setLoading(false)
        return
      }
      
      const supabase = createClient()
      
      // Fetch transactions (transaction_type = 1 for sales) from open shift only
      const { data: transactions, error } = await supabase
        .from("shift_transactions")
        .select("*")
        .eq("transaction_type", 1)
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

  // Fetch customer names for lookup (used to append customer to Payment Type column)
  useEffect(() => {
    const fetchCustomers = async () => {
      const supabase = createClient()
      const { data: customers, error } = await supabase
        .from("customers")
        .select("id, customer_name")

      if (!error && customers) {
        const map: Record<number, string> = {}
        for (const c of customers) {
          map[c.id] = c.customer_name
        }
        setCustomerNames(map)
      }
    }

    fetchCustomers()
  }, [])

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
        tag: "jbj-transaction",
      })
      
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)
      
      // Focus window when notification is clicked
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
      .channel(`sales-transactions-${currentShiftId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_transactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTransaction = payload.new as SalesTransaction
            // Only add if it's a sales transaction (type = 1) and matches current shift
            if (newTransaction.transaction_type === 1 && newTransaction.shift_id === currentShiftId) {
              setData(prev => [newTransaction, ...prev])
              toast.success("New transaction added")
              
              // Show browser notification
              const branch = branchLabels[newTransaction.branch_id] || "Unknown"
              const amount = formatCurrency(newTransaction.amount)
              showBrowserNotification(
                "New Transaction",
                `${branch}: ${amount}`
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTransaction = payload.old as SalesTransaction
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

  // Filter data based on shift, status, branch, and payment type
  const filteredData = useMemo(() => {
    let filtered = data
    
    if (shiftFilter !== "all") {
      filtered = filtered.filter(item => item.shift_id === parseInt(shiftFilter))
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === parseInt(statusFilter))
    }
    
    if (branchFilter !== "all") {
      filtered = filtered.filter(item => item.branch_id === parseInt(branchFilter))
    }
    
    if (paymentTypeFilter !== "all") {
      filtered = filtered.filter(item => item.payment_type === parseInt(paymentTypeFilter))
    }
    
    return filtered
  }, [data, shiftFilter, statusFilter, branchFilter, paymentTypeFilter])

  const columns: ColumnDef<SalesTransaction>[] = [
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
          Payment Type
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
        const label = paymentTypeLabels[row.getValue("payment_type") as number] || "Unknown"
        const customerId = row.original.customer_id
        const customerName = customerId ? customerNames[customerId] : null
        return customerName ? `${label} - ${customerName}` : label
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        return <span className="font-mono">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      },
    },
    {
      accessorKey: "payment_amount",
      header: "Payment",
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("payment_amount"))
        return <span className="font-mono">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      },
    },
    {
      accessorKey: "change",
      header: "Change",
      cell: ({ row }) => {
        const change = parseFloat(row.getValue("change"))
        return <span className="font-mono">₱{change.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as number
        const statusInfo = statusLabels[status] || { label: "Unknown", bg: "bg-gray-100/50", text: "text-gray-700", border: "border-gray-300" }
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
            {statusInfo.label}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const status = row.original.status
        const isDeposited = status === 2
        const isDeleting = deletingId === row.original.id
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              isDeleting ? confirmDelete(row.original) : setDeletingId(row.original.id)
            }}
            disabled={isDeposited}
            data-delete-confirm={isDeleting ? "true" : undefined}
            className={`p-1 transition-colors ${
              isDeposited 
                ? "text-gray-300 cursor-not-allowed" 
                : isDeleting
                  ? "text-emerald-600 hover:text-emerald-700"
                  : "text-gray-500 hover:text-red-600"
            }`}
            title={isDeposited ? "Cannot delete deposited transaction" : isDeleting ? "Click to confirm delete" : "Delete"}
          >
            {isDeleting ? <Check className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
          </button>
        )
      },
    },
  ]

  const confirmDelete = async (transaction: SalesTransaction) => {
    if (transaction.status === 2) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("shift_transactions")
      .delete()
      .eq("id", transaction.id)
    
    if (error) {
      toast.error("Failed to delete transaction")
    } else {
      toast.success("Transaction deleted successfully")
      setData(prev => prev.filter(t => t.id !== transaction.id))
    }
    setDeletingId(null)
  }

  const handleShiftToggle = async () => {
    const userEmail = user?.email || "unknown"
    const userId = user?.id || ""

    if (hasOpenShift) {
      setShowCloseShiftDialog(true)
    } else {
      await openShift(userEmail, userId)
    }
  }

  const handleShiftClosed = () => {
    refreshShift()
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

  // Calculate selected rows total using table's selected row model
  const selectedRows = table.getSelectedRowModel().rows
  const selectedTotal = selectedRows.reduce((sum, row) => sum + (row.original.amount || 0), 0)
  const hasSelectedRows = selectedRows.length > 0

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-md p-12 text-center">
        <p className="text-gray-400 text-sm tracking-wider">Loading sales data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
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
          <label className="text-xs font-mono text-gray-500">Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto h-9 text-xs font-mono">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="1">Undeposited</SelectItem>
              <SelectItem value="2">Deposited</SelectItem>
              <SelectItem value="3">Receivable</SelectItem>
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
          <label className="text-xs font-mono text-gray-500">Payment:</label>
          <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
            <SelectTrigger className="w-auto h-9 text-xs font-mono">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="1">Cash</SelectItem>
              <SelectItem value="2">GCash</SelectItem>
              <SelectItem value="3">Check</SelectItem>
              <SelectItem value="4">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Shift Button - rightmost */}
        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={handleShiftToggle}
            disabled={shiftLoading}
            className={`text-xs font-medium tracking-widest uppercase px-6 transition-all duration-300 hover:scale-105 flex items-center gap-2 ${
              hasOpenShift
                ? "border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent"
                : "border-black text-black hover:bg-black hover:text-white bg-transparent"
            }`}
          >
            {shiftLoading ? (
              <span>Loading...</span>
            ) : hasSelectedRows ? (
              <>
                {hasOpenShift ? <Stop className="w-4 h-4" weight="fill" /> : <Play className="w-4 h-4" weight="fill" />}
                {formatCurrency(selectedTotal)}
              </>
            ) : hasOpenShift ? (
              <>
                <Stop className="w-4 h-4" weight="fill" />
                Close Shift
              </>
            ) : (
              <>
                <Play className="w-4 h-4" weight="fill" />
                New Shift
              </>
            )}
          </Button>
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
                  <p className="text-gray-400 text-sm tracking-wider">No sales transactions found</p>
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
          Total: {filteredData.length} transactions
        </div>
      </div>
      
      {/* Close Shift Dialog */}
      <CloseShiftDialog
        isOpen={showCloseShiftDialog}
        onClose={() => setShowCloseShiftDialog(false)}
        shiftId={currentShiftId}
        onShiftClosed={handleShiftClosed}
        userEmail={user?.email || "unknown"}
        userId={user?.id || ""}
      />
    </div>
  )
}
