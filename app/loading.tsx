export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">Loading...</p>
      </div>
    </div>
  )
}
