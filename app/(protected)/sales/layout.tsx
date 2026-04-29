import { Sidebar } from "@/components/sidebar"

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <Sidebar basePath="/sales" />
      <section className="flex-1 px-8 py-12">
        {children}
      </section>
    </div>
  )
}
