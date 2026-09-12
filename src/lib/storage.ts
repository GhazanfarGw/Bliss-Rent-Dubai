import { supabase } from '@/lib/supabaseClient'

/** Public URL for a file in the public 'vehicle-images' bucket. Never use this for the private 'driver-documents' bucket. */
export function vehicleImageUrl(storagePath: string): string {
  return supabase.storage.from('vehicle-images').getPublicUrl(storagePath).data.publicUrl
}
