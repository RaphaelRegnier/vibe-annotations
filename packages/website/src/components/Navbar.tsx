import Image from 'next/image'
import Link from 'next/link'

export default function Navbar() {
  return (
    <header className="">
      <nav className="max-w-[1280px] mx-auto px-4 md:px-8 py-2" role="navigation" aria-label="Main navigation">
        <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-1.5 justify-self-start">
            <Link href="/" className="flex items-center gap-1.5">
              <Image
                src="/7abc3cfe8eddf5deb9ba63f8c454c1235fbc33c4.png"
                alt="Vibe Annotations Logo"
                width={34}
                height={34}
                className="rounded-lg"
              />
              <span className="text-[20.4px] font-semibold text-[#1f2431] tracking-[-0.408px] whitespace-nowrap">
                Vibe Annotations
              </span>
            </Link>
          </div>

          {/* Navigation Links - Hidden on smaller screens */}
          <div className="hidden lg:flex items-center gap-12 px-2 py-2 text-[15px] font-medium text-black">
            <a href="#how-it-works" className="hover:text-gray-600 transition-colors whitespace-nowrap">How it works</a>
            <a href="#features" className="hover:text-gray-600 transition-colors whitespace-nowrap">Features</a>
            <a href="#faq" className="hover:text-gray-600 transition-colors whitespace-nowrap">FAQ</a>
          </div>

          {/* GitHub Icon and CTA Button - Always visible */}
          <div className="flex items-center gap-4 justify-self-end px-2 py-2">
            <a 
              href="https://github.com/RaphaelRegnier/vibe-annotations" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="View Vibe Annotations source code on GitHub"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <a 
              href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:block bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-2 rounded-xl text-[15px] font-medium transition-all"
            >
              Get Extension
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}