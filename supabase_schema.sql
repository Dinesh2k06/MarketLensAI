-- ─────────────────────────────────────────────────────────────
-- Market Intelligence — Supabase Schema
-- Paste this entire file into Supabase SQL Editor and run it.
-- ─────────────────────────────────────────────────────────────

-- 1. USERS ──────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null,
  business_type text,
  location      text,
  website       text,
  gmail         text not null,
  created_at    timestamptz default now()
);

-- 2. PRODUCTS ───────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  name        text not null,
  type        text,
  price       numeric(12,2) default 0,
  stock       integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, name)
);

-- 3. COMPETITORS ────────────────────────────────────────────
create table if not exists competitors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  name        text not null,
  website     text,
  source      text default 'manual', -- 'manual' | 'url' | 'location' | 'auto'
  location    text,
  created_at  timestamptz default now()
);

-- 4. ANALYSES ───────────────────────────────────────────────
create table if not exists analyses (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references users(id) on delete cascade,
  run_date             timestamptz default now(),
  status               text default 'pending', -- pending | processing | complete | failed
  summary              text,
  comparisons          jsonb,
  suggestions          jsonb,
  competitors_scouted  jsonb,
  created_at           timestamptz default now()
);

-- 5. REPORTS ────────────────────────────────────────────────
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  analysis_id  uuid references analyses(id),
  sent_to      text,
  sent_at      timestamptz default now(),
  status       text default 'sent'
);

-- ── Indexes ─────────────────────────────────────────────────
create index if not exists products_user_id    on products(user_id);
create index if not exists competitors_user_id on competitors(user_id);
create index if not exists analyses_user_id    on analyses(user_id);
create index if not exists analyses_run_date   on analyses(run_date desc);

-- ── RLS (Row Level Security) ─────────────────────────────────
-- Enable RLS on all tables
alter table users       enable row level security;
alter table products    enable row level security;
alter table competitors enable row level security;
alter table analyses    enable row level security;
alter table reports     enable row level security;

-- Allow all operations via service_role key (used by n8n)
-- For production, tighten these policies per user auth.
create policy "service role full access on users"       on users       for all using (true) with check (true);
create policy "service role full access on products"    on products    for all using (true) with check (true);
create policy "service role full access on competitors" on competitors for all using (true) with check (true);
create policy "service role full access on analyses"    on analyses    for all using (true) with check (true);
create policy "service role full access on reports"     on reports     for all using (true) with check (true);
