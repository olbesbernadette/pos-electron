"use client"

import { useState, useRef, useEffect } from "react"
import { Money, DeviceMobile, Checks, CreditCard, X, WarningCircle, CaretDown } from "@phosphor-icons/react"
import { useShift } from "@/contexts/shift-context"
import { createClient } from "@/lib/supabase/client"
import { CustomerCombobox } from "./customer-combobox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { format, parse } from "date-fns"
import { toast } from "sonner"

// Generate UUID for idempotency
const generateIdempotencyKey = (): string => {
  return crypto.randomUUID()
}

const paymentOptions = [
  { id: 1, key: "cash", label: "Cash", icon: Money },
  { id: 2, key: "gcash", label: "Gcash", icon: DeviceMobile },
  { id: 3, key: "check", label: "Check", icon: Checks },
  { id: 4, key: "credit", label: "Credit", icon: CreditCard },
]

// Format number with commas and 2 decimal places (supports negative values)
const formatCurrency = (value: string): string => {
  // Check if negative
  const isNegative = value.startsWith("-")
  
  // Remove all non-numeric characters except decimal point
  const numericValue = value.replace(/[^0-9.]/g, "")
  
  if (!numericValue) return isNegative ? "-" : ""
  
  // Split by decimal point
  const parts = numericValue.split(".")
  let integerPart = parts[0]
  const decimalPart = parts[1]
  
  // Add commas to integer part
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  
  // Combine with decimal part (limit to 2 decimal places)
  let result = integerPart
  if (decimalPart !== undefined) {
    result = `${integerPart}.${decimalPart.slice(0, 2)}`
  }
  
  return isNegative ? `-${result}` : result
}

// Parse formatted currency back to raw number string (preserves negative sign)
const parseCurrency = (value: string): string => {
  return value.replace(/,/g, "")
}

interface PaymentFormProps {
  branchName: string
  branchId: number
}

export function PaymentForm({ branchName, branchId }: PaymentFormProps) {
  const { currentShiftId, hasOpenShift, isLoading: shiftLoading } = useShift()
  const [selectedPayment, setSelectedPayment] = useState<number>(1)
  const [salesAmount, setSalesAmount] = useState<string>("")
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  // Idempotency key for preventing duplicate submissions
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey())
  const salesAmountRef = useRef<HTMLInputElement>(null)
  const maxRetries = 3
  
  // Auto-focus sales amount on mount
  useEffect(() => {
    if (salesAmountRef.current && hasOpenShift && !shiftLoading) {
      salesAmountRef.current.focus()
    }
  }, [hasOpenShift, shiftLoading])


  
  // Check-specific fields
  const [checkDate, setCheckDate] = useState<string>("")
  const [checkNumber, setCheckNumber] = useState<string>("")
  const [bankNameBranch, setBankNameBranch] = useState<string>("")
  const [checkAmount, setCheckAmount] = useState<string>("")

  // Credit-specific fields
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState<string>("")
  const [invoiceNumber, setInvoiceNumber] = useState<string>("")
  const [isCreditPayment, setIsCreditPayment] = useState<boolean>(false)

  // Branch-specific fields (Pawa Gas, Matnog Gas, Gotis Hotel)
  const [shiftDate, setShiftDate] = useState<string>("")
  const [shiftNumber, setShiftNumber] = useState<string>("")
  
  // Date picker open states
  const [shiftDateOpen, setShiftDateOpen] = useState(false)
  const [checkDateOpen, setCheckDateOpen] = useState(false)

  // Check if branch needs shift date/number fields (Pawa Gas=2, Matnog Gas=3, Gotis Hotel=4)
  const needsShiftFields = [2, 3, 4].includes(branchId)

  const handleCurrencyChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const formatted = formatCurrency(value)
    setter(formatted)
  }

  const resetForm = () => {
    setSalesAmount("")
    setPaymentAmount("")
    setCheckDate("")
    setCheckNumber("")
    setBankNameBranch("")
    setCheckAmount("")
    setCustomerId(null)
    setCustomerName("")
    setInvoiceNumber("")
    setIsCreditPayment(false)
    setShiftDate("")
    setShiftNumber("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!hasOpenShift || !currentShiftId) {
      return
    }

    // Prevent double-clicks
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const supabase = createClient()
    const sales = parseFloat(parseCurrency(salesAmount)) || 0
    // payment_amount: check uses checkAmount, credit defaults to 0, others use paymentAmount
    let payment = 0
    if (selectedPayment === 3) {
      payment = parseFloat(parseCurrency(checkAmount)) || 0
    } else if (selectedPayment === 4) {
      payment = 0 // Credit payments default to 0
    } else {
      payment = parseFloat(parseCurrency(paymentAmount)) || 0
    }

    const currentIdempotencyKey = idempotencyKeyRef.current

    // Determine details1 and details2 based on branch
    // For Pawa Gas (2), Matnog Gas (3), Gotis Hotel (4): details1 = Shift Date, details2 = Shift Number
    // For Hardware (1) and others: details1 and details2 are null
    const details1 = needsShiftFields && shiftDate ? shiftDate : null
    const details2 = needsShiftFields && shiftNumber ? shiftNumber : null

    // Determine status: default 1 (undeposited), but Credit (4) = status 3 (receivable)
    const status = selectedPayment === 4 ? 3 : 1

    // Retry logic for network failures
    let transactionData: { id: number } | null = null
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // transaction_type: 1 = sales
      // amount = sales amount, payment_amount = payment received
      // change is auto-calculated by DB as (payment_amount - amount)
      const { data, error: transactionError } = await supabase
        .from("shift_transactions")
        .insert({
          shift_id: currentShiftId,
          transaction_type: 1,
          branch_id: branchId,
          payment_type: selectedPayment,
          amount: sales,
          payment_amount: payment,
          idempotency_key: currentIdempotencyKey,
          details1,
          details2,
          status,
        })
        .select("id")
        .single()

      if (!transactionError && data) {
        transactionData = data
        break
      }

      // Check if it's a duplicate key error (transaction already exists)
      if (transactionError?.code === "23505") {
        // Duplicate idempotency key - fetch the existing transaction
        const { data: existingTransaction } = await supabase
          .from("shift_transactions")
          .select("id")
          .eq("idempotency_key", currentIdempotencyKey)
          .single()
        
        if (existingTransaction) {
          transactionData = existingTransaction
          break
        }
      }

      lastError = transactionError as Error
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
      }
    }

    if (!transactionData) {
      setIsSubmitting(false)
      setSubmitError("Failed to record transaction. Please try again.")
      return
    }

    // If payment type is check (3), insert check details
    if (selectedPayment === 3 && transactionData) {
      const { error: checkError } = await supabase.from("check_details").insert({
        transaction_id: transactionData.id,
        bank_name: bankNameBranch,
        check_number: checkNumber,
        check_date: checkDate,
        check_amount: parseFloat(parseCurrency(checkAmount)) || 0,
      })

      if (checkError) {
        setIsSubmitting(false)
        setSubmitError("Failed to record check details. Please try again.")
        return
      }
    }

    // If payment type is credit (4), insert credit details
    if (selectedPayment === 4 && transactionData) {
      if (!customerId) {
        setIsSubmitting(false)
        setSubmitError("Please select a customer.")
        return
      }

      // Insert credit details with customer_id
      const { error: creditError } = await supabase.from("credit_details").insert({
        transaction_id: transactionData.id,
        customer_id: customerId,
        invoice_no: invoiceNumber,
      })

      if (creditError) {
        setIsSubmitting(false)
        setSubmitError("Failed to record credit details. Please try again.")
        return
      }
    }

    setIsSubmitting(false)
    toast.success("Transaction recorded successfully")
    resetForm()
    // Generate new idempotency key for next submission
    idempotencyKeyRef.current = generateIdempotencyKey()
    
    // Print receipt via Electron bridge or browser
    try {
      const paymentTypeLabel = paymentOptions.find(p => p.id === selectedPayment)?.label || "Payment"
      const change = parseFloat(parseCurrency(paymentAmount)) - sales
      
      // Check if running in Electron
      const isElectron = (window as any).electronAPI?.isElectron
      
      if (isElectron) {
        // Use Electron bridge for thermal printer
        const receiptLines = [
          { text: `Date: ${format(new Date(), "MM/dd/yyyy")}`, align: "left" as const, bold: false },
          { text: `Shift No: ${shiftNumber || ""}`, align: "left" as const, bold: false },
          { text: "", align: "left" as const },
          { text: `Sales: ${formatCurrency(salesAmount)}`, align: "left" as const, bold: false },
          { text: `${paymentTypeLabel}: ${formatCurrency(paymentAmount)}`, align: "left" as const, bold: false },
          { text: "-----------------------------------------------", align: "center" as const },
          { text: `Change: ${formatCurrency(change.toString())}`, align: "left" as const, bold: true },
        ]
        
        const result = await (window as any).electronAPI.printReceipt({ lines: receiptLines })
        if (result.success) {
          console.log("[v0] Receipt printed successfully via Electron bridge")
        } else {
          console.error("[v0] Electron print failed:", result.error)
          toast.error("Failed to print receipt")
        }
      } else {
        // Fallback: browser print (disabled for now)
        console.log("[v0] Not in Electron environment, print would open dialog")
      }
    } catch (printError) {
      console.error("[v0] Print error:", printError)
      toast.error("Print error occurred")
    }
    
    // Focus sales amount for next entry
    setTimeout(() => salesAmountRef.current?.focus(), 100)
  }

  const isFormDisabled = !hasOpenShift || shiftLoading

  // Handle Enter key to move to next field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (nextFieldId) {
        const nextField = document.getElementById(nextFieldId)
        nextField?.focus()
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 p-6 max-w-full">
      {/* No Shift Warning */}
      {!shiftLoading && !hasOpenShift && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-center gap-3">
          <WarningCircle className="w-5 h-5 text-red-600 flex-shrink-0" weight="fill" />
          <p className="text-sm text-red-700 font-mono tracking-wide">
            Open a new shift to record transactions
          </p>
        </div>
      )}

      {/* Error Message */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-center gap-3">
          <WarningCircle className="w-5 h-5 text-red-600 flex-shrink-0" weight="fill" />
          <p className="text-sm text-red-700 font-mono tracking-wide">
            {submitError}
          </p>
        </div>
      )}

      {/* Payment Label */}
      <h2 className="text-lg font-medium tracking-wide mb-6">Payment</h2>



      {/* Shift Date and Shift Number - Only for Pawa Gas, Matnog Gas, Gotis Hotel */}
      {needsShiftFields && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Shift Date */}
          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Shift Date
            </label>
            <Popover open={shiftDateOpen} onOpenChange={setShiftDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full px-4 py-3 border border-gray-200 font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"
                >
                  <span className={shiftDate ? "text-black" : "text-gray-400"}>
                    {shiftDate ? format(parse(shiftDate, "yyyy-MM-dd", new Date()), "PPP") : "Date"}
                  </span>
                  <CaretDown className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={shiftDate ? parse(shiftDate, "yyyy-MM-dd", new Date()) : undefined}
                  onSelect={(date) => {
                    setShiftDate(date ? format(date, "yyyy-MM-dd") : "")
                    setShiftDateOpen(false)
                  }}
                  defaultMonth={shiftDate ? parse(shiftDate, "yyyy-MM-dd", new Date()) : undefined}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Shift Number */}
          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Shift Number
            </label>
            <div className="relative">
              <input
                id="shift-number"
                type="text"
                value={shiftNumber}
                onChange={(e) => setShiftNumber(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "sales-amount")}
                placeholder="e.g. 1, 2, 3"
                className="w-full px-4 pr-10 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
              />
              {shiftNumber && (
                <button
                  type="button"
                  onClick={() => setShiftNumber("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Options */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-3">
          Payment Method
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {paymentOptions.map((option) => {
            const Icon = option.icon
            const isSelected = selectedPayment === option.id
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedPayment(option.id)}
                className={`flex flex-col items-center justify-center p-4 border transition-all ${
                  isSelected
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                <Icon className="w-6 h-6 mb-2" weight={isSelected ? "fill" : "regular"} />
                <span className="text-xs font-mono tracking-wider">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Credit Payment Toggle */}
      <div className="mb-6 flex items-center justify-between px-4 py-3 border border-gray-200">
        <label htmlFor="credit-payment" className="text-sm font-mono text-gray-600 cursor-pointer">
          Credit Payment
        </label>
        <Switch
          id="credit-payment"
          checked={isCreditPayment}
          onCheckedChange={setIsCreditPayment}
        />
      </div>

      {/* Sales Amount - Always shown */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
          Sales
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
            PHP
          </span>
<input
                ref={salesAmountRef}
                id="sales-amount"
                type="text"
                inputMode="decimal"
                value={salesAmount}
                onChange={(e) => handleCurrencyChange(e.target.value, setSalesAmount)}
                onKeyDown={(e) => handleKeyDown(e, "payment-amount")}
            placeholder="0.00"
            className="w-full pl-14 pr-10 py-3 border border-gray-200 font-mono text-right text-lg focus:outline-none focus:border-black transition-colors"
          />
          {salesAmount && (
            <button
              type="button"
              onClick={() => setSalesAmount("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Credit-specific fields */}
      {selectedPayment === 4 ? (
        <>
          {/* Customer */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Customer
            </label>
            <CustomerCombobox
              value={customerId}
              onSelect={(id, name) => {
                setCustomerId(id)
                setCustomerName(name)
              }}
            />
          </div>

          {/* Invoice Number */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Invoice Number
            </label>
            <div className="relative">
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e)}
                placeholder="INV-00001"
                className="w-full px-4 pr-10 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
              />
              {invoiceNumber && (
                <button
                  type="button"
                  onClick={() => setInvoiceNumber("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </>
      ) : /* Check-specific fields */
      selectedPayment === 3 ? (
        <>
          {/* Check Date */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Check Date
            </label>
            <Popover open={checkDateOpen} onOpenChange={setCheckDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full px-4 py-3 border border-gray-200 font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"
                >
                  <span className={checkDate ? "text-black" : "text-gray-400"}>
                    {checkDate ? format(parse(checkDate, "yyyy-MM-dd", new Date()), "PPP") : "Date"}
                  </span>
                  <CaretDown className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkDate ? parse(checkDate, "yyyy-MM-dd", new Date()) : undefined}
                  onSelect={(date) => {
                    setCheckDate(date ? format(date, "yyyy-MM-dd") : "")
                    setCheckDateOpen(false)
                  }}
                  defaultMonth={checkDate ? parse(checkDate, "yyyy-MM-dd", new Date()) : undefined}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Check Number */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Check Number
            </label>
            <div className="relative">
              <input
                id="check-number"
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "bank-name")}
                placeholder="000000"
                className="w-full px-4 pr-10 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
              />
              {checkNumber && (
                <button
                  type="button"
                  onClick={() => setCheckNumber("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bank Name and Branch */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Bank Name and Branch
            </label>
            <div className="relative">
              <input
                id="bank-name"
                type="text"
                value={bankNameBranch}
                onChange={(e) => setBankNameBranch(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "check-amount")}
                placeholder="e.g. BDO - Makati Branch"
                className="w-full px-4 pr-10 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
              />
              {bankNameBranch && (
                <button
                  type="button"
                  onClick={() => setBankNameBranch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Check Amount */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Check Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                PHP
              </span>
              <input
                id="check-amount"
                type="text"
                inputMode="decimal"
                value={checkAmount}
                onChange={(e) => handleCurrencyChange(e.target.value, setCheckAmount)}
                onKeyDown={(e) => handleKeyDown(e)}
                placeholder="0.00"
                className="w-full pl-14 pr-10 py-3 border border-gray-200 font-mono text-right text-lg focus:outline-none focus:border-black transition-colors"
              />
              {checkAmount && (
                <button
                  type="button"
                  onClick={() => setCheckAmount("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Payment Amount - For cash and gcash payments only */
        (selectedPayment === 1 || selectedPayment === 2) && (
          <div className="mb-6">
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Payment
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                PHP
              </span>
              <input
                id="payment-amount"
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => handleCurrencyChange(e.target.value, setPaymentAmount)}
                onKeyDown={(e) => handleKeyDown(e)}
                placeholder="0.00"
                className="w-full pl-14 pr-10 py-3 border border-gray-200 font-mono text-right text-lg focus:outline-none focus:border-black transition-colors"
              />
              {paymentAmount && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isFormDisabled || isSubmitting}
        className={`w-full py-3 font-mono tracking-wider uppercase text-sm transition-colors ${
          isFormDisabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {isSubmitting ? "Recording..." : "Record Payment"}
      </button>
    </form>
  )
}
