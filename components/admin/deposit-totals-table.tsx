"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { ArrowUp, ArrowDown, CaretUpDown, Funnel, Copy, Trash, CaretDown } from "@phosphor-icons/react"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parse } from "date-fns"

// Branch badge colors (matching expenses table)
const branchBadgeColors: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-cyan-100/50", text: "text-cyan-700", border: "border-cyan-300" },
  2: { bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  3: { bg: "bg-rose-100/50", text: "text-rose-700", border: "border-rose-300" },
  4: { bg: "bg-violet-100/50", text: "text-violet-700", border: "border-violet-300" },
  5: { bg: "bg-emerald-100/50", text: "text-emerald-700", border: "border-emerald-300" },
}

const branchLabels: Record<number, string> = {
  1: "Hardware",
  2: "Pawa Gas",
  3: "Matnog Gas",
  4: "Gotis Hotel",
  5: "Bulan Hotel",
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

interface DepositTransaction {
  payment_type: number
  amount: number
  details1: string | null
  details2: string | null
}

interface DepositRow {
  deposit_id: string
  deposit_date: string
  deposit_type: number
  total_amount: number
  notes: string | null
  created_at: string
  branch_id: number
  branch_name: string
  shift_id: number
  shift_date: string
  transactions: DepositTransaction[]
  deposited_by: string | null
}

// Grouped row: one row per deposit_date + branch + shift
interface GroupedDepositRow {
  group_key: string // deposit_date|branch_id|shift_id
  deposit_date: string
  branch_id: number
  branch_name: string
  shift_id: number
  shift_date: string
  deposited_by: string | null
  created_at: string
  // all deposits in this group
  deposits: Array<{
    deposit_id: string
    deposit_type: number
    total_amount: number
    notes: string | null
    transactions: DepositTransaction[]
  }>
  // combined total across all deposits in the group
  total_amount: number
}

// Deposit type labels (1=Cash, 2=Check, 3=GCash)
const depositTypeLabels: Record<number, string> = {
  1: "Cash",
  2: "Check",
  3: "GCash",
}

// Payment type labels (for transactions: 1=Cash, 2=GCash, 3=Check, 4=Credit)
const paymentTypeLabels: Record<number, string> = {
  1: "Cash",
  2: "GCash",
  3: "Check",
  4: "Credit",
}

export function DepositTotalsTable() {
  const [data, setData] = useState<GroupedDepositRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})
  
  // Filter states
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [depositToDelete, setDepositToDelete] = useState<GroupedDepositRow | null>(null)

  // Breakdown dialog state
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false)
  const [breakdownDialogData, setBreakdownDialogData] = useState<{
    paymentType: number
    transactions: DepositTransaction[]
    depositInfo: { branchName: string; depositDate: string }
  } | null>(null)

  // Fetch deposits data
  useEffect(() => {
    const fetchDeposits = async () => {
      setLoading(true)
      const supabase = createClient()
      
      const { data: deposits, error } = await supabase.rpc("get_deposits")
      
      if (error) {
        toast.error(`Failed to load deposits: ${error.message}`)
        setLoading(false)
        return
      }
      
      // Group by deposit_date + branch_id + shift_id
      const groupMap = new Map<string, GroupedDepositRow>()
      for (const d of (deposits || [])) {
        const key = `${d.deposit_date}|${d.branch_id}|${d.shift_id}`
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            group_key: key,
            deposit_date: d.deposit_date,
            branch_id: d.branch_id,
            branch_name: d.branch_name,
            shift_id: d.shift_id,
            shift_date: d.shift_date,
            deposited_by: d.deposited_by,
            created_at: d.created_at,
            deposits: [],
            total_amount: 0,
          })
        }
        const group = groupMap.get(key)!
        group.deposits.push({
          deposit_id: d.deposit_id,
          deposit_type: d.deposit_type,
          total_amount: d.total_amount,
          notes: d.notes,
          transactions: d.transactions || [],
        })
        group.total_amount += Number(d.total_amount)
      }

      setData(Array.from(groupMap.values()))
      setLoading(false)
    }
    
    fetchDeposits()
  }, [])

  // Get unique branches from data
  const branches = useMemo(() => {
    const uniqueBranches = [...new Set(data.map(item => item.branch_id))]
    return uniqueBranches.map(id => ({ id, name: branchLabels[id] || `Branch ${id}` }))
  }, [data])

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = data
    
    if (branchFilter !== "all") {
      filtered = filtered.filter(item => item.branch_id === parseInt(branchFilter))
    }
    
    if (dateFilter) {
      filtered = filtered.filter(item => item.deposit_date === dateFilter)
    }
    
    return filtered
  }, [data, branchFilter, dateFilter])

  const handleDelete = (deposit: GroupedDepositRow) => {
    setDepositToDelete(deposit)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (depositToDelete) {
      const supabase = createClient()
      // Delete all deposits in this group
      const depositIds = depositToDelete.deposits.map(d => d.deposit_id)
      const { error } = await supabase
        .from("deposits")
        .delete()
        .in("id", depositIds)
      
      if (error) {
        toast.error("Failed to delete deposit")
        return
      }
      
      setData(prev => prev.filter(d => d.group_key !== depositToDelete.group_key))
      toast.success("Deposit deleted")
      setDeleteDialogOpen(false)
      setDepositToDelete(null)
    }
  }

  const columns: ColumnDef<GroupedDepositRow>[] = [
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
      accessorKey: "deposit_date",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Deposit Date
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
        const depositDate = new Date(row.getValue("deposit_date"))
        return (
          <div className="font-mono text-sm">
            {depositDate.toLocaleDateString("en-PH", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        )
      },
    },
    {
      id: "deposit_info",
      header: "Deposit Info",
      cell: ({ row }) => {
        const branchId = row.original.branch_id
        const branchName = row.original.branch_name
        const shiftId = row.original.shift_id
        const shiftDate = new Date(row.original.shift_date)
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
            {/* Shift No */}
            <div className="px-3 py-2 font-mono text-xs">
              Shift #{shiftId}
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            {/* Shift Date */}
            <div className="px-3 py-2 font-mono text-xs text-gray-400">
              {shiftDate.toLocaleDateString("en-PH", {
                timeZone: "Asia/Manila",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        )
      },
    },
    {
      id: "breakdown",
      header: "Breakdown",
      cell: ({ row }) => {
        const deposits = row.original.deposits

        if (deposits.length === 0) {
          return <span className="text-xs font-mono text-gray-400">No deposits</span>
        }

        // Sort deposits by deposit_type: 1, 2, 3
        const sortedDeposits = [...deposits].sort((a, b) => a.deposit_type - b.deposit_type)

        return (
          <div className="flex flex-col gap-1">
            {sortedDeposits.map((dep) => (
              <button
                key={dep.deposit_id}
                type="button"
                onClick={() => {
setBreakdownDialogData({
                    paymentType: dep.deposit_type,
                    transactions: dep.transactions,
                    depositInfo: {
                      branchName: row.original.branch_name,
                      depositDate: row.original.deposit_date,
                    },
                  })
                  setBreakdownDialogOpen(true)
                }}
                className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-left w-full group"
              >
                <span className="text-xs font-mono text-gray-600 group-hover:text-black transition-colors">
                  {depositTypeLabels[dep.deposit_type] || `Type ${dep.deposit_type}`}
                </span>
                <span className="text-sm font-mono font-medium">{formatCurrency(Number(dep.total_amount))}</span>
              </button>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: "total_amount",
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
        const total = row.getValue("total_amount") as number
        const handleCopy = () => {
          navigator.clipboard.writeText(total.toString())
          toast.success("Total amount copied")
        }
        return (
          <div className="inline-flex items-stretch border border-gray-200 rounded-md">
            <span className="font-mono text-sm font-medium px-3 py-2">{formatCurrency(total)}</span>
            <div className="w-px bg-gray-200" />
            <button
              onClick={handleCopy}
              className="px-2 flex items-center hover:bg-gray-50 transition-colors rounded-r-md"
              title="Copy total"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: "deposited_by",
      header: "Deposit By",
      cell: ({ row }) => {
        const depositedBy = row.getValue("deposited_by") as string
        return (
          <div className="text-xs font-mono text-gray-600">
            {depositedBy || "-"}
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
            onClick={() => handleDelete(row.original)}
          >
            <Trash className="w-3.5 h-3.5" />
            Delete
          </Button>
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
    getRowId: (row) => row.group_key,
    state: {
      sorting,
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">
                  Loading deposits...
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
                  No deposits found
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
          Total: {filteredData.length} deposits
        </div>
      </div>

      {/* Breakdown Transaction Details Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm tracking-wide">
              {breakdownDialogData && (
                <>
                  {depositTypeLabels[breakdownDialogData.paymentType]} Details
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {breakdownDialogData && (
            <div className="flex flex-col gap-3 min-h-0">
              {/* Deposit Info */}
              <div className="text-xs font-mono text-gray-500">
                {breakdownDialogData.depositInfo.branchName} &mdash;{" "}
                {format(new Date(breakdownDialogData.depositInfo.depositDate), "MMMM d, yyyy")}
              </div>
              {/* Transactions list */}
              <div className="border border-gray-200 rounded-md overflow-hidden flex flex-col min-h-0">
                {/* Header — pinned */}
                <div className="grid grid-cols-[1fr_auto] px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Details</span>
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider text-right">Amount</span>
                </div>
                {/* Scrollable rows */}
                <div className="overflow-y-auto">
                  {breakdownDialogData.transactions.length === 0 ? (
                    <div className="px-3 py-4 text-xs font-mono text-gray-400 text-center">No transactions</div>
                  ) : (
                    breakdownDialogData.transactions.map((txn, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-[1fr_auto] items-start px-3 py-3 gap-4 ${idx < breakdownDialogData.transactions.length - 1 ? "border-b border-gray-100" : ""}`}
                      >
                        <div className="flex flex-col gap-0.5">
                          {txn.details1 && <span className="text-sm font-mono">{txn.details1}</span>}
                          {txn.details2 && <span className="text-xs font-mono text-gray-400">{txn.details2}</span>}
                          {!txn.details1 && !txn.details2 && <span className="text-xs font-mono text-gray-400">—</span>}
                        </div>
                        <span className="text-sm font-mono font-medium text-right">{formatCurrency(Number(txn.amount))}</span>
                      </div>
                    ))
                  )}
                </div>
                {/* Total row — pinned */}
                {breakdownDialogData.transactions.length > 1 && (
                  <div className="grid grid-cols-[1fr_auto] px-3 py-2 bg-gray-50 border-t border-gray-200 shrink-0">
                    <span className="text-xs font-mono text-gray-500">Total</span>
                    <span className="text-sm font-mono font-semibold text-right">
                      {formatCurrency(breakdownDialogData.transactions.reduce((sum, t) => sum + Number(t.amount), 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deposit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deposit? This action cannot be undone.
              {depositToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md font-mono text-sm">
                  <div>Branch: {depositToDelete.branch_name}</div>
                  <div>Shift: #{depositToDelete.shift_id}</div>
                  <div>Date: {depositToDelete.deposit_date}</div>
                  <div>Total Amount: {formatCurrency(depositToDelete.total_amount)}</div>
                  <div>Deposits: {depositToDelete.deposits.length} record{depositToDelete.deposits.length > 1 ? "s" : ""}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
