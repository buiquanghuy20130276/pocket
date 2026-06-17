-- Migration 007: Fix RLS infinite recursion on circle_members and circles
-- Run this in your Supabase SQL Editor

-- 1. Create a security definer function to check membership.
-- SECURITY DEFINER runs the query with database owner privileges, bypassing RLS checks inside the function.
CREATE OR REPLACE FUNCTION public.is_circle_member(p_circle_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF p_circle_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 
    FROM public.circle_members 
    WHERE circle_id = p_circle_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing recursive policies
DROP POLICY IF EXISTS "allow_member_select_circles" ON public.circles;
DROP POLICY IF EXISTS "allow_member_select_members" ON public.circle_members;
DROP POLICY IF EXISTS "allow_member_select_posts" ON public.posts;
DROP POLICY IF EXISTS "allow_insert_own_posts" ON public.posts;

-- 3. Re-create Circles Select Policy (using function)
CREATE POLICY "allow_member_select_circles" ON public.circles
  FOR SELECT TO authenticated
  USING (
    public.is_circle_member(id, auth.uid())
  );

-- 4. Re-create Circle Members Select Policy (using function)
CREATE POLICY "allow_member_select_members" ON public.circle_members
  FOR SELECT TO authenticated
  USING (
    public.is_circle_member(circle_id, auth.uid())
  );

-- 5. Re-create Posts Policies (using function)
CREATE POLICY "allow_member_select_posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    public.is_circle_member(circle_id, auth.uid()) OR
    (circle_id IS NULL AND author_id = auth.uid())
  );

CREATE POLICY "allow_insert_own_posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    (
      circle_id IS NULL OR
      public.is_circle_member(circle_id, auth.uid())
    )
  );
