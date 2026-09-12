import { useState } from 'react'
import { vehicleImageUrl } from '@/lib/storage'

interface VehiclePhotoProps {
  storagePath: string | null
  alt: string
  className?: string
}

/** Renders the real photo when one exists, or a plain placeholder — never a stock/fake image. */
export function VehiclePhoto({ storagePath, alt, className = '' }: VehiclePhotoProps) {
  const [failed, setFailed] = useState(false)

  if (!storagePath) {
    return <PhotoPlaceholder className={className} />
  }

  if (failed) return <PhotoPlaceholder className={className} />

  return (
    <img
      src={vehicleImageUrl(storagePath)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={'bg-brand-lavender/60 object-cover transition-transform duration-500 group-hover:scale-[1.03] ' + className}
    />
  )
}

function PhotoPlaceholder({ className }: { className: string }) {
  return (
    <div className={'flex items-center justify-center bg-brand-lavender/60 text-[#fff]/30 ' + className}>
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6.5 16a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm11 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
        />
      </svg>
      <span className="sr-only">No photo available yet</span>
    </div>
  )
}
