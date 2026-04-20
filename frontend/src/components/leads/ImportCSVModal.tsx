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
} from 'lucide-react'
import { useImportCSV } from '@/hooks/useLeads'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// Matches the CSV importer's expected columns
// (backend/services/csv_importer.py). `company_name` and `sector_code`
// are required; everything else is optional. One example row per supported
// sector so the user sees the allowed sector_code values without
// having to read docs.
const SAMPLE_CSV_CONTENT = `company_name,sector_code,industry,contact_name,designation,email,phone,website,city,district,state,company_size,annual_revenue_inr
Acme Technologies,it_ites,Software,Priya Sharma,VP Engineering,priya@acme.com,+91 9876543210,https://acme.com,Bangalore,Bangalore Urban,Karnataka,51-200,250000000
Green Valley Agro,agriculture,Food Processing,Ravi Kumar,Director,ravi@gvagro.in,+91 9812345678,https://gvagro.in,Coimbatore,Coimbatore,Tamil Nadu,11-50,50000000
Mumbai Steelworks,manufacturing,Metal Fabrication,Anil Desai,COO,anil@mumbaisteel.com,+91 9867543210,,Mumbai,Mumbai Suburban,Maharashtra,201-500,
Bright Minds Academy,education,K-12 Schools,Dr. Meera Nair,Principal,meera@brightminds.edu,+91 9844556677,https://brightminds.edu,Chennai,Chennai,Tamil Nadu,51-200,
`

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'leadforge-leads-sample.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Release the blob a tick later to make sure the browser finished using it.
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
    if (dropped && dropped.name.endsWith('.csv')) {
      setFile(dropped)
      setResult(null)
    } else {
      toast.error('Please upload a .csv file')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (selected.name.endsWith('.csv')) {
        setFile(selected)
        setResult(null)
      } else {
        toast.error('Please upload a .csv file')
      }
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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Import Leads from CSV</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Results View */}
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                    <p className="text-xs font-medium text-green-600">Imported</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                    <p className="text-xs font-medium text-blue-600">Updated</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                    <p className="text-xs font-medium text-yellow-600">Skipped</p>
                  </div>
                </div>

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50">
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="flex w-full items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">
                          {result.errors.length} error{result.errors.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {showErrors ? (
                        <ChevronUp className="h-4 w-4 text-red-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-red-500" />
                      )}
                    </button>
                    {showErrors && (
                      <div className="max-h-48 overflow-y-auto border-t border-red-200 px-4 py-2">
                        {result.errors.map((err, idx) => (
                          <div key={idx} className="flex gap-2 py-1.5 text-xs">
                            <span className="flex-shrink-0 font-medium text-red-600">Row {err.row}:</span>
                            <span className="text-red-700">{err.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleImportAnother}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" /> Import Another
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sample-download hint banner */}
                <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                    <div>
                      <p className="text-xs font-medium text-indigo-900">
                        First time importing?
                      </p>
                      <p className="mt-0.5 text-[11px] text-indigo-700">
                        Download the sample CSV to see the expected columns and
                        valid sector codes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadSampleCSV}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Download className="h-3 w-3" />
                    Sample
                  </button>
                </div>

                {/* Upload Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                    dragOver
                      ? 'border-indigo-400 bg-indigo-50'
                      : file
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
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
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700">
                        Drop your CSV file here or <span className="text-indigo-600">browse</span>
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
                      Uploading and processing...
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full animate-pulse rounded-full bg-indigo-500" style={{ width: '65%' }} />
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!file || importCSV.isPending}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importCSV.isPending ? 'Importing...' : 'Start Import'}
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
