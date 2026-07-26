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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, CaretUpDown, MagnifyingGlass, Funnel, Trash } from "@phosphor-icons/react"
import { format, parse } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

const formatDate = (date: string): string =>
  format(parse(date, "yyyy-MM-dd", new Date()), "MMM d, yyyy")

interface PayrollRow {
  id: number
  employee_name: string
  employee_type: string | null
  branch_name: string
  period_start: string
  period_end: string
  basic_pay: number
  ot_pay: number
  allowance: number
  total_pay: number
  vale: number
  sss: number
  phic: number
  pgbg: number
  bonus: number
  net_pay: number
}

export function PayrollTable() {
  const [data, setData] = useState<PayrollRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "period_start", desc: true }])
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [rowSelection, setRowSelection] = useState({})

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<PayrollRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchPayroll = async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("payroll_records")
      .select(
        "id, period_start, period_end, basic_pay, ot_pay, allowance, total_pay, vale, sss, phic, pgbg, bonus, net_pay, employees(employee_name, employee_type), branches(name)"
      )
      .order("period_start", { ascending: false })

    if (error) {
      toast.error("Failed to load payroll records")
      console.error(error)
    } else if (rows) {
      setData(
        rows.map((row: any) => ({
          id: row.id,
          employee_name: row.employees?.employee_name ?? "Unknown",
          employee_type: row.employees?.employee_type ?? null,
          branch_name: row.branches?.name ?? "Unknown",
          period_start: row.period_start,
          period_end: row.period_end,
          basic_pay: row.basic_pay,
          ot_pay: row.ot_pay,
          allowance: row.allowance,
          total_pay: row.total_pay,
          vale: row.vale,
          sss: row.sss,
          phic: row.phic,
          pgbg: row.pgbg,
          bonus: row.bonus,
          net_pay: row.net_pay,
        }))
      )
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPayroll()
  }, [])

  const branchOptions = useMemo(
    () => Array.from(new Set(data.map(r => r.branch_name))).sort(),
    [data]
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(data.map(r => r.employee_type).filter((t): t is string => !!t))).sort(),
    [data]
  )
  const periodOptions = useMemo(() => {
    const map = new Map<string, { period_start: string; period_end: string }>()
    data.forEach(r => {
      const key = `${r.period_start}|${r.period_end}`
      if (!map.has(key)) map.set(key, { period_start: r.period_start, period_end: r.period_end })
    })
    return Array.from(map.entries())
      .map(([value, period]) => ({ value, ...period }))
      .sort((a, b) => b.period_start.localeCompare(a.period_start))
  }, [data])

  const filteredData = useMemo(() => {
    let result = data
    if (branchFilter !== "all") {
      result = result.filter(r => r.branch_name === branchFilter)
    }
    if (typeFilter !== "all") {
      result = result.filter(r => r.employee_type === typeFilter)
    }
    if (periodFilter !== "all") {
      result = result.filter(r => `${r.period_start}|${r.period_end}` === periodFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        r => r.employee_name.toLowerCase().includes(q) || r.branch_name.toLowerCase().includes(q)
      )
    }
    return result
  }, [data, search, branchFilter, typeFilter, periodFilter])

  const openDelete = (record: PayrollRow) => {
    setRecordToDelete(record)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!recordToDelete) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("payroll_records")
      .delete()
      .eq("id", recordToDelete.id)

    setIsDeleting(false)
    if (error) {
      toast.error("Failed to delete payroll record")
      console.error(error)
      return
    }
    setData(prev => prev.filter(r => r.id !== recordToDelete.id))
    toast.success(`Payroll for ${recordToDelete.employee_name} deleted`)
    setDeleteDialogOpen(false)
    setRecordToDelete(null)
  }

  const sortableHeader = (label: string, id: string) => ({ column }: any) => (
    <button
      className="flex items-center gap-1 hover:text-black transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="w-3 h-3" />
      ) : (
        <CaretUpDown className="w-3 h-3 text-gray-400" />
      )}
    </button>
  )

  const columns: ColumnDef<PayrollRow>[] = [
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
      accessorKey: "employee_name",
      header: sortableHeader("Employee", "employee_name"),
      cell: ({ row }) => (
        <span className="font-sans text-sm font-medium whitespace-nowrap">{row.getValue("employee_name")}</span>
      ),
    },
    {
      accessorKey: "employee_type",
      header: sortableHeader("Type", "employee_type"),
      cell: ({ row }) => {
        const type = row.getValue("employee_type") as string | null
        return type ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100/50 text-gray-700 border-gray-300">
            {type}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      },
    },
    {
      accessorKey: "branch_name",
      header: sortableHeader("Branch", "branch_name"),
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap">{row.getValue("branch_name")}</span>,
    },
    {
      accessorKey: "period_start",
      header: sortableHeader("Period", "period_start"),
      cell: ({ row }) => (
        <span className="font-sans text-sm whitespace-nowrap">
          {formatDate(row.original.period_start)} - {formatDate(row.original.period_end)}
        </span>
      ),
    },
    {
      accessorKey: "basic_pay",
      header: "Basic Pay",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap">{formatCurrency(row.getValue("basic_pay"))}</span>,
    },
    {
      accessorKey: "ot_pay",
      header: "OT Pay",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap">{formatCurrency(row.getValue("ot_pay"))}</span>,
    },
    {
      accessorKey: "allowance",
      header: "Allowance",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap">{formatCurrency(row.getValue("allowance"))}</span>,
    },
    {
      accessorKey: "total_pay",
      header: "Total Pay",
      cell: ({ row }) => <span className="font-sans text-sm font-medium whitespace-nowrap">{formatCurrency(row.getValue("total_pay"))}</span>,
    },
    {
      accessorKey: "vale",
      header: "Vale",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap text-red-600">{formatCurrency(row.getValue("vale"))}</span>,
    },
    {
      accessorKey: "sss",
      header: "SSS",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap text-red-600">{formatCurrency(row.getValue("sss"))}</span>,
    },
    {
      accessorKey: "phic",
      header: "PHIC",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap text-red-600">{formatCurrency(row.getValue("phic"))}</span>,
    },
    {
      accessorKey: "pgbg",
      header: "PGBG",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap text-red-600">{formatCurrency(row.getValue("pgbg"))}</span>,
    },
    {
      accessorKey: "bonus",
      header: "Bonus",
      cell: ({ row }) => <span className="font-sans text-sm whitespace-nowrap text-green-600">{formatCurrency(row.getValue("bonus"))}</span>,
    },
    {
      accessorKey: "net_pay",
      header: sortableHeader("Net Pay", "net_pay"),
      cell: ({ row }) => <span className="font-sans text-sm font-medium whitespace-nowrap">{formatCurrency(row.getValue("net_pay"))}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-xs flex items-center gap-1.5 px-3 text-red-600 hover:text-red-700 hover:border-red-300"
          onClick={() => openDelete(row.original)}
        >
          <Trash className="w-3.5 h-3.5" />
          Delete
        </Button>
      ),
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
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Funnel className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-sans text-gray-500">Filters:</span>
          </div>

          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs font-sans">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branchOptions.map(branch => (
                <SelectItem key={branch} value={branch}>{branch}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs font-sans">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {typeOptions.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs font-sans">
              <SelectValue placeholder="All Periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {periodOptions.map(period => (
                <SelectItem key={period.value} value={period.value}>
                  {formatDate(period.period_start)} - {formatDate(period.period_end)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </div>

        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-sans shrink-0">
            <span className="text-gray-500">
              {table.getFilteredSelectedRowModel().rows.length} selected
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-medium">
              {formatCurrency(
                table.getFilteredSelectedRowModel().rows.reduce(
                  (sum, r) => sum + r.original.net_pay, 0
                )
              )}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">
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
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">
                  No payroll records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer count */}
      <div className="text-xs font-sans text-gray-500">
        {filteredData.length} record{filteredData.length !== 1 ? "s" : ""}
        {search || branchFilter !== "all" || typeFilter !== "all" || periodFilter !== "all" ? ` (filtered from ${data.length} total)` : ""}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payroll record? This cannot be undone.
              {recordToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md font-sans text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Employee</span>
                    <span>{recordToDelete.employee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Period</span>
                    <span>{formatDate(recordToDelete.period_start)} - {formatDate(recordToDelete.period_end)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Net Pay</span>
                    <span>{formatCurrency(recordToDelete.net_pay)}</span>
                  </div>
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
