-- =============================================
-- DATABASE SCHEMA MIGRATION: 001_initial_schema.sql
-- =============================================

-- Enable extension for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  phone         TEXT,
  fcm_token     TEXT,
  currency      TEXT DEFAULT 'VND',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FRIEND CIRCLES (Groups)
-- =============================================
CREATE TABLE public.circles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  owner_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code   TEXT UNIQUE DEFAULT substr(md5(random()::TEXT), 1, 8),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.circle_members (
  circle_id     UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT DEFAULT 'member', -- 'owner' | 'member'
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY   (circle_id, user_id)
);

-- =============================================
-- POSTS
-- =============================================
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id     UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  photo_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  caption       TEXT,
  has_expense   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXPENSE CATEGORIES
-- =============================================
CREATE TABLE public.expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  icon          TEXT, -- SF Symbol name
  color         TEXT, -- hex color e.g., "#FF9500"
  budget_limit  BIGINT, -- monthly limit in base currency unit
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXPENSES
-- =============================================
CREATE TABLE public.expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  circle_id     UUID REFERENCES public.circles(id) ON DELETE SET NULL,
  category_id   UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount        BIGINT NOT NULL, -- stored in smallest unit (e.g. VND / cents)
  currency      TEXT DEFAULT 'VND',
  description   TEXT,
  source        TEXT DEFAULT 'auto', -- 'auto' | 'manual'
  expense_date  DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BUDGET PERIODS (Monthly limits and spent totals)
-- =============================================
CREATE TABLE public.budget_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL, -- first day of month
  period_end    DATE NOT NULL, -- last day of month
  total_budget  BIGINT, -- user-set monthly budget
  total_spent   BIGINT DEFAULT 0, -- auto-aggregated from expenses
  currency      TEXT DEFAULT 'VND',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE        (user_id, period_start)
);

-- =============================================
-- NOTIFICATIONS LOG
-- =============================================
CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- 'new_post' | 'expense_logged' | 'budget_alert'
  title         TEXT,
  body          TEXT,
  data          JSONB,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
