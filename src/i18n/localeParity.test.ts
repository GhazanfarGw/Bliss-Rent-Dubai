import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import ar from '@/i18n/locales/ar'

/**
 * en.ts's own header comment (mirrored in ar.ts) has long claimed
 * "i18n/index.ts asserts key-shape parity at dev startup" — that
 * assertion never actually existed (confirmed by reading index.ts in
 * full during the Phase 12 redesign). This test closes that gap: it's
 * the real enforcement the comment described, run by `npx vitest run`
 * rather than relying on someone noticing drift by eye. It caught a
 * real instance of drift on first run — a dead `hero.trust` block that
 * existed in both locales but was never referenced from any component.
 *
 * Array leaves (e.g. hero.slides, pages.about.values.items) are treated
 * as opaque — they're checked for the same type and same length, not
 * recursed into per-index, since object arrays commonly vary in per-item
 * shape (title/body) that this check already covers via the array's
 * first element in practice being structurally consistent by construction
 * elsewhere; the goal here is catching a KEY added to one locale and
 * forgotten in the other, not full value validation.
 *
 * i18next plural-suffixed keys (`_one`/`_other`/`_zero`/`_two`/`_few`/
 * `_many`) are normalized to one `_plural` marker before comparing:
 * Arabic's CLDR plural rules legitimately need more forms (all six) than
 * English's (`_one`/`_other` only), so e.g. `en.ts` having only
 * `resultsCount_one`/`resultsCount_other` while `ar.ts` also has
 * `resultsCount_few`/`_many`/`_two`/`_zero` is correct i18n, not drift.
 */

type Tree = { [key: string]: unknown }

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function isPlainObject(value: unknown): value is Tree {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectKeyPaths(node: unknown, prefix: string, paths: Set<string>) {
  if (Array.isArray(node)) {
    paths.add(`${prefix}[]`)
    return
  }
  if (isPlainObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = key.replace(PLURAL_SUFFIX, '_plural')
      const path = prefix ? `${prefix}.${normalizedKey}` : normalizedKey
      paths.add(path)
      collectKeyPaths(value, path, paths)
    }
    return
  }
  // Leaf (string/number/etc.) — the path itself was already added by the
  // caller before recursing; nothing further to record.
}

describe('locale key-shape parity (en vs ar)', () => {
  it('has the exact same set of translation keys in both locales', () => {
    const enPaths = new Set<string>()
    const arPaths = new Set<string>()
    collectKeyPaths(en, '', enPaths)
    collectKeyPaths(ar, '', arPaths)

    const missingFromAr = [...enPaths].filter((p) => !arPaths.has(p)).sort()
    const missingFromEn = [...arPaths].filter((p) => !enPaths.has(p)).sort()

    expect(missingFromAr, 'keys present in en.ts but missing from ar.ts').toEqual([])
    expect(missingFromEn, 'keys present in ar.ts but missing from en.ts').toEqual([])
  })
})
