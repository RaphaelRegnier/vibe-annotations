'use client'

export default function LazyVideo({ src, releaseUrl }: { src: string; releaseUrl?: string }) {
  return (
    <a
      href={releaseUrl || src}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 mb-2 w-full max-w-xl aspect-video rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors cursor-pointer group no-underline"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-700 ml-1">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <span className="text-xs text-neutral-400 group-hover:text-neutral-600 transition-colors">Watch on GitHub</span>
      </div>
    </a>
  )
}
