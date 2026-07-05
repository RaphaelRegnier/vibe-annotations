import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import Button from './Button'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb'
const GITHUB_URL = 'https://github.com/RaphaelRegnier/vibe-annotations'

export default function Navbar({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const dark = variant === 'dark'
  const linkClasses = dark
    ? 'text-[#C7C7F2] hover:text-white transition-colors whitespace-nowrap'
    : 'hover:text-gray-600 transition-colors whitespace-nowrap'

  return (
    <header className={dark ? 'relative z-10' : ''}>
      <nav className="max-w-[1280px] mx-auto px-4 md:px-8 py-3" role="navigation" aria-label="Main navigation">
        <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-1.5 justify-self-start">
            <Link href="/" className="flex items-center">
              <Image
                src={dark ? '/logo-lockup-dark.png' : '/logo-lockup.png'}
                alt="Vibe Annotations"
                width={870}
                height={329}
                priority
                className="h-12 w-auto"
              />
            </Link>
          </div>

          {/* Navigation Links - Hidden on smaller screens */}
          <div className={`hidden lg:flex items-center gap-12 px-2 py-2 text-[15px] font-medium ${dark ? '' : 'text-black'}`}>
            <Link href="/#agents" className={linkClasses}>How it works</Link>
            <Link href="/#toolset" className={linkClasses}>Features</Link>
            <Link href="/#faq" className={linkClasses}>FAQ</Link>
            <Link href="/docs" className={linkClasses}>Documentation</Link>
          </div>

          {/* GitHub Icon and CTA Button - Always visible */}
          <div className="flex items-center gap-5 justify-self-end">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={dark ? 'text-[#C7C7F2] hover:text-white transition-colors' : 'text-gray-600 hover:text-gray-900 transition-colors'}
              aria-label="View Vibe Annotations source code on GitHub"
            >
              <Icon icon="mdi:github" width={22} />
            </a>
            {dark ? (
              <span className="hidden md:block">
                <Button href={CHROME_STORE_URL} external size="md">Download</Button>
              </span>
            ) : (
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block bg-gradient-brand hover:bg-gradient-brand-hover text-white px-4 py-2 rounded-full text-[15px] font-medium transition-all"
              >
                Get Extension
              </a>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
