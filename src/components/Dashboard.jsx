import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import {
  BarChart2, ArrowLeftRight, Clock, Settings, Sun, Moon, Menu,
  Zap, TrendingDown, TrendingUp, Package, Users, MessageCircle,
  Send, ChevronRight, Sparkles, Bell, RefreshCw, X, FileText,
  Mail, CheckCircle2, AlertCircle, Tag, Download, Calendar,
  Globe, ChevronDown, ChevronUp, Shield, Upload, Pencil, Check,
  Plus, Trash2, Search, MapPin, ExternalLink, LogOut,
} from 'lucide-react'
import {
  fetchLatestAnalysis, fetchHistory, fetchReports,
  sendChatMessage, triggerRefresh, sendReport,
  addCompetitorByUrl, discoverCompetitorsByLocation,
  MOCK_ANALYSIS, MOCK_HISTORY,
} from '../services/api'
import {
  getProducts, insertProduct, updateProduct, deleteProduct, bulkUpsertProducts,
  getCompetitors, addCompetitor, deleteCompetitor,
} from '../services/supabase'
import { signOut } from '../services/auth'
import { askGemini } from '../services/gemini'

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { id:'briefing', label:'Daily Briefing',  icon:BarChart2      },
  { id:'products', label:'My Products',      icon:Package        },
  { id:'matchups', label:'Product Matchups', icon:ArrowLeftRight },
  { id:'history',  label:'History',          icon:Clock          },
  { id:'reports',  label:'Reports',          icon:FileText       },
  { id:'settings', label:'Settings',         icon:Settings       },
]

const PRIORITY_COLOR = {
  high  : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  low   : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Card({ children, className = '', delay = 0 }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-slide-up ${className}`}
      style={{ animationDelay:`${delay}ms`, animationFillMode:'both' }}>
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 animate-fade-slide-up">
      <CheckCircle2 size={14} className="text-emerald-500 shrink-0"/>
      <span className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    optimal : { label:'Price Optimal',  cls:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    undercut: { label:"We're Undercut", cls:'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'            },
    tied    : { label:'Price Tied',     cls:'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'         },
  }
  const { label, cls } = map[status] ?? map.tied
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle, active, onNav }) {
  return (
    <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${collapsed?'w-16':'w-56'}`}>
      <div className="flex items-center h-16 px-4 border-b border-slate-100 dark:border-slate-800 gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0">
          <Zap size={16} className="text-white"/>
        </div>
        {!collapsed && <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">Market Intel</span>}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-hidden">
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = active === id
          return (
            <button key={id} onClick={() => onNav(id)} title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${on?'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300':'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <Icon size={17} className={`shrink-0 ${on?'text-indigo-600 dark:text-indigo-400':''}`}/>
              {!collapsed && <><span className="flex-1 text-left whitespace-nowrap">{label}</span>{on && <ChevronRight size={13} className="text-indigo-400"/>}</>}
            </button>
          )
        })}
      </nav>
      <div className="px-2 pb-4">
        <button onClick={onToggle} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
          <Menu size={15}/>{!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ collapsed, dark, setDark, active, business, onRefresh, refreshing, onLogout }) {
  const titles = { briefing:'Daily Briefing', products:'My Products', matchups:'Product Matchups', history:'History', reports:'Reports', settings:'Settings' }
  return (
    <header className="fixed top-0 right-0 z-30 h-16 flex items-center gap-3 px-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300"
      style={{ left: collapsed ? '4rem' : '14rem' }}>
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{titles[active]}</h1>
        {business?.companyName && <p className="text-[11px] text-slate-400 truncate">{business.companyName}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Last updated: Today 6:00 AM</span>
      </div>
      <button onClick={onRefresh} disabled={refreshing} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
        <RefreshCw size={14} className={refreshing?'animate-spin':''}/>
      </button>
      <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
        <Bell size={14}/><span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500"/>
      </button>
      <button onClick={() => setDark(d => !d)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
        {dark ? <Sun size={14}/> : <Moon size={14}/>}
      </button>
      <button onClick={onLogout} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all" title="Logout">
        <LogOut size={14}/>
      </button>
    </header>
  )
}

// ── Daily Briefing ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg, delay }) {
  return (
    <Card delay={delay} className="px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={17} className={color}/>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </Card>
  )
}

function AISummaryCard({ analysis }) {
  if (!analysis) return null
  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-indigo-50/60 to-violet-50/30 dark:from-indigo-950/30 dark:to-violet-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
            <Sparkles size={14} className="text-white"/>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Morning Strategy Brief</h2>
            <p className="text-[11px] text-slate-400">AI-generated · {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
          <Sparkles size={10}/> AI
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{analysis.summary}</p>
      </div>
    </Card>
  )
}

function SuggestionsGrid({ suggestions = [] }) {
  const iconMap = { 'trending-down':TrendingDown, 'trending-up':TrendingUp, package:Package, tag:Tag }
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Recommended Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((s, i) => {
          const Icon = iconMap[s.icon] ?? AlertCircle
          return (
            <Card key={s.id} delay={i*60} className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.priority==='high'?'bg-rose-50 dark:bg-rose-900/30':s.priority==='medium'?'bg-amber-50 dark:bg-amber-900/30':'bg-slate-100 dark:bg-slate-800'}`}>
                  <Icon size={15} className={s.priority==='high'?'text-rose-600 dark:text-rose-400':s.priority==='medium'?'text-amber-600 dark:text-amber-400':'text-slate-400'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLOR[s.priority]}`}>{s.priority}</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">{s.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{s.body}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-800">
                <TrendingUp size={11} className="text-emerald-500"/>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{s.impact}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function CompetitorTable({ comparisons = [] }) {
  const [filter, setFilter] = useState('all')
  const rows = filter==='all' ? comparisons : comparisons.filter(r => r.status===filter)
  return (
    <Card>
      <SectionHeader title="Competitor Comparison" subtitle={`${comparisons.length} products tracked`}
        action={
          <div className="flex gap-1.5">
            {[['all','All'],['undercut','Undercut'],['optimal','Winning']].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filter===k?'bg-indigo-600 dark:bg-indigo-500 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{l}</button>
            ))}
          </div>
        }/>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {['My Product','My Price','Stock','Competitor','Their Price','Diff','Action'].map(col => (
                <th key={col} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.my_product}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">₹{r.my_price?.toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap"><span className={`text-xs font-medium ${r.my_stock<20?'text-rose-500':'text-slate-500 dark:text-slate-400'}`}>{r.my_stock}</span></td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.competitor}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">₹{r.competitor_price?.toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {r.diff===0 ? <span className="text-xs text-slate-400">—</span>
                    : <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${r.diff>0?'text-rose-500':'text-emerald-500'}`}>
                        {r.diff>0?<TrendingDown size={11}/>:<TrendingUp size={11}/>} ₹{Math.abs(r.diff)}
                      </span>}
                </td>
                <td className="px-5 py-3 whitespace-nowrap"><StatusBadge status={r.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 border-t border-slate-50 dark:border-slate-800 rounded-b-2xl bg-slate-50/40 dark:bg-slate-800/20">
        <p className="text-[11px] text-slate-400">{rows.length} product{rows.length!==1?'s':''} shown</p>
      </div>
    </Card>
  )
}

// ── My Products ───────────────────────────────────────────────────────────────

function MyProductsView({ userId }) {
  const [products,  setProducts]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState({})
  const [adding,    setAdding]    = useState(false)
  const [newRow,    setNewRow]    = useState({ name:'', type:'', price:'', stock:'' })
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast,     setToast]     = useState('')
  const fileRef = useRef(null)

  useEffect(() => { load() }, [userId])

  async function load() {
    setLoading(true)
    const data = await getProducts(userId)
    setProducts(data)
    setLoading(false)
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function startEdit(p) { setEditId(p.id); setEditData({ name:p.name, type:p.type||'', price:p.price??'', stock:p.stock??'' }) }

  async function saveEdit() {
    setSaving(true)
    await updateProduct(editId, { ...editData, price:parseFloat(editData.price)||0, stock:parseInt(editData.stock)||0 })
    setEditId(null); await load(); setSaving(false); flash('Product updated.')
  }

  async function handleDelete(id) {
    await deleteProduct(id)
    setProducts(p => p.filter(x => x.id !== id))
    flash('Product removed.')
  }

  async function handleAdd() {
    if (!newRow.name.trim()) return
    setSaving(true)
    const inserted = await insertProduct(userId, { name:newRow.name.trim(), type:newRow.type.trim(), price:parseFloat(newRow.price)||0, stock:parseInt(newRow.stock)||0 })
    if (inserted) setProducts(p => [...p, inserted])
    setAdding(false); setNewRow({ name:'', type:'', price:'', stock:'' }); setSaving(false); flash('Product added.')
  }

  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async res => {
        if (res.data.length === 0) {
          flash('CSV is empty or could not be read.'); setUploading(false); return
        }
        const saved = await bulkUpsertProducts(userId, res.data)
        if (saved.length === 0) {
          flash('No products found — check your CSV column names (need: Name, Type, Price, Stock)')
          setUploading(false); e.target.value = ''; return
        }
        // Immediately update local state with saved rows, then reload from DB
        setProducts(saved)
        await load()
        setUploading(false)
        flash(`${saved.length} products imported.`)
        e.target.value = ''
      },
      error: err => {
        console.error('[CSV] parse error:', err)
        flash('Could not read CSV file. Make sure it is a valid CSV.')
        setUploading(false)
      }
    })
  }

  const tdCls = 'px-4 py-2.5'
  const iCls  = 'w-full bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
  const ab    = (color, fn, icon) => <button onClick={fn} className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${color}`}>{icon}</button>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Product Catalogue</h3>
          <p className="text-xs text-slate-400 mt-0.5">{products.length} products · changes are picked up in next morning's analysis</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCSV}/>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-all">
            {uploading?<RefreshCw size={13} className="animate-spin"/>:<Upload size={13}/>} {uploading?'Importing…':'Re-upload CSV'}
          </button>
          <button onClick={() => { setAdding(true); setEditId(null) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/25 transition-all">
            <Plus size={13}/> Add Product
          </button>
        </div>
      </div>

      <Toast msg={toast}/>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-indigo-400"/></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Product Name','Type','Price (₹)','Stock',''].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {adding && (
                  <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                    <td className={tdCls}><input value={newRow.name}  onChange={e=>setNewRow(p=>({...p,name:e.target.value}))}  placeholder="Product name" className={iCls} autoFocus/></td>
                    <td className={tdCls}><input value={newRow.type}  onChange={e=>setNewRow(p=>({...p,type:e.target.value}))}  placeholder="Type"         className={iCls}/></td>
                    <td className={tdCls}><input value={newRow.price} onChange={e=>setNewRow(p=>({...p,price:e.target.value}))} type="number" placeholder="0" className={iCls}/></td>
                    <td className={tdCls}><input value={newRow.stock} onChange={e=>setNewRow(p=>({...p,stock:e.target.value}))} type="number" placeholder="0" className={iCls}/></td>
                    <td className={`${tdCls} flex gap-1.5`}>
                      {ab('text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20', handleAdd, <Check size={13}/>)}
                      {ab('text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800', () => setAdding(false), <X size={13}/>)}
                    </td>
                  </tr>
                )}
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    {editId===p.id ? (
                      <>
                        <td className={tdCls}><input value={editData.name}  onChange={e=>setEditData(d=>({...d,name:e.target.value}))}  placeholder="Name"  className={iCls} autoFocus/></td>
                        <td className={tdCls}><input value={editData.type}  onChange={e=>setEditData(d=>({...d,type:e.target.value}))}  placeholder="Type"  className={iCls}/></td>
                        <td className={tdCls}><input value={editData.price} onChange={e=>setEditData(d=>({...d,price:e.target.value}))} type="number" placeholder="0" className={iCls}/></td>
                        <td className={tdCls}><input value={editData.stock} onChange={e=>setEditData(d=>({...d,stock:e.target.value}))} type="number" placeholder="0" className={iCls}/></td>
                        <td className={`${tdCls} flex gap-1.5`}>
                          {ab('text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20', saveEdit, saving?<RefreshCw size={12} className="animate-spin"/>:<Check size={13}/>)}
                          {ab('text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800', () => setEditId(null), <X size={13}/>)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`${tdCls} font-medium text-slate-800 dark:text-slate-200`}>{p.name}</td>
                        <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>{p.type||<span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className={`${tdCls} text-slate-600 dark:text-slate-400`}>₹{Number(p.price).toLocaleString()}</td>
                        <td className={tdCls}><span className={`text-sm font-medium ${p.stock<20?'text-rose-500':'text-slate-600 dark:text-slate-400'}`}>{p.stock}{p.stock<20&&<span className="ml-1 text-[10px]">low</span>}</span></td>
                        <td className={`${tdCls} opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity`}>
                          {ab('text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20', () => startEdit(p), <Pencil size={13}/>)}
                          {ab('text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20', () => handleDelete(p.id), <Trash2 size={13}/>)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {products.length===0 && !adding && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No products yet. Click "Add Product" or re-upload a CSV.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Product Matchups ──────────────────────────────────────────────────────────

function ProductMatchups({ comparisons = [] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">Side-by-side view of your products vs top competitor.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {comparisons.map((r,i) => (
          <Card key={r.id} delay={i*50} className="p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.my_product}</p>
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400 mb-1">You</p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">₹{r.my_price?.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Stock: {r.my_stock}</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{r.competitor}</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">₹{r.competitor_price?.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">{r.trend==='up'?'↑ Rising':r.trend==='down'?'↓ Dropping':'→ Stable'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge status={r.status}/>
              {r.diff!==0&&<span className={`text-xs font-medium ${r.diff>0?'text-rose-500':'text-emerald-500'}`}>{r.diff>0?`You're ₹${r.diff} more expensive`:`You save customer ₹${Math.abs(r.diff)}`}</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── History ───────────────────────────────────────────────────────────────────

function HistoryView({ history = [] }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">Past daily analyses — click any row to expand.</p>
      {history.map((h,i) => {
        const open = expanded===h.id; const d = new Date(h.run_date)
        return (
          <Card key={h.id} delay={i*40}>
            <button onClick={() => setExpanded(open?null:h.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-2xl transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex flex-col items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{d.getDate()}</span>
                <span className="text-[9px] text-indigo-400 uppercase">{d.toLocaleDateString('en-GB',{month:'short'})}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p>
                <div className="flex gap-3 mt-1"><span className="text-xs text-rose-500">{h.undercut_count} undercut</span><span className="text-xs text-emerald-500">{h.optimal_count} winning</span></div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${h.status==='complete'?'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300':'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{h.status}</span>
              {open?<ChevronUp size={15} className="text-slate-400 shrink-0"/>:<ChevronDown size={15} className="text-slate-400 shrink-0"/>}
            </button>
            {open&&<div className="px-5 pb-4 animate-fade-slide-up"><div className="border-t border-slate-100 dark:border-slate-800 pt-4"><p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{h.summary}</p></div></div>}
          </Card>
        )
      })}
    </div>
  )
}

// ── Reports ───────────────────────────────────────────────────────────────────

function ReportsView({ reports = [], userId, onSend }) {
  const [sending, setSending] = useState(null)
  const [toast,   setToast]   = useState('')
  const handleSend = async r => {
    setSending(r.id); await onSend(userId, r.id, r.email); setSending(null)
    setToast(`Report resent to ${r.email}`); setTimeout(() => setToast(''), 3000)
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">All daily intelligence reports.</p>
      <Toast msg={toast}/>
      {reports.map((r,i) => (
        <Card key={r.id} delay={i*50} className="flex items-center gap-4 px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-indigo-600 dark:text-indigo-400"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.date}</p>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Mail size={11}/>{r.email}</p>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{r.status}</span>
          <div className="flex gap-2">
            <button onClick={() => handleSend(r)} disabled={sending===r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 disabled:opacity-50 transition-all">
              {sending===r.id?<RefreshCw size={12} className="animate-spin"/>:<Mail size={12}/>} {sending===r.id?'Sending…':'Resend'}
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <Download size={12}/> PDF
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Competitor Management ─────────────────────────────────────────────────────

function CompetitorSection({ userId, business }) {
  const [competitors, setCompetitors] = useState([])
  const [urlInput,    setUrlInput]    = useState('')
  const [addingUrl,   setAddingUrl]   = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discovered,  setDiscovered]  = useState([])
  const [toast,       setToast]       = useState('')

  useEffect(() => { loadC() }, [userId])
  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function loadC() {
    const data = await getCompetitors(userId); setCompetitors(data)
  }

  async function handleAddByUrl() {
    if (!urlInput.trim()) return
    setAddingUrl(true)
    const res = await addCompetitorByUrl(userId, urlInput.trim())
    if (res?.competitor) {
      const saved = await addCompetitor(userId, { ...res.competitor, source:'url' })
      if (saved) setCompetitors(c => [...c, saved])
      flash(`Added ${res.competitor.name} via URL.`)
    }
    setUrlInput(''); setAddingUrl(false)
  }

  async function handleDiscover() {
    setDiscovering(true)
    const res = await discoverCompetitorsByLocation(userId, business?.location, business?.businessType)
    const existing = new Set(competitors.map(c => c.website))
    setDiscovered((res.competitors||[]).filter(c => !existing.has(c.website)))
    setDiscovering(false)
  }

  async function handleSelectDiscovered(comp) {
    const saved = await addCompetitor(userId, { name:comp.name, website:comp.website, location:comp.location, source:'location' })
    if (saved) setCompetitors(c => [...c, saved])
    setDiscovered(d => d.filter(c => c.website!==comp.website))
    flash(`Added ${comp.name}.`)
  }

  async function handleRemove(id, name) {
    await deleteCompetitor(id); setCompetitors(c => c.filter(x => x.id!==id)); flash(`Removed ${name}.`)
  }

  const srcCls = s => ({ manual:'bg-slate-100 dark:bg-slate-800 text-slate-500', url:'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', location:'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400', auto:'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' }[s]||'bg-slate-100 dark:bg-slate-800 text-slate-400')

  return (
    <Card>
      <SectionHeader title="Competitor Management" action={<Users size={16} className="text-slate-400"/>}/>
      <div className="p-5 space-y-6">
        <Toast msg={toast}/>

        {/* Current list */}
        <div className="space-y-2">
          {competitors.length===0 && <p className="text-xs text-slate-400 text-center py-3">No competitors tracked yet.</p>}
          {competitors.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 group">
              <Globe size={14} className="text-slate-400 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
                {c.website&&<a href={`https://${c.website}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 truncate">{c.website}<ExternalLink size={9}/></a>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${srcCls(c.source)}`}>{c.source||'manual'}</span>
              <button onClick={() => handleRemove(c.id, c.name)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0"><Trash2 size={12}/></button>
            </div>
          ))}
        </div>

        {/* Add by URL */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Add by Website URL</p>
          <p className="text-xs text-slate-400 mb-3">Paste any competitor website — AI scrapes their details automatically.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddByUrl()}
                placeholder="https://competitor.com"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"/>
            </div>
            <button onClick={handleAddByUrl} disabled={addingUrl||!urlInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-all">
              {addingUrl?<RefreshCw size={13} className="animate-spin"/>:<Plus size={13}/>} {addingUrl?'Scraping…':'Add'}
            </button>
          </div>
        </div>

        {/* Discover by location */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Discover by Location</p>
          <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
            <MapPin size={11}/> AI searches near <strong className="text-slate-600 dark:text-slate-300 mx-0.5">{business?.location||'your location'}</strong> for competitors in {business?.businessType||'your category'}.
          </p>
          <button onClick={handleDiscover} disabled={discovering}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-violet-600 dark:bg-violet-500 text-white hover:bg-violet-700 disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-0.5 transition-all">
            {discovering?<><RefreshCw size={13} className="animate-spin"/>Searching…</>:<><Search size={13}/>Find Competitors Near Me</>}
          </button>

          {discovered.length>0 && (
            <div className="mt-4 space-y-2 animate-fade-slide-up">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{discovered.length} found — click to add:</p>
              {discovered.map((c,i) => (
                <button key={i} onClick={() => handleSelectDiscovered(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-left transition-all group">
                  <Globe size={14} className="text-indigo-400 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.website} · {c.distance}</p>
                  </div>
                  <Plus size={14} className="text-indigo-400 group-hover:text-indigo-600 shrink-0"/>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsView({ userId, business }) {
  const [saved, setSaved] = useState(false)
  const [form,  setForm]  = useState({ gmail:business?.gmail||'', schedule:'06:00', timezone:'Asia/Kolkata', n8n:'', supabase:'' })
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="max-w-xl space-y-5">
      {saved && <Toast msg="Settings saved."/>}
      {[
        { title:'Notifications', icon:Mail, fields:[{ label:'Gmail for Daily Reports', key:'gmail', type:'email', placeholder:'you@gmail.com' }]},
        { title:'Schedule',      icon:Calendar, fields:[{ label:'Daily Briefing Time', key:'schedule', type:'time' },{ label:'Timezone', key:'timezone', type:'text', placeholder:'Asia/Kolkata' }]},
        { title:'Integrations',  icon:Shield, fields:[{ label:'n8n Webhook URL', key:'n8n', type:'url', placeholder:'https://your.n8n.cloud/webhook/business-strategy' },{ label:'Supabase Project URL', key:'supabase', type:'url', placeholder:'https://xyz.supabase.co' }]},
      ].map(({ title, icon:Icon, fields }) => (
        <Card key={title}>
          <SectionHeader title={title} action={<Icon size={16} className="text-slate-400"/>}/>
          <div className="p-5 space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"/>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <button onClick={save} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/25 transition-all">
        <CheckCircle2 size={15}/> Save Settings
      </button>
      <CompetitorSection userId={userId} business={business}/>
    </div>
  )
}

// ── Chat FAB ──────────────────────────────────────────────────────────────────

function ChatFAB({ userId, context }) {
  const [open,   setOpen]   = useState(false)
  const [msgs,   setMsgs]   = useState([{ role:'bot', text:"Hi! I'm your AI Market Intelligence assistant powered by Gemini. Ask me anything about your pricing, competitors, or strategy." }])
  const [input,  setInput]  = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])

  const send = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput(''); setTyping(true)

    // Build chat history — skip the first greeting message (index 0)
    const history = msgs
      .slice(1)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }))

    setMsgs(m => [...m, { role:'user', text }])

    // Priority 1: Gemini (with full business context)
    let reply = await askGemini(text, history, context)

    // Priority 2: n8n webhook — only if webhook URL is actually configured
    if (!reply && import.meta.env.VITE_N8N_WEBHOOK) {
      const res = await sendChatMessage(userId || 'mock_user_001', text, history)
      reply = res?.reply
    }

    // Priority 3: informative fallback
    if (!reply) reply = "AI chat is not configured yet. Please add your VITE_GEMINI_API_KEY to the .env file and restart the dev server. You can get a free key at https://aistudio.google.com/app/apikey"

    setTyping(false)
    setMsgs(m => [...m, { role:'bot', text: reply }])
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-slide-up">
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 dark:bg-indigo-500 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-200"/>
              <span className="text-sm font-semibold text-white">AI Assistant</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
            </div>
            <button onClick={() => setOpen(false)} className="text-indigo-200 hover:text-white transition-colors"><X size={16}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-64 min-h-40">
            {msgs.map((m,i) => (
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${m.role==='user'?'bg-indigo-600 dark:bg-indigo-500 text-white rounded-br-sm':'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-sm'}`}>{m.text}</div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-4">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}</div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 dark:border-slate-800">
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about pricing, competitors…"
              className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"/>
            <button onClick={send} className="w-8 h-8 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"><Send size={13}/></button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o=>!o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200 flex items-center justify-center">
        {open?<X size={22}/>:<MessageCircle size={22}/>}
      </button>
    </>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ dark, setDark, business, authUser }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [active,     setActive]     = useState('briefing')
  const [analysis,   setAnalysis]   = useState(null)
  const [history,    setHistory]    = useState([])
  const [reports,    setReports]    = useState([])
  const [products,   setProducts]   = useState([])      // for Gemini context
  const [competitors,setCompetitors]= useState([])      // for Gemini context
  const [refreshing, setRefreshing] = useState(false)
  const [loading,    setLoading]    = useState(true)

  const uid = business?.id || authUser?.id || 'mock_user_001'

  useEffect(() => {
    Promise.all([
      fetchLatestAnalysis(uid),
      fetchHistory(uid),
      fetchReports(uid),
      getProducts(uid),
      getCompetitors(uid),
    ])
      .then(([a,h,r,p,c]) => {
        setAnalysis(a); setHistory(h); setReports(r)
        setProducts(p || []); setCompetitors(c || [])
        setLoading(false)
      })
      .catch(() => {
        setAnalysis({ ...MOCK_ANALYSIS })
        setHistory(MOCK_HISTORY)
        setReports([])
        setLoading(false)
      })
  }, [uid])

  const handleRefresh = async () => {
    setRefreshing(true); await triggerRefresh(uid)
    const a = await fetchLatestAnalysis(uid); setAnalysis(a); setRefreshing(false)
  }

  const handleLogout = async () => {
    await signOut()
    // Auth state listener in App.jsx will handle redirecting to login
  }

  const stats = [
    { label:'Products Tracked', value:analysis?.comparisons?.length??'—',                                   icon:Package,     color:'text-indigo-600 dark:text-indigo-400',   bg:'bg-indigo-50 dark:bg-indigo-900/30',   delay:0   },
    { label:'Competitors',       value:analysis?.competitors_scouted?.length??'—',                          icon:Users,       color:'text-violet-600 dark:text-violet-400',   bg:'bg-violet-50 dark:bg-violet-900/30',   delay:50  },
    { label:'Items Undercut',    value:analysis?.comparisons?.filter(c=>c.status==='undercut').length??'—', icon:TrendingDown,color:'text-rose-600 dark:text-rose-400',       bg:'bg-rose-50 dark:bg-rose-900/30',       delay:100 },
    { label:'Price Wins',        value:analysis?.comparisons?.filter(c=>c.status==='optimal').length??'—',  icon:TrendingUp,  color:'text-emerald-600 dark:text-emerald-400', bg:'bg-emerald-50 dark:bg-emerald-900/30', delay:150 },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c=>!c)} active={active} onNav={setActive}/>
      <Header collapsed={collapsed} dark={dark} setDark={setDark} active={active} business={business} onRefresh={handleRefresh} refreshing={refreshing} onLogout={handleLogout}/>

      <main className="pt-16 transition-all duration-300" style={{ marginLeft: collapsed?'4rem':'14rem' }}>
        <div className="px-6 py-8 max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <p className="text-sm text-slate-400">Loading intelligence data…</p>
              </div>
            </div>
          ) : (
            <>
              {active==='briefing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{stats.map(s=><StatCard key={s.label} {...s}/>)}</div>
                  <AISummaryCard analysis={analysis}/>
                  <SuggestionsGrid suggestions={analysis?.suggestions}/>
                  <CompetitorTable comparisons={analysis?.comparisons}/>
                </div>
              )}
              {active==='products' && <MyProductsView userId={uid}/>}
              {active==='matchups' && <ProductMatchups comparisons={analysis?.comparisons}/>}
              {active==='history'  && <HistoryView history={history}/>}
              {active==='reports'  && <ReportsView reports={reports} userId={uid} onSend={sendReport}/>}
              {active==='settings' && <SettingsView userId={uid} business={business}/>}
            </>
          )}
        </div>
      </main>
      <ChatFAB userId={uid} context={{ business, analysis, products, competitors }}/>
    </div>
  )
}
