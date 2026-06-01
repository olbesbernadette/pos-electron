"use client"

import { useState, useEffect, useMemo } from "react"
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
import { ArrowUp, ArrowDown, CaretUpDown, Funnel, Copy, X, LockSimpleOpen, CaretDown } from "@phosphor-icons/react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parse } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
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

// Types
interface ShiftTotal {
  id: number
  shift_id: number
  branch_id: number
  transaction_type: number
  payment_type: number
  total_amount: number
  transaction_count: number
  created_at: string
}

interface PaymentBreakdown {
  payment_type: number
  payment_type_name: string
  amount: number
}

interface CheckDetails {
  bank_name: string | null
  check_number: string | null
  check_date: string | null
  check_amount: number | null
}

interface ShiftTransaction {
  id: number
  uuid: string
  shift_id: number
  created_at: string
  branch_id: number
  payment_type: number
  amount: number
  payment_amount: number
  change: number
  status: number
  details1: string | null
  details2: string | null
  check_details?: CheckDetails[]
}

interface ShiftRow {
  shift_id: number
  created_at: string
  closed_at: string | null
  branch_id: number
  branch_name: string
  total: number
  payments: PaymentBreakdown[]
  closed_by: string | null
  expenses: number
  cashDeposit: number
  shift_status: number
}

// Payment type mapping
const paymentTypeLabels: Record<number, string> = {
  1: "Cash",
  2: "GCash",
  3: "Check",
  4: "Credit",
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

// Branch badge colors (light background with opacity, dark muted text, matching border)
const branchBadgeColors: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-cyan-100/50", text: "text-cyan-700", border: "border-cyan-300" },
  2: { bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  3: { bg: "bg-rose-100/50", text: "text-rose-700", border: "border-rose-300" },
  4: { bg: "bg-violet-100/50", text: "text-violet-700", border: "border-violet-300" },
  5: { bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
  6: { bg: "bg-sky-100/50", text: "text-sky-700", border: "border-sky-300" },
}

// Format currency
const formatCurrency = (amount: number) => {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
}

export function ShiftTotalsTable() {
  const [data, setData] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasOpenShift, setHasOpenShift] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  
  // Filter states
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("all")
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogTransactions, setDialogTransactions] = useState<ShiftTransaction[]>([])
  const [dialogSelectedIds, setDialogSelectedIds] = useState<Set<number>>(new Set())
  const [depositAmount, setDepositAmount] = useState<string>("")
  const [depositDate, setDepositDate] = useState<string>("")
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositType, setDepositType] = useState<"cash" | "check" | "gcash">("cash")
  const [depositDateOpen, setDepositDateOpen] = useState(false)
  const [dialogInfo, setDialogInfo] = useState<{
    shiftId: number
    branchName: string
    paymentType: string
    paymentTypeId: number
    branchId: number
    shiftDate: string
  } | null>(null)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      
      // Fetch shift totals (transaction_type = 1 for sales) with shift info for closed_by and status
      const { data: salesTotals, error: salesError } = await supabase
        .from("shift_totals")
        .select("*, shifts(closed_by, end_time, status)")
        .eq("transaction_type", 1)
        .order("created_at", { ascending: false })
      
      // Fetch shift totals (transaction_type = 2 for expenses)
      const { data: expensesTotals } = await supabase
        .from("shift_totals")
        .select("shift_id, branch_id, total_amount")
        .eq("transaction_type", 2)
      
      // Fetch cash deposit totals from shift_deposit_totals (deposit_type = 1 for cash)
      const { data: cashDepositTotals } = await supabase
        .from("shift_deposit_totals")
        .select("shift_id, branch_id, total_amount")
        .eq("deposit_type", 1)
      
      // Create a map of expenses by shift_id + branch_id
      const expensesMap: Record<string, number> = {}
      if (expensesTotals) {
        expensesTotals.forEach(item => {
          const key = `${item.shift_id}-${item.branch_id}`
          expensesMap[key] = (expensesMap[key] || 0) + parseFloat(item.total_amount.toString())
        })
      }
      
      // Create a map of cash deposits by shift_id + branch_id
      const cashDepositsMap: Record<string, number> = {}
      if (cashDepositTotals) {
        cashDepositTotals.forEach(item => {
          const key = `${item.shift_id}-${item.branch_id}`
          cashDepositsMap[key] = parseFloat(item.total_amount.toString())
        })
      }
      
      if (!salesError && salesTotals) {
        // Group by shift_id + branch_id to create one row per shift per branch
        const groupedData = salesTotals.reduce((acc, item) => {
          const key = `${item.shift_id}-${item.branch_id}`
          
          if (!acc[key]) {
            const shifts = item.shifts as { closed_by: string | null; end_time: string | null; status: number | null } | null
            acc[key] = {
              shift_id: item.shift_id,
              created_at: item.created_at,
              closed_at: shifts?.end_time || null,
              branch_id: item.branch_id,
              branch_name: branchLabels[item.branch_id] || "Unknown",
              total: 0,
              payments: [],
              closed_by: shifts?.closed_by || null,
              expenses: expensesMap[key] || 0,
              cashDeposit: cashDepositsMap[key] || 0,
              shift_status: shifts?.status || 2,
            }
          }
          
          const amount = parseFloat(item.total_amount.toString())
          acc[key].total += amount
          acc[key].payments.push({
            payment_type: item.payment_type,
            payment_type_name: paymentTypeLabels[item.payment_type] || "Unknown",
            amount: amount,
          })
          
          return acc
        }, {} as Record<string, ShiftRow>)
        
        const rows = Object.values(groupedData)
        setData(rows)
        // Check if any shift is currently open (status = 1)
        setHasOpenShift(rows.some(row => row.shift_status === 1))
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [])

  // Realtime subscription for shift_deposit_totals updates
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel('shift-deposit-totals-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_deposit_totals',
        },
        (payload) => {
          // Update the cashDeposit value in the data when deposits change
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new as { shift_id: number; branch_id: number; deposit_type: number; total_amount: number }
            if (newData.deposit_type === 1) { // Cash deposit
              setData(prev => prev.map(row => {
                if (row.shift_id === newData.shift_id && row.branch_id === newData.branch_id) {
                  return { ...row, cashDeposit: newData.total_amount }
                }
                return row
              }))
            }
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fetch transactions for dialog
  const fetchTransactions = async (
    shiftId: number,
    branchId: number,
    branchName: string,
    paymentTypeId: number,
    paymentTypeName: string,
    shiftDate: string
  ) => {
    setDialogInfo({
      shiftId,
      branchName,
      paymentType: paymentTypeName,
      paymentTypeId,
      branchId,
      shiftDate,
    })
    setDialogOpen(true)
    setDialogLoading(true)
    setDialogSelectedIds(new Set())
    setDepositAmount("")
    setDepositDate(new Date().toISOString().split('T')[0])
    
    const supabase = createClient()
    
    // If payment type is check (3), include check_details
    const selectQuery = paymentTypeId === 3 
      ? "*, check_details(bank_name, check_number, check_date, check_amount)"
      : "*"
    
    const { data: transactions, error } = await supabase
      .from("shift_transactions")
      .select(selectQuery)
      .eq("shift_id", shiftId)
      .eq("branch_id", branchId)
      .eq("payment_type", paymentTypeId)
      .eq("transaction_type", 1)
      .order("created_at", { ascending: false })
    
    if (!error && transactions) {
      setDialogTransactions(transactions)
    } else {
      setDialogTransactions([])
    }
    
    setDialogLoading(false)
  }

  // Handle deposit
  const handleDeposit = async () => {
    if (!dialogInfo || dialogSelectedIds.size === 0 || !depositAmount || !depositDate) return
    
    setDepositLoading(true)
    
    const supabase = createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get selected transaction IDs (integer IDs, not UUIDs)
    const selectedTransactions = dialogTransactions.filter(t => dialogSelectedIds.has(t.id))
    const transactionIds = selectedTransactions.map(t => t.id)
    
    // Build deposit_transactions array for the RPC
    const depositTransactions = selectedTransactions.map(t => {
      const checkDetail = t.check_details?.[0]
      return {
        payment_type: t.payment_type,
        amount: t.amount,
        details1: checkDetail?.bank_name || null,
        details2: checkDetail?.check_number || null,
      }
    })
    
    // Map deposit type to integer (1 = cash, 2 = check, 3 = gcash)
    const depositTypeInt = depositType === "cash" ? 1 : depositType === "check" ? 2 : 3
    
    const { data, error } = await supabase.rpc("create_deposit", {
      p_transaction_ids: transactionIds,
      p_deposit_date: depositDate,
      p_deposit_type: depositTypeInt,
      p_total_amount: parseFloat(depositAmount),
      p_deposit_transactions: depositTransactions,
      p_notes: `Deposit for ${dialogInfo.branchName} - ${dialogInfo.paymentType}`,
      p_created_by: user?.id || null,
      p_shift_id: dialogInfo.shiftId,
      p_branch_id: dialogInfo.branchId
    })
    
    if (error) {
      toast.error(error.message || "Failed to create deposit")
      setDepositLoading(false)
      return
    }
    
    if (data) {
      toast.success(`Deposit created successfully for ${selectedTransactions.length} transaction(s)`)
      
      // Refresh the transactions list
      await fetchTransactions(
        dialogInfo.shiftId,
        dialogInfo.branchId,
        dialogInfo.branchName,
        dialogInfo.paymentTypeId,
        dialogInfo.paymentType,
        dialogInfo.shiftDate
      )
      
      // Reset selection and deposit fields
      setDialogSelectedIds(new Set())
      setDepositAmount("")
      setDepositType("cash")
    }
    
    setDepositLoading(false)
  }

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = data
    
    if (branchFilter !== "all") {
      filtered = filtered.filter(item => item.branch_id === parseInt(branchFilter))
    }
    
    if (dateFilter) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.created_at).toISOString().split('T')[0]
        return itemDate === dateFilter
      })
    }
    
    if (paymentTypeFilter !== "all") {
      const paymentTypeInt = parseInt(paymentTypeFilter)
      filtered = filtered.filter(item => 
        item.payments.some(p => p.payment_type === paymentTypeInt && p.amount > 0)
      )
    }
    
    return filtered
  }, [data, branchFilter, dateFilter, paymentTypeFilter])

  const columns: ColumnDef<ShiftRow>[] = [
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
      accessorKey: "shift_id",
      header: "Shift No.",
      cell: ({ row }) => {
        const shiftId = row.getValue("shift_id") as number
        const handleCopy = () => {
          navigator.clipboard.writeText(shiftId.toString())
          toast.success("Shift number copied")
        }
        return (
          <div className="inline-flex items-stretch border border-gray-200 rounded-md h-8">
            <span className="font-mono text-sm px-2 flex items-center">{shiftId}</span>
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
      accessorKey: "created_at",
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
        const date = new Date(row.getValue("created_at"))
        const closedAt = row.original.closed_at ? new Date(row.original.closed_at) : null
        const branchId = row.original.branch_id
        const branchName = row.original.branch_name
        const badgeColors = branchBadgeColors[branchId] || { bg: "bg-gray-100/50", text: "text-gray-700", border: "border-gray-300" }
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
                timeZone: "Asia/Manila",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Closing Time */}
            <div className="px-3 py-2 font-mono text-xs text-gray-400">
              {closedAt 
                ? `Closed ${closedAt.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}`
                : "Open"
              }
            </div>
          </div>
        )
      },
    },
    {
      id: "breakdown",
      accessorKey: "branch_name",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Breakdown
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
        const payments = row.original.payments
        const shiftId = row.original.shift_id
        const branchId = row.original.branch_id
        const branchName = row.original.branch_name
        const shiftDate = row.original.created_at
        const total = row.original.total
        const handleCopy = () => {
          navigator.clipboard.writeText(total.toString())
          toast.success("Total amount copied")
        }
        return (
          <div>
            {/* Payment cards */}
            <div className="flex flex-col gap-1">
              {payments
                .sort((a, b) => a.payment_type - b.payment_type)
                .map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => fetchTransactions(shiftId, branchId, branchName, item.payment_type, item.payment_type_name, shiftDate)}
                  className="flex items-center justify-between w-full px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer text-left"
                >
                  <span className="text-xs font-mono text-gray-600">
                    {item.payment_type_name}
                  </span>
                  <span className="text-xs font-mono font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </button>
              ))}
            </div>
            {/* Total card */}
            <div className="flex items-stretch border border-gray-200 rounded-md h-8 w-full mt-2">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider px-3 flex items-center">Total</span>
              <div className="w-px bg-gray-200" />
              <span className="font-mono text-sm px-3 flex items-center flex-1 font-medium">{formatCurrency(total)}</span>
              <div className="w-px bg-gray-200" />
              <button
                onClick={handleCopy}
                className="px-3 flex items-center hover:bg-gray-50 transition-colors rounded-r-md"
                title="Copy total amount"
              >
                <Copy className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        )
      },
    },
    {
      id: "cash_recon",
      header: "Cash Recon",
      cell: ({ row }) => {
        // Get cash sales from payments (payment_type = 1 is Cash)
        const cashPayment = row.original.payments.find(p => p.payment_type === 1)
        const cashSales = cashPayment?.amount || 0
        
        // Get expenses from the row data
        const expenses = row.original.expenses || 0
        
        // Get cash deposit from the row data
        const cashDeposit = row.original.cashDeposit || 0
        const difference = cashSales - expenses - cashDeposit
        const isOver = difference < 0
        const isDeficit = difference > 0
        const isBalanced = difference === 0
        
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            {/* Cash Sales */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Cash Sales</span>
              <span className="text-sm font-mono font-medium">{formatCurrency(cashSales)}</span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Expenses */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Expenses</span>
              <span className="text-sm font-mono font-medium">{formatCurrency(expenses)}</span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Cash Deposit */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Cash Deposit</span>
              <span className="text-sm font-mono font-medium">{formatCurrency(cashDeposit)}</span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Over or Deficit Badge */}
            <div className="px-3 py-2">
              {isBalanced ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100/50 text-gray-700 border-gray-300">
                  Balanced
                </span>
              ) : isOver ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-100/50 text-emerald-700 border-emerald-300">
                  Over {formatCurrency(Math.abs(difference))}
                </span>
              ) : isDeficit ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-rose-100/50 text-rose-700 border-rose-300">
                  Deficit {formatCurrency(Math.abs(difference))}
                </span>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "closed_by",
      header: "Shift By",
      cell: ({ row }) => {
        const closedBy = row.getValue("closed_by") as string | null
        return (
          <span className="font-mono text-xs text-gray-600">
            {closedBy || "-"}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isOpen = row.original.shift_status === 1
        const canReopen = !hasOpenShift && !isOpen
        
        const handleReopen = async () => {
          const supabase = createClient()
          
          const shiftId = row.original.shift_id

          // Double-check no open shift exists before reopening
          const { data: openShifts } = await supabase
            .from("shifts")
            .select("id")
            .eq("status", 1)
            .limit(1)
          
          if (openShifts && openShifts.length > 0) {
            toast.error("Cannot reopen: Another shift is currently open")
            setHasOpenShift(true)
            return
          }

          // Check if any transactions for this shift have been deposited
          const { data: depositedTxns, error: depositCheckError } = await supabase
            .from("shift_transactions")
            .select("id")
            .eq("shift_id", shiftId)
            .not("deposit_id", "is", null)
            .limit(1)

          if (depositCheckError) {
            toast.error("Failed to verify deposit status")
            return
          }

          if (depositedTxns && depositedTxns.length > 0) {
            toast.warning("Cannot reopen: This shift has deposited transactions. Please undeposit first to reopen.")
            return
          }

          // Update the shift status to 1 (open)
          const { error: shiftError } = await supabase
            .from("shifts")
            .update({ status: 1, end_time: null, closed_by: null, closed_by_user: null })
            .eq("id", shiftId)
          
          if (shiftError) {
            toast.error("Failed to reopen shift")
            return
          }

          // Delete all shift_totals rows for this shift
          const { error: totalsError } = await supabase
            .from("shift_totals")
            .delete()
            .eq("shift_id", shiftId)

          if (totalsError) {
            toast.error("Shift reopened but failed to clear shift totals")
            return
          }
          
          // Remove from local table and update open shift state
          setData(prev => prev.filter(r => r.shift_id !== shiftId))
          setHasOpenShift(true)
          toast.success(`Shift #${shiftId} reopened and totals cleared`)
        }
        
        if (isOpen) {
          return (
            <span className="text-xs font-mono text-gray-400">Open</span>
          )
        }
        
        return (
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-mono flex items-center gap-1.5 px-2.5 rounded-sm"
            onClick={handleReopen}
            disabled={!canReopen}
            title={!canReopen ? "Another shift is currently open" : "Reopen this shift"}
          >
            <LockSimpleOpen className="w-3.5 h-3.5" />
            Reopen
          </Button>
        )
      },
    },
  ]

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
      <div className="border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm tracking-wider">Loading shift totals...</p>
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
          <label className="text-xs font-mono text-gray-500">Date:</label>
          <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-9 px-3 text-xs font-mono border border-gray-200 rounded-md text-left flex items-center gap-2 focus:outline-none focus:border-black transition-colors min-w-[140px]"
              >
                <span className={dateFilter ? "text-black" : "text-gray-400"}>
                  {dateFilter ? format(parse(dateFilter, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Pick a date"}
                </span>
                <CaretDown className="w-3 h-3 text-gray-400 ml-auto" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter ? parse(dateFilter, "yyyy-MM-dd", new Date()) : undefined}
                onSelect={(date) => {
                  setDateFilter(date ? format(date, "yyyy-MM-dd") : "")
                  setDateFilterOpen(false)
                }}
                defaultMonth={dateFilter ? parse(dateFilter, "yyyy-MM-dd", new Date()) : undefined}
              />
            </PopoverContent>
          </Popover>
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs font-mono text-gray-500 hover:text-black"
            >
              Clear
            </button>
          )}
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
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="1">Cash</SelectItem>
              <SelectItem value="2">GCash</SelectItem>
              <SelectItem value="3">Check</SelectItem>
              <SelectItem value="4">Credit</SelectItem>
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: string } | undefined
                    const alignClass = meta?.align === "bottom" ? "align-bottom" : "align-top"
                    return (
                      <TableCell key={cell.id} className={`text-sm ${alignClass} py-4`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <p className="text-gray-400 text-sm tracking-wider">No shift totals found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-500">
          {table.getFilteredSelectedRowModel().rows.length} of {filteredData.length} row(s) selected
        </div>
        <div className="text-xs font-mono text-gray-500">
          Grand Total: {formatCurrency(filteredData.reduce((sum, row) => sum + row.total, 0))}
        </div>
      </div>

      {/* Transactions Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Transactions
            </DialogTitle>
            {dialogInfo && (
              <div className="flex flex-col border border-gray-200 rounded-md mt-3">
                {/* Branch */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Branch</span>
                  <span className="text-sm font-medium">{dialogInfo.branchName}</span>
                </div>
                <div className="mx-3 h-px bg-gray-200" />
                {/* Payment Type */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Payment Type</span>
                  <span className="text-sm font-medium">{dialogInfo.paymentType}</span>
                </div>
                <div className="mx-3 h-px bg-gray-200" />
                {/* Shift Date */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Shift Date</span>
                  <span className="text-sm font-mono">
                    {new Date(dialogInfo.shiftDate).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>
          
          {/* Breakdown Section */}
          <div className="mt-4">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Breakdown</span>
          </div>
          
          <div className={`border border-gray-200 rounded-md mt-2 ${dialogTransactions.length > 10 ? "max-h-[400px] overflow-y-auto" : ""}`}>
            {dialogLoading ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm tracking-wider">Loading transactions...</p>
              </div>
            ) : dialogTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm tracking-wider">No transactions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={dialogTransactions.length > 0 && dialogSelectedIds.size === dialogTransactions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDialogSelectedIds(new Set(dialogTransactions.map(t => t.id)))
                          } else {
                            setDialogSelectedIds(new Set())
                          }
                        }}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Time</TableHead>
                    <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Amount</TableHead>
                    <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Status</TableHead>
                    {dialogInfo?.paymentTypeId === 3 ? (
                      <>
                        <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Bank / Check No.</TableHead>
                        <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Check Date</TableHead>
                        <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500">Check Amount</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-xs font-mono tracking-wider uppercase text-gray-500" colSpan={2}>More Details</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogTransactions.map((transaction) => {
                    const checkDetail = transaction.check_details?.[0]
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <Checkbox
                            checked={dialogSelectedIds.has(transaction.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(dialogSelectedIds)
                              if (checked) {
                                newSet.add(transaction.id)
                              } else {
                                newSet.delete(transaction.id)
                              }
                              setDialogSelectedIds(newSet)
                            }}
                            aria-label="Select row"
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {new Date(transaction.created_at).toLocaleTimeString("en-PH", {
                            timeZone: "Asia/Manila",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const statusInfo = statusLabels[transaction.status] || { label: "Unknown", bg: "bg-gray-100/50", text: "text-gray-700", border: "border-gray-300" }
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                                {statusInfo.label}
                              </span>
                            )
                          })()}
                        </TableCell>
                        {dialogInfo?.paymentTypeId === 3 ? (
                          <>
                            <TableCell className="text-xs font-mono text-gray-600">
                              <div className="flex flex-col">
                                <span>{checkDetail?.bank_name || "-"}</span>
                                <span className="text-gray-400">{checkDetail?.check_number || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-600">
                              {checkDetail?.check_date 
                                ? new Date(checkDetail.check_date).toLocaleDateString("en-PH", {
                                    timeZone: "Asia/Manila",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "-"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-600">
                              {checkDetail?.check_amount ? formatCurrency(checkDetail.check_amount) : "-"}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-xs font-mono text-gray-600">
                              {transaction.details1 || "-"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-600">
                              {transaction.details2 || "-"}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
            <span className="text-xs font-mono text-gray-500">
              {dialogSelectedIds.size} of {dialogTransactions.length} transaction(s) selected
            </span>
            <span className="text-sm font-mono font-medium">
              Total: {formatCurrency(dialogTransactions.reduce((sum, t) => sum + t.amount, 0))}
            </span>
          </div>

          {/* Deposit Section - shown when at least one row is selected */}
          {dialogSelectedIds.size > 0 && (
            <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
              {/* Deposit Type Selection */}
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-xs font-mono text-primary uppercase tracking-wider">Deposit Type</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositType("cash")}
                    className={`flex flex-col items-center justify-center p-4 border transition-all ${
                      depositType === "cash"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xs font-mono tracking-wider">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositType("check")}
                    className={`flex flex-col items-center justify-center p-4 border transition-all ${
                      depositType === "check"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xs font-mono tracking-wider">Check</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositType("gcash")}
                    className={`flex flex-col items-center justify-center p-4 border transition-all ${
                      depositType === "gcash"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xs font-mono tracking-wider">GCash</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-xs font-mono text-primary uppercase tracking-wider">Deposit Date</label>
                <Popover open={depositDateOpen} onOpenChange={setDepositDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 px-3 text-sm font-mono border border-gray-200 rounded-md text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"
                    >
                      <span className={depositDate ? "text-black" : "text-gray-400"}>
                        {depositDate ? format(parse(depositDate, "yyyy-MM-dd", new Date()), "PPP") : "Pick a date"}
                      </span>
                      <CaretDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={depositDate ? parse(depositDate, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => {
                        setDepositDate(date ? format(date, "yyyy-MM-dd") : "")
                        setDepositDateOpen(false)
                      }}
                      defaultMonth={depositDate ? parse(depositDate, "yyyy-MM-dd", new Date()) : undefined}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-xs font-mono text-primary uppercase tracking-wider">Deposit Amount</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9 px-3 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black"
                />
              </div>
              <Button
                className="w-full h-10"
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || !depositDate || depositLoading}
                onClick={handleDeposit}
              >
                {depositLoading ? "Processing..." : "Deposit"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
