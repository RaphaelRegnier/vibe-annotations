import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Release Notes' }

type Release = {
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
}

async function getReleases(): Promise<Release[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/RaphaelRegnier/vibe-annotations/releases?per_page=10',
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

function formatBody(body: string): string {
  // Basic markdown-to-HTML: headers, bold, lists, code, links
  return body
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-neutral-800 mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-neutral-800 mt-4 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-neutral-100 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#D03D68] hover:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '<br/>')
}

export default async function ReleasesPage() {
  const releases = await getReleases()

  if (releases.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Release Notes</h1>
        <p className="text-neutral-500">
          Unable to load releases. View them on{' '}
          <a href="https://github.com/RaphaelRegnier/vibe-annotations/releases" className="text-[#D03D68] hover:underline" target="_blank" rel="noopener">
            GitHub
          </a>.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Release Notes</h1>
      <div className="space-y-8">
        {releases.map((release) => (
          <div key={release.tag_name} className="border-b border-neutral-200 pb-6 last:border-0">
            <div className="flex items-baseline gap-3 mb-2">
              <a
                href={release.html_url}
                target="_blank"
                rel="noopener"
                className="text-base font-semibold text-neutral-900 hover:text-[#D03D68] transition-colors"
              >
                {release.name || release.tag_name}
              </a>
              <time className="text-xs text-neutral-400">
                {new Date(release.published_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
            </div>
            {release.body && (
              <div
                className="text-sm text-neutral-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatBody(release.body) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
