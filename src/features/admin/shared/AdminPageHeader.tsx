import type { ReactNode } from 'react'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'

/**
 * Phase 8 — thin alias onto the shared `SectionHeader`
 * (src/features/shared/ui/SectionHeader.tsx), which is byte-for-byte
 * the same markup/classes this component used to render directly.
 * Kept under this name so every existing admin page import keeps
 * working with zero visual change.
 */
interface AdminPageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return <SectionHeader title={title} description={description} action={action} />
}
