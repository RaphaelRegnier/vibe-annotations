import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: {
    template: '%s — Vibe Annotations Docs',
    default: 'Documentation — Vibe Annotations',
  },
}

const NAV = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/installation', label: 'Installation' },
  { href: '/docs/mcp-setup', label: 'MCP Setup' },
  { href: '/docs/workflows', label: 'Workflows' },
  { href: '/docs/architecture', label: 'Architecture' },
  { href: '/docs/troubleshooting', label: 'Troubleshooting' },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFEFE]">
      <div className="mx-auto max-w-5xl px-6 py-12 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
        <nav className="mb-8 lg:mb-0">
          <Link href="/" className="mb-6 block text-sm font-medium text-neutral-400 hover:text-neutral-600 transition-colors">
            &larr; Home
          </Link>
          <ul className="space-y-1">
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="prose prose-neutral prose-headings:font-semibold prose-a:text-[#D03D68] prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm max-w-none">
          {children}
        </article>
      </div>
    </div>
  )
}
