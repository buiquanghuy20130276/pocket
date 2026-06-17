-- Migration 010: Fix RLS for shared expenses and categories in circle
-- Run this in your Supabase SQL Editor or migration tool

-- 1. Create a security definer function to check if two users share any circle
CREATE OR REPLACE FUNCTION public.share_any_circle(p_user_a uuid, p_user_b uuid)
RETURNS boolean AS $$
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL THEN
    RETURN false;
  END IF;
  IF p_user_a = p_user_b THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 
    FROM public.circle_members ma
    JOIN public.circle_members mb ON ma.circle_id = mb.circle_id
    WHERE ma.user_id = p_user_a AND mb.user_id = p_user_b
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-create Expenses SELECT policy to support circle viewing
DROP POLICY IF EXISTS "allow_user_select_expenses" ON public.expenses;
CREATE POLICY "allow_user_select_expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_circle_member(circle_id, auth.uid())
  );

-- 3. Re-create Expense Categories SELECT policy to support circle viewing
DROP POLICY IF EXISTS "allow_user_select_categories" ON public.expense_categories;
CREATE POLICY "allow_user_select_categories" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    is_default = true OR
    public.share_any_circle(user_id, auth.uid())
  );
