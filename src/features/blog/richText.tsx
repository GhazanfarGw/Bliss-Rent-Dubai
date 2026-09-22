import { Link } from 'react-router-dom'

/**
 * Blog copy is plain strings with one bit of markup: `[label](/path)` for a
 * link. Site-internal paths (`/book`, `/locations/dubai`, `/blog/…`) render
 * as router links so navigating stays inside the app; `https://…` renders
 * as an external link. Keeping it this small means articles can be written
 * (or pasted in from a document) without touching any React.
 */
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g

export type InlinePart = string | { label: string; href: string }

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  let last = 0
  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push({ label: match[1], href: match[2] })
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** The text with link markup replaced by just its label — for JSON-LD, search snippets and word counts. */
export function stripInline(text: string): string {
  return text.replace(LINK_PATTERN, '$1')
}

/** Every link target used in a piece of copy (internal paths and external URLs alike). */
export function inlineLinkTargets(text: string): string[] {
  return Array.from(text.matchAll(LINK_PATTERN), (match) => match[2])
}

export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        if (typeof part === 'string') return part
        const isInternal = part.href.startsWith('/')
        return isInternal ? (
          <Link key={index} to={part.href} className="font-medium text-brand-gold-dark underline decoration-brand-gold/40 underline-offset-2 transition-colors hover:text-brand-gold hover:decoration-brand-gold">
            {part.label}
          </Link>
        ) : (
          <a key={index} href={part.href} target="_blank" rel="noreferrer" className="font-medium text-brand-gold-dark underline decoration-brand-gold/40 underline-offset-2 transition-colors hover:text-brand-gold hover:decoration-brand-gold">
            {part.label}
          </a>
        )
      })}
    </>
  )
}
