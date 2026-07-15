import type { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'

// Canonical domain — matches metadataBase in layout.tsx / robots.txt / llms.txt.
const BASE_URL = 'https://vibe-annotations.com'

// Routes that render a page file but must NOT appear in the sitemap.
// /terms is only a redirect() to /docs/terms, so it isn't a real destination.
const EXCLUDE = new Set(['/terms'])

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/

// Walk the App Router tree and collect every route that has a page file.
function collectRoutes(dir: string, route = ''): string[] {
  const routes: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  if (entries.some((e) => e.isFile() && PAGE_FILE.test(e.name))) {
    routes.push(route === '' ? '/' : route)
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // Skip route groups "(group)", dynamic "[slug]", and private "_dir" folders.
    if (/^[([_]/.test(entry.name)) continue
    routes.push(...collectRoutes(path.join(dir, entry.name), `${route}/${entry.name}`))
  }

  return routes
}

// Google ignores <priority>/<changefreq>, but keeping them costs nothing and
// mirrors the previous hand-written sitemap's intent.
function metaFor(route: string): Pick<MetadataRoute.Sitemap[number], 'changeFrequency' | 'priority'> {
  if (route === '/') return { changeFrequency: 'weekly', priority: 1.0 }
  if (route === '/docs') return { changeFrequency: 'weekly', priority: 0.9 }
  if (route === '/docs/releases') return { changeFrequency: 'weekly', priority: 0.5 }
  if (route === '/docs/terms' || route === '/docs/contact') return { changeFrequency: 'yearly', priority: 0.3 }

  const depth = route.split('/').filter(Boolean).length
  if (depth === 2) return { changeFrequency: 'monthly', priority: 0.8 } // /docs/installation, /docs/mcp-setup…
  if (route === '/docs/workflows' || route === '/docs/benchmark') return { changeFrequency: 'monthly', priority: 0.7 }
  return { changeFrequency: 'monthly', priority: 0.6 }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const appDir = path.join(process.cwd(), 'src', 'app')

  return collectRoutes(appDir)
    .filter((route) => !EXCLUDE.has(route))
    .sort()
    .map((route) => ({
      url: `${BASE_URL}${route === '/' ? '' : route}`,
      ...metaFor(route),
    }))
}
