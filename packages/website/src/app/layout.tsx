import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import '@/styles/globals.css'

const satoshi = localFont({
  src: '../fonts/Satoshi-Variable.ttf',
  weight: '300 900',
  style: 'normal',
  variable: '--font-satoshi',
  display: 'swap',
})

const cabinetGrotesk = localFont({
  src: '../fonts/CabinetGrotesk-Variable.ttf',
  weight: '100 900',
  style: 'normal',
  variable: '--font-cabinet',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // tint the mobile browser UI (status/address bar) to match the dark sections
  themeColor: '#000114',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://vibe-annotations.com'),
  title: 'Vibe Annotations - Visual Annotation Tool for AI Coding Agents',
  description: 'Annotate anything on your localhost and let your AI coding agent implement every fix in one batch. Works with Claude Code, Cursor, Windsurf, GitHub Copilot. Free, source-available, 100% local.',
  keywords: 'AI annotations, coding agents, Claude Code, Cursor, GitHub Copilot, Windsurf, visual feedback, developer tools, MCP, browser extension, local development, UI feedback, code automation',
  authors: [{ name: 'Vibe Annotations' }],
  alternates: {
    canonical: 'https://vibe-annotations.com',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon128.png', sizes: '128x128', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'Vibe Annotations - Visual Annotation Tool for AI Coding Agents',
    description: 'Annotate anything on your localhost and let your AI coding agent implement every fix in one batch. Works with Claude Code, Cursor, Windsurf, GitHub Copilot. Free, source-available, 100% local.',
    url: 'https://vibe-annotations.com',
    siteName: 'Vibe Annotations',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Vibe Annotations - AI-powered coding automation',
        type: 'image/jpeg',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vibe Annotations - Visual Annotation Tool for AI Coding Agents',
    description: 'Annotate anything on your localhost and let your AI coding agent implement every fix in one batch. Works with Claude Code, Cursor, Windsurf, GitHub Copilot. Free, source-available, 100% local.',
    images: ['/og-image.jpg'],
    site: '@Raph_Regnier',
    creator: '@Raph_Regnier',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${satoshi.variable} ${cabinetGrotesk.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Vibe Annotations",
              "description": "Annotate anything on your localhost and let your AI coding agent implement every fix in one batch. Works with Claude Code, Cursor, Windsurf, GitHub Copilot. Free, source-available, 100% local.",
              "url": "https://vibe-annotations.com",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web Browser",
              "browserRequirements": "Chrome, Edge, Brave, Opera, Vivaldi, Arc",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Spellbind Creative Studio",
                "url": "https://www.spellbind.me/"
              },
              "keywords": [
                "AI annotations",
                "coding agents",
                "Claude Code",
                "Cursor",
                "GitHub Copilot", 
                "Windsurf",
                "visual feedback",
                "developer tools",
                "MCP",
                "browser extension",
                "local development",
                "UI feedback",
                "code automation"
              ],
              "featureList": [
                "Visual annotation tool for websites",
                "AI coding agent integration",
                "Multi-page annotation support",
                "Local-first architecture",
                "Zero configuration setup",
                "Precision element targeting"
              ]
            })
          }}
        />
      </head>
      <body className={`${satoshi.className} antialiased overflow-x-hidden`} style={{ backgroundColor: '#FEFEFE' }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}