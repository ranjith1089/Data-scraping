import { useState, useCallback, useRef } from 'react'
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  GraduationCap,
  Building2,
} from 'lucide-react'
import { useImportCSV } from '@/hooks/useLeads'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Sample CSVs ────────────────────────────────────────────────────────────────

// Standard B2B CSV — matches csv_importer.py VALID_FIELDS exactly.
const B2B_SAMPLE_CSV = `company_name,sector_code,industry,contact_name,designation,email,phone,website,city,district,state,company_size,annual_revenue_inr,source
Acme Technologies,it_ites,Software,Priya Sharma,VP Engineering,priya@acme.com,+91 9876543210,https://acme.com,Bangalore,Bangalore Urban,Karnataka,51-200,250000000,linkedin
Green Valley Agro,agriculture,Food Processing,Ravi Kumar,Director,ravi@gvagro.in,+91 9812345678,https://gvagro.in,Coimbatore,Coimbatore,Tamil Nadu,11-50,50000000,referral
Mumbai Steelworks,manufacturing,Metal Fabrication,Anil Desai,COO,anil@mumbaisteel.com,+91 9867543210,,Mumbai,Mumbai Suburban,Maharashtra,201-500,,linkedin
Bright Minds Academy,education,K-12 Schools,Dr. Meera Nair,Principal,meera@brightminds.edu,+91 9844556677,https://brightminds.edu,Chennai,Chennai,Tamil Nadu,51-200,,website
`

// Student enquiry CSV — sector_code=college + all admission fields.
// contact_name = student name; company_name = institution name (or student name if no institution)
const STUDENT_SAMPLE_CSV = `company_name,sector_code,contact_name,phone,email,parent_name,parent_phone,course_interested,stream,board,percentage_marks,school_name,city,district,state,source
Govt. Higher Sec. School,college,Arun Kumar,+91 9876543210,arun@email.com,Suresh Kumar,+91 9812345678,B.Tech / B.E.,"Science (PCM)",CBSE,87.5,Govt. Hr. Sec. School Coimbatore,Coimbatore,Coimbatore,Tamil Nadu,phone_enquiry
Govt. Hr. Sec. School Erode,college,Priya Devi,+91 9823456789,,Devi Mohan,,MCA,"Science (PCB)",State Board (TN),91.2,,Erode,Erode,Tamil Nadu,stall
PSG Matric School,college,Karthik Raja,+91 9845678901,karthik@gmail.com,Raja S,+91 9856789012,MBA,Commerce,CBSE,78.0,PSG Matric Hr. Sec. School,Coimbatore,Coimbatore,Tamil Nadu,walk_in
`

type ImportMode = 'b2b' | 'student'

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

interface ImportCSVModalProps {
  onClose: () => void
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export default function ImportCSVModal({ onClose }: ImportCSVModalProps) {
  const importCSV = useImportCSV()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ImportMode>('b2b')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.csv')) {
      setFile(dropped)
      setResult(null)
    } else {
      toast.error('Please upload a .csv file')
    }
  }, [])
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.name.endsWith('.csv')) {
      setFile(selected)
      setResult(null)
    } else {
      toast.error('Please upload a .csv file')
    }
  }, [])

  async function handleUpload() {
    if (!file) return
    try {
      const data = await importCSV.mutateAsync(file)
      setResult(data as ImportResult)
      toast.success('Import completed')
    } catch {
      toast.error('Import failed. Please check your file and try again.')
    }
  }

  function handleImportAnother() {
    setFile(null)
    setResult(null)
    setShowErrors(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function switchMode(m: ImportMode) {
    setMode(m)
    setFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const isStudent = mode === 'student'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">Import from CSV</h2>
            </div>
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Mode tabs ───────────────────────────────────────── */}
          {!result && (
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => switchMode('b2b')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all',
                  !isStudent
                    ? 'border-b-2 border-indigo-600 bg-white text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Building2 className="h-4 w-4" />
                Standard (B2B)
              </button>
              <button
                onClick={() => switchMode('student')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all',
                  isStudent
                    ? 'border-b-2 border-violet-600 bg-white text-violet-700'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <GraduationCap className="h-4 w-4" />
                Student Enquiries
              </button>
            </div>
          )}

          <div className="p-6">
            {result ? (
              /* ── Results view ───────────────────────────────── */
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                    <p className="text-xs font-medium text-green-600">Imported</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                    <p className="text-xs font-medium text-blue-600">Updated</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                    <p className="text-xs font-medium text-amber-600">Skipped</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50">
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="flex w-full items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">
                          {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {showErrors ? <ChevronUp className="h-4 w-4 text-red-500" /> : <ChevronDown className="h-4 w-4 text-red-500" />}
                    </button>
                    {showErrors && (
                      <div className="max-h-48 overflow-y-auto border-t border-red-200 px-4 py-2">
                        {result.errors.map((err, i) => (
                          <div key={i} className="flex gap-2 py-1.5 text-xs">
                            <span className="flex-shrink-0 font-medium text-red-600">Row {err.row}:</span>
                            <span className="text-red-700">{err.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={handleImportAnother}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <RefreshCw className="h-4 w-4" /> Import Another
                  </button>
                  <button onClick={onClose}
                    className={cn(
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white',
                      isStudent ? 'bg-violet-600 hover:bg-violet-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    )}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── Sample download banner ───────────────────── */}
                <div className={cn(
                  'mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3',
                  isStudent
                    ? 'border-violet-100 bg-violet-50'
                    : 'border-indigo-100 bg-indigo-50'
                )}>
                  <div className="flex items-start gap-2">
                    {isStudent
                      ? <GraduationCap className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
                      : <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />}
                    <div>
                      <p className={cn('text-xs font-semibold', isStudent ? 'text-violet-900' : 'text-indigo-900')}>
                        {isStudent ? 'Student Enquiry CSV format' : 'Standard B2B CSV format'}
                      </p>
                      <p className={cn('mt-0.5 text-[11px]', isStudent ? 'text-violet-700' : 'text-indigo-700')}>
                        {isStudent
                          ? 'Required: company_name, sector_code (=college). Student fields: contact_name, phone, parent_name, course_interested, etc.'
                          : 'Required: company_name, sector_code. Optional: contact_name, email, phone, city, district…'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      isStudent
                        ? downloadCSV(STUDENT_SAMPLE_CSV, 'student-enquiries-sample.csv')
                        : downloadCSV(B2B_SAMPLE_CSV, 'aveonapex-leads-sample.csv')
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-[11px] font-medium hover:opacity-80',
                      isStudent
                        ? 'border-violet-200 text-violet-700'
                        : 'border-indigo-200 text-indigo-700'
                    )}
                  >
                    <Download className="h-3 w-3" />
                    Sample
                  </button>
                </div>

                {/* Required columns hint for student mode */}
                {isStudent && (
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Student Fields</p>
                      {['contact_name (student)', 'phone', 'email', 'parent_name', 'parent_phone'].map(f => (
                        <p key={f} className="text-[11px] text-violet-700">· {f}</p>
                      ))}
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Academic Fields</p>
                      {['course_interested', 'stream', 'board', 'percentage_marks', 'school_name'].map(f => (
                        <p key={f} className="text-[11px] text-violet-700">· {f}</p>
                      ))}
                    </div>
                    <p className="col-span-2 mt-1 text-[10px] text-violet-600">
                      Source values: phone_enquiry · walk_in · stall · school_visit · instagram · facebook · referral
                    </p>
                  </div>
                )}

                {/* ── Dropzone ─────────────────────────────────── */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                    dragOver
                      ? (isStudent ? 'border-violet-400 bg-violet-50' : 'border-indigo-400 bg-indigo-50')
                      : file
                        ? 'border-green-300 bg-green-50/50'
                        : (isStudent
                          ? 'border-gray-300 hover:border-violet-300 hover:bg-gray-50'
                          : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50')
                  )}
                >
                  <input ref={fileInputRef} type="file" accept=".csv"
                    onChange={handleFileSelect} className="hidden" />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="mt-1 text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700">
                        Drop your CSV here or{' '}
                        <span className={isStudent ? 'text-violet-600' : 'text-indigo-600'}>
                          browse
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">Only .csv files are accepted</p>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {importCSV.isPending && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      Uploading and processing…
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full animate-pulse rounded-full bg-indigo-500" style={{ width: '65%' }} />
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="mt-6 flex gap-3">
                  <button onClick={onClose}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!file || importCSV.isPending}
                    className={cn(
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50',
                      isStudent
                        ? 'bg-violet-600 hover:bg-violet-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    )}
                  >
                    {importCSV.isPending ? 'Importing…' : 'Start Import'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
