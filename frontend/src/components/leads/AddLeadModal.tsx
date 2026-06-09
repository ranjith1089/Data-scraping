import { useState } from 'react'
import {
  X, Loader2, UserPlus, GraduationCap, Building2,
  Phone, Mail, Globe, MapPin, BookOpen, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCreateLead } from '@/hooks/useLeads'
import {
  SECTOR_NAMES,
  COMPANY_SIZE_OPTIONS,
  STAGE_LABELS,
  ADMISSION_STAGE_LABELS,
  ADMISSION_SOURCE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  ADMISSION_COURSES,
  SCHOOL_CLASS_OPTIONS,
  BOARD_OPTIONS,
  STREAM_OPTIONS,
  isAdmissionSector,
  getAdmissionKind,
  cn,
} from '@/lib/utils'

interface AddLeadModalProps {
  onClose: () => void
  onCreated?: (leadId: string) => void
}

interface FormState {
  // ── Common ──────────────────────────────────────────────────────────
  sector_code: string
  stage: string
  source: string
  city: string
  district: string
  state_field: string        // renamed to avoid clash with React state
  // ── B2B fields ──────────────────────────────────────────────────────
  company_name: string       // = School name for college
  contact_name: string       // = Student name
  email: string
  phone: string
  website: string
  company_size: string
  // ── College / Admission fields ──────────────────────────────────────
  parent_name: string
  parent_phone: string
  course_interested: string
  board: string
  stream: string
  percentage_marks: string
  school_name: string        // previous school/institution
}

const EMPTY_FORM: FormState = {
  sector_code: '',
  stage: 'new',
  source: '',
  city: '',
  district: '',
  state_field: 'Tamil Nadu',
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  company_size: '',
  parent_name: '',
  parent_phone: '',
  course_interested: '',
  board: '',
  stream: '',
  percentage_marks: '',
  school_name: '',
}

const INPUT_CLS =
  'w-full rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all'

const SELECT_CLS =
  'w-full rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all'

export default function AddLeadModal({ onClose, onCreated }: AddLeadModalProps) {
  const createLead = useCreateLead()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const isCollege = isAdmissionSector(form.sector_code)
  const admissionKind = getAdmissionKind(form.sector_code)   // 'college' | 'school' | null
  const isSchool = admissionKind === 'school'
  const stageLabels = isCollege ? ADMISSION_STAGE_LABELS : STAGE_LABELS
  const sourceOptions = isCollege ? ADMISSION_SOURCE_OPTIONS : LEAD_SOURCE_OPTIONS

  // Level-appropriate academic labels/options for the admission form
  const courseLabel       = isSchool ? 'Class / Programme' : 'Course Interested In'
  const coursePlaceholder = isSchool ? 'Select class…' : 'Select course…'
  const courseOptions     = isSchool ? SCHOOL_CLASS_OPTIONS : ADMISSION_COURSES
  const streamLabel       = isSchool ? 'Stream (if 11th / 12th)' : 'Stream (12th)'
  const boardLabel        = isSchool ? 'Board' : 'Board (12th / Previous)'
  const pctLabel          = isSchool ? 'Last Class %' : '12th / Entrance Percentage (%)'
  const prevSchoolLabel   = isSchool ? 'Current School' : 'Previous School / Institution'

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.sector_code) { setError('Please select a sector.'); return }

    // For college: student name is the contact, school name or entered name fills company_name
    const companyName = isCollege
      ? (form.school_name.trim() || form.contact_name.trim() || 'Unknown Institution')
      : form.company_name.trim()

    if (!companyName) { setError(isCollege ? 'Student name is required.' : 'Company name is required.'); return }

    // Build payload — strip empty strings from optional fields
    const payload: Record<string, unknown> = {
      company_name: companyName,
      sector_code: form.sector_code,
      stage: form.stage || 'new',
    }

    const strFields: Array<[string, string]> = [
      ['contact_name',     form.contact_name],
      ['email',            form.email],
      ['phone',            form.phone],
      ['website',          form.website],
      ['city',             form.city],
      ['district',         form.district],
      ['state',            form.state_field],
      ['company_size',     form.company_size],
      ['source',           form.source],
    ]
    for (const [key, val] of strFields) {
      if (val.trim()) payload[key] = val.trim()
    }

    // Admission-specific fields
    if (isCollege) {
      if (form.parent_name.trim())    payload['parent_name']    = form.parent_name.trim()
      if (form.parent_phone.trim())   payload['parent_phone']   = form.parent_phone.trim()
      if (form.course_interested)     payload['course_interested'] = form.course_interested
      if (form.board)                 payload['board']          = form.board
      if (form.stream)                payload['stream']         = form.stream
      if (form.school_name.trim())    payload['school_name']    = form.school_name.trim()
      const pct = parseFloat(form.percentage_marks)
      if (!isNaN(pct) && pct >= 0 && pct <= 100) payload['percentage_marks'] = pct
    }

    try {
      const created = await createLead.mutateAsync(payload)
      toast.success(isCollege ? 'Student enquiry added!' : 'Lead created')
      onCreated?.(created.id)
      onClose()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(
          detail
            .map((d: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(d?.loc) ? d.loc.slice(1).join('.') : ''
              return field ? `${field}: ${d?.msg ?? ''}` : d?.msg ?? ''
            })
            .filter(Boolean)
            .join('; ')
        )
      } else {
        setError('Failed to create. Please try again.')
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="relative overflow-hidden flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/30">
            <div
              className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r"
              style={{
                backgroundImage: isCollege
                  ? 'linear-gradient(to right, #7c3aed, #6d28d9)'
                  : 'linear-gradient(to right, #6366f1, #8b5cf6)',
              }}
            />
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shadow-sm',
                  isCollege
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                    : 'bg-gradient-to-br from-indigo-500 to-violet-600'
                )}
              >
                {isCollege
                  ? <GraduationCap className="h-5 w-5 text-white" />
                  : <UserPlus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isCollege ? 'New Student Enquiry' : 'Add Lead'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSchool
                    ? 'Capture school / coaching admission enquiry'
                    : isCollege
                      ? 'Capture college admission enquiry details'
                      : 'Create a new prospect in your pipeline'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────── */}
          <div className="overflow-y-auto p-6 space-y-5 scrollbar-thin">

            {/* Sector + Stage + Source row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Sector" required icon={<Building2 className="h-3.5 w-3.5" />}>
                <select
                  value={form.sector_code}
                  onChange={(e) => {
                    update('sector_code', e.target.value)
                    // Reset source when sector changes
                    update('source', '')
                  }}
                  required
                  className={SELECT_CLS}
                >
                  <option value="">Select…</option>
                  {Object.entries(SECTOR_NAMES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label={isCollege ? 'Admission Stage' : 'Pipeline Stage'}>
                <select
                  value={form.stage}
                  onChange={(e) => update('stage', e.target.value)}
                  className={SELECT_CLS}
                >
                  {Object.entries(stageLabels).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Source / Channel">
                <select
                  value={form.source}
                  onChange={(e) => update('source', e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Unknown</option>
                  {sourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {isCollege ? (
              /* ══════════════════════════════════════════════════════
                 COLLEGE / ADMISSION FORM
                 ══════════════════════════════════════════════════════ */
              <>
                {/* Student info */}
                <SectionTitle icon={<GraduationCap className="h-4 w-4" />} label="Student Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Student Name" required icon={<UserPlus className="h-3.5 w-3.5" />}>
                    <input
                      type="text"
                      value={form.contact_name}
                      onChange={(e) => update('contact_name', e.target.value)}
                      placeholder="Arun Kumar"
                      required
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Student Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="+91 9876543210"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Student Email" icon={<Mail className="h-3.5 w-3.5" />}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="arun@email.com"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label={prevSchoolLabel} icon={<Building2 className="h-3.5 w-3.5" />}>
                    <input
                      type="text"
                      value={form.school_name}
                      onChange={(e) => update('school_name', e.target.value)}
                      placeholder="Govt. Higher Sec. School, Coimbatore"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                {/* Parent info */}
                <SectionTitle icon={<Users className="h-4 w-4" />} label="Parent / Guardian" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Parent Name" icon={<UserPlus className="h-3.5 w-3.5" />}>
                    <input
                      type="text"
                      value={form.parent_name}
                      onChange={(e) => update('parent_name', e.target.value)}
                      placeholder="Kumar / Sunita"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Parent Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                    <input
                      type="tel"
                      value={form.parent_phone}
                      onChange={(e) => update('parent_phone', e.target.value)}
                      placeholder="+91 9876543210"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                {/* Academic info */}
                <SectionTitle icon={<BookOpen className="h-4 w-4" />} label="Academic Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={courseLabel}>
                    <select
                      value={form.course_interested}
                      onChange={(e) => update('course_interested', e.target.value)}
                      className={SELECT_CLS}
                    >
                      <option value="">{coursePlaceholder}</option>
                      {courseOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={streamLabel}>
                    <select
                      value={form.stream}
                      onChange={(e) => update('stream', e.target.value)}
                      className={SELECT_CLS}
                    >
                      <option value="">Select stream…</option>
                      {STREAM_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={boardLabel}>
                    <select
                      value={form.board}
                      onChange={(e) => update('board', e.target.value)}
                      className={SELECT_CLS}
                    >
                      <option value="">Select board…</option>
                      {BOARD_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={pctLabel}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.percentage_marks}
                      onChange={(e) => update('percentage_marks', e.target.value)}
                      placeholder="87.5"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                {/* Location */}
                <SectionTitle icon={<MapPin className="h-4 w-4" />} label="Location" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="City">
                    <input type="text" value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      placeholder="Coimbatore" className={INPUT_CLS} />
                  </Field>
                  <Field label="District">
                    <input type="text" value={form.district}
                      onChange={(e) => update('district', e.target.value)}
                      placeholder="Coimbatore" className={INPUT_CLS} />
                  </Field>
                  <Field label="State">
                    <input type="text" value={form.state_field}
                      onChange={(e) => update('state_field', e.target.value)}
                      placeholder="Tamil Nadu" className={INPUT_CLS} />
                  </Field>
                </div>
              </>
            ) : (
              /* ══════════════════════════════════════════════════════
                 STANDARD B2B FORM
                 ══════════════════════════════════════════════════════ */
              <>
                <Field label="Company Name" required icon={<Building2 className="h-3.5 w-3.5" />}>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    placeholder="Acme Corp"
                    required
                    className={INPUT_CLS}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Name" icon={<UserPlus className="h-3.5 w-3.5" />}>
                    <input type="text" value={form.contact_name}
                      onChange={(e) => update('contact_name', e.target.value)}
                      placeholder="Priya Sharma" className={INPUT_CLS} />
                  </Field>
                  <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
                    <input type="email" value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="priya@acme.com" className={INPUT_CLS} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                    <input type="tel" value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="+91 9876543210" className={INPUT_CLS} />
                  </Field>
                  <Field label="Website" icon={<Globe className="h-3.5 w-3.5" />}>
                    <input type="url" value={form.website}
                      onChange={(e) => update('website', e.target.value)}
                      placeholder="https://acme.com" className={INPUT_CLS} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="City" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <input type="text" value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      placeholder="Chennai" className={INPUT_CLS} />
                  </Field>
                  <Field label="District">
                    <input type="text" value={form.district}
                      onChange={(e) => update('district', e.target.value)}
                      placeholder="Chennai" className={INPUT_CLS} />
                  </Field>
                  <Field label="State">
                    <input type="text" value={form.state_field}
                      onChange={(e) => update('state_field', e.target.value)}
                      placeholder="Tamil Nadu" className={INPUT_CLS} />
                  </Field>
                </div>

                <Field label="Company Size">
                  <select value={form.company_size}
                    onChange={(e) => update('company_size', e.target.value)}
                    className={SELECT_CLS}>
                    <option value="">Unknown</option>
                    {COMPANY_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {isCollege
                ? '* Student Name and Sector are required'
                : '* Company Name and Sector are required'}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-all">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLead.isPending}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50',
                  isCollege
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-200'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-200'
                )}
              >
                {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCollege ? '+ Add Enquiry' : '+ Add Lead'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string
  required?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
