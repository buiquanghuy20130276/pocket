-- =============================================
-- DATABASE SCHEMA MIGRATION: 002_rls_policies.sql
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================
CREATE POLICY "allow_auth_select_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- CIRCLES POLICIES
-- =============================================
CREATE POLICY "allow_member_select_circles" ON public.circles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "allow_insert_circles" ON public.circles
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "allow_update_owner_circles" ON public.circles
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "allow_delete_owner_circles" ON public.circles
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- =============================================
-- CIRCLE MEMBERS POLICIES
-- =============================================
CREATE POLICY "allow_member_select_members" ON public.circle_members
  FOR SELECT TO authenticated
  USING (
    circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

-- Users can join a circle by inserting themselves, or owners can add members
CREATE POLICY "allow_insert_members" ON public.circle_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    circle_id IN (
      SELECT id FROM public.circles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "allow_delete_members" ON public.circle_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR 
    circle_id IN (
      SELECT id FROM public.circles WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- POSTS POLICIES
-- =============================================
CREATE POLICY "allow_member_select_posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "allow_insert_own_posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "allow_delete_own_posts" ON public.posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- =============================================
-- EXPENSE CATEGORIES POLICIES
-- =============================================
CREATE POLICY "allow_user_select_categories" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY "allow_insert_own_categories" ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_categories" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_delete_own_categories" ON public.expense_categories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- EXPENSES POLICIES
-- =============================================
CREATE POLICY "allow_user_select_expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_insert_own_expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_delete_own_expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- BUDGET PERIODS POLICIES
-- =============================================
CREATE POLICY "allow_user_select_budgets" ON public.budget_periods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_insert_own_budgets" ON public.budget_periods
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_budgets" ON public.budget_periods
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================
CREATE POLICY "allow_recipient_select_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "allow_recipient_update_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
