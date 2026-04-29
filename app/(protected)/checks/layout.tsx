import { Sidebar } from "@/components/sidebar"

export default function ChecksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <Sidebar basePath="/checks" />
      <section className="flex-1 px-8 py-12">
        {children}
      </section>
    </div>
  )
}
