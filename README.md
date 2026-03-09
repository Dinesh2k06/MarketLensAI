# Multi-Agent Market Intelligence Bot

> **AI-powered competitive intelligence platform for small businesses**
> Scout competitors daily, compare products, get actionable pricing insights — all automated.

---

## 🎯 What It Does

This is a **B2B SaaS tool** that helps small business owners monitor their competition and optimize pricing:

1. **Onboarding Wizard** — Collect business info, upload product CSV, add competitors (manual or auto-discover by location)
2. **Daily Automated Analysis** — n8n agents scout competitor websites every morning, compare products, generate AI insights
3. **Dashboard** — View AI summary, product matchups (You vs Competitor), pricing suggestions, history timeline
4. **AI Chatbot** — Ask questions about your data, get strategic advice based on analysis history
5. **Gmail Reports** — Automated daily reports delivered to your inbox

---

## 🛠️ Tech Stack

| Layer | Technology |
| ------- | ----------- |
| **Frontend** | React 19 + Vite 7 |
| **Styling** | Tailwind CSS v4 (with `@tailwindcss/vite` plugin) |
| **Icons** | Lucide React |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email + password) |
| **AI Chatbot** | Google Gemini 1.5 Flash (direct REST API) |
| **Automation** | n8n Cloud (webhook-based multi-agent system) |
| **CSV Parsing** | PapaParse |
| **Email** | n8n Gmail integration |

---

## 📂 Project Structure

```text
c:\Multi-Agent Market Intelligence Bot
├── src/
│   ├── App.jsx                       # Main router (Login → Wizard → Dashboard)
│   ├── index.css                     # Tailwind v4 entry + dark mode variant
│   ├── components/
│   │   ├── LoginPage.jsx             # Email/password login + signup page
│   │   ├── OnboardingWizard.jsx      # 4-step wizard (Business → Products → Competitors → Launch)
│   │   └── Dashboard.jsx             # Main dashboard (6 views + sidebar + header + chat FAB)
│   └── services/
│       ├── api.js                    # n8n webhook client (single URL, routed by "type" field)
│       ├── auth.js                   # Supabase Auth wrapper (signUp, signIn, signOut, onAuthStateChange)
│       ├── gemini.js                 # Gemini 1.5 Flash AI — chat with full business context
│       └── supabase.js               # Supabase CRUD (products, competitors, analyses, reports)
├── supabase_schema.sql               # Database schema (5 tables with RLS)
├── n8n_workflow.json                 # Importable n8n workflow (35+ nodes, all 8 routes wired)
├── .env                              # Environment variables (fill from .env.example)
└── .env.example                      # Template for .env (all 4 required keys)
```

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

1. Go to **[supabase.com](https://supabase.com)** → Create new project
2. In Supabase dashboard → **SQL Editor** → New query
3. Copy the entire contents of `supabase_schema.sql` and run it
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon / public key** (starts with `eyJ...`)

5. Add to `.env`:

   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJyour-anon-key-here...
   ```

### 3. Gemini AI Setup (for the chatbot)

1. Go to **[Google AI Studio](https://aistudio.google.com/app/apikey)** → Create API key (free tier available)
2. Add to `.env`:

   ```env
   VITE_GEMINI_API_KEY=your-key-here
   ```

### 4. n8n Workflow Setup

A complete importable workflow is included at `n8n_workflow.json`.

**Import steps:**

1. In n8n Cloud go to **Workflows → Import from file** and select `n8n_workflow.json`
2. Open the **Config** node and replace both placeholder values:
   - `YOUR_PROJECT_ID` → your Supabase project ID
   - `YOUR_ANON_KEY` → your Supabase anon key
3. Do the same replacements in the **Daily Scheduler** section HTTP nodes (5 nodes: Get All Users, Get Products, Get Competitors, Save Analysis, Save Report Record)
4. Add credentials in **n8n Settings → Credentials**:
   - **Google Gemini API** — key from aistudio.google.com
   - **Gmail OAuth2** — for daily report emails
5. Click **Activate** (toggle in top-right)
6. Copy the production webhook URL from the Webhook node and add to `.env`:

```env
VITE_N8N_WEBHOOK=https://your.n8n.cloud/webhook/business-strategy
```

The workflow handles these `type` values routed by a Switch node:

- `onboarding` — Acknowledge receipt (frontend saves data to Supabase directly)
- `analysis` — Fetch latest or history (action: `latest` or `history`)
- `reports` — Fetch past report records
- `chat` — AI chatbot via Gemini (fallback — browser calls Gemini directly first)
- `refresh` — Run full market analysis with Gemini, save to Supabase
- `report` — Build HTML email and send via Gmail
- `competitor_add_url` — Scrape website, extract business name
- `competitor_discover_location` — Return nearby competitor suggestions

### 5. Run Development Server

```bash
npm run dev
```

Open <http://localhost:5173>

### 6. Build for Production

```bash
npm run build
```

Output: `dist/` folder ready to deploy (Vercel, Netlify, etc.)

---

## 🎨 Features

### Onboarding Wizard (4 Steps)

- **Step 1: Business Info** — Company name, type, location, website (optional), Gmail
- **Step 2: Products** — Drag-and-drop CSV upload with live preview table (handles multiple column name formats)
- **Step 3: Competitors** — Toggle between "Auto-discover by location" or "Manual entry" (paste URLs)
- **Step 4: Review & Launch** — Summary card → "Start War Room Analysis" button

### Dashboard (6 Views)

1. **Daily Briefing**
   - 4 stat cards (Total Products, Competitors Tracked, Products Undercut, Winning Pricing)
   - AI Summary Card (generated by n8n agent)
   - Suggestions Grid (High/Medium/Low priority pills with impact estimates)
   - Competitor Comparison Table (filter tabs: All / Undercut / Winning)

2. **My Products**
   - Full CRUD: inline edit (pencil icon), delete (trash icon), add new product
   - Re-upload CSV anytime (replaces all via `bulkUpsertProducts` with `onConflict` handling)
   - Toast notifications for all actions

3. **Product Matchups**
   - Side-by-side "You vs Competitor" cards
   - Trend indicators (↑ up, ↓ down, → flat)

4. **History**
   - Expandable timeline cards (last 30 days)
   - Undercut/Optimal counts per day

5. **Reports**
   - List of past reports with "Resend to Gmail" and "Download PDF" buttons

6. **Settings**
   - Notifications, Schedule, Integrations config cards
   - **Competitor Management Section**:
     - View current competitors with source badges (manual / url / location / auto)
     - "Add by Website URL" → n8n scrapes competitor data
     - "Discover by Location" → n8n searches Google, returns suggested competitors to add

### AI Chat Assistant (FAB)

- Fixed bottom-right floating action button
- Slide-up chat panel with message history
- Typing indicator with bouncing dots animation
- **Powered by Google Gemini 1.5 Flash** — injects your business profile, products, competitors, and latest analysis as context so every answer is personalised
- Fallback chain: Gemini → n8n webhook → informative error message
- Answers general business, pricing, and retail strategy questions — not limited to your data

### Dark Mode

- Manual toggle in header (moon/sun icon)
- Persisted to `localStorage`
- Class-based strategy (`<html class="dark">`)
- Custom Tailwind v4 variant: `@custom-variant dark`

---

## 🗄️ Database Schema (Supabase)

### Tables

1. **users** — Business profile (company name, type, location, website, gmail)
2. **products** — User's product catalog (name, type, price, stock) — `unique(user_id, name)` for upsert
3. **competitors** — Tracked competitors (name, website, source: manual/url/location/auto)
4. **analyses** — Daily analysis results (summary, comparisons JSON, suggestions JSON)
5. **reports** — Report delivery history (analysis_id, email, status)

All tables have **Row Level Security (RLS)** enabled with permissive policies for `service_role`.

---

## 🔌 API Integration (`src/services/api.js`)

All operations POST to a **single n8n webhook URL** with a `type` discriminator field:

### Example: Onboarding Submission

```js
POST https://marketdemo11.app.n8n.cloud/webhook-test/business-strategy
{
  "type": "onboarding",
  "business": { "companyName": "...", "businessType": "...", ... },
  "products": [ { "name": "...", "price": 999, ... } ],
  "competitors": { "mode": "auto", "items": [...] }
}
```

### All API Functions

| Function | Type | Request Body |
| ---------- | ------ | ------------- |
| `submitOnboarding` | `onboarding` | `{ business, products, competitors }` |
| `fetchLatestAnalysis` | `analysis` | `{ user_id, action: "latest" }` |
| `fetchHistory` | `analysis` | `{ user_id, action: "history", limit: 30 }` |
| `sendChatMessage` | `chat` | `{ user_id, message, history }` |
| `triggerRefresh` | `refresh` | `{ user_id }` |
| `sendReport` | `report` | `{ user_id, analysis_id, email }` |
| `addCompetitorByUrl` | `competitor_add_url` | `{ user_id, url }` |
| `discoverCompetitorsByLocation` | `competitor_discover_location` | `{ user_id, location, business_type }` |

### Mock Data Fallback

Every function returns **rich mock data** when the webhook is unreachable or env vars are unset, so the entire UI is testable without backend configuration.

---

## 🎨 Styling Details

### Tailwind CSS v4

- Uses `@tailwindcss/vite` plugin (NOT postcss-based)
- Class changes from v3:
  - `bg-gradient-to-r` → `bg-linear-to-r`
  - `max-w-[120px]` → `max-w-30`
- Custom animation: `animate-fade-slide-up` (defined in `index.css`)

### Dark Mode Implementation

```css
/* index.css */
@custom-variant dark (&:where(.dark, .dark *));
```

```jsx
// App.jsx toggles class on document.documentElement
useEffect(() => {
  if (dark) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}, [dark])
```

### Color Palette (60-30-10 Rule)

- **60% Neutral**: `bg-white dark:bg-gray-950`, `text-gray-900 dark:text-white`
- **30% Accent**: `bg-blue-50 dark:bg-blue-950`, `text-blue-600 dark:text-blue-400`
- **10% Highlight**: `bg-blue-600 hover:bg-blue-700`, CTA buttons

---

## 🔧 Development Notes

### CSV Upload

- Client-side parsing with **PapaParse**
- Handles multiple column name variations:
  - Product Name / product_name / Name / name
  - Type / type / Category / category
  - Price / price / MRP / mrp
  - Stock / stock / Quantity / qty

### Supabase Upsert

```js
// Prevents duplicate products on CSV re-upload
supabase.from('products').upsert(rows, { onConflict: 'user_id,name' })
```

### Component State Management

- **App.jsx**: Dark mode, business data (triggers wizard ↔ dashboard routing)
- **Dashboard.jsx**: Current view, sidebar collapsed state, analysis data, products, competitors, chat messages
- **OnboardingWizard.jsx**: Step index, form data (business, products, competitors), loading states

---

## 🚧 Next Steps (Not Yet Implemented)

1. **PDF Report Generation**
   - Currently mock button in Reports view
   - Needs n8n PDF generation node or puppeteer integration

2. **Competitor Auto-Discovery (Real)**
   - `n8n_workflow.json` returns mock results for location discovery
   - Replace with SerpAPI or Apify node for real Google search results

3. **Real-Time Analysis Status**
   - Show progress indicator when analysis is running
   - Polling or WebSocket connection to n8n

---

## 📝 License

MIT

---

## 🤝 Contributing

Built for small business owners with zero technical knowledge. Prioritize:

- **Simplicity**: No complex config, works out of the box
- **Mock data fallback**: UI stays functional even without backend
- **Clear error messages**: Guide users when something goes wrong
- **Minimal onboarding**: 4 steps, under 2 minutes

---

## 📧 Support

For issues or questions, open a GitHub issue.

---

**Last Updated**: March 10, 2026
**Version**: 1.0.0
**Status**: Frontend complete ✅ | Auth complete ✅ | Gemini AI complete ✅ | Supabase ready ✅ | n8n workflow complete ✅
