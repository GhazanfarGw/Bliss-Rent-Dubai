import { useState } from 'react'
import type { Database } from '@/types/database'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'

type ImageRow = Database['public']['Tables']['vehicle_images']['Row']

export function VehicleGallery({ images, alt }: { images: ImageRow[]; alt: string }) {
  const sorted = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
  const [activeIndex, setActiveIndex] = useState(0)
  const active = sorted[activeIndex] ?? null

  return (
    <div>
      <VehiclePhoto
        storagePath={active?.storage_path ?? null}
        alt={alt}
        className="h-72 w-full sm:h-[28rem] lg:h-[34rem]"
      />
      {sorted.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={
                'h-16 w-20 shrink-0 overflow-hidden transition-colors ' +
                (i === activeIndex ? 'border-brand-navy' : 'border-transparent')
              }
            >
              <VehiclePhoto storagePath={img.storage_path} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
