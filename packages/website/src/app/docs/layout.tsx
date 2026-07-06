import type { Metadata } from 'next'
import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import Navbar from '@/components/Navbar'

function getExtensionVersion(): string {
  try {
    // WXT generates the manifest into .output/ at build time and sources its
    // version from the extension's package.json, so read that (the old
    // manifest.json at the extension root no longer exists post-WXT migration).
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '..', 'extension', 'package.json'), 'utf8')
    )
    return pkg.version
  } catch {
    return '1.6.3'
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
      { href: '/docs/workflows/design-edits', label: 'Design edits' },
      { href: '/docs/workflows/variants', label: 'Variant generation' },
      { href: '/docs/workflows/screenshots', label: 'Screenshots & images' },
      { href: '/docs/workflows/sharing', label: 'Sharing exports' },
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
      className="block rounded-md px-3 py-1.5 text-sm text-[#C7C7F2] hover:bg-white/5 hover:text-white transition-colors"
    >
      {label}
    </Link>
  )
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-white font-sans">
      <Navbar variant="dark" />
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-12 lg:max-w-none lg:px-0 lg:grid lg:grid-cols-[1fr_200px_48px_minmax(0,640px)_1fr] lg:gap-0">
        <div className="hidden lg:block" />{/* spacer col 1 */}
        <nav className="mb-8 lg:mb-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-8">
          <span className="block px-3 mb-1 text-xs font-medium text-white/40 uppercase tracking-wider">Overview</span>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} />
                {item.children && (
                  <ul className="ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-2">
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
            <span className="block px-3 mb-1 text-xs font-medium text-white/40 uppercase tracking-wider">Resources</span>
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
              className="block px-3 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              v{getExtensionVersion()}
            </a>
            <a
              href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof/reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-xs text-white/60 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors leading-relaxed"
            >
              Enjoying Vibe Annotations? <span className="text-accent-pink font-medium">Leave a review</span>
            </a>
          </div>
        </nav>
        <div className="hidden lg:block" />{/* gap column */}
        <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:font-[550] prose-a:text-[#9191FD] prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-ink-2 prose-pre:border prose-pre:border-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          {children}
        </article>
      </div>
    </div>
  )
}
