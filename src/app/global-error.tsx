'use client'

import { useEffect } from 'react'
import { Icon } from '@iconify/react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="mb-8">
              <Icon icon="heroicons:exclamation-circle" className="w-24 h-24 text-red-500 mx-auto" />
            </div>
            
            {/* Error Message */}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Oops!</h1>
            <h2 className="text-xl font-medium text-gray-700 mb-6">Something went wrong</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => reset()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
              >
                <Icon icon="heroicons:arrow-path" className="w-5 h-5" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all"
              >
                <Icon icon="heroicons:home" className="w-5 h-5" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}