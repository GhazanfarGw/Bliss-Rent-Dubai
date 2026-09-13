import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import type { Database } from '@/types/database'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { Dialog } from '@/features/shared/ui/Dialog'

type ImageRow = Database['public']['Tables']['vehicle_images']['Row']

export function VehicleGallery({ images, alt }: { images: ImageRow[]; alt: string }) {
  const { t } = useTranslation()
  const sorted = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const active = sorted[activeIndex] ?? null
  const hasMultiple = sorted.length > 1

  function showPrevious() {
    setActiveIndex((i) => (i - 1 + sorted.length) % sorted.length)
  }
  function showNext() {
    setActiveIndex((i) => (i + 1) % sorted.length)
  }

  return (
    <div>
      <div className="group relative">
        <button
          type="button"
          onClick={() => active?.storage_path && setLightboxOpen(true)}
          disabled={!active?.storage_path}
          aria-label={t('vehicleDetail.gallery.expand')}
          className="block w-full disabled:cursor-default"
        >
          <VehiclePhoto
            storagePath={active?.storage_path ?? null}
            alt={alt}
            className="h-72 w-full sm:h-[28rem] lg:h-[34rem]"
          />
        </button>
        {active?.storage_path && (
          <span className="pointer-events-none absolute inset-e-3 top-3 flex h-9 w-9 items-center justify-center border border-white/40 bg-brand-navy-dark/60 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        {hasMultiple && (
          <span className="absolute bottom-3 inset-e-3 border border-white/20 bg-brand-navy-dark/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {t('vehicleDetail.gallery.counter', { current: activeIndex + 1, total: sorted.length })}
          </span>
        )}
      </div>
      {hasMultiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex}
              aria-label={t('vehicleDetail.gallery.thumbnail', { number: i + 1 })}
              className={
                'h-16 w-20 shrink-0 overflow-hidden border-2 transition-colors ' +
                (i === activeIndex ? 'border-brand-navy' : 'border-transparent hover:border-brand-gold/50')
              }
            >
              <VehiclePhoto storagePath={img.storage_path} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={alt}
        closeLabel={t('common.close')}
        variant="lightbox"
        maxWidthClassName="max-w-5xl"
      >
        <div className="relative">
          <VehiclePhoto storagePath={active?.storage_path ?? null} alt={alt} className="max-h-[80vh] w-full object-contain" />
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={showPrevious}
                aria-label={t('vehicleDetail.gallery.previous')}
                className="absolute inset-y-0 inset-s-0 flex items-center px-2 text-white/70 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:px-4"
              >
                <ChevronLeft className="h-8 w-8 rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={showNext}
                aria-label={t('vehicleDetail.gallery.next')}
                className="absolute inset-y-0 inset-e-0 flex items-center px-2 text-white/70 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:px-4"
              >
                <ChevronRight className="h-8 w-8 rtl:rotate-180" aria-hidden="true" />
              </button>
              <p className="mt-3 text-center text-sm font-medium text-white/80">
                {t('vehicleDetail.gallery.counter', { current: activeIndex + 1, total: sorted.length })}
              </p>
            </>
          )}
        </div>
      </Dialog>
    </div>
  )
}
