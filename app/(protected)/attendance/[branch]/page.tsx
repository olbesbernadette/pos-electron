"use client"

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AttendanceForm } from "@/components/attendance/attendance-form"
import { PayrollForm } from "@/components/attendance/payroll-form"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useBranch } from "@/hooks/use-branch"

export default function BranchAttendancePage() {
  const params = useParams()
  const branch = params.branch as string
  const { branch: data, isLoading } = useBranch(branch)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm tracking-wider">Loading...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm tracking-wider">Branch not found</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-wide">{data.name}</h1>
        <Link
          href="/attendance"
          className="hidden md:inline-flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="tracking-widest uppercase">Back to Attendance</span>
        </Link>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="mb-6">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendanceForm branchId={data.id} />
        </TabsContent>
        <TabsContent value="payroll">
          <PayrollForm branchId={data.id} />
        </TabsContent>
      </Tabs>
    </>
  )
}
