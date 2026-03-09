import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import {
  Building2, MapPin, Globe, Mail, ChevronDown, ChevronRight,
  UploadCloud, FileSpreadsheet, X, CheckCircle2, ArrowRight,
  ArrowLeft, Zap, Sun, Moon, Link2, Plus, Trash2, Search,
  AlertCircle, Eye,
} from 'lucide-react'
import { submitOnboarding } from '../services/api'
import { saveUser, bulkUpsertProducts, addCompetitor } from '../services/supabase'

const BUSINESS_TYPES = ['Retail','E-commerce','B2B Services','Restaurant / Food',
  'Professional Services','Healthcare','Technology','Manufacturing','Other']

const STEPS = ['Business','Products','Competitors','Review']

// ── Reusable field components ──────────────────────────────────────────────

function Label({ children }) {
  return <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">{children}</label>
}

function Input({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>}
      <input
        {...props}
        className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all ${Icon ? 'pl-9 pr-3' : 'px-3'}`}
      />
    </div>
  )
}

function Select({ value, onChange, children }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-3 pr-9 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all cursor-pointer">
        {children}
      </select>
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
    </div>
  )
}

function Field({ label, children }) {
  return <div className="mb-4"><Label>{label}</Label>{children}</div>
}

// ── Step progress bar ──────────────────────────────────────────────────────

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < current  ? 'bg-indigo-600 dark:bg-indigo-500 text-white' :
                i === current ? 'bg-indigo-600 dark:bg-indigo-500 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/50' :
                                'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
              {i < current ? <CheckCircle2 size={14}/> : i + 1}
            </div>
            <span className={`text-[10px] font-medium hidden sm:block ${i === current ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 sm:w-20 h-0.5 mx-1 mb-4 transition-all ${i < current ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}/>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 1 – Business ──────────────────────────────────────────────────────

function StepBusiness({ data, onChange }) {
  return (
    <div className="space-y-0 animate-fade-slide-up">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Tell us about your business so our AI can find the right competitors in your market.
      </p>
      <Field label="Company Name *">
        <Input icon={Building2} value={data.companyName} onChange={e => onChange('companyName', e.target.value)} placeholder="e.g. Maple Street Textiles"/>
      </Field>
      <Field label="Business Type *">
        <Select value={data.businessType} onChange={v => onChange('businessType', v)}>
          <option value="" disabled>Select type…</option>
          {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="City / Location *">
          <Input icon={MapPin} value={data.location} onChange={e => onChange('location', e.target.value)} placeholder="e.g. Mumbai, India"/>
        </Field>
        <Field label="Your Website (optional)">
          <Input icon={Globe} value={data.website} onChange={e => onChange('website', e.target.value)} placeholder="https://yourbiz.com" type="url"/>
        </Field>
      </div>
      <Field label="Gmail for Daily Reports *">
        <Input icon={Mail} value={data.gmail} onChange={e => onChange('gmail', e.target.value)} placeholder="you@gmail.com" type="email"/>
      </Field>
    </div>
  )
}

// ── Step 2 – Products ──────────────────────────────────────────────────────

function StepProducts({ file, rows, onFile, onClear }) {
  const inputRef = useRef(null)

  const handleFile = useCallback(f => {
    if (!f) return
    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: res => onFile(f, res.data.slice(0, 500)),   // up to 500 products
    })
  }, [onFile])

  const REQUIRED_COLS = ['Product Name', 'Type', 'Price', 'Stock']

  return (
    <div className="animate-fade-slide-up">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
        Upload your product catalogue as a CSV or Excel file. Make sure it has columns:
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {REQUIRED_COLS.map(c => (
          <span key={c} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">{c}</span>
        ))}
      </div>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])}/>
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <UploadCloud size={22} className="text-indigo-600 dark:text-indigo-400"/>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drag & drop your product file</p>
          <p className="text-xs text-slate-400">or <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">click to browse</span></p>
          <div className="flex gap-2 mt-1">
            {['CSV','XLSX','XLS'].map(e => (
              <span key={e} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{e}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
            <FileSpreadsheet size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{rows.length} rows loaded</p>
            </div>
            <CheckCircle2 size={16} className="text-indigo-500 shrink-0"/>
            <button onClick={onClear} className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 text-slate-400 hover:text-slate-600 transition-all"><X size={14}/></button>
          </div>

          {rows.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <Eye size={13} className="text-slate-400"/>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Preview — first {Math.min(rows.length, 5)} rows</span>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>{Object.keys(rows[0]).slice(0,5).map(k => (
                      <th key={k} className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {rows.slice(0,5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {Object.values(row).slice(0,5).map((v,j) => (
                          <td key={j} className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-30 truncate">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step 3 – Competitors ───────────────────────────────────────────────────

function StepCompetitors({ mode, onMode, items, onAdd, onUpdate, onRemove }) {
  return (
    <div className="animate-fade-slide-up">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        Choose how our AI should find your competitors.
      </p>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { id:'auto',   icon:Search,   label:'Auto-discover',  desc:'AI finds top 10 competitors by your location & business type' },
          { id:'manual', icon:Link2,    label:"I'll add them",  desc:'Enter specific competitor names and websites yourself' },
        ].map(opt => (
          <button key={opt.id} onClick={() => onMode(opt.id)}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all
              ${mode === opt.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
            <div className={`p-2 rounded-lg ${mode===opt.id ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <opt.icon size={16} className={mode===opt.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}/>
            </div>
            <div>
              <p className={`text-sm font-semibold ${mode===opt.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{opt.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {mode === 'auto' ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"/>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
            Our AI will search Google and industry directories to find the <strong>top 10 competitors</strong> in your area and business category automatically after setup.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-center">
              <div className="col-span-2">
                <Input value={item.name} onChange={e => onUpdate(i,'name',e.target.value)} placeholder={`Competitor ${i+1} name`}/>
              </div>
              <div className="col-span-2">
                <Input icon={Globe} value={item.website} onChange={e => onUpdate(i,'website',e.target.value)} placeholder="website.com" type="url"/>
              </div>
              <button onClick={() => onRemove(i)} disabled={items.length===1}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-30 transition-all">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}
          {items.length < 10 && (
            <button onClick={onAdd} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 mt-2 transition-colors">
              <Plus size={14}/> Add competitor
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step 4 – Review ────────────────────────────────────────────────────────

function StepReview({ biz, rows, competitorMode, competitors }) {
  const items = [
    { label:'Company',    value: biz.companyName },
    { label:'Type',       value: biz.businessType },
    { label:'Location',   value: biz.location },
    { label:'Website',    value: biz.website || '—' },
    { label:'Gmail',      value: biz.gmail },
    { label:'Products',   value: `${rows.length} rows uploaded` },
    { label:'Competitors',value: competitorMode==='auto' ? 'Auto-discover top 10' : `${competitors.filter(c=>c.name).length} added manually` },
    { label:'Schedule',   value: 'Daily at 6:00 AM' },
  ]
  return (
    <div className="animate-fade-slide-up">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Everything looks good? Hit Launch to start your first analysis.</p>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-400 dark:text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium text-right max-w-[60%] truncate">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2.5 mt-4 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
        <AlertCircle size={16} className="text-indigo-500 shrink-0 mt-0.5"/>
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          After launch, our AI agent will immediately scout competitors and run the first analysis. Results appear in your dashboard within ~2 minutes. Daily reports will be sent to your Gmail every morning.
        </p>
      </div>
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export default function OnboardingWizard({ dark, setDark, authUser, onComplete }) {
  const [step, setStep]   = useState(0)
  const [loading, setLoading] = useState(false)

  const [biz, setBiz] = useState({ companyName:'', businessType:'', location:'', website:'', gmail:'' })
  const [productFile, setProductFile] = useState(null)
  const [productRows, setProductRows] = useState([])
  const [compMode, setCompMode] = useState('auto')
  const [competitors, setCompetitors] = useState([{ name:'', website:'' }])

  const updateBiz = (k, v) => setBiz(prev => ({ ...prev, [k]: v }))
  const updateComp = (i, k, v) => setCompetitors(prev => { const n=[...prev]; n[i]={...n[i],[k]:v}; return n })

  const canNext = [
    biz.companyName && biz.businessType && biz.location && biz.gmail,
    true, // products optional
    true,
    true,
  ][step]

  const handleLaunch = async () => {
    setLoading(true)
    try {
      // Use the authenticated user's ID (from Supabase Auth)
      const userId = authUser.id

      // Step 1: Save business data to users table with the auth user's ID
      const userData = await saveUser(biz, userId)

      // Step 2: Save products to Supabase (if any were uploaded)
      if (productRows.length > 0) {
        await bulkUpsertProducts(userId, productRows)
      }

      // Step 3: Save competitors to Supabase (if manual mode and items exist)
      if (compMode === 'manual' && competitors.length > 0) {
        for (const comp of competitors) {
          if (comp.name) {
            await addCompetitor(userId, {
              name: comp.name,
              website: comp.website || '',
              source: 'manual'
            })
          }
        }
      }

      // Step 4: Submit onboarding to n8n workflow with user_id
      const payload = {
        user_id     : userId,
        business    : biz,
        products    : productRows,
        competitors : { mode: compMode, items: compMode==='manual' ? competitors.filter(c=>c.name) : [] },
      }
      await submitOnboarding(payload)

      // Step 5: Pass complete user object with 'id' field to continue to Dashboard
      setLoading(false)
      onComplete({ ...biz, id: userId })
    } catch (err) {
      console.error('[OnboardingWizard] handleLaunch error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
            <Zap size={16} className="text-white"/>
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Market Intelligence</span>
        </div>
        <button onClick={() => setDark(d => !d)}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          {dark ? <Sun size={15}/> : <Moon size={15}/>}
        </button>
      </header>

      <main className="flex justify-center min-h-screen pt-24 pb-12 px-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6 animate-fade-slide-up">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Set Up Your War Room</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">4 quick steps — AI does the rest every morning.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
            <StepBar current={step}/>

            <div className="mb-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {['Your Business','Your Products','Competitors','Review & Launch'][step]}
              </h2>
            </div>

            {step === 0 && <StepBusiness data={biz} onChange={updateBiz}/>}
            {step === 1 && <StepProducts file={productFile} rows={productRows}
                onFile={(f,r) => { setProductFile(f); setProductRows(r) }}
                onClear={() => { setProductFile(null); setProductRows([]) }}/>}
            {step === 2 && <StepCompetitors mode={compMode} onMode={setCompMode}
                items={competitors}
                onAdd={() => setCompetitors(p => [...p,{ name:'',website:'' }])}
                onUpdate={updateComp}
                onRemove={i => setCompetitors(p => p.filter((_,idx)=>idx!==i))}/>}
            {step === 3 && <StepReview biz={biz} rows={productRows} competitorMode={compMode} competitors={competitors}/>}

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all">
                <ArrowLeft size={15}/> Back
              </button>

              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:pointer-events-none hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/30 transition-all">
                  Continue <ChevronRight size={15}/>
                </button>
              ) : (
                <button onClick={handleLaunch} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-70 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/30 transition-all">
                  {loading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg> Launching…</>
                  ) : (
                    <><Zap size={15}/> Launch War Room</>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-5">
            Your data is private. We never share or sell your information.
          </p>
        </div>
      </main>
    </div>
  )
}
