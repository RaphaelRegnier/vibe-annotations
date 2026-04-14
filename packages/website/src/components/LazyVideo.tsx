'use client'

import { useState } from 'react'

export default function LazyVideo({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="mt-3 mb-2 rounded-lg w-full max-w-xl"
      />
    )
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="mt-3 mb-2 w-full max-w-xl aspect-video rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer group"
    >
      <div className="w-14 h-14 rounded-full bg-white/90 shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-700 ml-1">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
    </button>
  )
}
