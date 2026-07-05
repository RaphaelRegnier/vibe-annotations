import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import Button from './Button'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb'
const GITHUB_URL = 'https://github.com/RaphaelRegnier/vibe-annotations'

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-[72px] pb-10">
        {/* CTA block */}
        <div className="flex flex-col items-center gap-[18px] text-center mb-14">
          <Image src="/mascot.png" alt="" width={56} height={56} className="w-14 h-14" />
          <h2 className="font-display font-[550] text-[clamp(28px,4vw,40px)] tracking-[-0.02em] text-white m-0">
            Ship the last 10% of your work
          </h2>
          <div className="flex gap-3.5 flex-wrap justify-center">
            <Button href={CHROME_STORE_URL} external size="lg" iconRight="heroicons:arrow-right">
              Download extension
            </Button>
          </div>
          <span className="font-mono text-[13px] text-white/50">$ npx vibe-annotations-server init</span>
        </div>

        {/* Bottom bar */}
        <div className="pt-7 border-t border-white/[0.12] flex flex-col-reverse gap-5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
          <span className="text-white/[0.46] text-[15px]">
            ©2026 <a href="https://www.spellbind.me/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Spellbind Creative Studio</a> · MIT · runs 100% locally
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/#agents" className="text-[#C7C7F2] hover:text-white text-[15px] font-medium transition-colors">How it works</Link>
            <Link href="/#toolset" className="text-[#C7C7F2] hover:text-white text-[15px] font-medium transition-colors">Features</Link>
            <Link href="/#faq" className="text-[#C7C7F2] hover:text-white text-[15px] font-medium transition-colors">FAQ</Link>
            <Link href="/docs" className="text-[#C7C7F2] hover:text-white text-[15px] font-medium transition-colors">Docs</Link>
            <Link href="/terms" className="text-[#C7C7F2] hover:text-white text-[15px] font-medium transition-colors">Terms</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-[#C7C7F2] hover:text-white transition-colors" aria-label="View Vibe Annotations source code on GitHub">
              <Icon icon="mdi:github" width={22} />
            </a>
            <a href="https://x.com/Raph_Regnier" target="_blank" rel="noopener noreferrer" className="text-[#C7C7F2] hover:text-white transition-colors" aria-label="Follow Raphael Regnier on X (Twitter)">
              <Icon icon="mdi:twitter" width={22} />
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
