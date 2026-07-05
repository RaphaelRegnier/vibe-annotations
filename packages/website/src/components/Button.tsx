import Link from 'next/link'
import { Icon } from '@iconify/react'

type ButtonProps = {
  href: string
  variant?: 'primary' | 'outline'
  size?: 'md' | 'lg'
  icon?: string
  iconRight?: string
  external?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Brand button from the design system: 12px radius, Satoshi medium.
 * primary — brand gradient + pink glow, darker gradient on hover.
 * outline — for dark surfaces, translucent white border.
 */
export default function Button({
  href,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  external,
  children,
  className = '',
}: ButtonProps) {
  const sizeClasses =
    size === 'lg' ? 'h-[52px] px-7 text-[16px] gap-2.5' : 'h-10 px-5 text-[15px] gap-2'

  const variantClasses =
    variant === 'primary'
      ? 'text-white bg-gradient-brand hover:bg-gradient-brand-hover shadow-glow hover:shadow-glow-hover'
      : 'text-white border border-white/30 hover:border-white/60 bg-white/[0.03] hover:bg-white/[0.07]'

  const iconSize = size === 'lg' ? 19 : 17

  const content = (
    <>
      {icon && <Icon icon={icon} width={iconSize} aria-hidden />}
      <span>{children}</span>
      {iconRight && <Icon icon={iconRight} width={iconSize} aria-hidden />}
    </>
  )

  const classes = `inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${sizeClasses} ${variantClasses} ${className}`

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  )
}
