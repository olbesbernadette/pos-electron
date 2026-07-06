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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { ArrowUp, ArrowDown, CaretUpDown, MagnifyingGlass, PencilSimple, Trash, Plus } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

interface BranchOption {
  id: number
  name: string
}

interface EmployeeRow {
  id: string
  employee_name: string
  employee_type: string | null
  branch_id: number | null
  branch_name: string | null
  r_pay: number
  h_pay: number
  s_pay: number
  incentives: number
  bonus: number
  sss: number
  phic: number
  pgbg: number
}

interface EmployeeFormState {
  employee_name: string
  employee_type: string
  branch_id: string
  r_pay: string
  incentives: string
  bonus: string
  sss: string
  phic: string
  pgbg: string
}

const emptyForm: EmployeeFormState = {
  employee_name: "",
  employee_type: "",
  branch_id: "",
  r_pay: "",
  incentives: "",
  bonus: "",
  sss: "",
  phic: "",
  pgbg: "",
}

export function EmployeesTable() {
  const [data, setData] = useState<EmployeeRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "employee_name", desc: false }])
  const [search, setSearch] = useState("")

  // Add/Edit dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeRow | null>(null)
  const [form, setForm] = useState<EmployeeFormState>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchEmployees = async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("employees")
      .select("id, employee_name, employee_type, branch_id, r_pay, h_pay, s_pay, incentives, bonus, sss, phic, pgbg, branches(name)")
      .order("employee_name", { ascending: true })

    if (error) {
      toast.error(error.message || "Failed to load employees")
      console.error(error)
    } else if (rows) {
      setData(
        rows.map((row: any) => ({
          ...row,
          branch_name: row.branches?.name ?? null,
        }))
      )
    }
    setIsLoading(false)
  }

  const fetchBranches = async () => {
    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true })

    if (error) {
      toast.error(error.message || "Failed to load branches")
      console.error(error)
    } else if (rows) {
      setBranches(rows)
    }
  }

  useEffect(() => {
    fetchEmployees()
    fetchBranches()
  }, [])

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(r => r.employee_name.toLowerCase().includes(q))
  }, [data, search])

  const openAdd = () => {
    setEmployeeToEdit(null)
    setForm(emptyForm)
    setFormDialogOpen(true)
  }

  const openEdit = (employee: EmployeeRow) => {
    setEmployeeToEdit(employee)
    setForm({
      employee_name: employee.employee_name,
      employee_type: employee.employee_type ?? "",
      branch_id: employee.branch_id?.toString() ?? "",
      r_pay: employee.r_pay.toString(),
      incentives: employee.incentives.toString(),
      bonus: employee.bonus.toString(),
      sss: employee.sss.toString(),
      phic: employee.phic.toString(),
      pgbg: employee.pgbg.toString(),
    })
    setFormDialogOpen(true)
  }

  const confirmSave = async () => {
    if (!form.employee_name.trim()) return
    setIsSaving(true)
    const supabase = createClient()

    const payload = {
      employee_name: form.employee_name.trim(),
      employee_type: form.employee_type || null,
      branch_id: form.branch_id ? parseInt(form.branch_id) : null,
      r_pay: parseFloat(form.r_pay) || 0,
      incentives: parseFloat(form.incentives) || 0,
      bonus: parseFloat(form.bonus) || 0,
      sss: parseFloat(form.sss) || 0,
      phic: parseFloat(form.phic) || 0,
      pgbg: parseFloat(form.pgbg) || 0,
    }

    if (employeeToEdit) {
      const { error } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", employeeToEdit.id)

      setIsSaving(false)
      if (error) {
        toast.error(error.message || "Failed to update employee")
        console.error(error)
        return
      }
      toast.success("Employee updated")
    } else {
      const { error } = await supabase.from("employees").insert(payload)

      setIsSaving(false)
      if (error) {
        toast.error(error.message || "Failed to add employee")
        console.error(error)
        return
      }
      toast.success("Employee added")
    }

    setFormDialogOpen(false)
    fetchEmployees()
  }

  const openDelete = (employee: EmployeeRow) => {
    setEmployeeToDelete(employee)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!employeeToDelete) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", employeeToDelete.id)

    setIsDeleting(false)
    if (error) {
      toast.error(error.message || "Failed to delete employee")
      console.error(error)
      return
    }
    setData(prev => prev.filter(r => r.id !== employeeToDelete.id))
    toast.success(`${employeeToDelete.employee_name} deleted`)
    setDeleteDialogOpen(false)
    setEmployeeToDelete(null)
  }

  const columns: ColumnDef<EmployeeRow>[] = [
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Employee
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
        <span className="font-sans text-sm font-medium">{row.getValue("employee_name")}</span>
      ),
    },
    {
      accessorKey: "employee_type",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type
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
      cell: ({ row }) => {
        const name = row.original.branch_name
        return name ? (
          <span className="font-sans text-sm">{name}</span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      },
    },
    {
      accessorKey: "r_pay",
      header: "R Pay",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("r_pay"))}</span>,
    },
    {
      accessorKey: "h_pay",
      header: "H Pay",
      cell: ({ row }) => <span className="font-sans text-sm text-gray-500">{formatCurrency(row.getValue("h_pay"))}</span>,
    },
    {
      accessorKey: "s_pay",
      header: "S Pay",
      cell: ({ row }) => <span className="font-sans text-sm text-gray-500">{formatCurrency(row.getValue("s_pay"))}</span>,
    },
    {
      accessorKey: "incentives",
      header: "Incentives",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("incentives"))}</span>,
    },
    {
      accessorKey: "bonus",
      header: "Bonus",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("bonus"))}</span>,
    },
    {
      accessorKey: "sss",
      header: "SSS",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("sss"))}</span>,
    },
    {
      accessorKey: "phic",
      header: "PHIC",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("phic"))}</span>,
    },
    {
      accessorKey: "pgbg",
      header: "PGBG",
      cell: ({ row }) => <span className="font-sans text-sm">{formatCurrency(row.getValue("pgbg"))}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 px-3"
            onClick={() => openEdit(row.original)}
          >
            <PencilSimple className="w-3.5 h-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 px-3 text-red-600 hover:text-red-700 hover:border-red-300"
            onClick={() => openDelete(row.original)}
          >
            <Trash className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  return (
    <div className="space-y-4">
      {/* Filters + Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-64">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <Button size="sm" className="text-xs flex items-center gap-1.5 px-3" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" />
          Add Employee
        </Button>
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
                  No employees found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer count */}
      <div className="text-xs font-sans text-gray-500">
        {filteredData.length} employee{filteredData.length !== 1 ? "s" : ""}
        {search ? ` (filtered from ${data.length} total)` : ""}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{employeeToEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Employee Name</label>
              <input
                type="text"
                value={form.employee_name}
                onChange={(e) => setForm(f => ({ ...f, employee_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Employee Type</label>
              <Select
                value={form.employee_type}
                onValueChange={(val) => setForm(f => ({ ...f, employee_type: val }))}
              >
                <SelectTrigger className="w-full h-9 text-sm font-sans">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boy">Boy</SelectItem>
                  <SelectItem value="Girl">Girl</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Branch</label>
              <Select
                value={form.branch_id}
                onValueChange={(val) => setForm(f => ({ ...f, branch_id: val }))}
              >
                <SelectTrigger className="w-full h-9 text-sm font-sans">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">R Pay</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.r_pay}
                  onChange={(e) => setForm(f => ({ ...f, r_pay: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Incentives</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.incentives}
                  onChange={(e) => setForm(f => ({ ...f, incentives: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">Bonus</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bonus}
                  onChange={(e) => setForm(f => ({ ...f, bonus: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">SSS</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sss}
                  onChange={(e) => setForm(f => ({ ...f, sss: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">PHIC</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.phic}
                  onChange={(e) => setForm(f => ({ ...f, phic: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-sans text-gray-500 uppercase tracking-wider">PGBG</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pgbg}
                  onChange={(e) => setForm(f => ({ ...f, pgbg: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 font-sans">
              H Pay and S Pay are computed automatically from R Pay (×1.3 and ×1.25).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmSave} disabled={!form.employee_name.trim() || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee record? This action cannot be undone.
              {employeeToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md font-sans text-sm">
                  <div>Employee: {employeeToDelete.employee_name}</div>
                  <div>R Pay: {formatCurrency(employeeToDelete.r_pay)}</div>
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
