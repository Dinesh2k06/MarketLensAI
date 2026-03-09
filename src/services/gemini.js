/* ─────────────────────────────────────────────────────────────────────────────
   gemini.js  —  Google Gemini AI chatbot integration

   Priority chain:
     1. Gemini API (if VITE_GEMINI_API_KEY is set)  ← real AI
     2. n8n webhook fallback
     3. Mock replies

   The Gemini call includes full business context so the AI gives
   accurate, personalised answers about the user's products and competitors.
───────────────────────────────────────────────────────────────────────────── */

const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

/**
 * Build the system context prompt from user's business + analysis data.
 */
function buildSystemPrompt(business, analysis, products, competitors) {
  const bizSection = business ? `
BUSINESS PROFILE:
- Company: ${business.companyName || 'Unknown'}
- Type: ${business.businessType || 'Unknown'}
- Location: ${business.location || 'Unknown'}
- Gmail: ${business.gmail || 'Unknown'}
` : ''

  const productSection = products?.length > 0 ? `
MY PRODUCTS (${products.length} items):
${products.map(p => `- ${p.name}: ₹${p.price}, Stock: ${p.stock}, Type: ${p.type || 'N/A'}`).join('\n')}
` : ''

  const compSection = competitors?.length > 0 ? `
TRACKED COMPETITORS (${competitors.length}):
${competitors.map(c => `- ${c.name} (${c.website || 'no website'})`).join('\n')}
` : ''

  const analysisSection = analysis ? `
LATEST MARKET ANALYSIS:
Summary: ${analysis.summary || 'No summary available'}

PRODUCT COMPARISONS:
${(analysis.comparisons || []).map(c =>
  `- ${c.my_product}: My price ₹${c.my_price} vs ${c.competitor} ₹${c.competitor_price} → Status: ${c.status}`
).join('\n')}

AI SUGGESTIONS:
${(analysis.suggestions || []).map(s =>
  `- [${s.priority?.toUpperCase()}] ${s.title}: ${s.body}`
).join('\n')}
` : ''

  return `You are an expert market intelligence AI assistant for a small business owner in India.
Your role is to help them make smart pricing, inventory, and competitive strategy decisions.
Answer questions clearly, practically, and in a friendly conversational tone.
Use ₹ for Indian Rupee prices. Be helpful and thorough — give real actionable advice.

When the user's specific business data is available below, use it to give personalised answers.
When they ask general questions about business, pricing strategy, marketing, or retail — answer those fully using your knowledge. You are not limited to only the data below.

${bizSection}${productSection}${compSection}${analysisSection}
Always try to be helpful. If you lack specific data to answer precisely, give the best general advice you can and mention what data would make your answer more accurate.`
}

/**
 * Send a message to Gemini with full business context.
 *
 * @param {string}   userMessage   - The user's question
 * @param {Array}    chatHistory   - Previous messages [{role:'user'|'model', text:'...'}]
 * @param {Object}   context       - { business, analysis, products, competitors }
 * @returns {string} AI reply text
 */
export async function askGemini(userMessage, chatHistory = [], context = {}) {
  if (!GEMINI_KEY) return null   // not configured → caller tries n8n / mock

  const systemPrompt = buildSystemPrompt(
    context.business,
    context.analysis,
    context.products,
    context.competitors
  )

  // Build conversation history in Gemini format
  const contents = []

  // Inject system prompt as first user turn (Gemini 1.5 Flash doesn't have separate system role)
  contents.push({
    role: 'user',
    parts: [{ text: systemPrompt }],
  })
  contents.push({
    role: 'model',
    parts: [{ text: 'Understood. I am ready to help with market intelligence questions based on your business data.' }],
  })

  // Add chat history
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  })

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature      : 0.7,
          maxOutputTokens  : 2048,
          topP             : 0.9,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[gemini] API error:', err?.error?.message || res.status)
      return null
    }

    const data = await res.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!reply) {
      console.warn('[gemini] Empty response from API')
      return null
    }

    return reply.trim()

  } catch (err) {
    console.warn('[gemini] Request failed:', err.message)
    return null
  }
}
