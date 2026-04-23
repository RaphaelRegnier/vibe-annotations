'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import content from '@/data/content.json'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768) // md breakpoint
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const animatedTexts = useMemo(() => [
    "Read my feedbacks and code away!",
    "Implement my annotations instantly!",
    "Fix all UI issues in one go!"
  ], [])

  // Animation variants - static visible styles on mobile
  const fadeInUp = isMobile ? {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 }
  } : {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
  }

  const fadeInUpDelayed = (delay: number) => isMobile ? ({
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 }
  }) : ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: "easeOut" }
  })

  const staggerContainer = isMobile ? {
    initial: { opacity: 1 },
    animate: { opacity: 1 }
  } : {
    initial: { opacity: 1 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const scrollFadeInUp = isMobile ? {
    initial: { opacity: 1, y: 0 },
    whileInView: { opacity: 1, y: 0 }
  } : {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: "easeOut" },
    viewport: { once: true, amount: 0.3 }
  }

  const popInDelayed = (delay: number) => isMobile ? ({
    initial: { opacity: 1, scale: 1 },
    animate: { opacity: 1, scale: 1 }
  }) : ({
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    transition: { 
      delay: 1.5 + delay, // Start after main content (1.5s base delay + stagger)
      type: "spring",
      stiffness: 300,
      damping: 25,
      mass: 1
    }
  })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    const currentText = animatedTexts[currentTextIndex]
    
    if (isTyping) {
      // Typing effect
      if (displayedText.length < currentText.length) {
        timeoutId = setTimeout(() => {
          setDisplayedText(currentText.slice(0, displayedText.length + 1))
        }, 50) // Typing speed
      } else {
        // Pause before starting to delete
        timeoutId = setTimeout(() => {
          setIsTyping(false)
        }, 2000) // Pause duration
      }
    } else {
      // Deleting effect
      if (displayedText.length > 0) {
        timeoutId = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1))
        }, 30) // Delete speed
      } else {
        // Move to next text
        setCurrentTextIndex((prev) => (prev + 1) % animatedTexts.length)
        setIsTyping(true)
      }
    }

    return () => clearTimeout(timeoutId)
  }, [currentTextIndex, displayedText, isTyping, animatedTexts])

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  return (
    <>
      <Navbar />

      <main className="relative">
        {/* Hero + How it Works Background */}
        <div className="relative bg-cover bg-no-repeat" style={{ 
          backgroundImage: 'url(/hero-bg.webp)', 
          backgroundPosition: isMobile ? 'center -1000px' : 'center -720px' 
        }}>
          {/* Hero Section */}
          <section id="demo" className="relative min-h-screen flex items-center justify-center overflow-hidden pb-[3.25rem]">
          
          {/* Annotation Images - Hidden on lg and below */}
          <div className="hidden xl:block">
            {/* Annotation 1 - Top right */}
            <motion.div
              className="absolute top-[80px] right-[150px] z-20 cursor-grab active:cursor-grabbing"
              {...popInDelayed(0)}
              drag
              dragConstraints={{
                left: -300,
                right: 300,
                top: -300,
                bottom: 300
              }}
              dragElastic={0.2}
              whileDrag={{ scale: 1.05, zIndex: 30 }}
            >
              <Image
                src="/e42701539f37cc348e62bfb09df021597a8cd0c4.png"
                alt=""
                width={298}
                height={139}
                draggable={false}
              />
            </motion.div>
            
            {/* Annotation 2 - Left side */}
            <motion.div
              className="absolute left-[75px] top-[433px] z-20 cursor-grab active:cursor-grabbing"
              {...popInDelayed(0.3)}
              drag
              dragConstraints={{
                left: -300,
                right: 300,
                top: -300,
                bottom: 300
              }}
              dragElastic={0.2}
              whileDrag={{ scale: 1.05, zIndex: 30 }}
            >
              <Image
                src="/f68e4e44b6ac03bf7cd5d64c8490205de8b3845b.png"
                alt=""
                width={298}
                height={136}
                draggable={false}
              />
            </motion.div>
            
            {/* Annotation 3 - Right side */}
            <motion.div
              className="absolute right-[75px] top-[457px] z-20 cursor-grab active:cursor-grabbing"
              {...popInDelayed(0.6)}
              drag
              dragConstraints={{
                left: -300,
                right: 300,
                top: -300,
                bottom: 300
              }}
              dragElastic={0.2}
              whileDrag={{ scale: 1.05, zIndex: 30 }}
            >
              <Image
                src="/8750e188760854ee01d5965e53f8b3fb33d77e11.png"
                alt=""
                width={298}
                height={187}
                draggable={false}
              />
            </motion.div>
          </div>
          
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            {/* Status badges */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-3 mb-12"
              {...staggerContainer}
            >
              <motion.span 
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                {...fadeInUp}
              >
                100% Free
              </motion.span>
              <motion.span 
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                {...fadeInUp}
              >
                No Account & Subscription
              </motion.span>
              <motion.span 
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200"
                {...fadeInUp}
              >
                Open Source
              </motion.span>
            </motion.div>

            {/* Main heading */}
            <div className="text-center">
              <motion.h1 
                className="text-[2.5rem] md:text-[3.5rem] font-[550] text-gray-900 leading-tight tracking-tight mb-8"
                {...fadeInUpDelayed(0.2)}
              >
                Get all your AI feedbacks implemented at once
              </motion.h1>
              
              <motion.p 
                className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed"
                {...fadeInUpDelayed(0.6)}
              >
                Drop visual annotations on your site and watch AI coding agents handle every fix instantly. Never leave your browser, everything runs locally and stays secure.
              </motion.p>

              {/* CTA Section with Product Hunt Badge */}
              <motion.div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
                {...fadeInUpDelayed(0.8)}
              >
                {/* Product Hunt Badge */}
                <a 
                  href="https://www.producthunt.com/products/vibe-annotations?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-vibe&#0045;annotations" 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img 
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1008428&theme=light&t=1755885593795" 
                    alt="Vibe&#0032;Annotations - 10x&#0032;your&#0032;vibe&#0045;coding&#0032;workflow&#0032;writing&#0032;visual&#0032;annotations | Product Hunt" 
                    className="h-[44px] w-auto" 
                  />
                </a>
                
                {/* CTA Button */}
                <motion.a 
                  href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white pl-3 pr-4 py-2.5 rounded-xl text-base font-medium shadow-lg hover:shadow-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon icon="heroicons:arrow-down-tray" className="w-5 h-5" />
                  Get The Free Extension
                </motion.a>
              </motion.div>
            </div>

            {/* Demo Component */}
            <motion.div 
              className="mt-20 flex justify-center"
              {...fadeInUpDelayed(1.0)}
            >
              <div className="backdrop-blur-[10px] backdrop-filter relative rounded-[24px] w-full max-w-[614px] overflow-hidden" style={{ background: 'rgba(189, 185, 198, 0.12)' }}>
                <div className="box-border content-stretch flex flex-col gap-6 items-center justify-end pb-8 pt-8 px-8 relative">
                  <div className="box-border content-stretch flex flex-col gap-5 items-start justify-start p-0 relative shrink-0 w-full">
                    <div className="flex flex-col font-sans justify-center leading-[0] not-italic relative shrink-0 text-black text-[0px] w-full">
                      <p className="leading-[1.5] text-[16px]">
                        <span>Compatible with </span>
                        <span className="font-semibold not-italic">top AI coding agents</span>
                        <span> and more:</span>
                      </p>
                    </div>
                    <div className="box-border content-center flex flex-wrap gap-5 items-center justify-start p-0 relative shrink-0 w-full">
                      <div className="h-[18.973px] relative shrink-0 w-[87.567px]">
                        <Image alt="" src="/a1f9aa024cbc98b1b3521aa6bd8b4374b08bb166.svg" width={88} height={19} className="block max-w-none size-full" />
                      </div>
                      <div className="h-[13.799px] relative shrink-0 w-[103.136px]">
                        <Image alt="" src="/c5316f8f27773261da24c19714d0753f34d29ba4.svg" width={103} height={14} className="block max-w-none size-full" />
                      </div>
                      <div className="box-border content-stretch flex gap-[0.862px] items-center justify-start p-0 relative shrink-0">
                        <div className="bg-center bg-contain bg-no-repeat rounded-[1.725px] shrink-0 size-[22.422px]" style={{ backgroundImage: `url('/a2bb8e6a60f530cb07b4c7363301206597b5e8b5.png')` }} />
                        <div className="h-[17.248px] relative shrink-0 w-[90.779px]">
                          <Image alt="" src="/ff2cd50f171888af357c1be60a59999319f1e022.svg" width={91} height={17} className="block max-w-none size-full" />
                        </div>
                      </div>
                      <div className="box-border content-stretch flex gap-[5.174px] items-center justify-start p-0 relative shrink-0">
                        <div className="h-[21.56px] relative shrink-0 w-[26.535px]">
                          <Image alt="" src="/4e8d20ceb09d50bb803dc9431880f21ec356a774.svg" width={27} height={22} className="block max-w-none size-full" />
                        </div>
                        <div className="flex flex-col font-semibold justify-center leading-[0] not-italic relative shrink-0 text-black text-[15.523px] text-nowrap">
                          <p className="block leading-[1.46] whitespace-pre">Copilot</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="backdrop-blur-[10px] backdrop-filter bg-gradient-to-b from-[#bdb9c608] to-[#bdb9c618] h-[114px] relative rounded-[17.716px] shrink-0 w-full overflow-hidden">
                    <div className="box-border content-stretch flex flex-col gap-[8.858px] h-[114px] items-center justify-end px-3 py-0 relative w-full">
                      <div className="basis-0 box-border content-stretch flex gap-2 grow items-start justify-start min-h-px min-w-px overflow-clip pb-0 pt-3 px-1.5 relative shrink-0 w-full">
                        <div className="basis-0 font-sans grow leading-[0] min-h-px min-w-px not-italic relative shrink-0 text-black text-[15px]">
                          <div className="block leading-[1.5] h-[22.5px] relative">
                            <p className="block">
                              {displayedText}
                              <span className="animate-pulse">|</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="box-border content-stretch flex items-center justify-between overflow-clip px-1 py-2 relative shrink-0 w-full">
                        <div className="box-border content-stretch flex gap-2 items-center justify-center p-0 relative shrink-0">
                          <div className="bg-center bg-cover bg-no-repeat shrink-0 size-5" style={{ backgroundImage: `url('/7abc3cfe8eddf5deb9ba63f8c454c1235fbc33c4.png')` }} />
                          <div className="font-medium leading-[0] not-italic relative shrink-0 text-[#c5266b] text-[13px] w-[173px]">
                            <p className="block leading-[1.5]">Vibe annotations connected</p>
                          </div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.9)] box-border content-stretch flex flex-col gap-[8.727px] items-center justify-center overflow-clip p-0 relative rounded-[26.182px] shrink-0 size-6">
                          <div className="overflow-clip relative shrink-0 size-[15px]">
                            <div className="absolute inset-[9.38%_15.63%]">
                              <Image alt="" src="/f706da41c0d992318bde53fd0f824c0dd05916de.svg" width={15} height={15} className="block max-w-none size-full brightness-0" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none shadow-[1.107px_1.107px_8.858px_0px_inset_rgba(0,0,0,0.06),-2.215px_-2.215px_5.536px_0px_inset_rgba(255,255,255,0.8)]" />
                    <div className="absolute border-[#ffffff] border-[1.107px] border-solid inset-0 pointer-events-none rounded-[17.716px]" />
                  </div>
                </div>
                <div className="absolute inset-0 pointer-events-none shadow-[1.107px_1.107px_8.858px_0px_inset_rgba(0,0,0,0.06),-2.215px_-2.215px_5.536px_0px_inset_rgba(255,255,255,0.8)]" />
                <div className="absolute border-[#ffffff] border-[1.107px] border-solid inset-0 pointer-events-none rounded-[24px]" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-16 md:py-[6.5rem]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-20 flex flex-col gap-16 md:gap-[104px]">
            {/* Header Section */}
            <motion.div {...scrollFadeInUp}>
              <p className="text-gray-500 text-base mb-4">How it works</p>
              <div className="flex flex-col lg:flex-row justify-between items-start gap-16">
                <div className="w-full lg:w-1/2">
                  <h2 className="text-[28px] md:text-[42px] font-[550] text-gray-900 leading-tight tracking-tight mb-10">
                    Visual feedback meets AI automation
                  </h2>
                  <button 
                    onClick={() => setIsVideoModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all"
                  >
                    <Icon icon="heroicons:play-solid" className="w-5 h-5" />
                    Play The Demo (1min)
                  </button>
                </div>
                <div className="w-full lg:w-1/2">
                  <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                    <span className="font-semibold text-gray-900">Here&apos;s the problem:</span> Your AI is smart, but your feedback workflow isn&apos;t keeping up.
                  </p>
                  <p className="text-lg md:text-xl text-gray-600 leading-relaxed mt-6">
                    You&apos;re spending hours explaining UI issues one element at a time, taking screenshots to show what needs fixing, copy-pasting HTML selectors, and describing vague locations like &quot;the button in the top right&quot; which only leads to more confusion.
                  </p>
                  <p className="text-lg md:text-xl leading-relaxed mt-6">
                    <span className="font-semibold text-gray-900">Vibe Annotations is a better way</span>
                    <span className="text-gray-900"> to streamline this process and make your feedback workflow as intelligent as your AI.</span>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Step 1: Click & Comment */}
            <motion.div className="flex flex-col lg:flex-row items-center justify-between gap-20" {...scrollFadeInUp}>
              <div className="w-full lg:w-1/2">
                <div className="bg-gradient-to-r from-[#f1eadc] to-[#d7dced] via-[#ddeae6] via-[75.696%] overflow-clip relative rounded-xl w-full aspect-[560/358]">
                  {/* Main website background image */}
                  {isMobile ? (
                    <div
                      className="absolute bg-center bg-cover bg-no-repeat inset-0"
                      style={{ 
                        backgroundImage: `url('/7939ea609b264970607c40d27b6b21829724c9d1.png')`,
                        left: '0.5%',
                        top: '5%',
                        width: '119%',
                        height: '127%'
                      }}
                    />
                  ) : (
                    <motion.div
                      className="absolute bg-center bg-cover bg-no-repeat inset-0"
                      style={{ 
                        backgroundImage: `url('/7939ea609b264970607c40d27b6b21829724c9d1.png')`,
                        left: '0.5%',
                        top: '5%',
                        width: '119%',
                        height: '127%'
                      }}
                      initial={{ opacity: 0, x: 20, y: 20 }}
                      whileInView={{ opacity: 1, x: 0, y: 0 }}
                      transition={{ duration: 1.0, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    />
                  )}
                  
                  {/* Annotation Circle 1 */}
                  <motion.div 
                    className="absolute bg-white rounded-full flex items-center justify-center"
                    style={{ 
                      left: '85.7%', 
                      top: '43.6%', 
                      width: '5.4%', 
                      height: '8.4%' 
                    }}
                    initial={isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                    whileInView={isMobile ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
                    transition={isMobile ? {} : { duration: 0.5, delay: 1.2, type: "spring", stiffness: 300, damping: 25 }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <div className="font-semibold text-black text-[0.8rem]">
                      1
                    </div>
                  </motion.div>
                  
                  {/* Annotation Circle 2 */}
                  <motion.div 
                    className="absolute bg-white rounded-full flex items-center justify-center"
                    style={{ 
                      left: '14.1%', 
                      top: '74.6%', 
                      width: '5.4%', 
                      height: '8.4%' 
                    }}
                    initial={isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                    whileInView={isMobile ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
                    transition={isMobile ? {} : { duration: 0.5, delay: 2.2, type: "spring", stiffness: 300, damping: 25 }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <div className="font-semibold text-black text-[0.8rem]">
                      2
                    </div>
                  </motion.div>
                  
                  {/* Cursor with Comment 1 */}
                  <motion.div
                    className="absolute bg-center bg-contain bg-no-repeat"
                    style={{ 
                      backgroundImage: `url('/81df89795bc275781a2fc1f1920878b707e934d7.png')`,
                      left: '40.5%',
                      top: '25.4%',
                      width: '45.2%',
                      height: '18.2%'
                    }}
                    initial={isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                    whileInView={isMobile ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
                    transition={isMobile ? {} : { duration: 0.5, delay: 1.4, type: "spring", stiffness: 300, damping: 25 }}
                    viewport={{ once: true, amount: 0.3 }}
                  />
                  
                  {/* Cursor with Comment 2 */}
                  <motion.div
                    className="absolute bg-center bg-contain bg-no-repeat"
                    style={{ 
                      backgroundImage: `url('/bb2758df12dd2679673352872f6bfa5e6da2f130.png')`,
                      left: '19.5%',
                      top: '56.4%',
                      width: '35.5%',
                      height: '18.2%'
                    }}
                    initial={isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                    whileInView={isMobile ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
                    transition={isMobile ? {} : { duration: 0.5, delay: 2.4, type: "spring", stiffness: 300, damping: 25 }}
                    viewport={{ once: true, amount: 0.3 }}
                  />
                </div>
              </div>
              <div className="w-full lg:w-1/2">
                <h3 className="text-[24px] md:text-[34px] font-[550] text-gray-900 mb-10 tracking-tight">1. Click & Comment</h3>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                  Drop annotations directly on any element. No selectors. No screenshots. Just click and type.
                </p>
              </div>
            </motion.div>

            {/* Step 2: Batch Everything */}
            <motion.div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-20" {...scrollFadeInUp}>
              <div className="w-full lg:w-1/2">
                <h3 className="text-[24px] md:text-[34px] font-[550] text-gray-900 mb-10 tracking-tight">2. Batch Everything</h3>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                  Annotate across multiple pages, multiple elements. Build your complete feedback queue in seconds.
                </p>
              </div>
              <div className="w-full lg:w-1/2">
                <div className="bg-white relative w-full aspect-[560/357] rounded-[1.5%]">
                  {/* Background area with gradient */}
                  <div 
                    className="absolute bg-gradient-to-br from-[#ffb5a7] via-[#ffc4a2] to-[#ffd1a3] rounded-[1.5%]"
                    style={{
                      left: '14.8%',
                      top: '15.7%',
                      width: '71.6%',
                      height: '77.6%'
                    }}
                  />
                  
                  {/* Extension popup image */}
                  <motion.div
                    className="absolute bg-center bg-contain bg-no-repeat shadow-md rounded-lg"
                    style={{ 
                      backgroundImage: `url('/9e3943358b2f520b86a6925b132151ed4ccc673b.png')`,
                      left: '47.6%',
                      top: '32.5%',
                      width: '50.1%',
                      height: '63.6%'
                    }}
                    initial={isMobile ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
                    whileInView={isMobile ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
                    transition={isMobile ? {} : { duration: 0.8, delay: 0.5, ease: "easeOut" }}
                    viewport={{ once: true, amount: 0.3 }}
                  />
                  
                  {/* Annotation list on the left */}
                  <div 
                    className="absolute flex flex-col gap-[3.2%]"
                    style={{
                      left: '3.4%',
                      top: '7.2%',
                      width: '41.1%',
                      height: '80%'
                    }}
                  >
                    {/* localhost:3000/home - 2 annotations */}
                    <motion.div 
                      className="bg-[#fcfcfd] rounded-2xl w-full shadow-sm"
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.1, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    >
                      <div className="flex items-center justify-between px-[6.3%] py-[4.9%]">
                        <div className="text-[#697586] text-[0.65rem] font-medium">
                          localhost:3000/home
                        </div>
                        <div className="bg-[#5c7b9e] rounded-full aspect-square w-[9.4%] flex items-center justify-center">
                          <div className="text-white text-[0.55rem] font-semibold">2</div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* localhost:3000/blog - 5 annotations */}
                    <motion.div 
                      className="bg-[#fcfcfd] rounded-2xl w-full shadow-sm"
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.2, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    >
                      <div className="flex items-center justify-between px-[6.3%] py-[4.9%]">
                        <div className="text-[#697586] text-[0.65rem] font-medium">
                          localhost:3000/blog
                        </div>
                        <div className="bg-[#5c7b9e] rounded-full aspect-square w-[9.4%] flex items-center justify-center">
                          <div className="text-white text-[0.55rem] font-semibold">5</div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* localhost:3000/contact - 12 annotations */}
                    <motion.div 
                      className="bg-[#fcfcfd] rounded-2xl w-full shadow-sm"
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.3, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    >
                      <div className="flex items-center justify-between px-[6.3%] py-[4.9%]">
                        <div className="text-[#697586] text-[0.65rem] font-medium">
                          localhost:3000/contact
                        </div>
                        <div className="bg-[#5c7b9e] rounded-full aspect-square w-[9.4%] flex items-center justify-center">
                          <div className="text-white text-[0.55rem] font-semibold">12</div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* localhost:3000/user/profile - 43 annotations */}
                    <motion.div 
                      className="bg-[#fcfcfd] rounded-2xl w-full shadow-sm"
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.4, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    >
                      <div className="flex items-center justify-between px-[6.3%] py-[4.9%]">
                        <div className="text-[#697586] text-[0.65rem] font-medium">
                          localhost:3000/user/profile
                        </div>
                        <div className="bg-[#5c7b9e] rounded-full aspect-square w-[9.4%] flex items-center justify-center">
                          <div className="text-white text-[0.55rem] font-semibold">43</div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Step 3: AI Implements All */}
            <motion.div className="flex flex-col lg:flex-row items-center justify-between gap-20" {...scrollFadeInUp}>
              <div className="w-full lg:w-1/2">
                <div className="bg-gradient-to-r from-[#f1eadc] to-[#d7dced] via-[#ddeae6] via-[75.696%] overflow-clip relative rounded-xl w-full aspect-[560/357]">
                  {/* Terminal/Code background */}
                  <motion.div
                    className="absolute bg-center bg-contain bg-no-repeat"
                    style={{ 
                      left: '50%',
                      top: '65.8%', 
                      width: '85%', 
                      height: '72.8%',
                      backgroundImage: `url('/9fcf911bd6ae7322676766cc08a2ecb8339f580d.png')` 
                    }}
                    initial={isMobile ? { opacity: 1, x: '-50%', y: '-50%' } : { opacity: 0, x: '-50%', y: '-30%' }}
                    whileInView={isMobile ? { opacity: 1, x: '-50%', y: '-50%' } : { opacity: 1, x: '-50%', y: '-50%' }}
                    transition={isMobile ? {} : { duration: 0.8, delay: 0.6, ease: "easeOut" }}
                    viewport={{ once: true, amount: 0.3 }}
                  />
                  
                  {/* AI Logos */}
                  <div 
                    className="absolute flex items-center justify-center left-1/2 transform -translate-x-1/2"
                    style={{
                      top: '9.6%',
                      width: '85%',
                      gap: '3%'
                    }}
                  >
                    {/* Claude Logo */}
                    <motion.div 
                      className="bg-center bg-contain bg-no-repeat flex-1 min-w-0"
                      style={{ 
                        backgroundImage: `url('/094629c99a7fceef4f10c6bf9e5f700be419d9b1.png')`,
                        aspectRatio: '109.714/24',
                        height: '6.7%'
                      }}
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.1, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    />
                    
                    {/* Windsurf Logo */}
                    <motion.div 
                      className="bg-center bg-contain bg-no-repeat flex-1 min-w-0"
                      style={{ 
                        backgroundImage: `url('/753158e9e8480215b08a1f769371a7161db57fbe.png')`,
                        aspectRatio: '126.512/17',
                        height: '4.8%'
                      }}
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.2, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    />
                    
                    {/* Cursor Logo */}
                    <motion.div 
                      className="bg-center bg-contain bg-no-repeat flex-1 min-w-0"
                      style={{ 
                        backgroundImage: `url('/1a3255e2da5f5c823ff68643e5d3728aad07c858.png')`,
                        aspectRatio: '116.825/23',
                        height: '6.4%'
                      }}
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.3, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    />
                    
                    {/* Copilot Logo */}
                    <motion.div 
                      className="bg-center bg-contain bg-no-repeat flex-1 min-w-0"
                      style={{ 
                        backgroundImage: `url('/c085e73119be9de47d19388814b844b248d20d19.png')`,
                        aspectRatio: '94.815/24',
                        height: '6.7%'
                      }}
                      initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                      whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                      transition={isMobile ? {} : { duration: 0.6, delay: 0.4, ease: "easeOut" }}
                      viewport={{ once: true, amount: 0.3 }}
                    />
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-1/2">
                <h3 className="text-[24px] md:text-[34px] font-[550] text-gray-900 mb-10 tracking-tight">3. AI Implements All</h3>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                  Send everything to Claude Code, Cursor, GitHub Copilot, or Windsurf. Watch as every annotation becomes working code.
                </p>
              </div>
            </motion.div>
          </div>
        </section>
        </div>

        {/* Features + FAQ Background */}
        <div className="relative bg-cover bg-no-repeat" style={{ backgroundImage: 'url(/feature-bg.webp)', backgroundPositionY: '-228px', backgroundPositionX: 'center' }}>
          {/* Features Section */}
        <section id="features" className="py-16 md:py-[6.5rem]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-20 flex flex-col gap-16 md:gap-[104px]">
            {/* Header */}
            <motion.div className="flex justify-center" {...scrollFadeInUp}>
              <div className="flex flex-col gap-10 items-center">
                <div className="flex flex-col gap-2 items-center text-center">
                  <p className="text-gray-500 text-base tracking-tight">Vibe Annotation Features</p>
                  <h2 className="text-[28px] md:text-[42px] font-[550] text-gray-900 leading-tight tracking-tight max-w-[600px]">
                    Core capabilities to 10x your vibe-coding workflow
                  </h2>
                </div>
                <a 
                  href="https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all"
                >
                  <Icon icon="heroicons:arrow-down-tray" className="w-5 h-5" />
                  Get The Free Extension
                </a>
              </div>
            </motion.div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Precision Inspector */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.0, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:cursor-arrow-rays-solid" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Precision Inspector</h3>
                    <p className="text-base text-black leading-relaxed">
                      Click any element to annotate. Your AI gets exact context via the API: DOM structure, styles, zoned-screenshot (optional) and your instructions.
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>

              {/* Multi-Page Annotations */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.1, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:globe-alt-solid" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Multi-Page Annotations</h3>
                    <p className="text-base text-black leading-relaxed">
                      Drop feedback across your entire app. Process all pages and routes in a single AI session. You can go up to 200 annotations at once!
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>

              {/* Universal AI Support */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.2, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:sparkles-solid" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Universal AI Support</h3>
                    <p className="text-base text-black leading-relaxed">
                      Works with Claude Code, Cursor, Windsurf, and any MCP-compatible coding agent. Just copy-paste the given lines on installation.
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>

              {/* Local-First Architecture */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.3, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:lock-closed-solid" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Local-First Architecture</h3>
                    <p className="text-base text-black leading-relaxed">
                      Vibe Annotations works on localhost and local files. Your data never leaves your machine. No cloud. No tracking. Complete privacy.
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>

              {/* Zero Configuration */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.4, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:cog-6-tooth-solid" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Zero Configuration</h3>
                    <p className="text-base text-black leading-relaxed">
                      Install extension. Start server. Add MCP. Annotate. That&apos;s it. No API keys, no accounts, 1min and you&apos;re set.
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>

              {/* Developer-Friendly */}
              <motion.div 
                className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-[18px] p-5 pb-16 relative"
                style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={isMobile ? {} : { duration: 0.8, delay: 0.5, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner">
                    <Icon icon="heroicons:command-line" className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex flex-col gap-4 px-2">
                    <h3 className="text-lg font-medium text-black tracking-tight">Developer-Friendly</h3>
                    <p className="text-base text-black leading-relaxed">
                      Light/dark themes. Keyboard shortcuts. Designed by developers, for developers.
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-[18px] pointer-events-none" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-16 md:py-[6.5rem]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-20 flex flex-col gap-16 md:gap-[104px]">
            {/* Header */}
            <motion.div className="flex justify-center" {...scrollFadeInUp}>
              <div className="flex flex-col gap-2 items-center text-center w-full">
                <p className="text-gray-500 text-base tracking-tight">{content.faq.subtitle}</p>
                <h2 className="text-[28px] md:text-[42px] font-[550] text-gray-900 leading-tight tracking-tight">
                  {content.faq.title}
                </h2>
              </div>
            </motion.div>

            {/* FAQ Items */}
            <div className="flex flex-col gap-3 w-full">
              {content.faq.items.map((item, index) => (
                <motion.div
                  key={index}
                  className="backdrop-blur-[11px] bg-white/12 border border-white/30 rounded-3xl w-full relative overflow-hidden"
                  style={{ background: 'rgba(189, 185, 198, 0.12)' }}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={isMobile ? {} : { duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                  viewport={{ once: true, amount: 0.3 }}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex gap-4 items-center justify-between pl-10 pr-6 py-3 text-left"
                  >
                    <h3 className="text-lg md:text-xl font-medium text-black tracking-tight flex-1">
                      {item.question}
                    </h3>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/5 to-white/20 backdrop-blur-sm border border-white flex items-center justify-center shadow-inner shrink-0">
                      <Icon 
                        icon="heroicons:chevron-down" 
                        className={`w-5 h-5 text-gray-700 transition-transform ${
                          openFaqIndex === index ? 'rotate-180' : ''
                        }`} 
                      />
                    </div>
                  </button>
                  
                  {openFaqIndex === index && (
                    <div className="pl-10 pr-6 pb-6">
                      <p className="text-base text-gray-700 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 shadow-[1px_1px_9px_0px_inset_rgba(0,0,0,0.06),-2px_-2px_6px_0px_inset_rgba(255,255,255,0.8)] rounded-3xl pointer-events-none" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        </div>
      </main>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="relative w-full max-w-4xl mx-auto">
            {/* Close button */}
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close video"
            >
              <Icon icon="heroicons:x-mark" className="w-8 h-8" />
            </button>
            
            {/* Video container */}
            <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
              <div style={{position:"relative", width:"100%", height:"0px", paddingBottom:"64.632%"}}>
                <iframe 
                  allow="fullscreen" 
                  allowFullScreen 
                  height="100%" 
                  src="https://streamable.com/e/gfm93t?" 
                  width="100%" 
                  style={{border:"none", width:"100%", height:"100%", position:"absolute", left:"0px", top:"0px", overflow:"hidden"}}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEO Content for LLMs and Search Engines */}
      <section className="sr-only" aria-hidden="true">
        <h2>AI Coding Agent Annotation Tool</h2>
        <p>
          Vibe Annotations is a visual annotation tool designed specifically for AI coding agents including Claude Code, Cursor, GitHub Copilot, and Windsurf. 
          This browser extension allows developers to drop visual annotations directly on website elements and automatically send them to AI coding agents for implementation.
        </p>
        
        <h3>How to Use Vibe Annotations with AI Coding Agents</h3>
        <p>
          Install the Vibe Annotations browser extension, start the local MCP server, and configure your AI coding agent (Claude Code, Cursor, GitHub Copilot, or Windsurf) 
          to receive annotations. Click on any website element to add visual feedback, then let your AI coding agent implement all changes automatically.
        </p>
        
        <h3>Supported AI Coding Agents</h3>
        <ul>
          <li>Claude Code - Anthropic&apos;s AI coding assistant</li>
          <li>Cursor - AI-powered code editor</li>
          <li>GitHub Copilot - Microsoft&apos;s AI pair programmer</li>
          <li>Windsurf - AI coding agent platform</li>
        </ul>
        
        <h3>Key Features for AI Coding Workflows</h3>
        <ul>
          <li>Visual annotation tool for precise element targeting</li>
          <li>Multi-page annotation support across entire applications</li>
          <li>Local-first architecture for privacy and security</li>
          <li>Zero configuration setup for immediate use</li>
          <li>MCP (Model Context Protocol) integration</li>
          <li>Browser extension compatible with Chromium-based browsers</li>
        </ul>
        
        <h3>Use Cases for AI Coding Agents</h3>
        <p>
          Perfect for developers using AI coding agents who need to provide visual feedback on UI elements, 
          website layouts, component styling, and user interface improvements. Streamlines the feedback loop 
          between visual design and AI-powered code implementation.
        </p>
      </section>

      <Footer />
    </>
  )
}