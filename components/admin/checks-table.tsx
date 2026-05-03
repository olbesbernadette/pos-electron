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
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, CaretUpDown, Funnel, Bank, Trash, CaretDown, Copy } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parse, differenceInDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"

// Branch badge colors (matching other tables)
const branchBadgeColors: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-cyan-100/50", text: "text-cyan-700", border: "border-cyan-300" },
  2: { bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  3: { bg: "bg-rose-100/50", text: "text-rose-700", border: "border-rose-300" },
  4: { bg: "bg-violet-100/50", text: "text-violet-700", border: "border-violet-300" },
  5: { bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
  6: { bg: "bg-sky-100/50", text: "text-sky-700", border: "border-sky-300" },
}

const branchLabels: Record<number, string> = {
  1: "Hardware",
  2: "Pawa Gas",
  3: "Matnog Gas",
  4: "Gotis Hotel",
  5: "Rental",
  6: "Boarders",
}

// Status badge colors
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: "bg-gray-100/50", text: "text-gray-700", border: "border-gray-300" },
  due_today: { bg: "bg-orange-100/50", text: "text-orange-700", border: "border-orange-300" },
  due_tomorrow: { bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  overdue: { bg: "bg-red-100/50", text: "text-red-700", border: "border-red-300" },
  deposited: { bg: "bg-green-100/50", text: "text-green-700", border: "border-green-300" },
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  due_today: "Due Today",
  due_tomorrow: "Due Tomorrow",
  overdue: "Overdue",
  deposited: "Deposited",
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

// Resolve display status: deposited takes priority, otherwise derive from check date
const resolveCheckStatus = (transactionStatus: number, checkDate: string | null): string => {
  if (transactionStatus === 2) return "deposited"
  if (!checkDate) return "pending"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDateObj = new Date(checkDate)
  checkDateObj.setHours(0, 0, 0, 0)

  const daysDiff = differenceInDays(checkDateObj, today)
  if (daysDiff < 0) return "overdue"
  if (daysDiff === 0) return "due_today"
  if (daysDiff === 1) return "due_tomorrow"
  return "pending"
}

interface CheckRow {
  id: number
  transaction_date: string
  branch_id: number
  branch_name: string
  transaction_id: number
  shift_id: number
  bank_name: string
  check_number: string
  check_date: string
  amount: number
  transaction_status: number
  status: string
  created_at: string
}


export function ChecksTable() {
  const [data, setData] = useState<CheckRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})
  
  // Filter states
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>("")
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [checkToDelete, setCheckToDelete] = useState<CheckRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Deposit dialog state
  const [depositDialogOpen, setDepositDialogOpen] = useState(false)
  const [depositDate, setDepositDate] = useState<Date | undefined>(undefined)
  const [depositDatePickerOpen, setDepositDatePickerOpen] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)

  useEffect(() => {
    const fetchChecks = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data: rows, error } = await supabase.rpc("get_check_transactions", {
        p_branch_id: branchFilter !== "all" ? parseInt(branchFilter) : null,
        p_date: dateFilter || null,
      })
      if (error) {
        console.error("get_check_transactions error:", error)
        toast.error(error.message || "Failed to fetch checks")
      } else if (rows) {
        setData(
          rows.map((row: any) => ({
            ...row,
            status: resolveCheckStatus(row.transaction_status, row.check_date),
          }))
        )
      }
      setIsLoading(false)
    }
    fetchChecks()
  }, [branchFilter, dateFilter])

  // Branch and date filters are applied server-side via RPC.
  // Only status filter is applied client-side.
  const filteredData = useMemo(() => {
    if (statusFilter.length === 0) return data
    return data.filter(item => statusFilter.includes(item.status))
  }, [data, statusFilter])

  const handleDelete = (check: CheckRow) => {
    setCheckToDelete(check)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!checkToDelete) return
    setIsDeleting(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc("delete_check_transaction", {
      p_transaction_id: checkToDelete.id,
    })
    setIsDeleting(false)
    if (error || data?.success === false) {
      console.error("delete_check_transaction error:", error, data)
      toast.error(data?.error ?? error?.message ?? "Failed to delete check transaction")
      return
    }
    setData(prev => prev.filter(row => row.id !== checkToDelete.id))
    toast.success(`Check ${checkToDelete.check_number} deleted`)
    setDeleteDialogOpen(false)
    setCheckToDelete(null)
  }

  const columns: ColumnDef<CheckRow>[] = [
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
      accessorKey: "transaction_date",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Transaction Date
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
        const transactionDate = new Date(row.getValue("transaction_date"))
        const shiftId = row.original.shift_id
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            <div className="px-3 py-2 font-mono text-sm">
              {transactionDate.toLocaleDateString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            <div className="px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 tracking-wider">Shift</span>
              <span className="font-mono text-sm font-medium">#{shiftId}</span>
            </div>
          </div>
        )
      },
    },
    {
      id: "transaction_info",
      header: "Transaction Info",
      cell: ({ row }) => {
        const branchId = row.original.branch_id
        const branchName = row.original.branch_name
        const transactionId = row.original.transaction_id
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
            {/* Transaction ID */}
            <div className="px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 tracking-wider">TXN ID</span>
              <span className="font-mono text-sm font-medium">#{transactionId}</span>
            </div>
          </div>
        )
      },
    },
    {
      id: "check_info",
      header: "Check Info",
      cell: ({ row }) => {
        const bankName = row.original.bank_name
        const checkNumber = row.original.check_number
        const checkDate = new Date(row.original.check_date)
        
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            {/* Bank Name */}
            <div className="px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 tracking-wider">Bank</span>
              <span className="font-mono text-sm">{bankName}</span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Check Number */}
            <div className="px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 tracking-wider">Check #</span>
              <span className="font-mono text-sm font-medium">{checkNumber}</span>
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Check Date */}
            <div className="px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 tracking-wider">Date</span>
              <span className="font-mono text-sm">
                {checkDate.toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
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
        const amount = row.getValue("amount") as number
        const handleCopy = () => {
          navigator.clipboard.writeText(amount.toString())
          toast.success("Amount copied")
        }
        return (
          <div className="inline-flex items-stretch border border-gray-200 rounded-md">
            <span className="font-mono text-sm font-medium px-3 py-2">{formatCurrency(amount)}</span>
            <div className="w-px bg-gray-200" />
            <button
              onClick={handleCopy}
              className="px-2 flex items-center hover:bg-gray-50 transition-colors rounded-r-md"
              title="Copy amount"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
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
        const status = row.getValue("status") as string
        const colors = statusColors[status] || statusColors.pending
        const label = statusLabels[status] || status
        
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
            {label}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 px-3"
              onClick={() => handleDelete(row.original)}
            >
              <Trash className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
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
    state: {
      sorting,
      rowSelection,
    },
  })

  const openDepositDialog = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const uniqueBranches = new Set(selectedRows.map(r => r.original.branch_id))
    if (uniqueBranches.size > 1) {
      toast.error("All selected checks must be from the same branch.")
      return
    }
    const uniqueShifts = new Set(selectedRows.map(r => r.original.shift_id))
    if (uniqueShifts.size > 1) {
      toast.error("All selected checks must be from the same shift.")
      return
    }
    setDepositDate(undefined)
    setDepositDialogOpen(true)
  }

  const confirmDeposit = async () => {
    if (!depositDate) return
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) return

    setIsDepositing(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const transactionIds = selectedRows.map(r => r.original.id)
    const totalAmount = selectedRows.reduce((sum, r) => sum + r.original.amount, 0)

    const branchNames = [...new Set(selectedRows.map(r => r.original.branch_name))]
    const branchIds = [...new Set(selectedRows.map(r => r.original.branch_id))]
    const branchLabel = branchNames.length === 1 ? branchNames[0] : "Multiple Branches"
    const branchId = branchIds.length === 1 ? branchIds[0] : null

    const depositTransactions = selectedRows.map(r => ({
      payment_type: 3,
      amount: r.original.amount,
      details1: r.original.bank_name,
      details2: r.original.check_number,
    }))

    const { error } = await supabase.rpc("create_deposit", {
      p_transaction_ids: transactionIds,
      p_deposit_date: format(depositDate, "yyyy-MM-dd"),
      p_deposit_type: 2,
      p_total_amount: totalAmount,
      p_deposit_transactions: depositTransactions,
      p_notes: `Deposit for ${branchLabel} - Check`,
      p_created_by: user?.id ?? null,
      p_shift_id: selectedRows[0].original.shift_id,
      p_branch_id: branchId,
    })

    setIsDepositing(false)

    if (error) {
      toast.error(error.message || "Failed to create deposit")
      return
    }

    setData(prev =>
      prev.map(row =>
        transactionIds.includes(row.id)
          ? { ...row, transaction_status: 2, status: "deposited" }
          : row
      )
    )
    toast.success(`${transactionIds.length} check(s) deposited successfully`)
    setDepositDialogOpen(false)
    table.resetRowSelection()
  }

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
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-500">Status:</label>
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-fit min-w-[140px] items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-xs font-mono whitespace-nowrap shadow-none transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
              >
                <span className="text-sm flex-1 truncate">
                  {statusFilter.length === 0
                    ? <span className="text-muted-foreground">All Statuses</span>
                    : statusFilter.length === 1
                    ? ({ pending: "Pending", due_today: "Due Today", due_tomorrow: "Due Tomorrow", overdue: "Overdue", deposited: "Deposited" }[statusFilter[0]] ?? statusFilter[0])
                    : `${statusFilter.length} selected`}
                </span>
                <CaretDown className="size-4 opacity-50 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-auto p-1"
            >
              {[
                { value: "pending", label: "Pending" },
                { value: "due_today", label: "Due Today" },
                { value: "due_tomorrow", label: "Due Tomorrow" },
                { value: "overdue", label: "Overdue" },
                { value: "deposited", label: "Deposited" },
              ].map(({ value, label }) => {
                const selected = statusFilter.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() =>
                      setStatusFilter(prev =>
                        prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
                      )
                    }
                    className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-accent"
                  >
                    <span className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-foreground border-foreground" : "border-input"}`}>
                      {selected && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-current text-background">
                          <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                )
              })}
              {statusFilter.length > 0 && (
                <>
                  <div className="bg-border -mx-1 my-1 h-px" />
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => { setStatusFilter([]); setStatusFilterOpen(false) }}
                    className="focus:bg-accent focus:text-accent-foreground text-muted-foreground relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Clear all
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Date Filter */}
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

        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-xs flex items-center gap-1.5 px-3"
            onClick={openDepositDialog}
          >
            <Bank className="w-3.5 h-3.5" />
            Deposit ({table.getFilteredSelectedRowModel().rows.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400 font-mono text-sm">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm py-4 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">
                  No checks found
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
          Total: {filteredData.length} checks
        </div>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deposit Checks</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="p-3 bg-gray-50 rounded-md space-y-1 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Selected</span>
                <span className="font-medium">{table.getFilteredSelectedRowModel().rows.length} check(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-medium">
                  {formatCurrency(
                    table.getFilteredSelectedRowModel().rows.reduce((sum, r) => sum + r.original.amount, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Notes</span>
                <span className="font-medium text-right text-xs leading-snug max-w-[180px]">
                  {(() => {
                    const rows = table.getFilteredSelectedRowModel().rows
                    const names = [...new Set(rows.map(r => r.original.branch_name))]
                    return `Deposit for ${names.length === 1 ? names[0] : "Multiple Branches"} - Check`
                  })()}
                </span>
              </div>
            </div>

            {/* Deposit Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-500">Deposit Date <span className="text-red-500">*</span></label>
              <Popover open={depositDatePickerOpen} onOpenChange={setDepositDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-9 px-3 text-xs font-mono border border-gray-200 rounded-md text-left flex items-center gap-2 focus:outline-none focus:border-black transition-colors"
                  >
                    <span className={depositDate ? "text-black" : "text-gray-400"}>
                      {depositDate ? format(depositDate, "MMM d, yyyy") : "Pick a date"}
                    </span>
                    <CaretDown className="w-3 h-3 text-gray-400 ml-auto" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={depositDate}
                    onSelect={(date) => {
                      setDepositDate(date)
                      setDepositDatePickerOpen(false)
                    }}
                    defaultMonth={depositDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDepositDialogOpen(false)} disabled={isDepositing}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmDeposit} disabled={!depositDate || isDepositing}>
              {isDepositing ? "Depositing..." : "Confirm Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Check</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this check record? This action cannot be undone.
              {checkToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md font-mono text-sm">
                  <div>Bank: {checkToDelete.bank_name}</div>
                  <div>Check #: {checkToDelete.check_number}</div>
                  <div>Amount: {formatCurrency(checkToDelete.amount)}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
