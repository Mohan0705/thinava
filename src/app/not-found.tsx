import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-thinava-bg px-4">
      <div className="max-w-md rounded-2xl border border-thinava-border bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wider text-thinava-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-thinava-text">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          The page you are looking for does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-thinava-primary px-6 text-sm font-semibold text-white transition hover:brightness-105"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}