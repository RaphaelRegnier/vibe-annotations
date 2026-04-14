import type { Metadata } from 'next'
import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import Navbar from '@/components/Navbar'

function getExtensionVersion(): string {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '..', 'extension', 'manifest.json'), 'utf8')
    )
    return manifest.version
  } catch {
    return '1.6.2'
  }
}

export const metadata: Metadata = {
  title: {
    template: '%s — Vibe Annotations Docs',
    default: 'Documentation — Vibe Annotations',
  },
}

type NavItem = { href: string; label: string; children?: NavItem[] }

const NAV: NavItem[] = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/installation', label: 'Installation' },
  { href: '/docs/mcp-setup', label: 'MCP Setup' },
  {
    href: '/docs/workflows', label: 'Workflows', children: [
      { href: '/docs/workflows/copy-paste', label: 'Copy & paste' },
      { href: '/docs/workflows/mcp', label: 'Multi-page (MCP)' },
      { href: '/docs/workflows/watch-mode', label: 'Watch mode' },
      { href: '/docs/workflows/collaboration', label: 'Collaboration' },
      { href: '/docs/workflows/agents', label: 'Agent annotation' },
    ]
  },
  { href: '/docs/architecture', label: 'Architecture' },
]

const RESOURCES: NavItem[] = [
  { href: '/docs/releases', label: 'Release notes' },
  { href: '/docs/troubleshooting', label: 'Troubleshooting' },
  { href: '/docs/terms', label: 'Terms & conditions' },
  { href: '/docs/contact', label: 'Contact' },
]

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
    >
      {label}
    </Link>
  )
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFEFE]">
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-12 lg:max-w-none lg:px-0 lg:grid lg:grid-cols-[1fr_200px_48px_minmax(0,640px)_1fr] lg:gap-0">
        <div className="hidden lg:block" />{/* spacer col 1 */}
        <nav className="mb-8 lg:mb-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-8">
          <span className="block px-3 mb-1 text-xs font-medium text-neutral-400 uppercase tracking-wider">Overview</span>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} />
                {item.children && (
                  <ul className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <NavLink href={child.href} label={child.label} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <span className="block px-3 mb-1 text-xs font-medium text-neutral-400 uppercase tracking-wider">Resources</span>
            <ul className="space-y-1">
              {RESOURCES.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} label={item.label} />
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 space-y-3">
            <a
              href={`https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${getExtensionVersion()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              v{getExtensionVersion()}
            </a>
            <a
              href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof/reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-md transition-colors leading-relaxed"
            >
              Enjoying Vibe Annotations? <span className="text-[#D03D68] font-medium">Leave a review</span>
            </a>
          </div>
        </nav>
        <div className="hidden lg:block" />{/* gap column */}
        <article className="prose prose-neutral prose-headings:font-semibold prose-a:text-[#D03D68] prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-neutral-900 prose-pre:text-neutral-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 max-w-none">
          {children}
        </article>
      </div>
    </div>
  )
}
