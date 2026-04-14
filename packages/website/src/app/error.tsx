'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
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
          We&apos;re sorry, but something unexpected happened. Our team has been notified and we&apos;re working to fix the issue.
        </p>
        
        {/* Error Details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
            <p className="text-xs text-gray-600 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
          >
            <Icon icon="heroicons:arrow-path" className="w-5 h-5" />
            Try Again
          </button>
          
          <Link 
            href="/"
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all"
          >
            <Icon icon="heroicons:home" className="w-5 h-5" />
            Go Home
          </Link>
        </div>
        
        {/* Additional Help */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-4">Still having issues?</p>
          <div className="flex justify-center gap-6">
            <a 
              href="https://github.com/RaphaelRegnier/vibe-annotations/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Report Issue
            </a>
            <Link 
              href="/#faq"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}