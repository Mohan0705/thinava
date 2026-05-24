export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-thinava-bg px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-thinava-border bg-white p-6 shadow-card">
        <div className="thinava-shimmer h-4 w-2/5 rounded-lg" />
        <div className="thinava-shimmer h-3 w-full rounded-lg" />
        <div className="thinava-shimmer h-3 w-4/5 rounded-lg" />
        <div className="thinava-shimmer mt-4 h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}