/* ─────────────────────────────────────────────────────────────────────────────
   api.js  –  All calls to n8n Cloud

   Single webhook URL handles every operation.
   n8n switches on the  "type"  field in the request body.

   Webhook: https://marketdemo11.app.n8n.cloud/webhook-test/business-strategy
   Env var: VITE_N8N_WEBHOOK

   Fallback: every function returns rich mock data when the webhook is
   unreachable or not yet configured — so the UI always renders.
───────────────────────────────────────────────────────────────────────────── */

const WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK

/* ── HTTP helper ─────────────────────────────────────────────────────────── */

async function call(type, body = {}) {
  if (!WEBHOOK) return null          // no URL → use mock
  try {
    const res = await fetch(WEBHOOK, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ type, ...body }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    return text ? JSON.parse(text) : { ok: true }
  } catch (err) {
    console.warn(`[api] n8n call type="${type}" failed — using mock.`, err.message)
    return null                      // null → caller falls back to mock
  }
}

/* ── Mock data ───────────────────────────────────────────────────────────── */

const MOCK_ANALYSIS = {
  id       : 'mock_001',
  run_date : new Date().toISOString(),
  status   : 'complete',
  summary  :
    'Raza Textiles dropped Silk Saree prices by 5%. You are undercut on 3 of 7 tracked products. ' +
    'FabIndia raised Cotton Kurta prices by 6% — opportunity to capture their customers. ' +
    'Overall market sentiment is stable with slight downward pricing pressure in ethnic wear.',
  comparisons: [
    { id:1, my_product:'Silk Saree (Red)',   my_price:2499, my_stock:45,  competitor:'Raza Textiles', competitor_price:2349, diff:150,  status:'undercut', trend:'down' },
    { id:2, my_product:'Cotton Kurta (M)',   my_price:899,  my_stock:120, competitor:'FabIndia',      competitor_price:950,  diff:-51,  status:'optimal',  trend:'up'   },
    { id:3, my_product:'Linen Blazer (L)',   my_price:3200, my_stock:18,  competitor:'Mango',         competitor_price:3199, diff:1,    status:'undercut', trend:'flat' },
    { id:4, my_product:'Denim Jeans (32)',   my_price:1499, my_stock:67,  competitor:"Levi's Store",  competitor_price:1599, diff:-100, status:'optimal',  trend:'up'   },
    { id:5, my_product:'Floral Dupatta',     my_price:599,  my_stock:200, competitor:'Craftsvilla',   competitor_price:549,  diff:50,   status:'undercut', trend:'down' },
    { id:6, my_product:'Embroidered Kurta',  my_price:1199, my_stock:55,  competitor:'W for Woman',   competitor_price:1299, diff:-100, status:'optimal',  trend:'up'   },
    { id:7, my_product:'Georgette Saree',    my_price:1899, my_stock:30,  competitor:'Myntra',        competitor_price:1899, diff:0,    status:'tied',     trend:'flat' },
  ],
  suggestions: [
    { id:1, priority:'high',   icon:'trending-down', title:'Drop Silk Saree price to ₹2,299',        body:'Raza Textiles undercuts you by ₹150. A targeted 8% reduction for 48 hrs can recover ~15% lost foot traffic.',                      impact:'~₹4,200 potential weekly revenue recovery' },
    { id:2, priority:'high',   icon:'trending-up',   title:'Capture FabIndia customers on Kurtas',   body:'FabIndia raised Cotton Kurta prices by 6%. A "Same Quality, Better Price" promotion can capture their price-sensitive audience.',   impact:'Estimated +8–12% sales volume'             },
    { id:3, priority:'medium', icon:'package',       title:'Restock Linen Blazers — only 18 left',   body:'Stock is low and competitor is priced at near-parity. A stockout now loses customers you cannot recapture easily.',                impact:'Prevent stockout loss of ~₹18,000'         },
    { id:4, priority:'low',    icon:'tag',           title:'Test +5% on Embroidered Kurta',          body:"You are already ₹100 cheaper than W for Woman. There is headroom to test a modest price increase without losing customers.",       impact:'Potential +₹660 per 10 units sold'         },
  ],
  competitors_scouted: [
    { name:'Raza Textiles', website:'razatextiles.com', products_tracked:12, last_scraped:'Today 6:00 AM' },
    { name:'FabIndia',      website:'fabindia.com',      products_tracked:9,  last_scraped:'Today 6:00 AM' },
    { name:'Mango',         website:'mango.com',         products_tracked:4,  last_scraped:'Today 6:00 AM' },
    { name:"Levi's Store",  website:'levi.com',          products_tracked:3,  last_scraped:'Today 6:00 AM' },
    { name:'Craftsvilla',   website:'craftsvilla.com',   products_tracked:7,  last_scraped:'Today 6:00 AM' },
  ],
}

const MOCK_HISTORY = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - i)
  return {
    id             : `mock_00${i + 1}`,
    run_date       : d.toISOString(),
    status         : 'complete',
    summary        : i === 0
      ? MOCK_ANALYSIS.summary
      : `Day-${i} scan complete. Market conditions stable. ${2 + i} products reviewed against ${3 + i} competitors.`,
    undercut_count : [3,2,4,1,3,2,2][i],
    optimal_count  : [4,5,3,6,4,5,5][i],
  }
})

const MOCK_REPORTS = [
  { id:'r1', date:'Mon 9 Mar 2026', email:'owner@gmail.com', status:'sent' },
  { id:'r2', date:'Sun 8 Mar 2026', email:'owner@gmail.com', status:'sent' },
  { id:'r3', date:'Sat 7 Mar 2026', email:'owner@gmail.com', status:'sent' },
  { id:'r4', date:'Fri 6 Mar 2026', email:'owner@gmail.com', status:'sent' },
]

const MOCK_CHAT_REPLIES = [
  "Based on today's data, your biggest opportunity is the Cotton Kurta segment where FabIndia raised prices. I recommend a targeted social campaign this week.",
  "Your Silk Saree pricing is ₹150 above Raza Textiles. A 48-hour flash sale at ₹2,299 should recover lost foot traffic without hurting margins significantly.",
  "Linen Blazer stock is critically low at 18 units. At current sales velocity you have roughly 6 days of stock left. Place a restock order today.",
  "You are winning on price for 4 of 7 tracked products. Your strongest position is Denim Jeans — ₹100 cheaper than Levi's.",
]

/* ── Public API functions ─────────────────────────────────────────────────── */

/**
 * Submit onboarding data to n8n.
 * Payload shape n8n receives:
 * {
 *   type        : "onboarding",
 *   business    : { companyName, businessType, location, website, gmail },
 *   products    : [ { ... } ],          // parsed CSV rows
 *   competitors : { mode, items }       // mode = "auto" | "manual"
 * }
 */
export async function submitOnboarding(payload) {
  const res = await call('onboarding', payload)
  if (res) return res
  // mock fallback
  await new Promise(r => setTimeout(r, 1500))
  return { user_id: 'mock_user_001', status: 'processing' }
}

/**
 * Fetch latest analysis.
 * n8n receives: { type: "analysis", user_id, action: "latest" }
 */
export async function fetchLatestAnalysis(userId) {
  const res = await call('analysis', { user_id: userId, action: 'latest' })
  return res ?? { ...MOCK_ANALYSIS }
}

/**
 * Fetch analysis history (last 30 days).
 * n8n receives: { type: "analysis", user_id, action: "history", limit: 30 }
 */
export async function fetchHistory(userId) {
  const res = await call('analysis', { user_id: userId, action: 'history', limit: 30 })
  return res ?? MOCK_HISTORY
}

/**
 * Fetch reports list.
 * n8n receives: { type: "reports", user_id }
 */
export async function fetchReports(userId) {
  const res = await call('reports', { user_id: userId })
  return res ?? MOCK_REPORTS
}

/**
 * Send a chat message.
 * n8n receives: { type: "chat", user_id, message, history }
 * n8n must return: { reply: "..." }
 */
export async function sendChatMessage(userId, message, history = []) {
  const res = await call('chat', { user_id: userId, message, history })
  if (res?.reply) return res
  // mock fallback
  await new Promise(r => setTimeout(r, 800))
  return { reply: MOCK_CHAT_REPLIES[Math.floor(Math.random() * MOCK_CHAT_REPLIES.length)] }
}

/**
 * Trigger a manual re-analysis.
 * n8n receives: { type: "refresh", user_id }
 */
export async function triggerRefresh(userId) {
  const res = await call('refresh', { user_id: userId })
  if (res) return res
  await new Promise(r => setTimeout(r, 600))
  return { status: 'queued', message: 'Analysis queued — results ready in ~2 minutes.' }
}

/**
 * Request a report to be emailed via n8n → Gmail.
 * n8n receives: { type: "report", user_id, analysis_id, email }
 */
export async function sendReport(userId, analysisId, email) {
  const res = await call('report', { user_id: userId, analysis_id: analysisId, email })
  if (res) return res
  await new Promise(r => setTimeout(r, 700))
  return { status: 'sent', message: `Report sent to ${email}` }
}

/**
 * Scrape a competitor's website URL and return their business info.
 * n8n receives: { type: "competitor_add_url", user_id, url }
 * n8n must return: { competitor: { name, website, source: "url" } }
 */
export async function addCompetitorByUrl(userId, url) {
  const res = await call('competitor_add_url', { user_id: userId, url })
  if (res?.competitor) return res
  // mock fallback — simulate scrape result
  await new Promise(r => setTimeout(r, 900))
  const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
  return {
    competitor: {
      name    : domain.split('.')[0].replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
      website : domain,
      source  : 'url',
    },
  }
}

/**
 * Discover top competitors near the user's location using AI + Google search.
 * n8n receives: { type: "competitor_discover_location", user_id, location, business_type }
 * n8n must return: { competitors: [ { name, website, location, distance } ] }
 */
export async function discoverCompetitorsByLocation(userId, location, businessType) {
  const res = await call('competitor_discover_location', {
    user_id       : userId,
    location      : location || '',
    business_type : businessType || '',
  })
  if (res?.competitors) return res
  // mock fallback
  await new Promise(r => setTimeout(r, 1400))
  return {
    competitors: [
      { name:'Bombay Cloth House',  website:'bombayclothhouse.in', location, distance:'0.8 km' },
      { name:'Silk India Bazaar',   website:'silkindiabazaar.com', location, distance:'1.2 km' },
      { name:'National Handlooms',  website:'nationalhandlooms.com',location, distance:'1.5 km' },
      { name:'Ethnic Weaves',       website:'ethnicweaves.in',     location, distance:'2.1 km' },
      { name:'Saree Palace',        website:'sareepalace.com',     location, distance:'2.4 km' },
      { name:'Traditions Textiles', website:'traditionstextiles.in',location,distance:'3.0 km' },
    ],
  }
}

export { MOCK_ANALYSIS, MOCK_HISTORY }
