import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoverRequest {
  sector_code: string
  target_roles: string[]
  location_state?: string
  location_city?: string
  company_size?: string
  keywords: string[]
  page: number
  per_page: number
}

export interface DiscoveredLead {
  apollo_id: string | null
  company_name: string
  contact_name: string
  designation: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  website: string | null
  company_size: string | null
  industry: string | null
  city: string | null
  state: string | null
  already_exists: boolean
  existing_lead_id: string | null
}

export interface DiscoverResponse {
  leads: DiscoveredLead[]
  total: number
  page: number
  per_page: number
  total_pages: number
  warning: string | null
}

export interface ImportLeadsRequest {
  sector_code: string
  leads: DiscoveredLead[]
  skip_duplicates: boolean
}

export interface ImportLeadsResult {
  imported: number
  skipped_duplicates: number
  imported_ids: string[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDiscoverLeads() {
  return useMutation({
    mutationFn: async (req: DiscoverRequest) => {
      const { data } = await api.post<DiscoverResponse>('/lead-discovery/search', req)
      return data
    },
  })
}

export function useImportDiscoveredLeads() {
  return useMutation({
    mutationFn: async (req: ImportLeadsRequest) => {
      const { data } = await api.post<ImportLeadsResult>('/lead-discovery/import', req)
      return data
    },
  })
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const SECTOR_ROLES: Record<string, string[]> = {
  it_ites: ['CTO', 'VP Engineering', 'Head of Technology', 'CEO', 'Founder', 'Technical Director', 'Engineering Manager', 'Co-Founder'],
  education: ['Principal', 'Director', 'Academic Head', 'Vice Chancellor', 'L&D Manager', 'Training Manager', 'Head of Learning', 'Dean'],
  marketing_media: ['Founder', 'CEO', 'Marketing Director', 'Head of Growth', 'Creative Director', 'Managing Director', 'CMO'],
}

export const DEFAULT_ROLES: Record<string, string[]> = {
  it_ites: ['CTO', 'VP Engineering', 'CEO', 'Founder'],
  education: ['Principal', 'Director', 'Academic Head'],
  marketing_media: ['Founder', 'CEO', 'Marketing Director'],
}

export const INDIAN_STATES = [
  'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Telangana', 'Delhi',
  'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Kerala',
  'Andhra Pradesh', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Odisha',
  'Bihar', 'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand',
  'Himachal Pradesh', 'Goa', 'Chandigarh',
]

export const COMPANY_SIZES = [
  { value: '1-10',    label: '1 – 10 employees' },
  { value: '11-50',   label: '11 – 50 employees' },
  { value: '51-200',  label: '51 – 200 employees' },
  { value: '201-500', label: '201 – 500 employees' },
  { value: '501-1000',label: '501 – 1,000 employees' },
  { value: '1000+',   label: '1,000+ employees' },
]

export const SECTOR_OPTIONS = [
  { value: 'it_ites',          label: 'IT & Software' },
  { value: 'education',        label: 'Education & EdTech' },
  { value: 'marketing_media',  label: 'Marketing & Agencies' },
]
