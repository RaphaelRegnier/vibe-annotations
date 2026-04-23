import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@iconify/react'

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-16 pb-12">
        <div className="flex flex-col gap-16">
          {/* Main Content - Desktop: Two columns, Mobile: Stack */}
          <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
            
            {/* Left Column: Logo, Description, and Links */}
            <div className="flex flex-col gap-8 flex-1 max-w-[600px]">
              {/* Logo and Supporting Text */}
              <div className="flex flex-col gap-8">
                {/* Logo */}
                <div className="flex items-center gap-1.5">
                  <Image
                    src="/7abc3cfe8eddf5deb9ba63f8c454c1235fbc33c4.png"
                    alt="Vibe Annotations Logo"
                    width={32}
                    height={32}
                    className="rounded-lg"
                  />
                  <span className="text-[20.4px] font-semibold text-[#1f2431] tracking-[-0.408px]">
                    Vibe Annotations
                  </span>
                </div>
                
                {/* Supporting Text */}
                <p className="text-base text-[#535862] leading-6">
                  Drop visual annotations on your site and watch AI coding agents handle every fix instantly. Never leave your browser, everything runs locally and stays secure.
                </p>
              </div>

              {/* Footer Links */}
              <nav className="flex flex-wrap gap-8 items-center">
                <a href="#how-it-works" className="text-[15px] font-medium text-black hover:text-gray-600 transition-colors">
                  How it works
                </a>
                <a href="#features" className="text-[15px] font-medium text-black hover:text-gray-600 transition-colors">
                  Features
                </a>
                <a href="#faq" className="text-[15px] font-medium text-black hover:text-gray-600 transition-colors">
                  FAQ
                </a>
                <Link href="/terms" className="text-[15px] font-medium text-black hover:text-gray-600 transition-colors">
                  Terms
                </Link>
                <a href="https://github.com/RaphaelRegnier/vibe-annotations" target="_blank" rel="noopener noreferrer" className="text-[15px] font-medium text-black hover:text-gray-600 transition-colors">
                  GitHub
                </a>
              </nav>
            </div>

            {/* Right Column: Get Extension Section */}
            <div className="flex flex-col gap-4 items-center">
              <p className="text-base font-medium text-red-600 leading-6">
                Chromium extension
              </p>
              <div className="flex flex-col gap-4">
                <a 
                  href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl text-base font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  <Icon icon="heroicons:arrow-down-tray" className="w-5 h-5" />
                  Get the extension
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-between pt-8 border-t border-[#e9eaeb]">
            {/* Copyright */}
            <p className="text-base text-[#717680] leading-6">
              © 2025 Raphael Regnier - <a href="https://www.spellbind.me/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">Spellbind Creative Studio</a>. All rights reserved.
            </p>
            
            {/* Social Icons */}
            <div className="flex gap-6 items-center">
              <a href="https://github.com/RaphaelRegnier/vibe-annotations" target="_blank" rel="noopener noreferrer" className="text-[#717680] hover:text-gray-900 transition-colors" aria-label="View Vibe Annotations source code on GitHub">
                <Icon icon="mdi:github" className="w-6 h-6" />
              </a>
              <a href="https://x.com/Raph_Regnier" target="_blank" rel="noopener noreferrer" className="text-[#717680] hover:text-gray-900 transition-colors" aria-label="Follow Raphael Regnier on X (Twitter)">
                <Icon icon="mdi:twitter" className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}