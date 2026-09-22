import { useEffect } from 'react'

/**
 * Adds a `<script type="application/ld+json">` block (schema.org
 * structured data) to `<head>` for the current page and removes it when
 * the page unmounts — unlike the title/description hooks (which just get
 * overwritten by the next page), a leftover JSON-LD block would keep
 * describing a page the visitor has already left, since not every page
 * sets one.
 *
 * `data` is serialized once per change of its JSON form, so passing a
 * freshly built object every render doesn't re-inject the script.
 */
export function useJsonLd(data: Record<string, unknown> | null) {
  const json = data ? JSON.stringify(data) : null
  useEffect(() => {
    if (!json) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.pageJsonld = 'true'
    script.textContent = json
    document.head.appendChild(script)
    return () => script.remove()
  }, [json])
}
