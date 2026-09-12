import { Spinner } from '@/features/shared/StateMessage'

interface LoadingStateProps {
  label: string
}

/**
 * One shared "loading" composition (spinner + caption), replacing the
 * three different ad-hoc idioms found in the Phase 8 audit: a bare `<p>`
 * (LocationsPreviewSection, content/LocationsPage) and a skeleton pulse
 * (FeaturedVehicles, kept separately since a card-shaped skeleton is a
 * deliberately different — and reasonable — choice for a card grid).
 * Every page that currently pairs the shared `Spinner` with its own
 * hand-typed caption `<p>` can use this instead.
 */
export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Spinner className="h-6 w-6" />
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  )
}
