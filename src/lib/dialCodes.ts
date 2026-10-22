/** Country dial codes for phone inputs — Dubai visitor markets first, then A–Z. */
export const DIAL_CODES: { iso: string; code: string; name: string; flag: string }[] = [
  { iso: 'AE', code: '971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { iso: 'SA', code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { iso: 'IN', code: '91', name: 'India', flag: '🇮🇳' },
  { iso: 'PK', code: '92', name: 'Pakistan', flag: '🇵🇰' },
  { iso: 'GB', code: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { iso: 'RU', code: '7', name: 'Russia', flag: '🇷🇺' },
  { iso: 'OM', code: '968', name: 'Oman', flag: '🇴🇲' },
  { iso: 'QA', code: '974', name: 'Qatar', flag: '🇶🇦' },
  { iso: 'KW', code: '965', name: 'Kuwait', flag: '🇰🇼' },
  { iso: 'BH', code: '973', name: 'Bahrain', flag: '🇧🇭' },
  { iso: 'US', code: '1', name: 'United States / Canada', flag: '🇺🇸' },
  { iso: 'AU', code: '61', name: 'Australia', flag: '🇦🇺' },
  { iso: 'BD', code: '880', name: 'Bangladesh', flag: '🇧🇩' },
  { iso: 'CN', code: '86', name: 'China', flag: '🇨🇳' },
  { iso: 'EG', code: '20', name: 'Egypt', flag: '🇪🇬' },
  { iso: 'FR', code: '33', name: 'France', flag: '🇫🇷' },
  { iso: 'DE', code: '49', name: 'Germany', flag: '🇩🇪' },
  { iso: 'IR', code: '98', name: 'Iran', flag: '🇮🇷' },
  { iso: 'IQ', code: '964', name: 'Iraq', flag: '🇮🇶' },
  { iso: 'IT', code: '39', name: 'Italy', flag: '🇮🇹' },
  { iso: 'JO', code: '962', name: 'Jordan', flag: '🇯🇴' },
  { iso: 'KZ', code: '7', name: 'Kazakhstan', flag: '🇰🇿' },
  { iso: 'LB', code: '961', name: 'Lebanon', flag: '🇱🇧' },
  { iso: 'NL', code: '31', name: 'Netherlands', flag: '🇳🇱' },
  { iso: 'NG', code: '234', name: 'Nigeria', flag: '🇳🇬' },
  { iso: 'PH', code: '63', name: 'Philippines', flag: '🇵🇭' },
  { iso: 'PL', code: '48', name: 'Poland', flag: '🇵🇱' },
  { iso: 'ES', code: '34', name: 'Spain', flag: '🇪🇸' },
  { iso: 'LK', code: '94', name: 'Sri Lanka', flag: '🇱🇰' },
  { iso: 'CH', code: '41', name: 'Switzerland', flag: '🇨🇭' },
  { iso: 'TR', code: '90', name: 'Turkey', flag: '🇹🇷' },
  { iso: 'UA', code: '380', name: 'Ukraine', flag: '🇺🇦' },
]

/** "+971" + "050 123 4567" → "+971501234567" (drops a leading trunk 0). */
export function toInternational(code: string, local: string): string {
  const digits = local.replace(/\D/g, '').replace(/^0+/, '')
  return digits ? `+${code}${digits}` : ''
}
