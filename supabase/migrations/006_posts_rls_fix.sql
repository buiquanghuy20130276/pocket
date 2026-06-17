-- Migration 006: Fix RLS policies for posts table to support private/circle-less posts
-- Run this in your Supabase SQL Editor

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "allow_member_select_posts" ON public.posts;
DROP POLICY IF EXISTS "allow_insert_own_posts" ON public.posts;

-- 2. Allow viewing posts in the user's circle OR their own private posts (where circle_id is NULL)
CREATE POLICY "allow_member_select_posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    ) OR (circle_id IS NULL AND author_id = auth.uid())
  );

-- 3. Allow inserting posts for the user's own author_id,
-- either to a circle they are a member of, or as a private post (circle_id IS NULL)
CREATE POLICY "allow_insert_own_posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    (
      circle_id IS NULL OR
      circle_id IN (
        SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
      )
    )
  );
