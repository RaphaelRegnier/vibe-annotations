import type { MDXComponents } from 'mdx/types'
import CopyButton from '@/components/CopyButton'
import React from 'react'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => {
      let text = ''
      React.Children.forEach(children, (child) => {
        if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props?.children) {
          text = typeof child.props.children === 'string'
            ? child.props.children
            : String(child.props.children)
        }
      })

      return (
        <div className="relative group">
          <pre {...props}>{children}</pre>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={text.trim()} />
          </div>
        </div>
      )
    },
  }
}
