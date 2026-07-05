'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Button from '@/components/Button'
import content from '@/data/content.json'
import s from './home.module.css'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb'
const GITHUB_URL = 'https://github.com/RaphaelRegnier/vibe-annotations'

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
}

const scrollFadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
}

/* ============ animated hero demo (16s CSS loop, see home.module.css) ============ */
function HeroDemo({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={wrapRef} className={s.dwrap}>
      <div className={s.dglow} aria-hidden />
      <div className={s.dframe}>
        <div className={s.demo}>
        <div className={s.dmain}>
          {/* browser mockup */}
          <div className={s.dbrowser}>
            <div className={s.dtop}>
              <span className={s.ddot} style={{ background: '#ff5f57' }} />
              <span className={s.ddot} style={{ background: '#febc2e' }} />
              <span className={s.ddot} style={{ background: '#28c840' }} />
              <div className={s.durl}>localhost:3000</div>
            </div>
            <div className={s.dpage}>
              <div className="flex items-center gap-3.5 mb-5">
                <div className={s.skl} style={{ width: 34, height: 34, borderRadius: '50%' }} />
                <div className="flex gap-3 ml-auto">
                  <div className={s.skl} style={{ width: 38, height: 8 }} />
                  <div className={s.skl} style={{ width: 38, height: 8 }} />
                  <div className={s.skl} style={{ width: 38, height: 8 }} />
                </div>
                <div className={s.skl} style={{ width: 80, height: 26, borderRadius: 8, marginLeft: 12 }} />
              </div>
              <div className={s.skcard} style={{ display: 'flex', gap: 22, padding: 20, marginBottom: 16 }}>
                <div className="flex flex-col gap-2.5 justify-center" style={{ flex: 1.2 }}>
                  <div className={s.skl} style={{ width: '70%', height: 16 }} />
                  <div className={s.skl} style={{ width: '88%', height: 9 }} />
                  <div className={s.skl} style={{ width: '62%', height: 9 }} />
                  <div className="flex gap-2.5 mt-2">
                    <div className={s.skl} style={{ width: 86, height: 28, borderRadius: 8 }} />
                    <div className={s.skl} style={{ width: 86, height: 28, borderRadius: 8, opacity: 0.5 }} />
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center rounded-[10px]" style={{ minHeight: 132, background: 'rgba(255,255,255,0.06)' }}>
                  <Icon icon="heroicons:photo" width={36} style={{ color: 'rgba(255,255,255,0.22)' }} />
                </div>
              </div>
              <div className="flex gap-4">
                {[
                  ['84%', '58%'],
                  ['78%', '52%'],
                  ['86%', '60%'],
                ].map(([w1, w2], i) => (
                  <div key={i} className={s.skcard} style={{ flex: 1, padding: 16 }}>
                    <div className={s.skl} style={{ width: 30, height: 30, borderRadius: '50%', marginBottom: 12 }} />
                    <div className={s.skl} style={{ width: w1, height: 8, marginBottom: 8 }} />
                    <div className={s.skl} style={{ width: w2, height: 8 }} />
                  </div>
                ))}
              </div>
              {/* annotation pins + bubbles — each message is centered 14px above its badge (consistent) */}
              <div className={`${s.pin} ${s.p1}`} style={{ left: 130, top: 150 }}>1</div>
              <div className={`${s.bub} ${s.b1}`} style={{ left: 35, top: 54 }}>
                <div className={s.meta}><Icon icon="heroicons:code-bracket" width={13} /> .stats-card · @1440w</div>
                <div className={s.txt}>Padding feels off, tighten to 16px</div>
              </div>
              <div className={`${s.pin} ${s.p2}`} style={{ left: 472, top: 300 }}>2</div>
              <div className={`${s.bub} ${s.b2}`} style={{ left: 377, top: 204 }}>
                <div className={s.meta}><Icon icon="heroicons:code-bracket" width={13} /> p.lede</div>
                <div className={s.txt}>This line reads too long, cut it</div>
              </div>
              <div className={`${s.pin} ${s.p3}`} style={{ left: 560, top: 128 }}>3</div>
              <div className={`${s.bub} ${s.b3}`} style={{ left: 465, top: 32 }}>
                <div className={s.meta}><Icon icon="heroicons:code-bracket" width={13} /> .hero-media</div>
                <div className={s.txt}>Swap this placeholder for the product shot</div>
              </div>
            </div>
            {/* extension toolbar */}
            <div className={s.vabar}>
              <Image src="/mascot.png" width={22} height={22} alt="Vibe Annotations" />
              <span className={s.vsep} />
              <span className={`${s.vb} ${s.vba}`}><Icon icon="heroicons:pencil-square" width={16} /> Annotate</span>
              <span className={s.vb}><Icon icon="heroicons:bars-3" width={16} /> View all</span>
              <span className={s.vb}><Icon icon="heroicons:cog-6-tooth" width={16} /> Settings</span>
            </div>
          </div>
          {/* right column: queue + prompt */}
          <div className={s.dright}>
            <div className={s.dqueue}>
              <div className={s.qhead}><Image src="/mascot.png" width={20} height={20} alt="" /> Annotation queue</div>
              <div className={`${s.qi} ${s.q1}`}><span className={s.qn}>1</span><span className={s.qt}>.stats-card · tighten padding</span><span className={`${s.ck} ${s.k1}`}><Icon icon="heroicons:check-circle-solid" width={17} /></span></div>
              <div className={`${s.qi} ${s.q2}`}><span className={s.qn}>2</span><span className={s.qt}>p.lede · shorten line</span><span className={`${s.ck} ${s.k2}`}><Icon icon="heroicons:check-circle-solid" width={17} /></span></div>
              <div className={`${s.qi} ${s.q3}`}><span className={s.qn}>3</span><span className={s.qt}>.hero-media · product shot</span><span className={`${s.ck} ${s.k3}`}><Icon icon="heroicons:check-circle-solid" width={17} /></span></div>
            </div>
            <div className={s.dpanel}>
              <div className={s.dbadges}>
                <span className={s.badge}><Icon icon="simple-icons:claude" width={20} /> Claude Code</span>
                <span className={s.badge}><Icon icon="simple-icons:githubcopilot" width={20} /> Copilot</span>
                <span className={s.badge}><Icon icon="simple-icons:windsurf" width={20} /> Windsurf</span>
                <span className={s.badge}><Icon icon="simple-icons:openai" width={20} /> Codex</span>
              </div>
              <div className={s.dprompt}>
                <span className={s.dph}>Ask anything…</span>
                <span className={s.tw}>Read my annotations</span>
                <span className={s.twc} />
                <span className={s.dsend}><Icon icon="heroicons:arrow-up" width={17} /></span>
              </div>
            </div>
          </div>
        </div>
        {/* animated cursor — on-brand gradient pointer */}
        <div className={s.cur}>
          <span className={s.curRing} aria-hidden />
          <Image src="/cursor-brand.png" alt="" width={22} height={28} className={s.curImg} />
        </div>
        </div>
      </div>
    </div>
  )
}

/* ============ features bento — one component per card, layout from the reference ============ */
function FeatureText({ item }: { item: { lead: string; rest: string } }) {
  return (
    <div className={s.ftxt}>
      <p><strong>{item.lead}</strong> {item.rest}</p>
    </div>
  )
}

/* numbered annotation badge, sitting directly on the element it marks (like a real pin) */
function AnnBadge({ n, style }: { n: number; style?: React.CSSProperties }) {
  return <span className={`${s.pin} ${s.pinStatic} ${s.badgeOn}`} style={style} aria-hidden>{n}</span>
}

/* card 1 — annotated browser window + DOM-selector popup */
function ContextCard() {
  const t = content.toolset.items.context
  return (
    <div className={`${s.fcard} lg:col-span-3`}>
      <div className={s.fsplit}>
        <FeatureText item={t} />
        <div className={`${s.fviz} ${s.ctxViz}`}>
          <div className={s.ctxWin}>
            <div className={s.ctxBar}><span /><span /><span /></div>
            <div className={s.ctxBody}>
              <div className={s.ctxSel}>
                <div className={s.ctxHeadline}>Get all your AI feedbacks implemented at once</div>
                <AnnBadge n={1} />
              </div>
              <div className={s.sklw} style={{ width: '68%', height: 7, margin: '16px auto 0' }} />
              <div className={s.sklw} style={{ width: '48%', height: 7, margin: '7px auto 0' }} />
              <div className="flex gap-2 justify-center" style={{ marginTop: 13 }}>
                <div className={s.sklw} style={{ width: 60, height: 20, borderRadius: 6 }} />
                <div className={s.sklw} style={{ width: 60, height: 20, borderRadius: 6, opacity: 0.5 }} />
              </div>
            </div>
          </div>
          <svg className={s.thread} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M 56 58 C 83 56, 93 44, 88 25" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className={s.selCard}>
            <div className={s.selHead}>
              div.home_stepCard__0vB50
              <Icon icon="heroicons:x-mark" width={13} />
            </div>
            <div className={s.selRow}><span>Component</span><b style={{ color: '#c084fc' }}>Home</b></div>
            <div className={s.selRow}><span>Selector</span><b>div.max-w-4xl.mx-auto &gt; div.text-center</b></div>
            <div className={s.selRow}><span>Element</span><b><em>div</em> &ldquo;Get all your AI feedbacks…&rdquo;</b></div>
            <div className={s.selComment}>
              <Icon icon="heroicons:chat-bubble-left-solid" width={13} className="text-white" />
              Make this headline pop a bit more
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* card 2 — the Figma-like design panel; the Gap field live-drives the skeleton behind it */
function DesignEditsCard() {
  const [gap, setGap] = useState(16)
  const t = content.toolset.items.designEdits
  return (
    <div className={`${s.fcard} lg:col-span-3`}>
      <div className={s.fsplit}>
        <FeatureText item={t} />
        <div className={`${s.fviz} ${s.deViz}`}>
          <div className={s.deSkel}>
            <AnnBadge n={2} />
            <div className={s.deSkelBlock} />
            <div className={s.deSkelBlock} style={{ marginTop: gap }} />
          </div>
          <svg className={`${s.thread} ${s.deThread}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M 43 45 C 34 47, 29 50, 27 55" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className={s.dePanel}>
            <div className={s.deTitle}>Editing <b>div.home_stepCard__0vB50</b></div>
            <div className={s.deTabs}>
              <span className={s.deTab}><Icon icon="heroicons:chat-bubble-left" width={12} /> Comment</span>
              <span className={`${s.deTab} ${s.deTabOn}`}><Icon icon="heroicons:adjustments-horizontal" width={12} /> Design</span>
              <span className={s.deTab}><Icon icon="heroicons:squares-2x2" width={12} /> Variants</span>
            </div>
            <div className={s.deSection}><Icon icon="heroicons:chevron-down" width={11} /> Layout</div>
            <div className={s.deSeg}>
              <span><Icon icon="heroicons:stop" width={13} /></span>
              <span><Icon icon="heroicons:bars-3" width={13} /></span>
              <span className={s.deSegOn}><Icon icon="heroicons:bars-3" width={13} style={{ transform: 'rotate(90deg)' }} /></span>
              <span><Icon icon="heroicons:squares-2x2" width={13} /></span>
            </div>
            <div className={s.deMid}>
              <div className={s.dePad}>{Array.from({ length: 9 }).map((_, i) => <span key={i} />)}</div>
              <div className="flex flex-col gap-2.5">
                <span className={s.deChk}><i />Reverse order</span>
                <span className={s.deChk}><i />Wrap items</span>
                <span className={s.deChk}><i />Space auto</span>
              </div>
            </div>
            <div className={s.deGap}>
              Gap space
              <label className={s.deVal}>
                <span className={s.deTry}>Try it<i /></span>
                {/* touch devices get +/- steppers (no on-screen keyboard); desktop keeps the editable field */}
                <button type="button" className={s.deStep} onClick={() => setGap((g) => Math.max(0, g - 2))} aria-label="Decrease gap">−</button>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
                  aria-label="Gap space in pixels"
                />
                <span className={s.deNum}>{gap}</span>
                <i>px</i>
                <button type="button" className={s.deStep} onClick={() => setGap((g) => Math.min(40, g + 2))} aria-label="Increase gap">+</button>
              </label>
            </div>
            <div className={s.deFoot}>
              <span className={s.deVp}><Icon icon="heroicons:computer-desktop" width={13} /> 1512w</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* card 4 — html/md export: file glyph → export panel */
function ShareCard() {
  const t = content.toolset.items.share
  return (
    <div className={`${s.fcard} lg:col-span-2`}>
      <FeatureText item={t} />
      <div className={s.shViz}>
        <div className={s.shFile}>
          <div className={s.shDoc}>
            <span className={s.shFold} />
            <Icon icon="heroicons:code-bracket" width={28} />
          </div>
          <span className={s.shTag}>annotations.html</span>
        </div>
        <span className={s.shArrow} />
        <div className={s.shPanel}>
          <div className={s.shTitle}>Vibe Annotations</div>
          <div className={s.shSub}>7 annotations</div>
          {[1, 2].map((n) => (
            <div key={n} className={s.shRow}>
              <span className={`${s.pin} ${s.pinStatic}`} style={{ position: 'static', width: 18, height: 18, fontSize: 10 }}>{n}</span>
              <span className={s.shThumb}><i /><i /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* card 5 — screenshot thumbnail wall (placeholder tiles for now) */
function ScreenshotsCard() {
  const t = content.toolset.items.screenshots
  return (
    <div className={`${s.fcard} lg:col-span-2`}>
      <FeatureText item={t} />
      <div className={s.scViz}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${s.scTile} ${i === 0 ? s.scTileOn : ''}`}>
            <Icon icon="heroicons:photo" width={18} />
            {i === 0 && <span className={s.scBadge}><Icon icon="heroicons:camera-solid" width={14} /></span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* card 6 — extension window → local server terminal */
function InstallCard() {
  const t = content.toolset.items.install
  return (
    <div className={`${s.fcard} lg:col-span-2`}>
      <FeatureText item={t} />
      <div className={s.inViz}>
        <div className={`${s.inWin} ${s.inExt}`}>
          <div className={`${s.inBar} ${s.inBarLights}`}><i /><i /><i /></div>
          <div className={s.inExtBody}>
            <div className="flex flex-col gap-2 flex-1">
              <span className={s.sklw} style={{ width: '92%', height: 7 }} />
              <span className={s.sklw} style={{ width: '64%', height: 7 }} />
              <span className={s.sklw} style={{ width: '80%', height: 7 }} />
              <span className={s.sklw} style={{ width: '48%', height: 7 }} />
            </div>
            <span className={s.inPuzzle}><Icon icon="heroicons:puzzle-piece-solid" width={22} /></span>
          </div>
        </div>
        <span className={s.inLink} />
        <div className={s.inWin}>
          <div className={s.inBar}><i /><i /><i /></div>
          <div className={s.inTermBody}>
            <div>$ npx vibe-annotations-server</div>
            <div className={s.inOk}>✓ Server running at<br />&nbsp;&nbsp;http://localhost:3846</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* card 7 — "and more…" icon grid */
function MoreCard() {
  const t = content.toolset.items.more
  return (
    <div className={`${s.fcard} lg:col-span-2`}>
      <div className={s.ftxt}>
        <p><strong>{t.lead}</strong></p>
      </div>
      <div className={s.moreGrid}>
        {t.features.map((f) => (
          <div key={f.label} className={s.moreItem}>
            <span className={s.moreIco}><Icon icon={f.icon} width={18} /></span>
            {f.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* card 3 — interactive variants preview: picking an option switches the skeleton below */
const VARIANT_OPTIONS = [
  {
    label: 'Left and right',
    glyph: <span className={`${s.vIco} ${s.vIcoCols}`}><i /><i /></span>,
    preview: (
      <div className="flex gap-3">
        {[0, 1].map((c) => (
          <div key={c} className="flex-1 flex flex-col gap-2">
            <div className={s.sklw} style={{ height: 64, borderRadius: 8, background: 'rgba(255,255,255,0.14)' }} />
            <div className={s.sklw} style={{ width: '86%', height: 7 }} />
            <div className={s.sklw} style={{ width: '58%', height: 7 }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Centered title',
    glyph: <span className={`${s.vIco} ${s.vIcoCenter}`}><i /><i /></span>,
    preview: (
      <div className="flex flex-col items-center gap-2">
        <div style={{ width: '58%', height: 26, borderRadius: 7, background: 'rgba(160,38,220,0.55)' }} />
        <div className={s.sklw} style={{ width: '74%', height: 7 }} />
        <div className={s.sklw} style={{ width: '48%', height: 7 }} />
        <div className="flex gap-2 w-full" style={{ marginTop: 8 }}>
          {[0, 1, 2].map((c) => (
            <div key={c} className={s.sklw} style={{ flex: 1, height: 34, borderRadius: 7, background: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    label: 'Creative grid',
    glyph: <span className={`${s.vIco} ${s.vIcoGrid}`}><i /><i /><i /><i /></span>,
    preview: (
      <div className="grid grid-cols-2 gap-2.5">
        <div className={s.sklw} style={{ height: 68, borderRadius: 8, background: 'rgba(160,38,220,0.4)' }} />
        <div className={s.sklw} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.14)', alignSelf: 'end' }} />
        <div className={s.sklw} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.14)' }} />
        <div className={s.sklw} style={{ height: 68, borderRadius: 8, background: 'rgba(255,255,255,0.09)' }} />
      </div>
    ),
  },
]

/* the rest of the mock page below the variant zone — taller than the preview box
   on purpose, so it crops at the bottom edge like a real page would */
const VARIANT_PAGE_FILLER = (
  <>
    <div className={s.sklw} style={{ width: '100%', height: 8 }} />
    <div className={s.sklw} style={{ width: '82%', height: 8 }} />
    <div className="flex gap-2.5" style={{ marginTop: 4 }}>
      <div className={s.sklw} style={{ flex: 1, height: 96, borderRadius: 8 }} />
      <div className={s.sklw} style={{ flex: 1, height: 96, borderRadius: 8 }} />
    </div>
    <div className={s.sklw} style={{ width: '64%', height: 8, marginTop: 4 }} />
    <div className={s.sklw} style={{ width: '90%', height: 8 }} />
  </>
)

function VariantsCard() {
  const [variant, setVariant] = useState(1)
  const t = content.toolset.items.variants
  return (
    <div className={`${s.fcard} lg:col-span-2 lg:row-span-2`}>
      <FeatureText item={t} />
      <div className={s.vViz} role="radiogroup" aria-label="Component variants">
        {VARIANT_OPTIONS.map((opt, i) => (
          <button
            key={opt.label}
            type="button"
            className={`${s.vOpt} ${variant === i ? s.vOptOn : ''}`}
            onClick={() => setVariant(i)}
            role="radio"
            aria-checked={variant === i}
          >
            <span className={s.vdot}>{variant === i && <span className={s.vfill} />}</span>
            <span className={s.vChip}>{opt.glyph}{opt.label}</span>
          </button>
        ))}
        <div className={s.vThreadWrap} aria-hidden>
          <svg className={s.vThread} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 22 0 C 30 46, 46 74, 50 100" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className={s.vPrevWrap}>
          <AnnBadge n={3} style={{ left: '50%', right: 'auto', top: -11, transform: 'translateX(-50%)' }} />
          <div className={s.vPrev}>
            <div key={variant} className={s.vPrevIn}>
              {VARIANT_OPTIONS[variant].preview}
              {VARIANT_PAGE_FILLER}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* the assembled grid — top: two wide cards; below: variants spans two rows on the left */
function FeaturesBento() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-5">
      <ContextCard />
      <DesignEditsCard />
      <VariantsCard />
      <ShareCard />
      <ScreenshotsCard />
      <InstallCard />
      <MoreCard />
    </div>
  )
}

/* ============ npx command chip with copy-to-clipboard ============ */
function CommandChip() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content.hero.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="inline-flex items-center gap-2.5 pl-5 pr-2 py-1.5 rounded-full bg-white/5 border border-white/[0.12] font-mono text-[15px] text-white/85">
      <span className="text-accent-pink">$</span>
      <span className="whitespace-nowrap">{content.hero.command}</span>
      <span className="hidden sm:inline text-white/40 font-sans text-[14px] whitespace-nowrap">· {content.hero.commandHint}</span>
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="ml-0.5 w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Icon icon={copied ? 'heroicons:check' : 'heroicons:clipboard-document'} width={16} />
      </button>
    </div>
  )
}

/* shared section overline — dark pill, hairline border, gradient uppercase text */
function Overline({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative z-10 inline-flex items-center rounded-[10px] border border-white/10 bg-[#0b0a16] px-4 py-1.5 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] bg-gradient-brand bg-clip-text text-transparent">
        {children}
      </span>
    </span>
  )
}

export default function Home() {
  const demoWrapRef = useRef<HTMLDivElement>(null)
  // the demo's internal layout (pins, bubbles, cursor keyframes) is authored in px
  // and scaled uniformly to fit width (--ds consumed by .demo/.dframe in the CSS).
  // Desktop uses the 1076×600 landscape canvas; ≤640px switches to a taller portrait
  // canvas (760×760, see the mobile block in home.module.css) that stacks the prompt
  // panel below the browser and hides the queue — so the px-positioned pins stay
  // coherent instead of shrinking to an unreadable landscape thumbnail.
  useEffect(() => {
    const el = demoWrapRef.current
    if (!el) return
    const compute = () => {
      const designW = window.matchMedia('(max-width: 640px)').matches ? 760 : 1076
      el.style.setProperty('--ds', String(Math.min(1, (el.clientWidth - 4) / designW)))
    }
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    compute()
    return () => ro.disconnect()
  }, [])
  const heroSceneRef = useRef<HTMLDivElement>(null)
  const heroLeftRef = useRef<HTMLDivElement>(null)
  const heroRightRef = useRef<HTMLDivElement>(null)
  // holo sheen: publish the cursor position (local px) + a proximity engagement (0→1)
  // onto each hero half, so the light grazes strongest when the cursor is over/near it
  const setHolo = (el: HTMLDivElement | null, e: React.MouseEvent<HTMLElement>) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    el.style.setProperty('--hue', `${(fx - 0.5) * 90}deg`)
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
    el.style.setProperty('--holo', String(Math.max(0, 1 - Math.hypot(dx, dy) / 900)))
  }
  // shimmer + glow engage as the cursor nears the demo frame — even from outside it
  const trackShimmer = (e: React.MouseEvent<HTMLElement>) => {
    setHolo(heroLeftRef.current, e)
    setHolo(heroRightRef.current, e)
    // subtle whole-scene parallax tilt from the cursor's offset to the scene centre
    const scene = heroSceneRef.current
    if (scene) {
      const sr = scene.getBoundingClientRect()
      const nx = Math.max(-1, Math.min(1, ((e.clientX - sr.left) / sr.width - 0.5) * 2))
      const ny = Math.max(-1, Math.min(1, ((e.clientY - sr.top) / sr.height - 0.5) * 2))
      // reversed: the side nearest the cursor tilts toward the viewer (surfaces into the light)
      scene.style.setProperty('--ry', `${-nx * 0.5}deg`)
      scene.style.setProperty('--rx', `${ny * 0.35}deg`)
    }
    const el = demoWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = Math.max(r.left, Math.min(e.clientX, r.right))
    const cy = Math.max(r.top, Math.min(e.clientY, r.bottom))
    el.style.setProperty('--sx', `${cx - r.left}px`)
    el.style.setProperty('--sy', `${cy - r.top}px`)
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
    const dist = Math.hypot(dx, dy)
    el.style.setProperty('--shimmer', String(Math.max(0, 1 - dist / 260)))
  }
  const endShimmer = () => {
    demoWrapRef.current?.style.setProperty('--shimmer', '0')
    heroLeftRef.current?.style.setProperty('--holo', '0')
    heroRightRef.current?.style.setProperty('--holo', '0')
    heroSceneRef.current?.style.setProperty('--ry', '0deg')
    heroSceneRef.current?.style.setProperty('--rx', '0deg')
  }
  return (
    <div className="bg-ink text-white font-sans">
      {/* ============ HERO ============ */}
      <section
        className="relative overflow-hidden"
        style={{ background: '#000114' }}
        onMouseMove={trackShimmer}
        onMouseLeave={endShimmer}
      >
        {/* floating cards scene — split into two edge-anchored halves so the center stays
            open. Each half hugs its side and fades toward the middle + bottom. Tune the
            widths / max-w below to spread them further apart or pull them in. */}
        <div
          ref={heroSceneRef}
          aria-hidden
          className={`${s.heroScene} absolute top-0 left-1/2 w-full max-w-[1700px] h-full pointer-events-none z-[1]`}
        >
          {/* left — mascot + comment cards, hugging the left edge (nudged further out) */}
          <div
            ref={heroLeftRef}
            className="absolute top-0 left-[-4%] w-[42%] max-w-[600px] aspect-[900/1405] bg-cover bg-left-top"
            style={{
              isolation: 'isolate',
              backgroundImage: 'url(/hero-left.jpg)',
              WebkitMaskImage:
                'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, #000 9%, #000 60%, transparent 100%), linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0.55) 84%, rgba(0,0,0,0.2) 93%, transparent 100%)',
              WebkitMaskComposite: 'source-in',
              maskImage:
                'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, #000 9%, #000 60%, transparent 100%), linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0.55) 84%, rgba(0,0,0,0.2) 93%, transparent 100%)',
              maskComposite: 'intersect',
            }}
          >
            <div className={s.holoChroma} />
            <div className={s.holo} />
          </div>
          {/* right — stacked cards, hugging the right edge (nudged further out) */}
          <div
            ref={heroRightRef}
            className="absolute top-0 right-[-4%] w-[42%] max-w-[600px] aspect-[900/1405] bg-cover bg-right-top"
            style={{
              isolation: 'isolate',
              backgroundImage: 'url(/hero-right.jpg)',
              WebkitMaskImage:
                'linear-gradient(90deg, transparent 0%, #000 40%, #000 91%, rgba(0,0,0,0.72) 100%), linear-gradient(180deg, #000 0%, #000 78%, rgba(0,0,0,0.45) 91%, transparent 100%)',
              WebkitMaskComposite: 'source-in',
              maskImage:
                'linear-gradient(90deg, transparent 0%, #000 40%, #000 91%, rgba(0,0,0,0.72) 100%), linear-gradient(180deg, #000 0%, #000 78%, rgba(0,0,0,0.45) 91%, transparent 100%)',
              maskComposite: 'intersect',
            }}
          >
            <div className={s.holoChroma} />
            <div className={s.holo} />
          </div>
        </div>

        <Navbar variant="dark" />

        <motion.div
          {...fadeInUp}
          className="relative z-10 max-w-[880px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-28 text-center flex flex-col items-center"
        >
          <Overline className="mb-5">{content.hero.eyebrow}</Overline>
          <h1 className="font-display font-[550] text-[clamp(44px,6.5vw,76px)] leading-[1.06] tracking-[-0.02em] text-white mb-6 max-w-[860px]">
            {content.hero.title}
          </h1>
          <p className="text-xl leading-[1.4] text-[#C7C7F2] max-w-[600px] mb-8">
            {content.hero.description}
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap mb-5">
            <Button href={CHROME_STORE_URL} external size="lg" iconRight="heroicons:arrow-right">
              Download extension
            </Button>
            <Button href={GITHUB_URL} external size="lg" variant="outline" icon="mdi:github">
              View on GitHub
            </Button>
          </div>
          <CommandChip />
        </motion.div>

        {/* animated demo */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }} className="relative z-10 px-4 md:px-8 pb-10">
          <HeroDemo wrapRef={demoWrapRef} />
        </motion.div>

        {/* proof strip */}
        <div className="relative z-10 flex items-center justify-center gap-4 flex-wrap px-8 pt-2 pb-[72px]">
          {content.hero.proof.map((claim) => (
            <span key={claim} className={s.chipd}>
              <Icon icon="heroicons:check-circle-solid" width={16} className="text-accent-pink" />
              {claim}
            </span>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="agents" className="relative overflow-hidden bg-ink py-[180px]">
        {/* horizon arcs — two large circle slices with a gradient stroke, only a shallow
            section of each showing (like the earth's curvature) to frame the block */}
        <svg className={`${s.hiwArc} ${s.hiwArcTop}`} viewBox="0 0 1440 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M0,0 Q720,250 1440,0" stroke="url(#hiwArcTopGrad)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id="hiwArcTopGrad" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FF4432" stopOpacity="0" />
              <stop offset="0.14" stopColor="#FF4432" stopOpacity="0.5" />
              <stop offset="0.4" stopColor="#FF2D6B" stopOpacity="0.9" />
              <stop offset="0.67" stopColor="#F500A4" stopOpacity="0.9" />
              <stop offset="0.88" stopColor="#A026DC" stopOpacity="0.5" />
              <stop offset="1" stopColor="#A026DC" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <svg className={`${s.hiwArc} ${s.hiwArcBot}`} viewBox="0 0 1440 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M0,160 Q720,-90 1440,160" stroke="url(#hiwArcBotGrad)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id="hiwArcBotGrad" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FF4432" stopOpacity="0" />
              <stop offset="0.14" stopColor="#FF4432" stopOpacity="0.5" />
              <stop offset="0.4" stopColor="#FF2D6B" stopOpacity="0.9" />
              <stop offset="0.67" stopColor="#F500A4" stopOpacity="0.9" />
              <stop offset="0.88" stopColor="#A026DC" stopOpacity="0.5" />
              <stop offset="1" stopColor="#A026DC" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <motion.div {...scrollFadeInUp} className="relative z-[1] max-w-[1200px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* left — eyebrow, headline, running mascot */}
            <div className="flex flex-col">
              <Overline className="self-start mb-5">{content.howItWorks.subtitle}</Overline>
              <h2 className="font-display font-[550] text-[clamp(32px,5vw,52px)] leading-[1.08] tracking-[-0.02em] text-white m-0 max-w-[14ch]">
                {content.howItWorks.title}
              </h2>
              <div className={s.hiwChar}>
                <Image src="/mascot-running.png" alt="" width={620} height={487} className="w-full h-auto" />
              </div>
            </div>

            {/* right — numbered step list linked by a dashed connector */}
            <div className={s.hiwSteps}>
              {content.howItWorks.steps.map((step, i) => (
                <div key={step.title} className={s.stepRow}>
                  <div className={s.stepMark}>
                    <div className={s.stepNum}>{i + 1}</div>
                  </div>
                  <div className={s.stepCard}>
                    <div className={s.stepIco}><Icon icon={step.icon} width={24} /></div>
                    <div className={s.stepText}>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============ FEATURES (toolset bento) ============ */}
      <section
        id="toolset"
        className="py-[104px]"
        style={{ background: '#000114' }}
      >
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <motion.div {...scrollFadeInUp} className="text-center mb-14">
            <Overline className="mb-4">{content.toolset.subtitle}</Overline>
            <h2 className="font-display font-[550] text-[clamp(28px,4vw,42px)] leading-[1.15] tracking-[-0.02em] text-white max-w-[640px] mx-auto">
              {content.toolset.title}
            </h2>
          </motion.div>

          <motion.div {...scrollFadeInUp}>
            <FeaturesBento />
          </motion.div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="bg-ink pb-[104px]">
        <motion.div {...scrollFadeInUp} className="max-w-[760px] mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <Overline className="mb-4">{content.faq.subtitle}</Overline>
            <h2 className="font-display font-[550] text-[clamp(28px,4vw,42px)] leading-[1.15] tracking-[-0.02em] text-white m-0">
              {content.faq.title}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {content.faq.items.map((item, i) => (
              <details key={item.question} className={s.faq} open={i === 0}>
                <summary>
                  {item.question}
                  <span className={s.faqPlus}><Icon icon="heroicons:plus" width={22} /></span>
                </summary>
                <p className={s.faqAns}>{item.answer}</p>
              </details>
            ))}
          </div>
        </motion.div>
      </section>

      <Footer />

      {/* Hidden SEO content for search engines and LLMs */}
      <section className="sr-only" aria-hidden="true">
        <h2>Visual feedback for AI coding agents</h2>
        <p>
          Vibe Annotations is a free, open-source Chrome extension and local MCP server that lets developers
          annotate anything running on localhost — across pages — and have AI coding agents like Claude Code,
          Cursor, Windsurf and GitHub Copilot implement every fix in one batch. Annotations carry the exact DOM
          selection, the React component behind it, viewport info, an automatic zoned screenshot and your
          instruction. It adds design edits with in-place preview, component variant generation, and
          self-contained HTML export for sharing a review batch. Everything runs 100% locally: no cloud,
          no tracking, no account. Works with Chrome, Edge, Brave and Arc on any local app — React, Vue,
          Rails or plain HTML files.
        </p>
      </section>
    </div>
  )
}
