import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function timeAgo(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(date)
}

export const SECTOR_COLORS: Record<string, string> = {
  it_ites: '#3B82F6',
  agriculture: '#22C55E',
  manufacturing: '#F59E0B',
  education: '#A855F7',
  college: '#7C3AED',          // violet — colleges & universities
  software: '#0EA5E9',         // sky — software product / SaaS
  marketing_media: '#EC4899',
  finance_professional: '#14B8A6',
  construction_real_estate: '#92400E',
  retail_ecommerce: '#F97316',
  energy_utilities: '#EAB308',
}

export const SECTOR_NAMES: Record<string, string> = {
  it_ites: 'Technology & IT',
  agriculture: 'Agriculture',
  manufacturing: 'Manufacturing',
  education: 'Education',
  college: 'Colleges & Universities',
  software: 'Software Products & SaaS',
  marketing_media: 'Marketing & Media',
  finance_professional: 'Finance & Professional',
  construction_real_estate: 'Construction & Real Estate',
  retail_ecommerce: 'Retail & E-commerce',
  energy_utilities: 'Energy & Utilities',
}

// Stage vocabulary MUST match backend/schemas/lead.py::LeadStage enum
// exactly, otherwise any filter or PATCH using a non-existent stage
// comes back as 422. Historical drift had `engaged` and `demo` here
// which were never valid server-side — filtering by either returned an
// empty list and silently broke the Leads page. Keep these in sync.
export const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  nurture: 'Nurture',
}

export const STAGE_COLORS: Record<string, string> = {
  new: '#6B7280',
  contacted: '#3B82F6',
  qualified: '#8B5CF6',
  proposal: '#F97316',
  negotiation: '#EF4444',
  won: '#22C55E',
  lost: '#DC2626',
  nurture: '#F59E0B',
}

export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
]

// ── Lead source labels (mirrors backend LeadSource enum) ──────────────────────
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  manual:        'Manual Entry',
  import:        'CSV Import',
  website:       'Website Form',
  referral:      'Referral',
  linkedin:      'LinkedIn',
  campaign:      'Campaign',
  api:           'API',
  other:         'Other',
  // Admission / college-specific sources
  phone_enquiry: 'Phone Enquiry',
  walk_in:       'Walk-in',
  stall:         'Education Stall',
  school_visit:  'School Visit',
  instagram:     'Instagram',
  facebook:      'Facebook',
}

export const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCE_LABELS).map(
  ([value, label]) => ({ value, label })
)

// Sources specifically relevant for college/admission workflows
export const ADMISSION_SOURCE_OPTIONS = [
  { value: 'phone_enquiry', label: '📞 Phone Enquiry' },
  { value: 'website',       label: '🌐 Website Form' },
  { value: 'walk_in',       label: '🚶 Walk-in' },
  { value: 'stall',         label: '🏫 Education Stall' },
  { value: 'school_visit',  label: '🏫 School Visit' },
  { value: 'instagram',     label: '📸 Instagram' },
  { value: 'facebook',      label: '👍 Facebook' },
  { value: 'referral',      label: '🤝 Referral' },
  { value: 'other',         label: '💬 Other' },
]

// ── Admission stage labels (college/university context) ───────────────────────
// Uses the same underlying stage codes as STAGE_LABELS — only the display
// text changes when viewing college-sector leads.
export const ADMISSION_STAGE_LABELS: Record<string, string> = {
  new:         '🔔 New Enquiry',
  contacted:   '📞 Contacted',
  qualified:   '🗣️ Counseled',
  proposal:    '📋 Applied',
  negotiation: '📁 Docs Submitted',
  won:         '✅ Enrolled',
  lost:        '❌ Not Joining',
  nurture:     '🕐 Follow-up Later',
}

// Helper: returns the right stage label based on sector context
export function getStageLabel(stage: string, sectorCode?: string | null): string {
  const isAdmission = sectorCode === 'college' || sectorCode === 'education'
  if (isAdmission) return ADMISSION_STAGE_LABELS[stage] ?? stage
  return STAGE_LABELS[stage] ?? stage
}

// ── College admission – course, board, stream options ────────────────────────
export const ADMISSION_COURSES = [
  'B.Tech / B.E.',
  'M.Tech / M.E.',
  'B.Sc',
  'M.Sc',
  'BCA',
  'MCA',
  'BBA',
  'MBA',
  'B.Com',
  'M.Com',
  'BA',
  'MA',
  'B.Pharm',
  'M.Pharm',
  'MBBS',
  'BDS',
  'B.Ed',
  'M.Ed',
  'Diploma',
  'Other',
]

export const BOARD_OPTIONS = [
  'State Board (TN)',
  'CBSE',
  'ICSE / ISC',
  'NIOS',
  'IB (International)',
  'Other',
]

export const STREAM_OPTIONS = [
  'Science (PCM)',
  'Science (PCB)',
  'Science (PCMB)',
  'Commerce',
  'Arts / Humanities',
  'Vocational',
  'Other',
]

// Helper to detect if a sector is admission/college-oriented
export function isAdmissionSector(sectorCode?: string | null): boolean {
  return sectorCode === 'college' || sectorCode === 'education'
}

export function getScoreBadge(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Hot', color: 'text-red-600 bg-red-50' }
  if (score >= 60) return { label: 'Warm', color: 'text-orange-600 bg-orange-50' }
  if (score >= 40) return { label: 'Cool', color: 'text-blue-600 bg-blue-50' }
  return { label: 'Cold', color: 'text-gray-600 bg-gray-50' }
}

export function getICPBadge(icp: string): { color: string } {
  const colors: Record<string, string> = {
    excellent: 'text-green-700 bg-green-50 border-green-200',
    good: 'text-blue-700 bg-blue-50 border-blue-200',
    fair: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    poor: 'text-red-700 bg-red-50 border-red-200',
  }
  return { color: colors[icp] || colors.fair }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Third-Party Integration Module — provider catalogue
// ---------------------------------------------------------------------------
// Single source of truth for provider codes, labels, descriptions, and the
// indigo/green/pink/etc. colour each provider card uses in the UI. Keep the
// codes aligned with the `IntegrationProvider` enum in
// `backend/schemas/integration.py`.
export interface IntegrationProviderMeta {
  code: string
  name: string
  description: string
  category: 'ads' | 'messaging' | 'email' | 'analytics'
  color: string // tailwind text/bg classes
  accent: string // tailwind border/ring accent
  docsUrl?: string
}

export const INTEGRATION_PROVIDERS: IntegrationProviderMeta[] = [
  {
    code: 'meta_ads',
    name: 'Meta Ads',
    description:
      'Capture Facebook & Instagram Lead Ads in real time via webhooks.',
    category: 'ads',
    color: 'text-blue-600 bg-blue-50',
    accent: 'border-blue-200',
  },
  {
    code: 'google_ads',
    name: 'Google Ads',
    description:
      'Track campaigns and push offline conversions back to Google Ads.',
    category: 'ads',
    color: 'text-amber-600 bg-amber-50',
    accent: 'border-amber-200',
  },
  {
    code: 'linkedin_ads',
    name: 'LinkedIn Ads',
    description:
      'Sync Lead Gen Forms from LinkedIn Campaign Manager (polled every 15m).',
    category: 'ads',
    color: 'text-sky-700 bg-sky-50',
    accent: 'border-sky-200',
  },
  {
    code: 'whatsapp',
    name: 'WhatsApp Business (Cloud API)',
    description:
      'Direct Meta Cloud API — cheapest per-message rate, requires a Meta Business Manager account.',
    category: 'messaging',
    color: 'text-green-600 bg-green-50',
    accent: 'border-green-200',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    code: 'whatsapp_gupshup',
    name: 'WhatsApp Business (Gupshup)',
    description:
      'Via Gupshup BSP — fastest WA Business approval in India, simple API key, no Meta review needed.',
    category: 'messaging',
    color: 'text-emerald-600 bg-emerald-50',
    accent: 'border-emerald-200',
    docsUrl: 'https://docs.gupshup.io/reference/send-a-message',
  },
  {
    code: 'sendgrid',
    name: 'SendGrid',
    description:
      'Transactional email sending with open/click/bounce webhook tracking.',
    category: 'email',
    color: 'text-indigo-600 bg-indigo-50',
    accent: 'border-indigo-200',
  },
  {
    code: 'smtp',
    name: 'SMTP',
    description:
      'Generic SMTP provider as an alternative to SendGrid (Gmail, SES, etc.).',
    category: 'email',
    color: 'text-slate-600 bg-slate-50',
    accent: 'border-slate-200',
  },
  {
    code: 'ga4',
    name: 'Google Analytics 4',
    description:
      'Send server-side events via the Measurement Protocol for attribution.',
    category: 'analytics',
    color: 'text-orange-600 bg-orange-50',
    accent: 'border-orange-200',
  },
  {
    code: 'fb_pixel',
    name: 'Facebook Pixel',
    description:
      'Mirror offline conversions to Meta via the Conversions API.',
    category: 'analytics',
    color: 'text-pink-600 bg-pink-50',
    accent: 'border-pink-200',
  },
]

export const INTEGRATION_STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Not connected',
  error: 'Error',
  expired: 'Token expired',
}

export const INTEGRATION_STATUS_COLOR: Record<string, string> = {
  connected: 'text-green-700 bg-green-50 border-green-200',
  disconnected: 'text-gray-600 bg-gray-50 border-gray-200',
  error: 'text-red-700 bg-red-50 border-red-200',
  expired: 'text-amber-700 bg-amber-50 border-amber-200',
}

export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }
  return searchParams.toString()
}
