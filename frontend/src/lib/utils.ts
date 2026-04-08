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
  marketing_media: 'Marketing & Media',
  finance_professional: 'Finance & Professional',
  construction_real_estate: 'Construction & Real Estate',
  retail_ecommerce: 'Retail & E-commerce',
  energy_utilities: 'Energy & Utilities',
}

export const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  engaged: 'Engaged',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

export const STAGE_COLORS: Record<string, string> = {
  new: '#6B7280',
  contacted: '#3B82F6',
  engaged: '#8B5CF6',
  demo: '#F59E0B',
  proposal: '#F97316',
  negotiation: '#EF4444',
  won: '#22C55E',
  lost: '#DC2626',
}

export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
]

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

export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }
  return searchParams.toString()
}
