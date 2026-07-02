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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
import { ArrowUp, ArrowDown, CaretUpDown, MagnifyingGlass, Funnel, PencilSimple, X } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

const statusConfig: Record<number, { label: string; bg: string; text: string; border: string }> = {
  1: { label: "Unpaid",    bg: "bg-amber-100/50", text: "text-amber-700", border: "border-amber-300" },
  2: { label: "Paid",      bg: "bg-green-100/50", text: "text-green-700", border: "border-green-300" },
  3: { label: "Cancelled", bg: "bg-gray-100/50",  text: "text-gray-500",  border: "border-gray-300" },
}

interface InvoiceRow {
  id: number
  customer_id: number
  customer_name: string
  shift_id: number
  invoice_date: string | null
  invoice_no: string
  sales_amount: number
  status: number
}

export function CustomerInvoiceList() {
  const [data, setData] = useState<InvoiceRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "invoice_date", desc: true }])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [rowSelection, setRowSelection] = useState({})

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [invoiceToCancel, setInvoiceToCancel] = useState<InvoiceRow | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [invoiceToEdit, setInvoiceToEdit] = useState<InvoiceRow | null>(null)
  const [editInvoiceNo, setEditInvoiceNo] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from("credit_details")
        .select("id, customer_id, invoice_no, invoice_date, sales_amount, status, shift_id, customers(customer_name)")
        .order("shift_id", { ascending: false })

      if (error) {
        toast.error("Failed to load invoices")
        console.error(error)
      } else if (rows) {
        setData(
          rows.map((row: any) => ({
            id: row.id,
            customer_id: row.customer_id,
            customer_name: row.customers?.customer_name ?? "Unknown",
            shift_id: row.shift_id,
            invoice_date: row.invoice_date,
            invoice_no: row.invoice_no,
            sales_amount: row.sales_amount,
            status: row.status,
          }))
        )
      }
      setIsLoading(false)
    }
    fetchInvoices()
  }, [])

  const filteredData = useMemo(() => {
    let result = data
    if (statusFilter !== "all") {
      result = result.filter(r => r.status === parseInt(statusFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        r =>
          r.customer_name.toLowerCase().includes(q) ||
          r.invoice_no.toLowerCase().includes(q)
      )
    }
    return result
  }, [data, statusFilter, search])

  const openEdit = (invoice: InvoiceRow) => {
    setInvoiceToEdit(invoice)
    setEditInvoiceNo(invoice.invoice_no)
    setEditAmount(invoice.sales_amount.toString())
    setEditDialogOpen(true)
  }

  const confirmEdit = async () => {
    if (!invoiceToEdit) return
    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("credit_details")
      .update({
        invoice_no: editInvoiceNo.trim(),
        sales_amount: parseFloat(editAmount) || 0,
      })
      .eq("id", invoiceToEdit.id)

    setIsSaving(false)
    if (error) {
      toast.error("Failed to update invoice")
      return
    }
    setData(prev =>
      prev.map(r =>
        r.id === invoiceToEdit.id
          ? { ...r, invoice_no: editInvoiceNo.trim(), sales_amount: parseFloat(editAmount) || 0 }
          : r
      )
    )
    toast.success("Invoice updated")
    setEditDialogOpen(false)
  }

  const openCancel = (invoice: InvoiceRow) => {
    setInvoiceToCancel(invoice)
    setCancelDialogOpen(true)
  }

  const confirmCancel = async () => {
    if (!invoiceToCancel) return
    setIsCancelling(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("credit_details")
      .update({ status: 3 })
      .eq("id", invoiceToCancel.id)

    setIsCancelling(false)
    if (error) {
      toast.error("Failed to cancel invoice")
      return
    }
    setData(prev =>
      prev.map(r => r.id === invoiceToCancel.id ? { ...r, status: 3 } : r)
    )
    toast.success(`Invoice ${invoiceToCancel.invoice_no} cancelled`)
    setCancelDialogOpen(false)
  }

  const handleStatusChange = async (id: number, newStatus: number) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("credit_details")
      .update({ status: newStatus })
      .eq("id", id)

    if (error) {
      toast.error("Failed to update status")
      return
    }
    setData(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
    toast.success(`Status updated to ${statusConfig[newStatus].label}`)
  }

  const columns: ColumnDef<InvoiceRow>[] = [
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
      accessorKey: "shift_id",
      header: "Shift",
      cell: ({ row }) => (
        <span className="font-sans text-sm">#{row.getValue("shift_id")}</span>
      ),
    },
    {
      id: "customer_date",
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
      cell: ({ row }) => {
        const date = row.original.invoice_date
        return (
          <div className="flex flex-col border border-gray-200 rounded-md">
            <div className="px-3 py-2 font-sans text-sm font-medium">
              {row.original.customer_name}
            </div>
            <div className="mx-3 h-px bg-gray-200" />
            <div className="px-3 py-2">
              <span className="font-sans text-sm text-gray-500">
                {date
                  ? new Date(date).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "invoice_no",
      header: () => <div className="pl-8">Invoice No.</div>,
      cell: ({ row }) => (
        <div className="pl-8 font-sans text-sm">{row.getValue("invoice_no")}</div>
      ),
    },
    {
      accessorKey: "sales_amount",
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
      cell: ({ row }) => (
        <span className="font-sans text-sm">{formatCurrency(row.getValue("sales_amount"))}</span>
      ),
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
        const status = row.getValue("status") as number
        const cfg = statusConfig[status] ?? statusConfig[1]
        const isCancelled = status === 3

        if (isCancelled) {
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-sans font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.label}
            </span>
          )
        }

        return (
          <Select
            value={status.toString()}
            onValueChange={(val) => handleStatusChange(row.original.id, parseInt(val))}
          >
            <SelectTrigger className={`h-auto px-2.5 py-1 rounded-full text-xs font-sans font-medium border w-auto gap-1.5 shadow-none focus:ring-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Unpaid</SelectItem>
              <SelectItem value="2">Paid</SelectItem>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const invoice = row.original
        const isSettled = invoice.status === 2 || invoice.status === 3
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 px-3"
              onClick={() => openEdit(invoice)}
              disabled={isSettled}
            >
              <PencilSimple className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5 px-3 text-red-600 hover:text-red-700 hover:border-red-300"
              onClick={() => openCancel(invoice)}
              disabled={isSettled}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs font-sans">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="1">Unpaid</SelectItem>
              <SelectItem value="2">Paid</SelectItem>
              <SelectItem value="3">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer or invoice..."
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
                  (sum, r) => sum + r.original.sales_amount, 0
                )
              )}
            </span>
          </div>
        )}
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
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  No invoices found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer count */}
      <div className="text-xs font-sans text-gray-500">
        {filteredData.length} invoice{filteredData.length !== 1 ? "s" : ""}
        {statusFilter !== "all" || search ? ` (filtered from ${data.length} total)` : ""}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Invoice Number</label>
              <input
                type="text"
                value={editInvoiceNo}
                onChange={(e) => setEditInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-sans text-sm">PHP</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full pl-12 pr-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmEdit} disabled={!editInvoiceNo.trim() || isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invoice? This cannot be undone.
              {invoiceToCancel && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md font-sans text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span>{invoiceToCancel.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice</span>
                    <span>{invoiceToCancel.invoice_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span>{formatCurrency(invoiceToCancel.sales_amount)}</span>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? "Cancelling..." : "Cancel Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
