/* ─────────────────────────────────────────────────────────────────────────────
   supabase.js  —  Supabase client + all CRUD operations

   Falls back to mock data automatically when env vars are not set,
   so the UI stays fully functional before Supabase is connected.

   Setup:
     1. Create a project at https://supabase.com
     2. Run supabase_schema.sql in the Supabase SQL Editor
     3. Add to .env:
           VITE_SUPABASE_URL=https://xxxx.supabase.co
           VITE_SUPABASE_ANON_KEY=your-anon-key
───────────────────────────────────────────────────────────────────────────── */

import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (SUPA_URL && SUPA_KEY)
  ? createClient(SUPA_URL, SUPA_KEY)
  : null

export const isSupabaseReady = () => Boolean(supabase)

/* ── Mock data (shown when Supabase is not yet connected) ──────────────────── */

export const MOCK_PRODUCTS = [
  { id:'p1', name:'Silk Saree (Red)',   type:'Sarees',      price:2499, stock:45  },
  { id:'p2', name:'Cotton Kurta (M)',   type:'Kurtas',      price:899,  stock:120 },
  { id:'p3', name:'Linen Blazer (L)',   type:'Blazers',     price:3200, stock:18  },
  { id:'p4', name:'Denim Jeans (32)',   type:'Bottoms',     price:1499, stock:67  },
  { id:'p5', name:'Floral Dupatta',     type:'Accessories', price:599,  stock:200 },
  { id:'p6', name:'Embroidered Kurta',  type:'Kurtas',      price:1199, stock:55  },
  { id:'p7', name:'Georgette Saree',    type:'Sarees',      price:1899, stock:30  },
]

export const MOCK_COMPETITORS = [
  { id:'c1', name:'Raza Textiles', website:'razatextiles.com', source:'manual'   },
  { id:'c2', name:'FabIndia',      website:'fabindia.com',     source:'auto'     },
  { id:'c3', name:'Craftsvilla',   website:'craftsvilla.com',  source:'location' },
]

/* ── Users ──────────────────────────────────────────────────────────────────── */

export async function saveUser(data, userId = null) {
  if (!supabase) return null

  // Map JavaScript camelCase to database snake_case
  const dbData = {
    ...(userId && { id: userId }),  // Include id if provided (for linking to Supabase Auth user)
    company_name: data.companyName,
    business_type: data.businessType,
    location: data.location,
    website: data.website,
    gmail: data.gmail
  }

  const { data: row, error } = await supabase.from('users').insert([dbData]).select().single()
  if (error) console.warn('[supabase] saveUser:', error.message)

  // Map returned row back to camelCase for consistency
  if (row) {
    return {
      id: row.id,
      companyName: row.company_name,
      businessType: row.business_type,
      location: row.location,
      website: row.website,
      gmail: row.gmail,
      created_at: row.created_at
    }
  }
  return null
}

export async function getUser(userId) {
  if (!supabase) return null
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
  if (error) { console.warn('[supabase] getUser:', error.message); return null }

  if (!data) return null

  // Map database snake_case to JavaScript camelCase
  return {
    id: data.id,
    companyName: data.company_name,
    businessType: data.business_type,
    location: data.location,
    website: data.website,
    gmail: data.gmail,
    created_at: data.created_at
  }
}

/* ── Products ───────────────────────────────────────────────────────────────── */

export async function getProducts(userId) {
  if (!supabase) return [...MOCK_PRODUCTS]
  const { data, error } = await supabase
    .from('products').select('*').eq('user_id', userId).order('created_at')
  if (error) { console.warn('[supabase] getProducts:', error.message); return [...MOCK_PRODUCTS] }
  return data ?? []
}

export async function insertProduct(userId, product) {
  if (!supabase) return { id: `mock_${Date.now()}`, user_id: userId, ...product }
  const { data, error } = await supabase
    .from('products').insert({ user_id: userId, ...product }).select().single()
  if (error) { console.warn('[supabase] insertProduct:', error.message); return null }
  return data
}

export async function updateProduct(id, changes) {
  if (!supabase) return
  const { error } = await supabase
    .from('products').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) console.warn('[supabase] updateProduct:', error.message)
}

export async function deleteProduct(id) {
  if (!supabase) return
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) console.warn('[supabase] deleteProduct:', error.message)
}

/**
 * Bulk upsert from a parsed CSV array.
 * Uses case-insensitive column name matching so the user's CSV format
 * doesn't need to be exact. Falls back gracefully on error.
 */
export async function bulkUpsertProducts(userId, rows) {
  // Helper: case-insensitive key lookup on a CSV row object
  function col(row, ...names) {
    const keys = Object.keys(row)
    for (const n of names) {
      const found = keys.find(k => k.trim().toLowerCase() === n.toLowerCase())
      if (found && row[found] !== undefined && row[found] !== '') return row[found]
    }
    return ''
  }

  const mapped = rows
    .map(r => ({
      user_id    : userId,
      name       : String(col(r, 'Product Name', 'product_name', 'Name', 'name', 'product', 'item')).trim(),
      type       : String(col(r, 'Type', 'type', 'Category', 'category', 'product_type')).trim(),
      price      : parseFloat(col(r, 'Price', 'price', 'MRP', 'mrp', 'rate', 'cost', 'selling_price')) || 0,
      stock      : parseInt(col(r, 'Stock', 'stock', 'Quantity', 'quantity', 'qty', 'units', 'inventory'), 10) || 0,
      updated_at : new Date().toISOString(),
    }))
    .filter(p => p.name)   // drop rows where name could not be found

  if (mapped.length === 0) {
    console.warn('[supabase] bulkUpsertProducts: no rows mapped — check CSV column names')
    return []
  }

  if (!supabase) return mapped   // mock mode: return mapped rows so UI can show them

  const { data, error } = await supabase
    .from('products')
    .upsert(mapped, { onConflict: 'user_id,name' })
    .select()                   // ← get saved rows back from Supabase

  if (error) {
    console.warn('[supabase] bulkUpsertProducts:', error.message)
    return mapped               // return local rows so UI still updates
  }
  return data ?? mapped
}

/* ── Competitors ─────────────────────────────────────────────────────────────  */

export async function getCompetitors(userId) {
  if (!supabase) return [...MOCK_COMPETITORS]
  const { data, error } = await supabase
    .from('competitors').select('*').eq('user_id', userId).order('created_at')
  if (error) { console.warn('[supabase] getCompetitors:', error.message); return [...MOCK_COMPETITORS] }
  return data ?? []
}

export async function addCompetitor(userId, competitor) {
  if (!supabase) return { id: `mock_${Date.now()}`, user_id: userId, ...competitor }
  const { data, error } = await supabase
    .from('competitors').insert({ user_id: userId, ...competitor }).select().single()
  if (error) { console.warn('[supabase] addCompetitor:', error.message); return null }
  return data
}

export async function deleteCompetitor(id) {
  if (!supabase) return
  const { error } = await supabase.from('competitors').delete().eq('id', id)
  if (error) console.warn('[supabase] deleteCompetitor:', error.message)
}

/* ── Analyses ────────────────────────────────────────────────────────────────  */

export async function saveAnalysis(payload) {
  if (!supabase) return null
  const { data, error } = await supabase.from('analyses').insert([payload]).select().single()
  if (error) { console.warn('[supabase] saveAnalysis:', error.message); return null }
  return data
}

export async function fetchAnalyses(userId, limit = 30) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('analyses').select('*').eq('user_id', userId)
    .order('run_date', { ascending: false }).limit(limit)
  if (error) { console.warn('[supabase] fetchAnalyses:', error.message); return [] }
  return data ?? []
}
