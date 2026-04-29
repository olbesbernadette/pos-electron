"use client"

import { useState, useEffect } from "react"
import { Check, Plus, CaretUpDown } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Customer {
  id: number
  customer_name: string
}

interface CustomerComboboxProps {
  value: number | null
  onSelect: (customerId: number | null, customerName: string) => void
}

export function CustomerCombobox({ value, onSelect }: CustomerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState("")

  // Fetch customers on mount and when search changes
  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from("customers")
        .select("id, customer_name")
        .order("customer_name", { ascending: true })
        .limit(50)

      if (searchQuery) {
        query = query.ilike("customer_name", `%${searchQuery}%`)
      }

      const { data } = await query
      setCustomers(data || [])
      setIsLoading(false)
    }

    fetchCustomers()
  }, [searchQuery])

  // Set selected customer name when value changes
  useEffect(() => {
    if (value === null) {
      setSelectedCustomerName("")
    } else if (value && customers.length > 0) {
      const customer = customers.find(c => c.id === value)
      if (customer) {
        setSelectedCustomerName(customer.customer_name)
      }
    }
  }, [value, customers])

  const handleSelect = (customer: Customer) => {
    onSelect(customer.id, customer.customer_name)
    setSelectedCustomerName(customer.customer_name)
    setOpen(false)
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return

    setIsCreating(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("customers")
      .insert({ customer_name: newCustomerName.trim() })
      .select("id, customer_name")
      .single()

    setIsCreating(false)

    if (data && !error) {
      onSelect(data.id, data.customer_name)
      setSelectedCustomerName(data.customer_name)
      setCustomers(prev => [...prev, data].sort((a, b) => 
        a.customer_name.localeCompare(b.customer_name)
      ))
      setNewCustomerName("")
      setDialogOpen(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="w-full px-4 py-3 border border-gray-200 font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"
          >
            <span className={selectedCustomerName ? "text-black" : "text-gray-400"}>
              {selectedCustomerName || "Select customer..."}
            </span>
            <CaretUpDown className="w-4 h-4 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search customers..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">Loading...</div>
              ) : customers.length === 0 ? (
                <CommandEmpty>No customers found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.customer_name}
                      onSelect={() => handleSelect(customer)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {customer.customer_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setDialogOpen(true)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Customer
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Add New Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-medium tracking-wide">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Customer Name
            </label>
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-4 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
              autoFocus
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 border border-gray-200 font-mono text-sm tracking-wider uppercase hover:border-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={!newCustomerName.trim() || isCreating}
              className="px-4 py-2 bg-black text-white font-mono text-sm tracking-wider uppercase hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isCreating ? "Adding..." : "Add Customer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
